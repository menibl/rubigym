import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Dumbbell,
  ExternalLink,
  ImagePlus,
  MessageCircle,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  SkipForward,
  TimerReset,
  Trash2,
  UsersRound
} from 'lucide-react';
import { GroupWorkoutExercise, GroupWorkoutParticipant, GroupWorkoutProgram, GroupWorkoutStation, GymEquipment, MuscleGroup, TraineeMemoryEntry, TraineeProfessionalProfile, TrainingSession, User } from '../types';
import { ExerciseMedia } from './ExerciseMedia';
import { deleteExerciseMedia, saveExerciseMedia } from '../data/exerciseMediaStorage';
import { getGroupWorkoutStatus, GroupWorkoutLiveStatus, sendGroupWorkoutCommand, subscribeToGroupWorkoutStatus } from '../data/groupWorkoutRemote';
import { generateGroupWorkoutWithAi } from '../data/workoutAi';
import { ProgramBriefPanel, ProgramSetupWizard, WizardAnswers, WizardQuestion } from './ProgramSetupWizard';

interface GroupWorkoutProgramManagerProps {
  activeUser: User;
  programs: GroupWorkoutProgram[];
  onUpdatePrograms: (programs: GroupWorkoutProgram[]) => void;
  trainees: User[];
  sessions: TrainingSession[];
  equipment: GymEquipment[];
  traineeProfiles: TraineeProfessionalProfile[];
  memoryEntries: TraineeMemoryEntry[];
  initialSessionId?: string;
  onInitialSessionHandled?: () => void;
  initialProgramId?: string;
  initialAudience?: string;
  onInitialProgramHandled?: () => void;
}

const createExercise = (index: number, workSeconds: number, restSeconds: number): GroupWorkoutExercise => ({
  id: `group-exercise-${Date.now()}-${index}`,
  name: '',
  category: 'תחנה',
  muscleGroup: MuscleGroup.FUNCTIONAL,
  sets: 1,
  reps: 'לפי זמן',
  weight: '',
  workDuration: `${workSeconds} שניות`,
  restDuration: `${restSeconds} שניות`,
  mediaUrl: '',
  notes: '',
  workSeconds,
  restSeconds,
  rounds: 1
});

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

const totalProgramSeconds = (program: GroupWorkoutProgram) => {
  if (program.mode === 'ROTATING_GROUPS') {
    const stations = program.stations || [];
    const longestStation = Math.max(0, ...stations.map(station => station.exercises.length));
    const rotations = stations.length;
    return program.preparationSeconds
      + (rotations * (program.roundsPerStation || 1) * longestStation * (program.defaultWorkSeconds + program.defaultRestSeconds))
      + (Math.max(0, rotations - 1) * (program.transitionSeconds || 0));
  }
  return program.preparationSeconds + program.exercises.reduce(
    (sum, exercise) => sum + ((exercise.workSeconds + exercise.restSeconds) * exercise.rounds),
    0
  );
};

const programExerciseCount = (program: GroupWorkoutProgram) => program.mode === 'ROTATING_GROUPS'
  ? (program.stations || []).reduce((sum, station) => sum + station.exercises.length, 0)
  : program.exercises.length;

