import React from 'react';
import { MembershipType, MEMBERSHIP_TYPE_LABELS, type Payment } from '../types';

const amount = (n?: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? `₪${n.toLocaleString('he-IL')}` : 'לא תועד';
const count = (n?: number) => Number.isInteger(n) && Number(n) > 0 ? n : 'לא תועדה';
const training = (type: string) => ['PERSONAL_TRAINING', 'DUO_TRAINING'].includes(type);

export function PaymentPurchaseDetails({ payment }: { payment: Payment }) {
  const snapshot = payment.purchaseBreakdown?.version === 1 && Array.isArray(payment.purchaseBreakdown.lines)
    && payment.purchaseBreakdown.lines.length <= 30
    && payment.purchaseBreakdown.lines.every(line => line && typeof line.membershipType === 'string') ? payment.purchaseBreakdown : undefined;
  const selected = payment.familyMemberPlans?.filter(member => !member.participation || member.participation === 'INCLUDED');
  const legacyLines = selected?.length ? selected.flatMap(member => [member, ...(member.additionalPlans || [])].map(plan => ({
    memberName: member.memberName, membershipType: plan.membershipType, quantity: training(plan.membershipType) ? plan.trainingSessionsCount : 1
  }))) : [{ memberName: payment.traineeName, membershipType: payment.membershipTypePurchased,
    quantity: training(payment.membershipTypePurchased) ? payment.sessionsPurchased : undefined }];
  const lines: NonNullable<Payment['purchaseBreakdown']>['lines'] = snapshot?.lines || legacyLines;
  const net = lines.every(line => typeof line.netAmount === 'number' && Number.isFinite(line.netAmount) && line.netAmount >= 0)
    ? Math.round(lines.reduce((sum, line) => sum + line.netAmount! * 100, 0)) / 100 : undefined;
  const mismatch = snapshot && (Math.round(snapshot.total * 100) !== Math.round(payment.amount * 100)
    || (net !== undefined && Math.round((net - (snapshot.creditAmount || 0)) * 100) !== Math.round(payment.amount * 100))
    || (typeof snapshot.subtotal === 'number' && typeof snapshot.discountAmount === 'number' && typeof snapshot.creditAmount === 'number'
      && Math.round((snapshot.subtotal - snapshot.discountAmount - snapshot.creditAmount) * 100) !== Math.round(payment.amount * 100)));
  return <details className="min-w-64 max-w-lg rounded-lg border border-slate-600 p-2 text-slate-200" dir="rtl">
    <summary className="min-h-11 cursor-pointer font-bold">פירוט הרכישה — {payment.traineeName}</summary>
    <div className="mt-2 space-y-3 text-xs leading-relaxed">
      <p>{snapshot ? 'מחירים שנשמרו בזמן הרכישה.' : 'פירוט היסטורי חלקי — מחירים חסרים אינם מחושבים לפי המחירון הנוכחי.'}</p>
      {lines.map((line, index) => <div key={index} className="rounded border border-slate-600 p-2">
        {line.memberName && <p className="font-bold">{line.memberName}</p>}
        <p className="font-bold">{line.label || MEMBERSHIP_TYPE_LABELS[line.membershipType as MembershipType]?.label || line.membershipType}</p>
        <p>{training(line.membershipType) ? 'כמות אימונים שנרכשה' : 'כמות יחידות'}: {count(line.quantity)}</p>
        <p>מחיר ליחידה לפני הנחה: {amount(line.unitPrice)}</p>
        <p>סכום שורה לפני הנחה: {amount(line.baseAmount)}</p>
        <p>הנחה בשורה: {amount(line.discountAmount)}</p>
        <p>סכום שורה לאחר הנחה: {amount(line.netAmount)}</p>
      </div>)}
      <div className="border-t border-slate-600 pt-2">
        <p>סך לפני הנחות: {amount(snapshot?.subtotal)}</p>
        <p>קוד הנחה: {payment.discountCode === null ? 'ללא קוד' : payment.discountCode || 'לא תועד'}</p>
        <p>סך הנחה: {amount(snapshot?.discountAmount ?? payment.discountAmount)}</p>
        <p>קיזוז תשלום קודם: {amount(snapshot?.creditAmount ?? payment.familyCreditAmount ?? payment.upgradeCreditAmount)}</p>
        <p className="font-bold">סכום העסקה המתועד: {amount(payment.amount)}</p>
        {payment.isMock && <p>עסקת בדיקה — אינה הוכחת תשלום אמיתי.</p>}
        {payment.status === 'REFUNDED' && <p>עסקה שהוחזרה — זה פירוט הרכישה המקורית.</p>}
        {payment.status === 'PENDING' && <p>ממתין לאישור — אינו תשלום שהושלם.</p>}
        {mismatch && <p role="alert" className="font-bold text-rose-300">הפירוט השמור אינו תואם לסכום העסקה. נדרשת בדיקה; אין להסתמך עליו כסיכום מאוזן.</p>}
        <p>כמויות הרכישה אינן יתרת האימונים הנוכחית. הנחה כוללת אינה מפוצלת בין שורות אם החלוקה לא תועדה.</p>
      </div>
    </div>
  </details>;
}
