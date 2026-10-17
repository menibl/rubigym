// Never log the body, provider error.message, or arbitrary response headers.
const safeProviderCodes = new Set(['invalid_api_key', 'insufficient_quota', 'rate_limit_exceeded', 'model_not_found',
  'invalid_request_error', 'invalid_json_schema', 'server_error', 'context_length_exceeded', 'unsupported_parameter']);

export async function readOpenAiResponse(response, stage) {
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const requestId = response.headers.get('x-request-id') || '';
  const diagnostics = { stage, httpStatus: response.status,
    contentType: ['application/json', 'text/html', 'text/plain', 'text/event-stream', 'application/problem+json'].includes(type) ? type : 'other-or-missing',
    requestId: /^req_[a-zA-Z0-9_-]{1,150}$/.test(requestId) ? requestId : null,
    responseBytes: null };
  let text;
  try {
    const bytes = await response.arrayBuffer();
    diagnostics.responseBytes = bytes.byteLength;
    text = new TextDecoder().decode(bytes);
  } catch { return { diagnostics, failure: 'OPENAI_RESPONSE_READ_FAILED' }; }
  if (!text.trim()) return { diagnostics, failure: 'OPENAI_EMPTY_BODY' };
  let result;
  try { result = JSON.parse(text); }
  catch { return { diagnostics, failure: 'OPENAI_INVALID_JSON' }; }
  if (!result || typeof result !== 'object' || Array.isArray(result)) return { diagnostics, failure: 'OPENAI_INVALID_RESPONSE_SHAPE' };
  if (result.error || !response.ok) return { diagnostics: { ...diagnostics,
    providerCode: safeProviderCodes.has(result.error?.code) ? result.error.code : 'unknown' }, failure: 'OPENAI_REQUEST_REJECTED' };
  return { diagnostics, result };
}
