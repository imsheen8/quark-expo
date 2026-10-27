import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Integration, Webhook } from '../api/integCore';
import type { MailAccount, MailHead } from '../api/mailCore';
import type { Source } from '../api/researchCore';
import type { Schedule } from '../lib/schedule';
import { nextRun } from '../lib/schedule';
import { uid } from '../lib/util';
import { persistStorage } from './storage';

/* ---------- التكاملات ---------- */
interface IntegState {
  items: Integration[];
  hooks: Webhook[];
  add: (i: Omit<Integration, 'id'>) => string;
  update: (id: string, p: Partial<Integration>) => void;
  remove: (id: string) => void;
  addHook: (h: Omit<Webhook, 'id'>) => void;
  updateHook: (id: string, p: Partial<Webhook>) => void;
  removeHook: (id: string) => void;
}
export const useInteg = create<IntegState>()(
  persist(
    (set) => ({
      items: [],
      hooks: [],
      add: (i) => {
        const id = 'i' + uid(6);
        set((s) => ({ items: [...s.items, { ...i, id }] }));
        return id;
      },
      update: (id, p) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      addHook: (h) => set((s) => ({ hooks: [...s.hooks, { ...h, id: 'h' + uid(6) }] })),
      updateHook: (id, p) => set((s) => ({ hooks: s.hooks.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      removeHook: (id) => set((s) => ({ hooks: s.hooks.filter((x) => x.id !== id) })),
    }),
    { name: 'ai_integ_v1', storage: persistStorage, version: 1 },
  ),
);

/* ---------- المهام المجدولة ---------- */
export interface TaskRun { ts: number; ok: boolean; text: string }
export interface Task {
  id: string;
  name: string;
  prompt: string;
  schedule: Schedule;
  enabled: boolean;
  /** استخدم وضع الوكيل/الويب أثناء التنفيذ */
  web: boolean;
  notify: boolean;
  next: number | null;
  last: number;
  /** عدّاد الأحداث للمهام المبنية على أحداث */
  counter: number;
  runs: TaskRun[];
  created: number;
  updated: number;
}
interface TaskState {
  items: Task[];
  add: (t: Pick<Task, 'name' | 'prompt' | 'schedule'> & Partial<Pick<Task, 'web' | 'notify'>>) => Task;
  update: (id: string, p: Partial<Task>) => void;
  remove: (id: string) => void;
  recordRun: (id: string, r: TaskRun) => void;
  replaceAll: (items: Task[]) => void;
}
export const useTasks = create<TaskState>()(
  persist(
    (set) => ({
      items: [],
      add: (t) => {
        const now = Date.now();
        const task: Task = { id: 't' + uid(7), name: t.name, prompt: t.prompt, schedule: t.schedule, enabled: true, web: !!t.web, notify: t.notify ?? true, next: nextRun(t.schedule, now), last: 0, counter: 0, runs: [], created: now, updated: now };
        set((s) => ({ items: [task, ...s.items] }));
        return task;
      },
      update: (id, p) =>
        set((s) => ({
          items: s.items.map((x) => {
            if (x.id !== id) return x;
            const n = { ...x, ...p, updated: Date.now() };
            if (p.schedule || p.enabled === true) n.next = n.enabled ? nextRun(n.schedule, Date.now()) : null;
            if (p.enabled === false) n.next = null;
            return n;
          }),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      recordRun: (id, r) =>
        set((s) => ({
          items: s.items.map((x) => {
            if (x.id !== id) return x;
            const next = nextRun(x.schedule, Math.max(Date.now(), r.ts));
            return { ...x, last: r.ts, counter: 0, runs: [r, ...x.runs].slice(0, 10), next, enabled: x.schedule.mode === 'once' ? false : x.enabled };
          }),
        })),
      replaceAll: (items) => set({ items }),
    }),
    { name: 'ai_tasks_v1', storage: persistStorage, version: 1 },
  ),
);

/* ---------- البحث العميق ---------- */
export interface Research {
  id: string;
  topic: string;
  status: 'run' | 'done' | 'error' | 'stopped';
  phase: string;
  questions: string[];
  sources: Source[];
  report: string;
  error?: string;
  created: number;
  updated: number;
}
interface ResState {
  items: Research[];
  add: (topic: string) => Research;
  patch: (id: string, p: Partial<Research>) => void;
  remove: (id: string) => void;
}
export const useResearch = create<ResState>()(
  persist(
    (set) => ({
      items: [],
      add: (topic) => {
        const now = Date.now();
        const r: Research = { id: 'r' + uid(7), topic, status: 'run', phase: 'تخطيط', questions: [], sources: [], report: '', created: now, updated: now };
        set((s) => ({ items: [r, ...s.items] }));
        return r;
      },
      patch: (id, p) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...p, updated: Date.now() } : x)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
    }),
    {
      name: 'ai_research_v1',
      storage: persistStorage,
      version: 1,
      // بحث لم يكتمل عند إغلاق التطبيق يُعدّ متوقفًا
      onRehydrateStorage: () => (st) => st?.items.forEach((x) => x.status === 'run' && (x.status = 'stopped')),
    },
  ),
);

/* ---------- البريد ---------- */
interface MailState {
  accounts: MailAccount[];
  activeId: string | null;
  folder: string;
  contacts: string[];
  cache: Record<string, MailHead[]>;
  addAccount: (a: Omit<MailAccount, 'id'>) => string;
  updateAccount: (id: string, p: Partial<MailAccount>) => void;
  removeAccount: (id: string) => void;
  setActive: (id: string) => void;
  setFolder: (f: string) => void;
  setCache: (key: string, list: MailHead[]) => void;
  addContacts: (c: string[]) => void;
}
export const useMail = create<MailState>()(
  persist(
    (set) => ({
      accounts: [],
      activeId: null,
      folder: 'INBOX',
      contacts: [],
      cache: {},
      addAccount: (a) => {
        const id = 'm' + uid(6);
        set((s) => ({ accounts: [...s.accounts, { ...a, id }], activeId: s.activeId ?? id }));
        return id;
      },
      updateAccount: (id, p) => set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id), activeId: s.activeId === id ? s.accounts.find((x) => x.id !== id)?.id ?? null : s.activeId })),
      setActive: (id) => set({ activeId: id }),
      setFolder: (f) => set({ folder: f }),
      setCache: (key, list) => set((s) => ({ cache: { ...s.cache, [key]: list.slice(0, 60) } })),
      addContacts: (c) => set((s) => ({ contacts: Array.from(new Set([...c, ...s.contacts])).slice(0, 300) })),
    }),
    { name: 'ai_mail_v1', storage: persistStorage, version: 1 },
  ),
);

/* ---------- حوارات عامة (موافقات الوكيل وأسئلته) ---------- */
export interface DialogReq {
  id: string;
  title: string;
  message?: string;
  options?: string[];
  confirm?: string;
  cancel?: string;
  danger?: boolean;
  input?: boolean;
  resolve: (v: { ok: boolean; value?: string }) => void;
}
interface DlgState {
  queue: DialogReq[];
  push: (d: Omit<DialogReq, 'id' | 'resolve'>) => Promise<{ ok: boolean; value?: string }>;
  pop: (id: string) => void;
}
export const useDialogs = create<DlgState>((set) => ({
  queue: [],
  push: (d) => new Promise((resolve) => set((s) => ({ queue: [...s.queue, { ...d, id: uid(6), resolve }] }))),
  pop: (id) => set((s) => ({ queue: s.queue.filter((x) => x.id !== id) })),
}));
export const confirmAsk = (title: string, message?: string, o: Partial<DialogReq> = {}) => useDialogs.getState().push({ title, message, ...o }).then((r) => r.ok);
