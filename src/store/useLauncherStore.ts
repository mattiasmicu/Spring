import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PanelEntry {
  id: string;
  props?: any;
  source?: 'sidebar' | 'topbar';
}

export interface UserProfile {
  uuid: string;
  username: string;
  token: string;
  refresh: string;
  access_token?: string;
  skin?: string;
  tier: 'microsoft' | 'mojang' | 'offline';
}

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: string;
  lastPlayed?: number;
  icon?: string;
  status: 'ready' | 'downloading' | 'running';
  modsCount?: number;
}

export interface LogLine {
  line: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

export interface DownloadProgress {
  file: string;
  current: number;
  total: number;
  percent: number;
}

export interface Settings {
  ramMb: number;
  javaPath?: string;
  theme: 'dark' | 'light';
}

interface LauncherStore {
  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Navigation
  panelStack: PanelEntry[];
  forwardStack: PanelEntry[];
  pushPanel: (id: string, props?: any, source?: 'sidebar' | 'topbar') => void;
  popPanel: () => void;
  forwardPanel: () => void;

  // Auth
  auth: UserProfile | null;
  setAuth: (user: UserProfile | null) => void;
  accounts: UserProfile[];
  addAccount: (user: UserProfile) => void;
  removeAccount: (uuid: string) => void;
  setActiveAccount: (uuid: string) => void;
  reorderAccounts: (fromIndex: number, toIndex: number) => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Instances
  instances: Instance[];
  setInstances: (instances: Instance[]) => void;
  updateInstance: (id: string, updates: Partial<Instance>) => void;
  activeInstance: Instance | null;
  setActiveInstance: (instance: Instance | null) => void;

  // Logs
  logs: LogLine[];
  appendLog: (line: string, level: 'info' | 'warn' | 'error') => void;
  addLog: (line: string, level: 'info' | 'warn' | 'error') => void;
  clearLogs: () => void;

  // Downloads
  downloadProgress: DownloadProgress | null;
  updateDownloadProgress: (progress: DownloadProgress | null) => void;

  // Settings
  settings: Settings;
  saveSettings: (settings: Partial<Settings>) => void;
}

export const useLauncherStore = create<LauncherStore>()(
  persist(
    (set) => ({
      // Loading state
      isLoading: true,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Navigation
      panelStack: [{ id: 'home' }],
      forwardStack: [],
      pushPanel: (id, props, source = 'sidebar') => set((state) => ({
        panelStack: [...state.panelStack, { id, props, source }],
        forwardStack: [],
      })),
      popPanel: () => set((state) => {
        if (state.panelStack.length <= 1) return state;
        const newStack = [...state.panelStack];
        const popped = newStack.pop();
        return {
          panelStack: newStack,
          forwardStack: popped ? [popped, ...state.forwardStack] : state.forwardStack,
        };
      }),
      forwardPanel: () => set((state) => {
        if (state.forwardStack.length === 0) return state;
        const newForward = [...state.forwardStack];
        const panel = newForward.shift();
        return {
          panelStack: panel ? [...state.panelStack, panel] : state.panelStack,
          forwardStack: newForward,
        };
      }),

      // Auth
      auth: null,
      setAuth: (user) => set({ auth: user }),
      accounts: [],
      addAccount: (user) => set((state) => ({
        accounts: [...state.accounts.filter(a => a.uuid !== user.uuid), user],
        auth: user,
      })),
      removeAccount: (uuid) => set((state) => {
        const newAccounts = state.accounts.filter(a => a.uuid !== uuid);
        return {
          accounts: newAccounts,
          auth: state.auth?.uuid === uuid ? (newAccounts[0] || null) : state.auth,
        };
      }),
      setActiveAccount: (uuid) => set((state) => ({
        auth: state.accounts.find(a => a.uuid === uuid) || state.auth,
      })),
      reorderAccounts: (fromIndex, toIndex) => set((state) => {
        const newAccounts = [...state.accounts];
        const [moved] = newAccounts.splice(fromIndex, 1);
        newAccounts.splice(toIndex, 0, moved);
        return { accounts: newAccounts };
      }),

      // Theme
      theme: 'dark',
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('light', newTheme === 'light');
        return { theme: newTheme };
      }),

      // Instances
      instances: [],
      setInstances: (instances) => set({ instances }),
      updateInstance: (id, updates) => set((state) => ({
        instances: state.instances.map((inst) =>
          inst.id === id ? { ...inst, ...updates } : inst
        ),
      })),
      activeInstance: null,
      setActiveInstance: (instance) => set({ activeInstance: instance }),

      // Logs
      logs: [],
      appendLog: (line, level) => set((state) => ({
        logs: [...state.logs, { line, level, timestamp: Date.now() }].slice(-1000),
      })),
      addLog: (line, level) => set((state) => ({
        logs: [...state.logs, { line, level, timestamp: Date.now() }].slice(-1000),
      })),
      clearLogs: () => set({ logs: [] }),

      // Downloads
      downloadProgress: null,
      updateDownloadProgress: (progress) => set({ downloadProgress: progress }),

      // Settings
      settings: {
        ramMb: 4096,
        theme: 'dark',
      },
      saveSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),
    }),
    {
      name: 'spring-launcher-storage',
      partialize: (state) => ({ 
        auth: state.auth, 
        accounts: state.accounts,
        settings: state.settings,
        theme: state.theme,
      }),
    }
  )
);