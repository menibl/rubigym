/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  MANAGER = 'MANAGER',
  COACH = 'COACH',
  TRAINEE = 'TRAINEE'
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  ALL = 'ALL'
}

export enum MembershipType {
  OPEN_GYM = 'OPEN_GYM',
  NUTRITION_COACHING = 'NUTRITION_COACHING',
  WORKOUT_COACHING = 'WORKOUT_COACHING',
  OPEN_GYM_WITH_PLAN = 'OPEN_GYM_WITH_PLAN',
  CORE_GROUPS = 'CORE_GROUPS',
  DUO_TRAINING = 'DUO_TRAINING',
  YOUTH_TWICE_WEEKLY = 'YOUTH_TWICE_WEEKLY',
  YOUTH_ONCE_WEEKLY = 'YOUTH_ONCE_WEEKLY',
  DEDICATED_GROUP_HALF_YEAR = 'DEDICATED_GROUP_HALF_YEAR',
  FAMILY_MEMBERSHIP = 'FAMILY_MEMBERSHIP',
  // Legacy values are retained only so existing accounts can be migrated safely.
  GROUP_MONTHLY = 'GROUP_MONTHLY', // קבוצתי חודשי
  GROUP_ANNUAL = 'GROUP_ANNUAL', // קבוצתי שנתי
  OPEN_MONTHLY = 'OPEN_MONTHLY', // פתוח - חודשי (כולל תוכנית אימון)
  OPEN_ANNUAL = 'OPEN_ANNUAL', // פתוח - שנתי (כולל תוכנית אימון)
  OPEN_PUNCH_CARD = 'OPEN_PUNCH_CARD', // פתוח - כרטיסייה
  PERSONAL_TRAINING = 'PERSONAL_TRAINING', // אימון אישי
  NUTRITION_PLAN = 'NUTRITION_PLAN', // תוכנית תזונה
  WORKOUT_PLAN = 'WORKOUT_PLAN', // תוכנית אימון
  WEIGHT_LOSS_HALF_YEAR = 'WEIGHT_LOSS_HALF_YEAR',
  POSTPARTUM_HALF_YEAR = 'POSTPARTUM_HALF_YEAR'
}

