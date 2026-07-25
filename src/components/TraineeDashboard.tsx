/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyCalendar } from './WeeklyCalendar';
import {
  User,
  TrainingSession,
  OpenGymSession,
  WorkoutPlan,
  NutritionPlan,
  BlackPoint,
  Message,
  Announcement,
  Payment,
  AttendanceLog,
  SystemSettings,
  MuscleGroup,
  Gender,
  MembershipStatus,
  MembershipType,
  MEMBERSHIP_TYPE_LABELS,
  UserRole
} from '../types';
import {
  Calendar as CalendarIcon,
  BookOpen,
  Apple,
  MessageSquare,
  QrCode,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Send,
  Video,
  Grid
} from 'lucide-react';
import { getGoogleCalendarLink, downloadIcsFile } from './CalendarSync';

interface TraineeDashboardProps {
  activeUser: User;
  users: User[];
  sessions: TrainingSession[];
  openGymSessions: OpenGymSession[];
  workoutPlans: WorkoutPlan[];
  nutritionPlans: NutritionPlan[];
  blackPoints: BlackPoint[];
  messages: Message[];
  announcements: Announcement[];
  payments: Payment[];
  attendanceLogs: AttendanceLog[];
  settings: SystemSettings;
  onUpdateSessions: (sessions: TrainingSession[]) => void;
  onUpdateOpenGym: (openGyms: OpenGymSession[]) => void;
  onUpdateAttendance: (logs: AttendanceLog[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateBlackPoints: (points: BlackPoint[]) => void;
  onSendMessage: (content: string, receiverId: string) => void;
}

export const TraineeDashboard: React.FC<TraineeDashboardProps> = ({
  activeUser,
  users,
  sessions,
  openGymSessions,
  workoutPlans,
  nutritionPlans,
  blackPoints,
  messages,
  announcements,
  payments,
  attendanceLogs,
  settings,
  onUpdateSessions,
  onUpdateOpenGym,
  onUpdateAttendance,
  onUpdateUsers,
  onUpdateBlackPoints,
  onSendMessage
}) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'opengym' | 'workout' | 'nutrition' | 'messages' | 'notices' | 'card'>('classes');
  const [showPunchCardModal, setShowPunchCardModal] = useState<boolean>(false);
  const [selectedPunchCardPackage, setSelectedPunchCardPackage] = useState<{ count: number; price: number; months: number }>({
    count: 10,
    price: 450,
    months: 6
  });

  const handlePurchasePunchCard = () => {
    const months = selectedPunchCardPackage.months;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);
    const expiryStr = expiryDate.toISOString().split('T')[0];

    const currentRemaining = activeUser.punchCardRemaining ?? 0;
    const newRemaining = currentRemaining + selectedPunchCardPackage.count;

    const updatedUsers = users.map(u => {
      if (u.id === activeUser.id) {
        return {
          ...u,
          membershipType: MembershipType.OPEN_PUNCH_CARD,
          membershipStatus: MembershipStatus.ACTIVE,
          membershipExpiry: expiryStr,
          punchCardRemaining: newRemaining
        };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
    setShowPunchCardModal(false);
    showFeedback(`רכישת כרטיסיית ${selectedPunchCardPackage.count} אימונים (₪${selectedPunchCardPackage.price}) בוצעה בהצלחה! היתרה המעודכנת: ${newRemaining} ניקובים.`);
  };
  
  // Notification banner for feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Chat input
  const [chatInput, setChatInput] = useState('');

  // Selected coach to chat with (Daniel as default, or Adi if core workout)
  const defaultCoach = users.find(u => u.role === UserRole.COACH) || { id: 'coach-1', name: 'דניאל לוי' };
  const [selectedCoachId, setSelectedCoachId] = useState(defaultCoach.id);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 5000);
  };

  // Helper: check if active trainee has booked a class/open gym
  const isBooked = (session: TrainingSession) => session.registeredUsers.includes(activeUser.id);
  const isWaitlisted = (session: TrainingSession) => session.waitlistUsers.includes(activeUser.id);
  
  // Helper: check if active trainee has booked Open Gym
  const isOpenGymBooked = (og: OpenGymSession) => og.registeredUsers.includes(activeUser.id);
  const isOpenGymWaitlisted = (og: OpenGymSession) => og.waitlistUsers.includes(activeUser.id);

  // Check booking eligibility constraints (Section 5.1 & 11)
  const checkBookingEligibility = (session: TrainingSession): { eligible: boolean; reason?: string } => {
    // 0. Frozen Membership check
    if (activeUser.isMembershipFrozen) {
      return {
        eligible: false,
        reason: `המנוי שלך מוקפא כעת (עד ${activeUser.membershipFrozenUntil || 'תום תקופת ההקפאה'}). לא ניתן להירשם לאימונים במהלך הקפאת מנוי.`
      };
    }

    // 1. Mandatory Pre-Payment check (including Family Payer inheritance)
    let isPaid = activeUser.membershipStatus === MembershipStatus.ACTIVE || activeUser.offlinePaymentApproved;
    if (!isPaid && activeUser.familyPayerId) {
      const payer = users.find(u => u.id === activeUser.familyPayerId);
      if (payer && (payer.membershipStatus === MembershipStatus.ACTIVE || payer.offlinePaymentApproved)) {
        isPaid = true;
      }
    }

    if (!isPaid) {
      return {
        eligible: false,
        reason: activeUser.membershipStatus === MembershipStatus.DEBT 
          ? 'תשלום מראש חובה! קיים חוב כספי פעיל על המנוי המשפחתי/האישי שלך. לא ניתן להירשם לאימון ללא תשלום מראש באפליקציה או אישור מנהל.' 
          : 'תשלום מראש חובה! תוקף המנוי שלך פג. אנא בצע תשלום מראש באפליקציה או פנה למנהל.'
      };
    }

    // Consolidated list of all active membership types held by this user/family
    const userMemberships: MembershipType[] = [
      activeUser.membershipType,
      ...(activeUser.secondaryMemberships || [])
    ].filter(Boolean) as MembershipType[];

    const hasGroupAccess = userMemberships.some(m => 
      [MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL].includes(m)
    );

    const hasPersonalAccess = userMemberships.includes(MembershipType.PERSONAL_TRAINING);

    const hasOpenGymAccess = userMemberships.some(m => 
      [MembershipType.OPEN_MONTHLY, MembershipType.OPEN_ANNUAL, MembershipType.OPEN_PUNCH_CARD].includes(m)
    );

    // Personal Training session check
    if (session.isPersonalTraining && !hasPersonalAccess) {
      return {
        eligible: false,
        reason: 'אימון אישי מצריך רכישת מסלול אימון אישי! (ניתן לרכוש אימון אישי במקביל לכל מנוי במערכת).'
      };
    }

    // Group session check (non-Personal Training)
    if (!session.isPersonalTraining && !hasGroupAccess) {
      // Check if specifically allowed by session allowedMemberships list
      const isExplicitlyAllowed = session.allowedMemberships && session.allowedMemberships.some(m => userMemberships.includes(m));
      if (!isExplicitlyAllowed) {
        return {
          eligible: false,
          reason: 'אימון קבוצתי מצריך מנוי קבוצתי פעיל (חודשי או שנתי).'
        };
      }
    }

    // Punch card check
    if (userMemberships.includes(MembershipType.OPEN_PUNCH_CARD) && !hasGroupAccess && !hasPersonalAccess) {
      if ((activeUser.punchCardRemaining ?? 0) <= 0) {
        return {
          eligible: false,
          reason: 'אזלו הניקובים בכרטיסייה! יש לבצע טעינת כרטיסייה חדשה באפליקציה.'
        };
      }
    }

    // 2. Allowed membership types check
    if (
      session.allowedMemberships &&
      session.allowedMemberships.length > 0
    ) {
      const isAllowed = session.allowedMemberships.some(m => userMemberships.includes(m)) ||
        (hasGroupAccess && !session.isPersonalTraining) ||
        (hasPersonalAccess && session.isPersonalTraining);

      if (!isAllowed) {
        return {
          eligible: false,
          reason: `אימון זה אינו כלול במסלול המנוי שלך.`
        };
      }
    }

    // 3. Gender restriction (Individual to this specific family member / trainee)
    if (session.genderRestriction !== Gender.ALL) {
      const isFemaleClass = session.genderRestriction === Gender.FEMALE;
      const isMaleClass = session.genderRestriction === Gender.MALE;
      if (isFemaleClass && activeUser.gender !== Gender.FEMALE) {
        return { eligible: false, reason: 'אימון זה מיועד לנשים בלבד 🚺' };
      }
      if (isMaleClass && activeUser.gender !== Gender.MALE) {
        return { eligible: false, reason: 'אימון זה מיועד לגברים בלבד 🚹' };
      }
    }

    // 4. Age limit restriction (Individual to this specific family member / trainee)
    if (session.ageMin && activeUser.age < session.ageMin) {
      return { eligible: false, reason: `מגבלת גיל! אימון זה מיועד לגילאי ${session.ageMin} ומעלה בלבד. (גיל המשתמש: ${activeUser.age})` };
    }
    if (session.ageMax && activeUser.age > session.ageMax) {
      return { eligible: false, reason: `מגבלת גיל! אימון זה מיועד לגילאי עד ${session.ageMax} בלבד. (גיל המשתמש: ${activeUser.age})` };
    }

    return { eligible: true };
  };

  // FREEZE MEMBERSHIP (Up to 1 month)
  const handleFreezeMembership = () => {
    if (confirm('האם ברצונך להקפיא את המנוי לתקופה של עד חודש אחד? ❄️\nבתקופת ההקפאה לא תבוצע גבייה כספית ולא ניתן להירשם לאימונים.')) {
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      const frozenUntilStr = oneMonthLater.toISOString().split('T')[0];

      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? { 
          ...u, 
          isMembershipFrozen: true, 
          membershipFrozenUntil: frozenUntilStr 
        } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback(`המנוי שלך הוקפא בהצלחה עד לתאריך ${frozenUntilStr}! ❄️`);
    }
  };

  // UNFREEZE MEMBERSHIP
  const handleUnfreezeMembership = () => {
    if (confirm('האם לבטל את הקפאת המנוי ולהחזיר אותו לפעילות מלאה? ☀️')) {
      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? { 
          ...u, 
          isMembershipFrozen: false, 
          membershipFrozenUntil: undefined 
        } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback('הקפאת המנוי בוטלה! המנוי שלך פעיל שוב בהצלחה. 🎉');
    }
  };

  // CANCEL ANNUAL MEMBERSHIP (Penalty fee of 1 additional month = 500 ILS)
  const handleCancelAnnualMembership = () => {
    if (confirm('ביטול מנוי שנתי כרוך בתשלום קנס יציאה בגובה חודש נוסף אחד (500 ₪). ⚠️\nהאם לבצע תשלום קנס בסך 500 ₪ ולבטל את המנוי?')) {
      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? { 
          ...u, 
          isCancelledEarly: true, 
          cancellationPenaltyPaid: true,
          membershipStatus: MembershipStatus.EXPIRED 
        } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback('בקשת ביטול המנוי התקבלה. שולם קנס יציאה בסך 500 ₪ והמנוי הופסק. 💳');
    }
  };

  // SWITCH MEMBERSHIP PLAN (Monthly 600 vs Annual 500)
  const handleSwitchMembershipType = (newType: MembershipType) => {
    const typeLabel = newType === MembershipType.GROUP_MONTHLY ? 'מנוי קבוצתי חודשי' : 'מנוי קבוצתי שנתי';
    if (confirm(`האם לעבור ל-${typeLabel}?`)) {
      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? {
          ...u,
          membershipType: newType,
          membershipStatus: MembershipStatus.ACTIVE,
          isMembershipFrozen: false,
          isCancelledEarly: false
        } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback(`סוג המנוי שלך עודכן בהצלחה ל-${typeLabel}! 🎉`);
    }
  };

  // REQUEST WORKOUT PLAN (For non-Open Gym subscribers or upon request)
  const handleRequestWorkoutPlan = () => {
    if (onUpdateUsers) {
      const updatedUsers = users.map(u => u.id === activeUser.id ? { ...u, requestedWorkoutPlan: true } : u);
      onUpdateUsers(updatedUsers);
    }
    showFeedback('בקשתך לתוכנית אימונים אישית נשלחה בהצלחה למאמן! 📩');
  };

  // PAY FOR NUTRITION PLAN (150 ILS individual fee)
  const handlePayNutritionPlan = () => {
    if (confirm('האם לבצע תשלום בסך 150 ₪ עבור תוכנית תזונה מותאמת אישית שנבנית ע"י המאמן?')) {
      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? { ...u, nutritionPlanPaid: true } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback('התשלום בסך 150 ₪ עבור תוכנית התזונה התקבל בהצלחה! 💳 המאמן קיבל הודעה להכנת התפריט עבורך.');
    }
  };

  // BOOK / JOIN WAITLIST (Section 5.1 & 5.2)
  const handleBookSession = (session: TrainingSession) => {
    const check = checkBookingEligibility(session);
    if (!check.eligible) {
      showFeedback(check.reason || 'אין הרשאה להרשם לאימון זה', 'error');
      return;
    }

    let updatedSessions: TrainingSession[];
    
    // Check if session has free space
    if (session.registeredUsers.length < session.maxParticipants) {
      // Direct Booking
      updatedSessions = sessions.map(s => {
        if (s.id === session.id) {
          return { ...s, registeredUsers: [...s.registeredUsers, activeUser.id] };
        }
        return s;
      });

      // Punch card deduction
      if (activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD && onUpdateUsers) {
        const remaining = (activeUser.punchCardRemaining ?? 10) - 1;
        const updatedUsers = users.map(u => u.id === activeUser.id ? { ...u, punchCardRemaining: Math.max(0, remaining) } : u);
        onUpdateUsers(updatedUsers);
        showFeedback(`נרשמת בהצלחה לאימון! חורר ניקוב בכרטיסייה (נוצל 1, נותרו: ${Math.max(0, remaining)} ניקובים).`);
      } else {
        showFeedback(`נרשמת בהצלחה לאימון "${session.title}"! תזכורת ואירוע סונכרנו.`);
      }
    } else {
      // Add to Automatic Waitlist (Section 5.2)
      // Waitlist ordering handles priority score: members with 100 priority score go BEFORE priority 50.
      const currentWaitlist = [...session.waitlistUsers];
      
      // Inserting member in queue based on priority score
      let inserted = false;
      const updatedWaitlistUsers: string[] = [];
      
      for (const uid of currentWaitlist) {
        const u = users.find(item => item.id === uid);
        const uScore = u ? u.priorityScore : 100;
        
        if (!inserted && activeUser.priorityScore > uScore) {
          updatedWaitlistUsers.push(activeUser.id);
          inserted = true;
        }
        updatedWaitlistUsers.push(uid);
      }
      
      if (!inserted) {
        updatedWaitlistUsers.push(activeUser.id);
      }

      updatedSessions = sessions.map(s => {
        if (s.id === session.id) {
          return { ...s, waitlistUsers: updatedWaitlistUsers };
        }
        return s;
      });
      showFeedback('האימון מלא! התווספת לתור ההמתנה האוטומטי (מיקומך נקבע לפי דירוג העדיפות שלך במערכת).');
    }

    onUpdateSessions(updatedSessions);
  };

  // CANCEL BOOKING / EXIT WAITLIST (Section 5.3)
  const handleCancelBooking = (session: TrainingSession) => {
    let updatedSessions: TrainingSession[];
    
    const wasInWaitlist = session.waitlistUsers.includes(activeUser.id);

    if (wasInWaitlist) {
      // Just remove from waitlist
      updatedSessions = sessions.map(s => {
        if (s.id === session.id) {
          return { ...s, waitlistUsers: s.waitlistUsers.filter(uid => uid !== activeUser.id) };
        }
        return s;
      });
      showFeedback('הסרת את עצמך מתור ההמתנה של האימון.');
    } else {
      // Trainee was registered. Check cancellation window penalty (Section 5.3)
      const now = new Date();
      const [hours, minutes] = session.time.split(':').map(Number);
      const sessionStart = new Date(session.date);
      sessionStart.setHours(hours, minutes, 0);

      const diffMs = sessionStart.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let penaltyApplied = false;
      const isPersonal = !!session.isPersonalTraining;
      const windowHours = isPersonal ? 12 : (settings.cancellationWindowHours || 2);

      // If cancellation is too late (less than 2h for group, 12h for personal)
      if (diffHours >= 0 && diffHours < windowHours) {
        // Late cancellation penalty applied!
        penaltyApplied = true;
        const newPenalty: BlackPoint = {
          id: `bp-${Date.now()}`,
          traineeId: activeUser.id,
          traineeName: activeUser.name,
          sessionId: session.id,
          sessionTitle: session.title,
          sessionDate: session.date,
          issuedDate: now.toISOString().split('T')[0],
          expiryDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0], // 1 month from now
          status: 'ACTIVE',
          reason: isPersonal
            ? `ביטול אימון אישי באיחור (${Math.round(diffHours * 10) / 10} שעות לפני) – לפי סעיף 5.3 נדרש תשלום מלא / ללא החזר ניקוב`
            : `ביטול אימון קבוצתי באיחור (${Math.round(diffHours * 60)} דקות לפני מועד האימון)`
        };

        const updatedBlackPoints = [newPenalty, ...blackPoints];
        onUpdateBlackPoints(updatedBlackPoints);

        // Recalculate priority if group
        if (!isPersonal) {
          const activeCount = updatedBlackPoints.filter(p => p.traineeId === activeUser.id && p.status === 'ACTIVE').length;
          if (activeCount >= settings.maxBlackPointsBeforePriorityDrop) {
            // Drop trainee priority score
            const updatedUsers = users.map(u => {
              if (u.id === activeUser.id) {
                return { ...u, priorityScore: 50 };
              }
              return u;
            });
            onUpdateUsers(updatedUsers);
          }
        }
      }

      // Remove from registers & automatically promote the first waitlist user! (Section 5.2)
      const firstInWaitlistId = session.waitlistUsers[0];
      const nextWaitlistUsers = session.waitlistUsers.slice(1);
      
      updatedSessions = sessions.map(s => {
        if (s.id === session.id) {
          const filteredRegistered = s.registeredUsers.filter(uid => uid !== activeUser.id);
          
          if (firstInWaitlistId) {
            // Promote next waitlist member to active session
            showFeedback(`בוטל. היות והתפנה מקום, המתאמן הבא בתור קודם אוטומטית!`);
            return {
              ...s,
              registeredUsers: [...filteredRegistered, firstInWaitlistId],
              waitlistUsers: nextWaitlistUsers
            };
          } else {
            return {
              ...s,
              registeredUsers: filteredRegistered
            };
          }
        }
        return s;
      });

      // Refund punch card if user has PUNCH_CARD and cancelled in time (12h for PT, 2h for group)
      if (activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD && onUpdateUsers && !penaltyApplied) {
        const remaining = (activeUser.punchCardRemaining ?? 0) + 1;
        const updatedUsers = users.map(u => u.id === activeUser.id ? { ...u, punchCardRemaining: remaining } : u);
        onUpdateUsers(updatedUsers);
      }

      if (penaltyApplied) {
        if (isPersonal) {
          showFeedback('שימו לב: ביטול אימון אישי תקף רק מ-12 שעות מראש! הביטול נקלט אך האימון יחויב בתשלום מלא / ללא החזר ניקוב על פי סעיף 5.3 🚨', 'error');
        } else {
          showFeedback(`שימו לב: הביטול בוצע פחות מ-${windowHours} שעות לפני האימון הקבוצתי! נרשמה לחובתך נקודה שחורה 🚨 (ניקוב/תשלום לא יוחזרו)`, 'error');
        }
      } else if (activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD) {
        showFeedback('ההרשמה לאימון בוטלה והוחזר ניקוב ליתרת הכרטיסייה שלך! 🎟️');
      } else {
        showFeedback('ההרשמה לאימון בוטלה בהצלחה ללא השלכות.');
      }
    }

    onUpdateSessions(updatedSessions);
  };

