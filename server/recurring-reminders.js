import { clubDate } from '../shared/membership-calendar.js';
import { sendPulseemSms } from './sms-auth.js';

export function recurringReminderEvents(payload, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  if (parts.hour !== '09') return [];
  const today = clubDate(now);
  return (payload.recurringSubscriptions || []).flatMap(subscription => {
    if (!['ACTIVE', 'EXPIRING'].includes(subscription.status) || !subscription.providerVerifiedAt
      || !subscription.providerRecurringSaleId || !subscription.consent?.acceptedAt) return [];
    const user = (payload.users || []).find(user => user.id === subscription.userId);
    if (!user) return [];
    const days = (Date.parse(`${subscription.endsAt}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
    if (![30, 7, 0].includes(days)) return [];
    const renewal = subscription.renewalMode === 'AUTO';
    const text = renewal
      ? `BALY WELLNESS: תקופת המנוי ${subscription.planName} מסתיימת ב־${subscription.endsAt} ותתחדש אוטומטית ל־${subscription.termMonths} חודשים נוספים, בחיוב חודשי של ₪${subscription.monthlyAmount}. לבירור או בקשת ביטול: https://balywellness.com/`
      : `BALY WELLNESS: המנוי ${subscription.planName} מסתיים ב־${subscription.endsAt}. נדרש אישור לחידוש; ללא אישור לא יימשכו חיובים. לחידוש: https://balywellness.com/`;
    return [{ id: `recurring-term:${subscription.id}:${subscription.endsAt}:${days}`, subscriptionId: subscription.id, userId: user.id, phone: user.phone, text, date: today }];
  });
}

async function recordNotice(store, clubId, event, patch, now) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await store.getClubState(clubId);
    if (!state) return;
    const notices = state.payload.recurringNotices || [];
    const previous = notices.find(notice => notice.id === event.id);
    const next = { id: event.id, subscriptionId: event.subscriptionId, userId: event.userId, date: event.date, updatedAt: now.toISOString(), ...previous, ...patch };
    const saved = await store.putClubState(clubId, { ...state.payload, recurringNotices: [...notices.filter(notice => notice.id !== event.id), next] }, state.revision);
    if (!saved.conflict) return;
  }
  throw new Error('RECURRING_NOTICE_CONFLICT');
}

export async function sendRecurringReminders(store, env, dispatch, now = new Date(), sendSms = sendPulseemSms) {
  // Separate from OTP and from push permissions. Disabled unless explicitly enabled.
  if (String(env.RECURRING_REMINDERS_ENABLED).toLowerCase() !== 'true' || !store?.getAllClubStates || !store?.claimPushDelivery) return;
  for (const club of await store.getAllClubStates()) {
    const events = recurringReminderEvents(club.payload, now);
    for (const event of events) {
      // Durable at-most-once attempt: retain the claim on ambiguous provider failure.
      // Never blindly resend an SMS after a timeout or a process crash.
      if (!await store.claimPushDelivery(club.club_id, event.id)) continue;
      try {
        const smsReference = crypto.randomUUID();
        await recordNotice(store, club.club_id, event, { smsStatus: 'ATTEMPTING', smsReference }, now);
        for (let attempt = 0; attempt < 3; attempt++) {
          const before = await store.getClubState(club.club_id);
          if (!before) break;
          const manager = before.payload.users?.find(user => user.role === 'MANAGER');
          if (!manager || before.payload.messages?.some(message => message.id === event.id)) break;
          const after = { ...before.payload, messages: [...(before.payload.messages || []), { id: event.id, senderId: manager.id, receiverId: event.userId, text: event.text, timestamp: now.toISOString(), read: false, systemGenerated: true, actionUrl: '/' }] };
          const saved = await store.putClubState(club.club_id, after, before.revision);
          if (saved.conflict) continue;
          try { await dispatch?.(store, env, club.club_id, before.payload, after); }
          catch { console.warn('Recurring reminder push dispatch failed', { noticeId: event.id }); }
          break;
        }
        if (!event.phone) {
          await recordNotice(store, club.club_id, event, { smsStatus: 'MISSING_PHONE' }, now);
          continue;
        }
        const result = await sendSms({ env, phone: event.phone, text: event.text, reference: smsReference });
        await recordNotice(store, club.club_id, event, { smsStatus: result.ok ? 'PROVIDER_ACCEPTED' : 'REVIEW_REQUIRED' }, now);
      } catch {
        // An accepted API request is not proof of handset delivery. No card or SMS secrets are logged.
        await recordNotice(store, club.club_id, event, { smsStatus: 'REVIEW_REQUIRED' }, now);
        console.warn('Recurring reminder requires operator review', { noticeId: event.id });
      }
    }
  }
}
