export type GroupWorkoutRemoteAction = 'PAUSE' | 'RESUME' | 'ADD_REST' | 'NEXT_STEP' | 'RESET';

export interface GroupWorkoutRemoteCommand {
  id: string;
  action: GroupWorkoutRemoteAction;
  seconds?: number;
  createdAt: string;
}

export interface GroupWorkoutLiveStatus {
  programId: string;
  phase: string;
  isRunning: boolean;
  secondsLeft: number;
  rotationIndex: number;
  chainRound: number;
  exerciseSlot: number;
  updatedAt: string;
}

const commandKey = (programId: string) => `gym_group_workout_remote_command_v1_${programId}`;
const statusKey = (programId: string) => `gym_group_workout_live_status_v1_${programId}`;

export const sendGroupWorkoutCommand = (programId: string, action: GroupWorkoutRemoteAction, seconds?: number) => {
  const command: GroupWorkoutRemoteCommand = {
    id: `remote-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    action,
    seconds,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(commandKey(programId), JSON.stringify(command));
};

export const subscribeToGroupWorkoutCommands = (programId: string, callback: (command: GroupWorkoutRemoteCommand) => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== commandKey(programId) || !event.newValue) return;
    try { callback(JSON.parse(event.newValue)); } catch { /* Ignore malformed commands. */ }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
};

export const publishGroupWorkoutStatus = (status: GroupWorkoutLiveStatus) => {
  localStorage.setItem(statusKey(status.programId), JSON.stringify(status));
};

export const getGroupWorkoutStatus = (programId: string): GroupWorkoutLiveStatus | undefined => {
  try {
    const value = localStorage.getItem(statusKey(programId));
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
};

export const subscribeToGroupWorkoutStatus = (programId: string, callback: (status: GroupWorkoutLiveStatus) => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== statusKey(programId) || !event.newValue) return;
    try { callback(JSON.parse(event.newValue)); } catch { /* Ignore malformed status. */ }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
};
