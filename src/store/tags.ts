import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cleanTagName, TAG_COLORS } from '../lib/chatFilter';
import { uid } from '../lib/util';
import { useChats } from './chats';
import { useSettings } from './settings';
import { persistStorage } from './storage';

export interface Tag { id: string; name: string; color: string; desc?: string }

interface TagState {
  items: Tag[];
  add: (name: string, color?: string, desc?: string) => Tag | null;
  update: (id: string, name: string, color: string, desc?: string) => boolean;
  remove: (id: string) => void;
}

export const useTags = create<TagState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (name, color, desc) => {
        const n = cleanTagName(name);
        if (!n) return null;
        const ex = get().items.find((t) => t.name.toLowerCase() === n.toLowerCase());
        if (ex) return ex;
        const t: Tag = { id: uid(6), name: n, color: /^#[0-9a-f]{6}$/i.test(color || '') ? color! : TAG_COLORS[get().items.length % TAG_COLORS.length], ...(desc?.trim() ? { desc: desc.trim().slice(0, 120) } : {}) };
        set((s) => ({ items: [...s.items, t] }));
        return t;
      },
      update: (id, name, color, desc) => {
        const n = cleanTagName(name);
        if (!n || get().items.some((t) => t.id !== id && t.name.toLowerCase() === n.toLowerCase())) return false;
        set((s) => ({ items: s.items.map((t) => (t.id === id ? { ...t, name: n, color, desc: desc?.trim() ? desc.trim().slice(0, 120) : undefined } : t)) }));
        return true;
      },
      remove: (id) => {
        set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
        useChats.setState((s) => ({ chats: s.chats.map((c) => (c.tags?.includes(id) ? { ...c, tags: c.tags.filter((x) => x !== id).length ? c.tags.filter((x) => x !== id) : undefined } : c)) }));
        if (useSettings.getState().chatFilter === 'tag:' + id) useSettings.getState().patch({ chatFilter: 'recent' });
      },
    }),
    { name: 'ai_tags_v1', storage: persistStorage, version: 1 },
  ),
);

export function setChatTag(ids: string[], tagId: string, on: boolean) {
  useChats.setState((s) => ({
    chats: s.chats.map((c) => {
      if (!ids.includes(c.id)) return c;
      const cur = c.tags ?? [];
      const next = on ? (cur.includes(tagId) ? cur : [...cur, tagId]) : cur.filter((x) => x !== tagId);
      return { ...c, tags: next.length ? next : undefined };
    }),
  }));
}
