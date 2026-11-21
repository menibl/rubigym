// A bounded diagnostic projection, NOT a copy of the provider response. Unknown
// fields (including headers/request/recipient data) are deliberately discarded.
const keyName = key => key.toLowerCase().replace(/[_-]/g, '');
const codeKeys = new Set(['code', 'errorcode', 'resultcode', 'statuscode', 'errortype']);
const statusKeys = new Set(['status', 'state']);
const messageKeys = new Set(['message', 'errormessage', 'description', 'errordescription', 'reason', 'detail', 'title', 'statustext', 'statusdescription']);
const containerKeys = new Set(['error', 'errors', 'errordata', 'errordetails', 'details', 'data', 'result', 'results', 'response', 'validationerrors', 'modelstate']);
const validationKeys = new Set(['sendid', 'referencelist', 'smsenddata', 'smssenddata', 'tonumberlist', 'textlist', 'fromnumber']);

export function redactPulseemText(value, context = {}, limit = 240) {
  if (!['string', 'number', 'boolean'].includes(typeof value)) return '';
  let text = String(value);
  const originals = [context.apiKey, context.fromNumber, context.phone,
    context.phone && `972${context.phone.slice(1)}`, context.reference, context.text,
    ...(context.text || '').split(/\r?\n/), ...(context.text || '').match(/\b\d{4,8}\b/g) || []];
  for (const original of originals.filter(Boolean).map(String).map(value => value.trim()).filter(Boolean).sort((a, b) => b.length - a.length)) {
    text = text.split(original).join('[redacted]');
    text = text.split(original.replace(/[\r\n\t]+/g, ' ')).join('[redacted]');
  }
  return text.replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[redacted-number]')
    .replace(/[A-Za-z0-9_+\/-]{24,}={0,2}/g, '[redacted-token]')
    .replace(/[\r\n\t]+/g, ' ').trim().slice(0, limit);
}

export function summarizePulseemResponse(response, responseBody, result, context = {}) {
  const details = []; let visited = 0; let truncated = false; let failureDetected = false;
  const safe = value => {
    const text = redactPulseemText(value, context, 241);
    if (text.length > 240) truncated = true;
    return text.slice(0, 240);
  };
  const visit = (value, path, depth, errorContext = false) => {
    if (++visited > 60 || depth > 5 || details.length >= 12) { truncated = true; return; }
    if (Array.isArray(value)) {
      if (value.length > 12) truncated = true;
      value.slice(0, 12).forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1, errorContext));
      return;
    }
    if (!value || typeof value !== 'object') {
      if (errorContext && value !== false && value !== 0 && value !== '0' && value != null) {
        const message = safe(value); if (message) { details.push({ path, message }); failureDetected = true; }
      }
      return;
    }
    const detail = { path };
    let objectFailed = false;
    for (const [key, child] of Object.entries(value)) {
      const normalized = keyName(key);
      if (['success', 'issuccess', 'succeeded', 'ok'].includes(normalized) && (child === false || child === 'false')) failureDetected = true;
      if (statusKeys.has(normalized) && ['failed', 'failure', 'error', 'invalid', 'rejected', 'unauthorized', 'forbidden'].includes(String(child).toLowerCase())) { failureDetected = true; objectFailed = true; }
      if (normalized === 'errorcode' && child != null && String(child).trim() !== '' && String(child) !== '0') failureDetected = true;
      const field = codeKeys.has(normalized) ? 'code' : statusKeys.has(normalized) ? 'status' : messageKeys.has(normalized) ? 'message' : null;
      if (field && !detail[field]) {
        const text = safe(child); if (text) detail[field] = text;
      }
    }
    if (detail.code || detail.status || detail.message) details.push(detail);
    for (const [key, child] of Object.entries(value)) {
      const normalized = keyName(key);
      if (containerKeys.has(normalized) || (errorContext && validationKeys.has(normalized))) {
        // Paths use known normalized field names only, never arbitrary keys.
        visit(child, `${path}.${normalized}`, depth + 1, errorContext || objectFailed || normalized.includes('error') || normalized === 'modelstate');
      }
    }
  };
  if (result && typeof result === 'object') visit(result, '$', 0);
  else if (typeof result === 'string' || (result === null && responseBody)) {
    const text = typeof result === 'string' ? result : responseBody;
    // HTML gateway responses can contain arbitrary scripts, tokens and page data.
    details.push({ path: '$', message: /^\s*</.test(text) ? 'Non-JSON HTML response (body omitted)' : safe(text) });
  }
  else if (typeof result === 'number') details.push({ path: '$', code: safe(result) });
  else if (typeof result === 'boolean') {
    details.push({ path: '$', status: String(result) });
    if (!result) failureDetected = true;
  }
  const first = field => (field === 'code' && details.find(detail => detail.code && detail.code !== '0' && detail.path.includes('error'))?.code)
    || details.find(detail => detail[field] && (field !== 'code' || detail[field] !== '0'))?.[field]
    || details.find(detail => detail[field])?.[field] || '';
  const fieldNames = result && typeof result === 'object' && !Array.isArray(result) ? Object.keys(result) : [];
  if (fieldNames.length > 20) truncated = true;
  return { httpStatus: response.status,
    responseType: Array.isArray(result) ? 'array' : result === null ? (responseBody ? 'text' : 'empty') : typeof result,
    fieldNames: fieldNames.slice(0, 20).map(safe),
    status: first('status'), code: first('code'), message: first('message'), details, truncated, failureDetected };
}
