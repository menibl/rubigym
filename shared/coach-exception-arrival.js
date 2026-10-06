import { clubDate } from './membership-calendar.js';
import { validateArrivalUser, appendArrivalNotice, clubArrivalResult } from './club-check-in.js';
import { personalStart } from './personal-booking.js';

export const COACH_EXCEPTION_PREFIX = 'BALY-COACH-EXCEPTION-V1:';
const fail = message => { throw new Error(message); };
const staffUser = (payload, id) => {
  const staff = payload.users?.find(u => u.id === id && ['COACH', 'MANAGER'].includes(u.role));
  if (!staff) fail('אישור חריג מותר למאמן או למנהל בלבד.');
  return staff;
};
const traineeUser = (payload, id) => {
  const user = payload.users?.find(u => u.id === id && u.role === 'TRAINEE');
  if (!user) fail('יש להוסיף את המתאמן למאגר לפני תיעוד האימון.');
  return user;
};
const card = type => type === 'DUO' ? ['DUO_TRAINING', 'duoTrainingRemaining'] : ['PERSONAL_TRAINING', 'personalTrainingRemaining'];
const hasCredit = (user, type) => {
  const [membership, field] = card(type);
  return [user.membershipType, ...(user.secondaryMemberships || [])].includes(membership) && Number(user[field]) >= 1;
};
const approvalFor = (payload, actorId, code, now, allowUsed = false) => {
  if (!String(code).startsWith(COACH_EXCEPTION_PREFIX)) fail('קוד אישור המאמן אינו תקין.');
  const approval = (payload.coachArrivalApprovals || []).find(a => a.token === code.slice(COACH_EXCEPTION_PREFIX.length));
  if (!approval || approval.traineeId !== actorId) fail('אישור המאמן אינו מיועד למתאמן הזה.');
  staffUser(payload, approval.coachId);
  if (approval.usedAt && !allowUsed) fail('אישור המאמן כבר מומש. לא נוכה אימון נוסף.');
  if (!approval.usedAt && now >= Date.parse(approval.expiresAt)) fail('אישור המאמן פג תוקף. יש לבקש קוד חדש.');
  return approval;
};

export function createCoachArrivalApproval(payload, coachId, input, token, now = Date.now()) {
  staffUser(payload, coachId);
  const user = traineeUser(payload, input.traineeId);
  if (!hasCredit(user, 'SOLO') && !hasCredit(user, 'DUO')) fail('אין יתרת אימונים אישיים או זוגיים.');
  const reason = String(input.reason || '').trim();
  if (!reason || reason.length > 500) fail('יש להזין סיבת אישור חריג (עד 500 תווים).');
  const approval = { token, traineeId: user.id, coachId, reason, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 10 * 60000).toISOString() };
  // Only keep pending codes for ten minutes; consumed approvals remain audit records.
  return { payload: { ...payload, coachArrivalApprovals: [approval, ...(payload.coachArrivalApprovals || []).filter(a => a.usedAt || (a.traineeId !== user.id && Date.parse(a.expiresAt) > now))] }, code: COACH_EXCEPTION_PREFIX + token, expiresAt: approval.expiresAt };
}

export function coachExceptionChoices(payload, actorId, code, now = Date.now()) {
  const approval = approvalFor(payload, actorId, code, now);
  const user = validateArrivalUser(payload, actorId, now);
  if ((payload.sessions || []).some(s => s.isPersonalTraining && s.registeredUsers?.includes(actorId) && now >= personalStart(s) - 30 * 60000 && now < personalStart(s) + Number(s.durationMinutes) * 60000)) fail('כבר קיימת הרשמה לאימון אישי או זוגי בשעה זו. יש לסרוק את קוד המועדון הרגיל ללא ניכוי נוסף.');
  const choices = [];
  for (const type of ['SOLO', 'DUO']) {
    if (!hasCredit(user, type)) continue;
    const partners = type === 'DUO' ? payload.users.filter(p => p.id !== actorId && user.familyId && p.familyId === user.familyId).filter(p => {
      try { validateArrivalUser(payload, p.id, now); return true; } catch { return false; }
    }).map(p => ({ id: p.id, name: p.name })) : [];
    if (type === 'DUO' && !partners.length) continue;
    choices.push({ key: `EXCEPTION:${approval.token}:${type}`, type: 'SESSION', targetId: approval.token,
      title: type === 'DUO' ? 'אימון זוגי באישור מאמן' : 'אימון אישי באישור מאמן', time: 'אישור חריג — ללא שיוך ליומן',
      trainingType: type, registered: false, checkedIn: false, unscheduled: true, exception: true, partners });
  }
  if (!choices.length) fail(hasCredit(user, 'DUO') ? 'לאימון זוגי יש לשייך בן או בת זוג עם רישום והצהרת בריאות תקפים.' : 'אין יתרת אימונים אישיים או זוגיים.');
  return choices;
}

export function recordCoachExceptionScan(payload, actorId, input, now = Date.now()) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.scanId || '')) fail('מזהה סריקה אינו תקין.');
  let choices = [], error = '';
  try { choices = coachExceptionChoices(payload, actorId, input.code, now); } catch (e) { error = e.message; }
  return { payload: appendArrivalNotice(payload, actorId, input.scanId, `סרק/ה אישור חריג של מאמן. ${error || 'ממתין לאישור ניכוי אישי או זוגי.'}`, now), choices, error };
}

