/**
 * Clean installation defaults.
 *
 * Operational club records are loaded from PostgreSQL in production. These
 * values are only the empty baseline used before the first server sync.
 */
import {
  Announcement,
  AttendanceLog,
  BlackPoint,
  DEFAULT_MEMBERSHIP_PLAN_CONFIGS,
  DiscountCode,
  Gender,
  Message,
  NutritionPlan,
  OpenGymSession,
  Payment,
  SystemSettings,
  TrainingSession,
  User,
  UserRole,
  WorkoutPlan
} from '../types';

export const INITIAL_SETTINGS: SystemSettings = {
  cancellationWindowHours: 2,
  maxBlackPointsBeforePriorityDrop: 3,
  blackPointExpiryMonths: 1,
  openGymMaxParticipants: 15,
  membershipPlans: DEFAULT_MEMBERSHIP_PLAN_CONFIGS
};

// The production reset keeps the existing Ruby Bali manager record. This
// fallback contains no public password and is not a production credential.
export const INITIAL_USERS: User[] = [{
  id: 'user-robi',
  name: 'רובי באלי',
  username: 'רובי באלי',
  password: '',
  email: 'robi@rubisgym.co.il',
  phone: '054-6995885',
  role: UserRole.MANAGER,
  gender: Gender.MALE,
  age: 38,
  birthDate: '1988-04-12',
  healthDeclarationSigned: true,
  healthDeclarationDate: new Date().toISOString().slice(0, 10),
  priorityScore: 100,
  imageUrl: ''
}];

export const INITIAL_SESSIONS: TrainingSession[] = [];
export const INITIAL_OPEN_GYM_SESSIONS: OpenGymSession[] = [];
export const INITIAL_WORKOUT_PLANS: WorkoutPlan[] = [];
export const INITIAL_NUTRITION_PLANS: NutritionPlan[] = [];
export const INITIAL_BLACK_POINTS: BlackPoint[] = [];
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_MESSAGES: Message[] = [];
export const INITIAL_ATTENDANCE: AttendanceLog[] = [];
export const INITIAL_DISCOUNT_CODES: DiscountCode[] = [];
