import { clubDate } from './membership-calendar.js';

// An access exception is not a receipt. Only an explicitly confirmed amount
// may be recorded as an offline payment; never substitute a catalog price.
export function offlinePaymentRecord(user, amount, id, now = new Date()) {
  if (!user?.membershipType) throw new Error('יש לבחור מסלול למתאמן לפני רישום תשלום.');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001) throw new Error('יש להזין סכום תשלום תקין, עד שתי ספרות אחרי הנקודה.');
  return { id, traineeId: user.id, traineeName: user.name, amount, date: clubDate(now), timestamp: now.toISOString(),
    status: 'PAID', membershipTypePurchased: user.membershipType, provider: 'MANUAL', paymentMethod: 'מזומן/העברה — תועד ידנית על ידי המנהל', isMock: false };
}