  // BOOK / CANCEL OPEN GYM (Section 10)
  const handleBookOpenGym = (og: OpenGymSession) => {
    // Payment check applies to Open Gym too (Section 11)
    const isPaid = activeUser.membershipStatus === MembershipStatus.ACTIVE || activeUser.offlinePaymentApproved;
    if (!isPaid) {
      showFeedback('תשלום מראש חובה! ההרשמה ל-Open Gym חסומה - לא בוצע תשלום מראש באפליקציה או אישור חריג מנהל.', 'error');
      return;
    }

    if (activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD) {
      if ((activeUser.punchCardRemaining ?? 0) <= 0) {
        showFeedback('אזלו הניקובים בכרטיסייה ל-Open Gym! יש לבצע טעינת כרטיסייה חדשה באפליקציה.', 'error');
        return;
      }
    }

    let updatedOpenGym: OpenGymSession[];

    if (og.registeredUsers.length < og.maxParticipants) {
      updatedOpenGym = openGymSessions.map(item => {
        if (item.id === og.id) {
          return { ...item, registeredUsers: [...item.registeredUsers, activeUser.id] };
        }
        return item;
      });

      if (activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD && onUpdateUsers) {
        const remaining = (activeUser.punchCardRemaining ?? 10) - 1;
        const updatedUsers = users.map(u => u.id === activeUser.id ? { ...u, punchCardRemaining: Math.max(0, remaining) } : u);
        onUpdateUsers(updatedUsers);
        showFeedback(`נרשמת בהצלחה ל-Open Gym! חורר ניקוב בכרטיסייה (נוצל 1, נותרו: ${Math.max(0, remaining)} ניקובים).`);
      } else {
        showFeedback('נרשמת בהצלחה ל-Open Gym! כניסתך תאושר בסריקת הקוד.');
      }
    } else {
      updatedOpenGym = openGymSessions.map(item => {
        if (item.id === og.id) {
          return { ...item, waitlistUsers: [...item.waitlistUsers, activeUser.id] };
        }
        return item;
      });
      showFeedback('התפוסה מלאה בשעה זו! נכנסת לתור ההמתנה של Open Gym.');
    }

    onUpdateOpenGym(updatedOpenGym);
  };

