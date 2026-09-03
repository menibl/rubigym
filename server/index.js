import { handleWorkoutAi, resolveOpenAiApiKey } from './workout-ai.js';
import { dispatchStateChangePushes, isPushConfigured, sendPushToUsers, validatePushSubscription } from './push.js';
import { appendUserChangeMessages } from './user-change-messages.js';
import { recoverUsersFromAccounts } from './user-recovery.js';
import {
  createPhoneVerificationToken,
  normalizeIsraeliMobile,
  requestPhoneCode,
  verifyPhoneCode,
  verifyPhoneVerificationToken
} from './sms-auth.js';
import {
  accountFromUser,
  clearSessionCookie,
  createAuthenticatedSession,
  getAuthenticatedSession,
  isValidEmail,
  mergePayloadForUser,
  normalizeLogin,
  normalizePhone,
  payloadForUser,
  hashPassword,
  stripCredentials,
  verifyPassword
} from './auth.js';

const RIVHIT_TEST_BASE_URL = 'https://testicredit.rivhit.co.il/API/PaymentPageRequest.svc';
const RIVHIT_PRODUCTION_BASE_URL = 'https://icredit.rivhit.co.il/API/PaymentPageRequest.svc';
const liveDisplayState = { program: null, demoProgram: null, demoSchedule: [], commands: new Map(), statuses: new Map() };
const DEMO_DISPLAY_CLUB_ID = 'baly-wellness-pages-demo';
const DEMO_DISPLAY_SCHEDULE_ID = `${DEMO_DISPLAY_CLUB_ID}:schedule`;

const israelClockParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));

const timelineMinute = (date, time) => {
  const dateMatch = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(time || '').match(/^(\d{2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return Number.NaN;
  return Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(timeMatch[1]), Number(timeMatch[2])) / 60000;
};

const israelTimelineMinute = (now = new Date()) => {
  const parts = israelClockParts(now);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) / 60000;
};

const parseWorkoutDisplaySeconds = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return /min|דק/i.test(String(value || '')) ? parsed * 60 : parsed;
};

const personalPlanDisplayProgram = (plan, session) => {
  const mode = plan.mode || 'LINEAR';
  const subgroupCount = mode === 'ROTATING_GROUPS' ? Math.max(2, Number(plan.subgroupCount) || 3) : 1;
  const exercises = (plan.exercises || []).map((exercise, index) => ({
    ...exercise,
    stationNumber: mode === 'ROTATING_GROUPS' ? Number(exercise.stationNumber) || (index % subgroupCount) + 1 : undefined,
    workSeconds: plan.effortMetric === 'REPS' ? 0 : parseWorkoutDisplaySeconds(exercise.workDuration, plan.defaultWorkSeconds ?? 45),
    restSeconds: plan.effortMetric === 'REPS' ? 0 : parseWorkoutDisplaySeconds(exercise.restDuration, plan.defaultRestSeconds ?? 60),
    rounds: Math.max(1, Number(plan.roundsPerStation) || Number(exercise.sets) || 1)
  }));
  return {
    id: `personal-display-${plan.id}`,
    sessionId: session.id,
    sessionDate: session.date,
    sessionTime: session.time,
    groupName: session.demoTraineeName || session.title || 'אימון אישי',
    title: plan.title || 'תוכנית אימון אישית',
    description: `תוכנית אישית בהנחיית ${plan.coachName || session.coachName || ''}`,
    coachId: plan.coachId || session.coachId,
    coachName: plan.coachName || session.coachName,
    mode,
    exercises: mode === 'LINEAR' ? exercises : [],
    stations: mode === 'ROTATING_GROUPS' ? Array.from({ length: subgroupCount }, (_, index) => ({
      id: `personal-station-${plan.id}-${index + 1}`,
      name: `תחנה ${index + 1}`,
      exercises: exercises.filter(exercise => exercise.stationNumber === index + 1)
    })) : [],
    participantGroupNames: mode === 'ROTATING_GROUPS' ? Array.from({ length: subgroupCount }, (_, index) => `קבוצה ${index + 1}`) : undefined,
    roundsPerStation: Math.max(1, Number(plan.roundsPerStation) || 3),
    transitionSeconds: Math.max(0, Number(plan.transitionSeconds) || 0),
    defaultWorkSeconds: plan.effortMetric === 'REPS' ? 0 : plan.defaultWorkSeconds ?? 45,
    defaultRestSeconds: plan.effortMetric === 'REPS' ? 0 : plan.defaultRestSeconds ?? 60,
    effortMetric: plan.effortMetric || 'TIME',
    defaultRepetitions: plan.defaultRepetitions,
    preparationSeconds: 10,
    status: 'PUBLISHED',
    createdAt: plan.lastUpdated || session.date,
    updatedAt: plan.lastUpdated || session.date,
    publishedAt: plan.lastUpdated || session.date
  };
};

export const findScheduledLiveDisplayCandidate = (payload, now = new Date()) => {
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  const groupPrograms = Array.isArray(payload?.groupWorkoutPrograms) ? payload.groupWorkoutPrograms : [];
  const personalPrograms = (Array.isArray(payload?.workoutPlans) ? payload.workoutPlans : [])
    .filter(plan => plan?.id && plan.sessionId && Array.isArray(plan.exercises) && plan.exercises.length > 0)
    .map(plan => {
      const session = sessions.find(item => item.id === plan.sessionId && item.isPersonalTraining);
      return session ? personalPlanDisplayProgram(plan, session) : undefined;
    })
    .filter(Boolean);
  const programs = [...groupPrograms, ...personalPrograms];
  const currentMinute = israelTimelineMinute(now);
  return programs
    .filter(program => program?.id && program.status === 'PUBLISHED' && (program.sessionId || (program.sessionDate && program.sessionTime)))
    .map(program => {
      const session = sessions.find(item => item.id === program.sessionId);
      const startMinute = timelineMinute(program.sessionDate || session?.date, program.sessionTime || session?.time);
      return { program, startMinute, durationMinutes: Math.max(1, Number(session?.durationMinutes) || 180) };
    })
    .filter(item => Number.isFinite(item.startMinute) && currentMinute >= item.startMinute && currentMinute < item.startMinute + item.durationMinutes)
    .sort((a, b) => b.startMinute - a.startMinute || String(b.program.updatedAt || '').localeCompare(String(a.program.updatedAt || '')))[0];
};

export const findScheduledLiveDisplayProgram = (payload, now = new Date()) =>
  findScheduledLiveDisplayCandidate(payload, now)?.program;

export const shouldPromoteScheduledDisplay = (candidate, activeProgram) => {
  if (!candidate?.program) return false;
  if (!activeProgram) return true;
  const sameProgram = candidate.program.id === activeProgram.id
    && candidate.program.updatedAt === activeProgram.updatedAt;
  if (sameProgram) return false;
  if (activeProgram.displayActivation === 'MANUAL'
    && Number(activeProgram.displayActivatedMinute) >= candidate.startMinute) return false;
  return true;
};

const displayRevision = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const manuallyActivatedProgram = program => ({
  ...program,
  displayRevision: displayRevision('manual'),
  displayActivation: 'MANUAL',
  displayActivatedMinute: israelTimelineMinute()
});
const scheduledActivatedProgram = candidate => ({
  ...candidate.program,
  displayRevision: `schedule-${candidate.program.id}-${candidate.program.updatedAt || ''}-${candidate.startMinute}`,
  displayActivation: 'SCHEDULED',
  displayActivatedMinute: candidate.startMinute
});

const scheduledProgramForClub = async (env, clubId) => {
  if (!env.STATE_STORE?.getClubState) return undefined;
  const state = await env.STATE_STORE.getClubState(clubId);
  return findScheduledLiveDisplayCandidate(state?.payload);
};

const scheduledDemoProgram = async env => {
  const envelope = env.STATE_STORE
    ? await env.STATE_STORE.getActiveProgram(DEMO_DISPLAY_SCHEDULE_ID)
    : { programs: liveDisplayState.demoSchedule };
  return findScheduledLiveDisplayCandidate({ groupWorkoutPrograms: envelope?.programs || [] });
};

const membershipPrices = {
  OPEN_GYM: 280,
  NUTRITION_COACHING: 350,
  WORKOUT_COACHING: 350,
  OPEN_GYM_WITH_PLAN: 450,
  CORE_GROUPS: 500,
  DUO_TRAINING: 350,
  YOUTH_TWICE_WEEKLY: 500,
  YOUTH_ONCE_WEEKLY: 300,
  DEDICATED_GROUP_HALF_YEAR: 3600,
  FAMILY_MEMBERSHIP: 900,
  GROUP_MONTHLY: 600,
  GROUP_ANNUAL: 500,
  OPEN_MONTHLY: 300,
  OPEN_ANNUAL: 250,
  OPEN_PUNCH_CARD: 400,
  PERSONAL_TRAINING: 200,
  NUTRITION_PLAN: 200,
  WORKOUT_PLAN: 150,
  WEIGHT_LOSS_HALF_YEAR: 1800,
  POSTPARTUM_HALF_YEAR: 1800
};