export const GroupWorkoutProgramManager: React.FC<GroupWorkoutProgramManagerProps> = ({
  activeUser,
  programs,
  onUpdatePrograms,
  trainees,
  sessions,
  equipment,
  traineeProfiles,
  memoryEntries,
  initialSessionId,
  onInitialSessionHandled,
  initialProgramId,
  initialAudience,
  onInitialProgramHandled
}) => {
  const [selectedProgramId, setSelectedProgramId] = useState(programs[0]?.id || '');
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [liveStatus, setLiveStatus] = useState<GroupWorkoutLiveStatus>();
  const [assistantInput, setAssistantInput] = useState('');
  const [isAssistantGenerating, setIsAssistantGenerating] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<string[]>([
    'בחרו תוכנית או צרו חדשה, ואז כתבו כיצד תרצו לבנות או לשנות את האימון.'
  ]);
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupAnswers, setSetupAnswers] = useState<WizardAnswers>({});
  const handledInitialAudienceRef = useRef('');
  const selectedProgram = programs.find(program => program.id === selectedProgramId);
  const groupSessions = useMemo(() => sessions
    .filter(session => !session.isPersonalTraining)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)), [sessions]);
  const selectedSession = sessions.find(session => session.id === selectedProgram?.sessionId);

  const participantsFromSession = (session: TrainingSession, existing: GroupWorkoutParticipant[] = [], groupCount = 1) => {
    const counts = Array.from({ length: Math.max(1, groupCount) }, () => 0);
    existing.filter(participant => session.registeredUsers.includes(participant.id)).forEach(participant => {
      const index = Math.min(Math.max(0, participant.groupIndex), counts.length - 1);
      counts[index] += 1;
    });
    return session.registeredUsers.map((userId, index) => {
      const trainee = trainees.find(user => user.id === userId);
      const previous = existing.find(participant => participant.id === userId);
      const groupIndex = previous
        ? Math.min(Math.max(0, previous.groupIndex), counts.length - 1)
        : counts.indexOf(Math.min(...counts));
      if (!previous) counts[groupIndex] += 1;
      return { id: userId, name: trainee?.name || previous?.name || `מתאמן ${index + 1}`, groupIndex };
    });
  };

  useEffect(() => {
    if (!selectedProgramId && programs[0]) setSelectedProgramId(programs[0].id);
    if (selectedProgramId && !programs.some(program => program.id === selectedProgramId)) {
      setSelectedProgramId(programs[0]?.id || '');
    }
  }, [programs, selectedProgramId]);

  useEffect(() => {
    if (selectedProgram?.sessionId) setSelectedSessionId(selectedProgram.sessionId);
  }, [selectedProgram?.id, selectedProgram?.sessionId]);

  useEffect(() => {
    if (!selectedProgramId) {
      setLiveStatus(undefined);
      return;
    }
    setLiveStatus(getGroupWorkoutStatus(selectedProgramId));
    return subscribeToGroupWorkoutStatus(selectedProgramId, setLiveStatus);
  }, [selectedProgramId]);

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [programs]
  );
  const templatePrograms = useMemo(() => programs.filter(program => !program.sessionId), [programs]);

  useEffect(() => {
    if (!selectedTemplateId && templatePrograms[0]) setSelectedTemplateId(templatePrograms[0].id);
    if (selectedTemplateId && !templatePrograms.some(program => program.id === selectedTemplateId)) setSelectedTemplateId(templatePrograms[0]?.id || '');
  }, [selectedTemplateId, templatePrograms]);

  const updateProgram = (changes: Partial<GroupWorkoutProgram>) => {
    if (!selectedProgram) return;
    onUpdatePrograms(programs.map(program => program.id === selectedProgram.id
      ? { ...program, ...changes, updatedAt: new Date().toISOString(), status: changes.status ?? 'DRAFT' }
      : program));
  };

  const createProgram = (sessionId = selectedSessionId, audienceName = '') => {
    const now = new Date().toISOString();
    const session = sessions.find(item => item.id === sessionId && !item.isPersonalTraining);
    const participants = session ? participantsFromSession(session) : [];
    const program: GroupWorkoutProgram = {
      id: `group-program-${Date.now()}`,
      sessionId: session?.id,
      sessionDate: session?.date,
      sessionTime: session?.time,
      groupName: session?.title || audienceName || 'קבוצה חדשה',
      title: session ? `תוכנית · ${session.title}` : audienceName ? `תוכנית · ${audienceName}` : 'אימון קבוצתי',
      description: '',
      coachId: activeUser.id,
      coachName: activeUser.name,
      exercises: [],
      mode: 'LINEAR',
      participantCount: participants.length || session?.maxParticipants || 12,
      participantGroupNames: ['קבוצה 1', 'קבוצה 2', 'קבוצה 3'],
      participants,
      stations: [],
      roundsPerStation: 3,
      transitionSeconds: 30,
      defaultWorkSeconds: 40,
      defaultRestSeconds: 20,
      preparationSeconds: 10,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now
    };
    onUpdatePrograms([program, ...programs]);
    setSelectedProgramId(program.id);
    setSetupAnswers({});
    setSetupComplete(false);
    if (session) setSelectedSessionId(session.id);
  };

  const assignTemplateToSession = (templateId: string, sessionId: string) => {
    const template = programs.find(program => program.id === templateId && !program.sessionId);
    const session = sessions.find(item => item.id === sessionId && !item.isPersonalTraining);
    if (!template || !session) return;
    const now = new Date().toISOString();
    const participants = participantsFromSession(session, [], (template.stations || []).length || 1);
    const assigned: GroupWorkoutProgram = {
      ...template,
      id: `group-program-${Date.now()}`,
      sessionId: session.id,
      sessionDate: session.date,
      sessionTime: session.time,
      groupName: session.title,
      title: template.title,
      exercises: template.exercises.map((exercise, index) => ({ ...exercise, id: `group-exercise-${Date.now()}-${index}` })),
      stations: (template.stations || []).map((station, stationIndex) => ({
        ...station,
        id: `group-station-${Date.now()}-${stationIndex}`,
        exercises: station.exercises.map((exercise, exerciseIndex) => ({ ...exercise, id: `group-station-exercise-${Date.now()}-${stationIndex}-${exerciseIndex}` }))
      })),
      participants,
      participantCount: participants.length,
      createdAt: now,
      updatedAt: now,
      publishedAt: template.status === 'PUBLISHED' ? now : undefined
    };
    onUpdatePrograms([assigned, ...programs]);
    setSelectedProgramId(assigned.id);
    setSetupAnswers({ sourceMode: 'LIBRARY', templateId });
    setSetupComplete(false);
    setSelectedSessionId(session.id);
  };

  useEffect(() => {
    if (!initialSessionId) return;
    setSelectedSessionId(initialSessionId);
    const existingProgram = programs.find(program => program.sessionId === initialSessionId);
    if (existingProgram) setSelectedProgramId(existingProgram.id);
    else createProgram(initialSessionId);
    onInitialSessionHandled?.();
  }, [initialSessionId]);

  useEffect(() => {
    if (!initialProgramId) return;
    if (programs.some(program => program.id === initialProgramId)) setSelectedProgramId(initialProgramId);
    onInitialProgramHandled?.();
  }, [initialProgramId]);

  useEffect(() => {
    if (!initialAudience || handledInitialAudienceRef.current === initialAudience) return;
    handledInitialAudienceRef.current = initialAudience;
    setSelectedSessionId('');
    createProgram('', initialAudience === 'קבוצה מותאמת' ? 'קבוצה חדשה' : initialAudience);
    onInitialProgramHandled?.();
  }, [initialAudience]);

  useEffect(() => {
    if (!selectedProgram?.sessionId) return;
    const session = sessions.find(item => item.id === selectedProgram.sessionId);
    if (!session) return;
    const participants = participantsFromSession(session, selectedProgram.participants || [], (selectedProgram.stations || []).length || 1);
    const current = selectedProgram.participants || [];
    const changed = participants.length !== current.length || participants.some((participant, index) => {
      const previous = current[index];
      return !previous || previous.id !== participant.id || previous.name !== participant.name || previous.groupIndex !== participant.groupIndex;
    });
    if (!changed && selectedProgram.sessionDate === session.date && selectedProgram.sessionTime === session.time && selectedProgram.groupName === session.title) return;
    onUpdatePrograms(programs.map(program => program.id === selectedProgram.id ? {
      ...program,
      sessionDate: session.date,
      sessionTime: session.time,
      groupName: session.title,
      participantCount: participants.length,
      participants,
      updatedAt: new Date().toISOString()
    } : program));
  }, [selectedProgram?.id, selectedProgram?.sessionId, sessions, trainees]);

  const linkSelectedProgramToSession = (sessionId: string) => {
    if (!selectedProgram) return;
    if (!sessionId) {
      updateProgram({ sessionId: undefined, sessionDate: undefined, sessionTime: undefined, participants: [], participantCount: 0 });
      setSelectedSessionId('');
      return;
    }
    if (!selectedProgram.sessionId) {
      assignTemplateToSession(selectedProgram.id, sessionId);
      return;
    }
    const session = sessions.find(item => item.id === sessionId && !item.isPersonalTraining);
    if (!session) return;
    const participants = participantsFromSession(session, selectedProgram.participants || [], (selectedProgram.stations || []).length || 1);
    setSelectedSessionId(session.id);
    updateProgram({
      sessionId: session.id,
      sessionDate: session.date,
      sessionTime: session.time,
      groupName: session.title,
      participantCount: participants.length,
      participants
    });
  };

  const duplicateProgram = (program: GroupWorkoutProgram) => {
    const now = new Date().toISOString();
    const duplicate: GroupWorkoutProgram = {
      ...program,
      id: `group-program-${Date.now()}`,
      sessionId: undefined,
      sessionDate: undefined,
      sessionTime: undefined,
      groupName: `${program.groupName} – עותק`,
      exercises: program.exercises.map((exercise, index) => ({ ...exercise, id: `group-exercise-${Date.now()}-${index}` })),
      stations: (program.stations || []).map((station, stationIndex) => ({
        ...station,
        id: `group-station-${Date.now()}-${stationIndex}`,
        exercises: station.exercises.map((exercise, exerciseIndex) => ({ ...exercise, id: `group-station-exercise-${Date.now()}-${stationIndex}-${exerciseIndex}` }))
      })),
      coachId: activeUser.id,
      coachName: activeUser.name,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
      publishedAt: undefined
    };
    onUpdatePrograms([duplicate, ...programs]);
    setSelectedProgramId(duplicate.id);
  };

  const deleteProgram = (program: GroupWorkoutProgram) => {
    if (!window.confirm(`למחוק את התוכנית “${program.groupName}”?`)) return;
    onUpdatePrograms(programs.filter(item => item.id !== program.id));
  };

  const addExercise = () => {
    if (!selectedProgram) return;
    updateProgram({
      exercises: [
        ...selectedProgram.exercises,
        createExercise(selectedProgram.exercises.length, selectedProgram.defaultWorkSeconds, selectedProgram.defaultRestSeconds)
      ]
    });
  };

  const updateExercise = (exerciseId: string, changes: Partial<GroupWorkoutExercise>) => {
    if (!selectedProgram) return;
    updateProgram({
      exercises: selectedProgram.exercises.map(exercise => exercise.id === exerciseId
        ? {
            ...exercise,
            ...changes,
            workDuration: changes.workSeconds !== undefined ? `${changes.workSeconds} שניות` : exercise.workDuration,
            restDuration: changes.restSeconds !== undefined ? `${changes.restSeconds} שניות` : exercise.restDuration
          }
        : exercise)
    });
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    if (!selectedProgram) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedProgram.exercises.length) return;
    const exercises = [...selectedProgram.exercises];
    [exercises[index], exercises[nextIndex]] = [exercises[nextIndex], exercises[index]];
    updateProgram({ exercises });
  };

  const enableRotatingGroups = () => {
    if (!selectedProgram) return;
    if (selectedProgram.mode === 'ROTATING_GROUPS') return;
    const existingExercises = selectedProgram.exercises;
    const stations: GroupWorkoutStation[] = Array.from({ length: 3 }, (_, index) => ({
      id: `group-station-${Date.now()}-${index}`,
      name: `תחנה ${index + 1}`,
      exercises: index === 0 ? existingExercises.map(exercise => ({
        ...exercise,
        workSeconds: selectedProgram.defaultWorkSeconds,
        restSeconds: selectedProgram.defaultRestSeconds,
        rounds: 1
      })) : []
    }));
    updateProgram({
      mode: 'ROTATING_GROUPS',
      stations,
      participantCount: selectedProgram.participantCount || 12,
      participantGroupNames: ['קבוצה 1', 'קבוצה 2', 'קבוצה 3'],
      participants: (selectedProgram.participants || []).map((participant, index) => ({ ...participant, groupIndex: index % 3 })),
      roundsPerStation: selectedProgram.roundsPerStation || 3,
      transitionSeconds: selectedProgram.transitionSeconds ?? 30
    });
  };

  const addStation = () => {
    if (!selectedProgram) return;
    const stations = selectedProgram.stations || [];
    const nextNumber = stations.length + 1;
    updateProgram({
      stations: [...stations, { id: `group-station-${Date.now()}`, name: `תחנה ${nextNumber}`, exercises: [] }],
      participantGroupNames: [...(selectedProgram.participantGroupNames || []), `קבוצה ${nextNumber}`]
    });
  };

  const updateParticipantGroup = (participantId: string, groupIndex: number) => {
    if (!selectedProgram) return;
    updateProgram({ participants: (selectedProgram.participants || []).map(participant => participant.id === participantId ? { ...participant, groupIndex } : participant) });
  };

  const storeExerciseMedia = async (exercise: GroupWorkoutExercise, file: File, onStored: (changes: Partial<GroupWorkoutExercise>) => void) => {
    if (file.size > 15 * 1024 * 1024) {
      window.alert('גודל קובץ ההדגמה המרבי הוא 15MB.');
      return;
    }
    const mediaStorageId = `exercise-media-${exercise.id}-${Date.now()}`;
    try {
      await saveExerciseMedia(mediaStorageId, file);
      if (exercise.mediaStorageId) void deleteExerciseMedia(exercise.mediaStorageId).catch(() => undefined);
      onStored({
        mediaStorageId,
        mediaType: file.type === 'image/gif' ? 'GIF' : file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
      });
    } catch {
      window.alert('לא ניתן היה לשמור את קובץ ההדגמה במכשיר.');
    }
  };

  const updateStation = (stationId: string, changes: Partial<GroupWorkoutStation>) => {
    if (!selectedProgram) return;
    updateProgram({ stations: (selectedProgram.stations || []).map(station => station.id === stationId ? { ...station, ...changes } : station) });
  };

  const deleteStation = (stationId: string) => {
    if (!selectedProgram) return;
    const nextStations = (selectedProgram.stations || []).filter(station => station.id !== stationId);
    updateProgram({
      stations: nextStations,
      participantGroupNames: (selectedProgram.participantGroupNames || []).slice(0, nextStations.length)
    });
  };

  const addStationExercise = (station: GroupWorkoutStation) => {
    if (!selectedProgram) return;
    updateStation(station.id, {
      exercises: [...station.exercises, createExercise(station.exercises.length, selectedProgram.defaultWorkSeconds, selectedProgram.defaultRestSeconds)]
    });
  };

  const updateStationExercise = (station: GroupWorkoutStation, exerciseId: string, changes: Partial<GroupWorkoutExercise>) => {
    updateStation(station.id, {
      exercises: station.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, ...changes } : exercise)
    });
  };

  const openDisplay = (program: GroupWorkoutProgram) => {
    const displayUrl = `${window.location.origin}${window.location.pathname}#group-workout-display=${encodeURIComponent(program.id)}`;
    window.open(displayUrl, '_blank', 'noopener,noreferrer');
  };

  const publishProgram = () => {
    if (!selectedProgram) return;
    const exercises = selectedProgram.mode === 'ROTATING_GROUPS'
      ? (selectedProgram.stations || []).flatMap(station => station.exercises)
      : selectedProgram.exercises;
    if (exercises.length === 0 || exercises.some(exercise => !exercise.name.trim())) return;
    updateProgram({ status: 'PUBLISHED', publishedAt: new Date().toISOString() });
  };

  const runAssistantCommand = async (request: string) => {
    if (!selectedProgram) {
      setAssistantMessages(messages => [...messages, 'יש לבחור תוכנית קיימת או ליצור תוכנית חדשה לפני ביצוע השינוי.']);
      return;
    }
    if (isAssistantGenerating) return;
    const coachLine = `מאמן: ${request.trim()}`;
    setAssistantMessages(messages => [...messages, coachLine].slice(-8));
    setIsAssistantGenerating(true);
    try {
      const linkedSession = sessions.find(session => session.id === selectedProgram.sessionId);
      const participantIds = selectedProgram.participants?.map(participant => participant.id)
        || linkedSession?.registeredUsers
        || [];
      const groupParticipants = participantIds
        .map(id => trainees.find(trainee => trainee.id === id))
        .filter((trainee): trainee is User => Boolean(trainee))
        .map(trainee => ({
          user: { id: trainee.id, name: trainee.name, age: trainee.age, gender: trainee.gender },
          professionalProfile: traineeProfiles.find(profile => profile.traineeId === trainee.id),
          confirmedMemory: memoryEntries.filter(entry => entry.traineeId === trainee.id && entry.confirmed)
        }));
      const conversation = assistantMessages.map(message => ({
        role: message.startsWith('מאמן:') ? 'COACH' as const : 'ASSISTANT' as const,
        content: message.replace(/^מאמן:\s*/, '')
      }));
      const { result } = await generateGroupWorkoutWithAi({
        message: request,
        actor: activeUser,
        equipment: equipment.filter(item => item.status !== 'OUT_OF_SERVICE' && item.quantity > 0),
        conversation: [...conversation, { role: 'COACH', content: request }],
        currentDraft: selectedProgram,
        groupParticipants
      });
      const createAiExercise = (exercise: typeof result.exercises[number], index: number, prefix: string): GroupWorkoutExercise => {
        const existing = (selectedProgram.mode === 'ROTATING_GROUPS'
          ? (selectedProgram.stations || []).flatMap(station => station.exercises)
          : selectedProgram.exercises
        ).find(item => item.name === exercise.name);
        return {
          ...exercise,
          name: exercise.name.trim() || `תרגיל ${index + 1}`,
          sets: Math.min(20, Math.max(1, Math.round(exercise.sets || 1))),
          dayNumber: 1,
          workSeconds: Math.min(900, Math.max(5, Math.round(exercise.workSeconds || result.defaultWorkSeconds || 40))),
          restSeconds: Math.min(900, Math.max(0, Math.round(exercise.restSeconds ?? result.defaultRestSeconds ?? 20))),
          rounds: Math.min(20, Math.max(1, Math.round(exercise.rounds || 1))),
          id: existing?.id || `${prefix}-${Date.now()}-${index}`,
          mediaUrl: existing?.mediaUrl,
          mediaType: existing?.mediaType,
          mediaStorageId: existing?.mediaStorageId
        };
      };
      const updatedProgram: GroupWorkoutProgram = {
        ...selectedProgram,
        title: result.title,
        description: result.description,
        mode: result.mode,
        participantCount: Math.min(100, Math.max(1, Math.round(result.participantCount || selectedProgram.participantCount || 1))),
        defaultWorkSeconds: Math.min(900, Math.max(5, Math.round(result.defaultWorkSeconds || 40))),
        defaultRestSeconds: Math.min(900, Math.max(0, Math.round(result.defaultRestSeconds || 0))),
        preparationSeconds: Math.min(900, Math.max(0, Math.round(result.preparationSeconds || 0))),
        roundsPerStation: Math.min(20, Math.max(1, Math.round(result.roundsPerStation || 1))),
        transitionSeconds: Math.min(900, Math.max(0, Math.round(result.transitionSeconds || 0))),
        exercises: result.mode === 'LINEAR'
          ? result.exercises.slice(0, 60).map((exercise, index) => createAiExercise(exercise, index, 'group-ai-exercise'))
          : [],
        stations: result.mode === 'ROTATING_GROUPS'
          ? result.stations.slice(0, 12).map((station, stationIndex) => ({
              id: selectedProgram.stations?.[stationIndex]?.id || `group-ai-station-${Date.now()}-${stationIndex}`,
              name: station.name,
              exercises: station.exercises.slice(0, 30).map((exercise, index) => createAiExercise(exercise, index, `group-ai-station-${stationIndex}`))
            }))
          : [],
        participantGroupNames: result.mode === 'ROTATING_GROUPS'
          ? result.stations.slice(0, 12).map((_, index) => selectedProgram.participantGroupNames?.[index] || `קבוצה ${index + 1}`)
          : selectedProgram.participantGroupNames,
        status: 'DRAFT',
        updatedAt: new Date().toISOString()
      };
      onUpdatePrograms(programs.map(program => program.id === updatedProgram.id ? updatedProgram : program));
      setAssistantMessages(messages => [...messages, result.assistantMessage].slice(-8));
    } catch (error) {
      setAssistantMessages(messages => [...messages, error instanceof Error ? error.message : 'שירות ה־AI אינו זמין כרגע.'].slice(-8));
    } finally {
      setIsAssistantGenerating(false);
    }
  };

  const submitAssistant = (event: React.FormEvent) => {
    event.preventDefault();
    const request = assistantInput.trim();
    if (!request) return;
    setAssistantInput('');
    void runAssistantCommand(request);
  };

  const setupQuestions: WizardQuestion[] = [
    { id: 'title', label: 'שם האימון', type: 'text', required: true, placeholder: 'לדוגמה: כוח וסבולת – ערב' },
    { id: 'groupName', label: 'שם הקבוצה', type: 'text', required: true, placeholder: 'לדוגמה: אימון בנים ערב' },
    { id: 'durationMinutes', label: 'משך האימון בדקות', type: 'number', required: true, min: 15, max: 180 },
    { id: 'trainingType', label: 'סוג האימון', type: 'select', required: true, options: ['כוח', 'פונקציונלי', 'סבולת', 'Tabata', 'תחנות', 'משולב'].map(value => ({ value, label: value })) },
    { id: 'mode', label: 'מבנה האימון', type: 'choice', required: true, options: [{ value: 'LINEAR', label: 'רצף משותף', description: 'כל הקבוצה מבצעת אותו רצף' }, { value: 'ROTATING_GROUPS', label: 'תתי־קבוצות', description: 'תחנות מתחלפות בזמנים משותפים' }] },
    { id: 'subgroupCount', label: 'כמה תתי־קבוצות / תחנות?', type: 'number', required: true, min: 2, max: 12, visibleWhen: answers => answers.mode === 'ROTATING_GROUPS' },
    { id: 'exerciseCount', label: 'כמה תרגילים בסך הכול?', type: 'number', required: true, min: 1, max: 60 },
    { id: 'rounds', label: 'כמה מחזורים / סבבים?', type: 'number', required: true, min: 1, max: 20 },
    { id: 'workSeconds', label: 'זמן עבודה בשניות', type: 'number', required: true, min: 5, max: 900 },
    { id: 'restSeconds', label: 'זמן מנוחה בשניות', type: 'number', required: true, min: 0, max: 900 },
    { id: 'transitionSeconds', label: 'זמן מעבר בין תחנות', type: 'number', min: 0, max: 900, visibleWhen: answers => answers.mode === 'ROTATING_GROUPS' },
    { id: 'sourceMode', label: 'לבנות חדשה או להתחיל מהמאגר?', type: 'choice', required: true, options: [{ value: 'NEW', label: 'חדשה' }, { value: 'LIBRARY', label: 'מהמאגר' }] },
    { id: 'templateId', label: 'בחירת תוכנית מהמאגר', type: 'select', required: true, visibleWhen: answers => answers.sourceMode === 'LIBRARY', options: templatePrograms.filter(program => program.id !== selectedProgramId).map(program => ({ value: program.id, label: `${program.title} · ${programExerciseCount(program)} תרגילים` })) },
    { id: 'notes', label: 'מטרה ודגשים למאמן', type: 'textarea', placeholder: 'ציוד, רמה, מגבלות או דגש מיוחד' }
  ];

  const completeSetup = (answers: WizardAnswers) => {
    if (!selectedProgram) return;
    const template = answers.sourceMode === 'LIBRARY' ? programs.find(program => program.id === answers.templateId) : undefined;
    const mode = String(answers.mode || selectedProgram.mode || 'LINEAR') as 'LINEAR' | 'ROTATING_GROUPS';
    const count = Math.min(60, Math.max(1, Number(answers.exerciseCount || 1)));
    const subgroupCount = Math.min(12, Math.max(2, Number(answers.subgroupCount || 3)));
    const work = Number(answers.workSeconds || 40);
    const rest = Number(answers.restSeconds || 20);
    const blankExercises = Array.from({ length: count }, (_, index) => createExercise(index, work, rest));
    const stations: GroupWorkoutStation[] = mode === 'ROTATING_GROUPS'
      ? Array.from({ length: subgroupCount }, (_, stationIndex) => ({
          id: `setup-station-${Date.now()}-${stationIndex}`,
          name: `תחנה ${stationIndex + 1}`,
          exercises: blankExercises.filter((_, index) => index % subgroupCount === stationIndex)
        }))
      : [];
    const now = new Date().toISOString();
    const updated: GroupWorkoutProgram = {
      ...selectedProgram,
      title: String(answers.title || selectedProgram.title),
      groupName: String(answers.groupName || selectedProgram.groupName),
      description: [String(answers.trainingType || ''), String(answers.notes || ''), `משך מתוכנן: ${answers.durationMinutes || 60} דקות`].filter(Boolean).join(' · '),
      mode: template?.mode || mode,
      exercises: template ? template.exercises.map((exercise, index) => ({ ...exercise, id: `group-template-ex-${Date.now()}-${index}` })) : mode === 'LINEAR' ? blankExercises : [],
      stations: template ? (template.stations || []).map((station, stationIndex) => ({ ...station, id: `group-template-station-${Date.now()}-${stationIndex}`, exercises: station.exercises.map((exercise, index) => ({ ...exercise, id: `group-template-station-ex-${Date.now()}-${stationIndex}-${index}` })) })) : stations,
      participantGroupNames: mode === 'ROTATING_GROUPS' ? Array.from({ length: subgroupCount }, (_, index) => `קבוצה ${index + 1}`) : selectedProgram.participantGroupNames,
      roundsPerStation: Number(answers.rounds || 3),
      defaultWorkSeconds: work,
      defaultRestSeconds: rest,
      transitionSeconds: Number(answers.transitionSeconds || 30),
      status: 'DRAFT',
      updatedAt: now
    };
    onUpdatePrograms(programs.map(program => program.id === updated.id ? updated : program));
    setAssistantMessages([`קיבלתי את שאלון הפתיחה: ${answers.trainingType}, ${answers.durationMinutes} דקות, ${count} תרגילים ו־${answers.rounds} סבבים. כתוב “בנה תוכנית אימון” ואמלא את התרגילים; אחר כך אפשר לבקש שינויים או לערוך כל תרגיל ישירות.`]);
    setSetupAnswers(answers);
    setSetupComplete(true);
  };

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-300"><UsersRound size={20} /><span className="text-sm font-extrabold">אימוני קבוצות</span></div>
            <h2 className="text-2xl font-black">מנהל תוכניות אימון קבוצתיות</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">בנו את סדר האימון, הגדירו זמני עבודה ומנוחה ופתחו מסך נקי להצגה למאמן או על מסך המועדון.</p>
          </div>
          <button onClick={() => { setSelectedSessionId(''); createProgram(''); }} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-black text-white hover:bg-indigo-400"><Plus size={18} /> תוכנית חדשה למאגר</button>
        </div>
      </div>

      {selectedProgram && !setupComplete ? <ProgramSetupWizard
        title="שאלון פתיחה לאימון הקבוצתי"
        description="הגדרת הבסיס פעם אחת. לאחר מכן הצ׳אט יבנה את התרגילים והתחנות, וכל פרט יישאר ניתן לעריכה ישירה."
        questions={setupQuestions}
        initialAnswers={{
          title: selectedProgram.title,
          groupName: selectedProgram.groupName,
          durationMinutes: 60,
          trainingType: 'כוח',
          mode: selectedProgram.mode || 'LINEAR',
          subgroupCount: Math.max(2, selectedProgram.stations?.length || 3),
          exerciseCount: Math.max(1, programExerciseCount(selectedProgram) || 12),
          rounds: selectedProgram.roundsPerStation || 3,
          workSeconds: selectedProgram.defaultWorkSeconds || 40,
          restSeconds: selectedProgram.defaultRestSeconds || 20,
          transitionSeconds: selectedProgram.transitionSeconds || 30,
          sourceMode: 'NEW',
          notes: selectedProgram.description,
          ...setupAnswers
        }}
        onComplete={completeSetup}
      /> : <>
      {selectedProgram && setupComplete && <ProgramBriefPanel title="תקציר האימון הקבוצתי" onEdit={() => setSetupComplete(false)} items={[
        { label: 'שם', value: setupAnswers.title },
        { label: 'קבוצה', value: setupAnswers.groupName },
        { label: 'סוג', value: setupAnswers.trainingType },
        { label: 'משך', value: `${setupAnswers.durationMinutes || 60} דקות` },
        { label: 'מבנה', value: setupAnswers.mode === 'ROTATING_GROUPS' ? 'תתי־קבוצות ותחנות' : 'רצף משותף' },
        { label: 'תרגילים', value: setupAnswers.exerciseCount },
        { label: 'סבבים', value: setupAnswers.rounds }
      ]} />}
      <section className="rounded-2xl border border-amber-400/25 bg-zinc-900 p-4 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="rounded-xl bg-amber-400/15 p-2 text-amber-300"><MessageCircle size={19} /></span><div><h3 className="text-sm font-black text-white">עוזר בניית אימון קבוצתי</h3><p className="text-[10px] text-zinc-400">הצ׳אט מעדכן את הטיוטה, והמאמן מאשר ומפרסם</p></div></div>
          <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-black text-emerald-300">OpenAI</span>
        </div>
        <div className="mt-3 max-h-40 space-y-2 overflow-auto rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          {assistantMessages.map((message, index) => <p key={`${index}-${message}`} className={`rounded-lg px-3 py-2 text-xs leading-5 ${message.startsWith('מאמן:') ? 'mr-8 bg-amber-400 text-zinc-950' : 'ml-5 bg-zinc-800 text-zinc-200'}`}>{message}</p>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['בנה אימון כוח עם 12 תרגילים ב־3 תחנות', 'החלף סקוואט במכרעים', 'הוסף פלאנק לתחנה 2', 'מנוחה 30 שניות'].map(suggestion => <button key={suggestion} type="button" disabled={isAssistantGenerating} onClick={() => void runAssistantCommand(suggestion)} className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[10px] font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40">{suggestion}</button>)}
        </div>
        <form onSubmit={submitAssistant} className="mt-3 flex gap-2">
          <input value={assistantInput} onChange={event => setAssistantInput(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-white placeholder:text-zinc-500" placeholder="לדוגמה: בנה אימון כוח עם 12 תרגילים ב־3 תחנות" />
          <button type="submit" disabled={!assistantInput.trim() || isAssistantGenerating} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-xs font-black text-zinc-950 disabled:opacity-40"><Send size={15} /> {isAssistantGenerating ? 'חושב...' : 'שלח'}</button>
        </form>
      </section>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-white shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="min-w-0 flex-1 text-xs font-black text-zinc-200">בחרו אימון מהיומן
            <select value={selectedSessionId} onChange={event => setSelectedSessionId(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-bold text-white">
              <option value="">בחר אימון קבוצתי...</option>
              {groupSessions.map(session => <option key={session.id} value={session.id}>{session.date} · {session.time} · {session.title} ({session.registeredUsers.length} נרשמים)</option>)}
            </select>
          </label>
          <label className="min-w-0 flex-1 text-xs font-black text-zinc-200">תוכנית מוכנה מהמאגר
            <select value={selectedTemplateId} onChange={event => setSelectedTemplateId(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-bold text-white">
              <option value="">ללא תבנית — אימון חדש</option>
              {templatePrograms.map(program => <option key={program.id} value={program.id}>{program.title} · {programExerciseCount(program)} תרגילים</option>)}
            </select>
          </label>
          <button onClick={() => {
            const existing = programs.find(program => program.sessionId === selectedSessionId);
            if (existing) setSelectedProgramId(existing.id);
            else if (selectedTemplateId) assignTemplateToSession(selectedTemplateId, selectedSessionId);
            else createProgram(selectedSessionId);
          }} disabled={!selectedSessionId} className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-40">{programs.some(program => program.sessionId === selectedSessionId) ? 'פתח תוכנית קיימת' : selectedTemplateId ? 'שבץ עותק מהמאגר' : 'צור תוכנית חדשה'}</button>
          <button onClick={() => { setSelectedSessionId(''); createProgram(''); }} className="rounded-xl border border-zinc-600 bg-zinc-800 px-5 py-3 text-sm font-black text-zinc-100">צור תוכנית למאגר</button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">אפשר להכין מראש מאגר לשבוע או לחודש. השיבוץ יוצר עותק נפרד לאירוע ורשימת המתאמנים מגיעה אוטומטית מהיומן.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="px-2 pb-3 text-sm font-black text-slate-800">מאגר ותוכניות משובצות</h3>
          <div className="space-y-2">
            {sortedPrograms.map(program => (
              <button key={program.id} onClick={() => setSelectedProgramId(program.id)} className={`w-full rounded-xl border p-3 text-right transition ${selectedProgramId === program.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-900">{program.groupName}</strong><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${program.sessionId ? 'bg-indigo-100 text-indigo-700' : 'bg-fuchsia-100 text-fuchsia-700'}`}>{program.sessionId ? 'משובץ ביומן' : 'במאגר'}</span></div>
                <p className="mt-1 truncate text-xs text-slate-500">{program.title}</p>
                <p className="mt-2 text-[10px] text-slate-400">{program.sessionDate ? `${program.sessionDate} · ${program.sessionTime} · ` : ''}{programExerciseCount(program)} תרגילים · {formatDuration(totalProgramSeconds(program))}</p>
              </button>
            ))}
            {programs.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">עדיין לא נבנתה תוכנית קבוצתית.</div>}
          </div>
        </aside>

        {selectedProgram ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div><h3 className="text-lg font-black text-slate-900">פרטי הקבוצה והאימון</h3><p className="text-xs text-slate-500">השינויים נשמרים אוטומטית במכשיר</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => duplicateProgram(selectedProgram)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Copy size={14} /> שכפול</button>
                  <button onClick={() => deleteProgram(selectedProgram)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} /> מחיקה</button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="md:col-span-2 text-xs font-bold text-slate-700">אימון מקושר ביומן
                  <select value={selectedProgram.sessionId || ''} onChange={event => linkSelectedProgramToSession(event.target.value)} className="mt-1 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 font-normal">
                    <option value="">ללא קישור ליומן</option>{groupSessions.map(session => <option key={session.id} value={session.id}>{session.date} · {session.time} · {session.title} · {session.registeredUsers.length} נרשמים</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">שם הקבוצה<input value={selectedProgram.groupName} onChange={event => updateProgram({ groupName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="לדוגמה: אימון בנים ערב" /></label>
                <label className="text-xs font-bold text-slate-700">שם האימון<input value={selectedProgram.title} onChange={event => updateProgram({ title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="לדוגמה: כוח וסבולת – יום ראשון" /></label>
                <label className="md:col-span-2 text-xs font-bold text-slate-700">דגשים למאמן<textarea value={selectedProgram.description} onChange={event => updateProgram({ description: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="מטרת האימון, התאמות ודגשים לקבוצה" /></label>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[10px] font-black text-slate-600">מבנה האימון</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateProgram({ mode: 'LINEAR' })} className={`rounded-lg border px-3 py-2 text-xs font-black ${selectedProgram.mode !== 'ROTATING_GROUPS' ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}>רצף אחד לכל הקבוצה</button>
                  <button onClick={enableRotatingGroups} className={`rounded-lg border px-3 py-2 text-xs font-black ${selectedProgram.mode === 'ROTATING_GROUPS' ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}>תחנות ותתי־קבוצות מתחלפות</button>
                </div>
              </div>
              <div className={`mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 ${selectedProgram.mode === 'ROTATING_GROUPS' ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-3'}`}>
                <label className="text-[10px] font-bold text-slate-600">הכנה לפני התחלה<input type="number" min={0} max={120} value={selectedProgram.preparationSeconds} onChange={event => updateProgram({ preparationSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                <label className="text-[10px] font-bold text-slate-600">זמן עבודה משותף<input type="number" min={5} max={600} value={selectedProgram.defaultWorkSeconds} onChange={event => updateProgram({ defaultWorkSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                <label className="text-[10px] font-bold text-slate-600">זמן מנוחה משותף<input type="number" min={0} max={300} value={selectedProgram.defaultRestSeconds} onChange={event => updateProgram({ defaultRestSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                {selectedProgram.mode === 'ROTATING_GROUPS' && <>
                  <label className="text-[10px] font-bold text-slate-600">מספר נרשמים<input type="number" min={0} max={100} disabled={!!selectedProgram.sessionId} value={selectedProgram.participantCount || 0} onChange={event => updateProgram({ participantCount: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs disabled:bg-slate-100" /></label>
                  <label className="text-[10px] font-bold text-slate-600">סבבים בכל תחנה<input type="number" min={1} max={20} value={selectedProgram.roundsPerStation || 3} onChange={event => updateProgram({ roundsPerStation: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                  <label className="text-[10px] font-bold text-slate-600">זמן החלפת תחנה<input type="number" min={0} max={300} value={selectedProgram.transitionSeconds ?? 30} onChange={event => updateProgram({ transitionSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                </>}
              </div>
            </div>

            {selectedProgram.mode === 'ROTATING_GROUPS' ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><UsersRound size={19} className="text-indigo-600" /> תחנות ותתי־קבוצות</h3><p className="mt-1 text-xs text-slate-500">{(selectedProgram.participants || []).length || selectedProgram.participantCount || 0} משתתפים · {(selectedProgram.stations || []).length} תתי־קבוצות · כ־{Math.ceil(((selectedProgram.participants || []).length || selectedProgram.participantCount || 0) / Math.max(1, (selectedProgram.stations || []).length))} אנשים בקבוצה</p></div>
                  <button onClick={addStation} className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white"><Plus size={15} /> הוסף תת־קבוצה / תחנה</button>
                </div>
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-black text-slate-900">שיבוץ מהיר לפני האימון</h4><p className="mt-1 text-[10px] text-slate-600">המתאמנים נטענים מהיומן. בנייד פשוט לוחצים על הקבוצה הרצויה ליד כל שם.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">{(selectedProgram.participants || []).length} נרשמים</span></div>
                  {!selectedProgram.sessionId && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">יש לקשר את התוכנית לאימון ביומן כדי לטעון את הנרשמים אוטומטית.</div>}
                  {selectedSession && <div className="mb-3 rounded-xl bg-white p-3 text-xs text-slate-700"><strong>{selectedSession.title}</strong> · {selectedSession.date} בשעה {selectedSession.time} · {selectedSession.registeredUsers.length}/{selectedSession.maxParticipants} נרשמים</div>}
                  <div className="grid gap-2 lg:grid-cols-2">
                    {(selectedProgram.participants || []).map((participant, participantIndex) => (
                      <div key={participant.id} className="rounded-xl border border-emerald-100 bg-white p-2.5">
                        <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">{participantIndex + 1}</span><strong className="min-w-0 flex-1 truncate text-sm text-slate-800">{participant.name}</strong></div>
                        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">{(selectedProgram.stations || []).map((station, index) => <button key={station.id} onClick={() => updateParticipantGroup(participant.id, index)} className={`rounded-lg border px-2 py-2 text-[10px] font-black ${participant.groupIndex === index ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{(selectedProgram.participantGroupNames || [])[index] || `קבוצה ${index + 1}`}</button>)}</div>
                      </div>
                    ))}
                    {selectedProgram.sessionId && (selectedProgram.participants || []).length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500 lg:col-span-2">עדיין אין נרשמים לאימון. הרשימה תתעדכן אוטומטית לאחר הרשמה ביומן.</div>}
                  </div>
                </div>
                <div className="grid gap-4 2xl:grid-cols-2">
                  {(selectedProgram.stations || []).map((station, stationIndex) => (
                    <article key={station.id} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">{stationIndex + 1}</span>
                        <input value={station.name} onChange={event => updateStation(station.id, { name: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-black" />
                        <button onClick={() => deleteStation(station.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                      </div>
                      <label className="mb-3 block text-[10px] font-bold text-slate-600">שם קבוצת המתאמנים שמתחילה כאן<input value={(selectedProgram.participantGroupNames || [])[stationIndex] || `קבוצה ${stationIndex + 1}`} onChange={event => {
                        const names = [...(selectedProgram.participantGroupNames || [])];
                        names[stationIndex] = event.target.value;
                        updateProgram({ participantGroupNames: names });
                      }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" /></label>
                      <div className="space-y-2">
                        {station.exercises.map((exercise, exerciseIndex) => (
                          <div key={exercise.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-2"><span className="text-xs font-black text-indigo-600">{exerciseIndex + 1}</span><input value={exercise.name} onChange={event => updateStationExercise(station, exercise.id, { name: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold" placeholder="שם התרגיל" /><button onClick={() => updateStation(station.id, { exercises: station.exercises.filter(item => item.id !== exercise.id) })} className="text-red-500"><Trash2 size={14} /></button></div>
                            <div className="mt-2 grid grid-cols-2 gap-2"><input value={exercise.weight || exercise.reps} onChange={event => updateStationExercise(station, exercise.id, { weight: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]" placeholder="חזרות / משקל" /><input value={exercise.notes || ''} onChange={event => updateStationExercise(station, exercise.id, { notes: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]" placeholder="דגש למאמן" /></div>
                            <div className="mt-2 grid grid-cols-[90px_minmax(0,1fr)] gap-2"><select value={exercise.mediaType || 'VIDEO'} onChange={event => updateStationExercise(station, exercise.id, { mediaType: event.target.value as GroupWorkoutExercise['mediaType'] })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]"><option value="VIDEO">סרטון</option><option value="GIF">GIF</option><option value="IMAGE">תמונה</option></select><input value={exercise.mediaUrl || ''} onChange={event => updateStationExercise(station, exercise.id, { mediaUrl: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]" placeholder="קישור למדיה (אופציונלי)" /></div>
                            {(exercise.mediaUrl || exercise.mediaStorageId) && <ExerciseMedia exercise={exercise} compact controls className="mt-2 border-slate-200" />}
                            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-[10px] font-black text-fuchsia-700"><ImagePlus size={14} /> {exercise.mediaUrl || exercise.mediaStorageId ? 'החלף תמונה / GIF / סרטון' : 'העלה תמונה / GIF / סרטון'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void storeExerciseMedia(exercise, file, changes => updateStationExercise(station, exercise.id, changes)); event.target.value = ''; }} /></label>
                          </div>
                        ))}
                        <button onClick={() => addStationExercise(station)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-300 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"><Plus size={14} /> הוסף תרגיל לשרשרת</button>
                      </div>
                    </article>
                  ))}
                </div>
                {(selectedProgram.stations || []).length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">הוסיפו תת־קבוצה ראשונה ותרגילים לשרשרת שלה.</div>}
              </div>
            ) : <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Dumbbell size={19} className="text-indigo-600" /> סדר התרגילים והתחנות</h3><p className="mt-1 text-xs text-slate-500">משך משוער: {formatDuration(totalProgramSeconds(selectedProgram))}</p></div><button onClick={addExercise} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700"><Plus size={15} /> הוסף תרגיל</button></div>
              <div className="space-y-3">
                {selectedProgram.exercises.map((exercise, index) => (
                  <article key={exercise.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                      <div className="flex items-center gap-1"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">{index + 1}</span><button onClick={() => moveExercise(index, -1)} disabled={index === 0} className="rounded p-1 text-slate-500 disabled:opacity-20"><ArrowUp size={14} /></button><button onClick={() => moveExercise(index, 1)} disabled={index === selectedProgram.exercises.length - 1} className="rounded p-1 text-slate-500 disabled:opacity-20"><ArrowDown size={14} /></button></div>
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                        <label className="sm:col-span-2 text-[9px] font-bold text-slate-500">שם התרגיל<input value={exercise.name} onChange={event => updateExercise(exercise.id, { name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800" placeholder="לדוגמה: Battle Rope" /></label>
                        <label className="text-[9px] font-bold text-slate-500">עבודה<input type="number" min={5} max={600} value={exercise.workSeconds} onChange={event => updateExercise(exercise.id, { workSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                        <label className="text-[9px] font-bold text-slate-500">מנוחה<input type="number" min={0} max={300} value={exercise.restSeconds} onChange={event => updateExercise(exercise.id, { restSeconds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                        <label className="text-[9px] font-bold text-slate-500">סבבים<input type="number" min={1} max={20} value={exercise.rounds} onChange={event => updateExercise(exercise.id, { rounds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></label>
                        <label className="text-[9px] font-bold text-slate-500">חזרות / משקל<input value={exercise.weight || exercise.reps} onChange={event => updateExercise(exercise.id, { weight: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="לפי זמן" /></label>
                        <label className="sm:col-span-2 lg:col-span-5 text-[9px] font-bold text-slate-500">הנחיות למאמן<input value={exercise.notes || ''} onChange={event => updateExercise(exercise.id, { notes: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="טכניקה, התאמות או ציוד נדרש" /></label>
                        <div className="sm:col-span-2 lg:col-span-3"><label className="text-[9px] font-bold text-slate-500">תמונה / GIF / סרטון הדגמה<div className="mt-1 grid grid-cols-[100px_minmax(0,1fr)] gap-2"><select value={exercise.mediaType || 'VIDEO'} onChange={event => updateExercise(exercise.id, { mediaType: event.target.value as GroupWorkoutExercise['mediaType'] })} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option value="VIDEO">סרטון</option><option value="GIF">GIF</option><option value="IMAGE">תמונה</option></select><input value={exercise.mediaUrl || ''} onChange={event => updateExercise(exercise.id, { mediaUrl: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="קישור אופציונלי" /></div></label>{(exercise.mediaUrl || exercise.mediaStorageId) && <ExerciseMedia exercise={exercise} compact controls className="mt-2 border-slate-200" />}<label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-[10px] font-black text-fuchsia-700"><ImagePlus size={14} /> {exercise.mediaUrl || exercise.mediaStorageId ? 'החלף קובץ הדגמה' : 'העלה קובץ הדגמה'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void storeExerciseMedia(exercise, file, changes => updateExercise(exercise.id, changes)); event.target.value = ''; }} /></label></div>
                      </div>
                      <button onClick={() => updateProgram({ exercises: selectedProgram.exercises.filter(item => item.id !== exercise.id) })} className="self-start rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                  </article>
                ))}
                {selectedProgram.exercises.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">הוסיפו את התרגיל או התחנה הראשונה.</div>}
              </div>
            </div>}

            {selectedProgram.mode === 'ROTATING_GROUPS' && <div className="rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-950 to-slate-950 p-4 text-white shadow-lg">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2"><MonitorPlay size={18} className="text-indigo-300" /><h3 className="font-black">שלט חי למסך האימון</h3>{liveStatus && <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-black text-emerald-300">מחובר</span>}</div>
                  <p className="mt-1 text-xs text-slate-300">{liveStatus ? `${liveStatus.phase === 'WORK' ? 'עבודה' : liveStatus.phase === 'REST' ? 'מנוחה' : liveStatus.phase === 'TRANSITION' ? 'מעבר תחנות' : liveStatus.phase === 'PREPARE' ? 'הכנה' : 'הושלם'} · ${formatDuration(liveStatus.secondsLeft)} · סבב ${liveStatus.chainRound}` : 'פתחו את מסך האימון בכרטיסייה נוספת כדי להפעיל את השלט.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => sendGroupWorkoutCommand(selectedProgram.id, 'PAUSE')} disabled={!liveStatus || !liveStatus.isRunning} className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-35"><Pause size={15} fill="currentColor" /> עצור</button>
                  <button onClick={() => sendGroupWorkoutCommand(selectedProgram.id, 'RESUME')} disabled={!liveStatus || liveStatus.isRunning || liveStatus.phase === 'COMPLETE'} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white disabled:opacity-35"><Play size={15} fill="currentColor" /> המשך</button>
                  <button onClick={() => sendGroupWorkoutCommand(selectedProgram.id, 'ADD_REST', 10)} disabled={!liveStatus || !['REST', 'TRANSITION'].includes(liveStatus.phase)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-black disabled:opacity-35"><TimerReset size={15} /> +10 שנ׳ מנוחה</button>
                  <button onClick={() => sendGroupWorkoutCommand(selectedProgram.id, 'ADD_REST', 30)} disabled={!liveStatus || !['REST', 'TRANSITION'].includes(liveStatus.phase)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-black disabled:opacity-35"><TimerReset size={15} /> +30 שנ׳</button>
                  <button onClick={() => sendGroupWorkoutCommand(selectedProgram.id, 'NEXT_STEP')} disabled={!liveStatus || liveStatus.phase === 'COMPLETE'} className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-black text-white disabled:opacity-35"><SkipForward size={15} /> לשלב הבא</button>
                  <button onClick={() => { sendGroupWorkoutCommand(selectedProgram.id, 'RESET'); window.setTimeout(() => sendGroupWorkoutCommand(selectedProgram.id, 'RESUME'), 150); }} disabled={!liveStatus} className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white disabled:opacity-35"><RotateCcw size={15} /> הפעלה מחדש</button>
                </div>
              </div>
            </div>}

            <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-600"><Save size={15} className="text-emerald-600" /> נשמר לאחרונה {new Date(selectedProgram.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={publishProgram} disabled={programExerciseCount(selectedProgram) === 0 || (selectedProgram.mode === 'ROTATING_GROUPS' ? (selectedProgram.stations || []).flatMap(station => station.exercises) : selectedProgram.exercises).some(exercise => !exercise.name.trim())} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><CheckCircle2 size={16} /> פרסם תוכנית</button>
                <button onClick={() => openDisplay(selectedProgram)} disabled={selectedProgram.status !== 'PUBLISHED'} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><MonitorPlay size={16} /> פתח מסך אימון <ExternalLink size={13} /></button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><UsersRound className="mx-auto mb-3 text-slate-400" size={38} /><p className="font-black text-slate-700">צרו קבוצה כדי להתחיל לבנות תוכנית</p></div></div>
        )}
      </div>
      </>}
    </section>
  );
};
