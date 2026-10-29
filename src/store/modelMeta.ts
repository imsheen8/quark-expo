import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addHist, type MetaEntry, type TestState, type UseEntry } from '../api/modelsCore';
import { persistStorage } from './storage';

interface S {
  meta: Record<string, MetaEntry>;
  fav: string[];
  use: Record<string, UseEntry>;
  /** يدمج حقولًا (اسم مستعار/ملاحظة/لون)؛ القيمة الفارغة تحذف الحقل */
  setMeta: (key: string, p: { alias?: string; note?: string; color?: string }) => void;
  record: (key: string, r: { ok: boolean; ms?: number; err?: string; ttft?: number; tps?: number }) => void;
  toggleFav: (key: string) => void;
  setFav: (keys: string[], on: boolean) => void;
  bump: (key: string) => void;
  forget: (keys: string[]) => void;
  merge: (d: { fav: string[]; meta: Record<string, MetaEntry> }) => void;
}

export const useModelMeta = create<S>()(
  persist(
    (set) => ({
      meta: {},
      fav: [],
      use: {},
      setMeta: (key, p) =>
        set((s) => {
          const cur = { ...(s.meta[key] || {}) } as Record<string, any>;
          for (const [k, v] of Object.entries(p)) { if (v) cur[k] = v; else delete cur[k]; }
          return { meta: { ...s.meta, [key]: cur as MetaEntry } };
        }),
      record: (key, r) => set((s) => ({ meta: { ...s.meta, [key]: addHist(s.meta[key], r) } })),
      toggleFav: (key) => set((s) => ({ fav: s.fav.includes(key) ? s.fav.filter((x) => x !== key) : [...s.fav, key] })),
      setFav: (keys, on) => set((s) => ({ fav: on ? [...new Set([...s.fav, ...keys])] : s.fav.filter((x) => !keys.includes(x)) })),
      bump: (key) => set((s) => ({ use: { ...s.use, [key]: { n: (s.use[key]?.n || 0) + 1, ts: Date.now() } } })),
      forget: (keys) =>
        set((s) => {
          const meta = { ...s.meta }, use = { ...s.use };
          keys.forEach((k) => { delete meta[k]; delete use[k]; });
          return { meta, use, fav: s.fav.filter((x) => !keys.includes(x)) };
        }),
      merge: (d) => set((s) => ({ fav: [...new Set([...s.fav, ...d.fav])], meta: { ...d.meta, ...s.meta } })),
    }),
    { name: 'ai_model_meta_v1', storage: persistStorage, version: 1 },
  ),
);

/** نتائج الاختبار الحية (في الذاكرة فقط) */
export const useModelTests = create<{ t: Record<string, TestState>; set: (k: string, v: TestState | null) => void }>()((set) => ({
  t: {},
  set: (k, v) => set((s) => { const t = { ...s.t }; if (v) t[k] = v; else delete t[k]; return { t }; }),
}));
