import { clubDate, membershipExpired } from './membership-calendar.js';
import { changePersonalBooking, personalStart } from './personal-booking.js';
import { hasIncludedOpenGymAccess } from './open-gym-access.js';

export const CLUB_CHECK_IN_CODE = 'BALY-CLUB-CHECKIN-V1';
const fail = message => { throw new Error(message); };
const openSession = s => {
  const [time, end] = String(s.timeSlot || '').split('-').map(v => v.trim());
  const minutes = value => value?.split(':').reduce((n, v) => n * 60 + Number(v), 0);
  return { ...s, time, durationMinutes: minutes(end) - minutes(time) };
};
const validateUser = (payload, id, now) => {
  const user = payload.users?.find(u => u.id === id && u.role === 'TRAINEE');
  if (!user) fail('יש להתחבר כמתאמן.');
  const today = clubDate(new Date(now));
  const payer = payload.users.find(u => u.id === user.familyPayerId);
  if (user.registrationIncomplete || user.registrationPaymentPending || user.familyPaymentPending) fail('יש להשלים רישום ותשלום לפני הכניסה.');
  if (!(user.membershipStatus === 'ACTIVE' || user.offlinePaymentApproved || payer?.membershipStatus === 'ACTIVE') || membershipExpired(user.membershipExpiry ? user : payer, today)) fail('יש להסדיר מנוי בתוקף לפני הכניסה.');
  if (user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today)) fail('המנוי מוקפא.');
  if (user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today) fail('המנוי בוטל.');
  const signed = Date.parse(user.healthDeclarationDate || '');
  const expires = new Date(signed); expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  if (!user.healthDeclarationSigned || !Number.isFinite(signed) || now > expires.getTime() || (user.healthDeclarationRequiresMedicalCertificate && !user.healthDeclarationMedicalCertificateApproved)) fail('נדרשת הצהרת בריאות בתוקף.');
  return user;
};
const logId = (id, type, targetId, date) => `arrival-${id}-${type}-${targetId}-${date}`;
const checked = (payload, id, type, targetId, date) => (payload.attendanceLogs || []).some(l => l.traineeId === id && l.type === type && l.targetId === targetId && l.date === date);
const inWindow = (s, now, early = 0) => {
  const start = personalStart(s);
  return Number.isFinite(start) && now >= start - early * 60000 && now < start + Number(s.durationMinutes) * 60000;
};
const arrivalTime = now => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now));
const dropInTarget = (id, type, date) => `drop-in-${id}-${type}-${date}`;
// Reuse personal booking validation and debit on a temporary validation slot.
// It is never saved into the calendar and cannot be created through the booking API.
const personalDropIn = (payload, actorId, type, partnerId, now) => {
  const date = clubDate(new Date(now)), id = dropInTarget(actorId, type, date);
  const session = { id, title: type === 'DUO' ? 'כניסה לאימון זוגי' : 'כניסה לאימון אישי',
    date, time: arrivalTime(now), durationMinutes: 1, isPersonalTraining: true,
    registeredUsers: [], waitlistUsers: [], maxParticipants: 1, genderRestriction: 'ALL' };
  const booked = changePersonalBooking({ ...payload, sessions: [...(payload.sessions || []), session] }, actorId,
    { action: 'BOOK', sessionId: id, bookingId: logId(actorId, 'SESSION', id, date), type, partnerId }, now, { arrival: true });
  return { ...booked, sessions: payload.sessions || [] };
};
const openCount = (payload, id, date) => (payload.openGymSessions || []).filter(s => s.date === date && s.registeredUsers?.includes(id)).length
  + (payload.attendanceLogs || []).filter(l => l.traineeId === id && l.date === date && l.type === 'OPEN_GYM' && l.unscheduled).length;
const canOpen = (payload, user, s, now) => {
  const memberships = [user.membershipType, ...(user.secondaryMemberships || [])];
  if (!hasIncludedOpenGymAccess(memberships)) return false;
  if (s.registeredUsers?.includes(user.id)) return true;
  if ((s.registeredUsers || []).length >= s.maxParticipants) return false;
  if (openCount(payload, user.id, s.date) >= 2) return false;
  if (s.genderRestriction && s.genderRestriction !== 'ALL' && s.genderRestriction !== user.gender) return false;
  if ((s.ageMin || s.ageMax) && (!(user.age > 0) || user.age < (s.ageMin || 0) || user.age > (s.ageMax || Infinity))) return false;
  const start = personalStart(openSession(s)), end = start + openSession(s).durationMinutes * 60000;
  return ![...(payload.sessions || []), ...(payload.openGymSessions || []).filter(o => o.id !== s.id).map(openSession)]
    .some(o => o.registeredUsers?.includes(user.id) && personalStart(o) < end && personalStart(o) + o.durationMinutes * 60000 > start);
};

