import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { makeEntry, pushLog, type LogEntry, type LogLevel } from '../lib/logCore';
import { persistStorage } from './storage';

interface S {
  items: LogEntry[];
  seq: number;
  add: (tag: string, msg: unknown, level?: LogLevel) => void;
  clear: () => void;
}

export const useLogs = create<S>()(
  persist(
    (set) => ({
      items: [],
      seq: 0,
      add: (tag, msg, level = 'info') => set((s) => {
        const items = pushLog(s.items, makeEntry(s.seq + 1, tag, msg, level));
        return items === s.items ? s : { items, seq: s.seq + 1 };
      }),
      clear: () => set({ items: [] }),
    }),
    { name: 'ai_logs_v1', storage: persistStorage, version: 1 },
  ),
);

/** يسجّل حدثًا/خطأ دون أن يُفسد التدفق إن فشل التسجيل نفسه */
export const log = (tag: string, msg: unknown, level: LogLevel = 'info') => {
  try { useLogs.getState().add(tag, msg, level); } catch {}
};
export const logErr = (tag: string, e: unknown) => log(tag, e, 'error');
