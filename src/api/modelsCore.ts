/** صفحة النماذج المتقدمة — منطق صرف: عائلات وقدرات وتقديرات وترشيح وكشف المكررات. */
import type { Endpoint, ModelEntry } from './types';
import { capVision } from './defaultsCore';

export { capVision };
export const LABELS = ['#e5484d', '#f08c3a', '#e5b93a', '#2f9e5a', '#3e8ede', '#9a6ad8'];

export interface Hist { ts: number; ok: boolean; ms: number; err: string; ttft: number; tps: number }
export interface MetaEntry { alias?: string; note?: string; color?: string; hist?: Hist[] }
export interface ModelItem { ep: Endpoint; m: ModelEntry; key: string }
export interface UseEntry { n: number; ts: number }
export type TestState = { busy?: boolean; ok?: boolean; ms?: number; err?: string };

export const mkey = (epId: string, modelId: string) => epId + '|' + modelId;
export const itemsOf = (eps: Endpoint[]): ModelItem[] => eps.flatMap((ep) => ep.models.map((m) => ({ ep, m, key: mkey(ep.id, m.id) })));

/* ---------- تقديرات بحسب الاسم (تقريبية) ---------- */
export const FAMS: [string, RegExp][] = [
  ['GPT', /gpt|chatgpt|(^|[\/\-_:.])o[1-9](-|$|:)|davinci/i], ['Claude', /claude/i], ['Gemini', /gemini|gemma|palm/i], ['Llama', /llama/i],
  ['Qwen', /qwen|qwq/i], ['DeepSeek', /deepseek/i], ['Mistral', /mistral|mixtral|codestral|pixtral|ministral/i], ['Grok', /grok/i],
];
export const famOf = (id: string) => (FAMS.find((f) => f[1].test(id)) || ['أخرى'])[0];
export const capReason = (id: string) =>
  /reason|think|(^|[\/\-_:.])o[1-9](-|$|:)|(^|[\/\-_:.])r1(-|$|:)|qwq|gpt-5|gemini-(2\.5|3)|claude-(opus|sonnet|haiku)-?[45]/i.test(id);

