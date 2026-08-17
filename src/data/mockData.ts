/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  UserRole,
  Gender,
  MembershipType,
  MembershipStatus,
  TrainingSession,
  OpenGymSession,
  WorkoutPlan,
  NutritionPlan,
  BlackPoint,
  Message,
  Announcement,
  Payment,
  AttendanceLog,
  DiscountCode,
  SystemSettings,
  DEFAULT_MEMBERSHIP_PLAN_CONFIGS,
  MuscleGroup
} from '../types';

export const INITIAL_SETTINGS: SystemSettings = {
  cancellationWindowHours: 2,
  maxBlackPointsBeforePriorityDrop: 3,
  blackPointExpiryMonths: 1,
  openGymMaxParticipants: 15,
  membershipPlans: DEFAULT_MEMBERSHIP_PLAN_CONFIGS
};

export const INITIAL_USERS: User[] = [
  {
    id: 'user-robi',
    name: 'רובי באלי',
    username: 'רובי באלי',
    password: '123456',
    email: 'robi@rubisgym.co.il',
    phone: '050-8888888',
    role: UserRole.MANAGER,
    gender: Gender.MALE,
    age: 38,
    birthDate: '1988-04-12',
    healthDeclarationSigned: true,
    healthDeclarationDate: '2026-01-01',
    priorityScore: 100,
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'trainee-meni',
    name: 'מני',
    username: 'מני',
    password: '123456',
    email: 'meni@rubisgym.co.il',
    phone: '054-1111111',
    role: UserRole.TRAINEE,
    gender: Gender.MALE,
    age: 32,
    birthDate: '1994-08-20',
    healthDeclarationSigned: true,
    healthDeclarationDate: '2026-01-10',
    membershipType: MembershipType.GROUP_MONTHLY,
    secondaryMemberships: [MembershipType.PERSONAL_TRAINING, MembershipType.NUTRITION_PLAN],
    membershipStatus: MembershipStatus.ACTIVE,
    membershipExpiry: '2027-12-31',
    personalTrainingRate: 200,
    personalSessionsCountThisMonth: 0,
    allowMultipleTraineesInPT: true,
    priorityScore: 100,
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'trainee-liraz',
    name: 'לירז',
    username: 'לירז',
    password: '123456',
    email: 'liraz@rubisgym.co.il',
    phone: '054-2222222',
    role: UserRole.TRAINEE,
    gender: Gender.FEMALE,
    age: 28,
    birthDate: '1998-02-14',
    healthDeclarationSigned: true,
    membershipType: MembershipType.GROUP_ANNUAL,
    secondaryMemberships: [MembershipType.WORKOUT_PLAN],
    membershipStatus: MembershipStatus.ACTIVE,
    membershipExpiry: '2027-12-31',
    priorityScore: 100,
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'trainee-roni',
    name: 'רוני',
    username: 'רוני',
    password: '123456',
    email: 'roni@rubisgym.co.il',
    phone: '054-3333333',
    role: UserRole.TRAINEE,
    gender: Gender.MALE,
    age: 30,
    birthDate: '1996-11-05',
    healthDeclarationSigned: true,
    membershipType: MembershipType.OPEN_MONTHLY, // Includes workout plan
    secondaryMemberships: [MembershipType.PERSONAL_TRAINING],
    membershipStatus: MembershipStatus.ACTIVE,
    membershipExpiry: '2027-12-31',
    personalTrainingRate: 200,
    priorityScore: 100,
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'trainee-oren',
    name: 'אורן',
    email: 'oren@rubisgym.co.il',
    phone: '054-4444444',
    role: UserRole.TRAINEE,
    gender: Gender.MALE,
    age: 35,
    membershipType: MembershipType.OPEN_PUNCH_CARD,
    membershipStatus: MembershipStatus.ACTIVE,
    membershipExpiry: '2027-12-31',
    punchCardRemaining: 10,
    priorityScore: 100,
    imageUrl: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'trainee-gilad',
    name: 'גלעד',
    email: 'gilad@rubisgym.co.il',
    phone: '054-5555555',
    role: UserRole.TRAINEE,
    gender: Gender.MALE,
    age: 29,
    membershipType: MembershipType.OPEN_ANNUAL, // Includes workout plan
    secondaryMemberships: [MembershipType.PERSONAL_TRAINING, MembershipType.NUTRITION_PLAN],
    membershipStatus: MembershipStatus.ACTIVE,
    membershipExpiry: '2027-12-31',
    priorityScore: 100,
    imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
  }
];

