import {
  Gender,
  MembershipStatus,
  MembershipType,
  MuscleGroup,
  UserRole
} from '../types';
import {
  INITIAL_SETTINGS,
  INITIAL_USERS
} from './initialData';

const dateFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const createDemoPayload = () => ({
  settings: INITIAL_SETTINGS,
  users: [
    { ...INITIAL_USERS[0], password: undefined },
    {
      id: 'demo-trainee-meni', name: 'מני ישראלי', username: 'מני', email: 'meni@demo.baly.co.il',
      phone: '0541111111', role: UserRole.TRAINEE, gender: Gender.MALE, age: 32,
      birthDate: '1994-08-20', healthDeclarationSigned: true, healthDeclarationDate: dateFromToday(-20),
      clubAgreementSigned: true, membershipType: MembershipType.GROUP_ANNUAL,
      membershipStatus: MembershipStatus.ACTIVE, membershipExpiry: dateFromToday(300),
      requestedWorkoutPlan: true, nutritionPlanPaid: true, priorityScore: 100,
      imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'demo-trainee-liraz', name: 'לירז כהן', username: 'לירז', email: 'liraz@demo.baly.co.il',
      phone: '0542222222', role: UserRole.TRAINEE, gender: Gender.FEMALE, age: 28,
      birthDate: '1998-02-14', healthDeclarationSigned: true, healthDeclarationDate: dateFromToday(-45),
      clubAgreementSigned: true, membershipType: MembershipType.GROUP_MONTHLY,
      membershipStatus: MembershipStatus.ACTIVE, membershipExpiry: dateFromToday(120), priorityScore: 100,
      imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'demo-trainee-roni', name: 'רוני לוי', username: 'רוני', email: 'roni@demo.baly.co.il',
      phone: '0543333333', role: UserRole.TRAINEE, gender: Gender.MALE, age: 30,
      birthDate: '1996-11-05', healthDeclarationSigned: true, healthDeclarationDate: dateFromToday(-10),
      clubAgreementSigned: true, membershipType: MembershipType.OPEN_GYM,
      membershipStatus: MembershipStatus.ACTIVE, membershipExpiry: dateFromToday(90), priorityScore: 100,
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    }
  ],
  sessions: [
    {
      id: 'demo-session-strength', title: 'אימון כוח קבוצתי', date: dateFromToday(0), time: '19:00',
      durationMinutes: 60, coachId: 'user-robi', coachName: 'רובי באלי', muscleGroup: MuscleGroup.FUNCTIONAL,
      maxParticipants: 12, genderRestriction: Gender.ALL, allowedMemberships: Object.values(MembershipType),
      registeredUsers: ['demo-trainee-meni', 'demo-trainee-liraz'], waitlistUsers: []
    },
    {
      id: 'demo-session-core', title: 'ליבה ויציבה', date: dateFromToday(1), time: '09:00',
      durationMinutes: 50, coachId: 'user-robi', coachName: 'רובי באלי', muscleGroup: MuscleGroup.CORE,
      maxParticipants: 10, genderRestriction: Gender.ALL, allowedMemberships: Object.values(MembershipType),
      registeredUsers: ['demo-trainee-roni'], waitlistUsers: []
    },
    {
      id: 'demo-session-upper', title: 'פלג גוף עליון', date: dateFromToday(3), time: '18:00',
      durationMinutes: 60, coachId: 'user-robi', coachName: 'רובי באלי', muscleGroup: MuscleGroup.UPPER,
      maxParticipants: 12, genderRestriction: Gender.ALL, allowedMemberships: Object.values(MembershipType),
      registeredUsers: [], waitlistUsers: []
    }
  ],
  openGymSessions: [{
    id: 'demo-open-gym', date: dateFromToday(0), timeSlot: '20:00 - 22:00', maxParticipants: 20,
    registeredUsers: ['demo-trainee-roni'], waitlistUsers: []
  }],
  workoutPlans: [{
    id: 'demo-workout-meni', traineeId: 'demo-trainee-meni', title: 'תוכנית כוח – 3 ימים',
    coachId: 'user-robi', coachName: 'רובי באלי', lastUpdated: dateFromToday(-2),
    status: 'APPROVED_ASSIGNED' as const, trainingDaysPerWeek: 3,
    dayLabels: ['כוח עליון', 'רגליים וליבה', 'אימון משולב'],
    exercises: [
      { id: 'demo-ex-1', name: 'לחיצת חזה', category: 'כוח', muscleGroup: MuscleGroup.UPPER, sets: 4, reps: '8–10', weight: '60 ק״ג', dayNumber: 1, restDuration: '60 שניות', notes: 'תנועה מבוקרת ושכמות צמודות לספסל.' },
      { id: 'demo-ex-2', name: 'חתירה בישיבה', category: 'כוח', muscleGroup: MuscleGroup.BACK, sets: 3, reps: '12', weight: '45 ק״ג', dayNumber: 1, restDuration: '45 שניות' },
      { id: 'demo-ex-3', name: 'סקוואט', category: 'כוח', muscleGroup: MuscleGroup.LEGS, sets: 4, reps: '10', weight: '70 ק״ג', dayNumber: 2, restDuration: '75 שניות', notes: 'ברכיים בקו כפות הרגליים.' },
      { id: 'demo-ex-4', name: 'פלאנק', category: 'ליבה', muscleGroup: MuscleGroup.CORE, sets: 3, reps: '45 שניות', dayNumber: 3, restDuration: '30 שניות' }
    ]
  }],
  nutritionPlans: [{
    id: 'demo-nutrition-meni', traineeId: 'demo-trainee-meni', coachId: 'user-robi', coachName: 'רובי באלי',
    lastUpdated: dateFromToday(-1), dailyCalories: 2200, proteinGrams: 150, carbsGrams: 230,
    fatGrams: 70, mealsDescription: 'תפריט הדגמה מאוזן סביב שעות האימון.', goal: 'שמירה על מסת שריר',
    hydrationLiters: 2.8, fiberGrams: 30, active: true, isPaid: true, paymentStatus: 'PAID' as const,
    categories: [
      { id: 'demo-breakfast', title: 'ארוחת בוקר', suggestedTime: '07:00–09:00', foods: 'יוגורט, שיבולת שועל ופרי', calories: 520, proteinGrams: 35, carbsGrams: 58, fatGrams: 16 },
      { id: 'demo-lunch', title: 'ארוחת צהריים', suggestedTime: '12:00–15:00', foods: 'חזה עוף, אורז מלא וירקות', calories: 760, proteinGrams: 55, carbsGrams: 82, fatGrams: 22 }
    ]
  }],
  blackPoints: [],
  announcements: [{
    id: 'demo-announcement', title: 'ברוכים הבאים לסביבת ההדגמה',
    content: 'אפשר לבדוק רישום לאימונים, תוכניות, תשלומים וניהול המועדון. הנתונים נשמרים במכשיר זה בלבד.',
    createdBy: 'רובי באלי', creatorRole: UserRole.MANAGER, date: dateFromToday(0), targetGender: Gender.ALL
  }],
  payments: [], messages: [], attendanceLogs: [],
  discountCodes: [{ id: 'demo-discount', code: 'BALY10', discountPercent: 10, isSingleUse: false, createdBy: 'רובי באלי', createdAt: dateFromToday(-10) }],
  traineeProfiles: [], traineeMemoryEntries: [], gymEquipment: [], coachPdfDocuments: [],
  workoutAssistantMessages: [], workoutAssistantDrafts: [], groupWorkoutPrograms: []
});
