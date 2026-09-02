/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WeeklyCalendar } from './WeeklyCalendar';
import { addMinutesToTime, CreateSessionModal, CreateSessionData, createSessionsFromData } from './CreateSessionModal';
import { EditSessionModal } from './EditSessionModal';
import { copyGroupProgramToSessions, copyPersonalPlanToSessions } from '../data/workoutAssignment';
import { CoachDashboard } from './CoachDashboard';
import {
  User,
  TrainingSession,
  OpenGymSession,
  BlackPoint,
  Announcement,
  Payment,
  SystemSettings,
  MuscleGroup,
  Gender,
  MembershipType,
  CURRENT_MEMBERSHIP_CATALOG,
  MEMBERSHIP_TYPE_LABELS,
  MEMBERSHIP_PRICES,
  DEFAULT_MEMBERSHIP_PLAN_CONFIGS,
  MembershipPlanConfig,
  MembershipStatus,
  UserRole,
  DiscountCode,
  WorkoutPlan,
  NutritionPlan,
  Message,
  TraineeMemoryEntry,
  TraineeProfessionalProfile,
  GymEquipment,
  CoachPdfDocument,
  WorkoutAssistantDraft,
  WorkoutAssistantMessage,
  GroupWorkoutProgram,
  AttendanceLog
} from '../types';
import { ClubCheckInBarcode } from './ClubCheckInBarcode';
import { createMembershipTerm } from '../data/membershipPolicy';
import { LandingImageManager } from './LandingImageManager';
import { SessionMembershipSelector } from './SessionMembershipSelector';
import {
  Calendar,
  Settings,
  Users,
  CreditCard,
  Bell,
  Trash2,
  Edit3,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Tag,
  Percent,
  BookOpen,
  UserPlus,
  ClipboardCheck,
  FileDown,
  HeartPulse
} from 'lucide-react';

interface AdminDashboardProps {
  users: User[];
  sessions: TrainingSession[];
  openGymSessions: OpenGymSession[];
  blackPoints: BlackPoint[];
  announcements: Announcement[];
  payments: Payment[];
  attendanceLogs: AttendanceLog[];
  settings: SystemSettings;
  discountCodes?: DiscountCode[];
  workoutPlans: WorkoutPlan[];
  nutritionPlans: NutritionPlan[];
  messages: Message[];
  onUpdateSessions: (sessions: TrainingSession[]) => void;
  onUpdateOpenGym: (openGyms: OpenGymSession[]) => void;
  onUpdateBlackPoints: (blackPoints: BlackPoint[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateAnnouncements: (announcements: Announcement[]) => void;
  onUpdatePayments: (payments: Payment[]) => void;
  onUpdateSettings: (settings: SystemSettings) => void;
  onUpdateDiscountCodes?: (discountCodes: DiscountCode[]) => void;
  onUpdateWorkoutPlans: (plans: WorkoutPlan[]) => void;
  onUpdateNutritionPlans: (plans: NutritionPlan[]) => void;
  onSendMessage: (content: string, receiverId: string) => void;
  traineeProfiles: TraineeProfessionalProfile[];
  traineeMemoryEntries: TraineeMemoryEntry[];
  onUpdateTraineeProfiles: (profiles: TraineeProfessionalProfile[]) => void;
  onUpdateTraineeMemoryEntries: (entries: TraineeMemoryEntry[]) => void;
  gymEquipment: GymEquipment[];
  onUpdateGymEquipment: (equipment: GymEquipment[]) => void;
  coachPdfDocuments: CoachPdfDocument[];
  onUpdateCoachPdfDocuments: (documents: CoachPdfDocument[]) => void;
  workoutAssistantMessages: WorkoutAssistantMessage[];
  workoutAssistantDrafts: WorkoutAssistantDraft[];
  onUpdateWorkoutAssistantMessages: (messages: WorkoutAssistantMessage[]) => void;
  onUpdateWorkoutAssistantDrafts: (drafts: WorkoutAssistantDraft[]) => void;
  groupWorkoutPrograms: GroupWorkoutProgram[];
  onUpdateGroupWorkoutPrograms: (programs: GroupWorkoutProgram[]) => void;
  activeUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  sessions,
  openGymSessions,
  blackPoints,
  announcements,
  payments,
  attendanceLogs,
  settings,
  discountCodes = [],
  workoutPlans,
  nutritionPlans,
  messages,
  onUpdateSessions,
  onUpdateOpenGym,
  onUpdateBlackPoints,
  onUpdateUsers,
  onUpdateAnnouncements,
  onUpdatePayments,
  onUpdateSettings,
  onUpdateDiscountCodes,
  onUpdateWorkoutPlans,
  onUpdateNutritionPlans,
  onSendMessage,
  traineeProfiles,
  traineeMemoryEntries,
  onUpdateTraineeProfiles,
  onUpdateTraineeMemoryEntries,
  gymEquipment,
  onUpdateGymEquipment,
  coachPdfDocuments,
  onUpdateCoachPdfDocuments,
  workoutAssistantMessages,
  workoutAssistantDrafts,
  onUpdateWorkoutAssistantMessages,
  onUpdateWorkoutAssistantDrafts,
  groupWorkoutPrograms,
  onUpdateGroupWorkoutPrograms,
  activeUser
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'users' | 'programs' | 'records' | 'penalties' | 'payments' | 'announcements' | 'settings' | 'discounts'>('sessions');
  const [programSessionId, setProgramSessionId] = useState('');

  // Discount Codes form state
  const [newDiscountCode, setNewDiscountCode] = useState({
    code: '',
    discountPercent: 15,
    discountAmount: 0,
    type: 'PERCENT' as 'PERCENT' | 'AMOUNT',
    isSingleUse: true
  });

  const handleCreateDiscountCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscountCode.code.trim()) return;

    const codeStr = newDiscountCode.code.trim().toUpperCase();
    if (discountCodes.some(c => c.code === codeStr)) {
      alert('קוד הנחה זה כבר קיים במערכת');
      return;
    }

    const created: DiscountCode = {
      id: `disc-${Date.now()}`,
      code: codeStr,
      discountPercent: newDiscountCode.type === 'PERCENT' ? Number(newDiscountCode.discountPercent) || 0 : 0,
      discountAmount: newDiscountCode.type === 'AMOUNT' ? Number(newDiscountCode.discountAmount) || 0 : undefined,
      isSingleUse: newDiscountCode.isSingleUse,
      createdBy: activeUser.name || 'רובי באלי (מאמן ראשי)',
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (onUpdateDiscountCodes) {
      onUpdateDiscountCodes([created, ...discountCodes]);
    }
    setNewDiscountCode({
      code: '',
      discountPercent: 15,
      discountAmount: 0,
      type: 'PERCENT',
      isSingleUse: true
    });
  };

  const handleDeleteDiscountCode = (id: string) => {
    if (onUpdateDiscountCodes) {
      onUpdateDiscountCodes(discountCodes.filter(c => c.id !== id));
    }
  };

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', username: '', password: '', phone: '', email: '' });
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionViewMode, setSessionViewMode] = useState<'CALENDAR' | 'TABLE'>('CALENDAR');
  const [penaltySearch, setPenaltySearch] = useState('');
  const [newMembershipPlan, setNewMembershipPlan] = useState({ label: '', description: '', price: 0, category: 'PRIMARY' as MembershipPlanConfig['category'], priceUnit: 'MONTH' as MembershipPlanConfig['priceUnit'] });
  const membershipPlans = settings.membershipPlans?.length ? settings.membershipPlans : DEFAULT_MEMBERSHIP_PLAN_CONFIGS;

  const updateMembershipPlan = (id: string, patch: Partial<MembershipPlanConfig>) => {
    onUpdateSettings({ ...settings, membershipPlans: membershipPlans.map(plan => plan.id === id ? { ...plan, ...patch } : plan) });
  };

  const removeMembershipPlan = (id: string) => {
    if (!window.confirm('להסיר את המסלול מרשימת הרכישה? משתמשים שכבר רכשו אותו לא יימחקו.')) return;
    onUpdateSettings({ ...settings, membershipPlans: membershipPlans.filter(plan => plan.id !== id) });
  };

  const addMembershipPlan = () => {
    if (!newMembershipPlan.label.trim() || newMembershipPlan.price < 0) return;
    const created: MembershipPlanConfig = {
      id: `CUSTOM_${Date.now()}`,
      label: newMembershipPlan.label.trim(),
      description: newMembershipPlan.description.trim(),
      price: Number(newMembershipPlan.price),
      category: newMembershipPlan.category,
      priceUnit: newMembershipPlan.priceUnit,
      active: true
    };
    onUpdateSettings({ ...settings, membershipPlans: [...membershipPlans, created] });
    setNewMembershipPlan({ label: '', description: '', price: 0, category: 'PRIMARY', priceUnit: 'MONTH' });
  };

