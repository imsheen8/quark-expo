import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentStep, Chat, Msg, Params } from '../api/types';
import { uid } from '../lib/util';
import { forkUpTo, startBranch, switchVersion } from '../lib/branches';
import { persistStorage } from './storage';

interface ChatsState {
  chats: Chat[];
  currentId: string | null;
  /** وضع المحادثة الخفية */
  incog: boolean;

  current: () => Chat | undefined;
  setCurrent: (id: string | null) => void;
  setIncog: (v: boolean) => void;
  create: (first?: Msg) => Chat;
  addMessage: (chatId: string, m: Msg) => void;
  updateMessage: (chatId: string, msgId: string, p: Partial<Msg>) => void;
  /** يحذف الرسالة وما بعدها */
  truncateFrom: (chatId: string, msgId: string) => void;
  deleteMessage: (chatId: string, msgId: string) => void;
  /** يبدأ نسخة تعديل جديدة من رسالة مستخدم ويعيد بيانات النسخ للرسالة الجديدة */
  branchFrom: (chatId: string, msgId: string) => { vers: (Msg[] | null)[]; vi: number } | null;
  /** ينتقل إلى نسخة أخرى من رسالة */
  switchVer: (chatId: string, msgId: string, k: number) => void;
  /** يفرّع المحادثة إلى محادثة جديدة حتى رسالة معيّنة */
  fork: (chatId: string, msgId: string) => Chat | null;
  rename: (id: string, title: string, auto?: boolean) => void;
  togglePin: (id: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  setParams: (id: string, p: Params | undefined) => void;
  replaceAll: (chats: Chat[]) => void;
}

const touch = (c: Chat): Chat => ({ ...c, updated: Date.now() });

export const useChats = create<ChatsState>()(
  persist(
    (set, get) => ({
      chats: [],
      currentId: null,
      incog: false,

      current: () => get().chats.find((c) => c.id === get().currentId),
      setCurrent: (id) => set({ currentId: id }),
      setIncog: (v) =>
        set((s) => ({
          incog: v,
          // مغادرة الوضع الخفي تُسقط المحادثات المؤقتة
          chats: v ? s.chats : s.chats.filter((c) => !c.temp),
          currentId: v ? s.currentId : s.chats.find((c) => c.id === s.currentId)?.temp ? null : s.currentId,
        })),
      create: (first) => {
        const now = Date.now();
        const c: Chat = {
          id: uid(10),
          title: 'محادثة جديدة',
          autoTitle: true,
          created: now,
          updated: now,
          messages: first ? [first] : [],
          temp: get().incog || undefined,
        };
        set((s) => ({ chats: [c, ...s.chats], currentId: c.id }));
        return c;
      },
      addMessage: (chatId, m) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? touch({ ...c, messages: [...c.messages, m] }) : c)) })),
      updateMessage: (chatId, msgId, p) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? touch({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...p } : m)) }) : c,
          ),
        })),
      truncateFrom: (chatId, msgId) =>
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const i = c.messages.findIndex((m) => m.id === msgId);
            return i < 0 ? c : touch({ ...c, messages: c.messages.slice(0, i) });
          }),
        })),
      deleteMessage: (chatId, msgId) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? touch({ ...c, messages: c.messages.filter((m) => m.id !== msgId) }) : c)) })),
      branchFrom: (chatId, msgId) => {
        const c = get().chats.find((x) => x.id === chatId);
        const r = c && startBranch(c.messages, msgId);
        if (!c || !r) return null;
        set((s) => ({ chats: s.chats.map((x) => (x.id === chatId ? touch({ ...x, messages: r.messages }) : x)) }));
        return { vers: r.vers, vi: r.vi };
      },
      switchVer: (chatId, msgId, k) =>
        set((s) => ({
          chats: s.chats.map((x) => {
            if (x.id !== chatId) return x;
            const m = switchVersion(x.messages, msgId, k);
            return m ? touch({ ...x, messages: m }) : x;
          }),
        })),
      fork: (chatId, msgId) => {
        const c = get().chats.find((x) => x.id === chatId);
        const msgs = c && forkUpTo(c.messages, msgId, () => uid(8));
        if (!c || !msgs) return null;
        const now = Date.now();
        const n: Chat = { id: uid(10), title: 'تفريع: ' + c.title, autoTitle: false, created: now, updated: now, messages: msgs, tags: c.tags, temp: c.temp || undefined };
        set((s) => ({ chats: [n, ...s.chats], currentId: n.id }));
        return n;
      },
      rename: (id, title, auto = false) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title, autoTitle: auto } : c)) })),
      togglePin: (id) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })),
      remove: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id), currentId: s.currentId === id ? null : s.currentId })),
      clearAll: () => set({ chats: [], currentId: null }),
      setParams: (id, p) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, params: p } : c)) })),
      replaceAll: (chats) => set({ chats, currentId: null }),
    }),
    {
      name: 'ai_chats',
      storage: persistStorage,
      version: 1,
      // المحادثات الخفية لا تُحفظ أبدًا
      partialize: (s) => ({ chats: s.chats.filter((c) => !c.temp), currentId: null, incog: false }) as any,
    },
  ),
);

/** حالة البث الحيّ (غير دائمة): تُحدَّث مع كل شريحة دون لمس التخزين */
interface StreamState {
  chatId: string | null;
  text: string;
  think: string;
  secs: number;
  status: string;
  steps: AgentStep[];
  busy: boolean;
  set: (p: Partial<StreamState>) => void;
  reset: () => void;
}
export const useStream = create<StreamState>((set) => ({
  chatId: null,
  text: '',
  think: '',
  secs: 0,
  status: '',
  steps: [],
  busy: false,
  set: (p) => set(p),
  reset: () => set({ chatId: null, text: '', think: '', secs: 0, status: '', steps: [], busy: false }),
}));