// This same policy runs in production and the isolated Pages demo. No client balance writes.
export function clubArrivalChoices(payload, actorId, now = Date.now()) {
  const user = validateUser(payload, actorId, now), date = clubDate(new Date(now));
  const choices = [];
  for (const s of payload.sessions || []) {
    if (s.date !== date || !inWindow(s, now, 30) || s.coachApprovalStatus === 'DECLINED') continue;
    if (s.registeredUsers?.includes(actorId)) {
      choices.push({ key: `SESSION:${s.id}`, type: 'SESSION', targetId: s.id, title: s.title, time: s.time,
        trainingType: s.isPersonalTraining ? s.personalBooking?.type || 'SOLO' : 'GROUP', registered: true,
        checkedIn: checked(payload, actorId, 'SESSION', s.id, date) });
    } else if (s.isPersonalTraining && !s.isDemoSession) {
      for (const type of ['SOLO', 'DUO']) {
        const partners = type === 'DUO' ? (payload.users || []).filter(u => u.id !== actorId && user.familyId && u.familyId === user.familyId) : [null];
        const eligiblePartners = partners.filter(partner => {
          try { changePersonalBooking(payload, actorId, { action: 'BOOK', sessionId: s.id, bookingId: 'arrival-preview', type, partnerId: partner?.id }, now, { arrival: true }); return true; }
          catch { return false; }
        });
        if (eligiblePartners.length) choices.push({ key: `SESSION:${s.id}:${type}`, type: 'SESSION', targetId: s.id, title: s.title, time: s.time,
          trainingType: type, registered: false, checkedIn: false, partners: eligiblePartners.filter(Boolean).map(p => ({ id: p.id, name: p.name })) });
      }
    }
  }
  for (const s of payload.openGymSessions || []) {
    if (s.date !== date || !inWindow(openSession(s), now) || !canOpen(payload, user, s, now)) continue;
    choices.push({ key: `OPEN_GYM:${s.id}`, type: 'OPEN_GYM', targetId: s.id, title: 'Open Gym', time: s.timeSlot,
      trainingType: 'OPEN_GYM', registered: Boolean(s.registeredUsers?.includes(actorId)), checkedIn: checked(payload, actorId, 'OPEN_GYM', s.id, date) });
  }
  // Existing unscheduled attendance remains visible even with an exhausted card.
  for (const log of payload.attendanceLogs || []) {
    if (log.traineeId === actorId && log.date === date && log.unscheduled) choices.push({
      key: `${log.type}:${log.targetId}`, type: log.type, targetId: log.targetId, title: log.targetTitle,
      time: log.timestamp, trainingType: log.trainingType, registered: true, checkedIn: true, unscheduled: true
    });
  }
  // Do not bypass a full/restricted calendar slot or debit for an existing booking.
  const personalWindow = (payload.sessions || []).some(s => s.date === date && s.isPersonalTraining && inWindow(s, now, 30));
  if (!personalWindow) for (const type of ['SOLO', 'DUO']) {
    if (choices.some(c => c.trainingType === type)) continue;
    const partners = type === 'DUO' ? (payload.users || []).filter(u => u.id !== actorId && user.familyId && u.familyId === user.familyId) : [null];
    const eligible = partners.filter(p => {
      try { personalDropIn(payload, actorId, type, p?.id, now); return true; } catch { return false; }
    });
    if (eligible.length) choices.push({ key: `DROP_IN:${type}`, type: 'SESSION', targetId: dropInTarget(actorId, type, date),
      title: type === 'DUO' ? 'אימון זוגי' : 'אימון אישי', time: 'כניסה ללא אימון ביומן', trainingType: type,
      registered: false, checkedIn: false, unscheduled: true, partners: eligible.filter(Boolean).map(p => ({ id: p.id, name: p.name })) });
  }
  const openWindow = (payload.openGymSessions || []).some(s => s.date === date && inWindow(openSession(s), now));
  const overlapping = [...(payload.sessions || []), ...(payload.openGymSessions || []).map(openSession)].some(s => s.registeredUsers?.includes(actorId) && inWindow(s, now));
  if (!openWindow && !overlapping && !choices.some(c => c.trainingType === 'OPEN_GYM') && openCount(payload, actorId, date) < 2
    && hasIncludedOpenGymAccess([user.membershipType, ...(user.secondaryMemberships || [])])) choices.push({
      key: 'DROP_IN:OPEN_GYM', type: 'OPEN_GYM', targetId: dropInTarget(actorId, 'OPEN_GYM', date), title: 'Open Gym',
      time: 'כניסה ללא משבצת ביומן', trainingType: 'OPEN_GYM', registered: false, checkedIn: false, unscheduled: true });
  return choices;
}