export const MEMBERSHIP_TYPE_LABELS: Record<MembershipType, { label: string; badgeColor: string; description: string; includesWorkoutPlan?: boolean }> = {
  [MembershipType.OPEN_GYM]: {
    label: 'Open Gym',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'אימון עצמאי בשעות הפתוחות, בהשגחה'
  },
  [MembershipType.NUTRITION_COACHING]: {
    label: 'תוכנית תזונה + ליווי אישי',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'תוכנית תזונה אישית וליווי מקצועי'
  },
  [MembershipType.WORKOUT_COACHING]: {
    label: 'תוכנית אימון + ליווי אישי',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'תוכנית אימון אישית ומעקב אחת לחודשיים, ללא אימון חי',
    includesWorkoutPlan: true
  },
  [MembershipType.OPEN_GYM_WITH_PLAN]: {
    label: 'Open Gym + תוכנית',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'אימון חופשי + תוכנית אימון אישית',
    includesWorkoutPlan: true
  },
  [MembershipType.CORE_GROUPS]: {
    label: 'קבוצות (ליבה)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'קבוצות ללא הגבלה + גישה חופשית ל־Open Gym'
  },
  [MembershipType.DUO_TRAINING]: {
    label: 'אימון זוגי',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    description: 'אימון בודד או כרטיסיית 4, 8 או 12 אימונים זוגיים'
  },
  [MembershipType.YOUTH_TWICE_WEEKLY]: {
    label: 'נוער – פעמיים בשבוע',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'עד שני אימוני נוער בכל שבוע'
  },
  [MembershipType.YOUTH_ONCE_WEEKLY]: {
    label: 'נוער – פעם בשבוע',
    badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    description: 'עד אימון נוער אחד בכל שבוע'
  },
  [MembershipType.DEDICATED_GROUP_HALF_YEAR]: {
    label: 'קבוצה ייעודית – חצי שנתי',
    badgeColor: 'bg-lime-100 text-lime-800 border-lime-300',
    description: 'מסלול חצי שנתי לקבוצת מטרה ייעודית, בתשלום מראש'
  },
  [MembershipType.FAMILY_MEMBERSHIP]: {
    label: 'מנוי משפחתי',
    badgeColor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
    description: 'שנתי לפי כמות נפשות, חודשי לפי מתאמן או הרכב מסלולים מותאם בחיוב מאוחד'
  },
  [MembershipType.GROUP_MONTHLY]: {
    label: 'קבוצתי חודשי',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'קבוצות ללא הגבלה + Open Gym, בחיוב חודשי וללא התחייבות'
  },
  [MembershipType.GROUP_ANNUAL]: {
    label: 'קבוצתי שנתי',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'קבוצות ללא הגבלה + Open Gym, ₪500 בחודש בהוראת קבע ובהתחייבות ל־12 חודשים'
  },
  [MembershipType.OPEN_MONTHLY]: {
    label: 'פתוח - חודשי',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'גישה ל-Open Gym + תוכנית אימון מובנית מותאמת אישית',
    includesWorkoutPlan: true
  },
  [MembershipType.OPEN_ANNUAL]: {
    label: 'פתוח - שנתי',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'גישה שנתית ל-Open Gym + תוכנית אימון מובנית מותאמת אישית',
    includesWorkoutPlan: true
  },
  [MembershipType.OPEN_PUNCH_CARD]: {
    label: 'פתוח - כרטיסייה',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'כרטיסיית כניסות ל-Open Gym (לפי ניקוב)'
  },
  [MembershipType.PERSONAL_TRAINING]: {
    label: 'אימון אישי',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    description: 'אימון בודד או כרטיסיית 4, 8 או 12 אימונים אישיים'
  },
  [MembershipType.NUTRITION_PLAN]: {
    label: 'תוכנית תזונה',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'תוכנית תזונה וליווי תזונתי (ניתן לשלב במקביל)'
  },
  [MembershipType.WORKOUT_PLAN]: {
    label: 'תוכנית אימון',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'תוכנית אימונים אישית (כלול בפתוח חודשי/שנתי, או להוספה)'
  },
  [MembershipType.WEIGHT_LOSS_HALF_YEAR]: {
    label: 'קבוצת הרזיה – חצי שנתי',
    badgeColor: 'bg-lime-100 text-lime-800 border-lime-300',
    description: 'קבוצה ייעודית לתהליך הרזיה למשך שישה חודשים, בתשלום מלא מראש'
  },
  [MembershipType.POSTPARTUM_HALF_YEAR]: {
    label: 'נשים אחרי לידה – חצי שנתי',
    badgeColor: 'bg-pink-100 text-pink-800 border-pink-300',
    description: 'קבוצה ייעודית לנשים אחרי לידה למשך שישה חודשים, בתשלום מלא מראש'
  }
};

export const MEMBERSHIP_PRICES: Record<MembershipType, number> = {
  [MembershipType.OPEN_GYM]: 280,
  [MembershipType.NUTRITION_COACHING]: 350,
  [MembershipType.WORKOUT_COACHING]: 350,
  [MembershipType.OPEN_GYM_WITH_PLAN]: 450,
  [MembershipType.CORE_GROUPS]: 500,
  [MembershipType.DUO_TRAINING]: 350,
  [MembershipType.YOUTH_TWICE_WEEKLY]: 500,
  [MembershipType.YOUTH_ONCE_WEEKLY]: 300,
  [MembershipType.DEDICATED_GROUP_HALF_YEAR]: 3600,
  [MembershipType.FAMILY_MEMBERSHIP]: 900,
  [MembershipType.GROUP_MONTHLY]: 600,
  [MembershipType.GROUP_ANNUAL]: 500,
  [MembershipType.OPEN_MONTHLY]: 300,
  [MembershipType.OPEN_ANNUAL]: 250,
  [MembershipType.OPEN_PUNCH_CARD]: 400,
  [MembershipType.PERSONAL_TRAINING]: 200,
  [MembershipType.NUTRITION_PLAN]: 200,
  [MembershipType.WORKOUT_PLAN]: 150,
  [MembershipType.WEIGHT_LOSS_HALF_YEAR]: 1800,
  [MembershipType.POSTPARTUM_HALF_YEAR]: 1800
};