const membershipLabels = {
  OPEN_GYM: 'Open Gym',
  NUTRITION_COACHING: 'תוכנית תזונה + ליווי אישי',
  WORKOUT_COACHING: 'תוכנית אימון + ליווי אישי',
  OPEN_GYM_WITH_PLAN: 'Open Gym + תוכנית',
  CORE_GROUPS: 'קבוצות (ליבה)',
  DUO_TRAINING: 'אימון זוגי',
  YOUTH_TWICE_WEEKLY: 'נוער – פעמיים בשבוע',
  YOUTH_ONCE_WEEKLY: 'נוער – פעם בשבוע',
  DEDICATED_GROUP_HALF_YEAR: 'קבוצה ייעודית – חצי שנתי',
  FAMILY_MEMBERSHIP: 'מנוי משפחתי',
  GROUP_MONTHLY: 'קבוצתי חודשי – ₪600 לחודש',
  GROUP_ANNUAL: 'קבוצתי שנתי – הוראת קבע חודשית ל־12 חודשים',
  OPEN_MONTHLY: 'Open Gym חודשי',
  OPEN_ANNUAL: 'Open Gym שנתי',
  OPEN_PUNCH_CARD: 'כרטיסיית Open Gym',
  PERSONAL_TRAINING: 'אימון אישי',
  NUTRITION_PLAN: 'תוכנית תזונה',
  WORKOUT_PLAN: 'תוכנית אימון אישית',
  WEIGHT_LOSS_HALF_YEAR: 'קבוצת הרזיה – חצי שנתי',
  POSTPARTUM_HALF_YEAR: 'נשים אחרי לידה – חצי שנתי'
};

const trainingCardVariants = {
  PERSONAL_1: { amount: 200, label: 'אימון אישי בודד', membershipType: 'PERSONAL_TRAINING' },
  PERSONAL_4: { amount: 800, label: 'כרטיסיית 4 אימונים אישיים', membershipType: 'PERSONAL_TRAINING' },
  PERSONAL_8: { amount: 1600, label: 'כרטיסיית 8 אימונים אישיים', membershipType: 'PERSONAL_TRAINING' },
  PERSONAL_12: { amount: 2400, label: 'כרטיסיית 12 אימונים אישיים', membershipType: 'PERSONAL_TRAINING' },
  DUO_1: { amount: 350, label: 'אימון זוגי בודד', membershipType: 'DUO_TRAINING' },
  DUO_4: { amount: 1400, label: 'כרטיסיית 4 אימונים זוגיים', membershipType: 'DUO_TRAINING' },
  DUO_8: { amount: 2800, label: 'כרטיסיית 8 אימונים זוגיים', membershipType: 'DUO_TRAINING' },
  DUO_12: { amount: 4200, label: 'כרטיסיית 12 אימונים זוגיים', membershipType: 'DUO_TRAINING' }
};

const familyPrices = { 2: 900, 3: 1350, 4: 1800, 5: 2250, 6: 2700 };
const familyMonthlyPricePerMember = 550;
const discountCodes = {
  RUBI10: { percent: 10 },
  FAMILY15: { percent: 15 },
  VIP50: { amount: 50 }
};

const applyDiscount = (amount, discountCode) => {
  const discount = discountCode ? discountCodes[String(discountCode).toUpperCase()] : undefined;
  if (discountCode && !discount) throw new Error('INVALID_DISCOUNT');
  return discount?.percent ? Math.round(amount * (1 - discount.percent / 100)) : Math.max(0, amount - (discount?.amount || 0));
};

const normalizeFamilyPlans = plans => {
  if (!Array.isArray(plans)) return [];
  return plans.map((plan, index) => {
    const membershipType = String(plan?.membershipType || '');
    if (!membershipPrices[membershipType] || membershipType === 'FAMILY_MEMBERSHIP') throw new Error('INVALID_FAMILY_MEMBER_PLAN');
    const isTraining = membershipType === 'PERSONAL_TRAINING' || membershipType === 'DUO_TRAINING';
    const trainingSessionsCount = isTraining ? Math.max(1, Math.min(50, Math.round(Number(plan?.trainingSessionsCount || 1)))) : undefined;
    return {
      memberId: plan?.memberId ? String(plan.memberId).slice(0, 100) : undefined,
      memberName: String(plan?.memberName || `בן משפחה ${index + 1}`).slice(0, 100),
      membershipType,
      trainingSessionsCount
    };
  });
};

const resolvePurchase = body => {
  if (body.familyMembersCount || body.membershipType === 'FAMILY_MEMBERSHIP') {
    const count = Number(body.familyMembersCount);
    const mode = body.familyBillingMode || 'ANNUAL_BY_SIZE';
    if (!Number.isInteger(count) || count < 2 || count > 6 || body.membershipType !== 'FAMILY_MEMBERSHIP') throw new Error('INVALID_FAMILY_PLAN');
    let baseAmount;
    let label;
    let familyMemberPlans;
    if (mode === 'ANNUAL_BY_SIZE') {
      baseAmount = familyPrices[count];
      label = `משפחתי שנתי – ${count} מתאמנים`;
    } else if (mode === 'MONTHLY_PER_MEMBER') {
      baseAmount = count * familyMonthlyPricePerMember;
      label = `משפחתי חודשי – ${count} × ₪${familyMonthlyPricePerMember}`;
    } else if (mode === 'CUSTOM_COMBINED') {
      familyMemberPlans = normalizeFamilyPlans(body.familyMemberPlans);
      if (familyMemberPlans.length !== count) throw new Error('INVALID_FAMILY_MEMBER_COUNT');
      baseAmount = familyMemberPlans.reduce((sum, plan) => sum + membershipPrices[plan.membershipType] * (plan.trainingSessionsCount || 1), 0);
      label = `משפחתי מותאם – חיוב מאוחד עבור ${count} מתאמנים`;
    } else throw new Error('INVALID_FAMILY_BILLING_MODE');
    return { amount: applyDiscount(baseAmount, body.discountCode), label, familyBillingMode: mode, familyMemberPlans };
  }
  if (body.purchaseVariant) {
    const variant = trainingCardVariants[body.purchaseVariant];
    if (!variant || variant.membershipType !== body.membershipType) throw new Error('INVALID_VARIANT');
    return { ...variant, amount: applyDiscount(variant.amount, body.discountCode) };
  }
  const amount = membershipPrices[body.membershipType];
  if (!amount) throw new Error('INVALID_MEMBERSHIP');
  return { amount: applyDiscount(amount, body.discountCode), label: membershipLabels[body.membershipType] };
};

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
});

const smsFailureResponse = (error, headers) => {
  if (error?.message === 'OTP_RATE_LIMITED') return json({ message: 'נשלחו יותר מדי קודים. יש להמתין לפני ניסיון נוסף.' }, 429, headers);
  if (error?.message === 'SMS_NOT_CONFIGURED') return json({ message: 'שירות ה-SMS עדיין לא הוגדר בשרת.' }, 503, headers);
  if (error?.message === 'SMS_PROVIDER_UNAVAILABLE') return json({ message: 'שליחת ה-SMS נכשלה. נסו שוב מאוחר יותר.' }, 502, headers);
  return null;
};

const maskedPhone = phone => `***-***-${String(phone || '').slice(-4)}`;

const landingMediaSlots = new Set(['hero', 'coaching']);
const landingImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxLandingImageBytes = 800_000;

const configuredHosts = value => String(value || '')
  .split(',')
  .map(host => host.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0])
  .filter(Boolean);