  const handleCancelOpenGym = (og: OpenGymSession) => {
    const isWaitlisted = og.waitlistUsers.includes(activeUser.id);
    let updatedOpenGym: OpenGymSession[];

    if (isWaitlisted) {
      updatedOpenGym = openGymSessions.map(item => {
        if (item.id === og.id) {
          return { ...item, waitlistUsers: item.waitlistUsers.filter(uid => uid !== activeUser.id) };
        }
        return item;
      });
      showFeedback('הסרת את עצמך מתור ההמתנה של אימון חופשי.');
    } else {
      const nextUser = og.waitlistUsers[0];
      const remainingWaitlist = og.waitlistUsers.slice(1);

      if (activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD && onUpdateUsers) {
        const remaining = (activeUser.punchCardRemaining ?? 0) + 1;
        const updatedUsers = users.map(u => u.id === activeUser.id ? { ...u, punchCardRemaining: remaining } : u);
        onUpdateUsers(updatedUsers);
      }

      updatedOpenGym = openGymSessions.map(item => {
        if (item.id === og.id) {
          const nextRegistered = item.registeredUsers.filter(uid => uid !== activeUser.id);
          if (nextUser) {
            return {
              ...item,
              registeredUsers: [...nextRegistered, nextUser],
              waitlistUsers: remainingWaitlist
            };
          } else {
            return {
              ...item,
              registeredUsers: nextRegistered
            };
          }
        }
        return item;
      });
      showFeedback('ההרשמה ל-Open Gym בוטלה בהצלחה.');
    }

    onUpdateOpenGym(updatedOpenGym);
  };

