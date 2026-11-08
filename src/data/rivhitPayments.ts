import { DiscountCode, FamilyBillingMode, FamilyMemberPlanSelection, MembershipType, Payment, PaymentPurchaseVariant } from '../types';
import { retryPaymentApproval, approvalFetchSignal } from './paymentApprovalRetry';

const PENDING_PAYMENT_KEY = 'baly_rivhit_pending_payment_v1';
const PROCESSED_TRANSACTIONS_KEY = 'baly_rivhit_processed_transactions_v1';

export interface PendingRivhitPayment {
  resumedAuthenticatedRegistration?: boolean;
  paymentReference: string;
  userId: string;
  membershipType: MembershipType;
  mode: 'PRIMARY' | 'ADDON' | 'REGISTRATION';
  purchaseVariant?: PaymentPurchaseVariant;
  createdAt: string;
  registrationDraft?: Record<string, unknown>;
  familyMembersCount?: number;
  familyName?: string;
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
  discountCode?: string;
  familySplitBatchId?: string;
  familySplitItemId?: string;
}

interface CreatePaymentRequest {
  individualSelections?: { membershipType: MembershipType; trainingSessionsCount?: number }[];
  familyPaymentGrouping?: 'COMBINED' | 'SEPARATE';
  userId: string;
  userName: string;
  email: string;
  phone: string;
  membershipType: MembershipType;
  mode: PendingRivhitPayment['mode'];
  purchaseVariant?: PendingRivhitPayment['purchaseVariant'];
  registrationDraft?: Record<string, unknown>;
  familyMembersCount?: number;
  familyName?: string;
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
  discountCode?: string;
  planAmount?: number;
  planLabel?: string;
}

export interface VerifiedRivhitPayment {
  recurringPending?: boolean;
  openGroupUpgrade?: boolean;
  discountCode?: string | null;
  success: true;
  paymentReference: string;
  userId?: string;
  membershipType: MembershipType;
  amount: number;
  packageAmount?: number;
  billingPeriod?: import('../types').MembershipPlanConfig['billingPeriod'];
  termMonths?: number;
  recurringMonths?: number;
  recurringContractEndsAt?: string;
  membershipExpiry?: string;
  recurringSaleId?: string;
  recurringChargeNumber?: number;
  includedSessions?: number;
  transactionId: string;
  saleId?: string;
  isMock?: boolean;
  last4Digits?: string;
  mode: PendingRivhitPayment['mode'];
  purchaseVariant?: PendingRivhitPayment['purchaseVariant'];
  familyMembersCount?: number;
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
}

const paymentApiBase = () => (import.meta.env.VITE_PAYMENT_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

export const isRivhitConfigured = () => Boolean(paymentApiBase());

export const validateRivhitDiscountCode = async (code: string): Promise<DiscountCode> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות קודי ההנחה אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/discount/validate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim().toUpperCase() })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.valid || !result.discount) {
    throw new Error(result.message || 'קוד ההנחה אינו תקין או שכבר נוצל.');
  }
  return result.discount as DiscountCode;
};