const dateFromToday = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const INITIAL_SESSIONS: TrainingSession[] = [
  {
    id: 'session-lower-body',
    title: 'כוח תחתון',
    date: dateFromToday(0),
    time: '06:00',
    durationMinutes: 60,
    coachId: 'user-robi',
    coachName: 'רובי',
    muscleGroup: MuscleGroup.LEGS,
    maxParticipants: 12,
    genderRestriction: Gender.ALL,
    allowedMemberships: Object.values(MembershipType),
    registeredUsers: ['trainee-liraz', 'trainee-roni', 'trainee-oren', 'trainee-gilad'],
    waitlistUsers: []
  },
  {
    id: 'session-upper-body',
    title: 'כוח עליון — פלג גוף עליון',
    date: dateFromToday(0),
    time: '18:00',
    durationMinutes: 60,
    coachId: 'user-robi',
    coachName: 'רובי',
    muscleGroup: MuscleGroup.UPPER,
    maxParticipants: 12,
    genderRestriction: Gender.ALL,
    allowedMemberships: Object.values(MembershipType),
    registeredUsers: ['trainee-liraz', 'trainee-roni', 'trainee-oren', 'trainee-gilad', 'trainee-meni'],
    waitlistUsers: []
  },
  {
    id: 'session-hiit',
    title: 'HIIT קבוצתי',
    date: dateFromToday(0),
    time: '19:30',
    durationMinutes: 60,
    coachId: 'user-robi',
    coachName: 'רובי',
    muscleGroup: MuscleGroup.FUNCTIONAL,
    maxParticipants: 6,
    genderRestriction: Gender.ALL,
    allowedMemberships: Object.values(MembershipType),
    registeredUsers: ['trainee-meni', 'trainee-liraz', 'trainee-roni', 'trainee-oren', 'trainee-gilad'],
    waitlistUsers: []
  },
  {
    id: 'session-core',
    title: 'ליבה ויציבה',
    date: dateFromToday(1),
    time: '09:00',
    durationMinutes: 50,
    coachId: 'user-robi',
    coachName: 'רובי',
    muscleGroup: MuscleGroup.CORE,
    maxParticipants: 10,
    genderRestriction: Gender.ALL,
    allowedMemberships: Object.values(MembershipType),
    registeredUsers: ['trainee-liraz', 'trainee-roni'],
    waitlistUsers: []
  }
];
export const INITIAL_OPEN_GYM_SESSIONS: OpenGymSession[] = [
  {
    id: 'open-gym-evening',
    date: dateFromToday(0),
    timeSlot: '21:00 - 22:00',
    maxParticipants: 20,
    registeredUsers: ['trainee-liraz', 'trainee-oren', 'trainee-gilad'],
    waitlistUsers: []
  }
];
export const INITIAL_WORKOUT_PLANS: WorkoutPlan[] = [
  {
    id: 'workout-meni',
    traineeId: 'trainee-meni',
    coachId: 'user-robi',
    coachName: 'רובי',
    lastUpdated: dateFromToday(-2),
    status: 'APPROVED_ASSIGNED',
    trainingDaysPerWeek: 2,
    dayLabels: ['יום כוח עליון', 'יום רגליים וליבה'],
    exercises: [
      { id: 'ex-1', name: 'לחיצת חזה', category: 'כוח', muscleGroup: MuscleGroup.UPPER, sets: 4, reps: '8-10', weight: '60 ק״ג', dayNumber: 1, notes: 'שכמות צמודות לספסל ותנועה מבוקרת.' },
      { id: 'ex-2', name: 'סקוואט', category: 'כוח', muscleGroup: MuscleGroup.LEGS, sets: 4, reps: '10', weight: '70 ק״ג', dayNumber: 2, notes: 'ברכיים בקו כפות הרגליים ושמירה על גב ניטרלי.' },
      { id: 'ex-3', name: 'חתירה', category: 'כוח', muscleGroup: MuscleGroup.BACK, sets: 3, reps: '12', weight: '45 ק״ג', dayNumber: 1 },
      { id: 'ex-4', name: 'לחיצת כתפיים', category: 'כוח', muscleGroup: MuscleGroup.SHOULDERS, sets: 3, reps: '10', weight: '22 ק״ג', dayNumber: 2 }
    ]
  }
];
export const INITIAL_NUTRITION_PLANS: NutritionPlan[] = [{
  id: 'nutrition-meni', traineeId: 'trainee-meni', coachId: 'user-robi', coachName: 'רובי', lastUpdated: dateFromToday(-1), dailyCalories: 2200, proteinGrams: 150, carbsGrams: 230, fatGrams: 70, mealsDescription: 'להעדיף מזון טרי, לשתות לאורך היום ולהתאים את הארוחה סביב האימון.', goal: 'ירידה מתונה באחוזי שומן ושמירה על מסת שריר', hydrationLiters: 2.8, fiberGrams: 30, active: true, isPaid: true, paymentStatus: 'PAID', categories: [
    { id: 'meal-breakfast', title: 'ארוחת בוקר', suggestedTime: '07:00–09:00', foods: 'יוגורט עשיר בחלבון, שיבולת שועל, פרי וכף שקדים', calories: 520, proteinGrams: 35, carbsGrams: 58, fatGrams: 16 },
    { id: 'meal-lunch', title: 'ארוחת צהריים', suggestedTime: '12:00–15:00', foods: 'חזה עוף/טופו, אורז מלא, ירקות וכף שמן זית', calories: 760, proteinGrams: 55, carbsGrams: 82, fatGrams: 22 },
    { id: 'meal-snack', title: 'ארוחת ביניים', suggestedTime: 'לפני אימון', foods: 'פרי, גביע חלבון או תחליף צמחי ו־2 פריכיות', calories: 300, proteinGrams: 20, carbsGrams: 42, fatGrams: 6 },
    { id: 'meal-dinner', title: 'ארוחת ערב', suggestedTime: '19:00–21:00', foods: 'ביצים/טונה, לחם מלא, סלט וטחינה', calories: 620, proteinGrams: 40, carbsGrams: 48, fatGrams: 26 }
  ]
}];
export const INITIAL_BLACK_POINTS: BlackPoint[] = [];
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announcement-friday',
    title: 'שינוי בשעות יום שישי',
    content: 'האימון של 08:00 עובר ל־09:00 השבוע בלבד. הרישום הקיים נשמר אוטומטית.',
    createdBy: 'רובי',
    creatorRole: UserRole.MANAGER,
    date: dateFromToday(0),
    targetGender: Gender.ALL
  },
  {
    id: 'announcement-weekend',
    title: 'Open Gym בסוף השבוע',
    content: 'שעות האימון הפתוח בשבת עודכנו ל־09:00–13:00, בהתאם לתפוסה.',
    createdBy: 'הנהלת המועדון',
    creatorRole: UserRole.MANAGER,
    date: dateFromToday(-1),
    targetGender: Gender.ALL
  }
];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_MESSAGES: Message[] = [];
export const INITIAL_ATTENDANCE: AttendanceLog[] = [];

export const INITIAL_DISCOUNT_CODES: DiscountCode[] = [
  {
    id: 'disc-1',
    code: 'RUBI10',
    discountPercent: 10,
    isSingleUse: false,
    createdBy: 'רובי באלי (מאמן ראשי)',
    createdAt: '2026-01-01'
  },
  {
    id: 'disc-2',
    code: 'FAMILY15',
    discountPercent: 15,
    isSingleUse: false,
    createdBy: 'רובי באלי (מאמן ראשי)',
    createdAt: '2026-02-15'
  },
  {
    id: 'disc-3',
    code: 'VIP50',
    discountAmount: 50,
    discountPercent: 0,
    isSingleUse: true,
    createdBy: 'רובי באלי (מאמן ראשי)',
    createdAt: '2026-03-01'
  }
];

export const getLocalStorageData = <T>(key: string, defaultValue: T): T => {
  const item = localStorage.getItem(key);
  if (!item) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(item);
  } catch (e) {
    console.error(`Error parsing localStorage for ${key}`, e);
    return defaultValue;
  }
};

export const saveLocalStorageData = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const clearLocalStorageAll = (): void => {
  localStorage.clear();
  window.location.reload();
};
