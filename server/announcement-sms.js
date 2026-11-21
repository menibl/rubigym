import { createHash, randomUUID } from 'node:crypto';
import { matchesAnnouncement } from '../shared/announcement-audience.js';
import { normalizeIsraeliMobile, sendPulseemSms } from './sms-auth.js';
import { redactPulseemText } from './pulseem-diagnostics.js';

export function announcementProviderReference(job) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job.providerReference || '')) return job.providerReference;
  // Never assign a NEW provider identity to an old possibly-dispatched request.
  return null;
}

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
      providerReference: randomUUID(), userId: user.id, phone, status: 'PENDING', requestedBy: manager.id, requestedAt: now.toISOString(),
      text: `BALY wellness\n${announcement.title}\n${announcement.content}` });
  }
  const saved = { ...announcement, smsRequestFingerprint: fingerprint, smsQueuedCount: deliveries.size, smsMissingPhoneCount: missingPhone };
  return { announcement: saved, payload: { ...payload, announcements: [saved, ...(payload.announcements || [])],
    announcementSmsDeliveries: [...(payload.announcementSmsDeliveries || []), ...deliveries.values()] } };
}

// A deliberate one-recipient test is a separate delivery, not a retry/reset of
// the audience outbox. One permanent key per announcement + normalized number.
export function queueAnnouncementSmsTest(payload, body, manager, now = new Date()) {
  const announcement = (payload.announcements || []).find(item => item.id === body?.announcementId);
  if (!announcement) fail('המודעה לא נמצאה.', 404);
  if (typeof announcement.title !== 'string' || !announcement.title.trim() || announcement.title.length > 200
    || typeof announcement.content !== 'string' || !announcement.content.trim() || announcement.content.length > 1000) fail('נוסח המודעה אינו תקין לבדיקה.');
  const phone = normalizeIsraeliMobile(body?.phone);
  if (!phone) fail('יש להזין מספר נייד ישראלי תקין לבדיקה.');
  if (!['preview', 'send'].includes(body?.action)) fail('פעולת בדיקה אינה תקינה.');
  const text = `BALY wellness\n${announcement.title}\n${announcement.content}`;
  const fingerprint = createHash('sha256').update(text).digest('hex');
  const id = `announcement-sms-test-${announcement.id}-${createHash('sha256').update(phone).digest('hex')}`;
  const existing = (payload.announcementSmsDeliveries || []).find(job => job.id === id);
  const project = job => job ? { status: job.status, diagnostic: job.diagnostic, providerReference: announcementProviderReference(job) } : null;
  const preview = { title: announcement.title, text, phoneSuffix: phone.slice(-4), fingerprint, delivery: project(existing) };
  if (body.action === 'preview' || existing) return { payload, preview, reused: Boolean(existing) };
  if (body.confirmed !== true || body.fingerprint !== fingerprint) fail('נדרש אישור הנוסח העדכני והמספר לפני שליחת בדיקה.', 409);
  const job = { id, announcementId: announcement.id, userId: manager.id, phone, text,
    providerReference: randomUUID(), testOnly: true, requestedBy: manager.id, requestedAt: now.toISOString(), status: 'PENDING' };
  return { payload: { ...payload, announcementSmsDeliveries: [...(payload.announcementSmsDeliveries || []), job] },
    preview: { ...preview, delivery: project(job) }, reused: false };
}