export const startRivhitPayment = async (request: CreatePaymentRequest) => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום עדיין לא הוגדר בשרת.');
  let quoteKey: string | undefined;
  let upgradeQuoteKey: string | undefined;
  if ((request.membershipType === 'FAMILY_MEMBERSHIP' && request.mode === 'PRIMARY') || (request.individualSelections?.length && ['PRIMARY', 'ADDON'].includes(request.mode))) {
    const quoteResponse = await fetch(`${apiBase}/api/payments/rivhit/create`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, registrationDraft: undefined, quoteOnly: true, unifiedCheckout: true })
    });
    const quote = await quoteResponse.json().catch(() => ({}));
    if (quoteResponse.ok && quote.split && quote.batchId) {
      await continueFamilySplitPayment(quote.batchId, request.userId);
      return;
    }
    if (!quoteResponse.ok || !quote.quoteKey) throw new Error(quote.message || 'לא ניתן לחשב את הקיזוז.');
    if (!window.confirm(`מחיר המסלולים: ₪${quote.packageAmount}\nקיזוז תשלום קודם: ₪${quote.creditAmount}\nלתשלום חד־פעמי עכשיו: ₪${quote.amountDue}\nבחידוש הבא נדרש תשלום ידני. להמשיך?`)) throw new Error('המעבר לתשלום בוטל. לא בוצע חיוב.');
    quoteKey = quote.quoteKey;
  }
  let recurringAcknowledged = false;
  const create = (repeatPaymentAcknowledged = false) => fetch(`${apiBase}/api/payments/rivhit/create`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: request.userId,
      repeatPaymentAcknowledged,
      recurringAcknowledged,
      quoteKey,
      upgradeQuoteKey,
      userName: request.userName,
      email: request.email,
      phone: request.phone,
      membershipType: request.membershipType,
      mode: request.mode,
      purchaseVariant: request.purchaseVariant,
      familyMembersCount: request.familyMembersCount,
      familyName: request.familyName,
      familyBillingMode: request.familyBillingMode,
      familyPaymentGrouping: request.familyPaymentGrouping,
      familyMemberPlans: request.familyMemberPlans,
      discountCode: request.discountCode,
      planAmount: request.planAmount,
      planLabel: request.planLabel,
      pendingPaymentReference: getPendingRivhitPayment()?.userId === request.userId ? getPendingRivhitPayment()?.paymentReference : undefined
    })
  });
  let response = await create();
  let result = await response.json().catch(() => ({}));
  if (response.status === 409 && result.code === 'OPEN_GROUP_UPGRADE_CONFIRMATION') {
    if (!window.confirm(result.message)) throw new Error('השדרוג בוטל. לא בוצע חיוב.');
    upgradeQuoteKey = result.upgradeQuoteKey;
    response = await create();
    result = await response.json().catch(() => ({}));
  }
  if (response.status === 409 && result.code === 'RECURRING_CONSENT_REQUIRED') {
    if (!window.confirm(result.message)) throw new Error('המעבר להוראת קבע בוטל. לא נוצר חיוב.');
    recurringAcknowledged = true;
    response = await create();
    result = await response.json().catch(() => ({}));
  }
  if (response.status === 409 && result.code === 'REPEAT_MONTHLY_PAYMENT') {
    if (!window.confirm(result.message)) throw new Error('התשלום הנוסף בוטל. לא בוצע חיוב.');
    response = await create(true);
    result = await response.json().catch(() => ({}));
  }
  if (response.ok && result.completed) { clearPendingRivhitPayment(); clearRivhitReturnParams(); window.alert(result.message || 'הבקשה הקיימת סונכרנה. לא נוצר חיוב נוסף.'); window.location.reload(); return; }
  if (!response.ok || !result.url || !result.paymentReference) {
    throw new Error(result.message || 'לא ניתן לפתוח את דף התשלום של RIVHIT.');
  }
  if (result.resumed && !window.confirm(`כבר קיימת בקשת תשלום עבור ${result.resumeSummary.label}, בסכום ₪${result.resumeSummary.amount} לכל חודש, ל־12 חיובים. תוקף ההתקשרות עד ${result.resumeSummary.endsAt}.\nזו אותה בקשה — לא נפתחת הוראת קבע נוספת. המחיר וקוד ההנחה נשארים לפי הבקשה המקורית. להמשיך?`)) return;
  const pending: PendingRivhitPayment = {
    paymentReference: result.paymentReference,
    userId: request.userId,
    membershipType: result.resumeSummary?.membershipType || request.membershipType,
    mode: result.resumeSummary?.mode || request.mode,
    purchaseVariant: request.purchaseVariant,
    createdAt: new Date().toISOString(),
    registrationDraft: request.registrationDraft,
    familyMembersCount: request.familyMembersCount,
    familyName: request.familyName,
    familyBillingMode: request.familyBillingMode,
    familyMemberPlans: result.familyMemberPlans || request.familyMemberPlans,
    discountCode: result.resumeSummary ? result.resumeSummary.discountCode : request.discountCode
  };
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
  window.location.assign(result.url);
};

interface FamilySplitItem {
  id: string; memberName: string; label: string; amount: number; recurring: boolean; status: string;
  groupLines?: { memberName: string; label: string; amount: number }[];
}
const familySplitAction = async (action: string, batchId: string, extra: Record<string, unknown> = {}, signal?: AbortSignal) => {
  const response = await fetch(`${paymentApiBase()}/api/payments/rivhit/family-split/${action}`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, ...extra }), signal: action === 'verify' ? approvalFetchSignal(signal) : undefined
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.message || 'התשלום המשפחתי דורש בירור. אין לבצע חיוב נוסף.'), { code: result.code, status: response.status });
  return result;
};

