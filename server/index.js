import { handleWorkoutAi, resolveOpenAiApiKey } from './workout-ai.js';
import { dispatchStateChangePushes, isPushConfigured, sendPushToUsers, validatePushSubscription } from './push.js';
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

const CARDCOM_BASE_URL = 'https://secure.cardcom.solutions/api/v11';
const liveDisplayState = { program: null, commands: new Map(), statuses: new Map() };

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

const resolvePurchase = (body, allowDemoOverride = false) => {
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
  if (allowDemoOverride && body.planAmount !== undefined) {
    const amount = Number(body.planAmount);
    const label = String(body.planLabel || membershipLabels[body.membershipType] || 'מסלול BALY').slice(0, 120);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error('INVALID_DEMO_AMOUNT');
    return { amount: applyDiscount(Math.round(amount), body.discountCode), label };
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

const base64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodePayload = value => base64Url(new TextEncoder().encode(JSON.stringify(value)));
const decodePayload = value => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0))));

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
};

const createSignedOrder = async (body, env) => {
  const demoMode = String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true';
  const purchase = resolvePurchase(body, demoMode);
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
    pa: demoMode && body.planAmount !== undefined ? Number(body.planAmount) : undefined,
    pl: demoMode && body.planLabel ? String(body.planLabel).slice(0, 120) : undefined,
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
  const demoMode = String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true';
  if (resolvePurchase({ membershipType: order.m, purchaseVariant: order.v, familyMembersCount: order.f, familyBillingMode: order.fm, familyMemberPlans: order.fp, discountCode: order.c, planAmount: order.pa, planLabel: order.pl }, demoMode).amount !== Number(order.a)) throw new Error('INVALID_AMOUNT');
  if (!['PRIMARY', 'ADDON', 'REGISTRATION'].includes(order.d)) throw new Error('INVALID_MODE');
  return order;
};

