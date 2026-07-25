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
  SystemSettings
} from '../types';

export const INITIAL_SETTINGS: SystemSettings = {
  cancellationWindowHours: 2,
  maxBlackPointsBeforePriorityDrop: 3,
  blackPointExpiryMonths: 1,
  openGymMaxParticipants: 15
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

export const INITIAL_SESSIONS: TrainingSession[] = [];
export const INITIAL_OPEN_GYM_SESSIONS: OpenGymSession[] = [];
export const INITIAL_WORKOUT_PLANS: WorkoutPlan[] = [];
export const INITIAL_NUTRITION_PLANS: NutritionPlan[] = [];
export const INITIAL_BLACK_POINTS: BlackPoint[] = [];
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];
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
