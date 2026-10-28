/** النماذج على الجهاز: التنزيل من Hugging Face، التخزين، التحميل في llama.cpp (عبر llama.rn) والبث. */
import * as FS from 'expo-file-system/legacy';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '../store/storage';
import { useSettings } from '../store/settings';
import { cleanRepo, fit, hfFileUrl, pickVariant, slug, validRepo, variantsFromFiles, paramsFromName, type RepoFile, type Variant } from './localCore';
import type { Chunk, Endpoint, Params, WireMsg } from './types';

export const LOCAL_EP = 'local';
const DIR = (FS.documentDirectory || '') + 'models/';

export interface LocalModel {
  id: string; name: string; repo: string; quant: string;
  /** مسارات الملفات داخل مجلد النماذج (الأول هو الذي يُحمَّل) */
  files: string[];
  size: number; params: number; ctx: number; added: number;
}

interface LocalState {
  models: LocalModel[];
  hfToken: string;
  hfBase: string;
  add: (m: LocalModel) => void;
  remove: (id: string) => void;
  patch: (p: Partial<Pick<LocalState, 'hfToken' | 'hfBase'>>) => void;
}
export const useLocal = create<LocalState>()(
  persist(
    (set) => ({
      models: [],
      hfToken: '',
      hfBase: 'https://huggingface.co',
      add: (m) => set((s) => ({ models: [m, ...s.models.filter((x) => x.id !== m.id)] })),
      remove: (id) => set((s) => ({ models: s.models.filter((x) => x.id !== id) })),
      patch: (p) => set(p),
    }),
    { name: 'ai_local_v1', storage: persistStorage, version: 1 },
  ),
);

export interface Dl { id: string; name: string; done: number; total: number; state: 'run' | 'paused' | 'error'; err?: string }
interface DlState { items: Record<string, Dl>; set: (id: string, d: Dl | null) => void }
export const useDownloads = create<DlState>((set) => ({
  items: {},
  set: (id, d) => set((s) => { const n = { ...s.items }; if (d) n[id] = d; else delete n[id]; return { items: n }; }),
}));

/* ---------- الجهاز ---------- */
export function deviceRamGB(): number {
  try {
    const D = require('expo-device');
    if (D.totalMemory) return D.totalMemory / 1024 ** 3;
  } catch {}
  return 6;
}
export const engineAvailable = (): boolean => {
  try { const m = require('llama.rn'); return !!m?.initLlama; } catch { return false; }
};

/* ---------- Hugging Face ---------- */
const hfHeaders = () => {
  const t = useLocal.getState().hfToken.trim();
  return { accept: 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) };
};
const hfBase = () => useLocal.getState().hfBase.replace(/\/+$/, '') || 'https://huggingface.co';

async function jget(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { headers: hfHeaders(), signal });
  if (r.status === 401 || r.status === 403) throw new Error('المستودع يتطلب تسجيل دخول Hugging Face (أضف الرمز من إعدادات التنزيل).');
  if (r.status === 404) throw new Error('لم يُعثر على المستودع.');
  if (!r.ok) throw new Error('تعذّر الاتصال بـ Hugging Face (' + r.status + ').');
  return r.json();
}

export async function resolveRepo(repoInput: string, signal?: AbortSignal): Promise<{ repo: string; variants: Variant[] }> {
  const repo = cleanRepo(repoInput);
  if (!validRepo(repo)) throw new Error('اسم مستودع غير صالح (owner/name).');
  const j = await jget(`${hfBase()}/api/models/${repo}/tree/main?recursive=true&expand=false`, signal);
  const files: RepoFile[] = (Array.isArray(j) ? j : []).filter((x: any) => x.type === 'file' || !x.type).map((x: any) => ({ path: x.path, size: x.lfs?.size ?? x.size ?? 0 }));
  const variants = variantsFromFiles(files);
  if (!variants.length) throw new Error('لا توجد ملفات GGUF مناسبة في هذا المستودع.');
  return { repo, variants };
}

export interface HfHit { repo: string; downloads: number; likes: number; params: number; gated: boolean }
export async function searchHf(q: string, signal?: AbortSignal): Promise<HfHit[]> {
  const qs = new URLSearchParams({ filter: 'gguf', sort: 'downloads', direction: '-1', limit: '24' });
  if (q.trim()) qs.set('search', q.trim());
  const j = await jget(`${hfBase()}/api/models?${qs}`, signal);
  return (Array.isArray(j) ? j : []).map((m: any) => ({ repo: m.id || m.modelId, downloads: m.downloads || 0, likes: m.likes || 0, gated: !!m.gated, params: paramsFromName(m.id || m.modelId || '') })).filter((m) => m.repo);
}