export const CURRENT_PRIMARY_MEMBERSHIP_PLANS: MembershipType[] = [
  MembershipType.OPEN_GYM,
  MembershipType.GROUP_MONTHLY,
  MembershipType.GROUP_ANNUAL,
  MembershipType.YOUTH_TWICE_WEEKLY,
  MembershipType.YOUTH_ONCE_WEEKLY,
  MembershipType.DEDICATED_GROUP_HALF_YEAR
];

export const CURRENT_MEMBERSHIP_ADD_ONS: MembershipType[] = [
  MembershipType.NUTRITION_COACHING,
  MembershipType.WORKOUT_COACHING,
  MembershipType.PERSONAL_TRAINING,
  MembershipType.DUO_TRAINING
];

export const CURRENT_MEMBERSHIP_CATALOG: MembershipType[] = [
  ...CURRENT_PRIMARY_MEMBERSHIP_PLANS,
  ...CURRENT_MEMBERSHIP_ADD_ONS,
  MembershipType.FAMILY_MEMBERSHIP
];

export interface MembershipPlanConfig {
  id: string;
  label: string;
  description: string;
  price: number;
  category: 'PRIMARY' | 'ADD_ON';
  active: boolean;
  priceUnit?: 'MONTH' | 'SESSION' | 'ONE_TIME';
  supportsTrainingCard?: boolean;
}

export const DEFAULT_MEMBERSHIP_PLAN_CONFIGS: MembershipPlanConfig[] = [
  ...CURRENT_PRIMARY_MEMBERSHIP_PLANS.map(id => ({
    id,
    label: MEMBERSHIP_TYPE_LABELS[id].label,
    description: MEMBERSHIP_TYPE_LABELS[id].description,
    price: MEMBERSHIP_PRICES[id],
    category: 'PRIMARY' as const,
    active: true,
    priceUnit: ([MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL].includes(id) ? 'MONTH' : 'ONE_TIME') as MembershipPlanConfig['priceUnit']
  })),
  ...CURRENT_MEMBERSHIP_ADD_ONS.map(id => ({
    id,
    label: MEMBERSHIP_TYPE_LABELS[id].label,
    description: MEMBERSHIP_TYPE_LABELS[id].description,
    price: MEMBERSHIP_PRICES[id],
    category: 'ADD_ON' as const,
    active: true,
    priceUnit: ([MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING].includes(id) ? 'SESSION' : 'ONE_TIME') as MembershipPlanConfig['priceUnit'],
    supportsTrainingCard: [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING].includes(id)
  }))
];

export const FAMILY_MEMBERSHIP_PRICES: Record<number, number> = {
  2: 900,
  3: 1350,
  4: 1800,
  5: 2250,
  6: 2700
};

export type FamilyBillingMode = 'ANNUAL_BY_SIZE' | 'MONTHLY_PER_MEMBER' | 'CUSTOM_COMBINED';

export interface FamilyMemberPlanSelection {
  memberId?: string;
  memberName: string;
  membershipType: MembershipType;
  trainingSessionsCount?: number;
}

export const TRAINING_CARD_SIZES = [1, 4, 8, 12] as const;
export type TrainingCardSize = typeof TRAINING_CARD_SIZES[number];
export type PaymentPurchaseVariant = 'PERSONAL_1' | 'PERSONAL_4' | 'PERSONAL_8' | 'PERSONAL_12' | 'DUO_1' | 'DUO_4' | 'DUO_8' | 'DUO_12';

