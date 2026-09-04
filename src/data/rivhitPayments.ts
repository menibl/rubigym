import { FamilyBillingMode, FamilyMemberPlanSelection, MembershipType, PaymentPurchaseVariant } from '../types';

const PENDING_PAYMENT_KEY = 'baly_rivhit_pending_payment_v1';
const PROCESSED_TRANSACTIONS_KEY = 'baly_rivhit_processed_transactions_v1';

export interface PendingRivhitPayment {
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
}

interface CreatePaymentRequest {
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
  success: true;
  paymentReference: string;
  userId?: string;
  membershipType: MembershipType;
  amount: number;
  billingPeriod?: import('../types').MembershipPlanConfig['billingPeriod'];
  termMonths?: number;
  recurringMonths?: number;
  includedSessions?: number;
  transactionId: string;
  last4Digits?: string;
  mode: PendingRivhitPayment['mode'];
  purchaseVariant?: PendingRivhitPayment['purchaseVariant'];
  familyMembersCount?: number;
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
}

const paymentApiBase = () => (import.meta.env.VITE_PAYMENT_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

export const isRivhitConfigured = () => Boolean(paymentApiBase());

export const startRivhitPayment = async (request: CreatePaymentRequest) => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום עדיין לא הוגדר בשרת.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/create`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: request.userId,
      userName: request.userName,
      email: request.email,
      phone: request.phone,
      membershipType: request.membershipType,
      mode: request.mode,
      purchaseVariant: request.purchaseVariant,
      familyMembersCount: request.familyMembersCount,
      familyBillingMode: request.familyBillingMode,
      familyMemberPlans: request.familyMemberPlans,
      discountCode: request.discountCode,
      planAmount: request.planAmount,
      planLabel: request.planLabel
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url || !result.paymentReference) {
    throw new Error(result.message || 'לא ניתן לפתוח את דף התשלום של RIVHIT.');
  }
  const pending: PendingRivhitPayment = {
    paymentReference: result.paymentReference,
    userId: request.userId,
    membershipType: request.membershipType,
    mode: request.mode,
    purchaseVariant: request.purchaseVariant,
    createdAt: new Date().toISOString(),
    registrationDraft: request.registrationDraft,
    familyMembersCount: request.familyMembersCount,
    familyName: request.familyName,
    familyBillingMode: request.familyBillingMode,
    familyMemberPlans: request.familyMemberPlans,
    discountCode: request.discountCode
  };
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
  window.location.assign(result.url);
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

export const verifyPendingRivhitPayment = async (pending: PendingRivhitPayment): Promise<VerifiedRivhitPayment> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/rivhit/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentReference: pending.paymentReference })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || 'לא ניתן לאמת את העסקה מול RIVHIT.');
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
