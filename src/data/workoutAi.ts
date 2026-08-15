import {
  CoachPdfDocument,
  Exercise,
  GroupWorkoutExercise,
  GroupWorkoutProgram,
  GymEquipment,
  TraineeMemoryEntry,
  TraineeProfessionalProfile,
  User,
  WorkoutAssistantDraft,
  WorkoutAssistantMessage
} from '../types';

type AiExercise = Omit<Exercise, 'id' | 'mediaUrl' | 'mediaType' | 'mediaStorageId'>;
type AiGroupExercise = Omit<GroupWorkoutExercise, 'id' | 'mediaUrl' | 'mediaType' | 'mediaStorageId'>;

export interface PersonalWorkoutAiResult {
  assistantMessage: string;
  focusDay: number;
  objective: string;
  coachNotes: string;
  trainingDaysPerWeek: number;
  dayLabels: string[];
  exercises: AiExercise[];
}

export interface GroupWorkoutAiResult {
  assistantMessage: string;
  title: string;
  description: string;
  mode: 'LINEAR' | 'ROTATING_GROUPS';
  participantCount: number;
  defaultWorkSeconds: number;
  defaultRestSeconds: number;
  preparationSeconds: number;
  roundsPerStation: number;
  transitionSeconds: number;
  exercises: AiGroupExercise[];
  stations: Array<{ name: string; exercises: AiGroupExercise[] }>;
}

interface PersonalWorkoutAiRequest {
  message: string;
  actor: User;
  trainee: User;
  professionalProfile?: TraineeProfessionalProfile;
  confirmedMemory: TraineeMemoryEntry[];
  equipment: GymEquipment[];
  sourceDocuments: Array<Pick<CoachPdfDocument, 'id' | 'title' | 'category' | 'tags'> & { text: string }>;
  conversation: WorkoutAssistantMessage[];
  currentDraft?: WorkoutAssistantDraft;
}

interface GroupWorkoutAiRequest {
  message: string;
  actor: User;
  equipment: GymEquipment[];
  conversation: Array<{ role: 'COACH' | 'ASSISTANT'; content: string }>;
  currentDraft: GroupWorkoutProgram;
  groupParticipants: Array<{
    user: Pick<User, 'id' | 'name' | 'age' | 'gender'>;
    professionalProfile?: TraineeProfessionalProfile;
    confirmedMemory: TraineeMemoryEntry[];
  }>;
}

const aiApiBase = () => (import.meta.env.VITE_AI_API_URL || import.meta.env.VITE_PAYMENT_API_URL || '').replace(/\/$/, '');

const requestWorkoutAi = async <T>(body: object): Promise<{ result: T; model: string }> => {
  const response = await fetch(`${aiApiBase()}/api/ai/workout-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({})) as { result?: T; model?: string; message?: string };
  if (!response.ok || !payload.result) throw new Error(payload.message || 'שירות ה־AI אינו זמין כרגע.');
  return { result: payload.result, model: payload.model || 'OpenAI' };
};

const publicUserContext = (user: User) => ({
  id: user.id,
  name: user.name,
  role: user.role,
  age: user.age,
  gender: user.gender,
  membershipType: user.membershipType
});

const publicMemory = (entries: TraineeMemoryEntry[]) => entries
  .filter(entry => entry.confirmed)
  .map(({ id, category, content, visibility, confirmed, createdAt, createdByName }) => ({
    id, category, content, visibility, confirmed, createdAt, createdByName
  }));

const publicEquipment = (equipment: GymEquipment[]) => equipment.map(item => ({
  id: item.id,
  name: item.name,
  category: item.category,
  aliases: item.aliases,
  muscleGroups: item.muscleGroups,
  quantity: item.quantity,
  location: item.location,
  status: item.status,
  notes: item.notes
}));

export const generatePersonalWorkoutWithAi = (request: PersonalWorkoutAiRequest) => requestWorkoutAi<PersonalWorkoutAiResult>({
  scope: 'PERSONAL',
  message: request.message,
  actor: publicUserContext(request.actor),
  trainee: publicUserContext(request.trainee),
  professionalProfile: request.professionalProfile,
  confirmedMemory: publicMemory(request.confirmedMemory),
  equipment: publicEquipment(request.equipment),
  sourceDocuments: request.sourceDocuments,
  conversation: request.conversation.slice(-16).map(message => ({ role: message.role, content: message.content })),
  currentDraft: request.currentDraft
});

export const generateGroupWorkoutWithAi = (request: GroupWorkoutAiRequest) => requestWorkoutAi<GroupWorkoutAiResult>({
  scope: 'GROUP',
  message: request.message,
  actor: publicUserContext(request.actor),
  equipment: publicEquipment(request.equipment),
  conversation: request.conversation.slice(-16),
  currentDraft: request.currentDraft,
  groupParticipants: request.groupParticipants.map(participant => ({
    user: participant.user,
    professionalProfile: participant.professionalProfile,
    confirmedMemory: publicMemory(participant.confirmedMemory)
  }))
});
