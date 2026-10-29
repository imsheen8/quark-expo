import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SYSTEM, PRESETS } from '../api/providers';
import type { Endpoint, ModelEntry, Params, ThinkingMode } from '../api/types';
import { uid } from '../lib/util';
import { defaultAgent, type AgentConf } from '../api/agentCore';
import { DEFAULT_SEARCH, type SearchConf } from '../api/web';
import { persistStorage } from './storage';
import { defaultSkillsConf, type SkillsConf } from '../api/skillsCore';
import { defaultDefs, normDefs, type Defs } from '../api/defaultsCore';

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
  skills: SkillsConf;
  /** النماذج التلقائية لكل مهمة */
  defs: Defs;
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
  /** يحذف نماذج من قوائمها (مفاتيح ep|model) وينظّف الاختيار والمعاملات */
  removeModels: (keys: string[]) => void;
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
      skills: defaultSkillsConf(),
      defs: defaultDefs(),
      activePersonaId: null,
      introOn: true,
      haptics: true,
      onboarded: false,
      search: DEFAULT_SEARCH,
      agent: defaultAgent(),
      gw: { url: '', token: '' },
      modes: { web: false, agent: false, research: false, compare: false },
      cmpSel: null,
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
      removeModels: (keys) =>
        set((s) => {
          const kill = new Set(keys);
          const endpoints = s.endpoints.map((e) => ({ ...e, models: e.models.filter((m) => !kill.has(e.id + '|' + m.id)) }));
          const models = { ...s.params.models };
          keys.forEach((k) => delete models[k]);
          let sel = s.sel && kill.has(s.sel.ep + '|' + s.sel.model) ? null : s.sel;
          if (!sel) for (const e of endpoints) { const m = e.enabled && e.models.find((x) => x.on); if (m) { sel = { ep: e.id, model: m.id }; break; } }
          const cmp = s.cmpSel && kill.has(s.cmpSel.ep + '|' + s.cmpSel.model);
          return { endpoints, sel, params: { ...s.params, models }, ...(cmp ? { cmpSel: null, modes: { ...s.modes, compare: false } } : {}) };
        }),
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
      merge: (saved: any, cur: any) => {
        // نسخ قديمة: حساب QUARK المُدار والمزامنة حُذفا — نُنظّف بقاياهما (التوكن ونقطة «managed»)
        const { managed: _m, sync: _s, ...rest } = saved || {};
        const eps = Array.isArray(rest.endpoints) ? rest.endpoints.filter((e: any) => e?.id !== 'managed') : rest.endpoints;
        const sel = rest.sel?.ep === 'managed' ? null : rest.sel;
        saved = { ...rest, ...(eps ? { endpoints: eps } : {}), ...(rest.sel !== undefined ? { sel } : {}) };
        return {
        ...cur,
        ...saved,
        search: { ...cur.search, ...(saved?.search || {}) },
        agent: { ...cur.agent, ...(saved?.agent || {}), tools: { ...cur.agent.tools, ...(saved?.agent?.tools || {}) } },
        gw: { ...cur.gw, ...(saved?.gw || {}) },
        modes: { ...cur.modes, ...(saved?.modes || {}) },
        skills: { ...cur.skills, ...(saved?.skills || {}) },
        defs: normDefs(saved?.defs),
        };
      },
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
