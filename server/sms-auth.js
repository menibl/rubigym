const PULSEEM_SEND_SMS_URL = 'https://api.pulseem.com/api/v1/SmsApi/SendSms';
const OTP_PURPOSES = new Set(['LOGIN', 'REGISTER']);
const encoder = new TextEncoder();

const base64Url = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const decodeBase64Url = value => Uint8Array.from(
  atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)),
  character => character.charCodeAt(0)
);

const hmac = async (value, secret) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
};

const verifyHmac = async (value, signature, secret) => {
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, decodeBase64Url(signature), encoder.encode(value));
  } catch {
    return false;
  }
};

const randomOtp = () => {
  const range = 1_000_000;
  const limit = 2 ** 32 - ((2 ** 32) % range);
  let value;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  return String(value % range).padStart(6, '0');
};

const positiveInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

export const normalizeIsraeliMobile = value => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00972')) digits = digits.slice(2);
  if (digits.startsWith('972')) digits = `0${digits.slice(3)}`;
  return /^05\d{8}$/.test(digits) ? digits : '';
};

const pulseemRecipient = (phone, env) => String(env.PULSEEM_PHONE_FORMAT || 'local').toLowerCase() === 'international'
  ? `972${phone.slice(1)}`
  : phone;

const providerField = (result, names) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return undefined;
  const entry = Object.entries(result).find(([key]) => names.includes(key.toLowerCase()));
  return entry?.[1];
};

