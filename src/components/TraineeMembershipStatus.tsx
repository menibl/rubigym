import React from 'react';
import { clubDate, membershipExpired } from '../../shared/membership-calendar.js';
import { validReminderDate } from '../../shared/payment-reminder-policy.js';
import { type User, MembershipStatus } from '../types';

export function membershipStatusLabel(user: User, today = clubDate()) {
  if (user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today) return 'המנוי בוטל';
  if (user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today)) return 'המנוי מוקפא';
  if (user.registrationIncomplete) return 'בתהליך הרשמה — חסרים פרטים';
  const recurring = user.recurringMemberships?.[user.membershipType];
  if (recurring?.status === 'PAYMENT_FAILED') return 'המסלול הראשי הושהה — כשל חיוב מאומת';
  if (recurring?.status === 'PENDING_FIRST_CHARGE' && recurring.endsAt > today) return 'מנוי פעיל — ממתין לאישור החיוב הראשון';
  if (!validReminderDate(user.membershipExpiry)) return 'תוקף מנוי לא הוגדר';
  if (membershipExpired(user, today) || user.membershipStatus === MembershipStatus.EXPIRED) return 'תוקף המנוי פג';
  if (user.offlinePaymentApproved) return 'אישור חריג מנהל — בתוקף';
  if (user.registrationPaymentPending || user.familyPaymentPending || user.membershipStatus === MembershipStatus.DEBT) return 'ממתין להסדרת תשלום';
  return user.membershipStatus === MembershipStatus.ACTIVE ? 'מנוי פעיל לפי הגדרת המערכת' : 'סטטוס מנוי לא הוגדר';
}

export function TraineeMembershipStatus({ user }: { user: User }) {
  const label = membershipStatusLabel(user);
  const contract = user.recurringMemberships?.[user.membershipType];
  const expiry = contract && contract.status !== 'PAYMENT_FAILED' ? contract.endsAt : validReminderDate(user.membershipExpiry) ? user.membershipExpiry : null;
  return <div className="space-y-1 text-xs leading-5" aria-label={`מצב המנוי של ${user.name}`}>
    <p className="font-bold">{label}</p>
    <p>{contract ? 'תוקף התקשרות הוראת הקבע' : 'תוקף המנוי'}: <span dir="ltr">{expiry || 'לא הוגדר'}</span>{expiry && user.membershipExpiryExclusive ? ' (מסתיים בתחילת התאריך)' : ''}</p>
    {user.membershipExpiryManualOverride && <p>התוקף נערך ידנית על ידי המנהל — אינו הוכחת תשלום.</p>}
    {user.offlinePaymentApproved && <p className="font-bold text-amber-200">אישור חריג מנהל — אינו מעיד כשלעצמו על תשלום במזומן או באשראי.</p>}
    {(user.registrationPaymentPending || user.familyPaymentPending) && !user.offlinePaymentApproved && <p>ממתין להשלמת תשלום</p>}
    {user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= clubDate()) && <p>הקפאה עד: {user.membershipFrozenUntil || 'ללא תאריך סיום מוגדר'}</p>}
    {user.paymentReminderExempt && <p>לא משלם — תזכורות תשלום כבויות (לא מעניק גישה למועדון)</p>}
  </div>;
}
