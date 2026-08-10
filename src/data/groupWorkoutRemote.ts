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
const apiBase = () => (import.meta.env.VITE_PAYMENT_API_URL || '').replace(/\/$/, '');

export const sendGroupWorkoutCommand = (programId: string, action: GroupWorkoutRemoteAction, seconds?: number) => {
  const command: GroupWorkoutRemoteCommand = {
    id: `remote-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    action,
    seconds,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(commandKey(programId), JSON.stringify(command));
  const base = apiBase();
  if (base) void fetch(`${base}/api/live-display/${encodeURIComponent(programId)}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  }).catch(() => undefined);
};

export const subscribeToGroupWorkoutCommands = (programId: string, callback: (command: GroupWorkoutRemoteCommand) => void) => {
  let lastRemoteId = '';
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== commandKey(programId) || !event.newValue) return;
    try { callback(JSON.parse(event.newValue)); } catch { /* Ignore malformed commands. */ }
  };
  window.addEventListener('storage', handleStorage);
  const base = apiBase();
  const poll = base ? window.setInterval(async () => {
    try {
      const response = await fetch(`${base}/api/live-display/${encodeURIComponent(programId)}/commands`, { cache: 'no-store' });
      if (!response.ok) return;
      const command = await response.json() as GroupWorkoutRemoteCommand | null;
      if (command?.id && command.id !== lastRemoteId) {
        lastRemoteId = command.id;
        callback(command);
      }
    } catch { /* Local storage remains available as a fallback. */ }
  }, 700) : undefined;
  return () => { window.removeEventListener('storage', handleStorage); if (poll) window.clearInterval(poll); };
};

export const publishGroupWorkoutStatus = (status: GroupWorkoutLiveStatus) => {
  localStorage.setItem(statusKey(status.programId), JSON.stringify(status));
  const base = apiBase();
  if (base) void fetch(`${base}/api/live-display/${encodeURIComponent(status.programId)}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(status)
  }).catch(() => undefined);
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
  const base = apiBase();
  const poll = base ? window.setInterval(async () => {
    try {
      const response = await fetch(`${base}/api/live-display/${encodeURIComponent(programId)}/status`, { cache: 'no-store' });
      if (response.ok) callback(await response.json());
    } catch { /* Local storage remains available as a fallback. */ }
  }, 1000) : undefined;
  return () => { window.removeEventListener('storage', handleStorage); if (poll) window.clearInterval(poll); };
};
