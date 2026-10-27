import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LibItem, MemoryItem, UsageRecord } from '../api/types';
import { uid } from '../lib/util';
import { persistStorage } from './storage';

const SEED: LibItem[] = [
  { id: 't1', kind: 'template', name: 'اشرح لي ببساطة', text: 'اشرح لي {{الموضوع}} بطريقة بسيطة جدًا كأنني مبتدئ، مع مثال من الحياة اليومية.', ts: 1700000004000 },
  { id: 't2', kind: 'template', name: 'لخّص النص', text: 'لخّص النص التالي في نقاط قصيرة وواضحة مع إبراز الفكرة الرئيسية:\n', ts: 1700000003000 },
  { id: 't3', kind: 'template', name: 'صحّح لغويًا', text: 'صحّح الأخطاء الإملائية والنحوية في النص التالي دون تغيير المعنى، ثم اذكر التعديلات:\n', ts: 1700000002000 },
  { id: 't4', kind: 'template', name: 'ترجمة احترافية', text: 'ترجم النص التالي ترجمة دقيقة وطبيعية إلى {{اللغة|العربية}} مع الحفاظ على الأسلوب:\n{{النص}}', ts: 1700000001000 },
  { id: 'p1', kind: 'persona', name: 'معلّم صبور', text: 'أنت معلّم صبور ولطيف. اشرح خطوة بخطوة، استخدم أمثلة بسيطة، واسأل المستخدم للتأكد من فهمه.', ts: 1700000003500 },
  { id: 'p2', kind: 'persona', name: 'مبرمج خبير', text: 'أنت مهندس برمجيات خبير. قدّم حلولًا عملية وكودًا نظيفًا مع شرح مختصر لأفضل الممارسات.', ts: 1700000002500 },
  { id: 'p3', kind: 'persona', name: 'كاتب مبدع', text: 'أنت كاتب مبدع بأسلوب أدبي راقٍ. استخدم لغة غنية وصورًا بلاغية وحافظ على الإيقاع.', ts: 1700000001500 },
];

interface LibState {
  items: LibItem[];
  add: (i: Omit<LibItem, 'id' | 'ts'>) => void;
  update: (id: string, p: Partial<LibItem>) => void;
  remove: (id: string) => void;
  replaceAll: (items: LibItem[]) => void;
}

export const useLibrary = create<LibState>()(
  persist(
    (set) => ({
      items: SEED,
      add: (i) => set((s) => ({ items: [{ ...i, id: uid(8), ts: Date.now() }, ...s.items] })),
      update: (id, p) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      replaceAll: (items) => set({ items }),
    }),
    { name: 'ai_library', storage: persistStorage, version: 1 },
  ),
);

interface MemState {
  items: MemoryItem[];
  add: (text: string, cat?: MemoryItem['cat'], source?: MemoryItem['source']) => MemoryItem | null;
  update: (id: string, p: Partial<MemoryItem>) => void;
  remove: (ids: string[]) => void;
  markUsed: (ids: string[]) => void;
  clear: () => void;
  replaceAll: (items: MemoryItem[]) => void;
}

export const useMemory = create<MemState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (text, cat = 'fact', source = 'manual') => {
        const t = text.replace(/\s+/g, ' ').trim().slice(0, 400);
        if (!t) return null;
        const exists = get().items.find((m) => m.text === t);
        if (exists) return exists;
        const now = Date.now();
        const m: MemoryItem = { id: uid(8), text: t, cat, pinned: false, uses: 0, lastUsed: 0, source, createdAt: now, updatedAt: now };
        set((s) => ({ items: [m, ...s.items] }));
        return m;
      },
      update: (id, p) => set((s) => ({ items: s.items.map((m) => (m.id === id ? { ...m, ...p, updatedAt: Date.now() } : m)) })),
      remove: (ids) => set((s) => ({ items: s.items.filter((m) => !ids.includes(m.id)) })),
      markUsed: (ids) =>
        set((s) => ({ items: s.items.map((m) => (ids.includes(m.id) ? { ...m, uses: m.uses + 1, lastUsed: Date.now() } : m)) })),
      clear: () => set({ items: [] }),
      replaceAll: (items) => set({ items }),
    }),
    { name: 'ai_memory_v1', storage: persistStorage, version: 1 },
  ),
);

interface UsageState {
  log: UsageRecord[];
  push: (r: UsageRecord) => void;
  clear: () => void;
}

export const useUsage = create<UsageState>()(
  persist(
    (set) => ({
      log: [],
      // نحتفظ بآخر 5000 سجل فقط
      push: (r) => set((s) => ({ log: [...s.log, r].slice(-5000) })),
      clear: () => set({ log: [] }),
    }),
    { name: 'ai_usage_v1', storage: persistStorage, version: 1 },
  ),
);

/* ---------- حالة الواجهة العابرة ---------- */
interface UiState {
  sidebarOpen: boolean;
  toastMsg: string;
  toastId: number;
  locked: boolean;
  /** نص يُدرج في المربع عند فتح المحادثة (من المكتبة مثلًا) */
  draft: string;
  setSidebar: (v: boolean) => void;
  toast: (m: string) => void;
  setLocked: (v: boolean) => void;
  setDraft: (t: string) => void;
}
export const useUi = create<UiState>((set) => ({
  sidebarOpen: false,
  toastMsg: '',
  toastId: 0,
  locked: false,
  draft: '',
  setSidebar: (v) => set({ sidebarOpen: v }),
  toast: (m) => set((s) => ({ toastMsg: m, toastId: s.toastId + 1 })),
  setLocked: (v) => set({ locked: v }),
  setDraft: (t) => set({ draft: t }),
}));
export const toast = (m: string) => useUi.getState().toast(m);
