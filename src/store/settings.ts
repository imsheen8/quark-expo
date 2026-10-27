import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SYSTEM, PRESETS } from '../api/providers';
import type { Endpoint, ModelEntry, Params, ThinkingMode } from '../api/types';
import { uid } from '../lib/util';
import { defaultAgent, type AgentConf } from '../api/agentCore';
import { DEFAULT_SEARCH, type SearchConf } from '../api/web';
import { persistStorage } from './storage';

export interface Profile {
  name: string;
  nick: string;
  prefs: string;
}

export interface SettingsState {
  endpoints: Endpoint[];
  sel: { ep: string; model: string } | null;
  theme: 'auto' | 'light' | 'dark';
  themeSel: { dark: string; light: string };
  fontSize: 'sm' | 'md' | 'lg';
  systemPrompt: string;
  autoTitle: boolean;
  thinking: ThinkingMode;
  params: { global: Params; models: Record<string, Params> };
  profile: Profile;
  memory: { enabled: boolean; auto: boolean; max: number };
  activePersonaId: string | null;
  introOn: boolean;
  haptics: boolean;
  onboarded: boolean;
  search: SearchConf;
  agent: AgentConf;
  /** بوابة بايثون للبريد */
  gw: { url: string; token: string };
  /** أوضاع المحادثة الحالية */
  modes: { web: boolean; agent: boolean; research: boolean; compare: boolean };
  /** النموذج الثاني للمقارنة */
  cmpSel: { ep: string; model: string } | null;
  /** الحساب المُدار (QUARK) */
  managed: { token: string; email: string; name: string; plan: string; ep: string };
  sync: { on: boolean; last: number; auto: boolean };
  /** تصفية قائمة المحادثات: recent|today|week|month|fav|tag:<id> */
  chatFilter: string;

  patch: (p: Partial<SettingsState>) => void;
  addEndpoint: (e: Omit<Endpoint, 'id'>) => string;
  updateEndpoint: (id: string, p: Partial<Endpoint>) => void;
  removeEndpoint: (id: string) => void;
  setModels: (epId: string, ids: string[], enableNew?: boolean) => void;
  toggleModel: (epId: string, modelId: string, on?: boolean) => void;
  addModel: (epId: string, modelId: string) => void;
  select: (epId: string, model: string) => void;
  setGlobalParams: (p: Params) => void;
  setModelParams: (key: string, p: Params | null) => void;
}

export const modelKey = (epId: string, model: string) => epId + '|' + model;

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      endpoints: [],
      sel: null,
      theme: 'auto',
      themeSel: { dark: 'default', light: 'default' },
      fontSize: 'md',
      systemPrompt: DEFAULT_SYSTEM,
      autoTitle: true,
      thinking: 'auto',
      params: { global: {}, models: {} },
      profile: { name: '', nick: '', prefs: '' },
      memory: { enabled: true, auto: true, max: 8 },
      activePersonaId: null,
      introOn: true,
      haptics: true,
      onboarded: false,
      search: DEFAULT_SEARCH,
      agent: defaultAgent(),
      gw: { url: '', token: '' },
      modes: { web: false, agent: false, research: false, compare: false },
      cmpSel: null,
      managed: { token: '', email: '', name: '', plan: 'free', ep: '' },
      sync: { on: false, last: 0, auto: true },
      chatFilter: 'recent',

      patch: (p) => set(p),

      addEndpoint: (e) => {
        const id = 'e' + uid(7);
        set((s) => ({ endpoints: [...s.endpoints, { ...e, id }] }));
        return id;
      },
      updateEndpoint: (id, p) => set((s) => ({ endpoints: s.endpoints.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
      removeEndpoint: (id) =>
        set((s) => ({ endpoints: s.endpoints.filter((e) => e.id !== id), sel: s.sel?.ep === id ? null : s.sel })),

      setModels: (epId, ids, enableNew = false) =>
        set((s) => ({
          endpoints: s.endpoints.map((e) => {
            if (e.id !== epId) return e;
            const old = new Map(e.models.map((m) => [m.id, m]));
            const merged: ModelEntry[] = ids.map((id) => old.get(id) ?? { id, on: enableNew });
            // نبقي النماذج المضافة يدويًا
            e.models.forEach((m) => {
              if (!ids.includes(m.id) && m.on) merged.push(m);
            });
            return { ...e, models: merged };
          }),
        })),
      toggleModel: (epId, modelId, on) =>
        set((s) => ({
          endpoints: s.endpoints.map((e) =>
            e.id === epId ? { ...e, models: e.models.map((m) => (m.id === modelId ? { ...m, on: on ?? !m.on } : m)) } : e,
          ),
        })),
      addModel: (epId, modelId) =>
        set((s) => ({
          endpoints: s.endpoints.map((e) => {
            if (e.id !== epId) return e;
            const ex = e.models.find((m) => m.id === modelId);
            return { ...e, models: ex ? e.models.map((m) => (m.id === modelId ? { ...m, on: true } : m)) : [{ id: modelId, on: true }, ...e.models] };
          }),
        })),
      select: (epId, model) => set({ sel: { ep: epId, model } }),
      setGlobalParams: (p) => set((s) => ({ params: { ...s.params, global: p } })),
      setModelParams: (key, p) =>
        set((s) => {
          const models = { ...s.params.models };
          if (p && Object.keys(p).length) models[key] = p;
          else delete models[key];
          return { params: { ...s.params, models } };
        }),
    }),
    {
      name: 'ai_settings_v3',
      storage: persistStorage,
      version: 2,
      migrate: (old: any) => ({ ...old }),
      merge: (saved: any, cur: any) => ({
        ...cur,
        ...saved,
        search: { ...cur.search, ...(saved?.search || {}) },
        agent: { ...cur.agent, ...(saved?.agent || {}), tools: { ...cur.agent.tools, ...(saved?.agent?.tools || {}) } },
        gw: { ...cur.gw, ...(saved?.gw || {}) },
        modes: { ...cur.modes, ...(saved?.modes || {}) },
        managed: { ...cur.managed, ...(saved?.managed || {}) },
        sync: { ...cur.sync, ...(saved?.sync || {}) },
      }),
    },
  ),
);

export function activeModel(): { ep: Endpoint; model: string } | null {
  const { sel, endpoints } = useSettings.getState();
  const ep = sel && endpoints.find((e) => e.id === sel.ep);
  return ep && ep.enabled && sel.model ? { ep, model: sel.model } : null;
}

/** ينشئ نقطة اتصال من إعداد جاهز */
export function endpointFromPreset(preset: string, key = '', url?: string): Omit<Endpoint, 'id'> {
  const p = PRESETS[preset] ?? PRESETS.custom;
  return { preset, label: p.label, url: url ?? p.url, key, proto: p.proto, kind: p.kind, enabled: true, models: [] };
}
