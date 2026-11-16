// At most two read/verify requests at a time, no timers that poll indefinitely.
// Aborting on navigation/manual continuation also suppresses late UI updates.
export async function checkCheckoutReturns<T extends { id: string }>(items: T[], signal: AbortSignal,
  check: (id: string, signal: AbortSignal) => Promise<unknown>,
  result: (item: T, value: unknown, error?: unknown) => void) {
  let index = 0;
  const worker = async () => {
    while (!signal.aborted && index < Math.min(items.length, 20)) {
      const item = items[index++];
      try { const value = await check(item.id, signal); if (!signal.aborted) result(item, value); }
      catch (error) { if (!signal.aborted) result(item, undefined, error); }
    }
  };
  await Promise.all([worker(), worker()]);
}