function debitException(payload, user, coach, type, eventId, date, reason, now, partnerId, historical) {
  if (!['SOLO', 'DUO'].includes(type) || !hasCredit(user, type)) fail('אין יתרת אימונים בכרטיסייה שנבחרה.');
  const field = card(type)[1];
  const partner = partnerId ? traineeUser(payload, partnerId) : null;
  const log = { id: `arrival-exception-${eventId}`, traineeId: user.id, traineeName: user.name,
    type: 'SESSION', targetId: eventId, targetTitle: `אימון ${type === 'DUO' ? 'זוגי' : 'אישי'} — אישור חריג של ${coach.name}`,
    date, timestamp: new Date(now).toISOString(), trainingType: type, payerId: user.id, unscheduled: true,
    coachException: true, approvedBy: coach.id, approvalReason: reason, historical: Boolean(historical) };
  const logs = partner ? [log, { ...log, id: `${log.id}-partner`, traineeId: partner.id, traineeName: partner.name }] : [log];
  let next = { ...payload, users: payload.users.map(u => u.id === user.id ? { ...u, [field]: Number(u[field]) - 1 } : u), attendanceLogs: [...logs, ...(payload.attendanceLogs || [])] };
  next = appendArrivalNotice(next, user.id, eventId, `${log.targetTitle}. תאריך: ${date}. סיבה: ${reason}. נוכה קרדיט אחד. יתרה: ${Number(user[field]) - 1}.${historical ? ' תיעוד בדיעבד; אינו אישור כניסה נוכחי.' : ''}`, now);
  const message = { id: `coach-exception-receipt-${eventId}`, senderId: coach.id, senderName: coach.name, senderRole: coach.role,
    receiverId: user.id, content: `${log.targetTitle}. נוכה קרדיט אחד. יתרה: ${Number(user[field]) - 1}. תאריך האימון: ${date}.`, timestamp: new Date(now).toISOString(), read: false, systemGenerated: true };
  return { ...next, messages: [...(next.messages || []), message] };
}

export function redeemCoachArrivalApproval(payload, actorId, input, now = Date.now()) {
  const approval = approvalFor(payload, actorId, input.code, now, true);
  if (input.type !== 'SESSION' || input.targetId !== approval.token) fail('יעד האימון אינו תואם לאישור המאמן.');
  if (approval.usedAt) {
    if (approval.trainingType !== input.trainingType) fail('האישור כבר מומש לסוג אימון אחר.');
    return payload;
  }
  if (input.confirmUnscheduled !== true) fail('יש לאשר במפורש ניכוי אימון באישור המאמן.');
  const choice = coachExceptionChoices(payload, actorId, input.code, now).find(c => c.trainingType === input.trainingType && c.targetId === input.targetId);
  if (!choice) fail('סוג האימון אינו מאושר או שאין יתרת אימונים.');
  if (choice.trainingType === 'DUO' && !choice.partners.some(p => p.id === input.partnerId)) fail('יש לבחור בן או בת זוג מאושרים לאימון.');
  const user = traineeUser(payload, actorId), coach = staffUser(payload, approval.coachId);
  const next = debitException(payload, user, coach, choice.trainingType, approval.token, clubDate(new Date(now)), approval.reason, now, choice.trainingType === 'DUO' ? input.partnerId : null, false);
  return { ...next, coachArrivalApprovals: next.coachArrivalApprovals.map(a => a.token === approval.token ? { ...a, usedAt: new Date(now).toISOString(), trainingType: choice.trainingType } : a) };
}

export function recordHistoricalCoachArrival(payload, coachId, input, now = Date.now()) {
  const coach = staffUser(payload, coachId), user = traineeUser(payload, input.traineeId);
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.eventId || '')) fail('מזהה תיעוד אינו תקין.');
  const existing = (payload.attendanceLogs || []).find(l => l.id === `arrival-exception-${input.eventId}`);
  if (existing) {
    if (existing.traineeId !== user.id || existing.trainingType !== input.trainingType || existing.approvedBy !== coachId || existing.date !== input.date || existing.approvalReason !== String(input.reason || '').trim()) fail('מזהה התיעוד כבר שויך לאימון אחר.');
    return payload;
  }
  if (input.confirmDebit !== true) fail('יש לאשר ניכוי ידני עבור אימון שכבר בוצע.');
  const dateValue = Date.parse(`${input.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(dateValue) || clubDate(new Date(dateValue)) !== input.date || input.date > clubDate(new Date(now))) fail('יש לבחור תאריך תקין של אימון שכבר בוצע.');
  const reason = String(input.reason || '').trim();
  if (!reason || reason.length > 500) fail('יש להזין סיבה לתיעוד בדיעבד (עד 500 תווים).');
  // Historical credit reconciliation is staff-only, not a current entry authorization.
  return debitException(payload, user, coach, input.trainingType, input.eventId, input.date, reason, now, null, true);
}

export const coachArrivalResult = (payload, actorId, input, alreadyRecorded = false) => clubArrivalResult(payload, actorId, { type: 'SESSION', targetId: input.targetId || input.eventId }, alreadyRecorded);

export function preserveCoachArrivalAudit(current, incoming) {
  const protectedLogs = (current.attendanceLogs || []).filter(log => log.coachException);
  const messages = incoming.messages || [];
  const messageIds = new Set(messages.map(m => m.id));
  return { ...incoming, coachArrivalApprovals: current.coachArrivalApprovals || [],
    attendanceLogs: [...(incoming.attendanceLogs || []).filter(log => !log.coachException && !String(log.id).startsWith('arrival-exception-')), ...protectedLogs],
    messages: [...messages, ...(current.messages || []).filter(m => m.systemGenerated && (String(m.id).startsWith('club-scan-') || String(m.id).startsWith('coach-exception-receipt-')) && !messageIds.has(m.id))] };
}