const publicLandingPayload = async (request, env, url, clubId) => {
  const requestHost = String(request.headers.get('x-forwarded-host') || url.hostname).split(':')[0].toLowerCase();
  const landingHosts = configuredHosts(env.LANDING_DOMAIN);
  const isDevelopmentPreview = env.NODE_ENV !== 'production' && url.searchParams.get('surface') === 'landing';
  const surface = landingHosts.includes(requestHost) || isDevelopmentPreview ? 'landing' : 'app';
  const state = env.STATE_STORE ? await env.STATE_STORE.getClubState(clubId) : null;
  const plans = Array.isArray(state?.payload?.settings?.membershipPlans)
    ? state.payload.settings.membershipPlans.filter(plan => plan?.active).map(plan => ({
      id: plan.id,
      label: plan.label,
      description: plan.description,
      price: plan.price,
      category: plan.category,
      active: true,
      priceUnit: plan.priceUnit,
      supportsTrainingCard: Boolean(plan.supportsTrainingCard)
    }))
    : [];
  const media = env.STATE_STORE?.listLandingMedia
    ? await env.STATE_STORE.listLandingMedia(clubId)
    : [];
  const mediaBySlot = Object.fromEntries(media.map(item => [item.slot, item]));
  const imageUrl = slot => mediaBySlot[slot]
    ? `/api/public/landing-media/${slot}?v=${new Date(mediaBySlot[slot].updated_at).getTime()}`
    : null;
  return {
    surface,
    appUrl: env.PUBLIC_APP_URL || `${url.origin}/`,
    landingUrl: env.PUBLIC_LANDING_URL || (surface === 'landing' ? `${url.origin}/` : ''),
    plans,
    images: {
      hero: imageUrl('hero'),
      coaching: imageUrl('coaching')
    }
  };
};

const base64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodePayload = value => base64Url(new TextEncoder().encode(JSON.stringify(value)));
const decodePayload = value => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0))));

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
};

const createSignedOrder = async (body, env) => {
  const purchase = resolvePurchase(body);
  const { amount } = purchase;
  if (!['PRIMARY', 'ADDON', 'REGISTRATION'].includes(body.mode)) throw new Error('INVALID_MODE');
  const payload = encodePayload({
    o: crypto.randomUUID(),
    u: body.userId ? String(body.userId).slice(0, 100) : undefined,
    m: body.membershipType,
    d: body.mode,
    v: body.purchaseVariant || undefined,
    f: body.familyMembersCount || undefined,
    fm: purchase.familyBillingMode || undefined,
    fp: purchase.familyMemberPlans || undefined,
    c: body.discountCode ? String(body.discountCode).toUpperCase() : undefined,
    a: amount,
    t: Date.now()
  });
  return `${payload}.${await sign(payload, env.PAYMENT_SIGNING_SECRET)}`;
};

const verifySignedOrder = async (value, env) => {
  if (!value || typeof value !== 'string') throw new Error('INVALID_ORDER');
  const [payload, signature] = value.split('.');
  if (!payload || !signature || await sign(payload, env.PAYMENT_SIGNING_SECRET) !== signature) throw new Error('INVALID_SIGNATURE');
  const order = decodePayload(payload);
  if (Date.now() - Number(order.t) > 24 * 60 * 60 * 1000) throw new Error('ORDER_EXPIRED');
  if (resolvePurchase({ membershipType: order.m, purchaseVariant: order.v, familyMembersCount: order.f, familyBillingMode: order.fm, familyMemberPlans: order.fp, discountCode: order.c }).amount !== Number(order.a)) throw new Error('INVALID_AMOUNT');
  if (!['PRIMARY', 'ADDON', 'REGISTRATION'].includes(order.d)) throw new Error('INVALID_MODE');
  return order;
};

const rivhitEnvironment = env => String(env.RIVHIT_ENVIRONMENT || 'test').trim().toLowerCase();
const rivhitBaseUrl = env => rivhitEnvironment(env) === 'production' ? RIVHIT_PRODUCTION_BASE_URL : RIVHIT_TEST_BASE_URL;

