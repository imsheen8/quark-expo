import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Source } from '../api/researchCore';
import type { Schedule } from '../lib/schedule';
import { nextRun } from '../lib/schedule';
import { uid } from '../lib/util';
import { persistStorage } from './storage';

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

/* ---------- أسئلة الوكيل متعددة الخيارات ---------- */
export interface AskOpt { label: string; description?: string }
export interface AskQ { question: string; multi?: boolean; options: AskOpt[] }
/** إجابة سؤال: null = تخطّاه المستخدم */
export type AskAns = string[] | null;
export interface AskReq { id: string; questions: AskQ[]; resolve: (a: AskAns[] | null) => void }
interface AskState {
  queue: AskReq[];
  push: (questions: AskQ[]) => Promise<AskAns[] | null>;
  pop: (id: string) => void;
}
export const useAsk = create<AskState>((set) => ({
  queue: [],
  push: (questions) => new Promise((resolve) => set((s) => ({ queue: [...s.queue, { id: uid(6), questions, resolve }] }))),
  pop: (id) => set((s) => ({ queue: s.queue.filter((x) => x.id !== id) })),
}));