export function recordClubArrival(payload, actorId, input, now = Date.now()) {
  if (input.code !== CLUB_CHECK_IN_CODE) fail('יש לסרוק את קוד המועדון.');
  const user = validateUser(payload, actorId, now), date = clubDate(new Date(now));
  // A repeat request is a no-op, including concurrent retries after a booking debit.
  const existing = (payload.attendanceLogs || []).find(l => l.traineeId === actorId && l.type === input.type && l.targetId === input.targetId && l.date === date);
  if (existing) return payload;
  const choice = clubArrivalChoices(payload, actorId, now).find(c => c.type === input.type && c.targetId === input.targetId && (c.registered || c.trainingType === input.trainingType));
  if (!choice) fail('האימון אינו זמין לכניסה כעת. יש לבחור אימון פנוי המתאים למנוי.');
  let next = payload;
  if (!choice.registered) {
    if (choice.unscheduled) {
      if (choice.type === 'SESSION') next = personalDropIn(payload, actorId, choice.trainingType, input.partnerId, now);
    } else if (choice.type === 'SESSION') next = changePersonalBooking(payload, actorId, {
      action: 'BOOK', sessionId: choice.targetId, bookingId: logId(actorId, choice.type, choice.targetId, date), type: choice.trainingType, partnerId: input.partnerId
    }, now, { arrival: true });
    else next = { ...payload, openGymSessions: payload.openGymSessions.map(s => s.id === choice.targetId ? { ...s, registeredUsers: [...s.registeredUsers, actorId], waitlistUsers: (s.waitlistUsers || []).filter(id => id !== actorId) } : s) };
  }
  const log = { id: logId(actorId, choice.type, choice.targetId, date), traineeId: actorId, traineeName: user.name,
    type: choice.type, targetId: choice.targetId, targetTitle: choice.title, date,
    timestamp: arrivalTime(now), trainingType: choice.trainingType,
    ...(choice.unscheduled ? { unscheduled: true, payerId: actorId } : {}) };
  const partner = choice.unscheduled && choice.trainingType === 'DUO' ? payload.users.find(u => u.id === input.partnerId) : null;
  const partnerLogs = partner ? [{ ...log, id: logId(partner.id, choice.type, choice.targetId, date), traineeId: partner.id, traineeName: partner.name }] : [];
  return { ...next, attendanceLogs: [log, ...partnerLogs, ...(next.attendanceLogs || [])] };
}

// Only call after arrival validation/persistence; never use client-supplied balances.
export function clubArrivalResult(payload, actorId, input, alreadyRecorded = false) {
  if (input.type === 'OPEN_GYM') return { ok: true, alreadyRecorded, message: 'ברוך הבא למועדון, אימון נעים! הגעתך תועדה.' };
  const session = payload.sessions.find(s => s.id === input.targetId);
  const log = (payload.attendanceLogs || []).find(l => l.traineeId === actorId && l.type === input.type && l.targetId === input.targetId);
  if (!session?.isPersonalTraining && !log?.unscheduled) return { ok: true, alreadyRecorded, message: `הגעתך לאימון${session?.title ? `: ${session.title}` : ''} תועדה.` };
  const duo = log?.unscheduled ? log.trainingType === 'DUO' : session.personalBooking?.type === 'DUO';
  const payer = payload.users.find(u => u.id === (log?.unscheduled ? log.payerId : session.personalBooking?.payerId || actorId));
  const remaining = Number(payer?.[duo ? 'duoTrainingRemaining' : 'personalTrainingRemaining'] || 0);
  const size = Number(payer?.[duo ? 'duoTrainingCardSize' : 'personalTrainingCardSize'] || 0);
  const balance = size > 0 ? `${remaining}/${size}` : String(remaining);
  const payerLabel = payer?.id !== actorId && payer?.name ? ` בכרטיסייה של ${payer.name}` : '';
  return { ok: true, alreadyRecorded, remaining, cardSize: size > 0 ? size : null,
    message: `נרשמת לאימון ${duo ? 'זוגי' : 'אישי'}. יתרה${payerLabel}: ${balance}. הגעתך תועדה.` };
}