export interface DiscountCode {
  id: string;
  code: string; // e.g. "RUBI20", "SPECIAL10"
  discountPercent: number; // e.g. 20 for 20%
  discountAmount?: number; // e.g. 50 ILS
  isSingleUse: boolean;
  isUsed?: boolean;
  createdBy: string;
  createdAt: string;
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE', // פעיל
  DEBT = 'DEBT', // חוב
  EXPIRED = 'EXPIRED' // פג תוקף
}

export enum MuscleGroup {
  UPPER = 'UPPER', // פלג גוף עליון
  LEGS = 'LEGS', // רגליים
  BACK = 'BACK', // גב
  SHOULDERS = 'SHOULDERS', // כתפיים
  CORE = 'CORE', // בטן וליבה
  FUNCTIONAL = 'FUNCTIONAL' // אימון פונקציונלי
}

export interface HealthDeclarationRecord {
  id: string;
  signedAt: string;
  validUntil: string;
  signed: boolean;
  answers?: Record<string, 'YES' | 'NO'>;
  requiresMedicalCertificate?: boolean;
  medicalCertificateApproved?: boolean;
  parentConsent?: boolean;
  parentName?: string;
  parentIdNumber?: string;
  signatureName?: string;
  signatureUrl?: string;
  medicalCertificateFileName?: string;
  medicalCertificateDataUrl?: string;
}

export interface User {
  id: string;
  name: string;
  username?: string; // שם משתמש
  password?: string; // סיסמה
  email: string;
  phone: string;
  role: UserRole;
  gender: Gender;
  age: number;
  birthDate?: string; // YYYY-MM-DD תאריך לידה
  
  // Health declaration (הצהרת בריאות)
  healthDeclarationSigned?: boolean;
  healthDeclarationSignatureUrl?: string;
  healthDeclarationDate?: string;
  healthDeclarationAnswers?: Record<string, 'YES' | 'NO'>;
  healthDeclarationRequiresMedicalCertificate?: boolean;
  healthDeclarationMedicalCertificateApproved?: boolean;
  healthDeclarationParentConsent?: boolean;
  healthDeclarationParentName?: string;
  healthDeclarationParentIdNumber?: string;
  healthDeclarationSignatureName?: string;
  healthDeclarationMedicalCertificateFileName?: string;
  healthDeclarationMedicalCertificateDataUrl?: string;
  healthDeclarationHistory?: HealthDeclarationRecord[];
  clubAgreementSigned?: boolean;
  clubAgreementDate?: string;

  // Notification preferences
  pushNotificationsEnabled?: boolean;
  workoutRemindersEnabled?: boolean;
  managerPushNotificationsEnabled?: boolean;
  staffAlertAcknowledgements?: string[]; // Alert ids acknowledged by this coach or manager
  
  // Trainee fields
  membershipType?: MembershipType;
  secondaryMemberships?: MembershipType[]; // Multiple active subscriptions (e.g. Group + Personal + Punch card)
  membershipStatus?: MembershipStatus;
  membershipExpiry?: string; // ISO date string
  membershipStartedAt?: string;
  membershipCommitmentEndsAt?: string;
  recurringBillingMonths?: number;
  monthlyBillingDay?: number;
  punchCardRemaining?: number; // for punch card membership
  personalTrainingCardSize?: TrainingCardSize;
  personalTrainingRemaining?: number;
  duoTrainingCardSize?: TrainingCardSize;
  duoTrainingRemaining?: number;
  priorityScore: number; // 0 to 100, drops when trainee accumulates too many black points

  // Family Membership fields (מנוי משפחתי)
  familyId?: string; // Shared family account identifier
  familyName?: string; // e.g., "משפחת כהן"
  isFamilyPayer?: boolean; // True if this user handles billing for all family members
  familyPayerId?: string; // Reference to the paying user ID in the family
  familyMembersCount?: number; // Total members allowed in family package (e.g. 4)
  familyTrackName?: string; // e.g. "מסלול משפחתי 4 מנויים"
  familyBillingMode?: FamilyBillingMode;
  familyMemberPlans?: FamilyMemberPlanSelection[];
  familyCombinedAmount?: number;

