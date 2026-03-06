
export interface OfflineAction {
  id: string;
  type: 'attendance' | 'grade';
  data: any;
  timestamp: number;
}

const STORAGE_KEY = 'offline_actions';
const FOUR_HOURS = 4 * 60 * 60 * 1000;

export const offlineService = {
  saveAction: (type: 'attendance' | 'grade', data: any) => {
    const actions = offlineService.getActions();
    const newAction: OfflineAction = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data,
      timestamp: Date.now(),
    };
    actions.push(newAction);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
    return newAction;
  },

  getActions: (): OfflineAction[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const actions: OfflineAction[] = JSON.parse(stored);

    // Filter out actions older than 4 hours
    const now = Date.now();
    const validActions = actions.filter(a => now - a.timestamp <= FOUR_HOURS);

    if (validActions.length !== actions.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validActions));
    }

    return validActions;
  },

  clearActions: (ids: string[]) => {
    const actions = offlineService.getActions();
    const remaining = actions.filter(a => !ids.includes(a.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  },

  sync: async () => {
    const actions = offlineService.getActions();
    if (actions.length === 0) return;

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ actions }),
      });

      if (res.ok) {
        const data = await res.json();
        const successfulIds = data.results
          .filter((r: any) => r.status === 'success' || r.status === 'expired')
          .map((r: any) => r.action.id);

        offlineService.clearActions(successfulIds);
        return data;
      }
    } catch (err) {
      // Log only the error message, not the full error object which may contain sensitive data
      console.error('Sync failed:', err instanceof Error ? err.message : 'Unknown error');
    }
  }
};
