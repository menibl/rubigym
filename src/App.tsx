/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import {
  User,
  TrainingSession,
  OpenGymSession,
  WorkoutPlan,
  NutritionPlan,
  BlackPoint,
  Announcement,
  Payment,
  Message,
  AttendanceLog,
  DiscountCode,
  SystemSettings,
  GymEquipment,
  CoachPdfDocument,
  WorkoutAssistantDraft,
  WorkoutAssistantMessage,
  GroupWorkoutProgram,
  TraineeMemoryEntry,
  TraineeProfessionalProfile,
  UserRole,
  MembershipStatus,
  MembershipType
} from './types';
import {
  INITIAL_USERS,
  INITIAL_SESSIONS,
  INITIAL_OPEN_GYM_SESSIONS,
  INITIAL_WORKOUT_PLANS,
  INITIAL_NUTRITION_PLANS,
  INITIAL_BLACK_POINTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_PAYMENTS,
  INITIAL_MESSAGES,
  INITIAL_ATTENDANCE,
  INITIAL_SETTINGS,
  INITIAL_DISCOUNT_CODES
} from './data/initialData';
import { getClubState, getServerSession, loginWithPassword, loginWithPhone, logoutServerSession, registerFamilyMember, registerServerUser, requestPhoneCode, saveClubState, syncServerPushSubscription, updateServerPassword, verifyRegistrationPhone } from './data/clubServer';
import { AdminDashboard } from './components/AdminDashboard';
import { CoachDashboard } from './components/CoachDashboard';
import { TraineeDashboard } from './components/TraineeDashboard';
import { AuthGateway } from './components/AuthGateway';
import { PublicLandingPage } from './components/PublicLandingPage';
import { RubisLogo } from './components/RubisLogo';
import { UserSettingsModal } from './components/UserSettingsModal';
import { GroupWorkoutDisplay } from './components/GroupWorkoutDisplay';
import { ClubWorkoutDisplay } from './components/ClubWorkoutDisplay';
import { TraineeSessionWorkoutView } from './components/TraineeSessionWorkoutView';
import { ClubChatCenter } from './components/ClubChatCenter';
import { RoleWorkspaceLanding, WorkspaceView } from './components/RoleWorkspaceLanding';
import { isMembershipCancellationEffective } from './data/membershipPolicy';
import { hasNotificationMarker, saveNotificationMarker, showBrowserNotification } from './utils/browserNotifications';
import { isPagesDemoMode } from './data/appMode';
import { getPublicLandingConfig, PublicLandingConfig } from './data/publicLanding';
import { syncClubDisplaySchedule } from './data/clubDisplayRemote';
import { personalPlanToDisplayProgram } from './data/workoutAssignment';
import { ArrowRight, CreditCard, Dumbbell, HeartPulse, UserCheck, AlertOctagon, HelpCircle, Flame, Sparkles, LogIn, UserPlus, Settings, User as UserIcon, X } from 'lucide-react';

const isClubWorkoutDisplay = () => window.location.hash === '#club-workout-display';

