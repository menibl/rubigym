import React from 'react';
import { DiscountCode, Payment, User, MembershipPlanConfig, MembershipType, MEMBERSHIP_TYPE_LABELS } from '../types';
import { recordedDiscount, traineePayments } from '../../shared/admin-trainees.js';

export function TraineePaymentSummary({ user, payments, discounts, plans }: { user: User; payments: Payment[]; discounts: DiscountCode[]; plans: MembershipPlanConfig[] }) {
  const allOwn = traineePayments(payments, user.id).filter(payment => payment.status === 'PAID');
  const own = allOwn.filter(payment => !payment.isMock);
  const family = user.familyPayerId && user.familyPayerId !== user.id
    ? traineePayments(payments, user.familyPayerId).filter(payment => !payment.isMock && payment.status === 'PAID' && payment.familyMemberPlans?.some(plan => plan.memberId === user.id && (!plan.participation || plan.participation === 'INCLUDED'))) : [];
  const testPayments = allOwn.filter(payment => payment.isMock);
  const currentLabel = plans.find(plan => plan.id === user.membershipType)?.label || MEMBERSHIP_TYPE_LABELS[user.membershipType]?.label || user.membershipType;
  return <div className="mt-2 space-y-2 text-xs leading-5">
    {user.offlinePaymentApproved && <p>אישור ידני למנוי הנוכחי: {currentLabel}. האישור כשלעצמו אינו מתעד סכום ששולם.</p>}
    {!own.length && !family.length && <p>אין תשלום אמיתי מתועד (שאינו ממתין או מוחזר){user.offlinePaymentApproved ? ' — קיים אישור ידני, ללא סכום מתועד' : ''}.</p>}
    {(own.length > 0 || family.length > 0) && <p className="font-bold">היסטוריית תשלומים מתועדים — אינה קובעת את המסלול הנוכחי</p>}
    {[...own.map(payment => ({ payment, family: false })), ...family.map(payment => ({ payment, family: true }))].slice(0, 3).map(({ payment, family }) => {
      const code = recordedDiscount(payment, discounts);
      const familyTransaction = family || payment.membershipTypePurchased === MembershipType.FAMILY_MEMBERSHIP || (payment.familyMemberPlans?.length || 0) > 1;
      return <div key={payment.id} className="rounded-lg border p-2"><strong>{familyTransaction ? 'עסקה משפחתית כוללת' : 'שולם בפועל'}: ₪{Number(payment.amount).toLocaleString('he-IL')}</strong><div>{plans.find(plan => plan.id === payment.membershipTypePurchased)?.label || MEMBERSHIP_TYPE_LABELS[payment.membershipTypePurchased]?.label || payment.membershipTypePurchased}</div><div>{payment.date}{payment.isMock ? ' · תשלום בדיקה' : ''}{family ? ` · משלם: ${payment.traineeName}` : ''}</div><div>קוד הנחה: {code === undefined ? 'לא תועד בעסקה זו' : code || 'ללא קוד'}</div></div>;
    })}
    {(own.length + family.length > 3) && <p>מוצגים 3 תשלומים אחרונים. ההיסטוריה המלאה בניהול תשלומים.</p>}
    {testPayments.length > 0 && <details className="rounded-lg border border-amber-700 p-2"><summary className="cursor-pointer">{testPayments.length} תשלומי בדיקה — לא כסף שהתקבל ולא הוכחת תשלום</summary>{testPayments.slice(0, 3).map(payment => <p key={payment.id}>בדיקה בלבד: ₪{payment.amount} · {plans.find(plan => plan.id === payment.membershipTypePurchased)?.label || MEMBERSHIP_TYPE_LABELS[payment.membershipTypePurchased]?.label || payment.membershipTypePurchased} · {payment.date}</p>)}</details>}
  </div>;
}
