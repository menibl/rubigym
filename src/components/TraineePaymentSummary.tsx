import React from 'react';
import { DiscountCode, Payment, User, MembershipPlanConfig, MembershipType, MEMBERSHIP_TYPE_LABELS } from '../types';
import { isTestPayment, paymentCoversPlan, recordedDiscount, traineePayments } from '../../shared/admin-trainees.js';
import { validReminderDate } from '../../shared/payment-reminder-policy.js';

const recordedAmount = (payment: Payment) => typeof payment.amount === 'number' && Number.isFinite(payment.amount) && payment.amount >= 0
  ? `₪${payment.amount.toLocaleString('he-IL')}` : 'סכום לא תועד';

export function TraineePaymentSummary({ user, payments, discounts, plans }: { user: User; payments: Payment[]; discounts: DiscountCode[]; plans: MembershipPlanConfig[] }) {
  const allOwn = traineePayments(payments, user.id);
  const own = allOwn.filter(payment => !isTestPayment(payment) && payment.status === 'PAID');
  const family = user.familyPayerId && user.familyPayerId !== user.id
    ? traineePayments(payments, user.familyPayerId).filter(payment => !isTestPayment(payment) && payment.status === 'PAID' && payment.familyMemberPlans?.some(plan => plan.memberId === user.id && (!plan.participation || plan.participation === 'INCLUDED'))) : [];
  const related = [...allOwn, ...(user.familyPayerId ? traineePayments(payments, user.familyPayerId) : [])]
    .filter(payment => !isTestPayment(payment)).sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)));
  const testPayments = allOwn.filter(isTestPayment);
  const currentLabel = plans.find(plan => plan.id === user.membershipType)?.label || MEMBERSHIP_TYPE_LABELS[user.membershipType]?.label || user.membershipType || 'לא נבחר מסלול';
  return <div className="mt-2 space-y-2 text-xs leading-5">
    {[...new Set([user.membershipType, ...(user.secondaryMemberships || [])].filter(Boolean))].map(type => {
      const paid = related.find(payment => payment.status === 'PAID' && paymentCoversPlan(payment, user.id, type));
      const pending = related.some(payment => payment.status === 'PENDING' && paymentCoversPlan(payment, user.id, type));
      const refunded = related.some(payment => payment.status === 'REFUNDED' && paymentCoversPlan(payment, user.id, type));
      const familyReceipt = paid && (paid.membershipTypePurchased === MembershipType.FAMILY_MEMBERSHIP || Boolean(paid.familyMemberPlans?.length));
      const code = paid ? recordedDiscount(paid, discounts) : undefined;
      const balance = type === MembershipType.PERSONAL_TRAINING ? user.personalTrainingRemaining : type === MembershipType.DUO_TRAINING ? user.duoTrainingRemaining : type === MembershipType.OPEN_PUNCH_CARD ? user.punchCardRemaining : undefined;
      const hasBalance = [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING, MembershipType.OPEN_PUNCH_CARD].includes(type);
      const expiry = type === user.membershipType ? user.membershipExpiry : user.membershipPlanExpiries?.[type];
      return <div key={type} className="rounded-lg border border-slate-600 p-2">
        <p className="font-bold">{plans.find(plan => plan.id === type)?.label || MEMBERSHIP_TYPE_LABELS[type]?.label || type}</p>
        <p>{paid ? familyReceipt ? `נכלל בתשלום משפחתי מתועד מ־${paid.date} — הסכום הכולל מוצג בהיסטוריה` : `תשלום מתועד אחרון: ${recordedAmount(paid)} · ${paid.date}` : user.offlinePaymentApproved && type === user.membershipType ? 'אישור חריג — ללא תשלום מתועד למסלול זה' : 'לא תועד תשלום שהושלם למסלול זה'}</p>
        <p>תוקף מתועד למסלול: <span dir="ltr">{validReminderDate(expiry) ? expiry : 'לא תועד'}</span></p>
        {paid && <p>אמצעי תשלום: {paid.provider === 'MANUAL' ? 'מזומן/העברה — דיווח ידני של המנהל' : paid.paymentMethod || 'לא תועד'}</p>}
        {paid && <p>קוד הנחה: {code === undefined ? 'לא תועד בעסקה זו' : code || 'ללא קוד'}</p>}
        {pending && <p>קיימת גם בקשת תשלום ממתינה — אינה הוכחת חיוב.</p>}
        {refunded && <p>קיים תיעוד החזר למסלול — פרטים בניהול תשלומים.</p>}
        {hasBalance && <p>יתרת כניסות מתועדת: {typeof balance === 'number' && Number.isFinite(balance) && balance >= 0 ? balance : 'לא תועדה יתרה תקינה — נדרשת בדיקה'}</p>}
      </div>;
    })}
    {user.offlinePaymentApproved && <p>אישור ידני למנוי הנוכחי: {currentLabel}. האישור כשלעצמו אינו מתעד סכום ששולם.</p>}
    {!own.length && !family.length && <p>אין תשלום אמיתי מתועד (שאינו ממתין או מוחזר){user.offlinePaymentApproved ? ' — קיים אישור ידני, ללא סכום מתועד' : ''}.</p>}
    {(own.length > 0 || family.length > 0) && <details className="rounded-lg border border-slate-600 p-2"><summary className="cursor-pointer font-bold">היסטוריית תשלומים מתועדים — אינה קובעת את המסלול הנוכחי</summary>
    {[...own.map(payment => ({ payment, family: false })), ...family.map(payment => ({ payment, family: true }))].sort((a, b) => String(b.payment.timestamp || b.payment.date).localeCompare(String(a.payment.timestamp || a.payment.date))).slice(0, 3).map(({ payment, family }) => {
      const code = recordedDiscount(payment, discounts);
      const familyTransaction = family || payment.membershipTypePurchased === MembershipType.FAMILY_MEMBERSHIP || (payment.familyMemberPlans?.length || 0) > 1;
      return <div key={payment.id} className="rounded-lg border p-2"><strong>{familyTransaction ? 'עסקה משפחתית כוללת' : 'שולם בפועל'}: {recordedAmount(payment)}</strong><div>{plans.find(plan => plan.id === payment.membershipTypePurchased)?.label || MEMBERSHIP_TYPE_LABELS[payment.membershipTypePurchased]?.label || payment.membershipTypePurchased}</div><div>{payment.date}{family ? ` · משלם: ${payment.traineeName}` : ''}</div><div>קוד הנחה: {code === undefined ? 'לא תועד בעסקה זו' : code || 'ללא קוד'}</div></div>;
    })}
    {(own.length + family.length > 3) && <p>מוצגים 3 תשלומים אחרונים. ההיסטוריה המלאה בניהול תשלומים.</p>}
    </details>}
    {testPayments.length > 0 && <details className="rounded-lg border border-amber-700 p-2"><summary className="cursor-pointer">{testPayments.length} תשלומי בדיקה — לא כסף שהתקבל ולא הוכחת תשלום</summary>{testPayments.slice(0, 3).map(payment => <p key={payment.id}>בדיקה בלבד: ₪{payment.amount} · {plans.find(plan => plan.id === payment.membershipTypePurchased)?.label || MEMBERSHIP_TYPE_LABELS[payment.membershipTypePurchased]?.label || payment.membershipTypePurchased} · {payment.date}</p>)}</details>}
  </div>;
}