export const continueFamilySplitPayment = async (batchId: string, userId: string, returnedItemId?: string, options: { signal?: AbortSignal; onRetry?: (attempt: number) => void } = {}) => {
  if (returnedItemId) {
    try { await retryPaymentApproval(() => familySplitAction('verify', batchId, { itemId: returnedItemId }, options.signal), options); }
    catch (error) {
      if ((error as Error & { code?: string }).code !== 'SPLIT_ITEM_CANCELLED') throw error;
      clearPendingRivhitPayment(); clearRivhitReturnParams();
      window.dispatchEvent(new Event('baly:refresh-billing'));
      window.alert('בקשת התשלום הזאת שוחררה על ידי המנהל. יש לבחור מסלולים מחדש, ולא להמשיך בדף הישן.');
      return;
    }
  }
  if (options.signal?.aborted) return;
  if (returnedItemId) window.dispatchEvent(new Event('baly:refresh-billing'));
  clearRivhitReturnParams();
  const batch = await familySplitAction('status', batchId);
  if (batch.completed) {
    clearPendingRivhitPayment();
    window.alert('בקשות התשלום הושלמו. הוראות קבע שהקמתן אושרה ברווחית מאפשרות גישה בהמתנה לחיוב הראשון; אישור הקמה אינו קבלה על תשלום. כשל חיוב מאומת ישהה רק את המסלול הרלוונטי.');
    window.location.reload();
    return;
  }
  const items: FamilySplitItem[] = batch.items;
  const next = items.find(item => !['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID', 'CANCELLED'].includes(item.status));
  if (!next) throw new Error('לא נמצא מסלול להשלמת התשלום.');
  const summary = items.map(item => item.status === 'CANCELLED' ? `${item.memberName} — ${item.label}: הבקשה בוטלה באישור מנהל, ללא חיוב`
    : ['PAID', 'SETUP', 'EXISTING_RECURRING', 'ALREADY_PAID'].includes(item.status)
    ? `${item.memberName} — ${item.label}: כבר טופל, ללא חיוב נוסף כעת`
    : `${item.memberName} — ${item.label}: ₪${item.amount} ${item.recurring ? 'לכל חודש, 12 חיובים; המחיר לאחר ההנחה קבוע לכל הסדרה' : 'חד־פעמי'}${item.groupLines ? '\n' + item.groupLines.map(line => `  ${line.memberName} — ${line.label}: ₪${line.amount}${item.recurring ? ' לחודש' : ' חד־פעמי'}`).join('\n') : ''}`).join('\n');
  if (!window.confirm(`${batch.message}\n\n${summary}\n\nלהמשיך למסלול של ${next.memberName}: ${next.label}, ₪${next.amount}?`)) {
    // Only an entirely undispatched quote can be discarded. Already created
    // orders remain resumable; cancellation here never cancels Rivhit contracts.
    if (items.every(item => ['READY', 'EXISTING_RECURRING', 'ALREADY_PAID', 'CANCELLED'].includes(item.status))) await familySplitAction('cancel', batchId);
    return;
  }
  const checkout = await familySplitAction('create', batchId, { itemId: next.id, acknowledged: true });
  if (checkout.completed) { clearPendingRivhitPayment(); clearRivhitReturnParams(); window.location.reload(); return; }
  const pending: PendingRivhitPayment = { paymentReference: checkout.paymentReference, userId,
    membershipType: MembershipType.FAMILY_MEMBERSHIP, mode: 'PRIMARY', createdAt: new Date().toISOString(),
    familySplitBatchId: batchId, familySplitItemId: next.id };
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
  window.location.assign(checkout.url);
};

export const getPendingRivhitPayment = (): PendingRivhitPayment | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearPendingRivhitPayment = () => sessionStorage.removeItem(PENDING_PAYMENT_KEY);

export interface RecoverableCheckout {
  id: string;
  kind: 'RECURRING' | 'FAMILY';
  label: string;
  amount?: number;
  createdAt?: string;
  pendingCount?: number;
  canRestart: boolean;
}

const checkoutRecovery = async (action: 'status' | 'resume' | 'restart', orderId?: string, signal?: AbortSignal) => {
  const response = await fetch(`${paymentApiBase()}/api/payments/rivhit/checkout-recovery`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, orderId, confirmUndispatched: action === 'restart' }), signal: approvalFetchSignal(signal)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const temporary = action === 'resume' && ['CONTINUATION_LIST_UNAVAILABLE', 'CONTINUATION_PROVIDER_UNAVAILABLE',
      'CONTINUATION_PROVIDER_STATUS', 'CONTINUATION_ACTIVE_SERIES', 'RIVHIT_UNAVAILABLE', 'RIVHIT_RECURRING_PENDING'].includes(result.reasonCode);
    throw Object.assign(new Error(result.message || 'בדיקת בקשת התשלום אינה זמינה כרגע. הבקשה נשמרה; לא נפתח חיוב נוסף.'),
      { code: temporary ? 'CHECKOUT_VERIFICATION_PENDING' : result.code, reasonCode: result.reasonCode, status: response.status });
  }
  return result;
};

