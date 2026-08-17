import { FamilyBillingMode, FamilyMemberPlanSelection, MembershipType, PaymentPurchaseVariant } from '../types';

const PENDING_PAYMENT_KEY = 'baly_cardcom_pending_payment_v1';
const PROCESSED_TRANSACTIONS_KEY = 'baly_cardcom_processed_transactions_v1';

export interface PendingCardcomPayment {
  lowProfileId: string;
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
  planAmount?: number;
  planLabel?: string;
}

interface CreatePaymentRequest {
  userId: string;
  userName: string;
  email: string;
  phone: string;
  membershipType: MembershipType;
  mode: PendingCardcomPayment['mode'];
  purchaseVariant?: PendingCardcomPayment['purchaseVariant'];
  registrationDraft?: Record<string, unknown>;
  familyMembersCount?: number;
  familyName?: string;
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
  discountCode?: string;
  planAmount?: number;
  planLabel?: string;
}

export interface VerifiedCardcomPayment {
  success: true;
  lowProfileId: string;
  membershipType: MembershipType;
  amount: number;
  transactionId: string;
  last4Digits?: string;
  mode: PendingCardcomPayment['mode'];
  purchaseVariant?: PendingCardcomPayment['purchaseVariant'];
  familyMembersCount?: number;
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
}

const paymentApiBase = () => (import.meta.env.VITE_PAYMENT_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

export const isCardcomConfigured = () => Boolean(paymentApiBase());

export const startCardcomPayment = async (request: CreatePaymentRequest) => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום עדיין לא הוגדר בשרת.');
  const response = await fetch(`${apiBase}/api/payments/cardcom/create`, {
    method: 'POST',
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
  if (!response.ok || !result.url || !result.lowProfileId) {
    throw new Error(result.message || 'לא ניתן לפתוח את דף התשלום של Cardcom.');
  }
  const pending: PendingCardcomPayment = {
    lowProfileId: result.lowProfileId,
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

export const getPendingCardcomPayment = (): PendingCardcomPayment | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearPendingCardcomPayment = () => sessionStorage.removeItem(PENDING_PAYMENT_KEY);

export const verifyPendingCardcomPayment = async (pending: PendingCardcomPayment): Promise<VerifiedCardcomPayment> => {
  const apiBase = paymentApiBase();
  if (!apiBase) throw new Error('שירות התשלום אינו זמין.');
  const response = await fetch(`${apiBase}/api/payments/cardcom/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lowProfileId: pending.lowProfileId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || 'לא ניתן לאמת את העסקה מול Cardcom.');
  if (result.membershipType !== pending.membershipType) throw new Error('פרטי העסקה אינם תואמים למסלול שנבחר.');
  if (result.mode !== pending.mode) throw new Error('סוג העסקה אינו תואם לפעולה שנבחרה.');
  if ((result.purchaseVariant || undefined) !== pending.purchaseVariant) throw new Error('חבילת התשלום אינה תואמת לחבילה שנבחרה.');
  if ((result.familyMembersCount || undefined) !== pending.familyMembersCount) throw new Error('פרטי החבילה המשפחתית אינם תואמים לעסקה.');
  if ((result.familyBillingMode || undefined) !== pending.familyBillingMode) throw new Error('סוג החבילה המשפחתית אינו תואם לעסקה.');
  if (JSON.stringify(result.familyMemberPlans || undefined) !== JSON.stringify(pending.familyMemberPlans || undefined)) throw new Error('הרכב המסלולים המשפחתי אינו תואם לעסקה.');
  return result as VerifiedCardcomPayment;
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

export const clearCardcomReturnParams = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('cardcom');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};
