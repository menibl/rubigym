/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { WeeklyCalendar } from './WeeklyCalendar';
import { CreateSessionModal, CreateSessionData, createSessionsFromData } from './CreateSessionModal';
import { EditSessionModal } from './EditSessionModal';
import { copyGroupProgramToSessions, copyPersonalPlanToSessions } from '../data/workoutAssignment';
import {
  User,
  TrainingSession,
  OpenGymSession,
  BlackPoint,
  Announcement,
  WorkoutPlan,
  NutritionPlan,
  Message,
  SystemSettings,
  TraineeMemoryEntry,
  TraineeProfessionalProfile,
  GymEquipment,
  CoachPdfDocument,
  WorkoutAssistantDraft,
  WorkoutAssistantMessage,
  GroupWorkoutProgram,
  MuscleGroup,
  Exercise,
  UserRole,
  Gender,
  MembershipType,
  MembershipStatus,
  MEMBERSHIP_TYPE_LABELS
} from '../types';
import { TraineeMemoryPanel } from './TraineeMemoryPanel';
import { GymEquipmentPanel } from './GymEquipmentPanel';
import { CoachPdfLibraryPanel } from './CoachPdfLibraryPanel';
import { WorkoutAssistantPanel } from './WorkoutAssistantPanel';
import { GroupWorkoutProgramManager } from './GroupWorkoutProgramManager';
import { CoachTrainingMode } from './CoachTrainingMode';
import { ExerciseMedia } from './ExerciseMedia';
import { deleteExerciseMedia, saveExerciseMedia } from '../data/exerciseMediaStorage';
import {
  BookOpen,
  Apple,
  MessageSquare,
  AlertOctagon,
  Plus,
  Trash2,
  Edit3,
  Check,
  Send,
  Video,
  UserCheck,
  Sparkles,
  Calendar,
  Dumbbell,
  Wrench,
  FileText,
  UsersRound,
  MonitorPlay,
  ImagePlus
} from 'lucide-react';

interface CoachDashboardProps {
  users: User[];
  sessions: TrainingSession[];
  openGymSessions?: OpenGymSession[];
  blackPoints: BlackPoint[];
  announcements: Announcement[];
  workoutPlans: WorkoutPlan[];
  nutritionPlans: NutritionPlan[];
  messages: Message[];
  settings: SystemSettings;
  onUpdateWorkoutPlans: (plans: WorkoutPlan[]) => void;
  onUpdateNutritionPlans: (plans: NutritionPlan[]) => void;
  onUpdateBlackPoints: (points: BlackPoint[]) => void;
  onUpdateSessions: (sessions: TrainingSession[]) => void;
  onUpdateOpenGym?: (openGymSessions: OpenGymSession[]) => void;
  onUpdateAnnouncements: (announcements: Announcement[]) => void;
  onUpdateUsers?: (users: User[]) => void;
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
  initialWorkoutSessionId?: string;
  onInitialWorkoutSessionHandled?: () => void;
  initialMode?: 'TRAINING' | 'PLANNING';
  hideModeSwitcher?: boolean;
}