const rivhitPost = async (path, body, env) => {
  const providerFetch = typeof env.RIVHIT_FETCH === 'function' ? env.RIVHIT_FETCH : fetch;
  const response = await providerFetch(`${rivhitBaseUrl(env)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  let result = null;
  try { result = responseText ? JSON.parse(responseText) : null; }
  catch { /* A non-JSON upstream response is handled below without logging its body. */ }
  if (!result) {
    console.error('RIVHIT request unavailable', {
      operation: path.replace(/^\//, ''),
      environment: rivhitEnvironment(env),
      httpStatus: response.status,
      contentType: response.headers.get('content-type') || 'unknown',
      responseBytes: responseText.length
    });
    throw new Error('RIVHIT_UNAVAILABLE');
  }
  if (!response.ok) {
    console.warn('RIVHIT request rejected', {
      operation: path.replace(/^\//, ''),
      environment: rivhitEnvironment(env),
      httpStatus: response.status,
      providerStatus: rivhitValue(result, 'Status', 'status')
    });
  }
  return result;
};

const createPaymentReference = async (order, privateSaleToken, publicSaleToken, env) => {
  const payload = encodePayload({ o: order, p: privateSaleToken, q: publicSaleToken, t: Date.now() });
  return `${payload}.${await sign(payload, env.PAYMENT_SIGNING_SECRET)}`;
};

const verifyPaymentReference = async (value, env) => {
  if (!value || typeof value !== 'string') throw new Error('INVALID_PAYMENT_REFERENCE');
  const [payload, signature] = value.split('.');
  if (!payload || !signature || await sign(payload, env.PAYMENT_SIGNING_SECRET) !== signature) throw new Error('INVALID_PAYMENT_REFERENCE');
  const reference = decodePayload(payload);
  if (!reference.o || !reference.p || Date.now() - Number(reference.t) > 24 * 60 * 60 * 1000) throw new Error('PAYMENT_REFERENCE_EXPIRED');
  return reference;
};

const corsHeaders = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.PAYMENT_ALLOWED_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  } : {};
};

const requirePaymentEnv = env => {
  if (!['test', 'production'].includes(rivhitEnvironment(env))) throw new Error('INVALID_RIVHIT_ENVIRONMENT');
  if (!env.RIVHIT_GROUP_PRIVATE_TOKEN || !env.PAYMENT_SIGNING_SECRET || !env.PUBLIC_APP_URL) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }
};

const rivhitValue = (object, ...keys) => {
  for (const key of keys) if (object?.[key] !== undefined && object?.[key] !== null && object?.[key] !== '') return object[key];
  return undefined;
};

const getRivhitSale = async (privateSaleToken, env) => {
  const detailsResult = await rivhitPost('/SaleDetails', { SalePrivateToken: privateSaleToken }, env);
  const sale = Array.isArray(detailsResult.data) ? detailsResult.data[0] : (detailsResult.Data?.[0] || detailsResult.data || detailsResult);
  const saleId = rivhitValue(sale, 'SaleId', 'saleId');
  const amount = Number(rivhitValue(sale, 'Amount', 'TotalAmount', 'amount', 'totalAmount'));
  if (Number(detailsResult.Status) !== 0 || !sale || !saleId || !Number.isFinite(amount)) throw new Error('RIVHIT_PAYMENT_FAILED');
  return { sale, saleId: String(saleId), amount };
};

const verifyRivhitSale = async (saleId, amount, env) => {
  const result = await rivhitPost('/Verify', {
    GroupPrivateToken: env.RIVHIT_GROUP_PRIVATE_TOKEN,
    SaleId: saleId,
    TotalAmount: amount
  }, env);
  if (String(result.Status || '').toUpperCase() !== 'VERIFIED') throw new Error('RIVHIT_PAYMENT_NOT_VERIFIED');
};

const verifiedRivhitPayment = async (paymentReference, env) => {
  const reference = await verifyPaymentReference(paymentReference, env);
  const order = await verifySignedOrder(reference.o, env);
  const { sale, saleId, amount } = await getRivhitSale(reference.p, env);
  if (amount !== Number(order.a)) throw new Error('AMOUNT_MISMATCH');
  await verifyRivhitSale(saleId, Number(order.a), env);
  const cardNumber = String(rivhitValue(sale, 'CardNum', 'CardNumber', 'cardNum', 'cardNumber') || '');
  return {
    order,
    payment: {
      paymentReference,
      saleId,
      transactionId: String(rivhitValue(sale, 'TransactionId', 'transactionId', 'SaleId', 'saleId') || saleId),
      last4Digits: (cardNumber.match(/(\d{4})\D*$/) || [])[1]
    }
  };
};

const recurringFieldsFor = (body, env) => {
  if (String(env.RIVHIT_ENABLE_RECURRING).toLowerCase() !== 'true') return {};
  const isAnnual = body.membershipType === 'GROUP_ANNUAL'
    || (body.membershipType === 'FAMILY_MEMBERSHIP' && body.familyBillingMode === 'ANNUAL_BY_SIZE');
  return isAnnual ? {
    CreateRecurringSale: true,
    RecurringSaleCycle: 3,
    RecurringSaleStep: 1,
    RecurringSaleCount: 12,
    RecurringSaleAutoCharge: true
  } : {};
};

const splitCustomerName = value => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: (parts.shift() || 'לקוח').slice(0, 20), lastName: (parts.join(' ') || 'BALY').slice(0, 30) };
};

const paymentReturnUrl = (request, env) => {
  const stagingUrl = env.PAYMENT_STAGING_APP_URL ? new URL(env.PAYMENT_STAGING_APP_URL) : null;
  return stagingUrl && request.headers.get('Origin') === stagingUrl.origin ? stagingUrl.toString() : env.PUBLIC_APP_URL;
};

const getOrderFromWebhook = async (payload, env) => {
  const rawOrder = rivhitValue(payload, 'Custom1', 'custom1');
  if (!rawOrder) throw new Error('RIVHIT_WEBHOOK_ORDER_MISSING');
  return verifySignedOrder(String(rawOrder), env);
};

const verifyWebhookSale = async (payload, order, env) => {
  const saleId = String(rivhitValue(payload, 'SaleId', 'saleId') || '');
  const amount = Number(rivhitValue(payload, 'TotalAmount', 'Amount', 'totalAmount', 'amount'));
  if (!saleId || !Number.isFinite(amount) || amount !== Number(order.a)) throw new Error('INVALID_RIVHIT_WEBHOOK');
  await verifyRivhitSale(saleId, Number(order.a), env);
  const cardNumber = String(rivhitValue(payload, 'CardNum', 'CardNumber', 'cardNum', 'cardNumber') || '');
  return {
    paymentReference: saleId,
    saleId,
    transactionId: String(rivhitValue(payload, 'TransactionId', 'transactionId') || saleId),
    last4Digits: (cardNumber.match(/(\d{4})\D*$/) || [])[1]
  };
};

const isoDate = date => date.toISOString().slice(0, 10);
const membershipTermFor = type => {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  const months = type === 'GROUP_ANNUAL' ? 12 : type === 'DEDICATED_GROUP_HALF_YEAR' ? 6 : 1;
  const originalDay = expiresAt.getUTCDate();
  expiresAt.setUTCDate(1);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth() + 1, 0)).getUTCDate();
  expiresAt.setUTCDate(Math.min(originalDay, lastDay));
  const endDate = isoDate(expiresAt);
  return {
    membershipStartedAt: isoDate(startedAt),
    membershipExpiry: endDate,
    membershipCommitmentEndsAt: type === 'GROUP_ANNUAL' ? endDate : undefined,
    recurringBillingMonths: type === 'GROUP_ANNUAL' ? 12 : undefined,
    monthlyBillingDay: type === 'GROUP_ANNUAL' ? startedAt.getUTCDate() : undefined
  };
};

const applyVerifiedPurchaseToUsers = (users, userId, order, amount) => {
  const workoutTypes = ['WORKOUT_COACHING', 'WORKOUT_PLAN', 'OPEN_GYM_WITH_PLAN'];
  const nutritionTypes = ['NUTRITION_COACHING', 'NUTRITION_PLAN'];
  return (users || []).map(candidate => {
    const customPlan = order.m === 'FAMILY_MEMBERSHIP' && order.fm === 'CUSTOM_COMBINED'
      ? order.fp?.find(plan => plan.memberId === candidate.id)
        || (candidate.id === userId ? order.fp?.[0] : undefined)
      : undefined;
    if (candidate.id !== userId && !customPlan) return candidate;

    if (customPlan) {
      const type = customPlan.membershipType;
      return {
        ...candidate,
        membershipType: type,
        membershipStatus: 'ACTIVE',
        ...membershipTermFor(type),
        familyBillingMode: 'CUSTOM_COMBINED',
        familyCombinedAmount: amount,
        familyTrackName: 'משפחתי מותאם – תשלום מאוחד',
        personalTrainingRemaining: type === 'PERSONAL_TRAINING' ? customPlan.trainingSessionsCount : candidate.personalTrainingRemaining,
        duoTrainingRemaining: type === 'DUO_TRAINING' ? customPlan.trainingSessionsCount : candidate.duoTrainingRemaining,
        nutritionPlanPaid: nutritionTypes.includes(type) ? true : candidate.nutritionPlanPaid,
        requestedWorkoutPlan: workoutTypes.includes(type) ? true : candidate.requestedWorkoutPlan
      };
    }

    if (order.d === 'PRIMARY') {
      const termType = order.m === 'FAMILY_MEMBERSHIP' && order.fm === 'ANNUAL_BY_SIZE' ? 'GROUP_ANNUAL' : order.m;
      return {
        ...candidate,
        membershipType: order.m,
        membershipStatus: 'ACTIVE',
        ...membershipTermFor(termType),
        isMembershipFrozen: false,
        membershipFreezeStartedAt: undefined,
        membershipFreezeUsedAt: undefined,
        membershipFrozenUntil: undefined,
        isCancelledEarly: false,
        cancellationRequestedAt: undefined,
        cancellationEffectiveDate: undefined,
        offlinePaymentApproved: false,
        familyMembersCount: order.f || candidate.familyMembersCount,
        familyBillingMode: order.fm || candidate.familyBillingMode,
        familyMemberPlans: order.fp || candidate.familyMemberPlans,
        familyCombinedAmount: order.m === 'FAMILY_MEMBERSHIP' ? amount : candidate.familyCombinedAmount,
        familyTrackName: order.m === 'FAMILY_MEMBERSHIP'
          ? order.fm === 'MONTHLY_PER_MEMBER' ? `משפחתי חודשי (${order.f} מתאמנים)` : `משפחתי שנתי (${order.f} מתאמנים)`
          : candidate.familyTrackName
      };
    }

    const secondaryMemberships = candidate.secondaryMemberships || [];
    const variantCount = order.v ? Number(String(order.v).split('_')[1]) : 0;
    return {
      ...candidate,
      secondaryMemberships: secondaryMemberships.includes(order.m) ? secondaryMemberships : [...secondaryMemberships, order.m],
      nutritionPlanPaid: nutritionTypes.includes(order.m) ? true : candidate.nutritionPlanPaid,
      requestedWorkoutPlan: workoutTypes.includes(order.m) ? true : candidate.requestedWorkoutPlan,
      personalTrainingCardSize: String(order.v || '').startsWith('PERSONAL_') ? variantCount : candidate.personalTrainingCardSize,
      personalTrainingRemaining: String(order.v || '').startsWith('PERSONAL_') ? (candidate.personalTrainingRemaining || 0) + variantCount : candidate.personalTrainingRemaining,
      duoTrainingCardSize: String(order.v || '').startsWith('DUO_') ? variantCount : candidate.duoTrainingCardSize,
      duoTrainingRemaining: String(order.v || '').startsWith('DUO_') ? (candidate.duoTrainingRemaining || 0) + variantCount : candidate.duoTrainingRemaining
    };
  });
};

const persistVerifiedPurchase = async (env, order, payment, fallbackUserId) => {
  if (!env.STATE_STORE || order.d === 'REGISTRATION') return;
  const userId = order.u || fallbackUserId;
  if (!userId) return;
  const paymentId = `payment-rivhit-${payment.transactionId || payment.saleId || payment.paymentReference}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await env.STATE_STORE.getClubState(env.CLUB_ID || 'baly-wellness');
    if (!state) throw new Error('CLUB_STATE_MISSING');
    const user = (state.payload.users || []).find(candidate => candidate.id === userId);
    if (!user) throw new Error('PAYMENT_USER_NOT_FOUND');
    if ((state.payload.payments || []).some(existing => existing.id === paymentId)) return;

    const updatedUsers = applyVerifiedPurchaseToUsers(state.payload.users, userId, order, Number(order.a));
    const payload = appendUserChangeMessages(state.payload, {
      ...state.payload,
      users: updatedUsers,
      nutritionPlans: ['NUTRITION_COACHING', 'NUTRITION_PLAN'].includes(order.m)
        ? (state.payload.nutritionPlans || []).map(plan => plan.traineeId === userId ? {
            ...plan,
            isPaid: true,
            price: Number(order.a),
            paymentStatus: 'PAID'
          } : plan)
        : state.payload.nutritionPlans,
      payments: [{
        id: paymentId,
        traineeId: userId,
        traineeName: user.name,
        amount: Number(order.a),
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
        status: 'PAID',
        membershipTypePurchased: order.m,
        paymentMethod: `RIVHIT iCredit${payment.last4Digits ? ` •••• ${payment.last4Digits}` : ''}`,
        isMock: rivhitEnvironment(env) !== 'production'
      }, ...(state.payload.payments || [])]
    });
    const saved = await env.STATE_STORE.putClubState(env.CLUB_ID || 'baly-wellness', payload, state.revision);
    if (!saved.conflict) {
      try {
        await dispatchStateChangePushes(env.STATE_STORE, env, env.CLUB_ID || 'baly-wellness', state.payload, payload);
      } catch (error) {
        console.warn('Unable to dispatch payment push notification', error?.message || error);
      }
      return;
    }
  }
  throw new Error('PAYMENT_STATE_CONFLICT');
};

