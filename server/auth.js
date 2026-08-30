import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const sessionCookie = 'baly_session';
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export const normalizeLogin = value => String(value || '').trim().toLowerCase();
export const normalizePhone = value => String(value || '').replace(/\D/g, '');
export const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeLogin(value));

export const hashPassword = async password => {
  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(derived).toString('hex')}`;
};

export const verifyPassword = async (password, encoded) => {
  const [saltHex, hashHex] = String(encoded || '').split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = Buffer.from(await scrypt(String(password), Buffer.from(saltHex, 'hex'), expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const tokenHash = token => createHash('sha256').update(token).digest('hex');

export const createAuthenticatedSession = async (store, clubId, userId) => {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await store.createSession(tokenHash(token), clubId, userId, expiresAt);
  return {
    token,
    cookie: `${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${Math.floor(sessionLifetimeMs / 1000)}`
  };
};

const parseCookies = header => Object.fromEntries(String(header || '').split(';').map(part => {
  const index = part.indexOf('=');
  return index < 0 ? [part.trim(), ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
}).filter(([key]) => key));

export const getAuthenticatedSession = async (request, store) => {
  if (!store) return null;
  const token = parseCookies(request.headers.get('Cookie'))[sessionCookie];
  if (!token) return null;
  const session = await store.getSession(tokenHash(token));
  return session ? { ...session, tokenHash: tokenHash(token) } : null;
};

export const clearSessionCookie = `${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`;

export const stripCredentials = user => {
  if (!user || typeof user !== 'object') return user;
  const { password: _password, passwordHash: _passwordHash, ...safe } = user;
  return safe;
};

export const accountFromUser = async (clubId, user, password) => ({
  clubId,
  userId: user.id,
  username: normalizeLogin(user.username || user.email || user.phone),
  email: normalizeLogin(user.email),
  phone: normalizePhone(user.phone),
  passwordHash: await hashPassword(password),
  role: user.role
});

export const ensureInitialManager = async (store, env) => {
  if (!store) return;
  const clubId = env.CLUB_ID || 'baly-wellness';
  const existingState = await store.getClubState(clubId);
  const existingRuby = existingState?.payload?.users?.find(user => user.id === 'user-robi' || user.name === 'רובי באלי');
  const existingAccount = existingRuby ? await store.getAccount(clubId, existingRuby.id) : null;
  if (existingAccount) return;

  const initialPassword = env.INITIAL_ADMIN_PASSWORD;
  const legacyPassword = existingRuby?.password;
  const password = initialPassword || legacyPassword;
  if (!password) {
    console.warn('Initial manager account is not configured. Set INITIAL_ADMIN_PASSWORD once before first production login.');
    return;
  }

  const manager = stripCredentials(existingRuby || {
    id: 'user-robi',
    name: 'רובי באלי',
    username: 'רובי באלי',
    email: env.INITIAL_ADMIN_EMAIL || 'robi@rubisgym.co.il',
    phone: env.INITIAL_ADMIN_PHONE || '054-6995885',
    role: 'MANAGER',
    gender: 'MALE',
    age: 38,
    healthDeclarationSigned: true,
    healthDeclarationDate: new Date().toISOString().slice(0, 10),
    priorityScore: 100,
    imageUrl: ''
  });
  const payload = existingState?.payload || {
    settings: {}, users: [], sessions: [], openGymSessions: [], workoutPlans: [], nutritionPlans: [],
    blackPoints: [], announcements: [], payments: [], messages: [], attendanceLogs: [], discountCodes: [],
    traineeProfiles: [], traineeMemoryEntries: [], gymEquipment: [], coachPdfDocuments: [],
    workoutAssistantMessages: [], workoutAssistantDrafts: [], groupWorkoutPrograms: []
  };
  payload.users = [manager, ...(payload.users || []).filter(user => user.id !== manager.id)];
  await store.putClubState(clubId, payload, existingState?.revision);
  await store.upsertAccount(await accountFromUser(clubId, manager, password));
};

const sanitizePayload = payload => ({
  ...(payload || {}),
  users: Array.isArray(payload?.users) ? payload.users.map(stripCredentials) : []
});

const publicStaff = user => ({
  id: user.id,
  name: user.name,
  role: user.role,
  imageUrl: user.imageUrl || '',
  email: '',
  phone: ''
});

export const payloadForUser = (payload, userId, role) => {
  const safe = sanitizePayload(payload);
  if (role === 'MANAGER' || role === 'COACH') return safe;
  const currentUser = safe.users.find(user => user.id === userId);
  const familyId = currentUser?.familyId;
  const registeredSessions = (safe.sessions || []).filter(session =>
    Array.isArray(session.registeredUsers) && session.registeredUsers.includes(userId)
  );
  const registeredSessionIds = new Set(registeredSessions.map(session => session.id));
  const assignedPersonalPlanIds = new Set(registeredSessions.map(session => session.assignedWorkoutPlanId).filter(Boolean));
  const assignedGroupProgramIds = new Set(registeredSessions.map(session => session.assignedGroupWorkoutProgramId).filter(Boolean));
  return {
    ...safe,
    users: safe.users
      .filter(user => user.id === userId || user.role === 'MANAGER' || user.role === 'COACH' || (familyId && user.familyId === familyId))
      .map(user => user.id === userId || (familyId && user.familyId === familyId) ? user : publicStaff(user)),
    workoutPlans: (safe.workoutPlans || []).filter(plan =>
      plan.traineeId === userId || assignedPersonalPlanIds.has(plan.id) || registeredSessionIds.has(plan.sessionId)
    ),
    groupWorkoutPrograms: (safe.groupWorkoutPrograms || []).filter(program =>
      assignedGroupProgramIds.has(program.id) || registeredSessionIds.has(program.sessionId)
    ),
    nutritionPlans: (safe.nutritionPlans || []).filter(plan => plan.traineeId === userId),
    blackPoints: (safe.blackPoints || []).filter(point => point.traineeId === userId),
    payments: (safe.payments || []).filter(payment => payment.traineeId === userId),
    messages: (safe.messages || []).filter(message => message.senderId === userId || message.receiverId === userId),
    attendanceLogs: (safe.attendanceLogs || []).filter(log => log.traineeId === userId),
    discountCodes: [],
    traineeProfiles: (safe.traineeProfiles || []).filter(profile => profile.traineeId === userId),
    traineeMemoryEntries: (safe.traineeMemoryEntries || []).filter(entry => entry.traineeId === userId),
    coachPdfDocuments: [],
    workoutAssistantMessages: [],
    workoutAssistantDrafts: []
  };
};

const selfEditableFields = new Set([
  'name', 'username', 'email', 'phone', 'gender', 'age', 'birthDate', 'imageUrl',
  'healthDeclarationSigned', 'healthDeclarationDate', 'healthDeclarationAnswers',
  'healthDeclarationParentName', 'healthDeclarationParentId',
  'healthDeclarationRequiresMedicalCertificate', 'healthDeclarationMedicalCertificateFileName',
  'healthDeclarationMedicalCertificateDataUrl', 'healthDeclarationMedicalCertificateApproved',
  'healthDeclarationMedicalCertificateApprovedAt', 'healthDeclarationMedicalCertificateApprovedBy',
  'agreementSigned', 'agreementSignedAt', 'pushNotificationsEnabled', 'workoutRemindersEnabled',
  'managerPushNotificationsEnabled'
]);

const familyEditableFields = new Set([
  'membershipType', 'secondaryMemberships', 'personalTrainingCardSize', 'personalTrainingRemaining',
  'duoTrainingCardSize', 'duoTrainingRemaining', 'nutritionPlanPaid', 'requestedWorkoutPlan'
]);

const mergeOwnBooking = (currentItems = [], incomingItems = [], userId) => currentItems.map(current => {
  const incoming = incomingItems.find(item => item.id === current.id);
  if (!incoming) return current;
  const mergeList = key => {
    const currentList = Array.isArray(current[key]) ? current[key] : [];
    const incomingList = Array.isArray(incoming[key]) ? incoming[key] : [];
    const withoutSelf = currentList.filter(id => id !== userId);
    return incomingList.includes(userId) ? [...withoutSelf, userId] : withoutSelf;
  };
  return { ...current, registeredUsers: mergeList('registeredUsers'), waitlistUsers: mergeList('waitlistUsers') };
});

const mergeOwnOpenGymBooking = (currentItems = [], incomingItems = [], userId) => {
  const merged = mergeOwnBooking(currentItems, incomingItems, userId);
  const currentParticipationIds = new Set(currentItems
    .filter(item => (item.registeredUsers || []).includes(userId) || (item.waitlistUsers || []).includes(userId))
    .map(item => item.id));
  const dailyCounts = new Map();

  // Existing bookings that were not cancelled are kept first, so a save never removes
  // a reservation that the server had already accepted.
  for (const item of merged) {
    const participates = (item.registeredUsers || []).includes(userId) || (item.waitlistUsers || []).includes(userId);
    if (!participates || !currentParticipationIds.has(item.id)) continue;
    dailyCounts.set(item.date, (dailyCounts.get(item.date) || 0) + 1);
  }

  return merged.map(item => {
    const participates = (item.registeredUsers || []).includes(userId) || (item.waitlistUsers || []).includes(userId);
    if (!participates || currentParticipationIds.has(item.id)) return item;
    const countForDate = dailyCounts.get(item.date) || 0;
    if (countForDate < 2) {
      dailyCounts.set(item.date, countForDate + 1);
      return item;
    }
    return {
      ...item,
      registeredUsers: (item.registeredUsers || []).filter(id => id !== userId),
      waitlistUsers: (item.waitlistUsers || []).filter(id => id !== userId)
    };
  });
};

export const mergePayloadForUser = (currentPayload, incomingPayload, userId, role) => {
  const current = sanitizePayload(currentPayload);
  const incoming = sanitizePayload(incomingPayload);
  const preserveSystemMessages = requestedMessages => {
    const requested = Array.isArray(requestedMessages) ? requestedMessages : [];
    const requestedIds = new Set(requested.map(message => message.id));
    return [...requested, ...(current.messages || []).filter(message => message.systemGenerated && !requestedIds.has(message.id))];
  };
  if (role === 'MANAGER') return { ...incoming, messages: preserveSystemMessages(incoming.messages) };
  if (role === 'COACH') {
    const allowed = new Set([
      'sessions', 'openGymSessions', 'workoutPlans', 'nutritionPlans', 'blackPoints', 'announcements',
      'messages', 'attendanceLogs', 'traineeProfiles', 'traineeMemoryEntries', 'gymEquipment',
      'coachPdfDocuments', 'workoutAssistantMessages', 'workoutAssistantDrafts', 'groupWorkoutPrograms'
    ]);
    const merged = { ...current };
    for (const key of allowed) if (Array.isArray(incoming[key])) merged[key] = incoming[key];
    merged.messages = preserveSystemMessages(merged.messages);
    const requestedCoach = incoming.users.find(user => user.id === userId);
    if (requestedCoach && Array.isArray(requestedCoach.staffAlertAcknowledgements)) {
      const acknowledgements = [...new Set(requestedCoach.staffAlertAcknowledgements.filter(value => typeof value === 'string'))].slice(-500);
      merged.users = current.users.map(user => user.id === userId ? { ...user, staffAlertAcknowledgements: acknowledgements } : user);
    }
    return merged;
  }

  const actor = current.users.find(user => user.id === userId);
  const incomingUserIds = new Set(incoming.users.map(user => user.id));
  const canManageFamily = Boolean(actor?.isFamilyPayer && actor.familyId);
  const nextUsers = current.users.filter(user => {
    if (!canManageFamily || user.id === userId || user.familyId !== actor.familyId) return true;
    return incomingUserIds.has(user.id);
  }).map(user => {
    if (user.id !== userId) return user;
    const requested = incoming.users.find(candidate => candidate.id === userId) || {};
    const updated = { ...user };
    for (const field of selfEditableFields) if (field in requested) updated[field] = requested[field];
    if (canManageFamily) for (const field of familyEditableFields) if (field in requested) updated[field] = requested[field];
    return updated;
  }).map(user => {
    if (!canManageFamily || user.id === userId || user.familyId !== actor.familyId) return user;
    const requested = incoming.users.find(candidate => candidate.id === user.id) || {};
    const updated = { ...user };
    for (const field of familyEditableFields) if (field in requested) updated[field] = requested[field];
    return updated;
  });
  const newFamilyMembers = incoming.users
    .filter(user => !current.users.some(existing => existing.id === user.id))
    .filter(user => user.role === 'TRAINEE' && user.familyPayerId === userId)
    .map(stripCredentials);
  const ownNewMessages = (incoming.messages || []).filter(message => message.senderId === userId);
  const existingMessageIds = new Set((current.messages || []).map(message => message.id));
  const readIncomingMessageIds = new Set((incoming.messages || [])
    .filter(message => message.receiverId === userId && message.read === true)
    .map(message => message.id));
  const messagesWithReadReceipts = (current.messages || []).map(message =>
    message.receiverId === userId && readIncomingMessageIds.has(message.id)
      ? { ...message, read: true }
      : message);
  const ownNewAttendance = (incoming.attendanceLogs || []).filter(log => log.traineeId === userId);
  const existingAttendanceIds = new Set((current.attendanceLogs || []).map(log => log.id));
  return {
    ...current,
    users: [...nextUsers, ...newFamilyMembers],
    sessions: mergeOwnBooking(current.sessions, incoming.sessions, userId),
    openGymSessions: mergeOwnOpenGymBooking(current.openGymSessions, incoming.openGymSessions, userId),
    messages: [...messagesWithReadReceipts, ...ownNewMessages.filter(message => !existingMessageIds.has(message.id))],
    attendanceLogs: [...(current.attendanceLogs || []), ...ownNewAttendance.filter(log => !existingAttendanceIds.has(log.id))],
    traineeProfiles: [
      ...(current.traineeProfiles || []).filter(profile => profile.traineeId !== userId),
      ...(incoming.traineeProfiles || []).filter(profile => profile.traineeId === userId)
    ]
  };
};
