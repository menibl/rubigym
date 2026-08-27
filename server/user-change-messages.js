const membershipLabels = {
  OPEN_GYM: 'Open Gym', GROUP_MONTHLY: 'קבוצתי חודשי', GROUP_ANNUAL: 'קבוצתי שנתי',
  CORE_GROUPS: 'קבוצות', YOUTH_TWICE_WEEKLY: 'נוער פעמיים בשבוע', YOUTH_ONCE_WEEKLY: 'נוער פעם בשבוע',
  DEDICATED_GROUP_HALF_YEAR: 'קבוצה ייעודית', FAMILY_MEMBERSHIP: 'משפחתי',
  NUTRITION_COACHING: 'תוכנית תזונה וליווי', NUTRITION_PLAN: 'תוכנית תזונה', WORKOUT_PLAN: 'תוכנית אימון',
  PERSONAL_TRAINING: 'אימון אישי', DUO_TRAINING: 'אימון זוגי'
};

const sameValue = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const membershipName = value => membershipLabels[value] || String(value || 'ללא מסלול');
const changed = (before, after, fields) => fields.some(field => !sameValue(before?.[field], after?.[field]));

const describeUserChanges = (before, after) => {
  const descriptions = [];
  if (!sameValue(before.membershipType, after.membershipType)) descriptions.push(`המסלול השתנה מ־${membershipName(before.membershipType)} ל־${membershipName(after.membershipType)}`);
  if (changed(before, after, ['secondaryMemberships', 'requestedWorkoutPlan', 'nutritionPlanPaid'])) descriptions.push('שירותים ותוכניות עודכנו');
  if (changed(before, after, ['membershipStatus', 'membershipExpiry', 'membershipStartedAt', 'membershipCommitmentEndsAt', 'recurringBillingMonths', 'monthlyBillingDay', 'isMembershipFrozen', 'membershipFreezeStartedAt', 'membershipFreezeUsedAt', 'membershipFrozenUntil', 'isCancelledEarly', 'cancellationPenaltyPaid', 'cancellationRequestedAt', 'cancellationEffectiveDate'])) descriptions.push('סטטוס המנוי, תוקף, הקפאה או ביטול עודכנו');
  if (changed(before, after, ['punchCardRemaining', 'personalTrainingCardSize', 'personalTrainingRemaining', 'duoTrainingCardSize', 'duoTrainingRemaining', 'openGymMonthlyLimit', 'offlinePaymentApproved', 'offlinePaymentNote'])) descriptions.push('כרטיסיית האימונים, יתרת האימונים או אישור התשלום עודכנו');
  if (changed(before, after, ['name', 'username', 'email', 'phone', 'gender', 'age', 'birthDate'])) descriptions.push('הפרטים האישיים או פרטי ההתחברות עודכנו');
  if (!sameValue(before.imageUrl, after.imageUrl)) descriptions.push('תמונת הפרופיל עודכנה');
  if (changed(before, after, ['healthDeclarationSigned', 'healthDeclarationSignatureUrl', 'healthDeclarationDate', 'healthDeclarationAnswers', 'healthDeclarationRequiresMedicalCertificate', 'healthDeclarationMedicalCertificateApproved', 'healthDeclarationParentConsent', 'healthDeclarationParentName', 'healthDeclarationParentIdNumber', 'healthDeclarationSignatureName', 'healthDeclarationMedicalCertificateFileName', 'healthDeclarationMedicalCertificateDataUrl', 'healthDeclarationHistory'])) descriptions.push('הצהרת הבריאות או האישור הרפואי עודכנו');
  if (changed(before, after, ['clubAgreementSigned', 'clubAgreementDate'])) descriptions.push('סטטוס החתימה על ההסכם עודכן');
  if (changed(before, after, ['familyId', 'familyName', 'familyPayerId', 'isFamilyPayer', 'familyMembersCount', 'familyTrackName', 'familyBillingMode', 'familyMemberPlans', 'familyCombinedAmount'])) descriptions.push('פרטי החשבון המשפחתי עודכנו');
  if (changed(before, after, ['pushNotificationsEnabled', 'workoutRemindersEnabled'])) descriptions.push('הגדרות ההתראות עודכנו');
  return descriptions;
};

const messageFor = (user, staff, content, timestamp, sequence) => ({
  id: `msg-user-update-${user.id}-${staff.id}-${Date.parse(timestamp)}-${sequence}`,
  senderId: user.id, senderName: user.name, senderRole: 'TRAINEE', receiverId: staff.id,
  content, timestamp, read: false, systemGenerated: true
});

export const appendUserChangeMessages = (beforePayload = {}, afterPayload = {}, now = new Date()) => {
  const beforeUsers = Array.isArray(beforePayload.users) ? beforePayload.users : [];
  const afterUsers = Array.isArray(afterPayload.users) ? afterPayload.users : [];
  const staff = afterUsers.filter(user => ['MANAGER', 'COACH'].includes(user.role));
  if (!staff.length) return afterPayload;
  const beforeById = new Map(beforeUsers.map(user => [user.id, user]));
  const beforeProfiles = new Map((beforePayload.traineeProfiles || []).map(profile => [profile.traineeId, profile]));
  const afterProfiles = new Map((afterPayload.traineeProfiles || []).map(profile => [profile.traineeId, profile]));
  const timestamp = now.toISOString();
  const messages = [];
  let sequence = 0;
  for (const user of afterUsers.filter(candidate => candidate.role === 'TRAINEE')) {
    const previous = beforeById.get(user.id);
    let content = '';
    if (!previous) content = `עדכון מערכת: ${user.name} הצטרף/ה למועדון במסלול ${membershipName(user.membershipType)}.`;
    else {
      const descriptions = describeUserChanges(previous, user);
      if (!sameValue(beforeProfiles.get(user.id), afterProfiles.get(user.id))) descriptions.push('נתוני המתאמן, המטרות או המגבלות עודכנו');
      if (descriptions.length) content = `עדכון מערכת: בפרטי ${user.name} בוצע שינוי — ${descriptions.join(' · ')}.`;
    }
    if (!content) continue;
    for (const staffUser of staff) messages.push(messageFor(user, staffUser, content, timestamp, sequence++));
  }
  return messages.length ? { ...afterPayload, messages: [...messages, ...(afterPayload.messages || [])] } : afterPayload;
};