const handleCreatePayment = async (request, env) => {
  requirePaymentEnv(env);
  const body = await request.json();
  if (body.mode !== 'REGISTRATION') {
    const identity = await getAuthenticatedSession(request, env.STATE_STORE);
    if (!identity || identity.user_id !== body.userId) {
      return json({ message: 'לא ניתן ליצור תשלום עבור משתמש אחר.' }, 403, corsHeaders(request, env));
    }
  }
  let purchase;
  try { purchase = resolvePurchase(body); }
  catch { return json({ message: 'מסלול התשלום אינו מוכר.' }, 400, corsHeaders(request, env)); }
  const { amount } = purchase;
  const signedOrder = await createSignedOrder(body, env);
  const appUrl = new URL(paymentReturnUrl(request, env));
  appUrl.searchParams.set('rivhit', 'success');
  const failedUrl = new URL(paymentReturnUrl(request, env));
  failedUrl.searchParams.set('rivhit', 'failed');
  const webhookUrl = new URL('/api/payments/rivhit/webhook', request.url).toString();
  const customer = splitCustomerName(body.userName);
  const createResult = await rivhitPost('/GetUrl', {
    GroupPrivateToken: env.RIVHIT_GROUP_PRIVATE_TOKEN,
    Items: [{ UnitPrice: amount, Quantity: 1, Description: purchase.label }],
    CustomerFirstName: customer.firstName,
    CustomerLastName: customer.lastName,
    EmailAddress: body.email ? String(body.email).slice(0, 50) : undefined,
    PhoneNumber: body.phone ? String(body.phone).slice(0, 15) : undefined,
    RedirectURL: appUrl.toString(),
    FailRedirectURL: failedUrl.toString(),
    IPNURL: webhookUrl,
    IPNFailureURL: webhookUrl,
    IPNMethod: 1,
    Currency: 1,
    SaleType: 1,
    NumberOfPayments: 1,
    DocumentLanguage: 'he',
    Custom1: signedOrder,
    UniqueNum: crypto.randomUUID().replace(/-/g, '').slice(0, 20),
    Use3DS: String(env.RIVHIT_USE_3DS).toLowerCase() === 'true',
    ...recurringFieldsFor(body, env)
  }, env);
  const status = Number(rivhitValue(createResult, 'Status', 'status'));
  const url = rivhitValue(createResult, 'URL', 'Url', 'url');
  const privateSaleToken = rivhitValue(createResult, 'PrivateSaleToken', 'privateSaleToken');
  const publicSaleToken = rivhitValue(createResult, 'PublicSaleToken', 'publicSaleToken');
  let paymentUrlIsTrusted = false;
  try { paymentUrlIsTrusted = new URL(String(url)).origin === new URL(rivhitBaseUrl(env)).origin; } catch { /* invalid provider URL */ }
  if (status !== 0 || !url || !privateSaleToken || !paymentUrlIsTrusted) {
    return json({ message: rivhitValue(createResult, 'ErrorMessage', 'DebugMessage', 'Message', 'message') || 'שירות התשלום לא הצליח ליצור דף תשלום. יש לבדוק את הגדרת דף התשלום.' }, 502, corsHeaders(request, env));
  }
  const paymentReference = await createPaymentReference(signedOrder, String(privateSaleToken), String(publicSaleToken || ''), env);
  return json({ url: String(url), paymentReference }, 200, corsHeaders(request, env));
};

const handleVerifyPayment = async (request, env) => {
  requirePaymentEnv(env);
  const { paymentReference } = await request.json();
  if (!paymentReference) return json({ message: 'חסר מזהה עסקה.' }, 400, corsHeaders(request, env));
  const { order, payment: providerPayment } = await verifiedRivhitPayment(paymentReference, env);
  const identity = order.d === 'REGISTRATION' ? null : await getAuthenticatedSession(request, env.STATE_STORE);
  if (order.d !== 'REGISTRATION' && (!identity || (order.u && identity.user_id !== order.u))) {
    return json({ message: 'לא ניתן לשייך את התשלום למשתמש המחובר.' }, 403, corsHeaders(request, env));
  }
  const payment = {
    success: true,
    userId: order.u || identity?.user_id,
    membershipType: order.m,
    mode: order.d,
    purchaseVariant: order.v,
    familyMembersCount: order.f,
    familyBillingMode: order.fm,
    familyMemberPlans: order.fp,
    amount: order.a,
    ...providerPayment
  };
  await persistVerifiedPurchase(env, order, payment, identity?.user_id);
  return json(payment, 200, corsHeaders(request, env));
};

const handleWebhook = async (request, env) => {
  requirePaymentEnv(env);
  const contentType = request.headers.get('Content-Type') || '';
  let payload;
  if (request.method === 'GET') payload = Object.fromEntries(new URL(request.url).searchParams);
  else if (contentType.includes('application/json')) payload = await request.json();
  else payload = Object.fromEntries(await request.formData());
  if (Array.isArray(payload)) payload = payload[0] || {};
  const order = await getOrderFromWebhook(payload, env);
  const payment = await verifyWebhookSale(payload, order, env);
  await persistVerifiedPurchase(env, order, payment);
  return new Response('OK', { status: 200 });
};