  // Personal Training & Membership configuration fields
  personalTrainingRate?: number; // Per-session cost set by coach (e.g. 150 ILS)
  personalSessionsCountThisMonth?: number; // Count of PT sessions for settlement on the 1st
  allowMultipleTraineesInPT?: boolean; // Coach approval for >1 trainee in PT session
  openGymMonthlyLimit?: number; // Registration limit for Open Gym defined by coach/manager
  offlinePaymentApproved?: boolean; // Exception override by manager for manual payment
  offlinePaymentNote?: string;

  // Workout & Nutrition requests
  requestedWorkoutPlan?: boolean; // Trainee requested custom workout program
  nutritionPlanPaid?: boolean; // Trainee paid for nutrition coaching (350 ILS)

  // Annual & Monthly membership commitment options
  isMembershipFrozen?: boolean; // Frozen for up to 1 month
  membershipFreezeStartedAt?: string;
  membershipFreezeUsedAt?: string;
  membershipFrozenUntil?: string; // ISO date string
  isCancelledEarly?: boolean; // Annual subscription cancelled early
  cancellationPenaltyPaid?: boolean; // 500 ILS penalty fee paid for early cancellation
  cancellationRequestedAt?: string;
  cancellationEffectiveDate?: string;

  // Custom metadata
  imageUrl?: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  coachId: string;
  coachName: string;
  muscleGroup: MuscleGroup;
  maxParticipants: number;
  ageMin?: number;
  ageMax?: number;
  genderRestriction: Gender;
  allowedMemberships: MembershipType[];
  registeredUsers: string[]; // List of user IDs
  waitlistUsers: string[]; // List of user IDs (automatic queue)
  /** Persisted link to the exact personal program assigned to this calendar event. */
  assignedWorkoutPlanId?: string;
  /** Persisted link to the exact group program assigned to this calendar event. */
  assignedGroupWorkoutProgramId?: string;

  // Personal Training specifics
  isPersonalTraining?: boolean;
  targetTraineeId?: string; // Main trainee for PT
  isDemoSession?: boolean; // Personal demo for a prospect who is not registered yet
  demoTraineeName?: string;
  coTrainees?: string[]; // Additional trainees approved by coach
  pricePerSession?: number;
  coachApprovalStatus?: 'PENDING' | 'APPROVED' | 'DECLINED';

  // Recurrence settings
  recurringType?: 'NONE' | 'WEEKLY_UNLIMITED' | 'WEEKLY_UNTIL_DATE';
  recurringUntilDate?: string; // YYYY-MM-DD
  seriesId?: string;
  excludedDates?: string[]; // YYYY-MM-DD dates to skip in recurring series
}

export interface OpenGymSession {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "14:00 - 16:00"
  maxParticipants: number;
  registeredUsers: string[];
  waitlistUsers: string[];

  // Recurrence settings
  recurringType?: 'NONE' | 'WEEKLY_UNLIMITED' | 'WEEKLY_UNTIL_DATE';
  recurringUntilDate?: string; // YYYY-MM-DD
  seriesId?: string;
  excludedDates?: string[]; // YYYY-MM-DD dates to skip in recurring series
}

export interface Exercise {
  id: string;
  name: string;
  category: string; // e.g., "כוח", "אירובי", "גמישות", "מתיחות"
  muscleGroup: MuscleGroup;
  sets: number;
  reps: string; // e.g., "12", "8-10", "1 min"
  weight?: string; // e.g., "15kg", "משקל גוף"
  workDuration?: string; // e.g., "45 sec"
  restDuration?: string; // e.g., "60 sec"
  mediaUrl?: string; // optional demonstration video link
  mediaType?: 'IMAGE' | 'GIF' | 'VIDEO';
  mediaStorageId?: string; // identifier of uploaded exercise media
  notes?: string;
  dayNumber?: number; // 1-based training day within a weekly personal plan
  stationNumber?: number; // 1-based subgroup/station within a structured personal workout
}

