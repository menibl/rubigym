// Profile completion is independent of paid access. Never grant entitlements here.
export const paymentPending = user => Boolean(!user.offlinePaymentApproved && (user.registrationPaymentPending || user.familyPaymentPending));

// Only staff payment actions may clear these flags; never clear profile/health flags.
export const clearManualPaymentPending = user => ({ ...user, registrationPaymentPending: false, familyPaymentPending: false,
  offlinePaymentPendingSnapshot: undefined });

export const approveOfflinePayment = user => ({ ...clearManualPaymentPending(user),
  offlinePaymentPendingSnapshot: user.offlinePaymentPendingSnapshot || {
    registrationPaymentPending: Boolean(user.registrationPaymentPending), familyPaymentPending: Boolean(user.familyPaymentPending), membershipStatus: user.membershipStatus
  },
  offlinePaymentApproved: true, membershipStatus: 'ACTIVE',
  offlinePaymentNote: 'אושר ידנית במזומן/העברה ע"י המנהל' });

export const revokeOfflinePayment = user => ({ ...user, ...(user.offlinePaymentPendingSnapshot || {}),
  offlinePaymentApproved: false, offlinePaymentNote: undefined, offlinePaymentPendingSnapshot: undefined });

export const unpaidRegistration = user => ({
  ...user,
  registrationIncomplete: false,
  registrationCompletedAt: user.registrationCompletedAt || new Date().toISOString(),
  registrationPaymentPending: true,
  membershipStatus: 'DEBT',
  membershipExpiry: undefined,
  secondaryMemberships: [],
  personalTrainingRemaining: 0,
  duoTrainingRemaining: 0,
  nutritionPlanPaid: false,
  requestedWorkoutPlan: false,
  offlinePaymentApproved: false,
  ...(user.familyId ? { familyPaymentPending: true } : {})
});

export const completedLegacyRegistration = user => Boolean(user.registrationIncomplete
  && user.name && user.name !== 'הרשמה בתהליך'
  && user.username && !user.username.startsWith('registration-')
  && user.email && user.birthDate && user.clubAgreementSigned);