const handleApi = async (request, env, url) => {
  const origin = request.headers.get('Origin') || '';
  const isPagesDisplayRequest = url.pathname.startsWith('/api/demo/live-display') && origin === 'https://menibl.github.io';
  const headers = isPagesDisplayRequest ? {
    ...corsHeaders(request, env),
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  } : corsHeaders(request, env);
  const liveDisplayHeaders = {
    ...headers,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const clubId = env.CLUB_ID || 'baly-wellness';
    const getIdentity = async () => {
      const session = await getAuthenticatedSession(request, env.STATE_STORE);
      if (!session) return null;
      const account = await env.STATE_STORE.getAccount(session.club_id, session.user_id);
      return account ? { session, account } : null;
    };

    const notifyStateChange = async (stateBefore, stateAfter, targetClubId = clubId) => {
      try {
        await dispatchStateChangePushes(env.STATE_STORE, env, targetClubId, stateBefore, stateAfter);
      } catch (error) {
        console.warn('Unable to dispatch state change push notifications', error?.message || error);
      }
    };

    const loadClubState = async targetClubId => {
      let state = await env.STATE_STORE.getClubState(targetClubId);
      if (!state || !env.STATE_STORE.listAccounts) return state;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const accounts = await env.STATE_STORE.listAccounts(targetClubId);
        if (env.STATE_STORE.updateAccountIdentity) {
          const usersById = new Map((state.payload?.users || []).map(user => [user.id, user]));
          await Promise.all(accounts
            .filter(account => !account.profile && usersById.has(account.user_id))
            .map(account => env.STATE_STORE.updateAccountIdentity(targetClubId, stripCredentials(usersById.get(account.user_id)))));
        }
        const recovered = recoverUsersFromAccounts(state.payload, accounts);
        if (!recovered.recoveredUsers.length) return state;
        const nextPayload = appendUserChangeMessages(state.payload, recovered.payload);
        const result = await env.STATE_STORE.putClubState(targetClubId, nextPayload, state.revision);
        if (!result.conflict) {
          console.warn('Recovered trainee profiles from durable login accounts', { count: recovered.recoveredUsers.length });
          await notifyStateChange(state.payload, nextPayload, targetClubId);
          return { payload: nextPayload, revision: result.revision };
        }
        state = await env.STATE_STORE.getClubState(targetClubId);
        if (!state) return state;
      }
      return state;
    };

    if (url.pathname === '/api/public/landing' && request.method === 'GET') {
      return json(await publicLandingPayload(request, env, url, clubId), 200, {
        ...headers,
        'Cache-Control': 'no-store'
      });
    }

    const publicLandingMediaMatch = url.pathname.match(/^\/api\/public\/landing-media\/(hero|coaching)$/);
    if (publicLandingMediaMatch && request.method === 'GET') {
      const media = env.STATE_STORE?.getLandingMedia
        ? await env.STATE_STORE.getLandingMedia(clubId, publicLandingMediaMatch[1])
        : null;
      if (!media) return new Response(null, { status: 404, headers });
      return new Response(media.body, {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': String(media.body.length),
          'Content-Type': media.mime_type
        }
      });
    }

    const landingMediaMatch = url.pathname.match(/^\/api\/landing-media\/(hero|coaching)$/);
    if (landingMediaMatch && request.method === 'PUT') {
      const identity = await getIdentity();
      if (!identity || identity.account.role !== 'MANAGER') return json({ message: 'Unauthorized' }, 401, headers);
      if (!env.STATE_STORE?.putLandingMedia) return json({ message: 'Landing media storage is not configured' }, 503, headers);
      const slot = landingMediaMatch[1];
      const mimeType = String(request.headers.get('Content-Type') || '').split(';')[0].toLowerCase();
      if (!landingMediaSlots.has(slot) || !landingImageMimeTypes.has(mimeType)) {
        return json({ message: 'יש לבחור תמונת JPG, PNG או WebP.' }, 415, headers);
      }
      const body = new Uint8Array(await request.arrayBuffer());
      if (!body.length || body.length > maxLandingImageBytes) {
        return json({ message: 'התמונה גדולה מדי. הגודל המרבי לאחר כיווץ הוא 800KB.' }, 413, headers);
      }
      const saved = await env.STATE_STORE.putLandingMedia(identity.session.club_id, slot, mimeType, body);
      return json({ ok: true, slot, size: Number(saved.size), updatedAt: saved.updated_at }, 200, headers);
    }

    if (landingMediaMatch && request.method === 'DELETE') {
      const identity = await getIdentity();
      if (!identity || identity.account.role !== 'MANAGER') return json({ message: 'Unauthorized' }, 401, headers);
      if (!env.STATE_STORE?.deleteLandingMedia) return json({ message: 'Landing media storage is not configured' }, 503, headers);
      await env.STATE_STORE.deleteLandingMedia(identity.session.club_id, landingMediaMatch[1]);
      return json({ ok: true, slot: landingMediaMatch[1] }, 200, headers);
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      const account = await env.STATE_STORE.getAccountByLogin(clubId, body.login);
      if (!account || !await verifyPassword(body.password, account.password_hash)) {
        return json({ message: 'שם המשתמש או הסיסמה אינם נכונים.' }, 401, headers);
      }
      const state = await loadClubState(clubId);
      const user = state?.payload?.users?.find(candidate => candidate.id === account.user_id);
      if (!user) return json({ message: 'חשבון המשתמש אינו קיים בנתוני המועדון.' }, 409, headers);
      const phone = normalizeIsraeliMobile(account.phone_normalized || user.phone);
      if (!phone) return json({ message: 'לא מוגדר מספר טלפון נייד לחשבון. יש לפנות למועדון לעדכון הפרטים.' }, 409, headers);
      if (!body.otp) {
        try {
          const result = await requestPhoneCode({ store: env.STATE_STORE, env, clubId, phone, purpose: 'LOGIN' });
          return json({
            requiresSmsVerification: true,
            maskedPhone: maskedPhone(phone),
            expiresInSeconds: result.expiresInSeconds,
            testMode: result.testMode
          }, 202, headers);
        } catch (error) {
          const response = smsFailureResponse(error, headers);
          if (response) return response;
          throw error;
        }
      }
      const verified = await verifyPhoneCode({ store: env.STATE_STORE, env, clubId, phone, purpose: 'LOGIN', code: body.otp });
      if (!verified) return json({ message: 'קוד האימות אינו תקין או שפג תוקפו.' }, 401, headers);
      const auth = await createAuthenticatedSession(env.STATE_STORE, clubId, user.id);
      return json({ user: stripCredentials(user) }, 200, { ...headers, 'Set-Cookie': auth.cookie });
    }

    if (url.pathname === '/api/auth/request-phone-code' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      const phone = normalizeIsraeliMobile(body.phone);
      const purpose = String(body.purpose || '').toUpperCase();
      if (!phone || !['LOGIN', 'REGISTER'].includes(purpose)) {
        return json({ message: 'יש להזין מספר טלפון נייד תקין.' }, 400, headers);
      }
      const existingAccount = await env.STATE_STORE.getAccountByLogin(clubId, phone);
      if (purpose === 'LOGIN' && !existingAccount) {
        return json({ ok: false, registrationRequired: true }, 200, headers);
      }
      if (purpose === 'REGISTER' && existingAccount) {
        return json({ message: 'מספר הטלפון כבר רשום. ניתן לעבור למסך הכניסה.' }, 409, headers);
      }
      try {
        const result = await requestPhoneCode({ store: env.STATE_STORE, env, clubId, phone, purpose });
        return json({ ok: true, expiresInSeconds: result.expiresInSeconds, testMode: result.testMode }, 202, headers);
      } catch (error) {
        const response = smsFailureResponse(error, headers);
        if (response) return response;
        throw error;
      }
    }

    if (url.pathname === '/api/auth/verify-registration-phone' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      const verified = await verifyPhoneCode({ store: env.STATE_STORE, env, clubId, phone: body.phone, purpose: 'REGISTER', code: body.otp });
      if (!verified) return json({ message: 'קוד האימות אינו תקין או שפג תוקפו.' }, 401, headers);
      const phoneVerificationToken = await createPhoneVerificationToken({ env, clubId, phone: body.phone });
      return json({ verified: true, phoneVerificationToken }, 200, headers);
    }

    if (url.pathname === '/api/auth/phone-login' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      const phone = normalizeIsraeliMobile(body.phone);
      const account = phone ? await env.STATE_STORE.getAccountByLogin(clubId, phone) : null;
      const verified = account && await verifyPhoneCode({ store: env.STATE_STORE, env, clubId, phone, purpose: 'LOGIN', code: body.otp });
      if (!verified) return json({ message: 'מספר הטלפון או קוד האימות אינם תקינים.' }, 401, headers);
      const state = await loadClubState(clubId);
      const user = state?.payload?.users?.find(candidate => candidate.id === account.user_id);
      if (!user) return json({ message: 'חשבון המשתמש אינו קיים בנתוני המועדון.' }, 409, headers);
      const auth = await createAuthenticatedSession(env.STATE_STORE, clubId, user.id);
      return json({ user: stripCredentials(user) }, 200, { ...headers, 'Set-Cookie': auth.cookie });
    }

    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const identity = await getIdentity();
      if (!identity) return json({ authenticated: false }, 401, headers);
      const state = await loadClubState(identity.session.club_id);
      const user = state?.payload?.users?.find(candidate => candidate.id === identity.account.user_id);
      return user ? json({ authenticated: true, user: stripCredentials(user) }, 200, headers) : json({ authenticated: false }, 401, headers);
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const identity = await getIdentity();
      if (identity) await env.STATE_STORE.deleteSession(identity.session.tokenHash);
      return json({ ok: true }, 200, { ...headers, 'Set-Cookie': clearSessionCookie });
    }

    if (url.pathname === '/api/auth/password' && request.method === 'PUT') {
      const identity = await getIdentity();
      if (!identity) return json({ message: 'Unauthorized' }, 401, headers);
      const body = await request.json();
      if (typeof body.password !== 'string' || body.password.length < 8) return json({ message: 'הסיסמה חייבת להכיל לפחות 8 תווים.' }, 400, headers);
      await env.STATE_STORE.updatePassword(identity.session.club_id, identity.account.user_id, await hashPassword(body.password));
      return json({ ok: true }, 200, headers);
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      const user = body.user;
      const familyUsers = Array.isArray(body.familyUsers) ? body.familyUsers : [];
      if (!user?.id || typeof user?.password !== 'string' || user.password.length < 8 || !user?.email || !isValidEmail(user.email) || user.role !== 'TRAINEE') {
        return json({ message: 'פרטי ההרשמה או כתובת האימייל אינם תקינים.' }, 400, headers);
      }
      if (!await verifyPhoneVerificationToken({ env, clubId, phone: user.phone, token: body.phoneVerificationToken })) {
        return json({ message: 'אימות מספר הטלפון חסר או שפג תוקפו. יש לשלוח קוד חדש.' }, 401, headers);
      }
      if (familyUsers.length > 5 || (familyUsers.length && (!user.isFamilyPayer || !user.familyId))) {
        return json({ message: 'פרטי החשבון המשפחתי אינם תקינים.' }, 400, headers);
      }
      const registrations = [user, ...familyUsers];
      for (const candidate of registrations) {
        const isFamilyMember = candidate.id !== user.id;
        if (!candidate?.id || !candidate?.name || !candidate?.username || !candidate?.email || !isValidEmail(candidate.email)
          || typeof candidate.password !== 'string' || candidate.password.length < 8 || candidate.role !== 'TRAINEE'
          || (isFamilyMember && (candidate.familyPayerId !== user.id || candidate.familyId !== user.familyId))) {
          return json({ message: 'חסרים פרטי כניסה תקינים לאחד מבני המשפחה.' }, 400, headers);
        }
      }
      const identityValues = registrations.flatMap(candidate => [candidate.username, candidate.email, candidate.phone].filter(Boolean));
      const normalizedIdentities = registrations.flatMap(candidate => [
        normalizeLogin(candidate.username),
        normalizeLogin(candidate.email),
        normalizePhone(candidate.phone)
      ].filter(Boolean));
      if (new Set(normalizedIdentities).size !== normalizedIdentities.length) {
        return json({ message: 'שם משתמש, אימייל או טלפון מופיעים יותר מפעם אחת בהרשמה.' }, 409, headers);
      }
      for (const identityValue of identityValues) {
        if (await env.STATE_STORE.getAccountByLogin(clubId, identityValue)) {
          return json({ message: 'שם המשתמש, האימייל או הטלפון כבר רשומים.' }, 409, headers);
        }
      }
      const state = await loadClubState(clubId);
      if (!state) return json({ message: 'נתוני המועדון אינם מאותחלים.' }, 503, headers);
      const safeUser = stripCredentials(user);
      const safeFamilyUsers = familyUsers.map(stripCredentials);
      const nextPayload = appendUserChangeMessages(state.payload, {
        ...state.payload,
        users: [safeUser, ...safeFamilyUsers, ...(state.payload.users || [])],
        payments: body.payment ? [body.payment, ...(state.payload.payments || [])] : (state.payload.payments || [])
      });
      const saved = await env.STATE_STORE.putClubState(clubId, nextPayload, state.revision);
      if (saved.conflict) return json(saved, 409, headers);
      for (const candidate of registrations) {
        await env.STATE_STORE.upsertAccount(await accountFromUser(clubId, stripCredentials(candidate), candidate.password));
      }
      await notifyStateChange(state.payload, nextPayload);
      const auth = await createAuthenticatedSession(env.STATE_STORE, clubId, safeUser.id);
      return json({ user: safeUser, familyUsers: safeFamilyUsers, revision: saved.revision }, 201, { ...headers, 'Set-Cookie': auth.cookie });
    }

    if (url.pathname === '/api/auth/family-members' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const identity = await getIdentity();
      if (!identity || identity.account.role !== 'TRAINEE') return json({ message: 'Unauthorized' }, 401, headers);
      const body = await request.json();
      const candidate = body.user;
      const state = await loadClubState(identity.session.club_id);
      const payer = state?.payload?.users?.find(userItem => userItem.id === identity.account.user_id);
      const familyMembers = state?.payload?.users?.filter(userItem => userItem.familyId && userItem.familyId === payer?.familyId) || [];
      if (!payer?.isFamilyPayer || !payer.familyId || familyMembers.length >= Number(payer.familyMembersCount || 0)) {
        return json({ message: 'אין מקום נוסף בחשבון המשפחתי או שהמשתמש אינו המשלם הראשי.' }, 403, headers);
      }
      if (!candidate?.id || !candidate?.name || !candidate?.username || !candidate?.email || !isValidEmail(candidate.email)
        || typeof candidate.password !== 'string' || candidate.password.length < 8 || candidate.role !== 'TRAINEE'
        || candidate.familyPayerId !== payer.id || candidate.familyId !== payer.familyId) {
        return json({ message: 'פרטי בן המשפחה או פרטי הכניסה אינם תקינים.' }, 400, headers);
      }
      for (const identityValue of [candidate.username, candidate.email, candidate.phone].filter(Boolean)) {
        if (await env.STATE_STORE.getAccountByLogin(identity.session.club_id, identityValue)) {
          return json({ message: 'שם המשתמש, האימייל או הטלפון כבר רשומים.' }, 409, headers);
        }
      }
      const safeUser = stripCredentials(candidate);
      const nextPayload = appendUserChangeMessages(state.payload, {
        ...state.payload,
        users: [safeUser, ...(state.payload.users || [])]
      });
      const saved = await env.STATE_STORE.putClubState(identity.session.club_id, nextPayload, state.revision);
      if (saved.conflict) return json(saved, 409, headers);
      await env.STATE_STORE.upsertAccount(await accountFromUser(identity.session.club_id, safeUser, candidate.password));
      await notifyStateChange(state.payload, nextPayload, identity.session.club_id);
      return json({ user: safeUser, revision: saved.revision }, 201, headers);
    }
    if (url.pathname === '/api/push/public-key' && request.method === 'GET') {
      return isPushConfigured(env)
        ? json({publicKey: env.VAPID_PUBLIC_KEY}, 200, headers)
        : json({message: 'Push notifications are not configured'}, 503, headers);
    }
    if (url.pathname === '/api/push/subscriptions' && request.method === 'POST') {
      if (!env.STATE_STORE || !isPushConfigured(env)) return json({message: 'Push notifications are not configured'}, 503, headers);
      const identity = await getIdentity();
      if (!identity) return json({message: 'Unauthorized'}, 401, headers);
      const subscription = validatePushSubscription(await request.json());
      if (!subscription) return json({message: 'Invalid push subscription'}, 400, headers);
      await env.STATE_STORE.upsertPushSubscription(
        identity.session.club_id,
        identity.account.user_id,
        subscription,
        request.headers.get('User-Agent')?.slice(0, 500)
      );
      return json({ok: true}, 201, headers);
    }
    if (url.pathname === '/api/push/subscriptions' && request.method === 'DELETE') {
      if (!env.STATE_STORE) return json({message: 'Database is not configured'}, 503, headers);
      const identity = await getIdentity();
      if (!identity) return json({message: 'Unauthorized'}, 401, headers);
      const body = await request.json().catch(() => ({}));
      await env.STATE_STORE.deletePushSubscription(identity.session.club_id, identity.account.user_id, body.endpoint);
      return json({ok: true}, 200, headers);
    }
    if (url.pathname === '/api/push/test' && request.method === 'POST') {
      if (!env.STATE_STORE || !isPushConfigured(env)) return json({message: 'Push notifications are not configured'}, 503, headers);
      const identity = await getIdentity();
      if (!identity) return json({message: 'Unauthorized'}, 401, headers);
      const body = await request.json().catch(() => ({}));
      const subscription = validatePushSubscription(body);
      if (!subscription) return json({message: 'Invalid push subscription'}, 400, headers);
      const result = await sendPushToUsers(env.STATE_STORE, env, identity.session.club_id, [identity.account.user_id], {
        title: 'התראות BALY WELLNESS פעילות',
        body: 'המכשיר מחובר בהצלחה לקבלת עדכונים ותזכורות.',
        tag: `push-test-${identity.account.user_id}`,
        url: '/',
      }, subscription.endpoint);
      return json({ok: true, ...result}, 200, headers);
    }
    if (url.pathname === '/api/demo/live-display/schedule' && request.method === 'PUT') {
      const body = await request.json();
      if (!Array.isArray(body?.programs) || body.programs.length > 250) return json({ message: 'Invalid schedule' }, 400, headers);
      const programs = body.programs.filter(program => program?.id && program.status === 'PUBLISHED' && program.sessionDate && program.sessionTime);
      if (env.STATE_STORE) await env.STATE_STORE.setActiveProgram(DEMO_DISPLAY_SCHEDULE_ID, { programs });
      else liveDisplayState.demoSchedule = programs;
      return json({ ok: true, count: programs.length }, 200, headers);
    }
    if (url.pathname === '/api/demo/live-display/active' && request.method === 'GET') {
      const scheduled = await scheduledDemoProgram(env);
      let program = env.STATE_STORE ? await env.STATE_STORE.getActiveProgram(DEMO_DISPLAY_CLUB_ID) : liveDisplayState.demoProgram;
      if (shouldPromoteScheduledDisplay(scheduled, program)) {
        program = scheduledActivatedProgram(scheduled);
        if (env.STATE_STORE) await env.STATE_STORE.setActiveProgram(DEMO_DISPLAY_CLUB_ID, program);
        else liveDisplayState.demoProgram = program;
      }
      return program ? json({ program }, 200, liveDisplayHeaders) : new Response(null, { status: 204, headers: liveDisplayHeaders });
    }
    if (url.pathname === '/api/demo/live-display/active' && request.method === 'PUT') {
      const body = await request.json();
      if (!body?.program?.id) return json({ message: 'Invalid program' }, 400, headers);
      const program = manuallyActivatedProgram(body.program);
      if (env.STATE_STORE) await env.STATE_STORE.setActiveProgram(DEMO_DISPLAY_CLUB_ID, program);
      else liveDisplayState.demoProgram = program;
      return json({ ok: true, programId: program.id, displayRevision: program.displayRevision }, 200, liveDisplayHeaders);
    }
    const demoCommandMatch = url.pathname.match(/^\/api\/demo\/live-display\/([^/]+)\/commands$/);
    if (demoCommandMatch && request.method === 'GET') {
      const programId = `demo:${decodeURIComponent(demoCommandMatch[1])}`;
      return json(env.STATE_STORE ? await env.STATE_STORE.getCommand(programId) : liveDisplayState.commands.get(programId) || null, 200, headers);
    }
    if (demoCommandMatch && request.method === 'POST') {
      const command = await request.json();
      if (!command?.id || !command?.action) return json({ message: 'Invalid command' }, 400, headers);
      const programId = `demo:${decodeURIComponent(demoCommandMatch[1])}`;
      if (env.STATE_STORE) await env.STATE_STORE.setCommand(programId, command); else liveDisplayState.commands.set(programId, command);
      return json({ ok: true }, 200, headers);
    }
    const demoStatusMatch = url.pathname.match(/^\/api\/demo\/live-display\/([^/]+)\/status$/);
    if (demoStatusMatch && request.method === 'GET') {
      const programId = `demo:${decodeURIComponent(demoStatusMatch[1])}`;
      const status = env.STATE_STORE ? await env.STATE_STORE.getStatus(programId) : liveDisplayState.statuses.get(programId);
      return status ? json(status, 200, headers) : new Response(null, { status: 204, headers });
    }
    if (demoStatusMatch && request.method === 'PUT') {
      const status = await request.json();
      const programId = `demo:${decodeURIComponent(demoStatusMatch[1])}`;
      if (env.STATE_STORE) await env.STATE_STORE.setStatus(programId, status); else liveDisplayState.statuses.set(programId, status);
      return json({ ok: true }, 200, headers);
    }
    if (url.pathname === '/api/live-display/active' && request.method === 'GET') {
      const targetClubId = env.CLUB_ID || 'baly-wellness';
      const scheduled = await scheduledProgramForClub(env, targetClubId);
      let program = env.STATE_STORE ? await env.STATE_STORE.getActiveProgram(targetClubId) : liveDisplayState.program;
      if (shouldPromoteScheduledDisplay(scheduled, program)) {
        program = scheduledActivatedProgram(scheduled);
        if (env.STATE_STORE) await env.STATE_STORE.setActiveProgram(targetClubId, program);
        else liveDisplayState.program = program;
      }
      return program ? json({ program }, 200, liveDisplayHeaders) : new Response(null, { status: 204, headers: liveDisplayHeaders });
    }
    if (url.pathname === '/api/live-display/active' && request.method === 'PUT') {
      const identity = await getIdentity();
      if (!identity || !['MANAGER', 'COACH'].includes(identity.account.role)) return json({ message: 'Unauthorized' }, 401, headers);
      const body = await request.json();
      if (!body?.program?.id) return json({ message: 'Invalid program' }, 400, headers);
      const program = manuallyActivatedProgram(body.program);
      if (env.STATE_STORE) await env.STATE_STORE.setActiveProgram(env.CLUB_ID || 'baly-wellness', program);
      else liveDisplayState.program = program;
      return json({ ok: true, programId: program.id, displayRevision: program.displayRevision }, 200, liveDisplayHeaders);
    }
    const commandMatch = url.pathname.match(/^\/api\/live-display\/([^/]+)\/commands$/);
    if (commandMatch && request.method === 'GET') {
      const programId = decodeURIComponent(commandMatch[1]);
      return json(env.STATE_STORE ? await env.STATE_STORE.getCommand(programId) : liveDisplayState.commands.get(programId) || null, 200, headers);
    }
    if (commandMatch && request.method === 'POST') {
      const identity = await getIdentity();
      if (!identity || !['MANAGER', 'COACH'].includes(identity.account.role)) return json({ message: 'Unauthorized' }, 401, headers);
      const command = await request.json();
      if (!command?.id || !command?.action) return json({ message: 'Invalid command' }, 400, headers);
      const programId = decodeURIComponent(commandMatch[1]);
      if (env.STATE_STORE) await env.STATE_STORE.setCommand(programId, command); else liveDisplayState.commands.set(programId, command);
      return json({ ok: true }, 200, headers);
    }
    const statusMatch = url.pathname.match(/^\/api\/live-display\/([^/]+)\/status$/);
    if (statusMatch && request.method === 'GET') {
      const programId = decodeURIComponent(statusMatch[1]);
      const status = env.STATE_STORE ? await env.STATE_STORE.getStatus(programId) : liveDisplayState.statuses.get(programId);
      return status ? json(status, 200, headers) : new Response(null, { status: 204, headers });
    }
    if (statusMatch && request.method === 'PUT') {
      const status = await request.json();
      const programId = decodeURIComponent(statusMatch[1]);
      if (env.STATE_STORE) await env.STATE_STORE.setStatus(programId, status); else liveDisplayState.statuses.set(programId, status);
      return json({ ok: true }, 200, headers);
    }
    if (url.pathname === '/api/state' && request.method === 'GET') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const identity = await getIdentity();
      if (!identity) return json({ message: 'Unauthorized' }, 401, headers);
      const state = await loadClubState(identity.session.club_id);
      return state ? json({ ...state, payload: payloadForUser(state.payload, identity.account.user_id, identity.account.role) }, 200, headers) : new Response(null, { status: 204, headers });
    }
    if (url.pathname === '/api/state' && request.method === 'PUT') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const identity = await getIdentity();
      if (!identity) return json({ message: 'Unauthorized' }, 401, headers);
      const body = await request.json();
      const current = await loadClubState(identity.session.club_id);
      if (!current) return json({ message: 'Club state was not initialized' }, 503, headers);
      if (Number(body.expectedRevision) !== Number(current.revision)) return json({ conflict: true, revision: current.revision }, 409, headers);
      const incomingUsers = Array.isArray(body.payload?.users) ? body.payload.users : [];
      for (const candidate of incomingUsers) {
        if (!candidate?.password || candidate.password.length < 8) continue;
        const mayProvision = identity.account.role === 'MANAGER'
          || (candidate.role === 'TRAINEE' && candidate.familyPayerId === identity.account.user_id);
        if (mayProvision) await env.STATE_STORE.upsertAccount(await accountFromUser(identity.session.club_id, candidate, candidate.password));
      }
      const mergedBeforeAudit = mergePayloadForUser(current.payload, body.payload, identity.account.user_id, identity.account.role);
      const merged = appendUserChangeMessages(
        current.payload,
        mergedBeforeAudit
      );
      const existingMessageIds = new Set((mergedBeforeAudit.messages || []).map(message => message.id));
      const generatedMessages = (merged.messages || []).filter(message => !existingMessageIds.has(message.id));
      const result = await env.STATE_STORE.putClubState(identity.session.club_id, merged, current.revision);
      if (!result.conflict) {
        for (const user of merged.users || []) {
          if (await env.STATE_STORE.getAccount(identity.session.club_id, user.id)) await env.STATE_STORE.updateAccountIdentity(identity.session.club_id, user);
        }
        await notifyStateChange(current.payload, merged, identity.session.club_id);
      }
      return result.conflict ? json(result, 409, headers) : json({ ...result, generatedMessages }, 200, headers);
    }
    if (request.method === 'GET' && url.pathname === '/api/ai/status') {
      return json({
        configured: Boolean(resolveOpenAiApiKey(env)),
        configurationSource: 'OPENAI_API_KEY server environment',
        model: env.OPENAI_WORKOUT_MODEL || 'gpt-5-mini'
      }, 200, headers);
    }
    if (request.method === 'POST' && url.pathname === '/api/ai/workout-plan') {
      const identity = await getIdentity();
      if (!identity || !['MANAGER', 'COACH'].includes(identity.account.role)) return json({ message: 'שירות ה-AI זמין למאמנים ולמנהלים בלבד.' }, 403, headers);
      return await handleWorkoutAi(request, env, headers, json);
    }
    if (request.method === 'POST' && url.pathname === '/api/payments/rivhit/create') return await handleCreatePayment(request, env);
    if (request.method === 'POST' && url.pathname === '/api/payments/rivhit/verify') return await handleVerifyPayment(request, env);
    if (['GET', 'POST'].includes(request.method) && url.pathname === '/api/payments/rivhit/webhook') return await handleWebhook(request, env);
    return json({ message: 'Not found' }, 404, headers);
  } catch (error) {
    console.error('API request error', error instanceof Error ? error.message : error);
    return json({ message: 'שירות השרת אינו זמין כרגע. נסו שוב מאוחר יותר.' }, 502, headers);
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    const userAgent = request.headers.get('User-Agent') || '';
    const isLgTelevision = /(?:Web0S|WebOS|NetCast|SmartTV)/i.test(userAgent) && /LG|Web0S|WebOS|NetCast/i.test(userAgent);
    if (url.pathname === '/tv' || (url.pathname === '/' && isLgTelevision)) {
      const response = await env.ASSETS.fetch(new Request(new URL('/tv.html', url), request));
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      responseHeaders.set('Pragma', 'no-cache');
      responseHeaders.set('Expires', '0');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
    }
    if (url.pathname === '/tv/') return Response.redirect(new URL('/tv', url), 302);
    const assetRequest = url.pathname === '/'
      ? new Request(new URL('/index.html', url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) return response;
    if (url.pathname.includes('.')) return response;
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }
};
