import { createHash } from 'node:crypto';
import { clubDate } from '../shared/membership-calendar.js';
import { paymentReminderEligible, paymentReminderWindow, shiftReminderDate } from '../shared/payment-reminder-policy.js';
import { normalizeIsraeliMobile, sendPulseemSms } from './sms-auth.js';

// A bounded daytime catch-up window. No overnight deliveries or backfilled days.
export function paymentReminderDate(now) {
  const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(new Date(now)));
  return hour >= 10 && hour < 20 ? clubDate(new Date(now)) : null;
}

export function paymentReminderRecipients(payload, date) {
  const users = payload.users || [];
  const result = new Map();
  for (const user of users) {
    if (!paymentReminderEligible(user, date)) continue;
    const payer = user.familyPayerId && users.find(candidate => candidate.id === user.familyPayerId && candidate.familyId && candidate.familyId === user.familyId);
    const recipient = payer || user;
    if (recipient.paymentReminderExempt || (recipient.isMembershipFrozen && (!recipient.membershipFrozenUntil || recipient.membershipFrozenUntil >= date))) continue;
    const participation = payer?.familyMemberPlans?.find(member => member.memberId === user.id)?.participation;
    if (participation && participation !== 'INCLUDED') continue;
    const entry = result.get(recipient.id) || { recipient, members: [], smsDue: false };
    entry.members.push(user);
    if (paymentReminderWindow(user, date).day % 3 === 0) entry.smsDue = true;
    result.set(recipient.id, entry);
  }
  return [...result.values()];
}

const content = members => `תזכורת אוטומטית מ־BALY wellness: תוקף המנוי ${members.length === 1 ? `של ${members[0].name}` : `של ${members.map(member => member.name).join(', ')}`} הסתיים. לחידוש, היכנסו ל״המנוי והתשלומים שלי״ באפליקציה. אם אינכם מתכננים לחדש כעת, פנו למנהל להקפאה או להפסקת התזכורות.`;
const smsText = 'BALY wellness: תוקף המנוי הסתיים. לחידוש: https://balywellness.com/?workspace=my_membership להקפאה או הפסקת תזכורות פנו למנהל.';
const deliveryId = (recipient, date, channel) => `membership-payment-${channel}-${date}-${recipient.id}`;

async function recordSms(store, clubId, record) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    if (!state) return;
    const audit = state.payload.membershipReminderDeliveries || [];
    const payload = { ...state.payload, membershipReminderDeliveries: [...audit.filter(item => item.id !== record.id), record].slice(-5000) };
    if (!(await store.putClubState(clubId, payload, state.revision)).conflict) return;
  }
}

export async function sendPaymentReminders(store, env, dispatch, now = Date.now(), sendSms = sendPulseemSms) {
  const date = paymentReminderDate(now);
  if (!store || !date || String(env.PAYMENT_REMINDERS_ENABLED).toLowerCase() === 'false') return;
  for (const club of await store.getAllClubStates()) {
    // Persist messages using CAS, then dispatch push only for newly saved messages.
    for (let attempt = 0; attempt < 5; attempt++) {
      const state = await store.getClubState(club.club_id);
      if (!state) break;
      const manager = (state.payload.users || []).filter(user => user.role === 'MANAGER').sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!manager) break;
      const existing = new Set((state.payload.messages || []).map(message => message.id));
      const messages = paymentReminderRecipients(state.payload, date).filter(({ recipient }) => !existing.has(deliveryId(recipient, date, 'app')))
        .map(({ recipient, members }) => ({ id: deliveryId(recipient, date, 'app'), senderId: manager.id, senderName: manager.name,
          senderRole: 'MANAGER', receiverId: recipient.id, content: content(members), timestamp: new Date(now).toISOString(), read: false,
          systemGenerated: true, actionUrl: '?workspace=my_membership', actionLabel: 'חידוש מנוי ותשלום' }));
      if (!messages.length) break;
      const after = { ...state.payload, messages: [...(state.payload.messages || []), ...messages] };
      if ((await store.putClubState(club.club_id, after, state.revision)).conflict) continue;
      await dispatch(store, env, club.club_id, state.payload, after);
      break;
    }
    // SMS does not depend on push configuration/subscriptions. Claims survive restarts.
    if (!env.PULSEEM_API_KEY || !env.PULSEEM_FROM_NUMBER) continue;
    const state = await store.getClubState(club.club_id);
    if (!state) continue;
    for (const entry of paymentReminderRecipients(state.payload, date)) {
      if (!entry.smsDue) continue;
      const phone = normalizeIsraeliMobile(entry.recipient.phone);
      if (!phone) continue;
      const id = deliveryId(entry.recipient, date, 'sms');
      // Never retry an ambiguous provider timeout: it may already have sent the SMS.
      const phoneKey = createHash('sha256').update(phone).digest('hex');
      if ((state.payload.membershipReminderDeliveries || []).some(record => record.channel === 'SMS'
        && (record.userId === entry.recipient.id || record.phoneKey === phoneKey)
        && record.date > shiftReminderDate(date, -3))) continue;
      if (!await store.claimPushDelivery(club.club_id, `membership-payment-sms:${date}:${phoneKey}`)) continue;
      const latest = await store.getClubState(club.club_id);
      const current = latest && paymentReminderRecipients(latest.payload, date).find(item => item.recipient.id === entry.recipient.id && item.smsDue);
      if (!current || normalizeIsraeliMobile(current.recipient.phone) !== phone) continue;
      let status = 'ACCEPTED';
      try {
        await sendSms({ env, phone, text: smsText, reference: id });
      } catch {
        status = 'FAILED_OR_UNKNOWN';
      }
      console.info('Membership payment reminder SMS', { userId: current.recipient.id, date, status });
      await recordSms(store, club.club_id, { id, userId: current.recipient.id, phoneKey, date, channel: 'SMS', status, timestamp: new Date(now).toISOString() });
    }
  }
}
