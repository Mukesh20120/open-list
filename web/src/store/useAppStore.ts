import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { Job, QuotaHeaders, SavedList, Settings, Usage } from '../types';
import { currentCycleKey } from '../lib/quota';
import { DEFAULT_SKILLS, DEFAULT_TITLE_PENALTIES, rescore } from '../lib/scoring';
import { dedupe } from '../lib/jsearch';

// IndexedDB instead of localStorage: saved lists with full descriptions outgrow the ~5 MB localStorage cap
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
};

export const DEFAULT_SETTINGS: Settings = {
  country: 'in',
  language: 'en',
  datePosted: 'month',
  employmentTypes: ['FULLTIME'],
  numPages: 1,
  yearsExperience: 3,
  minScore: 3,
  monthlyLimit: 200,
  resetDay: new Date().getDate(),
  skills: DEFAULT_SKILLS,
  titlePenalties: DEFAULT_TITLE_PENALTIES,
};

interface Results {
  jobs: Job[];
  newIds: string[]; // jobs not seen in any earlier search
  queries: string[];
  at: string | null;
}

interface AppState {
  hydrated: boolean;
  apiKey: string;
  settings: Settings;
  usage: Usage;
  results: Results;
  seenIds: string[];
  recentQueries: string[];
  lists: SavedList[];

  setApiKey: (key: string) => void;
  updateSettings: (s: Settings) => void;
  recordUsage: (pages: number, headers: QuotaHeaders | null) => void;
  setUsed: (used: number) => void;
  addResults: (jobs: Job[], query: string, append: boolean) => void;
  clearResults: () => void;
  createList: (name: string, jobs: Job[]) => string;
  addJobsToList: (listId: string, jobs: Job[]) => number;
  removeJobsFromList: (listId: string, jobIds: string[]) => void;
  updateJob: (listId: string | null, jobId: string, patch: Partial<Job>) => void;
  renameList: (listId: string, name: string) => void;
  deleteList: (listId: string) => void;
  importLists: (lists: SavedList[]) => void;
}

const now = () => new Date().toISOString();

export const useAppStore = create<AppState>()(
  persist(
    (setState, getState) => ({
      hydrated: false,
      apiKey: '',
      settings: DEFAULT_SETTINGS,
      usage: { used: 0, cycleKey: '', syncedAt: null },
      results: { jobs: [], newIds: [], queries: [], at: null },
      seenIds: [],
      recentQueries: [],
      lists: [],

      setApiKey: (apiKey) => setState({ apiKey: apiKey.trim() }),

      updateSettings: (settings) =>
        setState((s) => ({
          settings,
          results: { ...s.results, jobs: s.results.jobs.map((j) => rescore(j, settings)) },
          lists: s.lists.map((l) => ({ ...l, jobs: l.jobs.map((j) => rescore(j, settings)) })),
        })),

      recordUsage: (pages, headers) =>
        setState((s) => {
          const cycleKey = currentCycleKey(s.settings.resetDay);
          if (headers) {
            const limit = headers.limit ?? s.settings.monthlyLimit;
            return {
              usage: { used: Math.max(0, limit - headers.remaining), cycleKey, syncedAt: now() },
              settings: headers.limit ? { ...s.settings, monthlyLimit: headers.limit } : s.settings,
            };
          }
          const prev = s.usage.cycleKey === cycleKey ? s.usage : { used: 0, syncedAt: null };
          return { usage: { used: prev.used + pages, cycleKey, syncedAt: prev.syncedAt } };
        }),

      setUsed: (used) =>
        setState((s) => ({ usage: { used: Math.max(0, used), cycleKey: currentCycleKey(s.settings.resetDay), syncedAt: now() } })),

      addResults: (jobs, query, append) =>
        setState((s) => {
          const seen = new Set(s.seenIds);
          const newIds = jobs.filter((j) => !seen.has(j.id)).map((j) => j.id);
          const prev = append ? s.results : { jobs: [], newIds: [], queries: [] };
          return {
            results: {
              jobs: dedupe([...prev.jobs, ...jobs]),
              newIds: [...new Set([...prev.newIds, ...newIds])],
              queries: [...new Set([...prev.queries, query])],
              at: now(),
            },
            seenIds: [...new Set([...s.seenIds, ...jobs.map((j) => j.id)])],
            recentQueries: [query, ...s.recentQueries.filter((q) => q !== query)].slice(0, 8),
          };
        }),

      clearResults: () => setState({ results: { jobs: [], newIds: [], queries: [], at: null } }),

      createList: (name, jobs) => {
        const id = crypto.randomUUID();
        setState((s) => ({ lists: [{ id, name, createdAt: now(), updatedAt: now(), jobs: dedupe(jobs) }, ...s.lists] }));
        return id;
      },

      addJobsToList: (listId, jobs) => {
        const list = getState().lists.find((l) => l.id === listId);
        if (!list) return 0;
        const have = new Set(list.jobs.map((j) => j.id));
        const fresh = jobs.filter((j) => !have.has(j.id));
        setState((s) => ({
          lists: s.lists.map((l) => (l.id === listId ? { ...l, jobs: [...l.jobs, ...fresh], updatedAt: now() } : l)),
        }));
        return fresh.length;
      },

      removeJobsFromList: (listId, jobIds) => {
        const drop = new Set(jobIds);
        setState((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId ? { ...l, jobs: l.jobs.filter((j) => !drop.has(j.id)), updatedAt: now() } : l,
          ),
        }));
      },

      updateJob: (listId, jobId, patch) =>
        setState((s) => {
          const apply = (jobs: Job[]) => jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j));
          if (listId === null) return { results: { ...s.results, jobs: apply(s.results.jobs) } };
          return { lists: s.lists.map((l) => (l.id === listId ? { ...l, jobs: apply(l.jobs), updatedAt: now() } : l)) };
        }),

      renameList: (listId, name) =>
        setState((s) => ({ lists: s.lists.map((l) => (l.id === listId ? { ...l, name, updatedAt: now() } : l)) })),

      deleteList: (listId) => setState((s) => ({ lists: s.lists.filter((l) => l.id !== listId) })),

      importLists: (incoming) =>
        setState((s) => {
          const ids = new Set(s.lists.map((l) => l.id));
          const names = new Set(s.lists.map((l) => l.name));
          const added = incoming.map((l) => {
            let name = l.name;
            for (let n = 2; names.has(name); n++) name = `${l.name} (${n})`;
            names.add(name);
            return { ...l, id: ids.has(l.id) ? crypto.randomUUID() : l.id, name, updatedAt: now() };
          });
          return { lists: [...added, ...s.lists] };
        }),
    }),
    {
      name: 'open-list',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ apiKey, settings, usage, results, seenIds, recentQueries, lists }) => ({
        apiKey,
        settings,
        usage,
        results,
        seenIds,
        recentQueries,
        lists,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
      onRehydrateStorage: () => () => useAppStore.setState({ hydrated: true }),
    },
  ),
);
