/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
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
  Exercise,
  Gender,
  MembershipStatus,
  MembershipType,
  DEFAULT_MEMBERSHIP_PLAN_CONFIGS,
  MEMBERSHIP_TYPE_LABELS,
  MEMBERSHIP_PRICES,
  PaymentPurchaseVariant,
  TRAINING_CARD_SIZES,
  TrainingCardSize,
  UserRole,
  DiscountCode,
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  GroupWorkoutProgram
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
  ChevronRight,
  TrendingUp,
  UserCheck,
  Send,
  Grid,
  Home,
  Dumbbell,
  CreditCard,
  LogOut,
  Pencil,
  UserRound,
  WalletCards,
  MonitorPlay,
  HeartPulse,
  Camera
} from 'lucide-react';
import { getGoogleCalendarLink, downloadIcsFile } from './CalendarSync';
import { ExerciseMedia } from './ExerciseMedia';
import { CLUB_CHECK_IN_CODE } from './ClubCheckInBarcode';
import {
  clearCardcomReturnParams,
  clearPendingCardcomPayment,
  getPendingCardcomPayment,
  isCardcomConfigured,
  markTransactionProcessed,
  startCardcomPayment,
  VerifiedCardcomPayment,
  verifyPendingCardcomPayment,
  wasTransactionProcessed
} from '../data/cardcomPayments';
import {
  addCalendarMonths,
  canUseAnnualFreeze,
  createMembershipTerm,
  isMembershipCancellationEffective,
  isMembershipFreezeActive,
  toLocalIsoDate
} from '../data/membershipPolicy';
import { DiscountCodeField } from './DiscountCodeField';
import { FamilyPlanConfigurator } from './FamilyPlanConfigurator';
import { familyPurchaseAmount, resizeFamilyPlans } from '../data/familyMembership';