  const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<string | number | boolean | undefined>>) => {
    const escapeCell = (value: string | number | boolean | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const content = `\uFEFF${[headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const healthRecords = users.filter(user => user.role === UserRole.TRAINEE).flatMap(user => {
    const records = user.healthDeclarationHistory?.length ? user.healthDeclarationHistory : user.healthDeclarationDate ? [{
      id: `legacy-${user.id}`,
      signedAt: `${user.healthDeclarationDate}T00:00:00.000Z`,
      validUntil: (() => { const date = new Date(`${user.healthDeclarationDate}T00:00:00`); date.setFullYear(date.getFullYear() + 1); return date.toISOString().split('T')[0]; })(),
      signed: Boolean(user.healthDeclarationSigned),
      answers: user.healthDeclarationAnswers,
      requiresMedicalCertificate: user.healthDeclarationRequiresMedicalCertificate,
      medicalCertificateApproved: user.healthDeclarationMedicalCertificateApproved,
      parentConsent: user.healthDeclarationParentConsent,
      parentName: user.healthDeclarationParentName,
      parentIdNumber: user.healthDeclarationParentIdNumber,
      signatureName: user.healthDeclarationSignatureName,
      signatureUrl: user.healthDeclarationSignatureUrl,
      medicalCertificateFileName: user.healthDeclarationMedicalCertificateFileName,
      medicalCertificateDataUrl: user.healthDeclarationMedicalCertificateDataUrl
    }] : [];
    return records.map(record => ({ user, record }));
  }).sort((a, b) => b.record.signedAt.localeCompare(a.record.signedAt));

  const today = new Date().toISOString().split('T')[0];
  const traineesRequiringHealthDeclaration = users.filter(user => {
    if (user.role !== UserRole.TRAINEE) return false;
    const latest = healthRecords.find(item => item.user.id === user.id)?.record;
    return !latest?.signed || latest.validUntil < today || (latest.requiresMedicalCertificate && !latest.medicalCertificateApproved);
  }).length;

  const approveMedicalCertificate = (userId: string, recordId: string) => {
    onUpdateUsers(users.map(user => {
      if (user.id !== userId) return user;
      const updatedHistory = (user.healthDeclarationHistory || []).map(record => record.id === recordId
        ? { ...record, signed: true, medicalCertificateApproved: true }
        : record);
      const isLatest = updatedHistory[0]?.id === recordId || (!user.healthDeclarationHistory?.length && recordId === `legacy-${user.id}`);
      return {
        ...user,
        healthDeclarationHistory: updatedHistory.length ? updatedHistory : user.healthDeclarationHistory,
        ...(isLatest ? { healthDeclarationSigned: true, healthDeclarationMedicalCertificateApproved: true } : {})
      };
    }));
  };

  const handleAddCoach = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newCoach.name.trim();
    const username = newCoach.username.trim();
    const email = newCoach.email.trim().toLowerCase();
    const password = newCoach.password.trim();
    if (!name || !username || !email || password.length < 8) return;
    if (users.some(user => [user.username, user.email].filter(Boolean).some(value => value?.trim().toLowerCase() === username.toLowerCase() || value?.trim().toLowerCase() === email))) {
      window.alert('שם המשתמש או כתובת האימייל כבר קיימים במערכת.');
      return;
    }
    const coach: User = {
      id: `coach-${Date.now()}`,
      name,
      username,
      password,
      email,
      phone: newCoach.phone.trim(),
      role: UserRole.COACH,
      gender: Gender.ALL,
      age: 0,
      priorityScore: 100,
      pushNotificationsEnabled: true,
      workoutRemindersEnabled: true,
      imageUrl: `https://ui-avatars.com/api/?background=18181b&color=f4f4f5&name=${encodeURIComponent(name)}`
    };
    onUpdateUsers([coach, ...users]);
    setNewCoach({ name: '', username: '', password: '', phone: '', email: '' });
    setShowAddCoach(false);
  };

  // New CreateSessionModal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>();
  const [modalInitialTime, setModalInitialTime] = useState<string | undefined>();

  // Edit Session Modal state
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editingOpenGym, setEditingOpenGym] = useState<OpenGymSession | null>(null);

  const handleOpenCreateModal = (initialDate?: string, initialTime?: string) => {
    setModalInitialDate(initialDate);
    setModalInitialTime(initialTime);
    setIsCreateModalOpen(true);
  };

  const handleModalCreateSession = (data: CreateSessionData) => {
    const { newSessions, newOpenGym } = createSessionsFromData(data, users, activeUser);
    if (newSessions.length > 0) {
      let linkedSessions = newSessions;
      if (data.category === 'PERSONAL' && data.selectedProgramId && (data.targetTraineeId || data.isDemoSession)) {
        const source = workoutPlans.find(plan => plan.id === data.selectedProgramId && !plan.sessionId);
        if (source) {
          const assignedPlans = copyPersonalPlanToSessions(source, newSessions, data.targetTraineeId, activeUser);
          onUpdateWorkoutPlans([...assignedPlans, ...workoutPlans]);
          linkedSessions = linkedSessions.map(session => ({
            ...session,
            assignedWorkoutPlanId: assignedPlans.find(plan => plan.sessionId === session.id)?.id
          }));
        }
      }
      if (data.category === 'GROUP' && data.selectedProgramId) {
        const source = groupWorkoutPrograms.find(program => program.id === data.selectedProgramId && !program.sessionId);
        if (source) {
          const now = new Date().toISOString();
          const assignedPrograms = copyGroupProgramToSessions(source, newSessions, activeUser, users).map(program => ({
            ...program,
            status: 'PUBLISHED' as const,
            publishedAt: now
          }));
          onUpdateGroupWorkoutPrograms([...assignedPrograms, ...groupWorkoutPrograms]);
          linkedSessions = linkedSessions.map(session => ({
            ...session,
            assignedGroupWorkoutProgramId: assignedPrograms.find(program => program.sessionId === session.id)?.id
          }));
        }
      }
      onUpdateSessions([...linkedSessions, ...sessions]);
    }
    if (newOpenGym.length > 0) {
      onUpdateOpenGym([...newOpenGym, ...openGymSessions]);
    }
  };

  const handleDeleteSession = (id: string, deleteSeries?: boolean) => {
    let target = sessions.find(s => s.id === id);
    if (!target) {
      target = sessions.find(s => (s.seriesId && id.startsWith(s.seriesId)) || id.startsWith(s.id));
    }
    if (!target) return;

    if (deleteSeries) {
      const targetSeriesId = target.seriesId;
      if (targetSeriesId) {
        onUpdateSessions(sessions.filter(s => s.seriesId !== targetSeriesId && s.id !== target!.id));
      } else {
        onUpdateSessions(sessions.filter(s => s.id !== target!.id && !id.startsWith(s.id)));
      }
    } else {
      let dateKey = target.date;
      const dateMatch = id.match(/\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) dateKey = dateMatch[0];

      if (target.id === id && (!target.recurringType || target.recurringType === 'NONE')) {
        onUpdateSessions(sessions.filter(s => s.id !== id));
      } else {
        const updated = sessions.map(s => {
          if (s.id === target!.id || (target!.seriesId && s.seriesId === target!.seriesId)) {
            const currentExcluded = s.excludedDates || [];
            if (!currentExcluded.includes(dateKey)) {
              return { ...s, excludedDates: [...currentExcluded, dateKey] };
            }
          }
          return s;
        });
        onUpdateSessions(updated);
      }
    }
  };

  const handleDeleteOpenGym = (id: string, deleteSeries?: boolean) => {
    let target = openGymSessions.find(g => g.id === id);
    if (!target) {
      target = openGymSessions.find(g => (g.seriesId && id.startsWith(g.seriesId)) || id.startsWith(g.id));
    }
    if (!target) return;

    if (deleteSeries) {
      const targetSeriesId = target.seriesId;
      if (targetSeriesId) {
        onUpdateOpenGym(openGymSessions.filter(g => g.seriesId !== targetSeriesId && g.id !== target!.id));
      } else {
        onUpdateOpenGym(openGymSessions.filter(g => g.id !== target!.id && !id.startsWith(g.id)));
      }
    } else {
      let dateKey = target.date;
      const dateMatch = id.match(/\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) dateKey = dateMatch[0];

      if (target.id === id && (!target.recurringType || target.recurringType === 'NONE')) {
        onUpdateOpenGym(openGymSessions.filter(g => g.id !== id));
      } else {
        const updated = openGymSessions.map(g => {
          if (g.id === target!.id || (target!.seriesId && g.seriesId === target!.seriesId)) {
            const currentExcluded = g.excludedDates || [];
            if (!currentExcluded.includes(dateKey)) {
              return { ...g, excludedDates: [...currentExcluded, dateKey] };
            }
          }
          return g;
        });
        onUpdateOpenGym(updated);
      }
    }
  };

  const handleSaveEditSession = (updatedSession: TrainingSession, updateSeries: boolean, originalDateKey?: string) => {
    if (updateSeries) {
      const updated = sessions.map(s => {
        if ((updatedSession.seriesId && s.seriesId === updatedSession.seriesId) || s.id === updatedSession.id) {
          return {
            ...s,
            title: updatedSession.title,
            time: updatedSession.time,
            durationMinutes: updatedSession.durationMinutes,
            coachId: updatedSession.coachId,
            coachName: updatedSession.coachName,
            muscleGroup: updatedSession.muscleGroup,
            maxParticipants: updatedSession.maxParticipants,
            ageMin: updatedSession.ageMin,
            ageMax: updatedSession.ageMax,
            genderRestriction: updatedSession.genderRestriction,
            allowedMemberships: updatedSession.allowedMemberships,
            isPersonalTraining: updatedSession.isPersonalTraining
          };
        }
        return s;
      });
      onUpdateSessions(updated);
    } else {
      const isBaseMatch = sessions.some(s => s.id === updatedSession.id && (!s.recurringType || s.recurringType === 'NONE'));
      if (isBaseMatch) {
        onUpdateSessions(sessions.map(s => s.id === updatedSession.id ? updatedSession : s));
      } else {
        const targetDate = originalDateKey || updatedSession.date;
        const updatedSessions = sessions.map(s => {
          if ((updatedSession.seriesId && s.seriesId === updatedSession.seriesId) || updatedSession.id.startsWith(s.id)) {
            const currentExcluded = s.excludedDates || [];
            if (!currentExcluded.includes(targetDate)) {
              return { ...s, excludedDates: [...currentExcluded, targetDate] };
            }
          }
          return s;
        });
        const standaloneSession: TrainingSession = {
          ...updatedSession,
          id: `session-override-${Date.now()}`,
          date: updatedSession.date,
          recurringType: 'NONE',
          seriesId: undefined
        };
        onUpdateSessions([standaloneSession, ...updatedSessions]);
      }
    }
  };

  const handleSaveEditOpenGym = (updatedGym: OpenGymSession, updateSeries: boolean, originalDateKey?: string) => {
    if (updateSeries) {
      const updated = openGymSessions.map(g => {
        if ((updatedGym.seriesId && g.seriesId === updatedGym.seriesId) || g.id === updatedGym.id) {
          return {
            ...g,
            timeSlot: updatedGym.timeSlot,
            maxParticipants: updatedGym.maxParticipants
          };
        }
        return g;
      });
      onUpdateOpenGym(updated);
    } else {
      const isBaseMatch = openGymSessions.some(g => g.id === updatedGym.id && (!g.recurringType || g.recurringType === 'NONE'));
      if (isBaseMatch) {
        onUpdateOpenGym(openGymSessions.map(g => g.id === updatedGym.id ? updatedGym : g));
      } else {
        const targetDate = originalDateKey || updatedGym.date;
        const updatedGyms = openGymSessions.map(g => {
          if ((updatedGym.seriesId && g.seriesId === updatedGym.seriesId) || updatedGym.id.startsWith(g.id)) {
            const currentExcluded = g.excludedDates || [];
            if (!currentExcluded.includes(targetDate)) {
              return { ...g, excludedDates: [...currentExcluded, targetDate] };
            }
          }
          return g;
        });
        const standaloneGym: OpenGymSession = {
          ...updatedGym,
          id: `open-override-${Date.now()}`,
          date: updatedGym.date,
          recurringType: 'NONE',
          seriesId: undefined
        };
        onUpdateOpenGym([standaloneGym, ...updatedGyms]);
      }
    }
  };

  // Form states for creating a new training session
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTypeCategory, setSessionTypeCategory] = useState<'GROUP' | 'PERSONAL' | 'OPEN_GYM'>('GROUP');
  const [newSession, setNewSession] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    durationMinutes: 60,
    coachId: activeUser.id,
    muscleGroup: MuscleGroup.UPPER,
    maxParticipants: 10,
    ageMin: '',
    ageMax: '',
    genderRestriction: Gender.ALL,
    allowedMemberships: [] as MembershipType[]
  });

  // Form states for creating a new bulletin announcement
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [newAnn, setNewAnn] = useState({
    title: '',
    content: '',
    targetGender: Gender.ALL,
    targetAgeMin: '',
    targetAgeMax: '',
    targetMembershipTypes: [...CURRENT_MEMBERSHIP_CATALOG]
  });

  // Handle Session Creation
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();

    if (sessionTypeCategory !== 'OPEN_GYM' && newSession.allowedMemberships.length === 0) {
      alert('יש לבחור לפחות סוג מנוי אחד המורשה להירשם לאימון.');
      return;
    }

    if (sessionTypeCategory === 'OPEN_GYM') {
      const durationMinutes = Math.max(15, Number(newSession.durationMinutes) || 60);
      const timeSlotStr = `${newSession.time} - ${addMinutesToTime(newSession.time, durationMinutes)}`;
      const openGym: OpenGymSession = {
        id: `open-${Date.now()}`,
        date: newSession.date,
        timeSlot: timeSlotStr,
        maxParticipants: Number(newSession.maxParticipants) || 15,
        registeredUsers: [],
        waitlistUsers: []
      };
      onUpdateOpenGym([openGym, ...openGymSessions]);
    } else {
      const coach = users.find(u => u.id === newSession.coachId) || activeUser;
      
      const session: TrainingSession = {
        id: `session-${Date.now()}`,
        title: newSession.title || (sessionTypeCategory === 'PERSONAL' ? 'אימון אישי 1-על-1' : 'אימון כושר קבוצתי'),
        date: newSession.date,
        time: newSession.time,
        durationMinutes: Number(newSession.durationMinutes),
        coachId: coach.id,
        coachName: coach.name,
        muscleGroup: newSession.muscleGroup,
        maxParticipants: sessionTypeCategory === 'PERSONAL' ? (Number(newSession.maxParticipants) || 1) : Number(newSession.maxParticipants),
        ageMin: newSession.ageMin ? Number(newSession.ageMin) : undefined,
        ageMax: newSession.ageMax ? Number(newSession.ageMax) : undefined,
        genderRestriction: newSession.genderRestriction,
        allowedMemberships: newSession.allowedMemberships,
        isPersonalTraining: sessionTypeCategory === 'PERSONAL',
        registeredUsers: [],
        waitlistUsers: []
      };

      onUpdateSessions([session, ...sessions]);
    }

    setShowSessionForm(false);
    // Reset
    setNewSession({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '18:00',
      durationMinutes: 60,
      coachId: activeUser.id,
      muscleGroup: MuscleGroup.UPPER,
      maxParticipants: 10,
      ageMin: '',
      ageMax: '',
      genderRestriction: Gender.ALL,
      allowedMemberships: [] as MembershipType[]
    });
  };

  // Handle Announcement Creation
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    const announcement: Announcement = {
      id: `ann-${Date.now()}`,
      title: newAnn.title,
      content: newAnn.content,
      createdBy: activeUser.name,
      creatorRole: activeUser.role as UserRole.MANAGER | UserRole.COACH,
      date: new Date().toISOString().split('T')[0],
      targetGender: newAnn.targetGender,
      targetAgeMin: newAnn.targetAgeMin ? Number(newAnn.targetAgeMin) : undefined,
      targetAgeMax: newAnn.targetAgeMax ? Number(newAnn.targetAgeMax) : undefined,
      targetMembershipTypes: newAnn.targetMembershipTypes
    };

    onUpdateAnnouncements([announcement, ...announcements]);
    setShowAnnForm(false);
    // Reset
    setNewAnn({
      title: '',
      content: '',
      targetGender: Gender.ALL,
      targetAgeMin: '',
      targetAgeMax: '',
      targetMembershipTypes: [...CURRENT_MEMBERSHIP_CATALOG]
    });
  };

  // Handle Black Point manual deletion/override
  const handleClearBlackPoint = (pointId: string, reason: string = 'שחרור ידני על ידי המנהל') => {
    const updatedPoints = blackPoints.map(bp => {
      if (bp.id === pointId) {
        return {
          ...bp,
          status: 'CLEARED' as const,
          clearedBy: activeUser.name,
          clearReason: reason
        };
      }
      return bp;
    });
    onUpdateBlackPoints(updatedPoints);

    // Recalculate priority scores for trainees
    const clearedBp = blackPoints.find(bp => bp.id === pointId);
    if (clearedBp) {
      recalculateUserPriority(clearedBp.traineeId, updatedPoints);
    }
  };

  // Helper to recalculate trainee priority based on active black points
  const recalculateUserPriority = (traineeId: string, currentPoints: BlackPoint[]) => {
    const activeCount = currentPoints.filter(bp => bp.traineeId === traineeId && bp.status === 'ACTIVE').length;
    const priority = activeCount >= settings.maxBlackPointsBeforePriorityDrop ? 50 : 100;
    
    const updatedUsers = users.map(u => {
      if (u.id === traineeId) {
        return { ...u, priorityScore: priority };
      }
      return u;
    });
    onUpdateUsers(updatedUsers);
  };

  // Delete a black point completely
  const handleDeleteBlackPoint = (pointId: string) => {
    const bp = blackPoints.find(p => p.id === pointId);
    const updated = blackPoints.filter(bp => bp.id !== pointId);
    onUpdateBlackPoints(updated);
    if (bp) {
      recalculateUserPriority(bp.traineeId, updated);
    }
  };

  // Update Trainee Membership Status (billing / debit manual trigger for testing)
  const handleUpdateStatus = (traineeId: string, newStatus: MembershipStatus) => {
    const updatedUsers = users.map(u => {
      if (u.id === traineeId) {
        return { ...u, membershipStatus: newStatus };
      }
      return u;
    });
    onUpdateUsers(updatedUsers);
  };

  // Record an offline payment to clear a debt.
  const handlePayDebt = (trainee: User) => {
    const purchasedType = trainee.membershipType || MembershipType.GROUP_MONTHLY;
    const paymentAmount = MEMBERSHIP_PRICES[purchasedType];
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      traineeId: trainee.id,
      traineeName: trainee.name,
      amount: paymentAmount,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      status: 'PAID',
      membershipTypePurchased: purchasedType,
      paymentMethod: 'סליקה מדומה (כרטיס אשראי)',
      isMock: true
    };

    onUpdatePayments([newPayment, ...payments]);

    // Update status to ACTIVE
    const updatedUsers = users.map(u => {
      if (u.id === trainee.id) {
        const term = createMembershipTerm(purchasedType);
        return {
          ...u,
          membershipStatus: MembershipStatus.ACTIVE,
          ...(purchasedType === MembershipType.GROUP_ANNUAL && u.membershipCommitmentEndsAt
            ? { membershipExpiry: u.membershipCommitmentEndsAt }
            : term)
        };
      }
      return u;
    });
    onUpdateUsers(updatedUsers);
  };

  // Toggle membership selection in create forms
  const toggleMembershipSelection = (type: MembershipType, listName: 'session' | 'announcement') => {
    if (listName === 'session') {
      const current = [...newSession.allowedMemberships];
      if (current.includes(type)) {
        setNewSession({ ...newSession, allowedMemberships: current.filter(t => t !== type) });
      } else {
        setNewSession({ ...newSession, allowedMemberships: [...current, type] });
      }
    } else {
      const current = [...newAnn.targetMembershipTypes];
      if (current.includes(type)) {
        setNewAnn({ ...newAnn, targetMembershipTypes: current.filter(t => t !== type) });
      } else {
        setNewAnn({ ...newAnn, targetMembershipTypes: [...current, type] });
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden" id="admin-dashboard">
      {/* Admin Tab Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <Settings className="text-emerald-400" size={20} />
          <h1 className="text-lg font-extrabold text-white">פאנל ניהול המועדון (מנהל מערכת)</h1>
        </div>
        
        <div className="flex bg-slate-800/90 p-1.5 rounded-xl gap-1 flex-wrap border border-slate-700/80">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'sessions' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Calendar size={14} />
            אימונים ולו"ז
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'users' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Users size={14} />
            מתאמנים
          </button>
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'programs' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <BookOpen size={14} />
            תוכניות אישיות
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'records' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <ClipboardCheck size={14} />
            הצהרות וכניסות
          </button>
          <button
            onClick={() => setActiveTab('penalties')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer relative ${
              activeTab === 'penalties' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <AlertTriangle size={14} />
            עונשים ונקודות
            {blackPoints.filter(p => p.status === 'ACTIVE').length > 0 && (
              <span className="absolute -top-1 -left-1 bg-rose-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center font-bold">
                {blackPoints.filter(p => p.status === 'ACTIVE').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'payments' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <CreditCard size={14} />
            כספים וסליקה
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'announcements' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Bell size={14} />
            לוח מודעות
          </button>
          <button
            onClick={() => setActiveTab('discounts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'discounts' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Tag size={14} />
            קודי הנחה ומבצעים 🏷️
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings size={14} />
            חוקים והגדרות
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'programs' && (
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
            onUpdateWorkoutPlans={onUpdateWorkoutPlans}
            onUpdateNutritionPlans={onUpdateNutritionPlans}
            onUpdateBlackPoints={onUpdateBlackPoints}
            onUpdateSessions={onUpdateSessions}
            onUpdateOpenGym={onUpdateOpenGym}
            onUpdateAnnouncements={onUpdateAnnouncements}
            onUpdateUsers={onUpdateUsers}
            onSendMessage={onSendMessage}
            traineeProfiles={traineeProfiles}
            traineeMemoryEntries={traineeMemoryEntries}
            onUpdateTraineeProfiles={onUpdateTraineeProfiles}
            onUpdateTraineeMemoryEntries={onUpdateTraineeMemoryEntries}
            gymEquipment={gymEquipment}
            onUpdateGymEquipment={onUpdateGymEquipment}
            coachPdfDocuments={coachPdfDocuments}
            onUpdateCoachPdfDocuments={onUpdateCoachPdfDocuments}
            workoutAssistantMessages={workoutAssistantMessages}
            workoutAssistantDrafts={workoutAssistantDrafts}
            onUpdateWorkoutAssistantMessages={onUpdateWorkoutAssistantMessages}
            onUpdateWorkoutAssistantDrafts={onUpdateWorkoutAssistantDrafts}
            groupWorkoutPrograms={groupWorkoutPrograms}
            onUpdateGroupWorkoutPrograms={onUpdateGroupWorkoutPrograms}
            activeUser={activeUser}
            initialWorkoutSessionId={programSessionId}
            onInitialWorkoutSessionHandled={() => setProgramSessionId('')}
          />
        )}

        {activeTab === 'records' && (
          <div className="space-y-6" dir="rtl">
            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><HeartPulse size={22} className="text-emerald-700" /><strong className="mt-3 block text-2xl text-emerald-950">{healthRecords.length}</strong><span className="text-xs text-emerald-800">הצהרות בריאות מתועדות</span></article>
              <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><ClipboardCheck size={22} className="text-sky-700" /><strong className="mt-3 block text-2xl text-sky-950">{attendanceLogs.length}</strong><span className="text-xs text-sky-800">כניסות וצ׳ק־אין מתועדים</span></article>
              <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><AlertTriangle size={22} className="text-rose-700" /><strong className="mt-3 block text-2xl text-rose-950">{traineesRequiringHealthDeclaration}</strong><span className="text-xs text-rose-800">מתאמנים חסומים עד להסדרת הצהרה</span></article>
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">ארכיון הצהרות בריאות</h3><p className="mt-1 text-xs text-slate-500">כל חתימה נשמרת כרשומה נפרדת, כולל תוקף, תשובות ואישור רפואי.</p></div><button type="button" onClick={() => downloadCsv('baly-health-declarations.csv', ['מזהה', 'מתאמן', 'טלפון', 'תאריך חתימה', 'בתוקף עד', 'חתום', 'דורש אישור רפואי', 'אישור רפואי', 'שם חותם', 'שם הורה', 'ת.ז. הורה', 'קובץ רפואי', 'תשובות'], healthRecords.map(({ user, record }) => [record.id, user.name, user.phone, record.signedAt, record.validUntil, record.signed, record.requiresMedicalCertificate, record.medicalCertificateApproved, record.signatureName, record.parentName, record.parentIdNumber, record.medicalCertificateFileName, JSON.stringify(record.answers || {})]))} className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"><FileDown size={15} /> ייצוא הצהרות</button></div>
                <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[760px] text-right text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th className="p-3">מתאמן</th><th className="p-3">חתימה</th><th className="p-3">תוקף</th><th className="p-3">שאלון</th><th className="p-3">אישור רפואי</th><th className="p-3">סטטוס</th></tr></thead><tbody>{healthRecords.map(({ user, record }) => {
                    const yesAnswers = Object.values(record.answers || {}).filter(answer => answer === 'YES').length;
                    const valid = record.signed && record.validUntil >= today && (!record.requiresMedicalCertificate || record.medicalCertificateApproved);
                    return <tr key={`${user.id}-${record.id}`} className="border-t border-slate-100"><td className="p-3"><strong className="block text-slate-900">{user.name}</strong><span className="text-[10px] text-slate-500">{user.phone}</span>{record.parentName && <small className="block text-slate-400">הורה: {record.parentName} · {record.parentIdNumber || 'ללא ת.ז.'}</small>}</td><td className="p-3">{new Date(record.signedAt).toLocaleDateString('he-IL')}<small className="block text-slate-400">{record.signatureName || 'חתימה דיגיטלית'}</small></td><td className="p-3 font-mono">{record.validUntil}</td><td className="p-3">{Object.keys(record.answers || {}).length} תשובות · {yesAnswers} כן</td><td className="p-3">{record.requiresMedicalCertificate ? <div className="space-y-1">{record.medicalCertificateDataUrl ? <a href={record.medicalCertificateDataUrl} download={record.medicalCertificateFileName || 'medical-certificate'} className="block font-bold text-sky-700 underline">צפייה במסמך</a> : <span className="text-rose-700">טרם הועלה מסמך</span>}{record.medicalCertificateApproved ? <span className="text-emerald-700">אושר</span> : record.medicalCertificateDataUrl ? <button type="button" onClick={() => approveMedicalCertificate(user.id, record.id)} className="rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-black text-slate-950">אישור מנהל</button> : <span className="text-amber-700">ממתין</span>}</div> : 'לא נדרש'}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{valid ? 'תקף' : 'חסום'}</span></td></tr>;
                  })}{healthRecords.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">אין הצהרות מתועדות.</td></tr>}</tbody></table>
                </div>
              </div>
              <ClubCheckInBarcode />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">יומן כניסות למועדון</h3><p className="mt-1 text-xs text-slate-500">תיעוד מלא של צ׳ק־אין לאימונים ול־Open Gym.</p></div><button type="button" onClick={() => downloadCsv('baly-attendance-log.csv', ['מזהה', 'מתאמן', 'סוג כניסה', 'אימון', 'תאריך', 'שעה'], attendanceLogs.map(log => [log.id, log.traineeName, log.type, log.targetTitle, log.date, log.timestamp]))} className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"><FileDown size={15} /> ייצוא כניסות</button></div>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-100"><table className="w-full min-w-[680px] text-right text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th className="p-3">מתאמן</th><th className="p-3">סוג</th><th className="p-3">אימון/משבצת</th><th className="p-3">תאריך</th><th className="p-3">שעת כניסה</th></tr></thead><tbody>{attendanceLogs.map(log => <tr key={log.id} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-900">{log.traineeName}</td><td className="p-3">{log.type === 'SESSION' ? 'אימון' : 'Open Gym'}</td><td className="p-3">{log.targetTitle}</td><td className="p-3 font-mono">{log.date}</td><td className="p-3 font-mono">{log.timestamp}</td></tr>)}{attendanceLogs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">אין כניסות מתועדות.</td></tr>}</tbody></table></div>
            </section>
          </div>
        )}

        {/* TAB 1: SESSIONS MANAGEMENT */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {/* VIEW SWITCHER */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">תצוגת לו"ז אימונים:</span>
                <div className="flex bg-slate-200/80 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSessionViewMode('CALENDAR')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                      sessionViewMode === 'CALENDAR'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    📅 לוח שנה שבועי
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionViewMode('TABLE')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                      sessionViewMode === 'TABLE'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    📋 טבלת ניהול
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                {sessionViewMode === 'TABLE' && (
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute right-3 top-2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="חיפוש לפי כותרת/מאמן..."
                      value={sessionSearch}
                      onChange={(e) => setSessionSearch(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                )}

                <button
                  onClick={() => handleOpenCreateModal()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  אימון חדש
                </button>
              </div>
            </div>

            {/* WEEKLY CALENDAR VIEW FOR ADMIN */}
            {sessionViewMode === 'CALENDAR' && (
              <WeeklyCalendar
                role={UserRole.MANAGER}
                activeUser={activeUser}
                sessions={sessions}
                openGymSessions={openGymSessions}
                users={users}
                onDeleteSession={handleDeleteSession}
                onEditSession={(s) => setEditingSession(s)}
                onOpenWorkoutProgram={(session) => {
                  setProgramSessionId(session.id);
                  setActiveTab('programs');
                }}
                onDeleteOpenGym={handleDeleteOpenGym}
                onEditOpenGym={(g) => setEditingOpenGym(g)}
                onOpenCreateSessionModal={(d, t) => handleOpenCreateModal(d, t)}
              />
            )}

            {/* CREATE SESSION MODAL */}
            <CreateSessionModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              activeUser={activeUser}
              users={users}
              initialDate={modalInitialDate}
              initialTime={modalInitialTime}
              onCreateSession={handleModalCreateSession}
              workoutPlans={workoutPlans}
              groupWorkoutPrograms={groupWorkoutPrograms}
            />

            {/* EDIT SESSION MODAL */}
            <EditSessionModal
              isOpen={!!editingSession || !!editingOpenGym}
              onClose={() => {
                setEditingSession(null);
                setEditingOpenGym(null);
              }}
              session={editingSession}
              openGym={editingOpenGym}
              users={users}
              activeUser={activeUser}
              onSaveSession={handleSaveEditSession}
              onSaveOpenGym={handleSaveEditOpenGym}
            />

            {/* CREATE SESSION FORM */}
            {showSessionForm && (
              <form onSubmit={handleCreateSession} className="bg-slate-50 border border-slate-100 rounded-lg p-5 space-y-4" id="create-session-form">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-semibold text-slate-800">הגדרת פעילות חדשה ביומן האימונים</h3>
                  <button type="button" onClick={() => setShowSessionForm(false)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">ביטול</button>
                </div>

                {/* Session Type Category Tabs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">סוג הפעילות בלוח:</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'GROUP', label: '👥 אימון קבוצתי', desc: 'אימון רגיל רב-משתתפים' },
                      { id: 'PERSONAL', label: '🏋️ אימון אישי (PT)', desc: 'אימון אישי 1-על-1 (ניתן במקביל ל-Open Gym)' },
                      { id: 'OPEN_GYM', label: '🔓 Open Gym', desc: 'שעות פתוחות לאימון עצמאי' }
                    ].map(cat => (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => {
                          setSessionTypeCategory(cat.id as any);
                          if (cat.id === 'PERSONAL') {
                            setNewSession(s => ({ ...s, maxParticipants: 1, title: 'אימון אישי' }));
                          } else if (cat.id === 'OPEN_GYM') {
                            setNewSession(s => ({ ...s, maxParticipants: 15, title: 'Open Gym', durationMinutes: 60 }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex flex-col text-right cursor-pointer border ${
                          sessionTypeCategory === cat.id
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className={`text-[9px] font-normal ${sessionTypeCategory === cat.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {cat.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">שם האימון</label>
                    <input
                      type="text"
                      required
                      placeholder="לדוגמה: אימון אינטרוולים מחזורי / PT"
                      value={newSession.title}
                      onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">מאמן אחראי</label>
                    <select
                      value={newSession.coachId}
                      onChange={(e) => setNewSession({ ...newSession, coachId: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      {users.filter(u => u.role === UserRole.COACH || u.role === UserRole.MANAGER).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.role === UserRole.MANAGER ? 'מנהל ומאמן' : 'מאמן'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">אזור אימון / קבוצת שרירים</label>
                    <select
                      value={newSession.muscleGroup}
                      onChange={(e) => setNewSession({ ...newSession, muscleGroup: e.target.value as MuscleGroup })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value={MuscleGroup.UPPER}>פלג גוף עליון</option>
                      <option value={MuscleGroup.LEGS}>רגליים וישבן</option>
                      <option value={MuscleGroup.BACK}>גב</option>
                      <option value={MuscleGroup.SHOULDERS}>כתפיים</option>
                      <option value={MuscleGroup.CORE}>בטן וליבה (Core)</option>
                      <option value={MuscleGroup.FUNCTIONAL}>אימון פונקציונלי כללי</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">תאריך</label>
                    <input
                      type="date"
                      required
                      value={newSession.date}
                      onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">שעת התחלה</label>
                    <input
                      type="time"
                      required
                      min="06:00"
                      max="22:00"
                      step="900"
                      value={newSession.time}
                      onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">משך זמן (דקות)</label>
                    <input
                      type="number"
                      required
                      min="15"
                      max="180"
                      step="15"
                      value={newSession.durationMinutes}
                      onChange={(e) => setNewSession({ ...newSession, durationMinutes: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">מגבלת נרשמים מקסימלית</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newSession.maxParticipants}
                      onChange={(e) => setNewSession({ ...newSession, maxParticipants: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">הגבלת גיל מינימלי (אופציונלי)</label>
                    <input
                      type="number"
                      placeholder="ללא הגבלה"
                      value={newSession.ageMin}
                      onChange={(e) => setNewSession({ ...newSession, ageMin: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">מגבלת מגדר</label>
                    <select
                      value={newSession.genderRestriction}
                      onChange={(e) => setNewSession({ ...newSession, genderRestriction: e.target.value as Gender })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value={Gender.ALL}>כולם (מעורב)</option>
                      <option value={Gender.MALE}>גברים בלבד 🚹</option>
                      <option value={Gender.FEMALE}>נשים בלבד 🚺</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <span className="block text-xs text-slate-600 font-medium mb-2">סוגי מנוי מורשים להירשם לאימון זה:</span>
                  <p className="mb-2 text-[10px] text-slate-500">לא מסומן מסלול כברירת מחדל. „קבוצתי” כולל חודשי ושנתי.</p>
                  <SessionMembershipSelector value={newSession.allowedMemberships} onChange={allowedMemberships => setNewSession({ ...newSession, allowedMemberships })} />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-lg"
                  >
                    פרסם אימון ללוח השעות
                  </button>
                </div>
              </form>
            )}

            {/* SESSIONS LIST TABLE VIEW */}
            {sessionViewMode === 'TABLE' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="p-3">שם האימון</th>
                      <th className="p-3">מאמן</th>
                      <th className="p-3">מועד</th>
                      <th className="p-3">קבוצת שרירים</th>
                      <th className="p-3">מגבלות</th>
                      <th className="p-3">תפוסה / רשומים</th>
                      <th className="p-3">תור המתנה</th>
                      <th className="p-3 text-left">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions
                      .filter(s => s.title.toLowerCase().includes(sessionSearch.toLowerCase()) || s.coachName.toLowerCase().includes(sessionSearch.toLowerCase()))
                      .map(s => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50" id={`session-row-${s.id}`}>
                          <td className="p-3 font-semibold text-slate-800">{s.title}</td>
                          <td className="p-3 text-slate-600">{s.coachName}</td>
                          <td className="p-3 text-slate-600">
                            <div>{s.date}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{s.time} ({s.durationMinutes} דק')</div>
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 text-[10px]">
                              {s.muscleGroup === MuscleGroup.UPPER && 'פלג גוף עליון'}
                              {s.muscleGroup === MuscleGroup.LEGS && 'רגליים וישבן'}
                              {s.muscleGroup === MuscleGroup.BACK && 'גב'}
                              {s.muscleGroup === MuscleGroup.SHOULDERS && 'כתפיים'}
                              {s.muscleGroup === MuscleGroup.CORE && 'בטן וליבה'}
                              {s.muscleGroup === MuscleGroup.FUNCTIONAL && 'פונקציונלי'}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-slate-500 space-y-0.5">
                            {s.genderRestriction !== Gender.ALL && (
                              <div>מין: {s.genderRestriction === Gender.FEMALE ? 'נשים' : 'גברים'}</div>
                            )}
                            {s.ageMin && <div>גיל: {s.ageMin}+</div>}
                            <div>מנויים: {s.allowedMemberships.length === 5 ? 'הכל' : `${s.allowedMemberships.length} סוגים`}</div>
                          </td>
                          <td className="p-3">
                            <span className={`font-semibold ${s.registeredUsers.length >= s.maxParticipants ? 'text-red-500' : 'text-slate-700'}`}>
                              {s.registeredUsers.length} / {s.maxParticipants}
                            </span>
                            <div className="text-[10px] text-slate-400">רשומים בפועל</div>
                          </td>
                          <td className="p-3">
                            <span className={s.waitlistUsers.length > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                              {s.waitlistUsers.length} ממתינים
                            </span>
                          </td>
                          <td className="p-3 text-left">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => setEditingSession(s)}
                                className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded hover:bg-emerald-50 transition cursor-pointer"
                                title="ערוך אימון"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('האם אתה בטוח שברצונך למחוק אימון זה?')) {
                                    handleDeleteSession(s.id, false);
                                  }
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50 transition cursor-pointer"
                                title="מחק אימון מהלוח"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USERS LIST & BILLING */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="חיפוש מתאמן לפי שם, טלפון, סטטוס..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button type="button" onClick={() => setShowAddCoach(current => !current)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white"><UserPlus size={16} /> הוספת מאמן חדש</button>
            </div>

            {showAddCoach && (
              <form onSubmit={handleAddCoach} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="mb-3"><h3 className="text-sm font-black text-indigo-950">פרטי המאמן החדש</h3><p className="mt-1 text-[11px] text-indigo-700">המאמן יקבל יומן, אימונים, תוכניות אישיות וקבוצתיות והודעות בלבד. הגדרות המועדון, משתמשים ותשלומים יישארו למנהל.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <input required value={newCoach.name} onChange={event => setNewCoach(current => ({ ...current, name: event.target.value }))} placeholder="שם מלא" className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs" />
                  <input required value={newCoach.username} onChange={event => setNewCoach(current => ({ ...current, username: event.target.value }))} placeholder="שם משתמש" className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs" />
                  <input required minLength={8} type="password" value={newCoach.password} onChange={event => setNewCoach(current => ({ ...current, password: event.target.value }))} placeholder="סיסמה, לפחות 8 תווים" className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs" />
                  <input value={newCoach.phone} onChange={event => setNewCoach(current => ({ ...current, phone: event.target.value }))} placeholder="טלפון" className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs" />
                  <input required type="email" value={newCoach.email} onChange={event => setNewCoach(current => ({ ...current, email: event.target.value }))} placeholder="דוא״ל" autoComplete="email" className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs" />
                </div>
                <div className="mt-3 flex gap-2"><button type="submit" className="rounded-xl bg-indigo-700 px-5 py-2.5 text-xs font-black text-white">צור חשבון מאמן</button><button type="button" onClick={() => setShowAddCoach(false)} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600">ביטול</button></div>
              </form>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-black text-slate-900">צוות המאמנים</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {users.filter(user => user.role === UserRole.COACH).map(coach => <article key={coach.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><img src={coach.imageUrl} alt={coach.name} className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0"><strong className="block truncate text-xs text-slate-900">{coach.name}</strong><span className="text-[10px] text-slate-500">@{coach.username} · הרשאות מאמן</span></div></article>)}
                {users.every(user => user.role !== UserRole.COACH) && <p className="text-xs text-slate-500">עדיין לא נוספו מאמנים.</p>}
              </div>
            </section>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">פרטי מתאמן</th>
                    <th className="p-3">פרטים אישיים</th>
                    <th className="p-3">סוג מנוי</th>
                    <th className="p-3">סטטוס מנוי ותשלום</th>
                    <th className="p-3">עדיפות בתור</th>
                    <th className="p-3">תוקף מנוי</th>
                    <th className="p-3 text-left">שינוי סטטוס תשלום ופעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u => u.role === UserRole.TRAINEE)
                    .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.phone.includes(userSearch))
                    .map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 flex items-center gap-3">
                          <img
                            src={u.imageUrl}
                            alt={u.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-100"
                          />
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">
                          <div>טלפון: {u.phone}</div>
                          <div className="text-[10px]">גיל: {u.age} | מין: {u.gender === Gender.FEMALE ? 'נקבה' : 'זכר'}</div>
                        </td>
                        <td className="p-3 font-medium">
                          <div>
                            {u.membershipType && (
                              <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border block w-fit ${MEMBERSHIP_TYPE_LABELS[u.membershipType]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                                  {MEMBERSHIP_TYPE_LABELS[u.membershipType]?.label || u.membershipType}
                                </span>
                                {u.membershipType === MembershipType.PERSONAL_TRAINING && (
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    תעריף: <strong>₪{u.personalTrainingRate || 150}</strong> / אימון | החודש: {u.personalSessionsCountThisMonth || 0}
                                  </div>
                                )}
                                {u.membershipType === MembershipType.OPEN_PUNCH_CARD && (
                                  <div className="text-[10px] text-amber-800 font-mono font-bold mt-1">
                                    יתרה: {u.punchCardRemaining ?? 0} ניקובים
                                  </div>
                                )}
                              </div>
                            )}

                            {u.familyId && (
                              <div className="mt-1">
                                <span className="bg-purple-100 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded block w-fit border border-purple-300">
                                  👨‍👩‍👧‍👦 מנוי משפחתי ({u.familyName || 'משפחה'})
                                </span>
                                <div className="text-[10px] text-purple-800 font-semibold mt-0.5">
                                  {u.isFamilyPayer ? '👑 ראש משפחה (משלם)' : `👤 בן משפחה (משלם: ${users.find(payer => payer.id === u.familyPayerId)?.name || 'ראש משפחה'})`}
                                </div>
                              </div>
                            )}

                            {/* Secondary Memberships Badge Display */}
                            {u.secondaryMemberships && u.secondaryMemberships.length > 0 && (
                              <div className="mt-1.5 pt-1 border-t border-slate-100">
                                <div className="text-[9px] text-slate-400 font-bold">מנויים משולבים נוספים:</div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {u.secondaryMemberships.map((sec, idx) => (
                                    <span key={idx} className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${MEMBERSHIP_TYPE_LABELS[sec]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                                      {MEMBERSHIP_TYPE_LABELS[sec]?.label || sec}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold block w-fit ${
                              u.membershipStatus === MembershipStatus.ACTIVE
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.membershipStatus === MembershipStatus.DEBT
                                ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {u.membershipStatus === MembershipStatus.ACTIVE && 'פעיל / שולם'}
                              {u.membershipStatus === MembershipStatus.DEBT && 'חוב כספי ❌'}
                              {u.membershipStatus === MembershipStatus.EXPIRED && 'פג תוקף ❌'}
                            </span>

                            {u.offlinePaymentApproved && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded block w-fit">
                                🛡️ אישור חריג מנהל (מזומן/ידני)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`font-mono font-bold ${u.priorityScore < 100 ? 'text-rose-500' : 'text-slate-700'}`}>
                            {u.priorityScore} / 100
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{u.membershipExpiry}</td>
                        <td className="p-3 text-left">
                          <div className="flex flex-col gap-1 items-end">
                            {u.membershipStatus === MembershipStatus.DEBT && (
                              <button
                                onClick={() => handlePayDebt(u)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold py-1 px-2.5 rounded transition shadow-sm w-full text-center"
                              >
                                רישום תשלום ידני וסגירת חוב
                              </button>
                            )}

                            {/* Manager Offline Exception Authorization */}
                            <button
                              onClick={() => {
                                const isApproved = !u.offlinePaymentApproved;
                                const updated = users.map(user => {
                                  if (user.id === u.id) {
                                    return {
                                      ...user,
                                      offlinePaymentApproved: isApproved,
                                      membershipStatus: isApproved ? MembershipStatus.ACTIVE : user.membershipStatus,
                                      offlinePaymentNote: isApproved ? 'אושר ידנית במזומן/העברה ע"י המנהל' : undefined
                                    };
                                  }
                                  return user;
                                });
                                onUpdateUsers(updated);
                              }}
                              className={`text-[9px] font-semibold py-1 px-2 rounded border transition w-full text-center ${
                                u.offlinePaymentApproved
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                              }`}
                            >
                              {u.offlinePaymentApproved ? 'בטל אישור חריג' : 'אישור חריג (מזומן)'}
                            </button>

                              {/* Reset Personal Training Count for 1st of month settlement */}
                              {u.membershipType === MembershipType.PERSONAL_TRAINING && (
                                <button
                                  onClick={() => {
                                    const updated = users.map(user => {
                                      if (user.id === u.id) {
                                        return { ...user, personalSessionsCountThisMonth: 0 };
                                      }
                                      return user;
                                    });
                                    onUpdateUsers(updated);
                                  }}
                                  className="text-[9px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-medium py-0.5 px-2 rounded w-full text-center"
                                  title="סגירת חודש ב-1 לחודש"
                                >
                                  🗓️ סגירת חודש (איפוס ספירה)
                                </button>
                              )}

                              {/* Manager Punch Card Reload Action */}
                              <button
                                onClick={() => {
                                  const newPunchesStr = prompt(`הכנס מספר ניקובים לכרטיסייה עבור ${u.name}:`, String(u.punchCardRemaining || 10));
                                  if (newPunchesStr !== null) {
                                    const count = parseInt(newPunchesStr, 10);
                                    if (!isNaN(count) && count >= 0) {
                                      const updated = users.map(user => {
                                        if (user.id === u.id) {
                                          return {
                                            ...user,
                                            membershipType: MembershipType.OPEN_PUNCH_CARD,
                                            membershipStatus: MembershipStatus.ACTIVE,
                                            punchCardRemaining: count
                                          };
                                        }
                                        return user;
                                      });
                                      onUpdateUsers(updated);
                                      alert(`עודכנה כרטיסייה עבור ${u.name}: ${count} ניקובים 🎟️`);
                                    }
                                  }
                                }}
                                className="text-[9px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 font-semibold py-0.5 px-2 rounded w-full text-center"
                                title="הגדר/הטען ניקובים בכרטיסייה"
                              >
                                🎟️ טעינת כרטיסייה ({u.punchCardRemaining ?? 0})
                              </button>

                              {/* Manager Family Link Action */}
                              <button
                                onClick={() => {
                                  const famName = prompt(`הכנס שם משפחה עבור ${u.name} (למשל: משפחת לוי):`, u.familyName || 'משפחת לוי');
                                  if (famName !== null) {
                                    const isPayer = confirm(`האם ${u.name} הוא ראש המשפחה המשלם? (אישור = משלם, ביטול = בן משפחה)`);
                                    const updated = users.map(user => {
                                      if (user.id === u.id) {
                                        return {
                                          ...user,
                                          membershipType: MembershipType.GROUP_MONTHLY,
                                          familyId: `family-${famName.trim().toLowerCase()}`,
                                          familyName: famName.trim(),
                                          isFamilyPayer: isPayer,
                                          secondaryMemberships: user.secondaryMemberships?.length ? user.secondaryMemberships : [MembershipType.OPEN_MONTHLY]
                                        };
                                      }
                                      return user;
                                    });
                                    onUpdateUsers(updated);
                                    alert(`עודכן מנוי משפחתי עבור ${u.name} (${famName}) 👨‍👩‍👧‍👦`);
                                  }
                                }}
                                className="text-[9px] text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-300 font-semibold py-0.5 px-2 rounded w-full text-center"
                                title="הגדר/הצמד למנוי משפחתי"
                              >
                                👨‍👩‍👧‍👦 הגדר מנוי משפחתי
                              </button>

                              {/* Manager Multi-Membership Toggle Action */}
                              <button
                                onClick={() => {
                                  const choice = prompt(
                                    `בחר מנוי משני להוספה/הסרה עבור ${u.name}:\n1 = אימון אישי (PERSONAL_TRAINING)\n2 = תוכנית תזונה (NUTRITION_PLAN)\n3 = תוכנית אימון (WORKOUT_PLAN)\n4 = פתוח כרטיסייה (OPEN_PUNCH_CARD)\n5 = קבוצתי חודשי (GROUP_MONTHLY)\n6 = פתוח חודשי (OPEN_MONTHLY)`,
                                    '1'
                                  );
                                  let addedType: MembershipType | null = null;
                                  if (choice === '1') addedType = MembershipType.PERSONAL_TRAINING;
                                  if (choice === '2') addedType = MembershipType.NUTRITION_PLAN;
                                  if (choice === '3') addedType = MembershipType.WORKOUT_PLAN;
                                  if (choice === '4') addedType = MembershipType.OPEN_PUNCH_CARD;
                                  if (choice === '5') addedType = MembershipType.GROUP_MONTHLY;
                                  if (choice === '6') addedType = MembershipType.OPEN_MONTHLY;

                                  if (addedType) {
                                    const currentSec = u.secondaryMemberships || [];
                                    const exists = currentSec.includes(addedType);
                                    const nextSec = exists 
                                      ? currentSec.filter(t => t !== addedType)
                                      : [...currentSec, addedType];

                                    const updated = users.map(user => {
                                      if (user.id === u.id) {
                                        return {
                                          ...user,
                                          secondaryMemberships: nextSec,
                                          punchCardRemaining: addedType === MembershipType.OPEN_PUNCH_CARD && !exists ? 10 : user.punchCardRemaining
                                        };
                                      }
                                      return user;
                                    });
                                    onUpdateUsers(updated);
                                    alert(`עודכן מנוי משולב עבור ${u.name}! 🌟`);
                                  }
                                }}
                                 className="text-[9px] text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 font-semibold py-0.5 px-2 rounded w-full text-center"
                                title="הוסף או הסר מנוי משני משולב"
                              >
                                ➕ מנוי משולב נוסף
                            </button>

                            {/* Primary Membership Selector */}
                            <select
                              value={u.membershipType}
                              onChange={(e) => {
                                const newType = e.target.value as MembershipType;
                                const updated = users.map(user => user.id === u.id ? { ...user, membershipType: newType } : user);
                                onUpdateUsers(updated);
                              }}
                              className="border border-slate-200 rounded p-1 text-[10px] focus:outline-none bg-emerald-50 text-emerald-900 font-bold w-full"
                              title="שינוי סוג מנוי ראשי"
                            >
                              {CURRENT_MEMBERSHIP_CATALOG.map(typeKey => (
                                <option key={typeKey} value={typeKey}>
                                  {MEMBERSHIP_TYPE_LABELS[typeKey].label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={u.membershipStatus}
                              onChange={(e) => handleUpdateStatus(u.id, e.target.value as MembershipStatus)}
                              className="border border-slate-200 rounded p-1 text-[10px] focus:outline-none bg-white w-full"
                            >
                              <option value={MembershipStatus.ACTIVE}>סמן כפעיל</option>
                              <option value={MembershipStatus.DEBT}>סמן בחוב כספי</option>
                              <option value={MembershipStatus.EXPIRED}>סמן כפג תוקף</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BLACK POINTS / PENALTY ENGINE */}
        {activeTab === 'penalties' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="text-amber-500 animate-bounce" size={16} />
                  מערכת העונשים – נקודות שחורות
                </h3>
                <p className="text-xs text-slate-500">
                  צבירת <strong className="text-slate-800 font-semibold">{settings.maxBlackPointsBeforePriorityDrop}</strong> נקודות שחורות פעילות גוררת ירידה אוטומטית בעדיפות ההרשמה (עדיפות 50/100).
                  כל נקודה מתאפסת אוטומטית כעבור חודש.
                </p>
              </div>
              <div className="flex bg-white border border-slate-200 rounded-lg p-2 items-center gap-2">
                <span className="text-xs text-slate-600">רף עונש פעיל:</span>
                <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2 py-0.5 rounded">
                  {settings.maxBlackPointsBeforePriorityDrop} נקודות
                </span>
              </div>
            </div>

            <div className="relative max-w-md">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="חיפוש נקודות שחורות לפי שם מתאמן..."
                value={penaltySearch}
                onChange={(e) => setPenaltySearch(e.target.value)}
                className="w-full pr-9 pl-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">שם המתאמן</th>
                    <th className="p-3">אימון רלוונטי</th>
                    <th className="p-3">תאריך האימון</th>
                    <th className="p-3">תאריך הטלה</th>
                    <th className="p-3">תאריך תפוגה אוטומטי</th>
                    <th className="p-3">סיבת העבירה</th>
                    <th className="p-3">סטטוס</th>
                    <th className="p-3 text-left">פעולות שחרור ועריכה</th>
                  </tr>
                </thead>
                <tbody>
                  {blackPoints
                    .filter(bp => bp.traineeName.toLowerCase().includes(penaltySearch.toLowerCase()))
                    .map(bp => (
                      <tr key={bp.id} className="border-b border-slate-100 hover:bg-slate-50" id={`blackpoint-row-${bp.id}`}>
                        <td className="p-3 font-semibold text-slate-800">{bp.traineeName}</td>
                        <td className="p-3 text-slate-600">{bp.sessionTitle}</td>
                        <td className="p-3 text-slate-500 font-mono">{bp.sessionDate}</td>
                        <td className="p-3 text-slate-500 font-mono">{bp.issuedDate}</td>
                        <td className="p-3 text-slate-400 font-mono">{bp.expiryDate}</td>
                        <td className="p-3 text-slate-600">
                          <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded border border-amber-200 text-[11px] block max-w-xs">
                            {bp.reason}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bp.status === 'ACTIVE'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : bp.status === 'CLEARED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {bp.status === 'ACTIVE' && 'פעילה 🚨'}
                            {bp.status === 'CLEARED' && 'בוטלה ידנית ✅'}
                            {bp.status === 'EXPIRED' && 'פג תוקפה'}
                          </span>
                          {bp.status === 'CLEARED' && bp.clearedBy && (
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              שוחרר ע"י {bp.clearedBy}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-left">
                          <div className="flex justify-end gap-1">
                            {bp.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleClearBlackPoint(bp.id, 'בדיקה ידנית של המנהל - פטור מוצדק')}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-medium py-1 px-2 rounded transition"
                              >
                                שחרר ידנית/בטל נקודה
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBlackPoint(bp.id)}
                              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition"
                              title="מחק לצמיתות"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PAYMENTS LEDGER */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-700">סה"כ הכנסות שנסלקו (DUMMY)</div>
                  <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                    ₪{payments.reduce((acc, curr) => acc + curr.amount, 0)}
                  </div>
                </div>
                <div className="bg-emerald-500/20 text-emerald-800 rounded-full p-2.5">
                  <DollarSign size={24} />
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-rose-700">מתאמנים במצב חוב פעיל</div>
                  <div className="text-2xl font-bold font-mono text-rose-950 mt-1">
                    {users.filter(u => u.membershipStatus === MembershipStatus.DEBT).length}
                  </div>
                </div>
                <div className="bg-rose-500/20 text-rose-800 rounded-full p-2.5">
                  <AlertTriangle size={24} />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-700">סה"כ עסקאות סליקה מדומה</div>
                  <div className="text-2xl font-bold font-mono text-slate-950 mt-1">
                    {payments.length}
                  </div>
                </div>
                <div className="bg-slate-500/20 text-slate-800 rounded-full p-2.5">
                  <CreditCard size={24} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">יומן עסקאות ותשלומים</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="p-3">מזהה עסקה</th>
                      <th className="p-3">שם המתאמן</th>
                      <th className="p-3">סכום</th>
                      <th className="p-3">עבור מנוי</th>
                      <th className="p-3">תאריך רכישה</th>
                      <th className="p-3">אמצעי תשלום</th>
                      <th className="p-3">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-slate-400 font-mono text-[10px]">{p.id}</td>
                        <td className="p-3 font-semibold text-slate-800">{p.traineeName}</td>
                        <td className="p-3 font-bold font-mono text-emerald-600">₪{p.amount}</td>
                        <td className="p-3 text-slate-600">
                          {MEMBERSHIP_TYPE_LABELS[p.membershipTypePurchased]?.label || p.membershipTypePurchased}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{p.date}</td>
                        <td className="p-3 text-slate-500">{p.paymentMethod}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px]">
                            הושלם ידנית
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BULLETIN BOARD & ANNOUNCEMENT PUBLISHER */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-800">לוח מודעות ממוקד - פרסום והודעות</h3>
              <button
                onClick={() => setShowAnnForm(!showAnnForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1 transition"
              >
                <Plus size={14} />
                מודעה ממוקדת חדשה
              </button>
            </div>

            {showAnnForm && (
              <form onSubmit={handleCreateAnnouncement} className="bg-slate-50 border border-slate-100 rounded-lg p-5 space-y-4" id="create-announcement-form">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-semibold text-slate-800">יצירת מודעה חדשה וקביעת קהלי יעד</h4>
                  <button type="button" onClick={() => setShowAnnForm(false)} className="text-slate-400 hover:text-slate-600 text-xs">ביטול</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">כותרת המודעה</label>
                    <input
                      type="text"
                      required
                      placeholder="לדוגמה: 📢 מבצעים לחברים ותחרות סקווטים שבועית"
                      value={newAnn.title}
                      onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">פילוח לפי מגדר</label>
                    <select
                      value={newAnn.targetGender}
                      onChange={(e) => setNewAnn({ ...newAnn, targetGender: e.target.value as Gender })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value={Gender.ALL}>כל המתאמנים (ללא הבדל מגדר)</option>
                      <option value={Gender.MALE}>גברים בלבד 🚹</option>
                      <option value={Gender.FEMALE}>נשים בלבד 🚺</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs text-slate-600 font-medium mb-1">תוכן המודעה</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="כתוב כאן את הודעת המועדון..."
                      value={newAnn.content}
                      onChange={(e) => setNewAnn({ ...newAnn, content: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">גיל מינימלי לקהל היעד (אופציונלי)</label>
                    <input
                      type="number"
                      placeholder="לדוגמה: 18"
                      value={newAnn.targetAgeMin}
                      onChange={(e) => setNewAnn({ ...newAnn, targetAgeMin: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-medium mb-1">גיל מקסימלי לקהל היעד (אופציונלי)</label>
                    <input
                      type="number"
                      placeholder="לדוגמה: 40"
                      value={newAnn.targetAgeMax}
                      onChange={(e) => setNewAnn({ ...newAnn, targetAgeMax: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <span className="block text-xs text-slate-600 font-medium mb-2">סינון לפי סוגי מנוי המורשים לצפות בהודעה:</span>
                  <div className="flex flex-wrap gap-2">
                    {CURRENT_MEMBERSHIP_CATALOG.map(typeEnum => {
                      const info = MEMBERSHIP_TYPE_LABELS[typeEnum];
                      const isSelected = newAnn.targetMembershipTypes.includes(typeEnum);
                      return (
                        <button
                          type="button"
                          key={typeEnum}
                          onClick={() => toggleMembershipSelection(typeEnum, 'announcement')}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-medium border transition ${
                            isSelected
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-lg"
                  >
                    פרסם מודעה
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {announcements.map(ann => (
                <div key={ann.id} className="border border-slate-150 rounded-xl p-4 bg-white relative hover:shadow-sm transition" id={`ann-item-${ann.id}`}>
                  <button
                    onClick={() => {
                      onUpdateAnnouncements(announcements.filter(item => item.id !== ann.id));
                    }}
                    className="absolute left-4 top-4 text-slate-400 hover:text-rose-500 transition"
                    title="מחק מודעה"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                      פורסם ע"י {ann.createdBy} ({ann.creatorRole === UserRole.MANAGER ? 'מנהל' : 'מאמן'})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{ann.date}</span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm">{ann.title}</h4>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{ann.content}</p>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">פילוח קהל:</span>
                    <span className="bg-emerald-50 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded border border-emerald-100 font-medium">
                      מגדר: {ann.targetGender === Gender.ALL ? 'כולם' : ann.targetGender === Gender.FEMALE ? 'נשים' : 'גברים'}
                    </span>
                    {ann.targetAgeMin && (
                      <span className="bg-emerald-50 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded border border-emerald-100 font-medium">
                        גיל: {ann.targetAgeMin}+
                      </span>
                    )}
                    {ann.targetAgeMax && (
                      <span className="bg-emerald-50 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded border border-emerald-100 font-medium">
                        עד גיל {ann.targetAgeMax}
                      </span>
                    )}
                    <span className="bg-slate-50 text-slate-600 text-[8px] px-1.5 py-0.5 rounded border border-slate-150 font-medium">
                      מנויים: {ann.targetMembershipTypes?.length === 5 ? 'הכל' : `${ann.targetMembershipTypes?.length} סוגים`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: GLOBAL PARAMETERS & RULES */}
        {activeTab === 'settings' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('ההגדרות נשמרו בהצלחה.');
            }}
            className="space-y-6"
            id="settings-form"
          >
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">קביעת חוקי ופרמטרי מועדון הכושר</h3>

            <LandingImageManager />

            <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="font-black text-slate-900">מסלולים ומחירים</h4><p className="mt-1 text-[11px] text-slate-600">השינויים נשמרים ומופיעים מיד בהרשמה ובדף רכישת מסלול. הסרת מסלול אינה משנה מנויים קיימים.</p></div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black text-white">{membershipPlans.length} מסלולים</span>
              </div>
              <div className="space-y-3">
                {membershipPlans.map(plan => <article key={plan.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[150px_minmax(220px,1fr)_110px_105px_auto] md:items-end">
                  <label className="text-[10px] font-bold text-slate-600">שם המסלול<input value={plan.label} onChange={event => updateMembershipPlan(plan.id, { label: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-900" /></label>
                  <label className="text-[10px] font-bold text-slate-600">תיאור<input value={plan.description} onChange={event => updateMembershipPlan(plan.id, { description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-900" /></label>
                  <label className="text-[10px] font-bold text-slate-600">מחיר ₪<input type="number" min={0} value={plan.price} onChange={event => updateMembershipPlan(plan.id, { price: Math.max(0, Number(event.target.value)) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-900" /></label>
                  <label className="text-[10px] font-bold text-slate-600">יחידת חיוב<select value={plan.priceUnit || 'ONE_TIME'} onChange={event => updateMembershipPlan(plan.id, { priceUnit: event.target.value as MembershipPlanConfig['priceUnit'] })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="MONTH">לחודש</option><option value="SESSION">לאימון</option><option value="ONE_TIME">חד־פעמי</option></select></label>
                  <div className="flex gap-1"><button type="button" onClick={() => updateMembershipPlan(plan.id, { active: !plan.active })} className={`min-h-9 rounded-lg px-2 text-[10px] font-black ${plan.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{plan.active ? 'פעיל' : 'מוסתר'}</button><button type="button" onClick={() => removeMembershipPlan(plan.id)} className="grid min-h-9 w-9 place-items-center rounded-lg bg-rose-100 text-rose-700" aria-label={`הסרת ${plan.label}`}><Trash2 size={14} /></button></div>
                </article>)}
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-white p-3">
                <strong className="text-xs text-slate-900">הוספת מסלול חדש</strong>
                <div className="mt-2 grid gap-2 md:grid-cols-[150px_minmax(220px,1fr)_100px_110px_110px_auto] md:items-end">
                  <label className="text-[10px] font-bold text-slate-600">שם<input value={newMembershipPlan.label} onChange={event => setNewMembershipPlan(current => ({ ...current, label: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" /></label>
                  <label className="text-[10px] font-bold text-slate-600">תיאור<input value={newMembershipPlan.description} onChange={event => setNewMembershipPlan(current => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" /></label>
                  <label className="text-[10px] font-bold text-slate-600">מחיר ₪<input type="number" min={0} value={newMembershipPlan.price} onChange={event => setNewMembershipPlan(current => ({ ...current, price: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" /></label>
                  <label className="text-[10px] font-bold text-slate-600">סוג<select value={newMembershipPlan.category} onChange={event => setNewMembershipPlan(current => ({ ...current, category: event.target.value as MembershipPlanConfig['category'] }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="PRIMARY">מסלול ראשי</option><option value="ADD_ON">תוספת</option></select></label>
                  <label className="text-[10px] font-bold text-slate-600">חיוב<select value={newMembershipPlan.priceUnit} onChange={event => setNewMembershipPlan(current => ({ ...current, priceUnit: event.target.value as MembershipPlanConfig['priceUnit'] }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="MONTH">לחודש</option><option value="SESSION">לאימון</option><option value="ONE_TIME">חד־פעמי</option></select></label>
                  <button type="button" onClick={addMembershipPlan} className="min-h-9 rounded-lg bg-amber-500 px-3 text-xs font-black text-slate-950"><Plus size={14} className="inline" /> הוסף</button>
                </div>
              </div>
            </section>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">חלון ביטול אימון ללא עונש (בשעות לפני האימון)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={settings.cancellationWindowHours}
                    onChange={(e) => onUpdateSettings({ ...settings, cancellationWindowHours: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg p-2.5 text-xs w-24 text-center focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="text-xs text-slate-500">שעות</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  ביטול במסגרת טווח שעות זה לא יגרור נקודה שחורה. ביטול לאחר מכן ייחשב כ"ביטול מאוחר".
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">כמות נקודות שחורות מקסימלית להורדת עדיפות רישום</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.maxBlackPointsBeforePriorityDrop}
                    onChange={(e) => onUpdateSettings({ ...settings, maxBlackPointsBeforePriorityDrop: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg p-2.5 text-xs w-24 text-center focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="text-xs text-slate-500">נקודות</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  מתאמן שיצבור מספר נקודות פעיל זה ירד אוטומטית בעדיפות ההרשמה שלו מול מתאמנים אחרים.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">פרק זמן למחיקה/איפוס אוטומטי של נקודות שחורות</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={settings.blackPointExpiryMonths}
                    onChange={(e) => onUpdateSettings({ ...settings, blackPointExpiryMonths: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg p-2.5 text-xs w-24 text-center focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="text-xs text-slate-500">חודשים</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  תאריך התפוגה שיוצמד לנקודה חדשה בעת הטלתה.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">מכסת תפוסה מקסימלית בשעות Open Gym כברירת מחדל</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={settings.openGymMaxParticipants}
                    onChange={(e) => onUpdateSettings({ ...settings, openGymMaxParticipants: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg p-2.5 text-xs w-24 text-center focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="text-xs text-slate-500">מתאמנים</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  הגבלת כמות המתאמנים בו-זמנית בשעות האימון החופשי ללא מאמן.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-6 rounded-lg shadow-sm"
              >
                עדכן פרמטרים במערכת
              </button>
            </div>
          </form>
        )}

        {/* TAB 7: DISCOUNT CODES MANAGEMENT */}
        {activeTab === 'discounts' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-900/10 via-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                  <Tag size={20} className="text-amber-600" />
                  ניהול קודי הנחה ומבצעים (מנהל / מאמן ראשי)
                </h3>
                <p className="text-xs text-amber-800 mt-1">
                  ייצר קודי הנחה חד-פעמיים או רב-פעמיים למתאמנים ולמנויים משפחתיים. הקוד מוזן בשלב התשלום או בעדכון המנוי.
                </p>
              </div>
            </div>

            {/* Create Code Form */}
            <form onSubmit={handleCreateDiscountCode} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus size={16} className="text-amber-600" />
                יצירת קוד הנחה חדש
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">קוד ההנחה (למשל: RUBI20)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      required
                      placeholder="SPECIAL20"
                      value={newDiscountCode.code}
                      onChange={(e) => setNewDiscountCode({ ...newDiscountCode, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded-xl font-mono uppercase bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setNewDiscountCode({ ...newDiscountCode, code: `RUBI${Math.floor(10 + Math.random() * 90)}` })}
                      className="px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-[10px] shrink-0"
                      title="הגרל קוד אקראי"
                    >
                      הגרל
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">סוג ההנחה</label>
                  <select
                    value={newDiscountCode.type}
                    onChange={(e) => setNewDiscountCode({ ...newDiscountCode, type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="PERCENT">אחוזים (%)</option>
                    <option value="AMOUNT">סכום קצוב ב-₪</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {newDiscountCode.type === 'PERCENT' ? 'שיעור ההנחה (%)' : 'סכום ההנחה (₪)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newDiscountCode.type === 'PERCENT' ? newDiscountCode.discountPercent : newDiscountCode.discountAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (newDiscountCode.type === 'PERCENT') {
                        setNewDiscountCode({ ...newDiscountCode, discountPercent: val });
                      } else {
                        setNewDiscountCode({ ...newDiscountCode, discountAmount: val });
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-xl font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={newDiscountCode.isSingleUse}
                      onChange={(e) => setNewDiscountCode({ ...newDiscountCode, isSingleUse: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="font-bold text-slate-800 text-xs">קוד חד-פעמי</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  <Plus size={16} />
                  צור והפעל קוד הנחה
                </button>
              </div>
            </form>

            {/* List of active discount codes */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-100/70 border-b font-bold text-slate-800 text-xs flex justify-between items-center">
                <span>רשימת קודי ההנחה הפעילים במערכת ({discountCodes.length})</span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {discountCodes.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    לא קיימים קודי הנחה פעילים. צור קוד ראשון בטופס למעלה.
                  </div>
                ) : (
                  discountCodes.map((code) => (
                    <div key={code.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-100 text-amber-900 font-mono font-bold px-3 py-1.5 rounded-xl border border-amber-300 text-sm flex items-center gap-1.5">
                          <Tag size={14} className="text-amber-700" />
                          {code.code}
                        </div>

                        <div>
                          <div className="font-bold text-slate-900">
                            {code.discountPercent > 0 ? `${code.discountPercent}% הנחה` : `₪${code.discountAmount} הנחה קצובה`}
                            {code.isSingleUse && (
                              <span className="mr-2 bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                חד-פעמי
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            נוצר על ידי: {code.createdBy} | בתאריך: {code.createdAt}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDiscountCode(code.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="מחק קוד הנחה"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