// Provider responses are untrusted: keep only bounded diagnostic fields, never
// request bodies, headers, recipient details or arbitrary exception messages.
function deliveryDiagnostic(error, result, env, job, failed) {
  const provider = error?.provider || result?.provider;
  const context = { apiKey: env.PULSEEM_API_KEY, fromNumber: env.PULSEEM_FROM_NUMBER,
    phone: job.phone, text: job.text, reference: announcementProviderReference(job) };
  const redact = value => redactPulseemText(value, context, 180);
  const reason = !failed ? 'PROVIDER_ACCEPTED'
    : error?.provider ? 'PROVIDER_REJECTED'
      : ['AbortError', 'TimeoutError'].includes(error?.name) ? 'TIMEOUT_OR_ABORT'
        : error?.message === 'SMS_NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'TRANSPORT_OR_UNKNOWN';
  return { recordedAt: new Date().toISOString(), reason,
    ...(Number.isInteger(provider?.httpStatus) && provider.httpStatus >= 100 && provider.httpStatus <= 599
      ? { httpStatus: provider.httpStatus } : {}),
    code: redact(provider?.code), status: redact(provider?.status), message: redact(provider?.message),
    responseType: ['array', 'text', 'empty', 'object', 'string', 'boolean', 'number'].includes(provider?.responseType) ? provider.responseType : '',
    fieldNames: (Array.isArray(provider?.fieldNames) ? provider.fieldNames : []).slice(0, 20).map(redact),
    details: (Array.isArray(provider?.details) ? provider.details : []).slice(0, 12).map(detail => ({
      path: redact(detail?.path), code: redact(detail?.code), status: redact(detail?.status), message: redact(detail?.message) })),
    truncated: provider?.truncated === true || [provider?.code, provider?.status, provider?.message,
      ...(Array.isArray(provider?.details) ? provider.details.flatMap(detail => [detail?.path, detail?.code, detail?.status, detail?.message]) : [])]
      .some(value => typeof value === 'string' && value.length > 180) };
}

async function updateDelivery(store, clubId, id, status, onlyPending = false, diagnostic) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.getClubState(clubId);
    if (!state) return;
    const deliveries = state.payload.announcementSmsDeliveries || [];
    if (!deliveries.some(item => item.id === id)) return;
    if (onlyPending && !deliveries.some(item => item.id === id && item.status === 'PENDING')) return;
    const after = { ...state.payload, announcementSmsDeliveries: deliveries.map(item => item.id === id ? { ...item, status, updatedAt: new Date().toISOString(), ...(diagnostic ? { diagnostic } : {}) } : item) };
    if (!(await store.putClubState(clubId, after, state.revision)).conflict) return;
  }
}

// Bounded batches, permanent per-number delivery claims and no ambiguous retries.
// A provider acceptance is not proof of delivery to the handset.
export async function sendAnnouncementSms(store, env, sendSms = sendPulseemSms, logger = console) {
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
      const reference = announcementProviderReference(job);
      if (!reference) {
        // Do not silently migrate/replay old audience requests during rollout,
        // especially before the explicitly approved one-number test.
        await updateDelivery(store, club.club_id, job.id, 'FAILED_OR_UNKNOWN', true, {
          recordedAt: new Date().toISOString(), reason: 'LEGACY_REFERENCE_REVIEW_REQUIRED',
          code: '', status: '', message: 'Legacy request retained without sending or resetting its claim.'
        });
        return;
      }
      if (!await store.claimPushDelivery(club.club_id, job.id)) {
        // Another worker may be dispatching it. Never overwrite an existing result.
        const claimedAt = Date.parse(job.requestedAt);
        if (Date.now() - claimedAt > 24 * 60 * 60 * 1000) await updateDelivery(store, club.club_id, job.id, 'FAILED_OR_UNKNOWN', true);
        return;
      }
      await updateDelivery(store, club.club_id, job.id, 'DISPATCHING');
      let status = 'ACCEPTED';
      let result; let error;
      try { result = await sendSms({ env, phone: job.phone, text: job.text, reference }); }
      catch (caught) { status = 'FAILED_OR_UNKNOWN'; error = caught; }
      const diagnostic = deliveryDiagnostic(error, result, env, job, status !== 'ACCEPTED');
      // Do not log the job/reference: it contains a hash of the phone number.
      const entry = { announcementId: job.announcementId, testOnly: job.testOnly === true, status, diagnostic };
      if (status !== 'ACCEPTED') logger.warn?.('Club announcement SMS failed or unknown', entry);
      else logger.info?.('Club announcement SMS accepted by provider', entry);
      await updateDelivery(store, club.club_id, job.id, status, false, diagnostic);
    };
    for (let index = 0; index < jobs.length; index += 4) await Promise.all(jobs.slice(index, index + 4).map(dispatch));
  }
}
