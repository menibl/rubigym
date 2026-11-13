import { createHash } from 'node:crypto';
import { matchesAnnouncement } from '../shared/announcement-audience.js';
import { normalizeIsraeliMobile, sendPulseemSms } from './sms-auth.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function queueAnnouncement(payload, body, manager, now = new Date()) {
  const raw = body?.announcement;
  if (!raw || typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(raw.id)
    || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 200
    || typeof raw.content !== 'string' || !raw.content.trim() || raw.content.length > 1000) fail('יש להזין כותרת עד 200 תווים והודעה עד 1,000 תווים.');
  if (raw.targetGender && !['ALL', 'MALE', 'FEMALE'].includes(raw.targetGender)) fail('בחירת קהל אינה תקינה.');
  for (const key of ['targetAgeMin', 'targetAgeMax']) if (raw[key] !== undefined && (!Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > 120)) fail('טווח הגילים אינו תקין.');
  if (raw.targetAgeMin > raw.targetAgeMax) fail('טווח הגילים אינו תקין.');
  if (raw.targetMembershipTypes !== undefined && (!Array.isArray(raw.targetMembershipTypes) || raw.targetMembershipTypes.length > 100 || raw.targetMembershipTypes.some(type => typeof type !== 'string' || type.length > 100))) fail('בחירת מסלולים אינה תקינה.');
  const announcement = { id: raw.id, title: raw.title.trim(), content: raw.content.trim(),
    createdBy: manager.name, creatorRole: 'MANAGER', date: now.toISOString().slice(0, 10),
    targetGender: raw.targetGender || 'ALL', targetAgeMin: raw.targetAgeMin, targetAgeMax: raw.targetAgeMax,
    targetMembershipTypes: raw.targetMembershipTypes, smsRequested: body.sendSms === true };
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...announcement, date: undefined })).digest('hex');
  const existing = payload.announcements?.find(item => item.id === raw.id);
  if (existing) {
    if (existing.smsRequestFingerprint !== fingerprint) fail('ההודעה כבר פורסמה עם פרטים אחרים. יש לפתוח הודעה חדשה.', 409);
    return { payload, announcement: existing, reused: true };
  }
  if (payload.announcementSmsDeliveries?.some(job => job.announcementId === raw.id)) fail('ההודעה כבר פורסמה ונמחקה. יש לפתוח הודעה חדשה.', 409);
  const deliveries = new Map();
  let missingPhone = 0;
  if (announcement.smsRequested) for (const user of payload.users || []) {
    if (!matchesAnnouncement(user, announcement, now)) continue;
    const phone = normalizeIsraeliMobile(user.phone);
    if (!phone) { missingPhone++; continue; }
    const hash = createHash('sha256').update(phone).digest('hex');
    if (!deliveries.has(hash)) deliveries.set(hash, { id: `announcement-sms-${raw.id}-${hash}`, announcementId: raw.id,
      userId: user.id, phone, status: 'PENDING', requestedBy: manager.id, requestedAt: now.toISOString(),
      text: `BALY wellness\n${announcement.title}\n${announcement.content}` });
  }
  const saved = { ...announcement, smsRequestFingerprint: fingerprint, smsQueuedCount: deliveries.size, smsMissingPhoneCount: missingPhone };
  return { announcement: saved, payload: { ...payload, announcements: [saved, ...(payload.announcements || [])],
    announcementSmsDeliveries: [...(payload.announcementSmsDeliveries || []), ...deliveries.values()] } };
}

async function updateDelivery(store, clubId, id, status, onlyPending = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    if (!state) return;
    const deliveries = state.payload.announcementSmsDeliveries || [];
    if (!deliveries.some(item => item.id === id)) return;
    if (onlyPending && !deliveries.some(item => item.id === id && item.status === 'PENDING')) return;
    const after = { ...state.payload, announcementSmsDeliveries: deliveries.map(item => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item) };
    if (!(await store.putClubState(clubId, after, state.revision)).conflict) return;
  }
}

// Bounded batches, permanent per-number delivery claims and no ambiguous retries.
// A provider acceptance is not proof of delivery to the handset.
export async function sendAnnouncementSms(store, env, sendSms = sendPulseemSms) {
  if (!store || !env.PULSEEM_API_KEY || !env.PULSEEM_FROM_NUMBER) return;
  for (const club of await store.getAllClubStates()) {
    const state = await store.getClubState(club.club_id);
    const jobs = (state?.payload?.announcementSmsDeliveries || []).filter(item => item.status === 'PENDING').slice(0, 20);
    const dispatch = async job => {
      const latest = await store.getClubState(club.club_id);
      if (!latest?.payload.announcements?.some(item => item.id === job.announcementId)
        || !latest.payload.users?.some(item => item.id === job.userId)) {
        await updateDelivery(store, club.club_id, job.id, 'CANCELLED'); return;
      }
      if (!await store.claimPushDelivery(club.club_id, job.id)) {
        // Another worker may be dispatching it. Never overwrite an existing result.
        const claimedAt = Date.parse(job.requestedAt);
        if (Date.now() - claimedAt > 24 * 60 * 60 * 1000) await updateDelivery(store, club.club_id, job.id, 'FAILED_OR_UNKNOWN', true);
        return;
      }
      await updateDelivery(store, club.club_id, job.id, 'DISPATCHING');
      let status = 'ACCEPTED';
      try { await sendSms({ env, phone: job.phone, text: job.text, reference: job.id }); }
      catch { status = 'FAILED_OR_UNKNOWN'; }
      await updateDelivery(store, club.club_id, job.id, status);
    };
    for (let index = 0; index < jobs.length; index += 4) await Promise.all(jobs.slice(index, index + 4).map(dispatch));
  }
}