const getGroupWorkoutDisplayId = () => {
  const match = window.location.hash.match(/^#group-workout-display=(.+)$/);
  return match ? decodeURIComponent(match[1]) : '';
};

const getPersonalWorkoutDisplayId = () => {
  const match = window.location.hash.match(/^#personal-workout-display=(.+)$/);
  return match ? decodeURIComponent(match[1]) : '';
};

const getTraineeSessionWorkoutId = () => {
  const match = window.location.hash.match(/^#trainee-session-workout=(.+)$/);
  return match ? decodeURIComponent(match[1]) : '';
};

const parseDisplaySeconds = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return /min|דק/i.test(value || '') ? parsed * 60 : parsed;
};

export default function App() {
  // --- Global Application State ---
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [sessions, setSessions] = useState<TrainingSession[]>(INITIAL_SESSIONS);
  const [openGymSessions, setOpenGymSessions] = useState<OpenGymSession[]>(INITIAL_OPEN_GYM_SESSIONS);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>(INITIAL_WORKOUT_PLANS);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>(INITIAL_NUTRITION_PLANS);
  const [blackPoints, setBlackPoints] = useState<BlackPoint[]>(INITIAL_BLACK_POINTS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(INITIAL_ATTENDANCE);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(INITIAL_DISCOUNT_CODES);
  const [traineeProfiles, setTraineeProfiles] = useState<TraineeProfessionalProfile[]>([]);
  const [traineeMemoryEntries, setTraineeMemoryEntries] = useState<TraineeMemoryEntry[]>([]);
  const [gymEquipment, setGymEquipment] = useState<GymEquipment[]>([]);
  const [coachPdfDocuments, setCoachPdfDocuments] = useState<CoachPdfDocument[]>([]);
  const [workoutAssistantMessages, setWorkoutAssistantMessages] = useState<WorkoutAssistantMessage[]>([]);
  const [workoutAssistantDrafts, setWorkoutAssistantDrafts] = useState<WorkoutAssistantDraft[]>([]);
  const [groupWorkoutPrograms, setGroupWorkoutPrograms] = useState<GroupWorkoutProgram[]>([]);
  const [groupWorkoutDisplayId, setGroupWorkoutDisplayId] = useState(getGroupWorkoutDisplayId);
  const [clubWorkoutDisplay, setClubWorkoutDisplay] = useState(isClubWorkoutDisplay);
  const [personalWorkoutDisplayId, setPersonalWorkoutDisplayId] = useState(getPersonalWorkoutDisplayId);
  const [traineeSessionWorkoutId, setTraineeSessionWorkoutId] = useState(getTraineeSessionWorkoutId);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView | null>(null);
  const [showTraineeAccessAlert, setShowTraineeAccessAlert] = useState(true);
  const [publicLandingConfig, setPublicLandingConfig] = useState<PublicLandingConfig | null>(null);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<'profile' | 'health' | 'family'>('profile');
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const revisionRef = useRef(0);
  const hydratedRef = useRef(false);
  const pendingClubStateRef = useRef<Record<string, unknown> | null>(null);
  const savingClubStateRef = useRef(false);

  // Active signed-in user
  const [activeUser, setActiveUser] = useState<User>(INITIAL_USERS[0]);

  // State synchronization helper when switching user (so user details like debt, priority score are up to date)
  useEffect(() => {
    const currentDetails = users.find(u => u.id === activeUser.id);
    if (currentDetails) {
      setActiveUser(currentDetails);
    }
  }, [users]);

  const applyServerPayload = (payload: Record<string, unknown>, revision: number) => {
    setSettings({ ...INITIAL_SETTINGS, ...((payload.settings as SystemSettings) || {}) });
    setUsers((payload.users as User[]) || []);
    setSessions((payload.sessions as TrainingSession[]) || []);
    setOpenGymSessions((payload.openGymSessions as OpenGymSession[]) || []);
    setWorkoutPlans((payload.workoutPlans as WorkoutPlan[]) || []);
    setNutritionPlans((payload.nutritionPlans as NutritionPlan[]) || []);
    setBlackPoints((payload.blackPoints as BlackPoint[]) || []);
    setAnnouncements((payload.announcements as Announcement[]) || []);
    setPayments((payload.payments as Payment[]) || []);
    setMessages((payload.messages as Message[]) || []);
    setAttendanceLogs((payload.attendanceLogs as AttendanceLog[]) || []);
    setDiscountCodes((payload.discountCodes as DiscountCode[]) || []);
    setTraineeProfiles((payload.traineeProfiles as TraineeProfessionalProfile[]) || []);
    setTraineeMemoryEntries((payload.traineeMemoryEntries as TraineeMemoryEntry[]) || []);
    setGymEquipment((payload.gymEquipment as GymEquipment[]) || []);
    setCoachPdfDocuments((payload.coachPdfDocuments as CoachPdfDocument[]) || []);
    setWorkoutAssistantMessages((payload.workoutAssistantMessages as WorkoutAssistantMessage[]) || []);
    setWorkoutAssistantDrafts((payload.workoutAssistantDrafts as WorkoutAssistantDraft[]) || []);
    setGroupWorkoutPrograms((payload.groupWorkoutPrograms as GroupWorkoutProgram[]) || []);
    revisionRef.current = revision;
    hydratedRef.current = true;
  };

  const loadAuthenticatedState = async (signedInUser: User) => {
    const state = await getClubState();
    applyServerPayload(state.payload, state.revision);
    setActiveUser(signedInUser);
    setIsAuthenticated(true);
  };

  const flushPendingClubState = async () => {
    if (savingClubStateRef.current || !hydratedRef.current) return;
    savingClubStateRef.current = true;
    try {
      while (pendingClubStateRef.current && hydratedRef.current) {
        const payload = pendingClubStateRef.current;
        pendingClubStateRef.current = null;
        try {
          const result = await saveClubState(payload, revisionRef.current);
          revisionRef.current = result.revision;
          if (result.generatedMessages?.length) {
            setMessages(current => {
              const existingIds = new Set(current.map(message => message.id));
              return [...result.generatedMessages!.filter(message => !existingIds.has(message.id)), ...current];
            });
          }
        } catch (error) {
          const saveError = error as Error & { status?: number };
          if (saveError.status === 409) {
            // Another device updated the club while this payload was being saved.
            // Keep the newest local snapshot (especially newly generated AI drafts),
            // refresh only the revision, and retry instead of hydrating stale server
            // data over optimistic UI state.
            const retryPayload = pendingClubStateRef.current || payload;
            const latest = await getClubState();
            revisionRef.current = latest.revision;
            pendingClubStateRef.current = retryPayload;
          } else {
            console.error('Unable to save club state', saveError);
            if (saveError.status === 413) window.alert(saveError.message);
          }
        }
      }
    } finally {
      savingClubStateRef.current = false;
      if (pendingClubStateRef.current && hydratedRef.current) void flushPendingClubState();
    }
  };

  useEffect(() => {
    let cancelled = false;
    getPublicLandingConfig()
      .then(async config => {
        if (cancelled) return;
        setPublicLandingConfig(config);
        if (config.surface === 'landing') return;
        const { user } = await getServerSession();
        if (!cancelled) await loadAuthenticatedState(user);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setIsBootstrapping(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !hydratedRef.current) return;
    const payload = {
      settings, users, sessions, openGymSessions, workoutPlans, nutritionPlans, blackPoints,
      announcements, payments, messages, attendanceLogs, discountCodes, traineeProfiles,
      traineeMemoryEntries, gymEquipment, coachPdfDocuments, workoutAssistantMessages,
      workoutAssistantDrafts, groupWorkoutPrograms
    };
    const timer = window.setTimeout(() => {
      pendingClubStateRef.current = payload;
      void flushPendingClubState();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings, users, sessions, openGymSessions, workoutPlans, nutritionPlans, blackPoints, announcements, payments, messages, attendanceLogs, discountCodes, traineeProfiles, traineeMemoryEntries, gymEquipment, coachPdfDocuments, workoutAssistantMessages, workoutAssistantDrafts, groupWorkoutPrograms, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !hydratedRef.current || !isPagesDemoMode()) return;
    const timer = window.setTimeout(() => {
      const personalSchedule = workoutPlans.flatMap(plan => {
        const session = plan.sessionId ? sessions.find(item => item.id === plan.sessionId && item.isPersonalTraining) : undefined;
        if (!session || plan.exercises.length === 0) return [];
        const trainee = users.find(user => user.id === session.targetTraineeId);
        return [personalPlanToDisplayProgram(plan, session.demoTraineeName || trainee?.name || session.title, session)];
      });
      void syncClubDisplaySchedule([...groupWorkoutPrograms, ...personalSchedule]).catch(error => {
        console.warn('Unable to synchronize the demo TV schedule', error);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [groupWorkoutPrograms, workoutPlans, sessions, users, isAuthenticated]);

  useEffect(() => {
    const handleHashChange = () => {
      setGroupWorkoutDisplayId(getGroupWorkoutDisplayId());
      setClubWorkoutDisplay(isClubWorkoutDisplay());
      setPersonalWorkoutDisplayId(getPersonalWorkoutDisplayId());
      setTraineeSessionWorkoutId(getTraineeSessionWorkoutId());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Keep this authenticated device registered for production Web Push.
  useEffect(() => {
    if (!isAuthenticated) return;
    void syncServerPushSubscription(Boolean(activeUser.pushNotificationsEnabled)).catch(error => {
      console.warn('Unable to synchronize push subscription', error);
    });
  }, [activeUser.id, activeUser.pushNotificationsEnabled, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('workspace') === 'chat') setWorkspaceView('CHAT');
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || workspaceView !== 'CHAT') return;
    let cancelled = false;
    const refreshChatState = async () => {
      try {
        const latest = await getClubState();
        if (
          !cancelled
          && !savingClubStateRef.current
          && !pendingClubStateRef.current
          && latest.revision > revisionRef.current
        ) applyServerPayload(latest.payload, latest.revision);
      } catch (error) {
        console.warn('Unable to refresh chat messages', error);
      }
    };
    const firstRefresh = window.setTimeout(() => void refreshChatState(), 2500);
    const interval = window.setInterval(() => void refreshChatState(), 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(firstRefresh);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, workspaceView]);

  // In-app notification delivery while the application is open.
  useEffect(() => {
    if (
      !isPagesDemoMode() ||
      !isAuthenticated ||
      !activeUser.pushNotificationsEnabled ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) return;

    const deliverNotifications = async () => {
      if (activeUser.workoutRemindersEnabled) {
        const now = Date.now();
        const nextBooked = sessions
          .filter(session => session.registeredUsers.includes(activeUser.id))
          .map(session => ({
            session,
            startsAt: new Date(`${session.date}T${session.time}:00`).getTime()
          }))
          .filter(item => item.startsAt > now && item.startsAt - now <= 24 * 60 * 60 * 1000)
          .sort((a, b) => a.startsAt - b.startsAt)[0];

        if (nextBooked) {
          const reminderKey = `baly-push-reminder-${activeUser.id}-${nextBooked.session.id}`;
          if (!hasNotificationMarker(reminderKey)) {
            const displayed = await showBrowserNotification(`תזכורת לאימון: ${nextBooked.session.title}`, {
              body: `האימון מחר/היום בשעה ${nextBooked.session.time} עם ${nextBooked.session.coachName}.`
            });
            if (displayed) saveNotificationMarker(reminderKey);
          }
        }
      }

      const unreadMessage = messages.find(message => message.receiverId === activeUser.id && !message.read);
      const staffPushAllowed = activeUser.role !== UserRole.MANAGER || activeUser.managerPushNotificationsEnabled;
      if (unreadMessage && staffPushAllowed) {
        const messagePushKey = `baly-message-push-${unreadMessage.id}`;
        if (!hasNotificationMarker(messagePushKey)) {
          const displayed = await showBrowserNotification(`הודעה חדשה מאת ${unreadMessage.senderName}`, {
            body: unreadMessage.content,
            tag: `message-${unreadMessage.id}`,
            data: { url: `?workspace=chat&contact=${encodeURIComponent(unreadMessage.senderId)}` }
          });
          if (displayed) saveNotificationMarker(messagePushKey);
        }
      }
    };

    void deliverNotifications().catch(error => {
      console.warn('Unable to deliver in-app notifications', error);
    });
  }, [activeUser, isAuthenticated, messages, sessions]);


  // --- AUTOMATED ENGINE: Expire Old Black Points (Section 6) ---
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let updatedPointsNeeded = false;
    
    const updatedPoints = blackPoints.map(bp => {
      if (bp.status === 'ACTIVE' && bp.expiryDate < todayStr) {
        updatedPointsNeeded = true;
        return { ...bp, status: 'EXPIRED' as const };
      }
      return bp;
    });

    if (updatedPointsNeeded) {
      setBlackPoints(updatedPoints);
      
      // Recalculate priority scores for all users affected
      const updatedUsers = users.map(u => {
        if (u.role === UserRole.TRAINEE) {
          const activeCount = updatedPoints.filter(p => p.traineeId === u.id && p.status === 'ACTIVE').length;
          const score = activeCount >= settings.maxBlackPointsBeforePriorityDrop ? 50 : 100;
          return { ...u, priorityScore: score };
        }
        return u;
      });
      setUsers(updatedUsers);
      console.log('Background Engine: Expired outdated black points and updated trainees priorities.');
    }
  }, []);

  const handleLogout = async () => {
    await syncServerPushSubscription(false).catch(() => undefined);
    await logoutServerSession().catch(() => undefined);
    hydratedRef.current = false;
    pendingClubStateRef.current = null;
    setIsAuthenticated(false);
    setWorkspaceView(null);
    setShowTraineeAccessAlert(true);
  };

  // Direct send message callback across dashboards
  const handleSendMessage = (content: string, receiverId: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: activeUser.id,
      senderName: activeUser.name,
      senderRole: activeUser.role,
      receiverId: receiverId,
      content: content,
      timestamp: new Date().toISOString(),
      read: false
    };

    setMessages(prev => [newMessage, ...prev]);
  };

  const handleAcknowledgeStaffAlerts = (alertIds: string[]) => {
    if (!alertIds.length) return;
    const acknowledged = new Set([...(activeUser.staffAlertAcknowledgements || []), ...alertIds]);
    const staffAlertAcknowledgements = [...acknowledged].slice(-500);
    setActiveUser(current => ({ ...current, staffAlertAcknowledgements }));
    setUsers(current => current.map(user => user.id === activeUser.id ? { ...user, staffAlertAcknowledgements } : user));
    const alertIdSet = new Set(alertIds);
    setMessages(current => current.map(message => alertIdSet.has(`chat-${message.id}`) ? { ...message, read: true } : message));
  };

  const handleGatewayRegistration = async (newUser: User, payment: Payment, familyUsers: User[] = [], phoneVerificationToken = '') => {
    const { user } = await registerServerUser(newUser, payment, familyUsers, phoneVerificationToken);
    await loadAuthenticatedState(user);
    if (newUser.healthDeclarationRequiresMedicalCertificate) {
      const submittedMessage = newUser.healthDeclarationMedicalCertificateFileName
        ? ` והעלה/תה אישור רפואי: ${newUser.healthDeclarationMedicalCertificateFileName}`
        : '. עדיין לא הועלה אישור רפואי';
      const managerMessages: Message[] = users
        .filter(user => user.role === UserRole.MANAGER)
        .map(manager => ({
          id: `msg-health-${newUser.id}-${manager.id}-${Date.now()}`,
          senderId: newUser.id,
          senderName: newUser.name,
          senderRole: UserRole.TRAINEE,
          receiverId: manager.id,
          content: `${newUser.name} נרשם/ה עם תשובה חיובית בהצהרת הבריאות${submittedMessage}. נדרש אישור מנהל בלשונית תיעוד ובקרה.`,
          timestamp: new Date().toISOString(),
          read: false
        }));
      setMessages(previous => [...managerMessages, ...previous]);
    }
  };

  const handleCreateFamilyMember = async (newUser: User) => {
    await registerFamilyMember(newUser);
    const latest = await getClubState();
    applyServerPayload(latest.payload, latest.revision);
  };

  const finishServerLogin = async (user: User) => {
    await loadAuthenticatedState(user);
    setWorkspaceView(null);
    setShowTraineeAccessAlert(true);
    return user;
  };

  const handlePasswordLogin = async (login: string, password: string, otp = '') => {
    const result = await loginWithPassword(login, password, otp);
    if ('user' in result) return { user: await finishServerLogin(result.user) };
    return result;
  };

  const handlePhoneLogin = async (phone: string, otp: string) => {
    const { user } = await loginWithPhone(phone, otp);
    return finishServerLogin(user);
  };

  // User details update handler
  const handleUpdateUser = (updatedUser: User) => {
    const { password, ...withoutPassword } = updatedUser;
    const safeUser = withoutPassword as User;
    if (password) updateServerPassword(password).catch(error => console.error('Unable to update password', error));
    setActiveUser(current => current.id === safeUser.id ? safeUser : current);
    setUsers(prev => prev.map(u => u.id === safeUser.id ? safeUser : u));
    setUserToEdit(current => current?.id === safeUser.id ? safeUser : current);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setUserToEdit(null);
    setSettingsInitialSection('profile');
  };

  if (isBootstrapping) {
    return <div className="min-h-screen grid place-items-center bg-zinc-950 text-amber-400 font-bold" dir="rtl">טוען את נתוני המועדון…</div>;
  }

  if (publicLandingConfig?.surface === 'landing') {
    const plans = publicLandingConfig.plans.length
      ? publicLandingConfig.plans
      : (INITIAL_SETTINGS.membershipPlans || []).filter(plan => plan.active);
    const openAppScreen = (screen: 'login' | 'register', plan?: string) => {
      const appUrl = new URL(publicLandingConfig.appUrl, window.location.href);
      appUrl.searchParams.set('screen', screen);
      appUrl.searchParams.set('surface', 'app');
      if (plan) appUrl.searchParams.set('plan', plan);
      window.location.assign(appUrl.toString());
    };
    return (
      <PublicLandingPage
        plans={plans}
        heroImageUrl={publicLandingConfig.images.hero}
        coachingImageUrl={publicLandingConfig.images.coaching}
        onLogin={() => openAppScreen('login')}
        onRegister={plan => openAppScreen('register', plan)}
      />
    );
  }

  if (clubWorkoutDisplay) return <ClubWorkoutDisplay />;

  if (groupWorkoutDisplayId) {
    return <GroupWorkoutDisplay program={groupWorkoutPrograms.find(program => program.id === groupWorkoutDisplayId)} />;
  }

  if (personalWorkoutDisplayId) {
    const workoutPlan = workoutPlans.find(plan => plan.id === personalWorkoutDisplayId)
      || workoutPlans.find(plan => plan.traineeId === personalWorkoutDisplayId && !plan.sessionId)
      || workoutPlans.find(plan => plan.traineeId === personalWorkoutDisplayId);
    const trainee = users.find(user => user.id === workoutPlan?.traineeId || user.id === personalWorkoutDisplayId);
    const displayProgram: GroupWorkoutProgram | undefined = workoutPlan ? {
      id: `personal-display-${workoutPlan.id}`,
      groupName: trainee?.name || 'אימון אישי',
      title: 'תוכנית אימון אישית',
      description: `תוכנית אישית בהנחיית ${workoutPlan.coachName}`,
      coachId: workoutPlan.coachId,
      coachName: workoutPlan.coachName,
      exercises: workoutPlan.exercises.map(exercise => ({
        ...exercise,
        workSeconds: parseDisplaySeconds(exercise.workDuration, 45),
        restSeconds: parseDisplaySeconds(exercise.restDuration, 30),
        rounds: Math.max(1, exercise.sets)
      })),
      defaultWorkSeconds: 45,
      defaultRestSeconds: 30,
      preparationSeconds: 10,
      status: 'PUBLISHED',
      createdAt: workoutPlan.lastUpdated,
      updatedAt: workoutPlan.lastUpdated,
      publishedAt: workoutPlan.lastUpdated
    } : undefined;
    return <GroupWorkoutDisplay program={displayProgram} />;
  }

  if (!isAuthenticated) {
    const authParams = new URLSearchParams(window.location.search);
    const requestedPlan = authParams.get('plan');
    const initialPlan = requestedPlan && Object.values(MembershipType).includes(requestedPlan as MembershipType)
      ? requestedPlan as MembershipType
      : undefined;
    return (
      <AuthGateway
        users={users}
        discountCodes={discountCodes}
        settings={settings}
        onPasswordLogin={handlePasswordLogin}
        onPhoneLogin={handlePhoneLogin}
        onRequestPhoneCode={requestPhoneCode}
        onVerifyRegistrationPhone={verifyRegistrationPhone}
        onRegister={handleGatewayRegistration}
        initialScreen={authParams.get('screen') === 'register' ? 'register' : 'login'}
        initialPlan={initialPlan}
        landingUrl={publicLandingConfig?.landingUrl || undefined}
      />
    );
  }

  if (traineeSessionWorkoutId && activeUser.role === UserRole.TRAINEE) {
    const session = sessions.find(item => item.id === traineeSessionWorkoutId);
    const isRegistered = Boolean(session?.registeredUsers.includes(activeUser.id));
    const groupProgram = groupWorkoutPrograms.find(program =>
      program.sessionId === traineeSessionWorkoutId
      && program.status === 'PUBLISHED'
      && !program.libraryEntry
    );
    if (session && isRegistered && groupProgram) {
      return <TraineeSessionWorkoutView session={session} program={groupProgram} />;
    }
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-950 p-5 text-center text-zinc-100" dir="rtl">
        <div className="max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
          <Dumbbell className="mx-auto text-amber-400" size={34} />
          <h1 className="mt-3 text-lg font-black">תוכנית האימון אינה זמינה</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">ניתן לצפות בתוכנית שפורסמה רק לאחר הרשמה לאימון המתאים ביומן.</p>
          <button type="button" onClick={() => { window.location.hash = ''; }} className="mt-5 min-h-11 w-full rounded-xl bg-amber-400 font-black text-zinc-950">חזרה לאפליקציה</button>
        </div>
      </main>
    );
  }

  const renderCoachWorkspace = (
    mode: 'TRAINING' | 'PLANNING',
    initialPlanningTab: 'programs' | 'nutrition' = 'programs'
  ) => (
    <CoachDashboard
      key={`${activeUser.id}-${mode}-${initialPlanningTab}`}
      users={users}
      sessions={sessions}
      openGymSessions={openGymSessions}
      blackPoints={blackPoints}
      announcements={announcements}
      workoutPlans={workoutPlans}
      nutritionPlans={nutritionPlans}
      messages={messages}
      settings={settings}
      onUpdateWorkoutPlans={setWorkoutPlans}
      onUpdateNutritionPlans={setNutritionPlans}
      onUpdateBlackPoints={setBlackPoints}
      onUpdateSessions={setSessions}
      onUpdateOpenGym={setOpenGymSessions}
      onUpdateAnnouncements={setAnnouncements}
      onUpdateUsers={setUsers}
      onSendMessage={handleSendMessage}
      traineeProfiles={traineeProfiles}
      traineeMemoryEntries={traineeMemoryEntries}
      onUpdateTraineeProfiles={setTraineeProfiles}
      onUpdateTraineeMemoryEntries={setTraineeMemoryEntries}
      gymEquipment={gymEquipment}
      onUpdateGymEquipment={setGymEquipment}
      coachPdfDocuments={coachPdfDocuments}
      onUpdateCoachPdfDocuments={setCoachPdfDocuments}
      workoutAssistantMessages={workoutAssistantMessages}
      workoutAssistantDrafts={workoutAssistantDrafts}
      onUpdateWorkoutAssistantMessages={setWorkoutAssistantMessages}
      onUpdateWorkoutAssistantDrafts={setWorkoutAssistantDrafts}
      groupWorkoutPrograms={groupWorkoutPrograms}
      onUpdateGroupWorkoutPrograms={setGroupWorkoutPrograms}
      activeUser={activeUser}
      initialMode={mode}
      initialPlanningTab={initialPlanningTab}
      hideModeSwitcher
    />
  );

  const traineeInitialTab = workspaceView === 'BOOKING'
    ? 'classes'
    : workspaceView === 'MY_PROGRAM'
      ? 'workout'
      : workspaceView === 'MY_NUTRITION'
        ? 'nutrition'
        : workspaceView === 'MY_MEMBERSHIP'
          ? 'membership'
          : workspaceView === 'CHECK_IN'
            ? 'card'
            : 'profile';

  const familyPayer = activeUser.familyPayerId
    ? users.find(user => user.id === activeUser.familyPayerId)
    : undefined;
  const hasValidPayment = (activeUser.membershipStatus === MembershipStatus.ACTIVE && !isMembershipCancellationEffective(activeUser))
    || Boolean(activeUser.offlinePaymentApproved)
    || (familyPayer?.membershipStatus === MembershipStatus.ACTIVE && !isMembershipCancellationEffective(familyPayer))
    || Boolean(familyPayer?.offlinePaymentApproved);
  const healthSignedAt = activeUser.healthDeclarationDate
    ? new Date(`${activeUser.healthDeclarationDate}T00:00:00`)
    : null;
  const healthExpiresAt = healthSignedAt ? new Date(healthSignedAt) : null;
  if (healthExpiresAt) healthExpiresAt.setFullYear(healthExpiresAt.getFullYear() + 1);
  const hasValidHealthDeclaration = Boolean(
    activeUser.healthDeclarationSigned
    && (!activeUser.healthDeclarationRequiresMedicalCertificate || activeUser.healthDeclarationMedicalCertificateApproved)
    && healthExpiresAt
    && Number.isFinite(healthExpiresAt.getTime())
    && Date.now() <= healthExpiresAt.getTime()
  );
  const showBlockingAlert = activeUser.role === UserRole.TRAINEE
    && showTraineeAccessAlert
    && (!hasValidPayment || !hasValidHealthDeclaration);

  return (
    <div className={`app-shell role-${activeUser.role.toLowerCase()} min-h-screen flex flex-col font-sans antialiased`} dir="rtl">
      {/* Visual Header */}
      <header className="app-header bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 text-white shadow-md border-b border-amber-500/20">
        <div className="app-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="app-brand flex items-center gap-3">
            <RubisLogo size={192} />
            <div className="app-brand-copy">
              <p>אימונים, בריאות וליווי אישי במקום אחד</p>
            </div>
          </div>

          {/* User Auth & Profile Header Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Active user badge */}
            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-1.5 pr-3 rounded-xl">
              <img
                src={activeUser.imageUrl}
                alt={activeUser.name}
                className="w-7 h-7 rounded-full object-cover border border-amber-500/40"
              />
              <div className="text-right">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  {activeUser.name}
                  {activeUser.username && (
                    <span className="text-[10px] text-zinc-400 font-mono font-normal">(@{activeUser.username})</span>
                  )}
                </div>
                <div className="text-[9px] text-zinc-400">
                  {activeUser.role === UserRole.MANAGER ? 'מנהל / מאמן ראשי' : activeUser.role === UserRole.COACH ? 'מאמן צוות' : 'מתאמן רשום'}
                </div>
              </div>

              <button
                onClick={() => {
                  setUserToEdit(activeUser);
                  setSettingsInitialSection('profile');
                  setIsSettingsOpen(true);
                }}
                className="mr-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg transition border border-zinc-700 cursor-pointer"
                title="הגדרות חשבון ועדכון סיסמה / משפחה"
              >
                <Settings size={14} />
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn size={14} className="text-amber-400" />
              יציאה
            </button>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main flex-grow max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Dynamic Dashboards */}
        <div className="dashboard-stage transition-all duration-300">
          {!workspaceView && (
            <RoleWorkspaceLanding
              activeUser={activeUser}
              onSelect={setWorkspaceView}
              onOpenProfile={() => {
                setUserToEdit(activeUser);
                setSettingsInitialSection('profile');
                setIsSettingsOpen(true);
              }}
              users={users}
              sessions={sessions}
              announcements={announcements}
              messages={messages}
              payments={payments}
              onUpdateAnnouncements={setAnnouncements}
              onAcknowledgeStaffAlerts={handleAcknowledgeStaffAlerts}
            />
          )}

          {workspaceView && (
            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('workspace');
                url.searchParams.delete('contact');
                window.history.replaceState({}, '', url);
                setWorkspaceView(null);
              }}
              className="mb-4 flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:border-amber-400 hover:text-amber-400"
            >
              <ArrowRight size={17} /> חזרה לבחירת אזור
            </button>
          )}

          {workspaceView === 'CHAT' && (
            <ClubChatCenter
              activeUser={activeUser}
              users={users}
              messages={messages}
              initialContactId={new URLSearchParams(window.location.search).get('contact') || ''}
              onSendMessage={handleSendMessage}
              onUpdateMessages={setMessages}
              onBack={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('workspace');
                url.searchParams.delete('contact');
                window.history.replaceState({}, '', url);
                setWorkspaceView(null);
              }}
            />
          )}

          {activeUser.role === UserRole.MANAGER && workspaceView === 'CLUB_MANAGEMENT' && (
            <AdminDashboard
              users={users}
              sessions={sessions}
              openGymSessions={openGymSessions}
              blackPoints={blackPoints}
              announcements={announcements}
              payments={payments}
              attendanceLogs={attendanceLogs}
              discountCodes={discountCodes}
              settings={settings}
              workoutPlans={workoutPlans}
              nutritionPlans={nutritionPlans}
              messages={messages}
              onUpdateSessions={setSessions}
              onUpdateOpenGym={setOpenGymSessions}
              onUpdateBlackPoints={setBlackPoints}
              onUpdateUsers={setUsers}
              onUpdateAnnouncements={setAnnouncements}
              onUpdatePayments={setPayments}
              onUpdateSettings={setSettings}
              onUpdateDiscountCodes={setDiscountCodes}
              onUpdateWorkoutPlans={setWorkoutPlans}
              onUpdateNutritionPlans={setNutritionPlans}
              onSendMessage={handleSendMessage}
              traineeProfiles={traineeProfiles}
              traineeMemoryEntries={traineeMemoryEntries}
              onUpdateTraineeProfiles={setTraineeProfiles}
              onUpdateTraineeMemoryEntries={setTraineeMemoryEntries}
              gymEquipment={gymEquipment}
              onUpdateGymEquipment={setGymEquipment}
              coachPdfDocuments={coachPdfDocuments}
              onUpdateCoachPdfDocuments={setCoachPdfDocuments}
              workoutAssistantMessages={workoutAssistantMessages}
              workoutAssistantDrafts={workoutAssistantDrafts}
              onUpdateWorkoutAssistantMessages={setWorkoutAssistantMessages}
              onUpdateWorkoutAssistantDrafts={setWorkoutAssistantDrafts}
              groupWorkoutPrograms={groupWorkoutPrograms}
              onUpdateGroupWorkoutPrograms={setGroupWorkoutPrograms}
              activeUser={activeUser}
            />
          )}

          {activeUser.role === UserRole.MANAGER && workspaceView === 'TRAINING' && renderCoachWorkspace('TRAINING')}
          {activeUser.role === UserRole.MANAGER && workspaceView === 'WORKOUT_PLANNING' && renderCoachWorkspace('PLANNING')}
          {activeUser.role === UserRole.MANAGER && workspaceView === 'NUTRITION_PLANNING' && renderCoachWorkspace('PLANNING', 'nutrition')}

          {activeUser.role === UserRole.COACH && workspaceView === 'TRAINING' && renderCoachWorkspace('TRAINING')}
          {activeUser.role === UserRole.COACH && workspaceView === 'WORKOUT_PLANNING' && renderCoachWorkspace('PLANNING')}
          {activeUser.role === UserRole.COACH && workspaceView === 'NUTRITION_PLANNING' && renderCoachWorkspace('PLANNING', 'nutrition')}

          {activeUser.role === UserRole.TRAINEE && workspaceView && workspaceView !== 'CHAT' && (
            <TraineeDashboard
              key={`${activeUser.id}-${workspaceView}`}
              activeUser={activeUser}
              users={users}
              sessions={sessions}
              openGymSessions={openGymSessions}
              workoutPlans={workoutPlans}
              groupWorkoutPrograms={groupWorkoutPrograms}
              nutritionPlans={nutritionPlans}
              blackPoints={blackPoints}
              messages={messages}
              announcements={announcements}
              payments={payments}
              attendanceLogs={attendanceLogs}
              discountCodes={discountCodes}
              settings={settings}
              onUpdateSessions={setSessions}
              onUpdateOpenGym={setOpenGymSessions}
              onUpdateAttendance={setAttendanceLogs}
              onUpdateUsers={setUsers}
              onUpdateBlackPoints={setBlackPoints}
              onUpdatePayments={setPayments}
              onSendMessage={handleSendMessage}
              onOpenSettings={(section = 'profile') => {
                setUserToEdit(activeUser);
                setSettingsInitialSection(section);
                setIsSettingsOpen(true);
              }}
              onHome={() => setWorkspaceView(null)}
              onLogout={handleLogout}
              initialTab={traineeInitialTab}
            />
          )}
        </div>
      </main>

      {/* Aesthetic Footer */}
      <footer className="app-footer bg-zinc-950 text-zinc-500 text-xs py-6 mt-12 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-right">
          <div>
            <span className="font-bold text-white font-sans text-xs text-amber-500">BALY wellness</span> — מערכת חכמה לניהול חוויית האימון והמנוי.
          </div>
        </div>
      </footer>
      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        currentUser={userToEdit || activeUser}
        onUpdateUser={handleUpdateUser}
        allUsers={users}
        onUpdateAllUsers={setUsers}
        onCreateFamilyMember={handleCreateFamilyMember}
        discountCodes={discountCodes}
        onUpdateDiscountCodes={setDiscountCodes}
        isAdminMode={activeUser.role === UserRole.MANAGER && userToEdit?.id !== activeUser.id}
        initialSection={settingsInitialSection}
        onOpenFamilyPurchase={activeUser.role === UserRole.TRAINEE ? () => setWorkspaceView('MY_MEMBERSHIP') : undefined}
        onMedicalCertificateSubmitted={(fileName) => {
          users.filter(user => user.role === UserRole.MANAGER).forEach(manager => {
            handleSendMessage(
              `${userToEdit?.name || activeUser.name} מילא/ה הצהרת בריאות עם תשובה חיובית${fileName ? ` והעלה/תה אישור רפואי: ${fileName}` : '. עדיין לא הועלה אישור רפואי'}. נדרש אישור מנהל בלשונית תיעוד ובקרה.`,
              manager.id
            );
          });
        }}
      />

      {showBlockingAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="access-alert-title">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-700 bg-zinc-950 p-5 text-white shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-amber-400">נדרשת פעולה בחשבון</p>
                <h2 id="access-alert-title" className="mt-1 text-2xl font-black">לפני שנרשמים לאימון</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">יש להסדיר את הנושאים הבאים. עד להסדרם ההרשמה לאימונים חסומה.</p>
              </div>
              <button type="button" onClick={() => setShowTraineeAccessAlert(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-zinc-400 hover:text-white" aria-label="סגירה"><X size={18} /></button>
            </div>

            <div className="mt-5 space-y-3">
              {!hasValidPayment && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex gap-3"><CreditCard className="shrink-0 text-amber-400" size={22} /><div><h3 className="font-black">המנוי אינו משולם או אינו פעיל</h3><p className="mt-1 text-xs leading-5 text-zinc-400">יש לבחור מסלול או להסדיר את התשלום לפני הרשמה לאימון.</p></div></div>
                  <button type="button" onClick={() => { setWorkspaceView('MY_MEMBERSHIP'); setShowTraineeAccessAlert(false); }} className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-zinc-950">להסדרת מנוי ותשלום</button>
                </div>
              )}

              {!hasValidHealthDeclaration && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <div className="flex gap-3"><HeartPulse className="shrink-0 text-rose-400" size={22} /><div><h3 className="font-black">הצהרת הבריאות חסרה או פגה</h3><p className="mt-1 text-xs leading-5 text-zinc-400">תוקף ההצהרה הוא שנה. לאחר מכן נדרשת חתימה מחדש.</p></div></div>
                  <button type="button" onClick={() => { setUserToEdit(activeUser); setSettingsInitialSection('health'); setIsSettingsOpen(true); setShowTraineeAccessAlert(false); }} className="mt-3 w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-black text-white">לחתימה על הצהרת בריאות</button>
                </div>
              )}
            </div>

            <button type="button" onClick={() => setShowTraineeAccessAlert(false)} className="mt-5 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-900">הבנתי, אטפל מאוחר יותר</button>
          </div>
        </div>
      )}
    </div>
  );
}