export function ctxOf(id: string): number {
  const s = id.toLowerCase();
  const k = s.match(/(?:^|[^\d.])(\d{1,4})k(?:[^a-z]|$)/);
  if (k && +k[1] >= 8 && +k[1] <= 2000) return +k[1] * 1000;
  if (/gemini-?(1\.5|2|2\.5|3)/.test(s) || /gpt-4\.1/.test(s)) return 1e6;
  if (/gpt-5/.test(s)) return 4e5;
  if (/claude/.test(s)) return 2e5;
  if (/(^|[\/\-_:.])o[134](-|$|:)/.test(s)) return 2e5;
  if (/gpt-4o|gpt-4-turbo|llama-?3\.[1-3]|llama-?4|deepseek|qwen|mistral-(large|small|medium)|mixtral/.test(s)) return 128000;
  if (/grok-?4/.test(s)) return 256000;
  if (/gpt-4/.test(s)) return 8192;
  if (/gpt-3\.5/.test(s)) return 16385;
  return 0;
}
export const fmtCtx = (n: number) => (!n ? '—' : n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : Math.round(n / 1000) + 'K');
export const secs = (ms: number | null | undefined) => (ms == null ? '—' : (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + ' s');
export const estTok = (t: string) => Math.max(1, Math.round(String(t).length / 3.2));
export function ago(ts?: number, now = Date.now()): string {
  if (!ts) return '—';
  const d = (now - ts) / 1000;
  return d < 60 ? 'الآن' : d < 3600 ? 'قبل ' + Math.floor(d / 60) + ' د' : d < 86400 ? 'قبل ' + Math.floor(d / 3600) + ' س' : 'قبل ' + Math.floor(d / 86400) + ' يوم';
}

/* ---------- حالة الاختبار ---------- */
export type Status = 'busy' | 'ok' | 'bad' | 'none';
export const lastOf = (meta?: MetaEntry) => (meta?.hist && meta.hist.length ? meta.hist[meta.hist.length - 1] : null);
export function statusOf(meta: MetaEntry | undefined, t: TestState | undefined): Status {
  if (t?.busy) return 'busy';
  if (t) return t.ok ? 'ok' : 'bad';
  const l = lastOf(meta);
  return l ? (l.ok ? 'ok' : 'bad') : 'none';
}
export function latOf(meta: MetaEntry | undefined, t: TestState | undefined): number | null {
  if (t?.ok) return t.ms ?? null;
  const l = lastOf(meta);
  return l && l.ok ? l.ms : null;
}
/** يضيف نتيجة اختبار للسجل (آخر 10) */
export function addHist(meta: MetaEntry | undefined, r: { ok: boolean; ms?: number; err?: string; ttft?: number; tps?: number }, now = Date.now()): MetaEntry {
  const hist = [...(meta?.hist || []), { ts: now, ok: !!r.ok, ms: r.ms || 0, err: r.ok ? '' : String(r.err || '').slice(0, 140), ttft: r.ttft || 0, tps: r.tps || 0 }];
  return { ...(meta || {}), hist: hist.slice(-10) };
}

/* ---------- الترشيح والترتيب ---------- */
export interface MdUi { tab: 'all' | 'fav' | 'on' | 'used'; ep: string; cap: 'all' | 'reason' | 'vision' | 'params'; st: 'all' | 'ok' | 'bad' | 'none' | 'off'; fam: string; sort: 'name' | 'used' | 'recent' | 'speed' | 'ctx' | 'ep'; q: string }
export const defaultMdUi = (): MdUi => ({ tab: 'all', ep: 'all', cap: 'all', st: 'all', fam: 'all', sort: 'name', q: '' });

export interface FilterCtx {
  meta: Record<string, MetaEntry>;
  fav: Set<string>;
  use: Record<string, UseEntry>;
  tests: Record<string, TestState>;
  hasParams: (key: string) => boolean;
  host: (ep: Endpoint) => string;
}

export function filterModels(all: ModelItem[], ui: MdUi, x: FilterCtx): ModelItem[] {
  const q = ui.q.trim().toLowerCase();
  let a = all;
  if (ui.ep !== 'all') a = a.filter((i) => i.ep.id === ui.ep);
  if (ui.tab === 'fav') a = a.filter((i) => x.fav.has(i.key));
  else if (ui.tab === 'on') a = a.filter((i) => i.m.on && i.ep.enabled);
  else if (ui.tab === 'used') a = a.filter((i) => x.use[i.key]?.n);
  if (ui.cap === 'reason') a = a.filter((i) => capReason(i.m.id));
  else if (ui.cap === 'vision') a = a.filter((i) => capVision(i.m.id));
  else if (ui.cap === 'params') a = a.filter((i) => x.hasParams(i.key));
  if (ui.st !== 'all') a = a.filter((i) => (ui.st === 'off' ? !i.m.on || !i.ep.enabled : statusOf(x.meta[i.key], x.tests[i.key]) === ui.st));
  if (ui.fam !== 'all') a = a.filter((i) => famOf(i.m.id) === ui.fam);
  if (q) a = a.filter((i) => { const mt = x.meta[i.key] || {}; return (i.m.id + ' ' + x.host(i.ep) + ' ' + (mt.alias || '') + ' ' + (mt.note || '')).toLowerCase().includes(q); });
  const byName = (p: ModelItem, r: ModelItem) => p.m.id.localeCompare(r.m.id);
  const L = (k: string) => latOf(x.meta[k], x.tests[k]) ?? 1e9;
  const out = [...a];
  if (ui.sort === 'used') out.sort((p, r) => (x.use[r.key]?.n || 0) - (x.use[p.key]?.n || 0) || byName(p, r));
  else if (ui.sort === 'recent') out.sort((p, r) => (x.use[r.key]?.ts || 0) - (x.use[p.key]?.ts || 0) || byName(p, r));
  else if (ui.sort === 'speed') out.sort((p, r) => L(p.key) - L(r.key) || byName(p, r));
  else if (ui.sort === 'ctx') out.sort((p, r) => ctxOf(r.m.id) - ctxOf(p.m.id) || byName(p, r));
  else if (ui.sort === 'ep') out.sort((p, r) => x.host(p.ep).localeCompare(x.host(r.ep)) || byName(p, r));
  else out.sort((p, r) => Number(x.fav.has(r.key)) - Number(x.fav.has(p.key)) || byName(p, r));
  return out;
}

export const filtersActive = (ui: MdUi) => !!ui.q || ui.cap !== 'all' || ui.ep !== 'all' || ui.st !== 'all' || ui.fam !== 'all';

/* ---------- المكررات ---------- */
/** نماذج بنفس المعرّف عبر أكثر من نقطة */
export function dupGroups(all: ModelItem[]): ModelItem[][] {
  const g = new Map<string, ModelItem[]>();
  all.forEach((i) => g.set(i.m.id, [...(g.get(i.m.id) || []), i]));
  return [...g.values()].filter((a) => a.length > 1);
}
/** مفاتيح ما يُحذف عند التنظيف: يبقى الأول (حسب ترتيب النقاط)، ويُفضَّل المفعّل والنقطة المفعّلة */
export function dedupeKill(all: ModelItem[]): string[] {
  const kill: string[] = [];
  for (const grp of dupGroups(all)) {
    const score = (i: ModelItem) => Number(i.ep.enabled) * 2 + Number(i.m.on);
    const keep = [...grp].sort((a, b) => score(b) - score(a))[0];
    grp.forEach((i) => { if (i !== keep) kill.push(i.key); });
  }
  return kill;
}

/* ---------- المقارنة ---------- */
export interface BenchRes { key: string; ok: boolean; ms: number; ttft: number; tps: number; tokens: number; err?: string }
export function benchBest(rs: BenchRes[]) {
  const ok = rs.filter((r) => r.ok);
  if (!ok.length) return null;
  return { ms: Math.min(...ok.map((r) => r.ms)), ttft: Math.min(...ok.map((r) => r.ttft)), tps: Math.max(...ok.map((r) => r.tps)) };
}
/** الناجح أولًا ثم الأسرع إجمالًا */
export const benchSort = (rs: BenchRes[]) => [...rs].sort((a, b) => Number(b.ok) - Number(a.ok) || a.ms - b.ms);

export const PRESETS: [string, string][] = [
  ['اشرح', 'اشرح لي مفهوم الذكاء الاصطناعي في ثلاث جمل بسيطة.'],
  ['ترجم', 'Translate to Arabic: "The best way to predict the future is to invent it."'],
  ['كود', 'اكتب دالة بلغة Python تتحقق إن كان نص ما palindrome.'],
  ['منطق', 'لدي 3 صناديق، أحدها فيه جائزة. اشرح خطوة بخطوة مسألة مونتي هول.'],
  ['إبداع', 'اكتب قصيدة قصيرة (4 أبيات) عن القمر.'],
];

/* ---------- تصدير/استيراد (بلا مفاتيح) ---------- */
export interface ModelsExport { app: 'quark-ai-models'; v: 1; ts: number; fav: string[]; meta: Record<string, MetaEntry>; endpoints: { id: string; url: string; models: { id: string; on: boolean }[] }[] }
export const buildExport = (eps: Endpoint[], fav: string[], meta: Record<string, MetaEntry>, ts = Date.now()): ModelsExport => ({
  app: 'quark-ai-models', v: 1, ts, fav, meta, endpoints: eps.map((e) => ({ id: e.id, url: e.url, models: e.models.map((m) => ({ id: m.id, on: m.on })) })),
});
/** يطبّق ملفًا مستوردًا: يعيد النماذج الجديدة لكل نقطة والمفضلة والبيانات الناقصة فقط */
export function planImport(d: any, eps: Endpoint[], haveMeta: Record<string, MetaEntry>) {
  if (!d || d.app !== 'quark-ai-models') throw new Error('ملف غير صالح');
  const norm = (u: string) => String(u).replace(/\/+$/, '');
  const add: { ep: string; id: string; on: boolean }[] = [];
  for (const se of d.endpoints || []) {
    const ep = eps.find((e) => e.id === se.id) || eps.find((e) => norm(e.url) === norm(se.url));
    if (!ep) continue;
    for (const m of se.models || []) if (m && m.id && !ep.models.some((x) => x.id === m.id) && !add.some((a) => a.ep === ep.id && a.id === m.id)) add.push({ ep: ep.id, id: String(m.id), on: m.on !== false });
  }
  const meta: Record<string, MetaEntry> = {};
  Object.entries(d.meta || {}).forEach(([k, v]) => { if (!haveMeta[k]) meta[k] = v as MetaEntry; });
  return { add, fav: (d.fav || []).map(String) as string[], meta };
}