  // CHECK-IN / SCANNER SIMULATION (Section 9)
  const handleSimulateCheckIn = (targetType: 'SESSION' | 'OPEN_GYM', targetId: string, title: string) => {
    // 1. Record Attendance Log
    const now = new Date();
    const log: AttendanceLog = {
      id: `att-${Date.now()}`,
      traineeId: activeUser.id,
      traineeName: activeUser.name,
      type: targetType,
      targetId: targetId,
      targetTitle: title,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: now.toISOString().split('T')[0]
    };

    onUpdateAttendance([log, ...attendanceLogs]);

    showFeedback(`🎉 צ'ק-אין בוצע בהצלחה עבור המועדון! הגעתך ל-${title} תועדה ברשומות.`);
  };

  // SEND CHAT TO SELECTED COACH (Section 13)
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim(), selectedCoachId);
    setChatInput('');
    showFeedback('הודעתך נשלחה למאמן!');
  };

  // BULLETIN BOARD TARGET AUDIENCE FILTERS (Section 14)
  const targetedAnnouncements = announcements.filter(ann => {
    // 1. Gender Filter
    if (ann.targetGender !== Gender.ALL && ann.targetGender !== activeUser.gender) {
      return false;
    }
    // 2. Age Filter
    if (ann.targetAgeMin && activeUser.age < ann.targetAgeMin) return false;
    if (ann.targetAgeMax && activeUser.age > ann.targetAgeMax) return false;

    // 3. Membership Type Filter
    if (ann.targetMembershipTypes && activeUser.membershipType && !ann.targetMembershipTypes.includes(activeUser.membershipType)) {
      return false;
    }

    return true;
  });

  const traineeWorkout = workoutPlans.find(wp => wp.traineeId === activeUser.id);
  const traineeNutrition = nutritionPlans.find(np => np.traineeId === activeUser.id);
  const activePenaltiesCount = blackPoints.filter(bp => bp.traineeId === activeUser.id && bp.status === 'ACTIVE').length;

  // Chats between trainee and selected coach
  const chatMessages = messages.filter(
    m =>
      (m.senderId === activeUser.id && m.receiverId === selectedCoachId) ||
      (m.senderId === selectedCoachId && m.receiverId === activeUser.id)
  );

  // Group workout plan exercises by muscle group for beautiful overview (Section 7)
  const workoutMuscleGroupsStats = traineeWorkout?.exercises.reduce((acc, curr) => {
    acc[curr.muscleGroup] = (acc[curr.muscleGroup] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6" id="trainee-dashboard">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl shadow-lg border fixed bottom-6 left-6 z-50 flex items-center gap-2 max-w-sm transition-all duration-300 transform translate-y-0 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200 animate-shake'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className="text-xs font-semibold">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Trainee Card / Header Widget */}
      <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="flex items-center gap-4 col-span-1 md:col-span-2">
          <img
            src={activeUser.imageUrl}
            alt={activeUser.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-md shrink-0"
          />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-lg font-bold text-slate-800">{activeUser.name}</h2>
              
              {/* Primary Membership Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${MEMBERSHIP_TYPE_LABELS[activeUser.membershipType || MembershipType.GROUP_MONTHLY]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                {MEMBERSHIP_TYPE_LABELS[activeUser.membershipType || MembershipType.GROUP_MONTHLY]?.label}
              </span>

              {/* Secondary Active Memberships */}
              {activeUser.secondaryMemberships && activeUser.secondaryMemberships.length > 0 && activeUser.secondaryMemberships.map((secType, idx) => (
                <span key={idx} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${MEMBERSHIP_TYPE_LABELS[secType]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                  <span>+</span>
                  {MEMBERSHIP_TYPE_LABELS[secType]?.label}
                </span>
              ))}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
              <div className="flex items-center gap-1">
                סטטוס תשלום:{' '}
                {activeUser.membershipStatus === MembershipStatus.ACTIVE ? (
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">שולם מראש ✅</span>
                ) : activeUser.familyPayerId && users.find(u => u.id === activeUser.familyPayerId)?.membershipStatus === MembershipStatus.ACTIVE ? (
                  <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    שולם ע"י ראש המשפחה ({users.find(u => u.id === activeUser.familyPayerId)?.name}) 👨‍👩‍👧‍👦
                  </span>
                ) : activeUser.offlinePaymentApproved ? (
                  <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">אישור חריג מנהל (מזומן) 🛡️</span>
                ) : (
                  <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded animate-pulse">חוב / לא שולם ❌</span>
                )}
              </div>

              <div>גיל: <span className="font-bold">{activeUser.age}</span> | מין: <span className="font-bold">{activeUser.gender === Gender.FEMALE ? 'נקבה 🚺' : 'זכר 🚹'}</span></div>
              <div>תוקף מנוי: <span className="font-mono font-semibold">{activeUser.membershipExpiry}</span></div>
              <div>דירוג עדיפות בתור: <span className="font-bold text-slate-800">{activeUser.priorityScore}/100</span></div>

              {/* FAMILY MEMBERSHIP DETAILED BANNER */}
              {activeUser.familyId && (
                <div className="col-span-1 sm:col-span-2 mt-2 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 p-3 rounded-xl text-purple-950 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-xs flex items-center gap-1.5 text-purple-900">
                      <span>👨‍👩‍👧‍👦</span>
                      <span>מנוי משפחתי מאוחד: {activeUser.familyName || 'משפחת לוי'}</span>
                    </div>
                    <span className="text-[10px] bg-purple-200/80 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                      {activeUser.isFamilyPayer ? '💳 ראש משפחה (משלם ראשי)' : `💳 ממומן ע"י: ${users.find(u => u.id === activeUser.familyPayerId)?.name || 'ראש משפחה'}`}
                    </span>
                  </div>

                  <p className="text-[11px] text-purple-800">
                    התשלום למנוי מבוצע במרוכז על ידי ראש המשפחה. לכל בן משפחה יש משתמש אישי מותאם לפי גיל, מין, וסוג האימון המבוקש (קבוצתי / אישי).
                  </p>

                  {/* Family Members Breakdown */}
                  {activeUser.familyId && (
                    <div className="pt-2 border-t border-purple-200/60 space-y-1.5">
                      <div className="text-[10px] font-bold text-purple-900">חברי המשפחה הרשומים במנוי:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {users.filter(u => u.familyId === activeUser.familyId).map((fMember) => (
                          <div 
                            key={fMember.id}
                            className={`p-2 rounded-lg text-[11px] border transition ${
                              fMember.id === activeUser.id 
                                ? 'bg-white border-purple-400 shadow-sm ring-1 ring-purple-300' 
                                : 'bg-white/60 border-purple-100 hover:bg-white'
                            }`}
                          >
                            <div className="font-bold text-slate-800 flex items-center justify-between">
                              <span>{fMember.name} {fMember.id === activeUser.id && '(את/ה)'}</span>
                              <span className="text-[9px] text-purple-700 font-semibold">
                                {fMember.isFamilyPayer ? '👑 משלם' : '👤 בן משפחה'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">
                              גיל: {fMember.age} | {fMember.gender === Gender.FEMALE ? 'נקבה' : 'זכר'}
                            </div>
                            <div className="text-[10px] text-indigo-700 font-semibold mt-1 flex flex-wrap gap-1">
                              {fMember.secondaryMemberships && fMember.secondaryMemberships.length > 0 ? (
                                fMember.secondaryMemberships.map((m, i) => (
                                  <span key={i} className="bg-indigo-50 px-1 py-0.5 rounded text-[9px]">
                                    {MEMBERSHIP_TYPE_LABELS[m]?.label || m}
                                  </span>
                                ))
                              ) : (
                                <span className="bg-purple-100/70 px-1 py-0.5 rounded text-[9px]">👥 קבוצתי + Open Gym</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GROUP MONTHLY SUBSCRIPTION */}
              {activeUser.membershipType === MembershipType.GROUP_MONTHLY && (
                <div className="col-span-1 sm:col-span-2 mt-1 text-[11px] bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-950 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-emerald-900 block">👥 קבוצתי חודשי – ללא התחייבות</span>
                      <p className="text-[10px] text-emerald-800 mt-0.5">
                        מנוי חודשי מתחדש לאימונים קבוצתיים. גישה מלאה לכל אימוני הסטודיו.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSwitchMembershipType(MembershipType.GROUP_ANNUAL)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg shadow-sm transition shrink-0 self-start sm:self-center"
                    >
                      ⭐ שדרג לקבוצתי שנתי
                    </button>
                  </div>
                </div>
              )}

              {/* GROUP ANNUAL SUBSCRIPTION */}
              {activeUser.membershipType === MembershipType.GROUP_ANNUAL && (
                <div className="col-span-1 sm:col-span-2 mt-1 text-[11px] bg-sky-50 border border-sky-200 p-3 rounded-xl text-sky-950 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-sky-900 block">⭐ קבוצתי שנתי – התחייבות לשנה</span>
                      <p className="text-[10px] text-sky-800 mt-0.5">
                        מנוי שנתי מוזל לאימונים קבוצתיים. זכות להקפאת מנוי עד חודש אחד בשנה.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSwitchMembershipType(MembershipType.GROUP_MONTHLY)}
                      className="bg-sky-700 hover:bg-sky-800 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg shadow-sm transition shrink-0 self-start sm:self-center"
                    >
                      🔄 מעבר לקבוצתי חודשי
                    </button>
                  </div>
                </div>
              )}

              {/* OPEN GYM MONTHLY / ANNUAL / PUNCH CARD */}
              {(activeUser.membershipType === MembershipType.OPEN_MONTHLY || activeUser.membershipType === MembershipType.OPEN_ANNUAL) && (
                <div className="col-span-1 sm:col-span-2 mt-1 text-[11px] bg-purple-50 border border-purple-200 p-2.5 rounded-xl text-purple-950">
                  <strong>🔓 מנוי פתוח (Open Gym):</strong> כולל גישה חופשית למתחם האימון העצמאי + תוכנית אימון מותאמת אישית מובנית!
                </div>
              )}

              {activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD && (
                <div className="col-span-1 sm:col-span-2 mt-1 text-[11px] bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <strong>🎟️ פתוח - כרטיסייה:</strong> כניסות גמישות למתחם האימונים.
                    <div className="mt-0.5">
                      יתרת ניקובים בכרטיסייה: <strong className="text-amber-800 text-sm font-mono">{activeUser.punchCardRemaining ?? 0} ניקובים</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPunchCardModal(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-md shadow-sm transition shrink-0"
                  >
                    💳 טעינת כרטיסייה
                  </button>
                </div>
              )}

              {activeUser.membershipType !== MembershipType.OPEN_PUNCH_CARD && (
                <div className="col-span-1 sm:col-span-2 mt-1">
                  <button
                    onClick={() => setShowPunchCardModal(true)}
                    className="text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-semibold py-1 px-2.5 rounded-md transition inline-flex items-center gap-1"
                  >
                    🎟️ רכישת כרטיסיית אימונים מוגבלת (קבוצתיים / Open Gym)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rapid PWA Action QR Code Badge (Section 9) */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 flex flex-col items-center justify-center text-center self-stretch">
          <QrCode className="text-emerald-600 animate-pulse" size={40} />
          <button
            onClick={() => setActiveTab('card')}
            className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition flex items-center gap-1 bg-white border border-emerald-200 py-1.5 px-3 rounded-lg"
            id="btn-open-scan-pwa"
          >
            כרטיס דיגיטלי וסורק קוד 📱
          </button>
        </div>
      </div>

      {/* Trainee Navigation Links */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl gap-1 overflow-x-auto border border-slate-800" id="trainee-tabs">
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
            activeTab === 'classes' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          📅 הרשמה לאימונים
        </button>
        <button
          onClick={() => setActiveTab('opengym')}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
            activeTab === 'opengym' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          🏋️ Open Gym
        </button>
        <button
          onClick={() => setActiveTab('workout')}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
            activeTab === 'workout' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          💪 תוכנית אימונים
        </button>
        <button
          onClick={() => setActiveTab('nutrition')}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
            activeTab === 'nutrition' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          🥑 תפריט תזונה
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition shrink-0 relative cursor-pointer ${
            activeTab === 'messages' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          💬 שיחה עם מאמן
        </button>
        <button
          onClick={() => setActiveTab('notices')}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition shrink-0 relative cursor-pointer ${
            activeTab === 'notices' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          📢 הודעות ממוקדות ({targetedAnnouncements.length})
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-md border border-slate-100 min-h-[400px]">
        
        {/* TAB 1: CLASSES BOOKING */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            {/* WEEKLY CALENDAR FOR TRAINEE */}
            <WeeklyCalendar
              role={UserRole.TRAINEE}
              activeUser={activeUser}
              sessions={sessions}
              openGymSessions={openGymSessions}
              users={users}
              onBookSession={handleBookSession}
              onCancelBooking={(sessionId) => {
                const s = sessions.find(item => item.id === sessionId);
                if (s) handleCancelBooking(s);
              }}
              onBookOpenGym={handleBookOpenGym}
              onCancelOpenGym={(ogId) => {
                const og = openGymSessions.find(item => item.id === ogId);
                if (og) handleCancelOpenGym(og);
              }}
              checkBookingEligibility={checkBookingEligibility}
            />

            <div className="flex justify-between items-center border-b border-slate-100 pb-3 pt-4">
              <h3 className="text-sm font-bold text-slate-800">אימונים קבוצתיים ברשימה</h3>
              {activePenaltiesCount > 0 && (
                <span className="bg-rose-100 text-rose-800 font-semibold text-[10px] px-2 py-1 rounded-full border border-rose-200">
                  ⚠️ יש לך {activePenaltiesCount} נקודות שחורות פעילות לחובתך!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map(s => {
                const booked = isBooked(s);
                const waitlisted = isWaitlisted(s);
                const isFull = s.registeredUsers.length >= s.maxParticipants;
                const checkResult = checkBookingEligibility(s);
                
                return (
                  <div key={s.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col justify-between" id={`booking-card-${s.id}`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">{s.title}</h4>
                          <span className="text-[10px] text-slate-400">מאמן: {s.coachName}</span>
                        </div>
                        <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                          {s.muscleGroup}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-center text-[10px] bg-white rounded p-2 my-3 border border-slate-100">
                        <div className="border-l border-slate-100">
                          <div className="text-slate-400">מועד</div>
                          <div className="font-semibold font-mono text-slate-700">{s.date}</div>
                        </div>
                        <div className="border-l border-slate-100">
                          <div className="text-slate-400">שעה</div>
                          <div className="font-semibold font-mono text-slate-700">{s.time}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">רשומים</div>
                          <div className={`font-semibold ${isFull ? 'text-rose-500' : 'text-slate-700'}`}>
                            {s.registeredUsers.length} / {s.maxParticipants}
                          </div>
                        </div>
                      </div>

                      {/* Requirement restrictions display */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.ageMin && (
                          <span className="text-[8px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded">גיל: {s.ageMin}+</span>
                        )}
                        {s.genderRestriction !== Gender.ALL && (
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1 py-0.5 rounded">
                            {s.genderRestriction === Gender.FEMALE ? 'נשים בלבד 🚺' : 'גברים בלבד 🚹'}
                          </span>
                        )}
                        {s.allowedMemberships.length < 5 && (
                          <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-1 py-0.5 rounded">
                            VIP בלבד
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          {booked && <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">✓ רשום לאימון!</span>}
                          {waitlisted && (
                            <span className="text-xs text-amber-600 font-bold flex items-center gap-0.5">
                              ⏳ בתור המתנה (מיקום: {s.waitlistUsers.indexOf(activeUser.id) + 1})
                            </span>
                          )}
                        </div>
                        
                        {/* Google and Apple Calendar integrations */}
                        {(booked || waitlisted) && (
                          <div className="flex gap-1.5">
                            <a
                              href={getGoogleCalendarLink(s)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5 border border-slate-200 py-1 px-2 rounded bg-white"
                              title="סנכרן ליומן גוגל"
                            >
                              Google 🗓️
                            </a>
                            <button
                              onClick={() => downloadIcsFile(s)}
                              className="text-[9px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5 border border-slate-200 py-1 px-2 rounded bg-white"
                              title="הורד קובץ יומן Apple"
                            >
                              Apple 🗓️
                            </button>
                          </div>
                        )}
                      </div>

                      {booked || waitlisted ? (
                        <button
                          onClick={() => handleCancelBooking(s)}
                          className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 py-2 rounded-lg text-xs font-semibold transition"
                          id={`btn-cancel-session-${s.id}`}
                        >
                          {waitlisted ? 'בטל המתנה' : 'בטל הרשמה לאימון'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBookSession(s)}
                          disabled={!checkResult.eligible && activeUser.membershipStatus !== MembershipStatus.ACTIVE}
                          className={`w-full py-2 rounded-lg text-xs font-semibold transition ${
                            !checkResult.eligible
                              ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                              : isFull
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          id={`btn-book-session-${s.id}`}
                        >
                          {isFull ? 'היכנס לתור המתנה' : 'הרשם לאימון'}
                        </button>
                      )}
                      
                      {/* Booking restriction detail */}
                      {!booked && !waitlisted && !checkResult.eligible && (
                        <span className="text-[10px] text-rose-500 font-medium text-center bg-rose-50 p-1.5 rounded border border-rose-100">
                          ⚠️ {checkResult.reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: OPEN GYM BOOKINGS */}
        {activeTab === 'opengym' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Open Gym – שעות אימון חופשיות</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                רשום את הגעתך מראש כדי להבטיח מקום פנוי במכשירים. מגבלת התפוסה בשעות אלו מבוקרת אוטומטית. הכניסה בפועל תתועד בסריקה דיגיטלית בלובי.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {openGymSessions.map(og => {
                const booked = isOpenGymBooked(og);
                const waitlisted = isOpenGymWaitlisted(og);
                const isFull = og.registeredUsers.length >= og.maxParticipants;
                
                return (
                  <div key={og.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col justify-between" id={`opengym-card-${og.id}`}>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded">
                          אימון חופשי
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{og.date}</span>
                      </div>

                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" />
                        טווח שעות: {og.timeSlot}
                      </h4>

                      <div className="flex justify-between text-xs text-slate-500 py-2 border-y border-slate-200">
                        <span>תפוסה:</span>
                        <strong className={isFull ? 'text-rose-500' : 'text-slate-700'}>
                          {og.registeredUsers.length} / {og.maxParticipants}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        {booked && <span className="text-xs text-emerald-600 font-bold">✓ רשום בהצלחה</span>}
                        {waitlisted && <span className="text-xs text-amber-600 font-bold">⏳ ממתין בתור</span>}
                      </div>

                      {booked || waitlisted ? (
                        <button
                          onClick={() => handleCancelOpenGym(og)}
                          className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          בטל שריון
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBookOpenGym(og)}
                          className={`w-full py-1.5 rounded-lg text-xs font-semibold transition ${
                            isFull 
                              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isFull ? 'הצטרף לתור המתנה' : 'שריין כניסה'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: WORKOUT PLANS WITH DEMO MEDIA & MUSCLE TARGETING */}
        {activeTab === 'workout' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">תוכנית אימונים אישית</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {traineeWorkout 
                    ? `נבנתה עבורך ע"י המאמן: ${traineeWorkout.coachName} (עודכנה בתאריך: ${traineeWorkout.lastUpdated})`
                    : 'לא הוגדרה לך תוכנית אימון פעילה כעת.'
                  }
                </p>
              </div>

              {/* Status Banner / Request button based on user membership */}
              {activeUser.membershipType === MembershipType.OPEN_MONTHLY || activeUser.membershipType === MembershipType.OPEN_ANNUAL || activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD ? (
                <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold px-3 py-1 rounded-lg">
                  🔓 מנוי Open Gym - חובה תוכנית אימונים אישית שנבנית ע"י המאמן
                </span>
              ) : (
                <div>
                  {activeUser.requestedWorkoutPlan ? (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-3 py-1 rounded-lg">
                      ⏳ לבקשתך, נשלחה פנייה למאמן לבניית תוכנית אימונים אישית
                    </span>
                  ) : (
                    <button
                      onClick={handleRequestWorkoutPlan}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xs transition"
                    >
                      🏋️ בקש תוכנית אימונים מותאמת מהמאמן
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Program Notice */}
            {activeUser.membershipType === MembershipType.OPEN_MONTHLY || activeUser.membershipType === MembershipType.OPEN_ANNUAL || activeUser.membershipType === MembershipType.OPEN_PUNCH_CARD ? (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-900">
                <span className="font-bold block mb-0.5">מנוי Open Gym בלבד:</span>
                <span className="text-[11px] text-purple-800">על פי תקנון המועדון, מנוי אימונים פתוחים מחויב בתוכנית אימונים אישית שנבנית ומוגדרת על ידי המאמן.</span>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                💡 בשאר סוגי המנויים תוכנית אימונים אישית אינה חובה, אך קיימת אופציה לבקש מהמאמן תוכנית אישית מותאמת מתי שתרצה.
              </div>
            )}

            {traineeWorkout && traineeWorkout.exercises.length > 0 ? (
              <div className="space-y-6">
                {/* Visual Muscle Allocation Stats Tracker (Section 7) */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1">
                    <TrendingUp size={14} className="text-emerald-500" />
                    התפלגות תרגילים לפי אזורי שריר בתוכנית שלך
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { id: MuscleGroup.UPPER, label: 'פלג גוף עליון', color: 'bg-emerald-500' },
                      { id: MuscleGroup.LEGS, label: 'רגליים וישבן', color: 'bg-sky-500' },
                      { id: MuscleGroup.BACK, label: 'גב', color: 'bg-indigo-500' },
                      { id: MuscleGroup.SHOULDERS, label: 'כתפיים', color: 'bg-amber-500' },
                      { id: MuscleGroup.CORE, label: 'בטן וליבה', color: 'bg-purple-500' },
                      { id: MuscleGroup.FUNCTIONAL, label: 'פונקציונלי', color: 'bg-rose-500' }
                    ].map(group => {
                      const count = workoutMuscleGroupsStats[group.id] || 0;
                      const percentage = traineeWorkout.exercises.length > 0 ? (count / traineeWorkout.exercises.length) * 100 : 0;
                      return (
                        <div key={group.id} className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-xs flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 font-medium truncate">{group.label}</span>
                          <div className="flex items-end justify-between mt-1">
                            <span className="text-lg font-bold font-mono text-slate-800">{count}</span>
                            <span className="text-[9px] text-slate-400">תרגילים</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className={`${group.color} h-full`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {traineeWorkout.exercises.map(ex => (
                    <div key={ex.id} className="border border-slate-150 rounded-xl p-4 bg-white flex flex-col justify-between hover:shadow-md transition">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded">
                            {ex.category}
                          </span>
                          <span className="bg-emerald-50 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                            {ex.muscleGroup}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-800 text-sm">{ex.name}</h4>

                        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-2 my-3 text-center border border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">סטים</span>
                            <span className="font-bold font-mono text-slate-800 text-xs">{ex.sets}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">חזרות</span>
                            <span className="font-bold font-mono text-slate-800 text-xs">{ex.reps}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">משקל</span>
                            <span className="font-bold font-mono text-emerald-600 text-xs truncate">{ex.weight || 'גוף'}</span>
                          </div>
                        </div>

                        {ex.notes && (
                          <p className="text-xs text-slate-500 italic bg-amber-50/30 p-2.5 rounded border border-amber-100/30 mb-3">
                            💡 {ex.notes}
                          </p>
                        )}
                      </div>

                      {ex.mediaUrl && (
                        <div className="rounded-lg overflow-hidden border border-slate-100 h-32 relative mt-2">
                          <img
                            src={ex.mediaUrl}
                            alt={ex.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white rounded px-2 py-0.5 text-[8px] flex items-center gap-1 font-semibold">
                            <Video size={10} />
                            הדגמת וידאו מצורפת
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                המאמן שלך לא הזין תרגילים בתוכנית שלך עדיין. שלח לו הודעה בצ'אט לזירוז!
              </div>
            )}
          </div>
        )}

        {/* TAB 4: NUTRITION GUIDES */}
        {activeTab === 'nutrition' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">תפריט ותוכנית תזונה מותאמת אישית</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {traineeNutrition 
                    ? `נבנה ע"י המאמן: ${traineeNutrition.coachName} (עודכן לאחרונה: ${traineeNutrition.lastUpdated})`
                    : 'תוכנית תזונה מותאמת אישית נבנית ע"י המאמן בתשלום נוסף פרטני.'
                  }
                </p>
              </div>

              {(activeUser.nutritionPlanPaid || traineeNutrition?.isPaid) ? (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-3 py-1 rounded-lg">
                  ✅ שולם (150 ₪) - תוכנית תזונה מורשית
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-3 py-1 rounded-lg">
                  🔒 בתשלום נוסף פרטני (150 ₪)
                </span>
              )}
            </div>

            {/* Check payment state */}
            {!(activeUser.nutritionPlanPaid || traineeNutrition?.isPaid) ? (
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                <div className="text-2xl">🥑</div>
                <h4 className="text-sm font-bold text-amber-900">תוכנית תזונה מותאמת אישית בתשלום נוסף פרטני</h4>
                <p className="text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
                  התוכנית נבנית ע"י המאמן המקצועי בהתאמה מדויקת ליעדי הגוף, הגובה, המשקל והתזונה שלך. התוכנית כוללת יעד קלוריות יומי, פירוט חלבון, פחמימות ושומנים, והנחיות ארוחות מפורטות.
                </p>
                <button
                  onClick={handlePayNutritionPlan}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
                >
                  💳 בצע תשלום עבור תוכנית תזונה (150 ₪)
                </button>
              </div>
            ) : traineeNutrition ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <div className="text-[10px] text-emerald-700 font-semibold font-sans">צריכה קלורית יומית</div>
                    <div className="text-lg font-bold font-mono text-emerald-950 mt-1">{traineeNutrition.dailyCalories} kcal</div>
                  </div>
                  <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
                    <div className="text-[10px] text-sky-700 font-semibold font-sans">חלבון</div>
                    <div className="text-lg font-bold font-mono text-sky-950 mt-1">{traineeNutrition.proteinGrams} גרם</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <div className="text-[10px] text-amber-700 font-semibold font-sans">פחמימות</div>
                    <div className="text-lg font-bold font-mono text-amber-950 mt-1">{traineeNutrition.carbsGrams} גרם</div>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                    <div className="text-[10px] text-rose-700 font-semibold font-sans">שומנים</div>
                    <div className="text-lg font-bold font-mono text-rose-950 mt-1">{traineeNutrition.fatGrams} גרם</div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-xl p-5">
                  <span className="block text-xs font-bold text-slate-700 mb-3">חלוקת ארוחות והנחיות מיוחדות מהמאמן:</span>
                  <pre className="text-xs text-slate-600 font-sans whitespace-pre-wrap leading-relaxed bg-white border border-slate-100 rounded-lg p-4">
                    {traineeNutrition.mealsDescription}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-600 text-xs space-y-2">
                <div className="font-bold text-emerald-700 text-sm">✅ התשלום עבור תוכנית התזונה התקבל בהצלחה!</div>
                <div>המאמן נחשף לבקשתך ושוקד כעת על הרכבת תפריט התזונה והמאקרו המותאם אישית עבורך.</div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: COACH CHAT */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">פנייה ותקשורת מול המאמן האישי</h3>
                <p className="text-xs text-slate-500">הודעות דו-כיווניות אישיות לבירורים ועדכון התקדמות.</p>
              </div>

              {/* Selector to choose coach to text */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">בחר מאמן לשיחה:</span>
                <select
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {users.filter(u => u.role === UserRole.COACH).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl h-[300px] bg-slate-50 p-4 overflow-y-auto flex flex-col gap-3" id="trainee-chat-window">
              {chatMessages.length > 0 ? (
                chatMessages.map(m => {
                  const isMe = m.senderId === activeUser.id;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-xl p-3 text-xs ${
                        isMe
                          ? 'bg-sky-600 text-white self-start rounded-tr-none'
                          : 'bg-white border border-slate-200 text-slate-800 self-end rounded-tl-none'
                      }`}
                    >
                      {!isMe && <div className="font-semibold text-[9px] text-slate-400 mb-0.5">{m.senderName}</div>}
                      <div>{m.content}</div>
                      <div className="text-[9px] mt-1 text-right opacity-70 font-mono">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center m-auto text-slate-400 text-xs">
                  אין שיחות קודמות. כתוב הודעה מטה לפתיחת פנייה למאמן!
                </div>
              )}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="כתוב למאמן שלך כאן..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white p-2.5 rounded-lg transition"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 6: TARGETED ANNOUNCEMENTS (CRITICAL SECTION 14) */}
        {activeTab === 'notices' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800">לוח מודעות ועדכוני מועדון</h3>
                <p className="text-xs text-slate-500 mt-0.5">ההודעות מותאמות אליך באופן אישי לפי גיל, מין וסוג מנוי.</p>
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] border border-indigo-100 font-bold px-2 py-1 rounded-full">
                {targetedAnnouncements.length} מודעות מטורגטות עבורך
              </span>
            </div>

            <div className="space-y-4">
              {targetedAnnouncements.map(ann => (
                <div key={ann.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/50 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">
                      {ann.creatorRole === UserRole.MANAGER ? 'מנהל מועדון' : 'צוות מאמנים'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{ann.date}</span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm">{ann.title}</h4>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                </div>
              ))}
              {targetedAnnouncements.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  אין הודעות חדשות ממוקדות עבורך כרגע.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: DIGITAL CARD & BARCODE (Section 9) */}
        {activeTab === 'card' && (
          <div className="space-y-6 flex flex-col items-center justify-center py-6 text-center">
            <h3 className="text-sm font-bold text-slate-800">כרטיס מנוי דיגיטלי וצ'ק-אין PWA</h3>
            
            {/* Simulation card layout */}
            <div className="w-72 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl p-6 border border-slate-700 relative overflow-hidden" id="digital-pwa-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -z-1" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-bold text-md tracking-tight font-sans text-emerald-400">GymFit Premium</h4>
                  <span className="text-[8px] text-slate-400 font-mono uppercase">MOBILE MEMBERSHIP</span>
                </div>
                <span className="bg-emerald-500 text-slate-900 font-mono font-bold text-[8px] px-2 py-0.5 rounded-full">
                  {activeUser.membershipType}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <img
                  src={activeUser.imageUrl}
                  alt={activeUser.name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-600"
                />
                <div className="text-right">
                  <div className="font-bold text-xs text-white">{activeUser.name}</div>
                  <div className="text-[9px] text-slate-400 font-mono">ID: {activeUser.id}</div>
                </div>
              </div>

              {/* simulated barcode scanner */}
              <div className="bg-white rounded-lg p-3 flex flex-col items-center justify-center mb-4">
                <div className="w-full flex items-center justify-between font-mono tracking-widest text-slate-900 select-none">
                  <span>||| | |||| || | |||| || |||</span>
                  <span className="text-[9px] font-bold">SCAN ME</span>
                </div>
                <div className="text-[9px] text-slate-400 font-mono mt-1">GymFit-{activeUser.id}</div>
              </div>

              <div className="text-[8px] text-slate-400">
                הצמד את הקוד לקורא הברקודים בכניסה למועדון לרישום נוכחות
              </div>
            </div>

            {/* Simulating QR Checkin click buttons for testing */}
            <div className="w-full max-w-sm bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">סימולטור סורק נוכחות (Check-in) בכניסה</span>
              <p className="text-[10px] text-slate-400">
                סמל סריקה דיגיטלית של המנוי שלך בקבלה. לחיצה על הכפתורים מטה מדמה סריקת כרטיס עבור אימון שרשום אליו:
              </p>

              <div className="space-y-2">
                {/* Booked Classes Checkins */}
                {sessions.filter(isBooked).map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSimulateCheckIn('SESSION', s.id, s.title)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition flex items-center justify-between"
                  >
                    <span>סרוק והצהר נוכחות ב-{s.title}</span>
                    <span className="font-mono text-[9px] opacity-80">{s.time}</span>
                  </button>
                ))}

                {/* Booked Open Gym Checkins */}
                {openGymSessions.filter(isOpenGymBooked).map(og => (
                  <button
                    key={og.id}
                    onClick={() => handleSimulateCheckIn('OPEN_GYM', og.id, `Open Gym ${og.timeSlot}`)}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition flex items-center justify-between"
                  >
                    <span>סרוק והצהר נוכחות ב-Open Gym</span>
                    <span className="font-mono text-[9px] opacity-80">{og.timeSlot.split(' ')[0]}</span>
                  </button>
                ))}

                {sessions.filter(isBooked).length === 0 && openGymSessions.filter(isOpenGymBooked).length === 0 && (
                  <div className="text-center p-3 text-slate-400 text-[10px] border border-dashed border-slate-200 rounded-lg">
                    עליך להירשם לאימון או ל-Open Gym תחילה כדי להצהיר הגעה.
                  </div>
                )}
              </div>
            </div>

            {/* Logs view */}
            <div className="w-full max-w-md text-right">
              <h4 className="text-xs font-bold text-slate-700 mb-2">היסטוריית כניסות וצ'ק-אין במועדון</h4>
              <div className="border border-slate-150 rounded-xl p-3 bg-slate-50 space-y-2 max-h-40 overflow-y-auto">
                {attendanceLogs
                  .filter(log => log.traineeId === activeUser.id)
                  .map(log => (
                    <div key={log.id} className="bg-white rounded p-2 text-[10px] border border-slate-100 flex justify-between items-center font-mono">
                      <span className="text-slate-500 font-semibold">{log.date} - {log.timestamp}</span>
                      <span className="text-slate-800 font-sans">{log.targetTitle} ({log.type})</span>
                    </div>
                  ))}
                {attendanceLogs.filter(log => log.traineeId === activeUser.id).length === 0 && (
                  <div className="text-center text-slate-400 text-[10px] py-4">אין רישומי נוכחות קודמים בדפדפן זה.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* PUNCH CARD PURCHASE MODAL */}
      {showPunchCardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-right" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎟️</span>
                <h3 className="text-base font-bold text-slate-900">רכישת / טעינת כרטיסיית אימונים</h3>
              </div>
              <button
                onClick={() => setShowPunchCardModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              מנוי כרטיסייה מאפשר רכישה של מספר מוגבל של אימונים (אימונים קבוצתיים או Open Gym).
              בכל הרשמה לאימון יורד ניקוב אחד. בביטול בזמן, הניקוב מוחזר אוטומטית ליתרה.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 block">בחר חבילת כרטיסייה:</label>
              
              <div className="grid grid-cols-1 gap-2.5 text-xs">
                {[
                  { count: 5, price: 250, months: 3, label: 'כרטיסיית 5 אימונים', desc: '₪50 לאימון | תקפה ל-3 חודשים' },
                  { count: 10, price: 450, months: 6, label: 'כרטיסיית 10 אימונים 🌟', desc: '₪45 לאימון | תקפה ל-6 חודשים (חבילה מומלצת)' },
                  { count: 20, price: 800, months: 12, label: 'כרטיסיית 20 אימונים 🏆', desc: '₪40 לאימון | תקפה ל-12 חודשים' }
                ].map((pkg) => (
                  <label
                    key={pkg.count}
                    onClick={() => setSelectedPunchCardPackage({ count: pkg.count, price: pkg.price, months: pkg.months })}
                    className={`border rounded-xl p-3.5 cursor-pointer transition flex items-center justify-between ${
                      selectedPunchCardPackage.count === pkg.count
                        ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-400/50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="punch_card_pkg"
                        checked={selectedPunchCardPackage.count === pkg.count}
                        onChange={() => {}}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{pkg.label}</div>
                        <div className="text-[11px] text-slate-500">{pkg.desc}</div>
                      </div>
                    </div>
                    <div className="text-left font-mono font-black text-amber-900 text-sm">
                      ₪{pkg.price}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
              <div>💳 <strong>אופן תשלום:</strong> חיוב מיידי MOCK באשראי שמור במערכת.</div>
              <div>✅ היתרה תתעדכן מיידית בחשבונך באפליקציה לאחר האישור.</div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowPunchCardModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                ביטול
              </button>
              <button
                onClick={handlePurchasePunchCard}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>אשר ורכוש כרטיסייה (₪{selectedPunchCardPackage.price})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
