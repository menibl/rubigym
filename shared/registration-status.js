// Profile completion is independent of paid access. Never grant entitlements here.
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