export const listRecoverableCheckouts = async (signal?: AbortSignal): Promise<RecoverableCheckout[]> => {
  const result = await checkoutRecovery('status', undefined, signal);
  if (!Array.isArray(result.items) || result.items.some(item => !item || typeof item.id !== 'string'
    || !['RECURRING', 'FAMILY'].includes(item.kind) || typeof item.label !== 'string')) {
    throw new Error('לא התקבלה רשימת בקשות תקינה. אין לפתוח חיוב נוסף לפני בדיקה.');
  }
  return result.items;
};

export const restartUndispatchedCheckout = async (orderId: string) => {
  const result = await checkoutRecovery('restart', orderId);
  window.dispatchEvent(new Event('baly:refresh-billing'));
  return result.message as string;
};

export const resumeSavedCheckout = async (orderId: string, userId: string, options: {
  signal?: AbortSignal; onRetry?: (attempt: number) => void;
} = {}) => {
  // This endpoint cannot create/GetUrl, even on retry or after a lost response.
  const result = await retryPaymentApproval(() => checkoutRecovery('resume', orderId, options.signal),
    { ...options, delays: [3000, 5000, 10000] });
  if (options.signal?.aborted) return;
  if (result.completed || result.released) {
    clearPendingRivhitPayment(); clearRivhitReturnParams();
    window.dispatchEvent(new Event('baly:refresh-billing'));
    window.alert(result.message || 'הבקשה סונכרנה. לא נפתח חיוב נוסף.');
    window.location.reload(); return;
  }
  const summary = result.resumeSummary;
  if (!result.resumed || !result.url || !result.paymentReference || !summary) throw new Error('לא התקבל קישור מאומת לבקשה המקורית. לא נפתח חיוב נוסף.');
  if (!window.confirm(`המשך הבקשה המקורית: ${summary.label}, ₪${summary.amount} לכל חודש, 12 חיובים. תוקף ההתקשרות עד ${summary.endsAt}.\nלא נפתחת הוראת קבע נוספת. המחיר וההנחה נשארים כפי שאושרו בבקשה המקורית. להמשיך?`)) return;
  const pending: PendingRivhitPayment = { paymentReference: result.paymentReference, userId,
    resumedAuthenticatedRegistration: summary.mode === 'REGISTRATION',
    membershipType: summary.membershipType, mode: summary.mode, createdAt: new Date().toISOString(),
    purchaseVariant: summary.purchaseVariant, familyMembersCount: summary.familyMembersCount,
    familyName: summary.familyName, familyBillingMode: summary.familyBillingMode,
    familyMemberPlans: result.familyMemberPlans, discountCode: summary.discountCode };
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
  window.location.assign(result.url);
};

export const verifyPendingRivhitPayment = async (pending: PendingRivhitPayment, signal?: AbortSignal): Promise<VerifiedRivhitPayment> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentReference: pending.paymentReference }), signal: approvalFetchSignal(signal)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw Object.assign(new Error(result.message || 'לא ניתן לאמת את העסקה מול RIVHIT.'), { code: result.code, status: response.status });
  if (result.userId && result.userId !== pending.userId) throw new Error('התשלום אינו משויך למשתמש המחובר.');
  if (result.membershipType !== pending.membershipType) throw new Error('פרטי העסקה אינם תואמים למסלול שנבחר.');
  if (result.mode !== pending.mode) throw new Error('סוג העסקה אינו תואם לפעולה שנבחרה.');
  if ((result.purchaseVariant || undefined) !== pending.purchaseVariant) throw new Error('חבילת התשלום אינה תואמת לחבילה שנבחרה.');
  if ((result.familyMembersCount || undefined) !== pending.familyMembersCount) throw new Error('פרטי החבילה המשפחתית אינם תואמים לעסקה.');
  if ((result.familyBillingMode || undefined) !== pending.familyBillingMode) throw new Error('סוג החבילה המשפחתית אינו תואם לעסקה.');
  if (JSON.stringify(result.familyMemberPlans || undefined) !== JSON.stringify(pending.familyMemberPlans || undefined)) throw new Error('הרכב המסלולים המשפחתי אינו תואם לעסקה.');
  return result as VerifiedRivhitPayment;
};

