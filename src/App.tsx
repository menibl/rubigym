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
  MembershipStatus
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
import { getClubState, getServerSession, loginWithPassword, loginWithPhone, logoutServerSession, registerFamilyMember, registerServerUser, saveClubState, updateServerPassword } from './data/clubServer';
import { AdminDashboard } from './components/AdminDashboard';
import { CoachDashboard } from './components/CoachDashboard';
import { TraineeDashboard } from './components/TraineeDashboard';
import { AuthGateway } from './components/AuthGateway';
import { RubisLogo } from './components/RubisLogo';
import { UserSettingsModal } from './components/UserSettingsModal';
import { GroupWorkoutDisplay } from './components/GroupWorkoutDisplay';
import { ClubWorkoutDisplay } from './components/ClubWorkoutDisplay';
import { RoleWorkspaceLanding, WorkspaceView } from './components/RoleWorkspaceLanding';
import { isMembershipCancellationEffective } from './data/membershipPolicy';
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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView | null>(null);
  const [showTraineeAccessAlert, setShowTraineeAccessAlert] = useState(true);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<'profile' | 'health' | 'family'>('profile');
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const revisionRef = useRef(0);
  const hydratedRef = useRef(false);

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

  useEffect(() => {
    getServerSession()
      .then(({ user }) => loadAuthenticatedState(user))
      .catch(() => undefined)
      .finally(() => setIsBootstrapping(false));
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
      saveClubState(payload, revisionRef.current)
        .then(result => { revisionRef.current = result.revision; })
        .catch(async (error: Error & { status?: number }) => {
          if (error.status === 409) {
            const latest = await getClubState();
            applyServerPayload(latest.payload, latest.revision);
          } else {
            console.error('Unable to save club state', error);
          }
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings, users, sessions, openGymSessions, workoutPlans, nutritionPlans, blackPoints, announcements, payments, messages, attendanceLogs, discountCodes, traineeProfiles, traineeMemoryEntries, gymEquipment, coachPdfDocuments, workoutAssistantMessages, workoutAssistantDrafts, groupWorkoutPrograms, isAuthenticated]);

  useEffect(() => {
    const handleHashChange = () => {
      setGroupWorkoutDisplayId(getGroupWorkoutDisplayId());
      setClubWorkoutDisplay(isClubWorkoutDisplay());
      setPersonalWorkoutDisplayId(getPersonalWorkoutDisplayId());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // In-app notification delivery while the application is open.
  useEffect(() => {
    if (
      !isAuthenticated ||
      !activeUser.pushNotificationsEnabled ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) return;

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
        if (!localStorage.getItem(reminderKey)) {
          new Notification(`תזכורת לאימון: ${nextBooked.session.title}`, {
            body: `האימון מחר/היום בשעה ${nextBooked.session.time} עם ${nextBooked.session.coachName}.`
          });
          localStorage.setItem(reminderKey, new Date().toISOString());
        }
      }
    }

    if (activeUser.role === UserRole.MANAGER && activeUser.managerPushNotificationsEnabled) {
      const unreadForManager = messages.find(message =>
        message.receiverId === activeUser.id && !message.read
      );
      if (unreadForManager) {
        const managerPushKey = `baly-manager-push-${unreadForManager.id}`;
        if (!localStorage.getItem(managerPushKey)) {
          new Notification(`פנייה חדשה למנהל מאת ${unreadForManager.senderName}`, {
            body: unreadForManager.content
          });
          localStorage.setItem(managerPushKey, new Date().toISOString());
        }
      }
    }
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
    await logoutServerSession().catch(() => undefined);
    hydratedRef.current = false;
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

  const handleGatewayRegistration = async (newUser: User, payment: Payment, familyUsers: User[] = []) => {
    const { user } = await registerServerUser(newUser, payment, familyUsers);
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

  const handlePasswordLogin = async (login: string, password: string) => {
    const { user } = await loginWithPassword(login, password);
    return finishServerLogin(user);
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

  if (isBootstrapping) {
    return <div className="min-h-screen grid place-items-center bg-zinc-950 text-amber-400 font-bold" dir="rtl">טוען את נתוני המועדון…</div>;
  }

  if (!isAuthenticated) {
    return (
      <AuthGateway
        users={users}
        discountCodes={discountCodes}
        settings={settings}
        onPasswordLogin={handlePasswordLogin}
        onPhoneLogin={handlePhoneLogin}
        onRegister={handleGatewayRegistration}
      />
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
              onSendMessage={handleSendMessage}
              onUpdateAnnouncements={setAnnouncements}
            />
          )}

          {workspaceView && (
            <button
              type="button"
              onClick={() => setWorkspaceView(null)}
              className="mb-4 flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:border-amber-400 hover:text-amber-400"
            >
              <ArrowRight size={17} /> חזרה לבחירת אזור
            </button>
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

          {activeUser.role === UserRole.TRAINEE && workspaceView && (
            <TraineeDashboard
              key={`${activeUser.id}-${workspaceView}`}
              activeUser={activeUser}
              users={users}
              sessions={sessions}
              openGymSessions={openGymSessions}
              workoutPlans={workoutPlans}
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