export const CoachDashboard: React.FC<CoachDashboardProps> = ({
  users,
  sessions,
  openGymSessions = [],
  blackPoints,
  announcements,
  workoutPlans,
  nutritionPlans,
  messages,
  settings,
  onUpdateWorkoutPlans,
  onUpdateNutritionPlans,
  onUpdateBlackPoints,
  onUpdateSessions,
  onUpdateOpenGym,
  onUpdateAnnouncements,
  onUpdateUsers,
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
  activeUser,
  initialWorkoutSessionId,
  onInitialWorkoutSessionHandled,
  initialMode,
  hideModeSwitcher = false
}) => {
  const [activeTab, setActiveTab] = useState<'programs' | 'group-programs' | 'equipment' | 'pdf-library' | 'nutrition' | 'messages' | 'sessions' | 'personal' | 'penalties'>('programs');
  const [coachMode, setCoachMode] = useState<'TRAINING' | 'PLANNING'>(() => initialMode || (activeUser.role === UserRole.COACH ? 'TRAINING' : 'PLANNING'));
  const [groupProgramSessionId, setGroupProgramSessionId] = useState('');

  useEffect(() => {
    if (initialMode) setCoachMode(initialMode);
  }, [initialMode]);

  // CreateSessionModal state
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
      onUpdateSessions([...newSessions, ...sessions]);
      if (data.category === 'PERSONAL' && data.selectedProgramId && data.targetTraineeId) {
        const source = workoutPlans.find(plan => plan.id === data.selectedProgramId && !plan.sessionId);
        if (source) onUpdateWorkoutPlans([...copyPersonalPlanToSessions(source, newSessions, data.targetTraineeId, activeUser), ...workoutPlans]);
      }
      if (data.category === 'GROUP' && data.selectedProgramId) {
        const source = groupWorkoutPrograms.find(program => program.id === data.selectedProgramId && !program.sessionId);
        if (source) onUpdateGroupWorkoutPrograms([...copyGroupProgramToSessions(source, newSessions, activeUser, users), ...groupWorkoutPrograms]);
      }
    }
    if (newOpenGym.length > 0 && onUpdateOpenGym) {
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
    if (!onUpdateOpenGym) return;
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
          if (g.id === target!.id || (g.seriesId && g.seriesId === target!.seriesId)) {
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
    if (!onUpdateOpenGym) return;
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

  // Trainee Selector for Workout / Nutrition Programmer
  const traineesOnly = users.filter(u => u.role === UserRole.TRAINEE);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(traineesOnly[0]?.id || '');
  const selectedTrainee = traineesOnly.find(t => t.id === selectedTraineeId);

  const openWorkoutProgramFromCalendar = (session: TrainingSession) => {
    setCoachMode('PLANNING');
    if (session.isPersonalTraining) {
      const traineeId = session.targetTraineeId || session.registeredUsers[0] || session.coTrainees?.[0];
      if (traineeId) setSelectedTraineeId(traineeId);
      setActiveTab('programs');
      return;
    }
    setGroupProgramSessionId(session.id);
    setActiveTab('group-programs');
  };

  React.useEffect(() => {
    if (!initialWorkoutSessionId) return;
    const session = sessions.find(item => item.id === initialWorkoutSessionId);
    if (session) openWorkoutProgramFromCalendar(session);
    onInitialWorkoutSessionHandled?.();
  }, [initialWorkoutSessionId]);

  // New Exercise Form State
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseMediaFile, setNewExerciseMediaFile] = useState<File | null>(null);
  const [editingExerciseMediaId, setEditingExerciseMediaId] = useState('');
  const [editingExerciseMediaUrl, setEditingExerciseMediaUrl] = useState('');
  const [editingExerciseMediaType, setEditingExerciseMediaType] = useState<Exercise['mediaType']>('VIDEO');
  const [editingExerciseMediaFile, setEditingExerciseMediaFile] = useState<File | null>(null);
  const [newExercise, setNewExercise] = useState<Omit<Exercise, 'id'>>({
    name: '',
    category: 'תרגילי כוח כבדים',
    muscleGroup: MuscleGroup.UPPER,
    sets: 3,
    reps: '12',
    weight: 'משקל גוף',
    workDuration: '',
    restDuration: '60 שניות',
    mediaUrl: '',
    mediaType: 'VIDEO',
    notes: ''
  });

  // Nutrition Form State
  const [isEditingNutrition, setIsEditingNutrition] = useState(false);
  const currentNutrition = nutritionPlans.find(np => np.traineeId === selectedTraineeId);
  const [nutritionForm, setNutritionForm] = useState({
    dailyCalories: 2200,
    proteinGrams: 140,
    carbsGrams: 200,
    fatGrams: 70,
    mealsDescription: ''
  });

  // Direct Message State
  const [chatInput, setChatInput] = useState('');

  // Form states for creating a new training session (Coach can also do this!)
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    durationMinutes: 60,
    muscleGroup: MuscleGroup.UPPER,
    maxParticipants: 10,
    ageMin: '',
    genderRestriction: Gender.ALL,
    allowedMemberships: Object.keys(MEMBERSHIP_TYPE_LABELS) as MembershipType[]
  });

  // Personal Training Scheduling State
  const [ptForm, setPtForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '16:00',
    durationMinutes: 60,
    muscleGroup: MuscleGroup.UPPER,
    rate: selectedTrainee?.personalTrainingRate || 180,
    coTraineeId: ''
  });

  const handleCreatePersonalTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainee) return;

    const coTrainees = ptForm.coTraineeId ? [ptForm.coTraineeId] : [];
    const registered = [selectedTrainee.id, ...coTrainees];

    const ptSession: TrainingSession = {
      id: `pt-${Date.now()}`,
      title: `אימון אישי 1:1 – ${selectedTrainee.name}`,
      date: ptForm.date,
      time: ptForm.time,
      durationMinutes: Number(ptForm.durationMinutes),
      coachId: activeUser.id,
      coachName: activeUser.name,
      muscleGroup: ptForm.muscleGroup,
      maxParticipants: registered.length,
      genderRestriction: Gender.ALL,
      allowedMemberships: [MembershipType.PERSONAL_TRAINING],
      registeredUsers: registered,
      waitlistUsers: [],
      isPersonalTraining: true,
      targetTraineeId: selectedTrainee.id,
      coTrainees: coTrainees,
      pricePerSession: Number(ptForm.rate),
      coachApprovalStatus: 'APPROVED'
    };

    onUpdateSessions([ptSession, ...sessions]);

    // Send in-app message notification to trainee
    const msgContent = `🏋️ המאמן ${activeUser.name} קבע עבורך אימון אישי ליום ${ptForm.date} בשעה ${ptForm.time}. האימון התווסף ליומן שלך!`;
    onSendMessage(msgContent, selectedTrainee.id);
    if (ptForm.coTraineeId) {
      onSendMessage(`🏋️ הצטרפת באישור המאמן לאימון אישי של ${selectedTrainee.name} ביום ${ptForm.date} בשעה ${ptForm.time}.`, ptForm.coTraineeId);
    }

    // Increment personal session count for trainee
    if (onUpdateUsers) {
      const updatedUsers = users.map(u => {
        if (u.id === selectedTrainee.id) {
          return {
            ...u,
            personalTrainingRate: Number(ptForm.rate),
            personalSessionsCountThisMonth: (u.personalSessionsCountThisMonth || 0) + 1
          };
        }
        return u;
      });
      onUpdateUsers(updatedUsers);
    }

    alert(`האימון האישי נקבע בהצלחה!\nנשלחה הודעת עדכון באפליקציה ל-${selectedTrainee.name} והאימון התווסף ליומן.`);
  };

  // Load Nutrition into form when trainee changes or editing starts
  const startEditingNutrition = () => {
    if (currentNutrition) {
      setNutritionForm({
        dailyCalories: currentNutrition.dailyCalories,
        proteinGrams: currentNutrition.proteinGrams,
        carbsGrams: currentNutrition.carbsGrams,
        fatGrams: currentNutrition.fatGrams,
        mealsDescription: currentNutrition.mealsDescription
      });
    } else {
      setNutritionForm({
        dailyCalories: 2000,
        proteinGrams: 130,
        carbsGrams: 180,
        fatGrams: 60,
        mealsDescription: 'ארוחת בוקר:\n-\n\nארוחת צהריים:\n-\n\nארוחת ערב:\n-'
      });
    }
    setIsEditingNutrition(true);
  };

  const handleSaveNutrition = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedPlans: NutritionPlan[];

    if (currentNutrition) {
      updatedPlans = nutritionPlans.map(np => {
        if (np.traineeId === selectedTraineeId) {
          return {
            ...np,
            lastUpdated: new Date().toISOString().split('T')[0],
            dailyCalories: Number(nutritionForm.dailyCalories),
            proteinGrams: Number(nutritionForm.proteinGrams),
            carbsGrams: Number(nutritionForm.carbsGrams),
            fatGrams: Number(nutritionForm.fatGrams),
            mealsDescription: nutritionForm.mealsDescription
          };
        }
        return np;
      });
    } else {
      const newPlan: NutritionPlan = {
        id: `nut-${Date.now()}`,
        traineeId: selectedTraineeId,
        coachId: activeUser.id,
        coachName: activeUser.name,
        lastUpdated: new Date().toISOString().split('T')[0],
        dailyCalories: Number(nutritionForm.dailyCalories),
        proteinGrams: Number(nutritionForm.proteinGrams),
        carbsGrams: Number(nutritionForm.carbsGrams),
        fatGrams: Number(nutritionForm.fatGrams),
        mealsDescription: nutritionForm.mealsDescription,
        active: true
      };
      updatedPlans = [newPlan, ...nutritionPlans];
    }

    onUpdateNutritionPlans(updatedPlans);
    setIsEditingNutrition(false);
  };

  const handleApproveNutritionPayment = () => {
    if (!selectedTrainee) return;
    const updatedUsers = users.map(u => {
      if (u.id === selectedTrainee.id) {
        return { ...u, nutritionPlanPaid: true };
      }
      return u;
    });
    onUpdateUsers(updatedUsers);
    alert(`אושר תשלום תוכנית תזונה (150 ₪) עבור ${selectedTrainee.name}! 💳`);
  };

  // Workout Program Builder Add Exercise
  const handleAddExerciseToPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeId) return;

    const currentPlan = workoutPlans.find(wp => wp.traineeId === selectedTraineeId && !wp.sessionId);
    const exerciseId = `ex-${Date.now()}`;
    let mediaStorageId: string | undefined;
    let resolvedMediaType = newExercise.mediaType;
    if (newExerciseMediaFile) {
      mediaStorageId = `exercise-media-${exerciseId}`;
      resolvedMediaType = newExerciseMediaFile.type === 'image/gif'
        ? 'GIF'
        : newExerciseMediaFile.type.startsWith('image/') ? 'IMAGE' : 'VIDEO';
      try {
        await saveExerciseMedia(mediaStorageId, newExerciseMediaFile);
      } catch {
        mediaStorageId = undefined;
        window.alert('לא ניתן היה לשמור את קובץ ההדגמה במכשיר. התרגיל יישמר ללא הקובץ.');
      }
    }
    const exerciseToAdd: Exercise = {
      id: exerciseId,
      name: newExercise.name || 'תרגיל כושר כללי',
      category: newExercise.category,
      muscleGroup: newExercise.muscleGroup,
      sets: Number(newExercise.sets),
      reps: newExercise.reps,
      weight: newExercise.weight,
      workDuration: newExercise.workDuration,
      restDuration: newExercise.restDuration,
      mediaUrl: newExercise.mediaUrl,
      mediaType: resolvedMediaType,
      mediaStorageId,
      notes: newExercise.notes
    };

    let updatedPlans: WorkoutPlan[];

    if (currentPlan) {
      updatedPlans = workoutPlans.map(wp => {
        if (wp.traineeId === selectedTraineeId && !wp.sessionId) {
          return {
            ...wp,
            lastUpdated: new Date().toISOString().split('T')[0],
            exercises: [...wp.exercises, exerciseToAdd]
          };
        }
        return wp;
      });
    } else {
      const newPlan: WorkoutPlan = {
        id: `plan-${Date.now()}`,
        traineeId: selectedTraineeId,
        coachId: activeUser.id,
        coachName: activeUser.name,
        lastUpdated: new Date().toISOString().split('T')[0],
        exercises: [exerciseToAdd]
      };
      updatedPlans = [newPlan, ...workoutPlans];
    }

    onUpdateWorkoutPlans(updatedPlans);
    setShowAddExercise(false);
    // Reset exercise form
    setNewExercise({
      name: '',
      category: 'תרגילי כוח כבדים',
      muscleGroup: MuscleGroup.UPPER,
      sets: 3,
      reps: '12',
      weight: 'משקל גוף',
      workDuration: '',
      restDuration: '60 שניות',
      mediaUrl: '',
      mediaType: 'VIDEO',
      notes: ''
    });
    setNewExerciseMediaFile(null);
  };

  // Workout Program delete exercise
  const handleDeleteExercise = (exerciseId: string) => {
    const exercise = workoutPlans.find(plan => plan.traineeId === selectedTraineeId && !plan.sessionId)?.exercises.find(item => item.id === exerciseId);
    if (exercise?.mediaStorageId) void deleteExerciseMedia(exercise.mediaStorageId).catch(() => undefined);
    const updatedPlans = workoutPlans.map(wp => {
      if (wp.traineeId === selectedTraineeId && !wp.sessionId) {
        return {
          ...wp,
          exercises: wp.exercises.filter(ex => ex.id !== exerciseId)
        };
      }
      return wp;
    });
    onUpdateWorkoutPlans(updatedPlans);
  };

  const startEditingExerciseMedia = (exercise: Exercise) => {
    setEditingExerciseMediaId(exercise.id);
    setEditingExerciseMediaUrl(exercise.mediaUrl || '');
    setEditingExerciseMediaType(exercise.mediaType || 'VIDEO');
    setEditingExerciseMediaFile(null);
  };

  const saveExistingExerciseMedia = async (exercise: Exercise) => {
    let mediaStorageId = exercise.mediaStorageId;
    let mediaType = editingExerciseMediaType;
    if (editingExerciseMediaFile) {
      const previousMediaStorageId = mediaStorageId;
      mediaStorageId = `exercise-media-${exercise.id}-${Date.now()}`;
      mediaType = editingExerciseMediaFile.type === 'image/gif'
        ? 'GIF'
        : editingExerciseMediaFile.type.startsWith('image/') ? 'IMAGE' : 'VIDEO';
      try {
        await saveExerciseMedia(mediaStorageId, editingExerciseMediaFile);
        if (previousMediaStorageId) void deleteExerciseMedia(previousMediaStorageId).catch(() => undefined);
      } catch {
        window.alert('לא ניתן היה לשמור את קובץ ההדגמה במכשיר.');
        return;
      }
    } else if (editingExerciseMediaUrl.trim() && mediaStorageId) {
      void deleteExerciseMedia(mediaStorageId).catch(() => undefined);
      mediaStorageId = undefined;
    }
    onUpdateWorkoutPlans(workoutPlans.map(plan => plan.traineeId === selectedTraineeId && !plan.sessionId
      ? {
          ...plan,
          lastUpdated: new Date().toISOString().split('T')[0],
          exercises: plan.exercises.map(item => item.id === exercise.id ? {
            ...item,
            mediaUrl: editingExerciseMediaUrl.trim(),
            mediaType,
            mediaStorageId
          } : item)
        }
      : plan));
    setEditingExerciseMediaId('');
    setEditingExerciseMediaFile(null);
  };

  const removeExistingExerciseMedia = (exercise: Exercise) => {
    if (exercise.mediaStorageId) void deleteExerciseMedia(exercise.mediaStorageId).catch(() => undefined);
    onUpdateWorkoutPlans(workoutPlans.map(plan => plan.traineeId === selectedTraineeId && !plan.sessionId
      ? { ...plan, exercises: plan.exercises.map(item => item.id === exercise.id ? { ...item, mediaUrl: '', mediaStorageId: undefined } : item) }
      : plan));
    setEditingExerciseMediaId('');
  };

  // Send Direct Message to Selected Trainee
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedTraineeId) return;
    onSendMessage(chatInput.trim(), selectedTraineeId);
    setChatInput('');
  };

  // Clear Black Point (Coach has authority too)
  const handleClearBlackPoint = (pointId: string) => {
    const updatedPoints = blackPoints.map(bp => {
      if (bp.id === pointId) {
        return {
          ...bp,
          status: 'CLEARED' as const,
          clearedBy: activeUser.name,
          clearReason: 'שחרור על ידי המאמן האישי'
        };
      }
      return bp;
    });
    onUpdateBlackPoints(updatedPoints);

    // Recalculate priority
    const bp = blackPoints.find(p => p.id === pointId);
    if (bp) {
      const activeCount = updatedPoints.filter(p => p.traineeId === bp.traineeId && p.status === 'ACTIVE').length;
      const score = activeCount >= settings.maxBlackPointsBeforePriorityDrop ? 50 : 100;
      users.forEach(u => {
        if (u.id === bp.traineeId) u.priorityScore = score;
      });
    }
  };

  // Coach defined new class
  const toggleAllowedMembership = (type: MembershipType) => {
    const current = newSession.allowedMemberships || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setNewSession({ ...newSession, allowedMemberships: updated });
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSession.allowedMemberships.length === 0) {
      alert('יש לבחור לפחות סוג מנוי אחד המורשה להירשם לאימון!');
      return;
    }

    const session: TrainingSession = {
      id: `session-${Date.now()}`,
      title: newSession.title || 'סדנת אימון כושר',
      date: newSession.date,
      time: newSession.time,
      durationMinutes: Number(newSession.durationMinutes),
      coachId: activeUser.id,
      coachName: activeUser.name,
      muscleGroup: newSession.muscleGroup,
      maxParticipants: Number(newSession.maxParticipants),
      ageMin: newSession.ageMin ? Number(newSession.ageMin) : undefined,
      genderRestriction: newSession.genderRestriction,
      allowedMemberships: newSession.allowedMemberships,
      registeredUsers: [],
      waitlistUsers: []
    };

    onUpdateSessions([session, ...sessions]);
    setShowSessionForm(false);
    setNewSession({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
      durationMinutes: 60,
      muscleGroup: MuscleGroup.UPPER,
      maxParticipants: 10,
      ageMin: '',
      genderRestriction: Gender.ALL,
      allowedMemberships: Object.keys(MEMBERSHIP_TYPE_LABELS) as MembershipType[]
    });
  };

  const traineeWorkoutPlan = workoutPlans.find(wp => wp.traineeId === selectedTraineeId && !wp.sessionId);
  const selectedHasWorkoutPlanAccess = Boolean(
    selectedTrainee?.secondaryMemberships?.includes(MembershipType.WORKOUT_PLAN) ||
    (selectedTrainee?.membershipType && MEMBERSHIP_TYPE_LABELS[selectedTrainee.membershipType]?.includesWorkoutPlan &&
      (selectedTrainee.membershipStatus === MembershipStatus.ACTIVE || selectedTrainee.offlinePaymentApproved))
  );
  const chatMessages = messages.filter(
    m =>
      (m.senderId === activeUser.id && m.receiverId === selectedTraineeId) ||
      (m.senderId === selectedTraineeId && m.receiverId === activeUser.id)
  );
  const selectedTraineeProfile = traineeProfiles.find(profile => profile.traineeId === selectedTraineeId);
  const selectedTraineeMemoryEntries = traineeMemoryEntries.filter(entry => entry.traineeId === selectedTraineeId);
  const selectedAssistantDraft = workoutAssistantDrafts.find(draft => draft.traineeId === selectedTraineeId);

  const handleSaveTraineeProfile = (profile: TraineeProfessionalProfile) => {
    const exists = traineeProfiles.some(item => item.traineeId === profile.traineeId);
    onUpdateTraineeProfiles(exists
      ? traineeProfiles.map(item => item.traineeId === profile.traineeId ? profile : item)
      : [profile, ...traineeProfiles]);
  };

  const handleUpdateAssistantDraft = (draft: WorkoutAssistantDraft) => {
    const exists = workoutAssistantDrafts.some(item => item.traineeId === draft.traineeId);
    onUpdateWorkoutAssistantDrafts(exists
      ? workoutAssistantDrafts.map(item => item.traineeId === draft.traineeId ? draft : item)
      : [draft, ...workoutAssistantDrafts]);
  };

  const handlePublishAssistantDraft = (draft: WorkoutAssistantDraft) => {
    if (!selectedTrainee || !selectedHasWorkoutPlanAccess || draft.exercises.length === 0) return;
    const publishedPlan: WorkoutPlan = {
      id: traineeWorkoutPlan?.id || `plan-${Date.now()}`,
      traineeId: selectedTrainee.id,
      coachId: activeUser.id,
      coachName: activeUser.name,
      lastUpdated: new Date().toISOString().split('T')[0],
      exercises: draft.exercises.map(exercise => ({ ...exercise })),
      status: 'APPROVED_ASSIGNED',
      isRequested: false
    };
    onUpdateWorkoutPlans(traineeWorkoutPlan
      ? workoutPlans.map(plan => plan.traineeId === selectedTrainee.id && !plan.sessionId ? publishedPlan : plan)
      : [publishedPlan, ...workoutPlans]);
    handleUpdateAssistantDraft({ ...draft, status: 'PUBLISHED', updatedAt: new Date().toISOString() });
    onSendMessage(`תוכנית אימון חדשה הוכנה עבורך על ידי ${activeUser.name} ופורסמה באזור תוכנית האימונים.`, selectedTrainee.id);
  };

  const openPersonalWorkoutDisplay = () => {
    if (!selectedTrainee || !traineeWorkoutPlan) return;
    const displayUrl = `${window.location.origin}${window.location.pathname}#personal-workout-display=${encodeURIComponent(selectedTrainee.id)}`;
    window.open(displayUrl, '_blank', 'noopener,noreferrer');
  };

  const modeSwitcher = hideModeSwitcher ? null : <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3" dir="rtl">
    <button onClick={() => setCoachMode('TRAINING')} className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black transition ${coachMode === 'TRAINING' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}><Calendar size={16} className="ml-2 inline" />אימונים</button>
    <button onClick={() => setCoachMode('PLANNING')} className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black transition ${coachMode === 'PLANNING' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}><BookOpen size={16} className="ml-2 inline" />תכנון</button>
  </div>;

  if (coachMode === 'TRAINING') {
    return <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-md" id="coach-dashboard">
      {modeSwitcher}
      <CoachTrainingMode
        activeUser={activeUser}
        users={users}
        sessions={sessions}
        workoutPlans={workoutPlans}
        onUpdateWorkoutPlans={onUpdateWorkoutPlans}
        groupWorkoutPrograms={groupWorkoutPrograms}
        onUpdateGroupWorkoutPrograms={onUpdateGroupWorkoutPrograms}
        onOpenProgram={openWorkoutProgramFromCalendar}
      />
    </div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden" id="coach-dashboard">
      {modeSwitcher}
      {/* Tab Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-sky-400 animate-pulse" size={20} />
          <h1 className="text-lg font-extrabold text-white">פאנל מאמנים – {activeUser.name}</h1>
        </div>

        {/* Global Trainee Switcher for Programmer */}
        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
          <span className="text-xs text-slate-400 font-medium shrink-0">בחר מתאמן לטיפול:</span>
          <select
            value={selectedTraineeId}
            onChange={(e) => setSelectedTraineeId(e.target.value)}
            className="text-xs font-semibold text-white bg-transparent focus:outline-none cursor-pointer"
            id="coach-trainee-selector"
          >
            {traineesOnly.map(t => (
              <option key={t.id} value={t.id} className="bg-slate-800 text-white">{t.name} ({t.membershipType})</option>
            ))}
          </select>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-800 p-1.5 rounded-xl gap-1 flex-wrap border border-slate-700">
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'programs' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <BookOpen size={14} />
            תוכנית אימונים
          </button>
          <button
            onClick={() => setActiveTab('group-programs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'group-programs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <UsersRound size={14} />
            תוכנית אימונים לקבוצות
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'equipment' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Wrench size={14} />
            ציוד ומכשירים
          </button>
          <button
            onClick={() => setActiveTab('pdf-library')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'pdf-library' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <FileText size={14} />
            ספריית PDF
          </button>
          <button
            onClick={() => setActiveTab('nutrition')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'nutrition' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Apple size={14} />
            תפריט תזונה
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer relative ${
              activeTab === 'messages' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <MessageSquare size={14} />
            צ'אט והודעות אישיות
            {messages.filter(m => m.receiverId === activeUser.id && !m.read).length > 0 && (
              <span className="absolute -top-1 -left-1 bg-sky-500 text-white rounded-full w-4 h-4 text-[8px] flex items-center justify-center font-bold">
                {messages.filter(m => m.receiverId === activeUser.id && !m.read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'sessions' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Calendar size={14} />
            אימונים ולו"ז
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'personal' ? 'bg-indigo-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Dumbbell size={14} />
            אימונים אישיים (1:1)
          </button>
          <button
            onClick={() => setActiveTab('penalties')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'penalties' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertOctagon size={14} />
            שחרור עונשים
          </button>
        </div>
      </div>

      <div className="p-6">
        {selectedTrainee ? (
          <div>
            {/* TAB 1: WORKOUT PROGRAMS BUILDER */}
            {activeTab === 'programs' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      תוכנית אימונים אישית עבור: {selectedTrainee.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {traineeWorkoutPlan 
                        ? `עודכן לאחרונה בתאריך: ${traineeWorkoutPlan.lastUpdated}`
                        : 'לא הוגדרה תוכנית אימון למתאמן זה עדיין.'
                      }
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {traineeWorkoutPlan && traineeWorkoutPlan.exercises.length > 0 && (
                      <button onClick={openPersonalWorkoutDisplay} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center gap-1 transition">
                        <MonitorPlay size={14} />
                        פתח מסך אימון
                      </button>
                    )}
                    <button
                      onClick={() => setShowAddExercise(!showAddExercise)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center gap-1 transition"
                    >
                      <Plus size={14} />
                      הוסף תרגיל חדש
                    </button>
                  </div>
                </div>

                <TraineeMemoryPanel
                  trainee={selectedTrainee}
                  activeUser={activeUser}
                  profile={selectedTraineeProfile}
                  entries={selectedTraineeMemoryEntries}
                  onSaveProfile={handleSaveTraineeProfile}
                  onAddEntry={entry => onUpdateTraineeMemoryEntries([entry, ...traineeMemoryEntries])}
                  onDeleteEntry={entryId => onUpdateTraineeMemoryEntries(traineeMemoryEntries.filter(entry => entry.id !== entryId))}
                />

                <WorkoutAssistantPanel
                  activeUser={activeUser}
                  trainee={selectedTrainee}
                  profile={selectedTraineeProfile}
                  memoryEntries={selectedTraineeMemoryEntries}
                  equipment={gymEquipment}
                  pdfDocuments={coachPdfDocuments}
                  messages={workoutAssistantMessages}
                  draft={selectedAssistantDraft}
                  canPublish={selectedHasWorkoutPlanAccess}
                  onUpdateMessages={onUpdateWorkoutAssistantMessages}
                  onUpdateDraft={handleUpdateAssistantDraft}
                  onPublish={handlePublishAssistantDraft}
                />

                {/* Membership & Request Notice */}
                {selectedHasWorkoutPlanAccess ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900">
                    <span className="font-bold">✅ הגישה לתוכנית שולמה או כלולה במנוי:</span>
                    <span className="mr-1">התוכנית שתיבנה כאן תוצג למתאמן מיד לאחר השמירה.</span>
                  </div>
                ) : selectedTrainee.requestedWorkoutPlan ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                    <span className="font-bold">📩 בקשת תוכנית אימונים ממתינה לתשלום:</span>
                    <span className="mr-1">אפשר לבנות את התוכנית מראש, אך היא תישאר חסומה למתאמן עד להסדרת התשלום.</span>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                    ניתן להכין את התוכנית מראש. היא תוצג למתאמן רק לאחר רכישת תוכנית אימון או במסגרת מנוי הכולל אותה.
                  </div>
                )}

                {/* ADD EXERCISE FORM */}
                {showAddExercise && (
                  <form onSubmit={handleAddExerciseToPlan} className="bg-slate-50 border border-slate-100 rounded-lg p-5 space-y-4" id="add-exercise-form">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <h4 className="text-xs font-bold text-slate-800">הוספת תרגיל ובחירת קטגוריות / קבוצת שרירים</h4>
                      <button type="button" onClick={() => setShowAddExercise(false)} className="text-slate-400 hover:text-slate-600 text-xs">ביטול</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">שם התרגיל</label>
                        <input
                          type="text"
                          required
                          placeholder="לדוגמה: לחיצת כתפיים בישיבה"
                          value={newExercise.name}
                          onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">קטגוריה (בחירת מאמן)</label>
                        <input
                          type="text"
                          required
                          placeholder="לדוגמה: תרגילי כוח כבדים, בטן, אירובי"
                          value={newExercise.category}
                          onChange={(e) => setNewExercise({ ...newExercise, category: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">אזור אימון / קבוצת שרירים</label>
                        <select
                          value={newExercise.muscleGroup}
                          onChange={(e) => setNewExercise({ ...newExercise, muscleGroup: e.target.value as MuscleGroup })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value={MuscleGroup.UPPER}>פלג גוף עליון</option>
                          <option value={MuscleGroup.LEGS}>רגליים וישבן</option>
                          <option value={MuscleGroup.BACK}>גב</option>
                          <option value={MuscleGroup.SHOULDERS}>כתפיים</option>
                          <option value={MuscleGroup.CORE}>בטן וליבה (Core)</option>
                          <option value={MuscleGroup.FUNCTIONAL}>פונקציונלי</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">סטים</label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="10"
                          value={newExercise.sets}
                          onChange={(e) => setNewExercise({ ...newExercise, sets: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">חזרות / זמן</label>
                        <input
                          type="text"
                          required
                          placeholder="לדוגמה: 12, או 8-10, או 1 דקה"
                          value={newExercise.reps}
                          onChange={(e) => setNewExercise({ ...newExercise, reps: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">משקל מומלץ</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: 15kg או משקל גוף"
                          value={newExercise.weight}
                          onChange={(e) => setNewExercise({ ...newExercise, weight: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">זמן עבודה</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: 45 שניות"
                          value={newExercise.workDuration}
                          onChange={(e) => setNewExercise({ ...newExercise, workDuration: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">זמן מנוחה</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: 60 שניות"
                          value={newExercise.restDuration}
                          onChange={(e) => setNewExercise({ ...newExercise, restDuration: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                      <label className="block text-xs font-bold text-slate-700 mb-2">תמונת / GIF / סרטון הדגמה (אופציונלי)</label>
                      <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
                        <select value={newExercise.mediaType || 'VIDEO'} onChange={(e) => setNewExercise({ ...newExercise, mediaType: e.target.value as Exercise['mediaType'] })} className="rounded-lg border border-slate-300 bg-white p-2 text-xs">
                          <option value="VIDEO">סרטון בלולאה</option>
                          <option value="GIF">GIF מונפש</option>
                          <option value="IMAGE">תמונה</option>
                        </select>
                        <input type="url" placeholder="קישור לתמונה, GIF, MP4 או YouTube" value={newExercise.mediaUrl} onChange={(e) => setNewExercise({ ...newExercise, mediaUrl: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" />
                      </div>
                      <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-sky-300 bg-white px-3 py-2 text-xs text-slate-600">
                        <span>{newExerciseMediaFile ? newExerciseMediaFile.name : 'או העלה קובץ מהמכשיר (תמונה, GIF, MP4 או WebM)'}</span>
                        <span className="rounded-md bg-sky-600 px-2 py-1 font-bold text-white">בחירת קובץ</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={event => {
                          const file = event.target.files?.[0] || null;
                          if (file && file.size > 15 * 1024 * 1024) {
                            window.alert('גודל קובץ ההדגמה המרבי הוא 15MB.');
                            event.target.value = '';
                            return;
                          }
                          setNewExerciseMediaFile(file);
                        }} />
                      </label>
                      <p className="mt-2 text-[10px] text-slate-500">הסרטון יוצג ללא קול וירוץ ברצף, כדי להשאיר את צפצופי הטיימר ברורים.</p>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 font-medium mb-1">הנחיות ביצוע ודגשים למתאמן</label>
                      <textarea
                        rows={2}
                        placeholder="לדוגמה: לשמור על מרפקים צמודים לגוף, לעלות באיטיות..."
                        value={newExercise.notes}
                        onChange={(e) => setNewExercise({ ...newExercise, notes: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-lg"
                      >
                        הוסף תרגיל לתוכנית האימונים של המתאמן
                      </button>
                    </div>
                  </form>
                )}

                {/* EXERCISES DISPLAY LIST */}
                {traineeWorkoutPlan && traineeWorkoutPlan.exercises.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {traineeWorkoutPlan.exercises.map(ex => (
                      <div key={ex.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col justify-between relative" id={`exercise-card-${ex.id}`}>
                        <button
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="absolute left-3 top-3 text-slate-400 hover:text-rose-500 transition"
                          title="מחק תרגיל"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="bg-sky-100 text-sky-800 text-[9px] font-bold px-2 py-0.5 rounded">
                              {ex.category}
                            </span>
                            <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded">
                              {ex.muscleGroup === MuscleGroup.UPPER && 'פלג גוף עליון'}
                              {ex.muscleGroup === MuscleGroup.LEGS && 'רגליים וישבן'}
                              {ex.muscleGroup === MuscleGroup.BACK && 'גב'}
                              {ex.muscleGroup === MuscleGroup.SHOULDERS && 'כתפיים'}
                              {ex.muscleGroup === MuscleGroup.CORE && 'בטן וליבה'}
                              {ex.muscleGroup === MuscleGroup.FUNCTIONAL && 'פונקציונלי'}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-800 text-sm">{ex.name}</h4>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white rounded-lg p-2.5 my-3 border border-slate-100 text-center font-mono">
                            <div>
                              <div className="text-[10px] text-slate-400">סטים</div>
                              <div className="font-bold text-slate-800 text-xs">{ex.sets}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">חזרות</div>
                              <div className="font-bold text-slate-800 text-xs">{ex.reps}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">משקל</div>
                              <div className="font-bold text-emerald-600 text-xs truncate">{ex.weight || 'גוף'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">עבודה</div>
                              <div className="font-bold text-slate-800 text-xs">{ex.workDuration || '—'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">מנוחה</div>
                              <div className="font-bold text-slate-800 text-xs">{ex.restDuration || '—'}</div>
                            </div>
                          </div>

                          {ex.notes && (
                            <p className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-50/50 mb-3">
                              💡 {ex.notes}
                            </p>
                          )}
                          {(ex.mediaUrl || ex.mediaStorageId) && <ExerciseMedia exercise={ex} compact className="mt-3" controls />}
                          <button onClick={() => startEditingExerciseMedia(ex)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-fuchsia-300 bg-fuchsia-50 px-3 py-2.5 text-xs font-black text-fuchsia-700">
                            <ImagePlus size={16} /> {ex.mediaUrl || ex.mediaStorageId ? 'שנה תמונה / GIF / סרטון' : 'העלה תמונה / GIF / סרטון לתרגיל'}
                          </button>
                          {editingExerciseMediaId === ex.id && (
                            <div className="mt-2 space-y-2 rounded-xl border border-sky-200 bg-white p-3">
                              <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                                <select value={editingExerciseMediaType || 'VIDEO'} onChange={event => setEditingExerciseMediaType(event.target.value as Exercise['mediaType'])} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"><option value="VIDEO">סרטון</option><option value="GIF">GIF</option><option value="IMAGE">תמונה</option></select>
                                <input value={editingExerciseMediaUrl} onChange={event => setEditingExerciseMediaUrl(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs" placeholder="קישור לתמונה, GIF, MP4 או YouTube" />
                              </div>
                              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-sky-300 px-3 py-2 text-[10px] text-slate-600"><span>{editingExerciseMediaFile?.name || 'העלה קובץ חדש מהמכשיר'}</span><span className="font-bold text-sky-700">בחירה</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={event => {
                                const file = event.target.files?.[0] || null;
                                if (file && file.size > 15 * 1024 * 1024) { window.alert('גודל קובץ ההדגמה המרבי הוא 15MB.'); return; }
                                setEditingExerciseMediaFile(file);
                              }} /></label>
                              <div className="flex gap-2"><button onClick={() => void saveExistingExerciseMedia(ex)} className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white">שמור מדיה</button><button onClick={() => setEditingExerciseMediaId('')} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">ביטול</button>{(ex.mediaUrl || ex.mediaStorageId) && <button onClick={() => removeExistingExerciseMedia(ex)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">הסר</button>}</div>
                            </div>
                          )}
                        </div>

                        {ex.mediaUrl && (
                          <a
                            href={ex.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-xs font-bold text-sky-700"
                          >
                            <Video size={15} />
                            צפייה בסרטון ההדגמה
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    אין תרגילים בתוכנית כעת. לחץ על "הוסף תרגיל חדש" כדי להתחיל לתכנת!
                  </div>
                )}
              </div>
            )}

            {activeTab === 'equipment' && (
              <GymEquipmentPanel
                activeUser={activeUser}
                equipment={gymEquipment}
                onUpdateEquipment={onUpdateGymEquipment}
              />
            )}

            {activeTab === 'group-programs' && (
              <GroupWorkoutProgramManager
                activeUser={activeUser}
                programs={groupWorkoutPrograms}
                onUpdatePrograms={onUpdateGroupWorkoutPrograms}
                trainees={users.filter(user => user.role === UserRole.TRAINEE)}
                sessions={sessions}
                initialSessionId={groupProgramSessionId}
                onInitialSessionHandled={() => setGroupProgramSessionId('')}
              />
            )}

            {activeTab === 'pdf-library' && (
              <CoachPdfLibraryPanel
                activeUser={activeUser}
                documents={coachPdfDocuments}
                onUpdateDocuments={onUpdateCoachPdfDocuments}
              />
            )}

            {/* TAB 2: NUTRITION PLANS */}
            {activeTab === 'nutrition' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">תוכנית תזונה מותאמת אישית (בתשלום פרטני)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">עבור המתאמן: {selectedTrainee.name}</p>
                  </div>
                  {!isEditingNutrition && (
                    <button
                      onClick={startEditingNutrition}
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold py-2 px-3.5 rounded-lg transition"
                    >
                      {currentNutrition ? 'ערוך תוכנית תזונה' : 'הרכב תפריט תזונה ראשון'}
                    </button>
                  )}
                </div>

                {/* Nutrition Payment Status Banner */}
                {(selectedTrainee.nutritionPlanPaid || currentNutrition?.isPaid) ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 font-semibold flex items-center justify-between">
                    <span>✅ תוכנית תזונה שולמה במלאה (150 ₪) – תוכנית זו מוצגת למתאמן באפליקציה.</span>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-bold block">⚠️ טרם שולם תשלום פרטני (150 ₪) עבור תוכנית תזונה למתאמן זה:</span>
                      <span className="text-[11px] text-amber-800">התפריט יוצג למתאמן באפליקציה מיד עם הסדרת התשלום (או באישור ידני של המאמן/מנהל).</span>
                    </div>
                    <button
                      onClick={handleApproveNutritionPayment}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs shrink-0 transition"
                    >
                      💳 אישור תשלום (150 ₪)
                    </button>
                  </div>
                )}

                {isEditingNutrition ? (
                  <form onSubmit={handleSaveNutrition} className="bg-slate-50 border border-slate-100 rounded-lg p-5 space-y-4" id="nutrition-form">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">קלוריות יומיות</label>
                        <input
                          type="number"
                          required
                          value={nutritionForm.dailyCalories}
                          onChange={(e) => setNutritionForm({ ...nutritionForm, dailyCalories: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">חלבון (גרם)</label>
                        <input
                          type="number"
                          required
                          value={nutritionForm.proteinGrams}
                          onChange={(e) => setNutritionForm({ ...nutritionForm, proteinGrams: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">פחמימות (גרם)</label>
                        <input
                          type="number"
                          required
                          value={nutritionForm.carbsGrams}
                          onChange={(e) => setNutritionForm({ ...nutritionForm, carbsGrams: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">שומן (גרם)</label>
                        <input
                          type="number"
                          required
                          value={nutritionForm.fatGrams}
                          onChange={(e) => setNutritionForm({ ...nutritionForm, fatGrams: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 font-medium mb-1">פירוט הארוחות וההנחיות</label>
                      <textarea
                        required
                        rows={6}
                        placeholder="פרט כאן ארוחת בוקר, צהריים, ערב והנחיות מיוחדות..."
                        value={nutritionForm.mealsDescription}
                        onChange={(e) => setNutritionForm({ ...nutritionForm, mealsDescription: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                      />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingNutrition(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs py-2 px-4 rounded-lg transition"
                      >
                        ביטול
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition"
                      >
                        שמור תוכנית תזונה
                      </button>
                    </div>
                  </form>
                ) : currentNutrition ? (
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400">קלוריות</div>
                        <div className="text-md font-bold font-mono text-slate-800">{currentNutrition.dailyCalories} kcal</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400">חלבון</div>
                        <div className="text-md font-bold font-mono text-slate-800">{currentNutrition.proteinGrams}g</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400">פחמימה</div>
                        <div className="text-md font-bold font-mono text-slate-800">{currentNutrition.carbsGrams}g</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400">שומן</div>
                        <div className="text-md font-bold font-mono text-slate-800">{currentNutrition.fatGrams}g</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <span className="block text-xs font-bold text-slate-700 mb-2">תפריט יומי מפורט:</span>
                      <pre className="text-xs text-slate-600 font-sans whitespace-pre-wrap leading-relaxed bg-white border border-slate-100 rounded-lg p-4">
                        {currentNutrition.mealsDescription}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    לא הוגדרה תוכנית תזונה למתאמן זה. לחץ על "הרכב תפריט תזונה ראשון" למעלה כדי לבנות תוכנית!
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DIRECT MESSAGING CHAT */}
            {activeTab === 'messages' && (
              <div className="space-y-4">
                <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 flex items-center gap-2">
                  <UserCheck size={14} className="text-sky-700" />
                  <span className="text-xs text-sky-800">
                    צ'אט אישי דו-כיווני מאובטח עם המתאמן <strong>{selectedTrainee.name}</strong>. הודעות מסומנות כנקראו אוטומטית.
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl h-[360px] bg-slate-50 p-4 overflow-y-auto flex flex-col gap-3" id="coach-chat-window">
                  {chatMessages.length > 0 ? (
                    chatMessages.map(m => {
                      const isMe = m.senderId === activeUser.id;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[80%] rounded-xl p-3 text-xs ${
                            isMe
                              ? 'bg-sky-600 text-white self-start rounded-tr-none'
                              : 'bg-white border border-slate-200 text-slate-800 self-end rounded-tl-none'
                          }`}
                        >
                          {!isMe && <div className="font-semibold text-[9px] text-slate-400 mb-1">{m.senderName}</div>}
                          <div>{m.content}</div>
                          <div className="text-[9px] mt-1 text-right opacity-70 font-mono">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center m-auto text-slate-400 text-xs">
                      אין הודעות קודמות. כתוב הודעה ראשונה מטה כדי לפתוח את השיחה!
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`כתוב הודעה אישית ל-${selectedTrainee.name}...`}
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

            {/* TAB 4: SESSIONS MANAGEMENT (COACH) */}
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                {/* WEEKLY CALENDAR FOR COACH */}
                <WeeklyCalendar
                  role={UserRole.COACH}
                  activeUser={activeUser}
                  sessions={sessions}
                  openGymSessions={openGymSessions}
                  users={users}
                  onDeleteSession={handleDeleteSession}
                  onEditSession={(s) => setEditingSession(s)}
                  onOpenWorkoutProgram={openWorkoutProgramFromCalendar}
                  onDeleteOpenGym={handleDeleteOpenGym}
                  onEditOpenGym={(g) => setEditingOpenGym(g)}
                  onOpenCreateSessionModal={(d, t) => handleOpenCreateModal(d, t)}
                />

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

                <div className="flex justify-between items-center border-b border-slate-100 pb-3 pt-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">פתיחת אימונים קבוצתיים חדשים</h3>
                    <p className="text-xs text-slate-500">המאמן מורשה להגדיר אימונים ומכסות בהתאם לצורך.</p>
                  </div>
                  <button
                    onClick={() => setShowSessionForm(!showSessionForm)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1 transition"
                  >
                    <Plus size={14} />
                    הגדר אימון חדש
                  </button>
                </div>

                {showSessionForm && (
                  <form onSubmit={handleCreateSession} className="bg-slate-50 border border-slate-100 rounded-lg p-5 space-y-4" id="coach-session-form">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">שם האימון</label>
                        <input
                          type="text"
                          required
                          placeholder="אימון אאוטדור אירובי"
                          value={newSession.title}
                          onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">קבוצת שרירים</label>
                        <select
                          value={newSession.muscleGroup}
                          onChange={(e) => setNewSession({ ...newSession, muscleGroup: e.target.value as MuscleGroup })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                        >
                          <option value={MuscleGroup.UPPER}>פלג גוף עליון</option>
                          <option value={MuscleGroup.LEGS}>רגליים וישבן</option>
                          <option value={MuscleGroup.BACK}>גב</option>
                          <option value={MuscleGroup.SHOULDERS}>כתפיים</option>
                          <option value={MuscleGroup.CORE}>בטן וליבה</option>
                          <option value={MuscleGroup.FUNCTIONAL}>פונקציונלי כללי</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">תאריך ושעה</label>
                        <div className="flex gap-1">
                          <input
                            type="date"
                            required
                            value={newSession.date}
                            onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                            className="border border-slate-200 rounded p-1 text-xs w-2/3"
                          />
                          <input
                            type="time"
                            required
                            value={newSession.time}
                            onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                            className="border border-slate-200 rounded p-1 text-xs w-1/3"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200/80 pt-3">
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">מכסת משתתפים מקסימלית</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={newSession.maxParticipants}
                          onChange={(e) => setNewSession({ ...newSession, maxParticipants: Number(e.target.value) })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">מגבלת מין</label>
                        <select
                          value={newSession.genderRestriction}
                          onChange={(e) => setNewSession({ ...newSession, genderRestriction: e.target.value as Gender })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                        >
                          <option value={Gender.ALL}>ללא מגבלה (גברים ונשים 👥)</option>
                          <option value={Gender.MALE}>גברים בלבד 🚹</option>
                          <option value={Gender.FEMALE}>נשים בלבד 🚺</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 font-medium mb-1">מגבלת גיל מינימלי (אופציונלי)</label>
                        <input
                          type="number"
                          placeholder="לדוגמה: 18"
                          value={newSession.ageMin}
                          onChange={(e) => setNewSession({ ...newSession, ageMin: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* ALLOWED MEMBERSHIPS SELECTION FOR COACH */}
                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-800">
                          🎯 סוגי מנויים מורשים להירשם לאימון זה:
                        </label>
                        <div className="flex gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setNewSession({
                              ...newSession,
                              allowedMemberships: Object.keys(MEMBERSHIP_TYPE_LABELS) as MembershipType[]
                            })}
                            className="text-emerald-700 hover:underline font-semibold"
                          >
                            סמן הכל
                          </button>
                          <span>|</span>
                          <button
                            type="button"
                            onClick={() => setNewSession({
                              ...newSession,
                              allowedMemberships: [MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL]
                            })}
                            className="text-sky-700 hover:underline font-semibold"
                          >
                            קבוצתי בלבד
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                        {Object.entries(MEMBERSHIP_TYPE_LABELS).map(([typeKey, info]) => {
                          const typeEnum = typeKey as MembershipType;
                          return (
                            <label key={typeKey} className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-700">
                              <input
                                type="checkbox"
                                checked={newSession.allowedMemberships.includes(typeEnum)}
                                onChange={() => toggleAllowedMembership(typeEnum)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>{info.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-200 pt-3">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-4 rounded"
                      >
                        פרסם אימון ללוח של המועדון
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700">האימונים שאתה מעביר:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sessions
                      .filter(s => s.coachId === activeUser.id)
                      .map(s => (
                        <div key={s.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col justify-between" id={`coach-class-${s.id}`}>
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-800 text-sm">{s.title}</h4>
                              <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold">
                                {s.muscleGroup}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 font-mono">{s.date} בשעה {s.time}</div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                            <div>
                              תפוסה:{' '}
                              <strong className="text-slate-800">
                                {s.registeredUsers.length} / {s.maxParticipants}
                              </strong>
                            </div>
                            {s.waitlistUsers.length > 0 && (
                              <div className="text-amber-600 font-semibold text-[11px]">
                                {s.waitlistUsers.length} ממתינים בתור
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PERSONAL TRAINING SCHEDULING (1:1) */}
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-xl space-y-2 shadow-sm border border-indigo-700/30">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="text-indigo-400" size={20} />
                    <h3 className="text-base font-bold">תיאום אימונים אישיים עבור: {selectedTrainee.name}</h3>
                  </div>
                  <p className="text-xs text-slate-300">
                    התיאום מתבצע ישירות מול המאמן. ניתן להכניס יותר ממתאמן אחד באישור המאמן. הרישום מעדכן אוטומטית את היומן ושולח הודעה באפליקציה. סגירת תשלום חודשית ב-1 לכל חודש.
                  </p>
                </div>

                {/* Trainer Settings & Pricing per Trainee */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    ⚙️ הגדרת תמחור ואישור מתאמנים מרובים
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">מחיר לאימון אישי עבור {selectedTrainee.name} (ש"ח):</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={ptForm.rate}
                          onChange={(e) => setPtForm({ ...ptForm, rate: Number(e.target.value) })}
                          className="border border-slate-300 rounded px-3 py-1.5 w-full bg-white focus:outline-none focus:border-indigo-500 font-bold text-slate-800"
                        />
                        <button
                          onClick={() => {
                            if (onUpdateUsers) {
                              const updated = users.map(u => u.id === selectedTrainee.id ? { ...u, personalTrainingRate: Number(ptForm.rate) } : u);
                              onUpdateUsers(updated);
                              alert(`עודכן תעריף אימון אישי ל-${selectedTrainee.name}: ₪${ptForm.rate}`);
                            }
                          }}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-indigo-700 shrink-0"
                        >
                          עדכן תעריף
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-col justify-between">
                      <div className="text-slate-700 font-semibold text-xs">אימונים שנערכו החודש:</div>
                      <div className="text-lg font-black text-indigo-700">
                        {selectedTrainee.personalSessionsCountThisMonth || 0} אימונים 
                        <span className="text-xs text-slate-500 font-normal mr-2">
                          (סה"כ לתשלום ב-1 לחודש: ₪{(selectedTrainee.personalTrainingRate || 180) * (selectedTrainee.personalSessionsCountThisMonth || 0)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form to Schedule Personal Session */}
                <form onSubmit={handleCreatePersonalTraining} className="bg-white border border-indigo-100 rounded-xl p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    📅 קביעת אימון אישי חדש ביומן
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">תאריך האימון:</label>
                      <input
                        type="date"
                        value={ptForm.date}
                        onChange={(e) => setPtForm({ ...ptForm, date: e.target.value })}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">שעת התחלה:</label>
                      <input
                        type="time"
                        value={ptForm.time}
                        onChange={(e) => setPtForm({ ...ptForm, time: e.target.value })}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">משך אימון (בדקות):</label>
                      <input
                        type="number"
                        value={ptForm.durationMinutes}
                        onChange={(e) => setPtForm({ ...ptForm, durationMinutes: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">קבוצת שרירים ממוקדת:</label>
                      <select
                        value={ptForm.muscleGroup}
                        onChange={(e) => setPtForm({ ...ptForm, muscleGroup: e.target.value as MuscleGroup })}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500 bg-white"
                      >
                        <option value={MuscleGroup.UPPER}>פלג גוף עליון</option>
                        <option value={MuscleGroup.LEGS}>רגליים</option>
                        <option value={MuscleGroup.BACK}>גב</option>
                        <option value={MuscleGroup.SHOULDERS}>כתפיים</option>
                        <option value={MuscleGroup.CORE}>בטן וליבה</option>
                        <option value={MuscleGroup.FUNCTIONAL}>פונקציונלי</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-600 font-medium mb-1">
                        הוספת מתאמן נוסף לאימון אישי זה (אישור המאמן):
                      </label>
                      <select
                        value={ptForm.coTraineeId}
                        onChange={(e) => setPtForm({ ...ptForm, coTraineeId: e.target.value })}
                        className="w-full border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500 bg-white"
                      >
                        <option value="">-- ללא מתאמן נוסף (אימון 1:1 בלבד) --</option>
                        {traineesOnly
                          .filter(t => t.id !== selectedTrainee.id)
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} (באישור מאמן)
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-lg shadow-sm transition flex items-center gap-1.5"
                    >
                      <Calendar size={14} />
                      אשר ורשום ביומן + שלח הודעה באפליקציה
                    </button>
                  </div>
                </form>

                {/* List of Scheduled PT sessions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">אימונים אישיים מתואמים:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sessions
                      .filter(s => s.isPersonalTraining && (s.registeredUsers.includes(selectedTrainee.id) || s.coachId === activeUser.id))
                      .map(s => (
                        <div key={s.id} className="border border-indigo-100 bg-indigo-50/50 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-indigo-900 text-xs">{s.title}</span>
                            <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded">
                              ₪{s.pricePerSession || 180}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono">
                            📅 תאריך: {s.date} | בשעה: {s.time} ({s.durationMinutes} דק')
                          </div>
                          <div className="text-[10px] text-slate-500">
                            משתתפים רשומים: {s.registeredUsers.map(uid => users.find(u => u.id === uid)?.name).filter(Boolean).join(', ')}
                          </div>
                        </div>
                      ))}
                    {sessions.filter(s => s.isPersonalTraining && (s.registeredUsers.includes(selectedTrainee.id) || s.coachId === activeUser.id)).length === 0 && (
                      <div className="text-slate-400 text-xs italic py-4 text-center border border-dashed rounded-lg col-span-2">
                        אין אימונים אישיים מתואמים כעת עבור מתאמן זה.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: PENALTIES RELEASING */}
            {activeTab === 'penalties' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">שחרור נקודות שחורות – בירור עונש</h3>
                  <p className="text-xs text-slate-500">
                    המאמן מורשה לצפות בהיסטוריית העונשים של {selectedTrainee.name} ולבטל/למחוק ידנית נקודה במקרה של הצדקה.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="p-3">אימון רלוונטי</th>
                        <th className="p-3">תאריך האימון</th>
                        <th className="p-3">תאריך הטלה</th>
                        <th className="p-3">סיבת העבירה</th>
                        <th className="p-3">סטטוס</th>
                        <th className="p-3 text-left">פעולה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blackPoints
                        .filter(bp => bp.traineeId === selectedTraineeId)
                        .map(bp => (
                          <tr key={bp.id} className="border-b border-slate-100 hover:bg-slate-50" id={`coach-bp-row-${bp.id}`}>
                            <td className="p-3 font-semibold text-slate-800">{bp.sessionTitle}</td>
                            <td className="p-3 text-slate-600 font-mono">{bp.sessionDate}</td>
                            <td className="p-3 text-slate-500 font-mono">{bp.issuedDate}</td>
                            <td className="p-3 text-slate-600 max-w-xs truncate">{bp.reason}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                bp.status === 'ACTIVE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : bp.status === 'CLEARED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {bp.status === 'ACTIVE' && 'פעילה 🚨'}
                                {bp.status === 'CLEARED' && 'בוטלה ידנית ✅'}
                                {bp.status === 'EXPIRED' && 'פג תוקף'}
                              </span>
                            </td>
                            <td className="p-3 text-left">
                              {bp.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleClearBlackPoint(bp.id)}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-medium py-1 px-2.5 rounded border border-emerald-200 transition"
                                >
                                  שחרר נקודה
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      {blackPoints.filter(bp => bp.traineeId === selectedTraineeId).length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400 text-xs">
                            למתאמן זה אין היסטוריית נקודות שחורות רשומה! נקי לחלוטין.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            לא נמצאו מתאמנים רשומים במערכת. אנא צור מתאמנים או אפס את נתוני הסימולטור.
          </div>
        )}
      </div>
    </div>
  );
};