export interface WorkoutPlan {
  id: string;
  traineeId: string;
  title?: string;
  sessionId?: string;
  sourcePlanId?: string;
  coachId: string;
  coachName: string;
  lastUpdated: string; // YYYY-MM-DD
  exercises: Exercise[];
  trainingDaysPerWeek?: number;
  dayLabels?: string[];
  effortMetric?: 'TIME' | 'REPS';
  defaultWorkSeconds?: number;
  defaultRestSeconds?: number;
  defaultRepetitions?: string;
  mode?: 'LINEAR' | 'ROTATING_GROUPS';
  subgroupCount?: number;
  exerciseCount?: number;
  roundsPerStation?: number;
  transitionSeconds?: number;
  trainingType?: string;
  plannedDurationMinutes?: number;
  status?: 'REQUIRED_OPEN_GYM' | 'REQUESTED_BY_TRAINEE' | 'APPROVED_ASSIGNED';
  isRequested?: boolean;
  /** Saved immutable-ish version for reuse. Active trainee plans keep this false/undefined. */
  libraryEntry?: boolean;
  libraryCreatedAt?: string;
}

export type TraineeExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type TraineeMemoryCategory = 'GOAL' | 'LIMITATION' | 'PREFERENCE' | 'PROGRESS' | 'COACH_NOTE';
export type TraineeMemoryVisibility = 'TEAM' | 'PRIVATE_COACH';

export interface TraineeProfessionalProfile {
  traineeId: string;
  primaryGoal: string;
  secondaryGoals: string;
  experienceLevel: TraineeExperienceLevel;
  weeklySessions: number;
  preferredWorkoutMinutes: number;
  limitations: string;
  painAreas: string;
  prohibitedExercises: string;
  preferredExercises: string;
  equipmentPreferences: string;
  coachSummary: string;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
}

export interface TraineeMemoryEntry {
  id: string;
  traineeId: string;
  category: TraineeMemoryCategory;
  content: string;
  visibility: TraineeMemoryVisibility;
  confirmed: boolean;
  createdAt: string;
  createdById: string;
  createdByName: string;
}

export type GymEquipmentStatus = 'AVAILABLE' | 'LIMITED' | 'OUT_OF_SERVICE';

export interface GymEquipment {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  muscleGroups: MuscleGroup[];
  quantity: number;
  location: string;
  status: GymEquipmentStatus;
  notes: string;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
}

export type CoachPdfVisibility = 'TEAM' | 'PRIVATE_COACH';
export type CoachPdfStatus = 'PROCESSING' | 'READY' | 'NEEDS_OCR' | 'ERROR';

export interface PdfPageContent {
  pageNumber: number;
  text: string;
}

export interface CoachPdfDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  category: string;
  description: string;
  tags: string[];
  visibility: CoachPdfVisibility;
  status: CoachPdfStatus;
  extractedCharacterCount: number;
  uploadedAt: string;
  uploadedById: string;
  uploadedByName: string;
  errorMessage?: string;
}

export interface WorkoutAssistantMessage {
  id: string;
  traineeId: string;
  coachId: string;
  coachName: string;
  role: 'COACH' | 'ASSISTANT';
  content: string;
  createdAt: string;
  sourceDocumentIds?: string[];
}

export interface WorkoutAssistantDraft {
  id: string;
  traineeId: string;
  coachId: string;
  coachName: string;
  objective: string;
  coachNotes: string;
  exercises: Exercise[];
  trainingDaysPerWeek?: number;
  dayLabels?: string[];
  effortMetric?: 'TIME' | 'REPS';
  defaultWorkSeconds?: number;
  defaultRestSeconds?: number;
  defaultRepetitions?: string;
  mode?: 'LINEAR' | 'ROTATING_GROUPS';
  subgroupCount?: number;
  exerciseCount?: number;
  roundsPerStation?: number;
  transitionSeconds?: number;
  trainingType?: string;
  plannedDurationMinutes?: number;
  sourceDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'PUBLISHED';
}

