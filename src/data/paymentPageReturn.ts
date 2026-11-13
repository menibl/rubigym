// BFCache can restore React before an awaited navigation's finally rendered.
// Clear UI busy flags only, never the order or its payment verification state.
export function onPaymentPageReturn(reset: () => void, surface: Pick<Window, 'addEventListener' | 'removeEventListener'> = window) {
  const returned = (event: Event) => { if ((event as PageTransitionEvent).persisted) reset(); };
  surface.addEventListener('pageshow', returned);
  return () => surface.removeEventListener('pageshow', returned);
}
