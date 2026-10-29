import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cleanTagName, TAG_COLORS } from '../lib/chatFilter';
import { SEED_PERSONA_TAGS, SEED_TEMPLATE_TAGS } from '../lib/seedTags';
import { uid } from '../lib/util';
import { useChats } from './chats';
import { useLibrary, useSkills } from './data';
import { useSettings } from './settings';
import { persistStorage } from './storage';

export interface Tag { id: string; name: string; color: string; desc?: string }
export type TagTarget = 'chat' | 'persona' | 'template' | 'skill';

interface TagState {
  items: Tag[];
  add: (name: string, color?: string, desc?: string) => Tag | null;
  update: (id: string, name: string, color: string, desc?: string) => boolean;
  remove: (id: string) => void;
}

/** ينشئ مخزن وسوم مستقلًا: وسوم المحادثات والشخصيات والقوالب والمهارات كلٌّ منفصل */
function makeTagStore(
  key: string,
  hooks: { onRemove: (id: string, t?: Tag) => void; onRename?: (from: string, to: string) => void },
  defaults: Tag[] = [],
) {
  return create<TagState>()(
    persist(
      (set, get) => ({
        items: defaults,
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
          const old = get().items.find((t) => t.id === id);
          set((s) => ({ items: s.items.map((t) => (t.id === id ? { ...t, name: n, color, desc: desc?.trim() ? desc.trim().slice(0, 120) : undefined } : t)) }));
          if (old && old.name !== n) hooks.onRename?.(old.name, n);
          return true;
        },
        remove: (id) => {
          const old = get().items.find((t) => t.id === id);
          set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
          hooks.onRemove(id, old);
        },
      }),
      { name: key, storage: persistStorage, version: 1 },
    ),
  );
}

const strip = (tags: string[] | undefined, id: string) => {
  const n = (tags ?? []).filter((x) => x !== id);
  return n.length ? n : undefined;
};
const stripLib = (id: string) =>
  useLibrary.setState((s) => ({ items: s.items.map((c) => (c.tags?.includes(id) ? { ...c, tags: strip(c.tags, id) } : c)) }));

/** وسوم المحادثات */
export const useTags = makeTagStore('ai_tags_v1', {
  onRemove: (id) => {
    useChats.setState((s) => ({ chats: s.chats.map((c) => (c.tags?.includes(id) ? { ...c, tags: strip(c.tags, id) } : c)) }));
    if (useSettings.getState().chatFilter === 'tag:' + id) useSettings.getState().patch({ chatFilter: 'recent' });
  },
});

/** وسوم الشخصيات */
export const usePersonaTags = makeTagStore('ai_persona_tags_v1', { onRemove: stripLib }, SEED_PERSONA_TAGS);

/** وسوم القوالب */
export const useTemplateTags = makeTagStore('ai_template_tags_v1', { onRemove: stripLib }, SEED_TEMPLATE_TAGS);

/** وسوم المهارات: تُخزَّن على المهارة بالاسم (حتى تبقى تعمل في المطابقة والتصدير) */
export const useSkillTags = makeTagStore('ai_skill_tags_v1', {
  onRemove: (_id, t) => {
    if (!t) return;
    useSkills.setState((s) => ({ items: s.items.map((k) => (k.tags.includes(t.name) ? { ...k, tags: k.tags.filter((x) => x !== t.name) } : k)) }));
  },
  onRename: (from, to) => {
    useSkills.setState((s) => ({ items: s.items.map((k) => (k.tags.includes(from) ? { ...k, tags: [...new Set(k.tags.map((x) => (x === from ? to : x)))] } : k)) }));
  },
});

export const tagStoreFor = (t: TagTarget) => (t === 'persona' ? usePersonaTags : t === 'template' ? useTemplateTags : t === 'skill' ? useSkillTags : useTags);

/** يعرّف وسمًا لكل اسم وسم موجود على مهارة (مستوردة أو مدمجة) ولم يُعرَّف بعد */
export function syncSkillTags() {
  const names = new Set<string>();
  useSkills.getState().items.forEach((k) => k.tags.forEach((n) => n && names.add(n)));
  const have = new Set(useSkillTags.getState().items.map((t) => t.name.toLowerCase()));
  names.forEach((n) => { if (!have.has(n.toLowerCase())) useSkillTags.getState().add(n); });
}

const toggle = (cur: string[], v: string, on: boolean) => (on ? (cur.includes(v) ? cur : [...cur, v]) : cur.filter((x) => x !== v));

/** يضيف/يزيل وسمًا لمجموعة عناصر من نوع واحد */
export function setItemTag(target: TagTarget, ids: string[], tagId: string, on: boolean) {
  if (target === 'chat') {
    useChats.setState((s) => ({
      chats: s.chats.map((c) => {
        if (!ids.includes(c.id)) return c;
        const next = toggle(c.tags ?? [], tagId, on);
        return { ...c, tags: next.length ? next : undefined };
      }),
    }));
  } else if (target === 'skill') {
    const name = useSkillTags.getState().items.find((t) => t.id === tagId)?.name;
    if (!name) return;
    useSkills.setState((s) => ({ items: s.items.map((k) => (ids.includes(k.id) ? { ...k, tags: toggle(k.tags, name, on) } : k)) }));
  } else {
    useLibrary.setState((s) => ({
      items: s.items.map((c) => {
        if (!ids.includes(c.id)) return c;
        const next = toggle(c.tags ?? [], tagId, on);
        return { ...c, tags: next.length ? next : undefined };
      }),
    }));
  }
}