const safeProviderText = value => String(value ?? '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\b\d{7,}\b/g, '[redacted-number]')
  .trim()
  .slice(0, 180);

const pulseemResponseSummary = (response, responseBody, result) => ({
  httpStatus: response.status,
  responseType: Array.isArray(result) ? 'array' : result === null ? (responseBody ? 'text' : 'empty') : typeof result,
  status: safeProviderText(providerField(result, ['status', 'state'])),
  code: safeProviderText(providerField(result, ['code', 'errorcode', 'resultcode'])),
  message: safeProviderText(providerField(result, ['message', 'errormessage', 'description']))
});

const pulseemExplicitlyFailed = (responseBody, result) => {
  const successFlag = providerField(result, ['success', 'issuccess', 'succeeded', 'ok']);
  if (successFlag === false || String(successFlag).toLowerCase() === 'false') return true;

  const errorValue = providerField(result, ['error', 'errors', 'errormessage']);
  if (errorValue && errorValue !== 0 && errorValue !== '0') return true;

  const errorCode = providerField(result, ['errorcode']);
  if (errorCode !== undefined && errorCode !== null && String(errorCode).trim() !== '' && String(errorCode) !== '0') return true;

  const status = safeProviderText(providerField(result, ['status', 'state'])).toLowerCase();
  if (['failed', 'failure', 'error', 'invalid', 'rejected', 'unauthorized', 'forbidden'].includes(status)) return true;

  const textResult = typeof result === 'string' ? result : (!result && responseBody ? responseBody : '');
  const normalizedText = safeProviderText(textResult).toLowerCase();
  if (!normalizedText || /\b(no error|without error)\b/.test(normalizedText)) return false;
  return /\b(error|failed|failure|invalid|unauthorized|forbidden|rejected)\b|שגיאה|נכשל|נדחה/.test(normalizedText);
};

export const sendPulseemSms = async ({ env, phone, text, reference, fetchImpl = fetch }) => {
  const apiKey = String(env.PULSEEM_API_KEY || '').trim();
  const fromNumber = String(env.PULSEEM_FROM_NUMBER || '').trim();
  if (!apiKey || !fromNumber) throw new Error('SMS_NOT_CONFIGURED');

  const timeoutMs = positiveInteger(env.PULSEEM_TIMEOUT_MS, 10_000, 1_000, 30_000);
  const response = await fetchImpl(PULSEEM_SEND_SMS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      APIKey: apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sendId: reference,
      isAsync: false,
      cbkUrl: null,
      smsSendData: {
        fromNumber,
        toNumberList: [pulseemRecipient(phone, env)],
        referenceList: [reference],
        textList: [text],
        sendTime: null,
        isAutomaticUnsubscribeLink: false
      }
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const responseBody = await response.text();
  let result = null;
  try { result = responseBody ? JSON.parse(responseBody) : null; } catch { /* Pulseem does not publish a response schema. */ }
  const summary = pulseemResponseSummary(response, responseBody, result);
  const explicitlyFailed = pulseemExplicitlyFailed(responseBody, result);
  if (!response.ok || explicitlyFailed) throw Object.assign(new Error('SMS_PROVIDER_UNAVAILABLE'), { provider: summary });
  return { ok: true, provider: summary };
};

const otpSettings = env => ({
  ttlSeconds: positiveInteger(env.SMS_OTP_TTL_SECONDS, 300, 60, 900),
  maxAttempts: positiveInteger(env.SMS_OTP_MAX_ATTEMPTS, 5, 1, 10),
  maxRequestsPerHour: positiveInteger(env.SMS_OTP_REQUESTS_PER_HOUR, 5, 1, 20),
  cooldownSeconds: positiveInteger(env.SMS_OTP_COOLDOWN_SECONDS, 60, 10, 300),
  verificationTokenSeconds: positiveInteger(env.SMS_PHONE_VERIFICATION_TTL_SECONDS, 7200, 300, 86_400)
});

const requirePurpose = purpose => {
  const normalized = String(purpose || '').toUpperCase();
  if (!OTP_PURPOSES.has(normalized)) throw new Error('INVALID_OTP_PURPOSE');
  return normalized;
};

const requireSigningSecret = env => {
  const secret = String(env.SMS_OTP_SIGNING_SECRET || '').trim();
  if (secret.length < 32) throw new Error('SMS_NOT_CONFIGURED');
  return secret;
};

const otpHash = (id, clubId, phone, purpose, otp, secret) => hmac(`${id}:${clubId}:${phone}:${purpose}:${otp}`, secret);

export const requestPhoneCode = async ({ store, env, clubId, phone, purpose, fetchImpl = fetch, logger = console }) => {
  const normalizedPhone = normalizeIsraeliMobile(phone);
  const normalizedPurpose = requirePurpose(purpose);
  if (!normalizedPhone) throw new Error('INVALID_PHONE');
  const settings = otpSettings(env);
  const stats = await store.getOtpRequestStats(clubId, normalizedPhone, normalizedPurpose);
  if (stats.requestsLastHour >= settings.maxRequestsPerHour || (stats.lastRequestedAt && Date.now() - new Date(stats.lastRequestedAt).getTime() < settings.cooldownSeconds * 1000)) {
    throw new Error('OTP_RATE_LIMITED');
  }

  const testMode = String(env.SMS_TEST_MODE || '').toLowerCase() === 'true';
  const secret = requireSigningSecret(env);
  const code = testMode ? '1111' : randomOtp();
  const id = crypto.randomUUID();
  await store.createOtpChallenge({
    id,
    clubId,
    phone: normalizedPhone,
    purpose: normalizedPurpose,
    codeHash: await otpHash(id, clubId, normalizedPhone, normalizedPurpose, code, secret),
    expiresAt: new Date(Date.now() + settings.ttlSeconds * 1000),
    maxAttempts: settings.maxAttempts
  });

  if (!testMode) {
    try {
      const sent = await sendPulseemSms({
        env,
        phone: normalizedPhone,
        reference: id,
        text: `קוד האימות שלך ל-BALY wellness הוא ${code}. הקוד תקף ל-${Math.ceil(settings.ttlSeconds / 60)} דקות.`,
        fetchImpl
      });
      logger.info?.('SMS OTP accepted by provider', {
        purpose: normalizedPurpose,
        phoneSuffix: normalizedPhone.slice(-4),
        provider: sent.provider
      });
    } catch (error) {
      await store.invalidateOtpChallenge(id);
      logger.warn?.('SMS OTP provider rejected request', {
        purpose: normalizedPurpose,
        phoneSuffix: normalizedPhone.slice(-4),
        reason: error instanceof Error ? error.message : 'SMS_PROVIDER_UNAVAILABLE',
        provider: error?.provider
      });
      throw error;
    }
  }
  return { ok: true, expiresInSeconds: settings.ttlSeconds, testMode };
};

export const verifyPhoneCode = async ({ store, env, clubId, phone, purpose, code }) => {
  const normalizedPhone = normalizeIsraeliMobile(phone);
  const normalizedPurpose = requirePurpose(purpose);
  if (!normalizedPhone || !/^\d{4,6}$/.test(String(code || ''))) return false;
  const challenge = await store.getLatestOtpChallenge(clubId, normalizedPhone, normalizedPurpose);
  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now() || Number(challenge.attempts) >= Number(challenge.max_attempts)) return false;
  const expectedHash = await otpHash(challenge.id, clubId, normalizedPhone, normalizedPurpose, String(code), requireSigningSecret(env));
  return store.consumeOtpChallenge(challenge.id, expectedHash);
};

export const createPhoneVerificationToken = async ({ env, clubId, phone }) => {
  const settings = otpSettings(env);
  const payload = base64Url(encoder.encode(JSON.stringify({
    clubId,
    phone: normalizeIsraeliMobile(phone),
    purpose: 'REGISTER',
    expiresAt: Date.now() + settings.verificationTokenSeconds * 1000,
    nonce: crypto.randomUUID()
  })));
  return `${payload}.${await hmac(payload, requireSigningSecret(env))}`;
};

export const verifyPhoneVerificationToken = async ({ env, clubId, phone, token }) => {
  if (!token || typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !await verifyHmac(payload, signature, requireSigningSecret(env))) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return data.clubId === clubId
      && data.phone === normalizeIsraeliMobile(phone)
      && data.purpose === 'REGISTER'
      && Number(data.expiresAt) > Date.now();
  } catch {
    return false;
  }
};
