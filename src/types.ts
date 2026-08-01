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
  GROUP_MONTHLY = 'GROUP_MONTHLY', // קבוצתי חודשי
  GROUP_ANNUAL = 'GROUP_ANNUAL', // קבוצתי שנתי
  OPEN_MONTHLY = 'OPEN_MONTHLY', // פתוח - חודשי (כולל תוכנית אימון)
  OPEN_ANNUAL = 'OPEN_ANNUAL', // פתוח - שנתי (כולל תוכנית אימון)
  OPEN_PUNCH_CARD = 'OPEN_PUNCH_CARD', // פתוח - כרטיסייה
  PERSONAL_TRAINING = 'PERSONAL_TRAINING', // אימון אישי
  NUTRITION_PLAN = 'NUTRITION_PLAN', // תוכנית תזונה
  WORKOUT_PLAN = 'WORKOUT_PLAN' // תוכנית אימון
}

export const MEMBERSHIP_TYPE_LABELS: Record<MembershipType, { label: string; badgeColor: string; description: string; includesWorkoutPlan?: boolean }> = {
  [MembershipType.GROUP_MONTHLY]: {
    label: 'קבוצתי חודשי',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'מנוי חודשי לאימונים קבוצתיים'
  },
  [MembershipType.GROUP_ANNUAL]: {
    label: 'קבוצתי שנתי',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'מנוי שנתי מוזל לאימונים קבוצתיים'
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
    description: 'אימונים אישיים 1-על-1 (ניתן לשלב במקביל עם כל מנוי)'
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
  }
};

export const MEMBERSHIP_PRICES: Record<MembershipType, number> = {
  [MembershipType.GROUP_MONTHLY]: 350,
  [MembershipType.GROUP_ANNUAL]: 290,
  [MembershipType.OPEN_MONTHLY]: 300,
  [MembershipType.OPEN_ANNUAL]: 250,
  [MembershipType.OPEN_PUNCH_CARD]: 400,
  [MembershipType.PERSONAL_TRAINING]: 450,
  [MembershipType.NUTRITION_PLAN]: 200,
  [MembershipType.WORKOUT_PLAN]: 150
};

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
  clubAgreementSigned?: boolean;
  clubAgreementDate?: string;

  // Notification preferences
  pushNotificationsEnabled?: boolean;
  workoutRemindersEnabled?: boolean;
  managerPushNotificationsEnabled?: boolean;
  
  // Trainee fields
  membershipType?: MembershipType;
  secondaryMemberships?: MembershipType[]; // Multiple active subscriptions (e.g. Group + Personal + Punch card)
  membershipStatus?: MembershipStatus;
  membershipExpiry?: string; // ISO date string
  punchCardRemaining?: number; // for punch card membership
  priorityScore: number; // 0 to 100, drops when trainee accumulates too many black points

  // Family Membership fields (מנוי משפחתי)
  familyId?: string; // Shared family account identifier
  familyName?: string; // e.g., "משפחת כהן"
  isFamilyPayer?: boolean; // True if this user handles billing for all family members
  familyPayerId?: string; // Reference to the paying user ID in the family
  familyMembersCount?: number; // Total members allowed in family package (e.g. 4)
  familyTrackName?: string; // e.g. "מסלול משפחתי 4 מנויים"

  // Personal Training & Membership configuration fields
  personalTrainingRate?: number; // Per-session cost set by coach (e.g. 150 ILS)
  personalSessionsCountThisMonth?: number; // Count of PT sessions for settlement on the 1st
  allowMultipleTraineesInPT?: boolean; // Coach approval for >1 trainee in PT session
  openGymMonthlyLimit?: number; // Registration limit for Open Gym defined by coach/manager
  offlinePaymentApproved?: boolean; // Exception override by manager for manual payment
  offlinePaymentNote?: string;

  // Workout & Nutrition requests
  requestedWorkoutPlan?: boolean; // Trainee requested custom workout program
  nutritionPlanPaid?: boolean; // Trainee paid for individual nutrition program (150 ILS)

  // Annual & Monthly membership commitment options
  isMembershipFrozen?: boolean; // Frozen for up to 1 month
  membershipFrozenUntil?: string; // ISO date string
  isCancelledEarly?: boolean; // Annual subscription cancelled early
  cancellationPenaltyPaid?: boolean; // 500 ILS penalty fee paid for early cancellation

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

  // Personal Training specifics
  isPersonalTraining?: boolean;
  targetTraineeId?: string; // Main trainee for PT
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
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  traineeId: string;
  coachId: string;
  coachName: string;
  lastUpdated: string; // YYYY-MM-DD
  exercises: Exercise[];
  status?: 'REQUIRED_OPEN_GYM' | 'REQUESTED_BY_TRAINEE' | 'APPROVED_ASSIGNED';
  isRequested?: boolean;
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
  sourceDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'PUBLISHED';
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
  active: boolean;
  isPaid?: boolean; // Paid individual fee
  price?: number; // Fee amount (e.g., 150 ILS)
  paymentStatus?: 'UNPAID' | 'PAID' | 'WAIVED';
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
}
