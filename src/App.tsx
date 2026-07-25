/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  INITIAL_DISCOUNT_CODES,
  getLocalStorageData,
  saveLocalStorageData
} from './data/mockData';
import { RoleSwitcher } from './components/RoleSwitcher';
import { AdminDashboard } from './components/AdminDashboard';
import { CoachDashboard } from './components/CoachDashboard';
import { TraineeDashboard } from './components/TraineeDashboard';
import { RubisLogo } from './components/RubisLogo';
import { LoginModal } from './components/LoginModal';
import { RegisterModal } from './components/RegisterModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { Dumbbell, UserCheck, AlertOctagon, HelpCircle, Flame, ShieldAlert, Sparkles, LogIn, UserPlus, Settings, User as UserIcon } from 'lucide-react';

export default function App() {
  // --- Global Application State ---
  const [settings, setSettings] = useState<SystemSettings>(() =>
    getLocalStorageData('gym_settings_v7', INITIAL_SETTINGS)
  );
  const [users, setUsers] = useState<User[]>(() =>
    getLocalStorageData('gym_users_v7', INITIAL_USERS)
  );
  const [sessions, setSessions] = useState<TrainingSession[]>(() =>
    getLocalStorageData('gym_sessions_v7', INITIAL_SESSIONS)
  );
  const [openGymSessions, setOpenGymSessions] = useState<OpenGymSession[]>(() =>
    getLocalStorageData('gym_opengym_v7', INITIAL_OPEN_GYM_SESSIONS)
  );
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>(() =>
    getLocalStorageData('gym_workouts_v7', INITIAL_WORKOUT_PLANS)
  );
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>(() =>
    getLocalStorageData('gym_nutrition_v7', INITIAL_NUTRITION_PLANS)
  );
  const [blackPoints, setBlackPoints] = useState<BlackPoint[]>(() =>
    getLocalStorageData('gym_blackpoints_v7', INITIAL_BLACK_POINTS)
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    getLocalStorageData('gym_announcements_v7', INITIAL_ANNOUNCEMENTS)
  );
  const [payments, setPayments] = useState<Payment[]>(() =>
    getLocalStorageData('gym_payments_v7', INITIAL_PAYMENTS)
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    getLocalStorageData('gym_messages_v7', INITIAL_MESSAGES)
  );
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(() =>
    getLocalStorageData('gym_attendance_v7', INITIAL_ATTENDANCE)
  );
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(() =>
    getLocalStorageData('gym_discounts_v7', INITIAL_DISCOUNT_CODES)
  );

  // Modals state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  // Active Simulated User
  const [activeUser, setActiveUser] = useState<User>(() => {
    const loadedUsers = getLocalStorageData('gym_users_v7', INITIAL_USERS);
    // Open on the mobile trainee experience shown in the product mockup.
    return loadedUsers.find(u => u.id === 'trainee-meni')
      || loadedUsers.find(u => u.role === UserRole.TRAINEE)
      || loadedUsers[0];
  });

  // State synchronization helper when switching user (so user details like debt, priority score are up to date)
  useEffect(() => {
    const currentDetails = users.find(u => u.id === activeUser.id);
    if (currentDetails) {
      setActiveUser(currentDetails);
    }
  }, [users]);

  // --- Auto-Save States on changes ---
  useEffect(() => {
    saveLocalStorageData('gym_settings_v7', settings);
  }, [settings]);

  useEffect(() => {
    saveLocalStorageData('gym_users_v7', users);
  }, [users]);

  useEffect(() => {
    saveLocalStorageData('gym_sessions_v7', sessions);
  }, [sessions]);

  useEffect(() => {
    saveLocalStorageData('gym_opengym_v7', openGymSessions);
  }, [openGymSessions]);

  useEffect(() => {
    saveLocalStorageData('gym_workouts_v7', workoutPlans);
  }, [workoutPlans]);

  useEffect(() => {
    saveLocalStorageData('gym_nutrition_v7', nutritionPlans);
  }, [nutritionPlans]);

  useEffect(() => {
    saveLocalStorageData('gym_blackpoints_v7', blackPoints);
  }, [blackPoints]);

  useEffect(() => {
    saveLocalStorageData('gym_announcements_v7', announcements);
  }, [announcements]);

  useEffect(() => {
    saveLocalStorageData('gym_payments_v7', payments);
  }, [payments]);

  useEffect(() => {
    saveLocalStorageData('gym_messages_v7', messages);
  }, [messages]);

  useEffect(() => {
    saveLocalStorageData('gym_attendance_v7', attendanceLogs);
  }, [attendanceLogs]);

  useEffect(() => {
    saveLocalStorageData('gym_discounts_v7', discountCodes);
  }, [discountCodes]);


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

  // --- INTERACTIVE SIMULATOR: No-Show Penalty Trigger (Section 9, 17.4) ---
  // This simulates the check at the end of class: comparing registered list vs who actually performed check-in.
  const handleSimulateNoShowChecks = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find active sessions of today
    const todaysSessions = sessions.filter(s => s.date === todayStr);
    
    if (todaysSessions.length === 0) {
      alert('אין אימונים מוגדרים להיום ביומן השעות כדי להריץ את הבדיקה. אנא צור אימון להיום בפאנל הניהול.');
      return;
    }

    let penaltyIssuedCount = 0;
    const newPenalties: BlackPoint[] = [];

    // Loop through each session of today
    todaysSessions.forEach(session => {
      session.registeredUsers.forEach(traineeId => {
        // Check if this trainee has a check-in logged for this session
        const didCheckIn = attendanceLogs.some(
          log => log.traineeId === traineeId && log.type === 'SESSION' && log.targetId === session.id
        );

        if (!didCheckIn) {
          // Check if a penalty was already issued to prevent duplicate testing
          const alreadyPenalized = blackPoints.some(
            bp => bp.traineeId === traineeId && bp.sessionId === session.id && bp.status === 'ACTIVE'
          );

          if (!alreadyPenalized) {
            const trainee = users.find(u => u.id === traineeId);
            if (trainee) {
              penaltyIssuedCount++;
              newPenalties.push({
                id: `bp-${Date.now()}-${traineeId}`,
                traineeId: trainee.id,
                traineeName: trainee.name,
                sessionId: session.id,
                sessionTitle: session.title,
                sessionDate: session.date,
                issuedDate: todayStr,
                expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0], // 1 month
                status: 'ACTIVE',
                reason: 'מערכת אוטומטית: אי-הגעה לאימון ואי סריקת כרטיס נוכחות בקבלה'
              });
            }
          }
        }
      });
    });

    if (penaltyIssuedCount > 0) {
      const combinedPoints = [...newPenalties, ...blackPoints];
      setBlackPoints(combinedPoints);

      // Recalculate priority scores
      const updatedUsers = users.map(u => {
        if (u.role === UserRole.TRAINEE) {
          const activeCount = combinedPoints.filter(p => p.traineeId === u.id && p.status === 'ACTIVE').length;
          const score = activeCount >= settings.maxBlackPointsBeforePriorityDrop ? 50 : 100;
          return { ...u, priorityScore: score };
        }
        return u;
      });
      setUsers(updatedUsers);

      alert(`סריקת הנוכחות הושלמה!\n\nנמצאו ${penaltyIssuedCount} מקרים של מתאמנים שנרשמו לאימונים היום אך לא ביצעו צ'ק-אין בקבלה.\nהוטלה עליהם נקודה שחורה פעילה ועדיפותם בתור עודכנה.`);
    } else {
      alert('סריקת הנוכחות הושלמה!\nכל המתאמנים שרשומים לאימונים היום ביצעו צ\'ק-אין תקין, או שכבר הוטלו עונשים.');
    }
  };

  // Reset database completely
  const handleResetDatabase = () => {
    if (confirm('האם אתה בטוח שברצונך לאפס את כל הנתונים השמורים במערכת לערכי ברירת המחדל?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Switch Active user simulation callback
  const handleSwitchUser = (user: User) => {
    setActiveUser(user);
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

  // Registration completion handler
  const handleCompleteRegistration = (newUser: User, familyMembers?: User[]) => {
    const updatedUsersList = [newUser, ...(familyMembers || []), ...users];
    setUsers(updatedUsersList);
    setActiveUser(newUser);
  };

  // Login handler
  const handleLoginSuccess = (user: User) => {
    setActiveUser(user);
  };

  // User details update handler
  const handleUpdateUser = (updatedUser: User) => {
    setActiveUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  return (
    <div className={`app-shell role-${activeUser.role.toLowerCase()} min-h-screen flex flex-col font-sans antialiased`} dir="rtl">
      {/* Visual Header */}
      <header className="app-header bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 text-white shadow-md border-b border-amber-500/20">
        <div className="app-header-inner max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-0.5 rounded-full border-2 border-amber-500/40 shadow-lg shadow-black/50 shrink-0">
              <RubisLogo size={54} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2 font-sans text-amber-500">
                RUBIS <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded">PREMIUM</span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-sans">מועדון כושר ובודיבילדינג • מערכת חכמה לניהול מנויים, אימונים ועונשים</p>
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
                  setIsSettingsOpen(true);
                }}
                className="mr-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg transition border border-zinc-700 cursor-pointer"
                title="הגדרות חשבון ועדכון סיסמה / משפחה"
              >
                <Settings size={14} />
              </button>
            </div>

            <button
              onClick={() => setIsLoginOpen(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn size={14} className="text-amber-400" />
              התחברות
            </button>

            <button
              onClick={() => setIsRegisterOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/30"
            >
              <UserPlus size={14} />
              הרשמה למועדון ✍️
            </button>

            {/* Interactive Simulation Panel for No-Show Auto Engine */}
            <button
              onClick={handleSimulateNoShowChecks}
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-[10px] font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1 shadow-md shadow-amber-950/20 cursor-pointer"
              id="btn-trigger-noshow-checker"
              title="סוגר אימונים ובודק מי נרשם אך לא עשה צ'ק אין, ומטיל עליו נקודה שחורה"
            >
              <ShieldAlert size={12} />
              סורק אי-הגעה ⚡
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main flex-grow max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Role Simulator Widget */}
        <RoleSwitcher
          allUsers={users}
          activeUser={activeUser}
          onSwitchUser={handleSwitchUser}
          onResetDatabase={handleResetDatabase}
        />

        {/* Dynamic Dashboards */}
        <div className="dashboard-stage transition-all duration-300">
          {activeUser.role === UserRole.MANAGER && (
            <AdminDashboard
              users={users}
              sessions={sessions}
              openGymSessions={openGymSessions}
              blackPoints={blackPoints}
              announcements={announcements}
              payments={payments}
              settings={settings}
              discountCodes={discountCodes}
              onUpdateSessions={setSessions}
              onUpdateOpenGym={setOpenGymSessions}
              onUpdateBlackPoints={setBlackPoints}
              onUpdateUsers={setUsers}
              onUpdateAnnouncements={setAnnouncements}
              onUpdatePayments={setPayments}
              onUpdateSettings={setSettings}
              onUpdateDiscountCodes={setDiscountCodes}
              activeUser={activeUser}
            />
          )}

          {activeUser.role === UserRole.COACH && (
            <CoachDashboard
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
              activeUser={activeUser}
            />
          )}

          {activeUser.role === UserRole.TRAINEE && (
            <TraineeDashboard
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
              settings={settings}
              onUpdateSessions={setSessions}
              onUpdateOpenGym={setOpenGymSessions}
              onUpdateAttendance={setAttendanceLogs}
              onUpdateUsers={setUsers}
              onUpdateBlackPoints={setBlackPoints}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>
      </main>

      {/* Aesthetic Footer */}
      <footer className="app-footer bg-zinc-950 text-zinc-500 text-xs py-6 mt-12 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-right">
          <div>
            <span className="font-bold text-white font-sans text-xs text-amber-500">RUBIS Premium</span> — מערכת אפיון PWA מתקדמת לניהול מועדון כושר ובודיבילדינג יוקרתי.
          </div>
          <div className="flex gap-4 text-zinc-600 text-[10px]">
            <span>נבנה בהתאמה מלאה למסמך האפיון של RUBIS (גרסה 3.5)</span>
            <span>•</span>
            <span>מצב סימולטור וסורק קוד נוכחות פעילים</span>
          </div>
        </div>
      </footer>
      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        users={users}
        onLoginSuccess={handleLoginSuccess}
        onOpenRegister={() => setIsRegisterOpen(true)}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        existingUsers={users}
        onCompleteRegistration={handleCompleteRegistration}
        discountCodes={discountCodes}
        onUpdateDiscountCodes={setDiscountCodes}
      />

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={userToEdit || activeUser}
        onUpdateUser={handleUpdateUser}
        allUsers={users}
        onUpdateAllUsers={setUsers}
        discountCodes={discountCodes}
        onUpdateDiscountCodes={setDiscountCodes}
        isAdminMode={activeUser.role === UserRole.MANAGER && userToEdit?.id !== activeUser.id}
      />
    </div>
  );
}