export const wasTransactionProcessed = (transactionId: string) => {
  try {
    const processed: string[] = JSON.parse(localStorage.getItem(PROCESSED_TRANSACTIONS_KEY) || '[]');
    return processed.includes(transactionId);
  } catch {
    return false;
  }
};

export const markTransactionProcessed = (transactionId: string) => {
  let processed: string[] = [];
  try { processed = JSON.parse(localStorage.getItem(PROCESSED_TRANSACTIONS_KEY) || '[]'); } catch { /* empty */ }
  localStorage.setItem(PROCESSED_TRANSACTIONS_KEY, JSON.stringify([...new Set([transactionId, ...processed])].slice(0, 100)));
};

export const clearRivhitReturnParams = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('rivhit');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const runAdminPaymentAction = async (path: string, body: Record<string, unknown>): Promise<Payment> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/admin/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || !result.payment) throw new Error(result.message || 'הפעולה מול רווחית נכשלה.');
  return result.payment as Payment;
};

export const refundRivhitPayment = (paymentId: string, reason: string) =>
  runAdminPaymentAction('refund', { paymentId, reason });
export const reconcileRivhitPayment = (paymentId: string) =>
  runAdminPaymentAction('reconcile', { paymentId });

export const syncRivhitRecurring = async (userId: string, saleId: string): Promise<string> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/admin/recurring-sync`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, saleId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'לא ניתן לאמת את ההוראה ברווחית. אין לבצע תשלום נוסף.');
  return result.message;
};

export interface RecurringSyncPreview {
  seriesId: string; userName: string; membershipType: string; planLabel: string; amount: number;
  successfulCharges: number; endsAt: string; lastChargeDate?: string; discountRecorded: boolean; discountCode: string | null; nextChargeDate: string | null;
}
export interface RecurringCheckoutItem {
  orderId: string; label: string; amount?: number; createdAt: string; stage: string; canRelease: boolean;
}
export const adminRecurringCheckout = async (userId: string, action: 'list' | 'inspect' | 'release' = 'list', orderId?: string, reason?: string): Promise<{ items?: RecurringCheckoutItem[]; message?: string }> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/admin/recurring-checkouts`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, action, orderId, reason, confirmUndispatched: action === 'release' })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'הבקשה לא שוחררה. יש לבדוק מול רווחית לפני תשלום נוסף.');
  return result;
};
export const syncRivhitRecurringId = async (userId: string, recurringSaleId: string, confirmationKey?: string): Promise<{ message?: string; preview?: RecurringSyncPreview; confirmationKey?: string }> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/admin/recurring-sync`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, recurringSaleId, action: confirmationKey ? 'confirm' : 'preview', confirmationKey })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'לא ניתן לאמת את הוראת הקבע. לא נוצר חיוב נוסף.');
  return result;
};

export interface StuckReleaseInput {
  action: 'preview' | 'confirm'; userId: string; orderId: string; checkedAt?: number; confirmationKey?: string;
  password?: string; reason?: string; providerReference?: string; oldPageUnusable?: boolean; noChargeOrInstruction?: boolean;
}
export const releaseStuckRecurringCheckout = async (input: StuckReleaseInput): Promise<{ message: string; checkedAt: number; confirmationKey: string }> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/admin/stuck-checkout-release`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'הבקשה לא שוחררה; יש לבצע בירור מול רווחית.');
  return result;
};

export interface FamilyCreditRecoveryResult {
  diagnostic?: { code: string; stage: string };
  ok: boolean;
  state: 'NONE' | 'USED' | 'BLOCKED' | 'RELEASED' | 'RELEASABLE' | 'REVIEW_REQUIRED' | 'SYNCED' | 'EXISTING_PAGE';
  message: string;
  url?: string;
}

export const recoverFamilyPaymentCredit = async (paymentId: string, action: 'check' | 'release', reason: string): Promise<FamilyCreditRecoveryResult> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/admin/family-credit-recovery`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId, action, reason })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'לא ניתן לברר את מצב הקיזוז. אין לבצע תשלום נוסף.');
  return result;
};

export const cancelRivhitRecurring = (paymentId: string, reason: string, confirmFamilySeries = false) =>
  runAdminPaymentAction('cancel-recurring', { paymentId, reason, confirmFamilySeries });

export const updateRivhitRecurringAmount = (paymentId: string, amount: number, reason: string) =>
  runAdminPaymentAction('update-recurring', { paymentId, amount, reason });
