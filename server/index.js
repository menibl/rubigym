const CARDCOM_BASE_URL = 'https://secure.cardcom.solutions/api/v11';

const membershipPrices = {
  GROUP_MONTHLY: 350,
  GROUP_ANNUAL: 290,
  OPEN_MONTHLY: 300,
  OPEN_ANNUAL: 250,
  OPEN_PUNCH_CARD: 400,
  PERSONAL_TRAINING: 450,
  NUTRITION_PLAN: 200,
  WORKOUT_PLAN: 150
};

const membershipLabels = {
  GROUP_MONTHLY: 'מנוי קבוצתי חודשי',
  GROUP_ANNUAL: 'מנוי קבוצתי שנתי',
  OPEN_MONTHLY: 'Open Gym חודשי',
  OPEN_ANNUAL: 'Open Gym שנתי',
  OPEN_PUNCH_CARD: 'כרטיסיית Open Gym',
  PERSONAL_TRAINING: 'אימון אישי',
  NUTRITION_PLAN: 'תוכנית תזונה',
  WORKOUT_PLAN: 'תוכנית אימון אישית'
};

const punchCardVariants = {
  PUNCH_5: { amount: 250, label: 'כרטיסיית 5 אימונים' },
  PUNCH_10: { amount: 450, label: 'כרטיסיית 10 אימונים' },
  PUNCH_20: { amount: 800, label: 'כרטיסיית 20 אימונים' }
};

const resolvePurchase = body => {
  if (body.membershipType === 'OPEN_PUNCH_CARD' && body.purchaseVariant) {
    const variant = punchCardVariants[body.purchaseVariant];
    if (!variant) throw new Error('INVALID_VARIANT');
    return variant;
  }
  const amount = membershipPrices[body.membershipType];
  if (!amount) throw new Error('INVALID_MEMBERSHIP');
  return { amount, label: membershipLabels[body.membershipType] };
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
  const { amount } = resolvePurchase(body);
  if (!['PRIMARY', 'ADDON', 'REGISTRATION'].includes(body.mode)) throw new Error('INVALID_MODE');
  const payload = encodePayload({
    o: crypto.randomUUID(),
    m: body.membershipType,
    d: body.mode,
    v: body.purchaseVariant || undefined,
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
  if (resolvePurchase({ membershipType: order.m, purchaseVariant: order.v }).amount !== Number(order.a)) throw new Error('INVALID_AMOUNT');
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
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary': 'Origin'
  } : {};
};

const requirePaymentEnv = env => {
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

const handleCreatePayment = async (request, env) => {
  requirePaymentEnv(env);
  const body = await request.json();
  let purchase;
  try { purchase = resolvePurchase(body); }
  catch { return json({ message: 'מסלול התשלום אינו מוכר.' }, 400, corsHeaders(request, env)); }
  const { amount } = purchase;
  const returnValue = await createSignedOrder(body, env);
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
  const { result, order } = await getLowProfileResult(lowProfileId, env);
  return json({
    success: true,
    lowProfileId,
    membershipType: order.m,
    mode: order.d,
    purchaseVariant: order.v,
    amount: order.a,
    transactionId: String(result.TranzactionId || result.TranzactionInfo?.TranzactionId || ''),
    last4Digits: result.TranzactionInfo?.Last4CardDigitsString || result.TranzactionInfo?.Last4CardDigits
  }, 200, corsHeaders(request, env));
};

const handleWebhook = async (request, env) => {
  requirePaymentEnv(env);
  const contentType = request.headers.get('Content-Type') || '';
  let payload;
  if (contentType.includes('application/json')) payload = await request.json();
  else payload = Object.fromEntries(await request.formData());
  const lowProfileId = payload.LowProfileId || payload.lowProfileId || payload.LowProfileCode || payload.lowprofilecode;
  if (!lowProfileId) return new Response('missing LowProfileId', { status: 400 });
  await getLowProfileResult(String(lowProfileId), env);
  return new Response('OK', { status: 200 });
};

const handleApi = async (request, env, url) => {
  const headers = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    if (request.method === 'POST' && url.pathname === '/api/payments/cardcom/create') return await handleCreatePayment(request, env);
    if (request.method === 'POST' && url.pathname === '/api/payments/cardcom/verify') return await handleVerifyPayment(request, env);
    if (request.method === 'POST' && url.pathname === '/api/payments/cardcom/webhook') return await handleWebhook(request, env);
    return json({ message: 'Not found' }, 404, headers);
  } catch (error) {
    console.error('Cardcom payment error', error instanceof Error ? error.message : error);
    return json({ message: 'שירות התשלום אינו זמין כרגע. נסו שוב מאוחר יותר.' }, 502, headers);
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    const assetRequest = url.pathname === '/'
      ? new Request(new URL('/index.html', url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) return response;
    if (url.pathname.includes('.')) return response;
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }
};
