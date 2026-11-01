export const APPROVAL_RETRY_DELAYS = Array<number>(12).fill(15_000);
type RetryError = Error & { code?: string; status?: number };
export const isApprovalRetryable = (error: unknown) => {
  const value = error as RetryError;
  if (value?.name === 'AbortError') return false;
  if (value?.code === 'RIVHIT_RECURRING_PENDING') return true;
  if (value?.code) return false;
  return value?.name === 'TimeoutError' || value instanceof TypeError || value?.status === 429 || Number(value?.status) >= 500;
};
const aborted = () => new DOMException('Approval check stopped', 'AbortError');
const sleep = (delay: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(aborted()); return; }
  const stop = () => { clearTimeout(timer); reject(aborted()); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, delay);
  signal?.addEventListener('abort', stop, { once: true });
});

// Wrap read/verify ONLY. Never wrap create, redirect, charge or family-next-item.
export async function retryPaymentApproval<T>(operation: () => Promise<T>, options: {
  signal?: AbortSignal; onRetry?: (attempt: number) => void; delays?: number[];
  wait?: (delay: number, signal?: AbortSignal) => Promise<void>;
} = {}): Promise<T> {
  const delays = options.delays || APPROVAL_RETRY_DELAYS;
  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw aborted();
    try {
      const result = await operation();
      if (options.signal?.aborted) throw aborted();
      return result;
    } catch (error) {
      if (options.signal?.aborted) throw aborted();
      if (!isApprovalRetryable(error)) throw error;
      if (attempt >= delays.length) throw Object.assign(new Error('האישור ברווחית עדיין מתעכב. אין לבצע תשלום נוסף; ניתן לחזור לבדיקה בהמשך.'), { code: 'APPROVAL_CHECK_DEFERRED' });
      options.onRetry?.(attempt + 1);
      await (options.wait || sleep)(delays[attempt], options.signal);
    }
  }
}

export const approvalFetchSignal = (signal?: AbortSignal) => signal
  ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