/* ---------- التنزيل ---------- */
const active = new Map<string, { cancel: boolean; cur?: FS.DownloadResumable }>();

async function ensureDir() {
  const i = await FS.getInfoAsync(DIR);
  if (!i.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true });
}

export interface DlRequest { repo: string; name: string; variant: Variant; params: number }

export async function startDownload(r: DlRequest): Promise<void> {
  const id = slug(`${r.repo.split('/')[1] || r.repo}-${r.variant.quant}`) || slug(r.repo);
  if (active.has(id)) return;
  const D = useDownloads.getState();
  const total = r.variant.size;
  try {
    await ensureDir();
    const free = await FS.getFreeDiskStorageAsync().catch(() => 0);
    if (free && total && free < total * 1.1) throw new Error(`المساحة الحرة غير كافية (${(free / 1024 ** 3).toFixed(1)} GB) — يلزم ≈${(total / 1024 ** 3).toFixed(1)} GB.`);
    const st = { cancel: false } as { cancel: boolean; cur?: FS.DownloadResumable };
    active.set(id, st);
    D.set(id, { id, name: r.name, done: 0, total, state: 'run' });
    const saved: string[] = [];
    let doneBefore = 0;
    for (const f of r.variant.files) {
      const fname = `${id}__${f.path.split('/').pop()}`;
      const target = DIR + fname;
      const info = await FS.getInfoAsync(target);
      if (info.exists && (!f.size || (info as any).size === f.size)) { doneBefore += f.size; saved.push(fname); continue; }
      const t = useLocal.getState().hfToken.trim();
      const dl = FS.createDownloadResumable(hfFileUrl(r.repo, f.path, hfBase()), target + '.part', { headers: t ? { authorization: 'Bearer ' + t } : {} }, (p) => {
        useDownloads.getState().set(id, { id, name: r.name, done: doneBefore + p.totalBytesWritten, total: total || doneBefore + p.totalBytesExpectedToWrite, state: 'run' });
      });
      st.cur = dl;
      const res = await dl.downloadAsync();
      if (st.cancel) throw new Error('__cancel__');
      if (!res || res.status >= 400) throw new Error(res?.status === 401 || res?.status === 403 ? 'يتطلب هذا النموذج رمز Hugging Face (وقبول شروطه في الموقع).' : `فشل التنزيل (${res?.status ?? '؟'})`);
      await FS.moveAsync({ from: target + '.part', to: target });
      doneBefore += f.size;
      saved.push(fname);
    }
    const ram = deviceRamGB();
    const ft = fit(total, r.params, ram);
    useLocal.getState().add({ id, name: r.name, repo: r.repo, quant: r.variant.quant, files: saved, size: total, params: r.params, ctx: ft.ctx, added: Date.now() });
    ensureLocalEndpoint();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === '__cancel__') {
      for (const f of r.variant.files) await FS.deleteAsync(DIR + `${id}__${f.path.split('/').pop()}.part`, { idempotent: true }).catch(() => {});
      useDownloads.getState().set(id, null);
    } else useDownloads.getState().set(id, { id, name: r.name, done: 0, total, state: 'error', err: msg });
  } finally {
    active.delete(id);
    if (!useDownloads.getState().items[id]?.err) useDownloads.getState().set(id, null);
  }
}

export async function cancelDownload(id: string) {
  const a = active.get(id);
  if (!a) { useDownloads.getState().set(id, null); return; }
  a.cancel = true;
  try { await a.cur?.cancelAsync(); } catch {}
}

export async function deleteModel(id: string) {
  const m = useLocal.getState().models.find((x) => x.id === id);
  if (!m) return;
  if (loaded?.id === id) await unloadModel();
  for (const f of m.files) await FS.deleteAsync(DIR + f, { idempotent: true }).catch(() => {});
  useLocal.getState().remove(id);
  const st = useSettings.getState();
  if (st.sel?.ep === LOCAL_EP && st.sel.model === id) st.patch({ sel: null });
  ensureLocalEndpoint();
}