export interface GroupWorkoutExercise extends Exercise {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

export interface GroupWorkoutStation {
  id: string;
  name: string;
  exercises: GroupWorkoutExercise[];
}

export interface GroupWorkoutParticipant {
  id: string;
  name: string;
  groupIndex: number;
}

export interface GroupWorkoutProgram {
  id: string;
  sessionId?: string;
  sessionDate?: string;
  sessionTime?: string;
  groupName: string;
  title: string;
  description: string;
  coachId: string;
  coachName: string;
  exercises: GroupWorkoutExercise[];
  mode?: 'LINEAR' | 'ROTATING_GROUPS';
  participantCount?: number;
  participantGroupNames?: string[];
  participants?: GroupWorkoutParticipant[];
  stations?: GroupWorkoutStation[];
  roundsPerStation?: number;
  transitionSeconds?: number;
  defaultWorkSeconds: number;
  defaultRestSeconds: number;
  effortMetric?: 'TIME' | 'REPS';
  defaultRepetitions?: string;
  preparationSeconds: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  /** Identifies an automatically saved reusable version. */
  libraryEntry?: boolean;
  sourceProgramId?: string;
  /** Server-issued value that changes on every broadcast to the club screen. */
  displayRevision?: string;
  displayActivation?: 'MANUAL' | 'SCHEDULED';
  displayActivatedMinute?: number;
}

export interface NutritionPlan {
  id: string;
  traineeId: string;
  coachId: string;
  coachName: string;
  lastUpdated: string; // YYYY-MM-DD
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  mealsDescription: string; // Multi-line plan
  goal?: string;
  hydrationLiters?: number;
  fiberGrams?: number;
  categories?: NutritionMealCategory[];
  coachNotes?: string;
  assistantMessages?: NutritionAssistantMessage[];
  active: boolean;
  isPaid?: boolean; // Paid individual fee
  price?: number; // Fee amount (currently 350 ILS for nutrition coaching)
  paymentStatus?: 'UNPAID' | 'PAID' | 'WAIVED';
  title?: string;
  sourcePlanId?: string;
  libraryEntry?: boolean;
  libraryCreatedAt?: string;
}

export interface NutritionMealCategory {
  id: string;
  title: string;
  suggestedTime?: string;
  foods: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  notes?: string;
}

export interface NutritionAssistantMessage {
  id: string;
  role: 'COACH' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface BlackPoint {
  id: string;
  traineeId: string;
  traineeName: string;
  sessionId?: string; // optional if issued for custom reason or Open Gym
  sessionTitle: string; // session name or "Open Gym"
  sessionDate: string;
  issuedDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD (typically 1 month from issued)
  status: 'ACTIVE' | 'CLEARED' | 'EXPIRED';
  reason: string;
  clearedBy?: string; // Name of Admin/Coach who cleared it
  clearReason?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  receiverId: string;
  content: string;
  timestamp: string; // ISO string
  read: boolean;
  systemGenerated?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdBy: string; // User Name
  creatorRole: UserRole.MANAGER | UserRole.COACH;
  date: string; // YYYY-MM-DD
  
  // Target Audience filters
  targetGender: Gender;
  targetMembershipTypes?: MembershipType[];
  targetAgeMin?: number;
  targetAgeMax?: number;
}

export interface Payment {
  id: string;
  traineeId: string;
  traineeName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  timestamp?: string; // ISO timestamp used for real-time staff alerts
  status: 'PAID' | 'REFUNDED' | 'PENDING';
  membershipTypePurchased: MembershipType;
  paymentMethod: string;
  isMock: boolean;
}

export interface AttendanceLog {
  id: string;
  traineeId: string;
  traineeName: string;
  type: 'SESSION' | 'OPEN_GYM';
  targetId: string; // Session ID or Open Gym Session ID
  targetTitle: string; // "אינטרוולים פונקציונליים" or "Open Gym 12:00"
  timestamp: string; // ISO string or HH:MM
  date: string; // YYYY-MM-DD
}

export interface SystemSettings {
  cancellationWindowHours: number; // default: 2 hours, unified for all workout types
  maxBlackPointsBeforePriorityDrop: number; // default: 3 points
  blackPointExpiryMonths: number; // default: 1 month
  openGymMaxParticipants: number; // default: 15
  membershipPlans?: MembershipPlanConfig[];
}