const cardcomPost = async (path, body) => {
  const response = await fetch(`${CARDCOM_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error('CARDCOM_UNAVAILABLE');
  return result;
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
  if (String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true') {
    if (!env.PAYMENT_SIGNING_SECRET || !env.PUBLIC_APP_URL) throw new Error('DEMO_PAYMENT_NOT_CONFIGURED');
    return;
  }
  if (!env.CARDCOM_TERMINAL_NUMBER || !env.CARDCOM_API_NAME || !env.PAYMENT_SIGNING_SECRET || !env.PUBLIC_APP_URL) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }
};

const getLowProfileResult = async (lowProfileId, env) => {
  const result = await cardcomPost('/LowProfile/GetLpResult', {
    TerminalNumber: Number(env.CARDCOM_TERMINAL_NUMBER),
    ApiName: env.CARDCOM_API_NAME,
    LowProfileId: lowProfileId
  });
  if (Number(result.ResponseCode) !== 0 || Number(result.TranzactionInfo?.ResponseCode) !== 0) {
    throw new Error(result.Description || result.TranzactionInfo?.Description || 'PAYMENT_FAILED');
  }
  const order = await verifySignedOrder(result.ReturnValue, env);
  if (Number(result.Amount) !== Number(order.a) && Number(result.TranzactionInfo?.Amount) !== Number(order.a)) throw new Error('AMOUNT_MISMATCH');
  return { result, order };
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
  const paymentId = `payment-cardcom-${payment.transactionId || payment.lowProfileId}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await env.STATE_STORE.getClubState(env.CLUB_ID || 'baly-wellness');
    if (!state) throw new Error('CLUB_STATE_MISSING');
    const user = (state.payload.users || []).find(candidate => candidate.id === userId);
    if (!user) throw new Error('PAYMENT_USER_NOT_FOUND');
    if ((state.payload.payments || []).some(existing => existing.id === paymentId)) return;

    const updatedUsers = applyVerifiedPurchaseToUsers(state.payload.users, userId, order, Number(order.a));
    const payload = {
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
        paymentMethod: `Cardcom${payment.last4Digits ? ` •••• ${payment.last4Digits}` : ''}`,
        isMock: String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true'
      }, ...(state.payload.payments || [])]
    };
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
  try { purchase = resolvePurchase(body, String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true'); }
  catch { return json({ message: 'מסלול התשלום אינו מוכר.' }, 400, corsHeaders(request, env)); }
  const { amount } = purchase;
  const returnValue = await createSignedOrder(body, env);
  if (String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true') {
    const checkoutUrl = new URL('/demo-checkout', request.url);
    checkoutUrl.searchParams.set('token', returnValue);
    checkoutUrl.searchParams.set('amount', String(amount));
    checkoutUrl.searchParams.set('label', purchase.label);
    return json({ url: checkoutUrl.toString(), lowProfileId: returnValue }, 200, corsHeaders(request, env));
  }
  const appUrl = new URL(env.PUBLIC_APP_URL);
  appUrl.searchParams.set('cardcom', 'success');
  const failedUrl = new URL(env.PUBLIC_APP_URL);
  failedUrl.searchParams.set('cardcom', 'failed');
  const webhookUrl = new URL('/api/payments/cardcom/webhook', request.url).toString();
  const result = await cardcomPost('/LowProfile/Create', {
    TerminalNumber: Number(env.CARDCOM_TERMINAL_NUMBER),
    ApiName: env.CARDCOM_API_NAME,
    Operation: 'ChargeOnly',
    ReturnValue: returnValue,
    Amount: amount,
    SuccessRedirectUrl: appUrl.toString(),
    FailedRedirectUrl: failedUrl.toString(),
    WebHookUrl: webhookUrl,
    ProductName: purchase.label,
    Language: 'he',
    ISOCoinId: 1,
    UIDefinition: {
      CardOwnerNameValue: String(body.userName || '').slice(0, 80),
      CardOwnerPhoneValue: String(body.phone || '').slice(0, 20),
      CardOwnerEmailValue: String(body.email || '').slice(0, 120),
      IsCardOwnerPhoneRequired: true,
      IsCardOwnerEmailRequired: false
    }
  });
  if (Number(result.ResponseCode) !== 0 || !result.Url || !result.LowProfileId) {
    return json({ message: result.Description || 'Cardcom לא הצליחה ליצור דף תשלום.' }, 502, corsHeaders(request, env));
  }
  return json({ url: result.Url, lowProfileId: result.LowProfileId }, 200, corsHeaders(request, env));
};

const handleVerifyPayment = async (request, env) => {
  requirePaymentEnv(env);
  const { lowProfileId } = await request.json();
  if (!lowProfileId) return json({ message: 'חסר מזהה עסקה.' }, 400, corsHeaders(request, env));
  if (String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true') {
    const order = await verifySignedOrder(lowProfileId, env);
    const identity = order.d === 'REGISTRATION' ? null : await getAuthenticatedSession(request, env.STATE_STORE);
    if (order.d !== 'REGISTRATION' && (!identity || (order.u && identity.user_id !== order.u))) {
      return json({ message: 'לא ניתן לשייך את התשלום למשתמש המחובר.' }, 403, corsHeaders(request, env));
    }
    const payment = {
      success: true,
      lowProfileId,
      userId: order.u || identity?.user_id,
      membershipType: order.m,
      mode: order.d,
      purchaseVariant: order.v,
      familyMembersCount: order.f,
      familyBillingMode: order.fm,
      familyMemberPlans: order.fp,
      amount: order.a,
      transactionId: `demo-${order.o}`,
      last4Digits: '1111'
    };
    await persistVerifiedPurchase(env, order, payment, identity?.user_id);
    return json(payment, 200, corsHeaders(request, env));
  }
  const { result, order } = await getLowProfileResult(lowProfileId, env);
  const identity = order.d === 'REGISTRATION' ? null : await getAuthenticatedSession(request, env.STATE_STORE);
  if (order.d !== 'REGISTRATION' && (!identity || (order.u && identity.user_id !== order.u))) {
    return json({ message: 'לא ניתן לשייך את התשלום למשתמש המחובר.' }, 403, corsHeaders(request, env));
  }
  const payment = {
    success: true,
    lowProfileId,
    userId: order.u || identity?.user_id,
    membershipType: order.m,
    mode: order.d,
    purchaseVariant: order.v,
    familyMembersCount: order.f,
    familyBillingMode: order.fm,
    familyMemberPlans: order.fp,
    amount: order.a,
    transactionId: String(result.TranzactionId || result.TranzactionInfo?.TranzactionId || ''),
    last4Digits: result.TranzactionInfo?.Last4CardDigitsString || result.TranzactionInfo?.Last4CardDigits
  };
  await persistVerifiedPurchase(env, order, payment, identity?.user_id);
  return json(payment, 200, corsHeaders(request, env));
};

const handleWebhook = async (request, env) => {
  requirePaymentEnv(env);
  const contentType = request.headers.get('Content-Type') || '';
  let payload;
  if (contentType.includes('application/json')) payload = await request.json();
  else payload = Object.fromEntries(await request.formData());
  const lowProfileId = payload.LowProfileId || payload.lowProfileId || payload.LowProfileCode || payload.lowprofilecode;
  if (!lowProfileId) return new Response('missing LowProfileId', { status: 400 });
  const { result, order } = await getLowProfileResult(String(lowProfileId), env);
  await persistVerifiedPurchase(env, order, {
    lowProfileId: String(lowProfileId),
    transactionId: String(result.TranzactionId || result.TranzactionInfo?.TranzactionId || ''),
    last4Digits: result.TranzactionInfo?.Last4CardDigitsString || result.TranzactionInfo?.Last4CardDigits
  });
  return new Response('OK', { status: 200 });
};

const handleApi = async (request, env, url) => {
  const headers = corsHeaders(request, env);
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

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      const account = await env.STATE_STORE.getAccountByLogin(clubId, body.login);
      if (!account || !await verifyPassword(body.password, account.password_hash)) {
        return json({ message: 'שם המשתמש או הסיסמה אינם נכונים.' }, 401, headers);
      }
      const state = await env.STATE_STORE.getClubState(clubId);
      const user = state?.payload?.users?.find(candidate => candidate.id === account.user_id);
      if (!user) return json({ message: 'חשבון המשתמש אינו קיים בנתוני המועדון.' }, 409, headers);
      const auth = await createAuthenticatedSession(env.STATE_STORE, clubId, user.id);
      return json({ user: stripCredentials(user) }, 200, { ...headers, 'Set-Cookie': auth.cookie });
    }

    if (url.pathname === '/api/auth/phone-login' && request.method === 'POST') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const body = await request.json();
      if (String(env.SMS_TEST_MODE).toLowerCase() !== 'true' || String(body.otp) !== '1111') {
        return json({ message: 'קוד האימות אינו תקין או ששירות ה-SMS אינו מוגדר.' }, 401, headers);
      }
      const account = await env.STATE_STORE.getAccountByLogin(clubId, normalizePhone(body.phone));
      if (!account) return json({ message: 'לא נמצא משתמש עם מספר הטלפון הזה.' }, 404, headers);
      const state = await env.STATE_STORE.getClubState(clubId);
      const user = state?.payload?.users?.find(candidate => candidate.id === account.user_id);
      if (!user) return json({ message: 'חשבון המשתמש אינו קיים בנתוני המועדון.' }, 409, headers);
      const auth = await createAuthenticatedSession(env.STATE_STORE, clubId, user.id);
      return json({ user: stripCredentials(user) }, 200, { ...headers, 'Set-Cookie': auth.cookie });
    }

    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const identity = await getIdentity();
      if (!identity) return json({ authenticated: false }, 401, headers);
      const state = await env.STATE_STORE.getClubState(identity.session.club_id);
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
      const state = await env.STATE_STORE.getClubState(clubId);
      if (!state) return json({ message: 'נתוני המועדון אינם מאותחלים.' }, 503, headers);
      const safeUser = stripCredentials(user);
      const safeFamilyUsers = familyUsers.map(stripCredentials);
      const nextPayload = {
        ...state.payload,
        users: [safeUser, ...safeFamilyUsers, ...(state.payload.users || [])],
        payments: body.payment ? [body.payment, ...(state.payload.payments || [])] : (state.payload.payments || [])
      };
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
      const state = await env.STATE_STORE.getClubState(identity.session.club_id);
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
      const saved = await env.STATE_STORE.putClubState(identity.session.club_id, {
        ...state.payload,
        users: [safeUser, ...(state.payload.users || [])]
      }, state.revision);
      if (saved.conflict) return json(saved, 409, headers);
      await env.STATE_STORE.upsertAccount(await accountFromUser(identity.session.club_id, safeUser, candidate.password));
      await notifyStateChange(state.payload, {
        ...state.payload,
        users: [safeUser, ...(state.payload.users || [])]
      }, identity.session.club_id);
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
      const result = await sendPushToUsers(env.STATE_STORE, env, identity.session.club_id, [identity.account.user_id], {
        title: 'התראות BALY WELLNESS פעילות',
        body: 'המכשיר מחובר בהצלחה לקבלת עדכונים ותזכורות.',
        tag: `push-test-${identity.account.user_id}`,
        url: '/',
      });
      return json({ok: true, ...result}, 200, headers);
    }
    if (url.pathname === '/api/live-display/active' && request.method === 'GET') {
      const program = env.STATE_STORE ? await env.STATE_STORE.getActiveProgram(env.CLUB_ID || 'baly-wellness') : liveDisplayState.program;
      return program ? json({ program }, 200, headers) : new Response(null, { status: 204, headers });
    }
    if (url.pathname === '/api/live-display/active' && request.method === 'PUT') {
      const identity = await getIdentity();
      if (!identity || !['MANAGER', 'COACH'].includes(identity.account.role)) return json({ message: 'Unauthorized' }, 401, headers);
      const body = await request.json();
      if (!body?.program?.id) return json({ message: 'Invalid program' }, 400, headers);
      if (env.STATE_STORE) await env.STATE_STORE.setActiveProgram(env.CLUB_ID || 'baly-wellness', body.program);
      else liveDisplayState.program = body.program;
      return json({ ok: true, programId: body.program.id }, 200, headers);
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
      const state = await env.STATE_STORE.getClubState(identity.session.club_id);
      return state ? json({ ...state, payload: payloadForUser(state.payload, identity.account.user_id, identity.account.role) }, 200, headers) : new Response(null, { status: 204, headers });
    }
    if (url.pathname === '/api/state' && request.method === 'PUT') {
      if (!env.STATE_STORE) return json({ message: 'Database is not configured' }, 503, headers);
      const identity = await getIdentity();
      if (!identity) return json({ message: 'Unauthorized' }, 401, headers);
      const body = await request.json();
      const current = await env.STATE_STORE.getClubState(identity.session.club_id);
      if (!current) return json({ message: 'Club state was not initialized' }, 503, headers);
      if (Number(body.expectedRevision) !== Number(current.revision)) return json({ conflict: true, revision: current.revision }, 409, headers);
      const incomingUsers = Array.isArray(body.payload?.users) ? body.payload.users : [];
      for (const candidate of incomingUsers) {
        if (!candidate?.password || candidate.password.length < 8) continue;
        const mayProvision = identity.account.role === 'MANAGER'
          || (candidate.role === 'TRAINEE' && candidate.familyPayerId === identity.account.user_id);
        if (mayProvision) await env.STATE_STORE.upsertAccount(await accountFromUser(identity.session.club_id, candidate, candidate.password));
      }
      const merged = mergePayloadForUser(current.payload, body.payload, identity.account.user_id, identity.account.role);
      const result = await env.STATE_STORE.putClubState(identity.session.club_id, merged, current.revision);
      if (!result.conflict) {
        for (const user of merged.users || []) {
          if (await env.STATE_STORE.getAccount(identity.session.club_id, user.id)) await env.STATE_STORE.updateAccountIdentity(identity.session.club_id, user);
        }
        await notifyStateChange(current.payload, merged, identity.session.club_id);
      }
      return result.conflict ? json(result, 409, headers) : json(result, 200, headers);
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
    if (request.method === 'POST' && url.pathname === '/api/payments/cardcom/create') return await handleCreatePayment(request, env);
    if (request.method === 'POST' && url.pathname === '/api/payments/cardcom/verify') return await handleVerifyPayment(request, env);
    if (request.method === 'POST' && url.pathname === '/api/payments/cardcom/webhook') return await handleWebhook(request, env);
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
    if (url.pathname === '/demo-checkout' && String(env.DEMO_PAYMENT_MODE).toLowerCase() === 'true') {
      try {
        const token = url.searchParams.get('token');
        const order = await verifySignedOrder(token, env);
        const amount = Number(url.searchParams.get('amount') || order.a);
        const label = url.searchParams.get('label') || 'רכישה ב־BALY WELLNESS';
        const successUrl = new URL(env.PUBLIC_APP_URL);
        successUrl.searchParams.set('cardcom', 'success');
        const cancelUrl = new URL(env.PUBLIC_APP_URL);
        cancelUrl.searchParams.set('cardcom', 'failed');
        const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>תשלום דמו</title><style>body{margin:0;background:#0b0d12;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.card{width:min(92vw,440px);background:#171a22;border:1px solid #333846;border-radius:24px;padding:28px;box-shadow:0 24px 70px #0008}h1{margin:0 0 8px;color:#d7b765}.demo{background:#442b05;color:#ffd78a;padding:10px;border-radius:12px;font-weight:700}.sum{font-size:42px;font-weight:900;margin:24px 0}a{display:block;width:100%;box-sizing:border-box;text-align:center;border:0;border-radius:14px;padding:15px;margin-top:10px;font-size:16px;font-weight:900;text-decoration:none}.pay{background:#d7b765;color:#111}.cancel{background:#272b35;color:#ddd}</style><main class="card"><h1>BALY WELLNESS</h1><p>${label.replace(/[<>&"']/g, '')}</p><div class="demo">סביבת דמו בלבד — לא מתבצע חיוב אמיתי</div><div class="sum">₪${amount}</div><a class="pay" href="${successUrl.toString()}">אישור תשלום דמו</a><a class="cancel" href="${cancelUrl.toString()}">ביטול</a></main></html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      } catch {
        return new Response('Invalid demo payment', { status: 400 });
      }
    }
    const assetRequest = url.pathname === '/'
      ? new Request(new URL('/index.html', url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) return response;
    if (url.pathname.includes('.')) return response;
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }
};