/** نقطة اتصال «على الجهاز»: نماذجها هي المنزَّلة */
export function ensureLocalEndpoint() {
  const ms = useLocal.getState().models;
  const st = useSettings.getState();
  const ex = st.endpoints.find((e) => e.id === LOCAL_EP);
  const models = ms.map((m) => ({ id: m.id, on: true }));
  if (!ex && !ms.length) return;
  if (!ex) {
    useSettings.setState((s) => ({
      endpoints: [...s.endpoints, { id: LOCAL_EP, preset: 'local', label: 'على الجهاز', url: 'local://llama.cpp', key: '', proto: 'llama', kind: 'local', enabled: true, models } as Endpoint],
      sel: s.sel ?? (ms[0] ? { ep: LOCAL_EP, model: ms[0].id } : null),
    }));
  } else useSettings.getState().updateEndpoint(LOCAL_EP, { models, enabled: true });
}

/* ---------- التشغيل ---------- */
let loaded: { id: string; ctx: any } | null = null;
let loading: Promise<any> | null = null;

export async function unloadModel() {
  const l = loaded;
  loaded = null;
  try { await l?.ctx.release(); } catch {}
}

const NEED_BUILD = 'محرك النماذج المحلية يحتاج نسخة مبنيّة (Development Build) وليس Expo Go. راجع README → «النماذج على الجهاز».';

async function getContext(id: string) {
  if (loaded?.id === id) return loaded.ctx;
  if (loading) await loading.catch(() => {});
  if (loaded?.id === id) return loaded.ctx;
  const m = useLocal.getState().models.find((x) => x.id === id);
  if (!m) throw new Error('النموذج غير منزَّل على هذا الجهاز.');
  let mod: any;
  try { mod = require('llama.rn'); } catch { throw new Error(NEED_BUILD); }
  if (!mod?.initLlama) throw new Error(NEED_BUILD);
  loading = (async () => {
    await unloadModel();
    const path = (DIR + m.files[0]).replace(/^file:\/\//, '');
    const ftx = fit(m.size, m.params, deviceRamGB());
    try {
      const ctx = await mod.initLlama({ model: path, n_ctx: Math.min(m.ctx || ftx.ctx, 8192), n_gpu_layers: 0, use_mlock: false });
      loaded = { id, ctx };
      return ctx;
    } catch (e) {
      throw new Error('تعذّر تحميل النموذج في الذاكرة (قد يكون كبيرًا على جهازك): ' + (e instanceof Error ? e.message : String(e)).slice(0, 160));
    }
  })();
  try { return await loading; } finally { loading = null; }
}

export async function* localStream(a: { ep: Endpoint; model: string; messages: WireMsg[]; system: string; params: Params; signal?: AbortSignal }): AsyncGenerator<Chunk> {
  const ctx = await getContext(a.model);
  const msgs = [...(a.system ? [{ role: 'system', content: a.system }] : []), ...a.messages.map((m) => ({ role: m.role, content: m.content }))];
  const q: Chunk[] = [];
  let finished = false;
  let error: unknown = null;
  let wake: (() => void) | null = null;
  const push = (c: Chunk) => { q.push(c); wake?.(); };
  const onAbort = () => { void ctx.stopCompletion?.(); };
  a.signal?.addEventListener('abort', onAbort);
  const run = ctx
    .completion(
      { messages: msgs, n_predict: a.params.max_tokens ?? 1024, temperature: a.params.temperature ?? 0.7, top_p: a.params.top_p ?? 0.9, jinja: true },
      (d: any) => { if (d?.token) push({ kind: 'text', text: d.token }); },
    )
    .then((r: any) => { const t = r?.timings; if (t) push({ kind: 'usage', usage: { in: t.prompt_n, out: t.predicted_n } }); })
    .catch((e: unknown) => { error = e; })
    .finally(() => { finished = true; wake?.(); });
  try {
    for (;;) {
      if (q.length) { yield q.shift()!; continue; }
      if (finished) break;
      await new Promise<void>((r) => { wake = r; });
      wake = null;
    }
    await run;
    if (error && !a.signal?.aborted) throw new Error('فشل التوليد المحلي: ' + (error instanceof Error ? error.message : String(error)));
    if (a.signal?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
  } finally {
    a.signal?.removeEventListener('abort', onAbort);
  }
}

export const localModelIds = () => useLocal.getState().models.map((m) => m.id);

/** اختيار الصيغة الأنسب لجهازك من قائمة صيغ */
export function suggestVariant(vars: Variant[]): Variant | null {
  const ram = deviceRamGB();
  return pickVariant(vars, Math.max(0.8, ram * 0.5) * 1024 ** 3 * 0.55);
}