interface TraineeDashboardProps {
  activeUser: User;
  users: User[];
  sessions: TrainingSession[];
  openGymSessions: OpenGymSession[];
  workoutPlans: WorkoutPlan[];
  groupWorkoutPrograms: GroupWorkoutProgram[];
  nutritionPlans: NutritionPlan[];
  blackPoints: BlackPoint[];
  messages: Message[];
  announcements: Announcement[];
  payments: Payment[];
  attendanceLogs: AttendanceLog[];
  discountCodes: DiscountCode[];
  settings: SystemSettings;
  onUpdateSessions: (sessions: TrainingSession[]) => void;
  onUpdateOpenGym: (openGyms: OpenGymSession[]) => void;
  onUpdateAttendance: (logs: AttendanceLog[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateBlackPoints: (points: BlackPoint[]) => void;
  onUpdatePayments: (payments: Payment[]) => void;
  onSendMessage: (content: string, receiverId: string) => void;
  onOpenSettings: (section?: 'profile' | 'health' | 'family') => void;
  onLogout: () => void;
  initialTab?: 'home' | 'classes' | 'opengym' | 'workout' | 'nutrition' | 'messages' | 'notices' | 'card' | 'profile' | 'membership';
  onHome?: () => void;
}

export const TraineeDashboard: React.FC<TraineeDashboardProps> = ({
  activeUser,
  users,
  sessions,
  openGymSessions,
  workoutPlans,
  groupWorkoutPrograms,
  nutritionPlans,
  blackPoints,
  messages,
  announcements,
  payments,
  attendanceLogs,
  discountCodes,
  settings,
  onUpdateSessions,
  onUpdateOpenGym,
  onUpdateAttendance,
  onUpdateUsers,
  onUpdateBlackPoints,
  onUpdatePayments,
  onSendMessage,
  onOpenSettings,
  onLogout,
  initialTab = 'home',
  onHome
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'classes' | 'opengym' | 'workout' | 'nutrition' | 'messages' | 'notices' | 'card' | 'profile' | 'membership'>(initialTab);
  const [selectedMembershipPurchase, setSelectedMembershipPurchase] = useState<MembershipType | null>(null);
  const [membershipPurchaseMode, setMembershipPurchaseMode] = useState<'PRIMARY' | 'ADDON'>('PRIMARY');
  const [trainingCardSize, setTrainingCardSize] = useState<TrainingCardSize>(1);
  const [paymentStarting, setPaymentStarting] = useState(false);
  const familyDraft = (() => {
    try { return JSON.parse(sessionStorage.getItem('baly_family_purchase_draft_v1') || 'null'); } catch { return null; }
  })();
  const [familyPurchaseName, setFamilyPurchaseName] = useState(familyDraft?.familyName || activeUser.familyName || `משפחת ${activeUser.name.split(' ')[0]}`);
  const [familyPurchaseCount, setFamilyPurchaseCount] = useState<number>(familyDraft?.familyQuota || activeUser.familyMembersCount || 2);
  const [familyBillingMode, setFamilyBillingMode] = useState<FamilyBillingMode>(familyDraft?.familyBillingMode || activeUser.familyBillingMode || 'ANNUAL_BY_SIZE');
  const familyUsers = [activeUser, ...users.filter(user => user.id !== activeUser.id && activeUser.familyId && user.familyId === activeUser.familyId)];
  const initialFamilyPlans = activeUser.familyMemberPlans?.length ? activeUser.familyMemberPlans : familyUsers.map(user => ({ memberId: user.id, memberName: user.name, membershipType: user.membershipType || MembershipType.OPEN_GYM }));
  const [familyMemberPlans, setFamilyMemberPlans] = useState<FamilyMemberPlanSelection[]>(() => resizeFamilyPlans(initialFamilyPlans, familyPurchaseCount, activeUser.name, activeUser.id));
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(1);
  const [demoExercise, setDemoExercise] = useState<Exercise | null>(null);
  const membershipPlanConfigs = (settings.membershipPlans?.length ? settings.membershipPlans : DEFAULT_MEMBERSHIP_PLAN_CONFIGS).filter(plan => plan.active);
  const primaryMembershipPlans = membershipPlanConfigs.filter(plan => plan.category === 'PRIMARY');
  const membershipAddOns = membershipPlanConfigs.filter(plan => plan.category === 'ADD_ON');
  const selectedMembershipConfig = membershipPlanConfigs.find(plan => plan.id === selectedMembershipPurchase);
  const selectedMembershipPrice = selectedMembershipConfig?.price ?? (selectedMembershipPurchase ? MEMBERSHIP_PRICES[selectedMembershipPurchase] : 0) ?? 0;
  const [selectedBookingDate, setSelectedBookingDate] = useState(() => toLocalIsoDate(new Date()));
  const [bookingView, setBookingView] = useState<'DAY' | 'WEEK'>('DAY');
  const [bookingNameFilter, setBookingNameFilter] = useState('');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'ALL' | 'GROUP' | 'PERSONAL' | 'OPEN_GYM'>('ALL');
  const [showAllBookingOptions, setShowAllBookingOptions] = useState(false);
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

  const freezeActive = isMembershipFreezeActive(activeUser);
  const freezeAvailable = canUseAnnualFreeze(activeUser);
  const cancellationEffective = isMembershipCancellationEffective(activeUser);
  const applySelectedDiscount = (amount: number) => appliedDiscount?.discountPercent
    ? Math.round(amount * (1 - appliedDiscount.discountPercent / 100))
    : Math.max(0, amount - (appliedDiscount?.discountAmount || 0));

  const applyVerifiedMembershipPayment = (
    purchasedType: MembershipType,
    mode: 'PRIMARY' | 'ADDON',
    verified: VerifiedCardcomPayment,
    purchaseVariant?: PaymentPurchaseVariant,
    familyMembersCount?: number,
    familyName?: string,
    purchasedFamilyBillingMode?: FamilyBillingMode,
    purchasedFamilyPlans?: FamilyMemberPlanSelection[]
  ) => {
    onUpdateUsers(users.map(user => {
      if (familyMembersCount && purchasedFamilyBillingMode === 'CUSTOM_COMBINED') {
        const plan = purchasedFamilyPlans?.find(item => item.memberId === user.id)
          || (user.id === activeUser.id ? purchasedFamilyPlans?.[0] : undefined);
        if (plan) {
          const isPayer = user.id === activeUser.id;
          const term = createMembershipTerm(plan.membershipType);
          const familyId = activeUser.familyId || `fam-${Date.now()}`;
          return {
            ...user,
            membershipType: plan.membershipType,
            membershipStatus: MembershipStatus.ACTIVE,
            ...term,
            familyId,
            familyName: familyName || activeUser.familyName || `משפחת ${activeUser.name.split(' ')[0]}`,
            isFamilyPayer: isPayer || undefined,
            familyPayerId: isPayer ? undefined : activeUser.id,
            familyMembersCount,
            familyBillingMode: purchasedFamilyBillingMode,
            familyMemberPlans: purchasedFamilyPlans,
            familyCombinedAmount: verified.amount,
            familyTrackName: 'משפחתי מותאם – תשלום מאוחד',
            personalTrainingCardSize: plan.membershipType === MembershipType.PERSONAL_TRAINING ? undefined : user.personalTrainingCardSize,
            personalTrainingRemaining: plan.membershipType === MembershipType.PERSONAL_TRAINING ? plan.trainingSessionsCount : user.personalTrainingRemaining,
            duoTrainingCardSize: plan.membershipType === MembershipType.DUO_TRAINING ? undefined : user.duoTrainingCardSize,
            duoTrainingRemaining: plan.membershipType === MembershipType.DUO_TRAINING ? plan.trainingSessionsCount : user.duoTrainingRemaining,
            nutritionPlanPaid: plan.membershipType === MembershipType.NUTRITION_COACHING ? true : user.nutritionPlanPaid,
            requestedWorkoutPlan: [MembershipType.WORKOUT_COACHING, MembershipType.OPEN_GYM_WITH_PLAN].includes(plan.membershipType) ? true : user.requestedWorkoutPlan
          };
        }
      }
      if (user.id !== activeUser.id) return user;
      if (mode === 'PRIMARY') {
        const membershipTerm = createMembershipTerm(familyMembersCount && purchasedFamilyBillingMode === 'ANNUAL_BY_SIZE' ? MembershipType.GROUP_ANNUAL : purchasedType);
        return {
          ...user,
          membershipType: purchasedType,
          membershipStatus: MembershipStatus.ACTIVE,
          ...membershipTerm,
          isMembershipFrozen: false,
          membershipFreezeStartedAt: undefined,
          membershipFreezeUsedAt: undefined,
          membershipFrozenUntil: undefined,
          isCancelledEarly: false,
          cancellationRequestedAt: undefined,
          cancellationEffectiveDate: undefined,
          offlinePaymentApproved: false,
          ...(familyMembersCount ? {
            familyId: user.familyId || `fam-${Date.now()}`,
            familyName: familyName || user.familyName || `משפחת ${user.name.split(' ')[0]}`,
            isFamilyPayer: true,
            familyPayerId: undefined,
            familyMembersCount,
            familyBillingMode: purchasedFamilyBillingMode || 'ANNUAL_BY_SIZE',
            familyMemberPlans: purchasedFamilyPlans,
            familyCombinedAmount: verified.amount,
            familyTrackName: purchasedFamilyBillingMode === 'MONTHLY_PER_MEMBER' ? `משפחתי חודשי (${familyMembersCount} מתאמנים)` : `משפחתי שנתי (${familyMembersCount} מתאמנים)`
          } : {})
        };
      }

      const secondaryMemberships = user.secondaryMemberships || [];
      return {
        ...user,
        secondaryMemberships: secondaryMemberships.includes(purchasedType)
          ? secondaryMemberships
          : [...secondaryMemberships, purchasedType],
        nutritionPlanPaid: purchasedType === MembershipType.NUTRITION_COACHING ? true : user.nutritionPlanPaid,
        requestedWorkoutPlan: purchasedType === MembershipType.WORKOUT_COACHING ? true : user.requestedWorkoutPlan,
        personalTrainingCardSize: purchaseVariant?.startsWith('PERSONAL_') ? Number(purchaseVariant.split('_')[1]) as TrainingCardSize : user.personalTrainingCardSize,
        personalTrainingRemaining: purchaseVariant?.startsWith('PERSONAL_') ? (user.personalTrainingRemaining || 0) + Number(purchaseVariant.split('_')[1]) : user.personalTrainingRemaining,
        duoTrainingCardSize: purchaseVariant?.startsWith('DUO_') ? Number(purchaseVariant.split('_')[1]) as TrainingCardSize : user.duoTrainingCardSize,
        duoTrainingRemaining: purchaseVariant?.startsWith('DUO_') ? (user.duoTrainingRemaining || 0) + Number(purchaseVariant.split('_')[1]) : user.duoTrainingRemaining
      };
    }));

    onUpdatePayments([{
      id: `payment-cardcom-${verified.transactionId || verified.lowProfileId}`,
      traineeId: activeUser.id,
      traineeName: activeUser.name,
      amount: verified.amount,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      status: 'PAID',
      membershipTypePurchased: purchasedType,
      paymentMethod: `Cardcom${verified.last4Digits ? ` •••• ${verified.last4Digits}` : ''}`,
      isMock: false
    }, ...payments]);
  };

  useEffect(() => {
    const returnStatus = new URLSearchParams(window.location.search).get('cardcom');
    if (!returnStatus) return;
    const pending = getPendingCardcomPayment();
    if (returnStatus === 'failed') {
      clearCardcomReturnParams();
      setActiveTab('membership');
      showFeedback('התשלום לא הושלם. לא בוצע חיוב ולא בוצע שינוי במנוי.', 'error');
      return;
    }
    if (!pending || pending.mode === 'REGISTRATION' || pending.userId !== activeUser.id) return;
    const purchaseMode: 'PRIMARY' | 'ADDON' = pending.mode;

    setPaymentStarting(true);
    verifyPendingCardcomPayment(pending)
      .then(verified => {
        const transactionKey = verified.transactionId || verified.lowProfileId;
        if (!wasTransactionProcessed(transactionKey)) {
          applyVerifiedMembershipPayment(pending.membershipType, purchaseMode, verified, pending.purchaseVariant, pending.familyMembersCount, pending.familyName, pending.familyBillingMode, pending.familyMemberPlans);
          markTransactionProcessed(transactionKey);
        }
        clearPendingCardcomPayment();
        clearCardcomReturnParams();
        setActiveTab('membership');
        setSelectedMembershipPurchase(null);
        if (pending.familyMembersCount) sessionStorage.removeItem('baly_family_purchase_draft_v1');
        const purchasedLabel = membershipPlanConfigs.find(plan => plan.id === pending.membershipType)?.label || MEMBERSHIP_TYPE_LABELS[pending.membershipType]?.label || pending.membershipType;
        showFeedback(`${purchasedLabel} נרכש והופעל בהצלחה.`);
      })
      .catch(error => {
        clearCardcomReturnParams();
        setActiveTab('membership');
        showFeedback(error instanceof Error ? error.message : 'לא ניתן לאמת את התשלום.', 'error');
      })
      .finally(() => setPaymentStarting(false));
    // The Cardcom return is intentionally processed once when the dashboard mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: check if active trainee has booked a class/open gym
  const isBooked = (session: TrainingSession) => session.registeredUsers.includes(activeUser.id);
  const isWaitlisted = (session: TrainingSession) => session.waitlistUsers.includes(activeUser.id);
  
  // Helper: check if active trainee has booked Open Gym
  const isOpenGymBooked = (og: OpenGymSession) => og.registeredUsers.includes(activeUser.id);
  const isOpenGymWaitlisted = (og: OpenGymSession) => og.waitlistUsers.includes(activeUser.id);

  const isHealthDeclarationValid = () => {
    if (!activeUser.healthDeclarationSigned || !activeUser.healthDeclarationDate) return false;
    if (activeUser.healthDeclarationRequiresMedicalCertificate && !activeUser.healthDeclarationMedicalCertificateApproved) return false;
    const signedAt = new Date(`${activeUser.healthDeclarationDate}T00:00:00`);
    if (!Number.isFinite(signedAt.getTime())) return false;
    const expiresAt = new Date(signedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    return Date.now() <= expiresAt.getTime();
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.trim().split(':').map(Number);
    return hours * 60 + minutes;
  };

  const overlaps = (startA: number, endA: number, startB: number, endB: number) =>
    startA < endB && startB < endA;

  const hasOverlappingTraining = (session: TrainingSession) => {
    const start = timeToMinutes(session.time);
    const end = start + session.durationMinutes;
    return sessions.some(existing => {
      if (
        existing.id === session.id ||
        existing.date !== session.date ||
        !existing.registeredUsers.includes(activeUser.id)
      ) return false;
      const existingStart = timeToMinutes(existing.time);
      return overlaps(start, end, existingStart, existingStart + existing.durationMinutes);
    }) || openGymSessions.some(existing => {
      if (existing.date !== session.date || !existing.registeredUsers.includes(activeUser.id)) return false;
      const [slotStart, slotEnd] = existing.timeSlot.split('-').map(timeToMinutes);
      return overlaps(start, end, slotStart, slotEnd);
    });
  };

  // Check booking eligibility constraints (Section 5.1 & 11)
  const checkBookingEligibility = (session: TrainingSession): { eligible: boolean; reason?: string } => {
    if (isBooked(session) || isWaitlisted(session)) {
      return { eligible: false, reason: 'כבר נרשמת לאימון זה או לרשימת ההמתנה שלו.' };
    }

    if (!isHealthDeclarationValid()) {
      return {
        eligible: false,
        reason: 'הצהרת הבריאות חסרה או שתוקפה השנתי פג. יש לחתום מחדש בפרופיל לפני הרשמה לאימון.'
      };
    }

    // 0. Frozen Membership check
    if (freezeActive) {
      return {
        eligible: false,
        reason: `המנוי שלך מוקפא כעת (עד ${activeUser.membershipFrozenUntil || 'תום תקופת ההקפאה'}). לא ניתן להירשם לאימונים במהלך הקפאת מנוי.`
      };
    }

    // 1. Mandatory Pre-Payment check (including Family Payer inheritance)
    let isPaid = (activeUser.membershipStatus === MembershipStatus.ACTIVE || activeUser.offlinePaymentApproved) && !cancellationEffective;
    if (!isPaid && activeUser.familyPayerId) {
      const payer = users.find(u => u.id === activeUser.familyPayerId);
      if (payer && (payer.membershipStatus === MembershipStatus.ACTIVE || payer.offlinePaymentApproved) && !isMembershipCancellationEffective(payer)) {
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

    const payer = activeUser.familyPayerId ? users.find(user => user.id === activeUser.familyPayerId) : undefined;
    const effectiveExpiry = payer?.membershipExpiry || activeUser.membershipExpiry;
    const today = new Date().toISOString().split('T')[0];
    if (!effectiveExpiry || effectiveExpiry < today) {
      return {
        eligible: false,
        reason: 'תוקף המנוי פג. יש לחדש את המנוי לפני הרשמה לאימון.'
      };
    }

    if (hasOverlappingTraining(session)) {
      return {
        eligible: false,
        reason: 'לא ניתן להירשם לשני אימונים חופפים. יש לבטל את האימון הקיים או לבחור שעה אחרת.'
      };
    }

    // Consolidated list of all active membership types held by this user/family
    const userMemberships: MembershipType[] = [
      activeUser.membershipType,
      ...(activeUser.secondaryMemberships || [])
    ].filter(Boolean) as MembershipType[];

    const hasGroupAccess = userMemberships.some(m => 
      [MembershipType.CORE_GROUPS, MembershipType.YOUTH_TWICE_WEEKLY, MembershipType.YOUTH_ONCE_WEEKLY, MembershipType.DEDICATED_GROUP_HALF_YEAR, MembershipType.FAMILY_MEMBERSHIP, MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL, MembershipType.WEIGHT_LOSS_HALF_YEAR, MembershipType.POSTPARTUM_HALF_YEAR].includes(m)
    );

    const hasPersonalAccess = userMemberships.includes(MembershipType.PERSONAL_TRAINING);
    const hasDuoAccess = userMemberships.includes(MembershipType.DUO_TRAINING);
    const isDuoSession = Boolean(session.isPersonalTraining && session.coTrainees?.length);
    const dedicatedMemberships = userMemberships.filter(membership => [MembershipType.DEDICATED_GROUP_HALF_YEAR, MembershipType.WEIGHT_LOSS_HALF_YEAR, MembershipType.POSTPARTUM_HALF_YEAR].includes(membership));

    if (
      session.isPersonalTraining &&
      session.targetTraineeId &&
      session.targetTraineeId !== activeUser.id &&
      !session.coTrainees?.includes(activeUser.id)
    ) {
      return { eligible: false, reason: 'האימון האישי משויך למתאמן אחר.' };
    }

    if (dedicatedMemberships.length > 0 && !session.isPersonalTraining && !session.allowedMemberships?.some(membership => dedicatedMemberships.includes(membership))) {
      return { eligible: false, reason: 'האימון אינו שייך לקבוצה הייעודית החצי־שנתית שלך.' };
    }

    // Personal Training session check
    if (session.isPersonalTraining && ((isDuoSession && !hasDuoAccess) || (!isDuoSession && !hasPersonalAccess))) {
      return {
        eligible: false,
        reason: 'אימון אישי מצריך רכישת מסלול אימון אישי! (ניתן לרכוש אימון אישי במקביל לכל מנוי במערכת).'
      };
    }
    if (session.isPersonalTraining && ((isDuoSession ? activeUser.duoTrainingRemaining : activeUser.personalTrainingRemaining) ?? 0) <= 0) {
      return { eligible: false, reason: `אזלה יתרת כרטיסיית האימון ${isDuoSession ? 'הזוגי' : 'האישי'}. יש לרכוש כרטיסייה חדשה.` };
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
        ((hasPersonalAccess || hasDuoAccess) && session.isPersonalTraining);

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

  const checkOpenGymBookingEligibility = (og: OpenGymSession): { eligible: boolean; reason?: string } => {
    if (isOpenGymBooked(og) || isOpenGymWaitlisted(og)) return { eligible: false, reason: 'כבר נרשמת למשבצת זו.' };
    if (!isHealthDeclarationValid()) return { eligible: false, reason: 'נדרשת הצהרת בריאות בתוקף.' };
    if (freezeActive) return { eligible: false, reason: `המנוי מוקפא עד ${activeUser.membershipFrozenUntil || 'תום ההקפאה'}.` };

    const payer = activeUser.familyPayerId ? users.find(user => user.id === activeUser.familyPayerId) : undefined;
    const isPaid = (activeUser.membershipStatus === MembershipStatus.ACTIVE && !cancellationEffective)
      || activeUser.offlinePaymentApproved
      || Boolean(payer && (payer.membershipStatus === MembershipStatus.ACTIVE || payer.offlinePaymentApproved) && !isMembershipCancellationEffective(payer));
    if (!isPaid) return { eligible: false, reason: 'המנוי אינו פעיל או לא שולם.' };

    const effectiveExpiry = payer?.membershipExpiry || activeUser.membershipExpiry;
    if (!effectiveExpiry || effectiveExpiry < toLocalIsoDate(new Date())) return { eligible: false, reason: 'תוקף המנוי פג.' };

    const memberships = [activeUser.membershipType, ...(activeUser.secondaryMemberships || [])].filter(Boolean) as MembershipType[];
    const includedOpenGymAccess = memberships.some(type => [
      MembershipType.OPEN_GYM,
      MembershipType.OPEN_GYM_WITH_PLAN,
      MembershipType.CORE_GROUPS,
      MembershipType.FAMILY_MEMBERSHIP,
      MembershipType.GROUP_MONTHLY,
      MembershipType.GROUP_ANNUAL,
      MembershipType.OPEN_MONTHLY,
      MembershipType.OPEN_ANNUAL
    ].includes(type));
    const usesPunchCard = !includedOpenGymAccess && memberships.includes(MembershipType.OPEN_PUNCH_CARD);
    if (!includedOpenGymAccess && !usesPunchCard) return { eligible: false, reason: 'המסלול אינו כולל Open Gym.' };
    if (usesPunchCard && (activeUser.punchCardRemaining ?? 0) <= 0) return { eligible: false, reason: 'אזלו הניקובים בכרטיסייה.' };

    const [openStart, openEnd] = og.timeSlot.split('-').map(timeToMinutes);
    const hasOverlap = sessions.some(session => {
      if (session.date !== og.date || !session.registeredUsers.includes(activeUser.id)) return false;
      const start = timeToMinutes(session.time);
      return overlaps(openStart, openEnd, start, start + session.durationMinutes);
    }) || openGymSessions.some(existing => {
      if (existing.id === og.id || existing.date !== og.date || !existing.registeredUsers.includes(activeUser.id)) return false;
      const [start, end] = existing.timeSlot.split('-').map(timeToMinutes);
      return overlaps(openStart, openEnd, start, end);
    });
    return hasOverlap ? { eligible: false, reason: 'המשבצת חופפת לאימון שכבר נרשמת אליו.' } : { eligible: true };
  };

  const activeMembershipTypes = [activeUser.membershipType, ...(activeUser.secondaryMemberships || [])].filter(Boolean) as MembershipType[];
  const hasOpenGymMembershipAccess = activeMembershipTypes.some(type => [
    MembershipType.OPEN_GYM,
    MembershipType.OPEN_GYM_WITH_PLAN,
    MembershipType.CORE_GROUPS,
    MembershipType.FAMILY_MEMBERSHIP,
    MembershipType.GROUP_MONTHLY,
    MembershipType.GROUP_ANNUAL,
    MembershipType.OPEN_MONTHLY,
    MembershipType.OPEN_ANNUAL,
    MembershipType.OPEN_PUNCH_CARD
  ].includes(type));
  const isSessionRelevantToTrainee = (session: TrainingSession) => {
    if (session.genderRestriction === Gender.FEMALE && activeUser.gender !== Gender.FEMALE) return false;
    if (session.genderRestriction === Gender.MALE && activeUser.gender !== Gender.MALE) return false;
    if (session.ageMin && activeUser.age < session.ageMin) return false;
    if (session.ageMax && activeUser.age > session.ageMax) return false;
    if (session.isPersonalTraining) {
      if (session.targetTraineeId) return session.targetTraineeId === activeUser.id || Boolean(session.coTrainees?.includes(activeUser.id));
      return activeMembershipTypes.some(type => [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING].includes(type));
    }
    const groupMemberships = [
      MembershipType.CORE_GROUPS,
      MembershipType.YOUTH_TWICE_WEEKLY,
      MembershipType.YOUTH_ONCE_WEEKLY,
      MembershipType.DEDICATED_GROUP_HALF_YEAR,
      MembershipType.FAMILY_MEMBERSHIP,
      MembershipType.GROUP_MONTHLY,
      MembershipType.GROUP_ANNUAL,
      MembershipType.WEIGHT_LOSS_HALF_YEAR,
      MembershipType.POSTPARTUM_HALF_YEAR
    ];
    return activeMembershipTypes.some(type => groupMemberships.includes(type))
      && (!session.allowedMemberships?.length || session.allowedMemberships.some(type => activeMembershipTypes.includes(type)) || activeMembershipTypes.some(type => [MembershipType.CORE_GROUPS, MembershipType.FAMILY_MEMBERSHIP, MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL].includes(type)));
  };

  // FREEZE MEMBERSHIP (one continuous calendar month per rolling membership year)
  const handleFreezeMembership = () => {
    if (!freezeAvailable) {
      showFeedback(freezeActive
        ? `המנוי כבר מוקפא עד ${activeUser.membershipFrozenUntil}. לא ניתן לקצר או לפצל את ההקפאה.`
        : 'הקפאת החודש כבר נוצלה במהלך 12 החודשים האחרונים.', 'error');
      return;
    }
    if (confirm('האם להפעיל הקפאה לחודש אחד רצוף? ❄️\nההקפאה מתחילה מיד, אינה ניתנת לפיצול או לביטול מוקדם, וניתנת למימוש פעם אחת בלבד בכל 12 חודשים.')) {
      const startedAt = new Date();
      const frozenUntilStr = toLocalIsoDate(addCalendarMonths(startedAt, 1));
      const startedAtStr = toLocalIsoDate(startedAt);

      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? { 
          ...u, 
          isMembershipFrozen: true,
          membershipFreezeStartedAt: startedAtStr,
          membershipFreezeUsedAt: startedAtStr,
          membershipFrozenUntil: frozenUntilStr 
        } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback(`המנוי שלך הוקפא בהצלחה עד לתאריך ${frozenUntilStr}! ❄️`);
    }
  };

  // CANCEL ANNUAL MEMBERSHIP (one full calendar month notice)
  const handleCancelAnnualMembership = () => {
    if (activeUser.cancellationEffectiveDate) {
      showFeedback(`בקשת הביטול כבר נקלטה ותיכנס לתוקף בתאריך ${activeUser.cancellationEffectiveDate}.`, 'error');
      return;
    }
    const requestedAt = new Date();
    const effectiveDate = toLocalIsoDate(addCalendarMonths(requestedAt, 1));
    if (confirm(`בקשת הביטול תיכנס לתוקף בעוד חודש, בתאריך ${effectiveDate}.\nעד מועד זה המנוי והוראת הקבע יישארו פעילים. האם להמשיך?`)) {
      if (onUpdateUsers) {
        const updatedUsers = users.map(u => u.id === activeUser.id ? { 
          ...u, 
          isCancelledEarly: true,
          cancellationRequestedAt: toLocalIsoDate(requestedAt),
          cancellationEffectiveDate: effectiveDate
        } : u);
        onUpdateUsers(updatedUsers);
      }
      showFeedback(`בקשת הביטול התקבלה. המנוי יישאר פעיל עד ${effectiveDate}.`);
    }
  };

  const openMembershipCheckout = (membershipType: MembershipType, mode: 'PRIMARY' | 'ADDON') => {
    setSelectedMembershipPurchase(membershipType);
    setMembershipPurchaseMode(mode);
  };

  const handleMembershipCheckout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMembershipPurchase) return;
    if (!isCardcomConfigured()) {
      showFeedback('שרת התשלומים טרם הוגדר. יש להשלים את כתובת השרת לפני ביצוע חיוב.', 'error');
      return;
    }
    setPaymentStarting(true);
    try {
      const isTrainingCard = selectedMembershipPurchase === MembershipType.PERSONAL_TRAINING || selectedMembershipPurchase === MembershipType.DUO_TRAINING;
      await startCardcomPayment({
        userId: activeUser.id,
        userName: activeUser.name,
        email: activeUser.email,
        phone: activeUser.phone,
        membershipType: selectedMembershipPurchase,
        mode: membershipPurchaseMode,
        purchaseVariant: isTrainingCard
          ? `${selectedMembershipPurchase === MembershipType.PERSONAL_TRAINING ? 'PERSONAL' : 'DUO'}_${trainingCardSize}` as PaymentPurchaseVariant
          : undefined,
        discountCode: appliedDiscount?.code,
        planAmount: selectedMembershipPrice * (isTrainingCard ? trainingCardSize : 1),
        planLabel: selectedMembershipConfig?.label
      });
    } catch (error) {
      setPaymentStarting(false);
      showFeedback(error instanceof Error ? error.message : 'לא ניתן לפתוח את דף התשלום.', 'error');
    }
  };

  const handleFamilyCheckout = async () => {
    if (!familyPurchaseName.trim()) return showFeedback('יש להזין שם למשפחה.', 'error');
    if (!isCardcomConfigured()) return showFeedback('שרת התשלומים טרם הוגדר.', 'error');
    setPaymentStarting(true);
    try {
      await startCardcomPayment({
        userId: activeUser.id,
        userName: activeUser.name,
        email: activeUser.email,
        phone: activeUser.phone,
        membershipType: MembershipType.FAMILY_MEMBERSHIP,
        mode: 'PRIMARY',
        familyMembersCount: familyPurchaseCount,
        familyName: familyPurchaseName.trim(),
        familyBillingMode,
        familyMemberPlans: familyBillingMode === 'CUSTOM_COMBINED' ? resizeFamilyPlans(familyMemberPlans, familyPurchaseCount, activeUser.name, activeUser.id) : undefined,
        discountCode: appliedDiscount?.code
      });
    } catch (error) {
      setPaymentStarting(false);
      showFeedback(error instanceof Error ? error.message : 'לא ניתן לפתוח את דף התשלום המשפחתי.', 'error');
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

  const handlePayWorkoutPlan = () => {
    setActiveTab('membership');
    openMembershipCheckout(MembershipType.WORKOUT_COACHING, 'ADDON');
  };

  // PAY FOR NUTRITION COACHING (350 ILS)
  const handlePayNutritionPlan = () => {
    setActiveTab('membership');
    openMembershipCheckout(MembershipType.NUTRITION_COACHING, 'ADDON');
  };

  // BOOK / JOIN WAITLIST (Section 5.1 & 5.2)
  const handleBookSession = (session: TrainingSession) => {
    const isDuoSession = Boolean(session.isPersonalTraining && session.coTrainees?.length);
    const requiredTrainingCard = isDuoSession ? MembershipType.DUO_TRAINING : MembershipType.PERSONAL_TRAINING;
    if (session.isPersonalTraining && !activeUser.secondaryMemberships?.includes(requiredTrainingCard) && activeUser.membershipType !== requiredTrainingCard) {
      openMembershipCheckout(requiredTrainingCard, 'ADDON');
      setActiveTab('membership');
      return;
    }
    const check = checkBookingEligibility(session);
    if (!check.eligible) {
      if (!isHealthDeclarationValid()) {
        onOpenSettings('health');
      } else if (/מנוי|תשלום|כרטיסייה|ניקובים|מסלול/.test(check.reason || '')) {
        const recommended = session.isPersonalTraining ? MembershipType.PERSONAL_TRAINING : MembershipType.GROUP_MONTHLY;
        setActiveTab('membership');
        openMembershipCheckout(recommended, session.isPersonalTraining ? 'ADDON' : 'PRIMARY');
      }
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
      // First come, first served: preserve exact join order.
      const updatedWaitlistUsers = [...session.waitlistUsers, activeUser.id];

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
      const windowHours = settings.cancellationWindowHours || 2;

      // Unified cancellation window for every workout type.
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
      } else if (isPersonal && onUpdateUsers && !penaltyApplied) {
        const isDuoSession = Boolean(session.coTrainees?.length);
        onUpdateUsers(users.map(user => user.id === activeUser.id
          ? {
              ...user,
              personalTrainingRemaining: isDuoSession ? user.personalTrainingRemaining : (user.personalTrainingRemaining || 0) + 1,
              duoTrainingRemaining: isDuoSession ? (user.duoTrainingRemaining || 0) + 1 : user.duoTrainingRemaining
            }
          : user));
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
        showFeedback(isPersonal ? 'האימון בוטל בזמן והאימון הוחזר ליתרת הכרטיסייה.' : 'ההרשמה לאימון בוטלה בהצלחה ללא השלכות.');
      }
    }

    onUpdateSessions(updatedSessions);
  };

  // BOOK / CANCEL OPEN GYM (Section 10)
  const handleBookOpenGym = (og: OpenGymSession) => {
    if (isOpenGymBooked(og) || isOpenGymWaitlisted(og)) {
      showFeedback('כבר נרשמת למשבצת Open Gym זו או לרשימת ההמתנה שלה.', 'error');
      return;
    }

    if (!isHealthDeclarationValid()) {
      onOpenSettings('health');
      return;
    }

    const payer = activeUser.familyPayerId ? users.find(user => user.id === activeUser.familyPayerId) : undefined;
    const isPaid = (activeUser.membershipStatus === MembershipStatus.ACTIVE && !cancellationEffective)
      || activeUser.offlinePaymentApproved
      || Boolean(payer && (payer.membershipStatus === MembershipStatus.ACTIVE || payer.offlinePaymentApproved) && !isMembershipCancellationEffective(payer));

    if (!isPaid) {
      setActiveTab('membership');
      openMembershipCheckout(MembershipType.OPEN_GYM, 'PRIMARY');
      return;
    }

    if (freezeActive) {
      showFeedback(`המנוי מוקפא עד ${activeUser.membershipFrozenUntil}.`, 'error');
      return;
    }

    const effectiveExpiry = payer?.membershipExpiry || activeUser.membershipExpiry;
    const today = new Date().toISOString().split('T')[0];
    if (!effectiveExpiry || effectiveExpiry < today) {
      setActiveTab('membership');
      openMembershipCheckout(MembershipType.OPEN_GYM, 'PRIMARY');
      return;
    }

    const [openStart, openEnd] = og.timeSlot.split('-').map(timeToMinutes);
    const hasOverlap = sessions.some(session => {
      if (session.date !== og.date || !session.registeredUsers.includes(activeUser.id)) return false;
      const sessionStart = timeToMinutes(session.time);
      return overlaps(openStart, openEnd, sessionStart, sessionStart + session.durationMinutes);
    }) || openGymSessions.some(existing => {
      if (
        existing.id === og.id ||
        existing.date !== og.date ||
        !existing.registeredUsers.includes(activeUser.id)
      ) return false;
      const [existingStart, existingEnd] = existing.timeSlot.split('-').map(timeToMinutes);
      return overlaps(openStart, openEnd, existingStart, existingEnd);
    });
    if (hasOverlap) {
      showFeedback('לא ניתן להירשם לשני אימונים חופפים. יש לבחור משבצת אחרת.', 'error');
      return;
    }

    const memberships = [
      activeUser.membershipType,
      ...(activeUser.secondaryMemberships || [])
    ].filter(Boolean) as MembershipType[];
    const includedOpenGymAccess = memberships.some(type => [
      MembershipType.OPEN_GYM,
      MembershipType.OPEN_GYM_WITH_PLAN,
      MembershipType.CORE_GROUPS,
      MembershipType.FAMILY_MEMBERSHIP,
      MembershipType.GROUP_ANNUAL,
      MembershipType.OPEN_MONTHLY,
      MembershipType.OPEN_ANNUAL
    ].includes(type));
    const usesPunchCard = !includedOpenGymAccess && memberships.includes(MembershipType.OPEN_PUNCH_CARD);

    if (!includedOpenGymAccess && !usesPunchCard) {
      setActiveTab('membership');
      openMembershipCheckout(MembershipType.OPEN_GYM, 'PRIMARY');
      return;
    }

    if (usesPunchCard) {
      if ((activeUser.punchCardRemaining ?? 0) <= 0) {
        setActiveTab('membership');
        openMembershipCheckout(MembershipType.OPEN_PUNCH_CARD, 'PRIMARY');
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

      if (usesPunchCard && onUpdateUsers) {
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
    const memberships = [
      activeUser.membershipType,
      ...(activeUser.secondaryMemberships || [])
    ].filter(Boolean) as MembershipType[];
    const includedOpenGymAccess = memberships.some(type => [
      MembershipType.OPEN_GYM,
      MembershipType.OPEN_GYM_WITH_PLAN,
      MembershipType.CORE_GROUPS,
      MembershipType.FAMILY_MEMBERSHIP,
      MembershipType.GROUP_MONTHLY,
      MembershipType.GROUP_ANNUAL,
      MembershipType.OPEN_MONTHLY,
      MembershipType.OPEN_ANNUAL
    ].includes(type));
    const usesPunchCard = !includedOpenGymAccess && memberships.includes(MembershipType.OPEN_PUNCH_CARD);
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

      if (usesPunchCard && onUpdateUsers) {
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

  const getCheckInEligibility = (requestedType?: 'SESSION' | 'OPEN_GYM', requestedId?: string) => {
    if (!isHealthDeclarationValid()) return { allowed: false, reason: 'הצהרת הבריאות חסרה או אינה בתוקף. יש לחתום עליה לפני הכניסה למועדון.' };
    const payer = activeUser.familyPayerId ? users.find(user => user.id === activeUser.familyPayerId) : undefined;
    const isPaid = (activeUser.membershipStatus === MembershipStatus.ACTIVE && !cancellationEffective) || activeUser.offlinePaymentApproved
      || Boolean(payer && (payer.membershipStatus === MembershipStatus.ACTIVE || payer.offlinePaymentApproved) && !isMembershipCancellationEffective(payer));
    if (!isPaid) return { allowed: false, reason: 'המנוי אינו פעיל או לא שולם. יש להסדיר מסלול לפני הכניסה.' };
    if (freezeActive) return { allowed: false, reason: `המנוי מוקפא עד ${activeUser.membershipFrozenUntil} ולכן הכניסה למועדון חסומה.` };

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const eligibleSession = sessions.find(session => {
      if (requestedType && (requestedType !== 'SESSION' || requestedId !== session.id)) return false;
      if (session.date !== today || !session.registeredUsers.includes(activeUser.id)) return false;
      const start = timeToMinutes(session.time);
      return nowMinutes >= start - 30 && nowMinutes <= start + session.durationMinutes;
    });
    if (eligibleSession) {
      const alreadyCheckedIn = attendanceLogs.some(log => log.traineeId === activeUser.id && log.type === 'SESSION' && log.targetId === eligibleSession.id && log.date === today);
      return alreadyCheckedIn
        ? { allowed: false, reason: `הכניסה עבור ${eligibleSession.title} כבר אושרה היום.` }
        : { allowed: true, type: 'SESSION' as const, id: eligibleSession.id, title: eligibleSession.title };
    }

    const eligibleOpenGym = openGymSessions.find(session => {
      if (requestedType && (requestedType !== 'OPEN_GYM' || requestedId !== session.id)) return false;
      if (session.date !== today || !session.registeredUsers.includes(activeUser.id)) return false;
      const [start, end] = session.timeSlot.split('-').map(timeToMinutes);
      return nowMinutes >= start && nowMinutes <= end;
    });
    if (eligibleOpenGym) {
      const alreadyCheckedIn = attendanceLogs.some(log => log.traineeId === activeUser.id && log.type === 'OPEN_GYM' && log.targetId === eligibleOpenGym.id && log.date === today);
      return alreadyCheckedIn
        ? { allowed: false, reason: 'הכניסה למשבצת Open Gym זו כבר אושרה היום.' }
        : { allowed: true, type: 'OPEN_GYM' as const, id: eligibleOpenGym.id, title: `Open Gym ${eligibleOpenGym.timeSlot}` };
    }

    return { allowed: false, reason: 'אין כרגע אימון פעיל שאליו נרשמת. הכניסה נפתחת 30 דקות לפני אימון קבוצתי, או בשעות משבצת ה־Open Gym שנקבעה.' };
  };

  const stopScanner = () => {
    scannerStreamRef.current?.getTracks().forEach(track => track.stop());
    scannerStreamRef.current = null;
    setScannerOpen(false);
  };

  useEffect(() => () => scannerStreamRef.current?.getTracks().forEach(track => track.stop()), []);

  const completeClubScan = (scannedCode?: string) => {
    if (scannedCode && scannedCode !== CLUB_CHECK_IN_CODE) {
      setScannerError('הקוד שנסרק אינו קוד הכניסה של BALY WELLNESS. יש לסרוק את הקוד המוצג במועדון.');
      return;
    }
    const eligibility = getCheckInEligibility();
    if (!eligibility.allowed || !eligibility.type || !eligibility.id || !eligibility.title) {
      setScannerError(eligibility.reason || 'הכניסה אינה זמינה כעת.');
      return;
    }
    handleSimulateCheckIn(eligibility.type, eligibility.id, eligibility.title);
    stopScanner();
  };

  const startClubScanner = async () => {
    setScannerError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerOpen(true);
      setScannerError('המצלמה אינה זמינה בדפדפן זה. ניתן להשתמש בכפתור בדיקת הסריקה.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      scannerStreamRef.current = stream;
      setScannerOpen(true);
      window.setTimeout(async () => {
        const video = scannerVideoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        if (!Detector) {
          setScannerError('סריקה אוטומטית אינה נתמכת בדפדפן זה. כוון את המצלמה ולחץ על “אישור סריקת בדיקה”.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
        const scanFrame = async () => {
          if (!scannerStreamRef.current || !scannerVideoRef.current) return;
          try {
            const codes = await detector.detect(scannerVideoRef.current);
            if (codes.length) {
              completeClubScan(codes[0].rawValue);
              return;
            }
          } catch { /* keep scanning */ }
          window.requestAnimationFrame(scanFrame);
        };
        window.requestAnimationFrame(scanFrame);
      }, 0);
    } catch {
      setScannerOpen(true);
      setScannerError('לא התקבל אישור למצלמה. יש לאפשר מצלמה בהגדרות האתר ולנסות שוב.');
    }
  };

  // CHECK-IN / SCANNER (Section 9)
  const handleSimulateCheckIn = (targetType: 'SESSION' | 'OPEN_GYM', targetId: string, title: string) => {
    const eligibility = getCheckInEligibility(targetType, targetId);
    if (!eligibility.allowed) {
      if (!isHealthDeclarationValid()) onOpenSettings('health');
      else if (/מנוי|שולם|מסלול/.test(eligibility.reason || '')) {
        setActiveTab('membership');
        openMembershipCheckout(MembershipType.OPEN_GYM, 'PRIMARY');
      }
      showFeedback(eligibility.reason || 'הכניסה אינה מאושרת כעת.', 'error');
      return;
    }
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

  const traineeWorkout = workoutPlans.find(wp => wp.traineeId === activeUser.id && !wp.sessionId)
    || workoutPlans.find(wp => wp.traineeId === activeUser.id);
  const traineeNutrition = nutritionPlans.find(np => np.traineeId === activeUser.id);
  const hasWorkoutPlanAccess = Boolean(
    activeUser.secondaryMemberships?.includes(MembershipType.WORKOUT_COACHING) ||
    activeUser.secondaryMemberships?.includes(MembershipType.WORKOUT_PLAN) ||
    (activeUser.membershipType && MEMBERSHIP_TYPE_LABELS[activeUser.membershipType]?.includesWorkoutPlan &&
      (activeUser.membershipStatus === MembershipStatus.ACTIVE || activeUser.offlinePaymentApproved))
  );
  const hasNutritionAccess = Boolean(
    activeUser.nutritionPlanPaid ||
    traineeNutrition?.isPaid ||
    activeUser.secondaryMemberships?.includes(MembershipType.NUTRITION_COACHING) ||
    activeUser.secondaryMemberships?.includes(MembershipType.NUTRITION_PLAN)
  );
  const openPaidFeature = (tab: 'workout' | 'nutrition') => {
    if (tab === 'workout' && !hasWorkoutPlanAccess) {
      openMembershipCheckout(MembershipType.WORKOUT_COACHING, 'ADDON');
      setActiveTab('membership');
      return;
    }
    if (tab === 'nutrition' && !hasNutritionAccess) {
      openMembershipCheckout(MembershipType.NUTRITION_COACHING, 'ADDON');
      setActiveTab('membership');
      return;
    }
    setActiveTab(tab);
  };
  useEffect(() => {
    if (initialTab === 'workout' && !hasWorkoutPlanAccess) {
      setSelectedMembershipPurchase(MembershipType.WORKOUT_COACHING);
      setMembershipPurchaseMode('ADDON');
      setActiveTab('membership');
    }
  }, [hasWorkoutPlanAccess, initialTab]);
  const openPersonalWorkoutDisplay = () => {
    if (!traineeWorkout) return;
    const displayUrl = `${window.location.origin}${window.location.pathname}#personal-workout-display=${encodeURIComponent(activeUser.id)}`;
    window.open(displayUrl, '_blank', 'noopener,noreferrer');
  };
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

  const now = new Date();
  const upcomingSessions = sessions
    .filter(session =>
      session.registeredUsers.includes(activeUser.id) &&
      new Date(`${session.date}T${session.time || '00:00'}`) >= now
    )
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const nextSession = upcomingSessions[0];
  const sessionCapacity = nextSession?.maxParticipants || 12;
  const registeredCount = nextSession?.registeredUsers.length || 0;
  const bookingDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${selectedBookingDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    return {
      key: toLocalIsoDate(date),
      day: date.toLocaleDateString('he-IL', { weekday: 'long' }),
      number: date.getDate(),
      month: date.toLocaleDateString('he-IL', { month: 'short' }),
      isToday: toLocalIsoDate(date) === toLocalIsoDate(new Date())
    };
  });
  type BookingListItem =
    | { kind: 'SESSION'; startTime: string; session: TrainingSession }
    | { kind: 'OPEN_GYM'; startTime: string; openGym: OpenGymSession };
  const bookingItemsForDay = (dateKey: string): BookingListItem[] => {
    const nameNeedle = bookingNameFilter.trim().toLocaleLowerCase('he-IL');
    const sessionItems: BookingListItem[] = sessions
      .filter(session => session.date === dateKey)
      .filter(session => !nameNeedle || session.title.toLocaleLowerCase('he-IL').includes(nameNeedle))
      .filter(session => bookingTypeFilter === 'ALL' || (bookingTypeFilter === 'PERSONAL' ? session.isPersonalTraining : bookingTypeFilter === 'GROUP' ? !session.isPersonalTraining : false))
      .filter(session => showAllBookingOptions || isBooked(session) || isWaitlisted(session) || isSessionRelevantToTrainee(session))
      .map(session => ({ kind: 'SESSION', startTime: session.time, session }));
    const openGymItems: BookingListItem[] = openGymSessions
      .filter(openGym => openGym.date === dateKey)
      .filter(() => bookingTypeFilter === 'ALL' || bookingTypeFilter === 'OPEN_GYM')
      .filter(() => !nameNeedle || 'open gym אימון חופשי'.includes(nameNeedle))
      .filter(openGym => showAllBookingOptions || isOpenGymBooked(openGym) || isOpenGymWaitlisted(openGym) || hasOpenGymMembershipAccess)
      .map(openGym => ({ kind: 'OPEN_GYM', startTime: openGym.timeSlot.split('-')[0].trim(), openGym }));
    return [...sessionItems, ...openGymItems]
      .sort((a, b) => `${a.startTime}-${a.kind}`.localeCompare(`${b.startTime}-${b.kind}`, 'he'));
  };
  const sessionWorkoutProgram = (session: TrainingSession) => {
    const assignedGroupProgram = session.assignedGroupWorkoutProgramId
      ? groupWorkoutPrograms.find(program => program.id === session.assignedGroupWorkoutProgramId)
      : undefined;
    const linkedGroupProgram = groupWorkoutPrograms.find(program =>
      program.sessionId === session.id && program.status === 'PUBLISHED' && !program.libraryEntry
    );
    const assignedPersonalPlan = session.assignedWorkoutPlanId
      ? workoutPlans.find(plan => plan.id === session.assignedWorkoutPlanId && plan.exercises.length > 0)
      : undefined;
    const linkedPersonalPlan = workoutPlans.find(plan =>
      plan.sessionId === session.id && !plan.libraryEntry && plan.exercises.length > 0
    );

    return session.isPersonalTraining
      ? assignedPersonalPlan || linkedPersonalPlan
      : assignedGroupProgram || linkedGroupProgram;
  };
  const openSessionWorkoutDisplay = (session: TrainingSession) => {
    if (!session.registeredUsers.includes(activeUser.id) || !sessionWorkoutProgram(session)) return;
    const displayUrl = `${window.location.origin}${window.location.pathname}#trainee-session-workout=${encodeURIComponent(session.id)}`;
    window.open(displayUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 trainee-app" id="trainee-dashboard">
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
      <div className="trainee-profile-panel bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
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
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${MEMBERSHIP_TYPE_LABELS[activeUser.membershipType || MembershipType.OPEN_GYM]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                {MEMBERSHIP_TYPE_LABELS[activeUser.membershipType || MembershipType.OPEN_GYM]?.label}
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
              <div>סדר המתנה: <span className="font-bold text-slate-800">כל הקודם זוכה</span></div>

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
                        ₪600 לחודש. מנוי חודשי מתחדש לאימונים קבוצתיים, כולל כניסה ל־Open Gym.
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedMembershipPurchase(MembershipType.GROUP_ANNUAL); setMembershipPurchaseMode('PRIMARY'); setActiveTab('membership'); }}
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
                        ₪500 בכל חודש בהוראת קבע למשך 12 חודשים. כולל Open Gym והקפאה אחת של חודש רצוף בשנה.
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedMembershipPurchase(MembershipType.GROUP_MONTHLY); setMembershipPurchaseMode('PRIMARY'); setActiveTab('membership'); }}
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
                    onClick={() => { setSelectedMembershipPurchase(MembershipType.OPEN_GYM); setMembershipPurchaseMode('PRIMARY'); setActiveTab('membership'); }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-md shadow-sm transition shrink-0"
                  >
                    💳 מעבר למסלול Open Gym
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

      <div className="trainee-content bg-white rounded-xl p-6 shadow-md border border-slate-100 min-h-[400px]">
        {activeTab === 'home' && (
          <div className="trainee-home">
            <section className="home-greeting">
              <div>
                <span>שלום, טוב לראות אותך</span>
                <h2>{activeUser.name} 👋</h2>
              </div>
              <img src={activeUser.imageUrl} alt={activeUser.name} />
            </section>

            <section className="next-session-card">
              <div className="next-session-eyebrow">האימון הבא שלך</div>
              {nextSession && (
                <>
                  <h3>{nextSession.title}</h3>
                  <div className="next-session-meta">
                    <span><CalendarIcon size={14} /> {nextSession.date} · {nextSession.time}</span>
                    <span><UserCheck size={14} /> {nextSession.coachName}</span>
                  </div>
                  <div className="next-session-bottom">
                    <button onClick={() => setActiveTab('classes')}>לצפייה באימון</button>
                    <div className="capacity-block">
                      <div className="capacity-dots" aria-label={`${registeredCount} מתוך ${sessionCapacity} מקומות תפוסים`}>
                        {Array.from({ length: Math.min(sessionCapacity, 20) }).map((_, index) => (
                          <i key={index} className={index < registeredCount ? 'filled' : ''} />
                        ))}
                      </div>
                      <span>{registeredCount} מתוך {sessionCapacity} נרשמו</span>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="home-quick-actions" aria-label="פעולות מהירות">
              <button onClick={() => setActiveTab('classes')}>
                <CalendarIcon size={21} />
                <span><strong>רישום לאימון</strong><small>בחירת אימון ומקום פנוי</small></span>
                <ChevronRight size={17} />
              </button>
              <button onClick={() => setActiveTab('profile')}>
                <UserRound size={21} />
                <span><strong>פרופיל ומנוי</strong><small>עריכה, עדכון ותשלום</small></span>
                <ChevronRight size={17} />
              </button>
              <button onClick={() => openPaidFeature('workout')}>
                <Dumbbell size={21} />
                <span><strong>תוכנית אימון</strong><small>צפייה והפעלת האימון</small></span>
                <ChevronRight size={17} />
              </button>
              <button onClick={() => openPaidFeature('nutrition')}>
                <Apple size={21} />
                <span><strong>תוכנית תזונה</strong><small>ארוחות ויעדים אישיים</small></span>
                <ChevronRight size={17} />
              </button>
            </section>

            <section className="home-section">
              <h3>
                לוח מודעות
                <button onClick={() => setActiveTab('notices')}>כל ההודעות</button>
              </h3>
              <div className="home-announcements">
                {targetedAnnouncements.slice(0, 2).map(announcement => (
                  <article key={announcement.id}>
                    <div><span>{announcement.createdBy}</span><time>{announcement.date}</time></div>
                    <h4>{announcement.title}</h4>
                    <p>{announcement.content}</p>
                  </article>
                ))}
                {targetedAnnouncements.length === 0 && (
                  <article>
                    <div><span>הנהלת המועדון</span><time>היום</time></div>
                    <h4>הכול מוכן לאימון הבא</h4>
                    <p>כאן יופיעו עדכונים אישיים והודעות חדשות מצוות המועדון.</p>
                  </article>
                )}
              </div>
            </section>
          </div>
        )}
        
        {/* TAB 1: CLASSES BOOKING */}
        {activeTab === 'classes' && (
          <div className="space-y-5 booking-flow">
            <div className="booking-view-toggle" dir="rtl">
              <button type="button" className={bookingView === 'DAY' ? 'active' : ''} onClick={() => setBookingView('DAY')}>רשימה יומית</button>
              <button type="button" className={bookingView === 'WEEK' ? 'active' : ''} onClick={() => setBookingView('WEEK')}>לוח שבועי</button>
            </div>
            {bookingView === 'DAY' && <>
            <div className="booking-list-heading">
              <h2>רישום לאימון</h2>
              <p>גלול מטה כדי לעבור בין הימים ולהירשם עד שבוע קדימה.</p>
            </div>
            <div className="booking-filter-panel" dir="rtl" aria-label="סינון אימונים">
              <label>
                <span>התחל מתאריך</span>
                <input
                  type="date"
                  min={toLocalIsoDate(new Date())}
                  value={selectedBookingDate}
                  onChange={event => setSelectedBookingDate(event.target.value)}
                />
              </label>
              <label>
                <span>שם האימון</span>
                <input
                  type="search"
                  value={bookingNameFilter}
                  onChange={event => setBookingNameFilter(event.target.value)}
                  placeholder="לדוגמה: כוח"
                />
              </label>
              <label>
                <span>סוג האימון</span>
                <select value={bookingTypeFilter} onChange={event => setBookingTypeFilter(event.target.value as 'ALL' | 'GROUP' | 'PERSONAL' | 'OPEN_GYM')}>
                  <option value="ALL">כל הסוגים</option>
                  <option value="GROUP">אימון קבוצתי</option>
                  <option value="PERSONAL">אימון אישי</option>
                  <option value="OPEN_GYM">Open Gym</option>
                </select>
              </label>
              <div className="booking-filter-actions">
                <button type="button" onClick={() => setSelectedBookingDate(toLocalIsoDate(new Date()))}>חזרה להיום</button>
                <button type="button" className={showAllBookingOptions ? 'active' : ''} onClick={() => setShowAllBookingOptions(value => !value)}>
                  {showAllBookingOptions ? 'הצג רק אימונים שמתאימים לי' : 'צפה בכל אימוני המועדון'}
                </button>
              </div>
            </div>
            </>}

            {/* WEEKLY CALENDAR FOR TRAINEE */}
            {bookingView === 'WEEK' && <div className="trainee-weekly-calendar">
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
              canViewWorkoutProgram={session => Boolean(
                session.registeredUsers.includes(activeUser.id)
                && sessionWorkoutProgram(session)
              )}
              onViewWorkoutProgram={openSessionWorkoutDisplay}
            />
            </div>}

            {bookingView === 'DAY' && <>
            <div className="booking-list-notice">
              <span>{showAllBookingOptions ? 'מוצגים כל אימוני המועדון, כולל אימונים שאינם כלולים במסלול שלך.' : 'מוצגים אימונים שמתאימים למסלול ולנתונים שלך, לצד ההרשמות הקיימות.'}</span>
              {activePenaltiesCount > 0 && (
                <span className="bg-rose-100 text-rose-800 font-semibold text-[10px] px-2 py-1 rounded-full border border-rose-200">
                  ⚠️ יש לך {activePenaltiesCount} נקודות שחורות פעילות לחובתך!
                </span>
              )}
            </div>
            <div className="booking-days-feed">
              {bookingDays.map(day => {
                const dayItems = bookingItemsForDay(day.key);
                return (
                  <section key={day.key} className="booking-day-section" id={`booking-day-${day.key}`}>
                    <header>
                      <div className={day.isToday ? 'today' : ''}>
                        <strong>{day.day}</strong>
                        <span>{day.number} {day.month}</span>
                      </div>
                      {day.isToday && <b>היום</b>}
                      <small>{dayItems.length} אימונים</small>
                    </header>
                    <div className="booking-day-grid">
                      {dayItems.map(item => {
                        if (item.kind === 'OPEN_GYM') {
                          const og = item.openGym;
                          const booked = isOpenGymBooked(og);
                          const waitlisted = isOpenGymWaitlisted(og);
                          const full = og.registeredUsers.length >= og.maxParticipants;
                          const eligibility = checkOpenGymBookingEligibility(og);
                          return (
                            <article key={`open-${og.id}`} className={`booking-unified-card open-gym ${!eligibility.eligible && !booked && !waitlisted ? 'restricted' : ''}`} id={`booking-opengym-${og.id}`}>
                              <div className="booking-card-main">
                                <span className="booking-kind">Open Gym</span>
                                <div><strong>אימון חופשי</strong><small>אימון עצמאי בשעות הפעילות ובהשגחה</small></div>
                              </div>
                              <div className="booking-card-meta"><b>{og.timeSlot}</b><span>{og.registeredUsers.length}/{og.maxParticipants} רשומים</span></div>
                              {booked || waitlisted ? (
                                <button type="button" className="cancel" onClick={() => handleCancelOpenGym(og)}>{waitlisted ? 'בטל המתנה' : 'בטל הרשמה'}</button>
                              ) : (
                                <button type="button" onClick={() => handleBookOpenGym(og)}>{full ? 'הצטרף להמתנה' : eligibility.eligible ? 'הרשמה' : 'בדיקת זכאות'}</button>
                              )}
                              {booked && <span className="booking-status success">✓ רשום לאימון</span>}
                              {waitlisted && <span className="booking-status wait">⏳ ברשימת המתנה</span>}
                              {!booked && !waitlisted && !eligibility.eligible && <span className="booking-reason">{eligibility.reason}</span>}
                            </article>
                          );
                        }

                        const session = item.session;
                        const booked = isBooked(session);
                        const waitlisted = isWaitlisted(session);
                        const full = session.registeredUsers.length >= session.maxParticipants;
                        const eligibility = checkBookingEligibility(session);
                        return (
                          <article key={session.id} className={`booking-unified-card ${session.isPersonalTraining ? 'personal' : 'group'} ${!eligibility.eligible && !booked && !waitlisted ? 'restricted' : ''}`} id={`booking-card-${session.id}`}>
                            <div className="booking-card-main">
                              <span className="booking-kind">{session.isPersonalTraining ? 'אישי' : 'קבוצתי'}</span>
                              <div><strong>{session.title}</strong><small>מאמן: {session.coachName}</small></div>
                            </div>
                            <div className="booking-card-meta"><b>{session.time}</b><span>{session.durationMinutes} דקות · {session.registeredUsers.length}/{session.maxParticipants}</span></div>
                            {booked || waitlisted ? (
                              <button type="button" className="cancel" onClick={() => handleCancelBooking(session)}>{waitlisted ? 'בטל המתנה' : 'בטל הרשמה'}</button>
                            ) : (
                              <button type="button" onClick={() => handleBookSession(session)}>{full ? 'הצטרף להמתנה' : eligibility.eligible ? 'הרשמה' : 'בדיקת זכאות'}</button>
                            )}
                            {booked && <span className="booking-status success">✓ רשום לאימון</span>}
                            {waitlisted && <span className="booking-status wait">⏳ מקום {session.waitlistUsers.indexOf(activeUser.id) + 1} בהמתנה</span>}
                            {!booked && !waitlisted && !eligibility.eligible && <span className="booking-reason">{eligibility.reason}</span>}
                            {(booked || waitlisted) && (
                              <div className="booking-calendar-links">
                                {booked && (sessionWorkoutProgram(session) ? (
                                  <button type="button" className="workout-view-button" onClick={() => openSessionWorkoutDisplay(session)}><MonitorPlay size={14} /> צפה בתוכנית האימון</button>
                                ) : (
                                  <button type="button" className="workout-view-button unavailable" disabled title="המאמן עדיין לא שיבץ תוכנית לאימון זה"><MonitorPlay size={14} /> טרם שובצה תוכנית</button>
                                ))}
                                <a href={getGoogleCalendarLink(session)} target="_blank" rel="noreferrer">Google Calendar</a>
                                <button type="button" onClick={() => downloadIcsFile(session)}>Apple Calendar</button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                      {dayItems.length === 0 && <div className="booking-day-empty">אין אימונים מתאימים ביום זה</div>}
                    </div>
                  </section>
                );
              })}
            </div>
            </>}
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

            {traineeWorkout && traineeWorkout.exercises.length > 0 && (
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-950 to-slate-900 p-4 text-white shadow-lg">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h4 className="flex items-center gap-2 text-sm font-black"><MonitorPlay size={18} className="text-indigo-300" /> מצב אימון עצמאי</h4><p className="mt-1 text-xs text-slate-300">הפעל את התוכנית במסך מלא עם טיימר, צפצופים ומעקב אחרי התרגילים והסטים.</p></div>
                  <button onClick={openPersonalWorkoutDisplay} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-400"><MonitorPlay size={16} /> פתח והתחל אימון</button>
                </div>
              </div>
            )}

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

            {!hasWorkoutPlanAccess ? (
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                <div className="text-2xl">🏋️</div>
                <h4 className="text-sm font-bold text-amber-900">תוכנית אימון אישית בתשלום</h4>
                <p className="text-xs text-amber-800">לאחר התשלום המאמן או המנהל יוכלו לבנות עבורך תוכנית. התוכנית תוצג כאן רק לאחר שהגישה שולמה ואושרה.</p>
                <button
                  onClick={handlePayWorkoutPlan}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-sm transition"
                >
                  תשלום עבור תוכנית אימון ({MEMBERSHIP_PRICES[MembershipType.WORKOUT_PLAN]} ₪)
                </button>
              </div>
            ) : traineeWorkout && traineeWorkout.exercises.length > 0 ? (
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

                <div className="flex flex-wrap gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  {Array.from({ length: Math.max(1, traineeWorkout.trainingDaysPerWeek || 1) }, (_, index) => index + 1).map(day => (
                    <button key={day} onClick={() => setSelectedWorkoutDay(day)} className={`rounded-lg px-4 py-2 text-xs font-black ${selectedWorkoutDay === day ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-800 border border-indigo-200'}`}>
                      {traineeWorkout.dayLabels?.[day - 1] || `יום אימון ${day}`}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {traineeWorkout.exercises.filter(exercise => (exercise.dayNumber || 1) === selectedWorkoutDay).map((ex, index) => (
                    <div key={ex.id} className="border border-slate-200 rounded-xl p-3 bg-white hover:shadow-md transition">
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">{index + 1}</span><div className="min-w-0"><h4 className="truncate font-black text-slate-900 text-sm">{ex.name}</h4><span className="text-[9px] text-slate-500">{ex.category} · {ex.muscleGroup}</span></div></div>
                          {(ex.mediaUrl || ex.mediaStorageId) && <button onClick={() => setDemoExercise(ex)} className="shrink-0 rounded-lg bg-fuchsia-50 px-3 py-2 text-[10px] font-black text-fuchsia-700 border border-fuchsia-200"><MonitorPlay size={13} className="ml-1 inline" /> הדגמה</button>}
                        </div>

                        <div className="grid grid-cols-5 gap-1 bg-slate-50 rounded-lg p-2 my-2 text-center border border-slate-100">
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
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">זמן עבודה</span>
                            <span className="font-bold font-mono text-slate-800 text-xs">{ex.workDuration || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">זמן מנוחה</span>
                            <span className="font-bold font-mono text-slate-800 text-xs">{ex.restDuration || '—'}</span>
                          </div>
                        </div>

                        {ex.notes && (
                          <p className="text-xs text-slate-500 italic bg-amber-50/30 p-2.5 rounded border border-amber-100/30 mb-3">
                            💡 {ex.notes}
                          </p>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
                {traineeWorkout.exercises.filter(exercise => (exercise.dayNumber || 1) === selectedWorkoutDay).length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">עדיין לא שובצו תרגילים ליום זה.</div>}

                {demoExercise && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setDemoExercise(null)}>
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
                      <div className="mb-3 flex items-center justify-between"><div><h4 className="font-black text-slate-900">{demoExercise.name}</h4><p className="text-xs text-slate-500">הדגמת ביצוע ודגשי המאמן</p></div><button onClick={() => setDemoExercise(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">סגור</button></div>
                      <ExerciseMedia exercise={demoExercise} controls className="border-slate-200" />
                      {demoExercise.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">💡 {demoExercise.notes}</p>}
                    </div>
                  </div>
                )}
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
                  ✅ שולם (350 ₪) - תוכנית תזונה מורשית
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-3 py-1 rounded-lg">
                  🔒 בתשלום נוסף פרטני (350 ₪)
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
                  💳 בצע תשלום עבור תוכנית תזונה (350 ₪)
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

                {traineeNutrition.categories && traineeNutrition.categories.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {traineeNutrition.categories.map((meal, index) => (
                      <article key={meal.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{index + 1}</span><h4 className="font-black text-slate-900">{meal.title}</h4></div><span className="text-[10px] font-bold text-emerald-700">{meal.suggestedTime}</span></div>
                        <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">{meal.foods}</p>
                        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-2 text-center text-[9px] text-slate-600"><span><b className="block text-slate-900">{meal.calories}</b>קל׳</span><span><b className="block text-slate-900">{meal.proteinGrams}g</b>חלבון</span><span><b className="block text-slate-900">{meal.carbsGrams}g</b>פחמימה</span><span><b className="block text-slate-900">{meal.fatGrams}g</b>שומן</span></div>
                        {meal.notes && <p className="mt-2 text-[10px] text-slate-500">{meal.notes}</p>}
                      </article>
                    ))}
                  </div>
                )}

                {(traineeNutrition.goal || traineeNutrition.hydrationLiters || traineeNutrition.fiberGrams) && <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3 text-xs"><small className="block text-slate-400">מטרה</small><b>{traineeNutrition.goal || 'לא הוגדרה'}</b></div><div className="rounded-xl bg-sky-50 p-3 text-xs"><small className="block text-sky-600">מים</small><b>{traineeNutrition.hydrationLiters || 0} ליטר ביום</b></div><div className="rounded-xl bg-amber-50 p-3 text-xs"><small className="block text-amber-600">סיבים</small><b>{traineeNutrition.fiberGrams || 0} גרם ביום</b></div></div>}

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

        {/* MEMBERSHIP MANAGEMENT & CARDCOM CHECKOUT */}
        {activeTab === 'membership' && (
          <div className="space-y-6">
            <section className="rounded-2xl bg-slate-950 text-white p-5 sm:p-7 border border-amber-500/25">
              <button className="text-xs text-amber-300 mb-4" onClick={() => { setSelectedMembershipPurchase(null); setActiveTab('profile'); }}>
                חזרה לפרופיל
              </button>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-[11px] text-amber-300 font-bold">המנוי שלי</span>
                  <h3 className="text-2xl font-black mt-1">ניהול ובחירת מסלולים</h3>
                  <p className="text-xs text-slate-400 mt-2">שינוי או רכישת מסלול נכנסים לתוקף רק לאחר אימות התשלום מול Cardcom.</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 min-w-52">
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-slate-400">מסלול נוכחי</span>
                    <b>{membershipPlanConfigs.find(plan => plan.id === activeUser.membershipType)?.label || MEMBERSHIP_TYPE_LABELS[activeUser.membershipType || MembershipType.OPEN_GYM]?.label || activeUser.membershipType}</b>
                  </div>
                  <div className="flex justify-between gap-4 text-xs mt-2">
                    <span className="text-slate-400">תוקף</span>
                    <b>{activeUser.membershipExpiry || 'לא הוגדר'}</b>
                  </div>
                </div>
              </div>
            </section>

            {selectedMembershipPurchase ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm max-w-2xl mx-auto">
                <button className="text-xs text-slate-500 mb-5" onClick={() => setSelectedMembershipPurchase(null)}>חזרה לבחירת מסלול</button>
                <h3 className="text-xl font-black text-slate-900">תשלום והפעלת מסלול</h3>
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex justify-between items-center gap-4">
                  <div>
                    <b className="block text-sm text-slate-900">{selectedMembershipConfig?.label || MEMBERSHIP_TYPE_LABELS[selectedMembershipPurchase]?.label || selectedMembershipPurchase}</b>
                    <span className="text-[11px] text-slate-600">{membershipPurchaseMode === 'PRIMARY' ? 'מסלול ראשי' : 'שירות נוסף'}</span>
                  </div>
                  <strong className="text-xl text-amber-800">₪{applySelectedDiscount(selectedMembershipPrice * ((selectedMembershipPurchase === MembershipType.PERSONAL_TRAINING || selectedMembershipPurchase === MembershipType.DUO_TRAINING) ? trainingCardSize : 1))}{selectedMembershipConfig?.priceUnit === 'MONTH' ? ' לחודש' : ''}</strong>
                </div>
                <form onSubmit={handleMembershipCheckout} className="grid gap-4 mt-5">
                  {(selectedMembershipPurchase === MembershipType.PERSONAL_TRAINING || selectedMembershipPurchase === MembershipType.DUO_TRAINING) && (
                    <label className="text-xs font-bold text-slate-700">בחרו גודל כרטיסייה
                      <select value={trainingCardSize} onChange={event => setTrainingCardSize(Number(event.target.value) as TrainingCardSize)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3">
                        {TRAINING_CARD_SIZES.map(size => <option key={size} value={size}>{size === 1 ? 'אימון אחד' : `${size} אימונים`} — ₪{(size * selectedMembershipPrice).toLocaleString('he-IL')}</option>)}
                      </select>
                      <small className="mt-2 block font-normal text-slate-500">לאחר כל אימון היתרה תתעדכן. כשיישארו שני אימונים תישלח התראה למתאמן ולמאמן.</small>
                    </label>
                  )}
                  <DiscountCodeField discountCodes={discountCodes} value={discountInput} onChange={setDiscountInput} applied={appliedDiscount} onApplied={setAppliedDiscount} onMessage={(message, isError) => showFeedback(message, isError ? 'error' : 'success')} />
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                    התשלום מתבצע בעמוד המאובטח של Cardcom. פרטי האשראי אינם מוזנים ואינם נשמרים באתר BALY.
                  </div>
                  {selectedMembershipPurchase === MembershipType.GROUP_ANNUAL && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
                    הוראת קבע חודשית בסך ₪500 למשך 12 חודשים. בקשת ביטול נכנסת לתוקף חודש לאחר הגשתה.
                  </div>}
                  {!isCardcomConfigured() && (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      שירות התשלומים עדיין אינו מחובר לשרת הציבורי. לא יתבצע חיוב עד להשלמת הגדרת השרת.
                    </p>
                  )}
                  <button type="submit" disabled={paymentStarting || !isCardcomConfigured()} className="rounded-xl bg-slate-950 text-white py-3.5 font-bold flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <CreditCard size={17} /> {paymentStarting ? 'פותח דף תשלום…' : 'מעבר לתשלום מאובטח ב־Cardcom'}
                  </button>
                </form>
              </section>
            ) : (
              <>
                <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <span className="text-[11px] font-black text-indigo-700">חשבון משפחתי</span>
                      <h3 className="mt-1 font-black text-slate-900">מסלול אחד, פרופיל אישי לכל בן משפחה</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">לאחר אישור התשלום ייפתח ניהול המשפחה ותוכל להוסיף משתמשים נפרדים עד למכסת החבילה.</p>
                    </div>
                    {activeUser.isFamilyPayer && <span className="rounded-full bg-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-900">מסלול משפחתי פעיל</span>}
                  </div>
                  <label className="block text-xs font-bold text-slate-700">שם המשפחה<input value={familyPurchaseName} onChange={event => setFamilyPurchaseName(event.target.value)} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5" /></label>
                  <FamilyPlanConfigurator mode={familyBillingMode} onModeChange={setFamilyBillingMode} count={familyPurchaseCount} onCountChange={setFamilyPurchaseCount} plans={familyMemberPlans} onPlansChange={setFamilyMemberPlans} payerName={activeUser.name} payerId={activeUser.id} />
                  <DiscountCodeField discountCodes={discountCodes} value={discountInput} onChange={setDiscountInput} applied={appliedDiscount} onApplied={setAppliedDiscount} onMessage={(message, isError) => showFeedback(message, isError ? 'error' : 'success')} />
                  <div className="flex flex-col gap-3 rounded-xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                    <div><span className="block text-[11px] text-slate-400">{appliedDiscount ? `לתשלום לאחר קוד ${appliedDiscount.code}` : 'סכום לתשלום'}</span><strong className="text-xl">₪{applySelectedDiscount(familyPurchaseAmount(familyBillingMode, familyPurchaseCount, resizeFamilyPlans(familyMemberPlans, familyPurchaseCount, activeUser.name, activeUser.id))).toLocaleString('he-IL')}</strong></div>
                    <button type="button" onClick={() => void handleFamilyCheckout()} disabled={paymentStarting || !isCardcomConfigured()} className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black text-white disabled:opacity-50">
                      {paymentStarting ? 'פותח תשלום…' : activeUser.isFamilyPayer ? 'עדכון חבילה ומעבר לתשלום' : 'רכישה ומעבר לתשלום'}
                    </button>
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <h3 className="font-black text-slate-900">בחירת מסלול ראשי</h3>
                    <p className="text-xs text-slate-500 mt-1">אפשר לחדש, לשדרג או להחליף את המסלול הקיים.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {primaryMembershipPlans.map(planConfig => {
                      const plan = planConfig.id as MembershipType;
                      return <article key={planConfig.id} className={`rounded-2xl border p-4 bg-white flex flex-col ${activeUser.membershipType === plan ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'}`}>
                        <div className="flex justify-between gap-3">
                          <strong className="text-sm text-slate-900">{planConfig.label}</strong>
                          {activeUser.membershipType === plan && <span className="text-[9px] bg-amber-100 text-amber-800 rounded-full px-2 py-1 h-fit">נוכחי</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-5 flex-1">{planConfig.description}</p>
                        <div className="flex items-end justify-between gap-3 mt-4">
                          <b className="text-xl text-slate-950">₪{planConfig.price}{planConfig.priceUnit === 'MONTH' ? ' לחודש' : ''}</b>
                          <button className="rounded-lg bg-slate-950 text-white text-xs font-bold px-3 py-2" onClick={() => openMembershipCheckout(plan, 'PRIMARY')}>
                            {activeUser.membershipType === plan ? 'חידוש מסלול' : 'בחירה ותשלום'}
                          </button>
                        </div>
                      </article>;
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="font-black text-slate-900 mb-3">רכישת שירותים נוספים</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {membershipAddOns.map(planConfig => {
                      const plan = planConfig.id as MembershipType;
                      const alreadyPurchased = (activeUser.secondaryMemberships || []).includes(plan);
                      return (
                        <article key={planConfig.id} className="rounded-2xl border border-slate-200 p-4 bg-white">
                          <strong className="text-sm text-slate-900">{planConfig.label}</strong>
                          <p className="text-[11px] text-slate-500 mt-2 min-h-10">{planConfig.description}</p>
                          {plan === MembershipType.PERSONAL_TRAINING && activeUser.personalTrainingRemaining !== undefined && <p className="mt-2 text-[11px] font-bold text-amber-800">יתרה: {activeUser.personalTrainingRemaining} אימונים</p>}
                          {plan === MembershipType.DUO_TRAINING && activeUser.duoTrainingRemaining !== undefined && <p className="mt-2 text-[11px] font-bold text-amber-800">יתרה: {activeUser.duoTrainingRemaining} אימונים</p>}
                          <div className="flex justify-between items-center mt-4">
                            <b>₪{planConfig.price}{planConfig.priceUnit === 'SESSION' ? ' לאימון' : planConfig.priceUnit === 'MONTH' ? ' לחודש' : ''}</b>
                            <button className="rounded-lg border border-slate-300 text-xs font-bold px-3 py-2" onClick={() => openMembershipCheckout(plan, 'ADDON')}>
                              {alreadyPurchased ? 'רכישה נוספת' : 'הוספה ותשלום'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button className="rounded-2xl border border-slate-200 bg-white p-4 text-right" onClick={() => onOpenSettings('family')}>
                    <strong className="block text-sm text-slate-900">הוספת בן משפחה</strong>
                    <span className="text-[11px] text-slate-500 mt-1 block">פתיחת הגדרות המשפחה, הוספת משתמש ובחירת מסלול עבורו.</span>
                  </button>
                  <button disabled={!freezeAvailable} className={`rounded-2xl border p-4 text-right ${freezeActive ? 'border-sky-200 bg-sky-50' : freezeAvailable ? 'border-slate-200 bg-white' : 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70'}`} onClick={handleFreezeMembership}>
                    <strong className="block text-sm text-slate-900">{freezeActive ? 'המנוי מוקפא' : freezeAvailable ? 'הקפאת מנוי' : 'הקפאת השנה נוצלה'}</strong>
                    <span className="text-[11px] text-slate-600 mt-1 block">{freezeActive ? `הקפאה רצופה עד ${activeUser.membershipFrozenUntil}; לא ניתן לבטל מוקדם.` : freezeAvailable ? 'חודש אחד רצוף, פעם אחת בכל 12 חודשים.' : 'ניתן להקפיא שוב לאחר שיחלפו 12 חודשים ממועד ההקפאה הקודמת.'}</span>
                  </button>
                  {activeUser.membershipType === MembershipType.GROUP_ANNUAL && (
                    <button className="rounded-2xl border border-red-200 bg-red-50 p-4 text-right sm:col-span-2" onClick={handleCancelAnnualMembership}>
                      <strong className="block text-sm text-red-900">ביטול מנוי שנתי</strong>
                      <span className="text-[11px] text-red-700 mt-1 block">{activeUser.cancellationEffectiveDate ? `הביטול נקבע לתאריך ${activeUser.cancellationEffectiveDate}.` : 'הביטול נכנס לתוקף חודש לאחר הגשת הבקשה.'}</span>
                    </button>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {/* PROFILE, MEMBERSHIP & PAYMENT */}
        {activeTab === 'profile' && (
          <div className="member-profile-page">
            <section className="member-profile-hero">
              <img src={activeUser.imageUrl} alt={activeUser.name} />
              <div>
                <span>החשבון שלי</span>
                <h3>{activeUser.name}</h3>
                <p>@{activeUser.username || activeUser.email}</p>
              </div>
              <button onClick={() => onOpenSettings('profile')}><Pencil size={16} /> עריכת פרופיל</button>
            </section>

            <section className="member-profile-grid">
              <article>
                <div className="member-card-title"><UserRound size={18} /><strong>פרטים אישיים</strong></div>
                <dl>
                  <div><dt>טלפון</dt><dd>{activeUser.phone}</dd></div>
                  <div><dt>אימייל</dt><dd>{activeUser.email}</dd></div>
                  <div><dt>גיל</dt><dd>{activeUser.age}</dd></div>
                  <div><dt>הצהרת בריאות</dt><dd>{isHealthDeclarationValid() ? 'בתוקף' : 'נדרשת חתימה מחדש'}</dd></div>
                </dl>
                <button className="profile-outline-action" onClick={() => onOpenSettings('profile')}><Pencil size={15} /> שינוי פרטים וסיסמה</button>
              </article>

              <article>
                <div className="member-card-title"><WalletCards size={18} /><strong>המנוי שלי</strong></div>
                <div className="membership-summary">
                  <strong>{MEMBERSHIP_TYPE_LABELS[activeUser.membershipType || MembershipType.OPEN_GYM]?.label}</strong>
                  <span className={activeUser.membershipStatus === MembershipStatus.ACTIVE ? 'active' : 'debt'}>
                    {activeUser.membershipStatus === MembershipStatus.ACTIVE ? 'פעיל' : 'דורש תשלום'}
                  </span>
                </div>
                <p>בתוקף עד: <b>{activeUser.membershipExpiry}</b></p>
                <button className="profile-primary-action" onClick={() => setActiveTab('membership')}><CreditCard size={16} /> ניהול, שינוי ורכישת מסלול</button>
              </article>
            </section>

            <section className="profile-more-actions">
              <button onClick={() => onOpenSettings('health')}><HeartPulse size={18} /> הצהרת בריאות וחתימה</button>
              <button onClick={() => setActiveTab('workout')}><Dumbbell size={18} /> תוכנית האימונים שלי</button>
              <button onClick={() => setActiveTab('membership')}><WalletCards size={18} /> ניהול מסלול ותשלומים</button>
              <button onClick={() => setActiveTab('card')}><QrCode size={18} /> כרטיס דיגיטלי וצ'ק־אין</button>
              <button disabled={!freezeAvailable} onClick={handleFreezeMembership}>❄️ {freezeActive ? `מוקפא עד ${activeUser.membershipFrozenUntil}` : freezeAvailable ? 'הקפאת מנוי לחודש' : 'הקפאת השנה נוצלה'}</button>
              {activeUser.membershipType === MembershipType.GROUP_ANNUAL && (
                <button className="danger" onClick={handleCancelAnnualMembership}>ביטול מנוי שנתי</button>
              )}
              <button className="logout" onClick={onLogout}><LogOut size={18} /> יציאה מהחשבון</button>
            </section>
          </div>
        )}

        {/* TAB 7: DIGITAL CARD & BARCODE (Section 9) */}
        {activeTab === 'card' && (
          <div className="space-y-6 flex flex-col items-center justify-center py-6 text-center">
            <div>
              <h3 className="text-base font-black text-slate-900">סריקת ברקוד וכניסה למועדון</h3>
              <p className="mt-1 text-xs text-slate-500">הכניסה תאושר רק בזמן אימון פעיל שאליו נרשמת ובהתקיים מנוי והצהרת בריאות תקינים.</p>
            </div>

            <div className={`check-in-status ${getCheckInEligibility().allowed ? 'allowed' : 'blocked'}`}>
              {getCheckInEligibility().allowed ? `ניתן להיכנס כעת עבור ${getCheckInEligibility().title}.` : getCheckInEligibility().reason}
            </div>

            {!scannerOpen ? (
              <button type="button" onClick={() => void startClubScanner()} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950">
                <Camera size={18} /> פתיחת מצלמה וסריקת ברקוד המועדון
              </button>
            ) : (
              <div className="club-barcode-scanner">
                <div className="scanner-frame"><video ref={scannerVideoRef} muted playsInline /></div>
                {scannerError && <p className="mt-3 text-xs leading-5 text-amber-200">{scannerError}</p>}
                <div className="scanner-actions">
                  <button type="button" onClick={() => completeClubScan()}>אישור סריקת בדיקה</button>
                  <button type="button" className="secondary" onClick={stopScanner}>סגירה</button>
                </div>
              </div>
            )}
            
            {/* Simulation card layout */}
            <div className="w-72 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl p-6 border border-slate-700 relative overflow-hidden" id="digital-pwa-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -z-1" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-bold text-md tracking-tight font-sans text-emerald-400">BALLYWELLNESS</h4>
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
                <div className="text-[9px] text-slate-400 font-mono mt-1">BALLYWELLNESS-{activeUser.id}</div>
              </div>

              <div className="text-[8px] text-slate-400">
                הצמד את הקוד לקורא הברקודים בכניסה למועדון לרישום נוכחות
              </div>
            </div>

            {/* Registered bookings are also available for controlled demo checks. */}
            <div className="w-full max-w-sm bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">בדיקת כניסה לפי אימון רשום</span>
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

    </div>
  );
};
