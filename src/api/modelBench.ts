/** تشغيل نموذج مع قياس الأداء: اختبار الاتصال وساحة التجربة والمقارنة. */
import { useModelMeta, useModelTests } from '../store/modelMeta';
import { estTok, mkey, type ModelItem } from './modelsCore';
import { splitThink } from './parsers';
import { chatStream, completeOnce } from './stream';
import { mergeUsage } from './parsers';
import type { Usage } from './types';
import { log } from '../store/logs';

const niceErr = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return m.slice(0, 160);
};

export interface RunResult { ok: true; ms: number; ttft: number; out: string; think: string; tps: number; tokens: number }

export async function runModel(
  it: ModelItem, prompt: string, opts: { temperature?: number; max_tokens?: number }, onChunk: ((out: string, think: string) => void) | null, signal?: AbortSignal,
): Promise<RunResult> {
  const t0 = Date.now();
  let first = 0, raw = '', reason = '';
  let usage: Partial<Usage> = {};
  const params: Record<string, number> = {};
  if (opts.temperature != null) params.temperature = opts.temperature;
  if (opts.max_tokens) params.max_tokens = opts.max_tokens;
  for await (const ch of chatStream({ ep: it.ep, model: it.m.id, messages: [{ role: 'user', content: prompt }], system: '', params, signal })) {
    if (ch.kind === 'text') raw += ch.text;
    else if (ch.kind === 'think') reason += ch.text;
    else usage = mergeUsage(usage as Usage, ch.usage);
    if (!first) first = Date.now() - t0;
    if (onChunk) { const sp = splitThink(raw); onChunk(sp.ans, [reason, sp.think].filter(Boolean).join('\n\n')); }
  }
  const ms = Date.now() - t0;
  const sp = splitThink(raw);
  const think = [reason, sp.think].filter(Boolean).join('\n\n');
  const tokens = usage.out ?? estTok(sp.ans + think);
  const gen = Math.max(ms - first, 1);
  return { ok: true, ms, ttft: first, out: sp.ans, think, tps: Math.round(tokens / (gen / 1000)), tokens };
}

/** يسجّل نتيجة تشغيل (حيّة + سجل دائم) */
export function noteResult(key: string, r: { ok: boolean; ms?: number; err?: string; ttft?: number; tps?: number }) {
  useModelTests.getState().set(key, r.ok ? { ok: true, ms: r.ms } : { ok: false, err: r.err });
  useModelMeta.getState().record(key, r);
}

/** اختبار اتصال سريع بكلمة واحدة (مهلة 25 ثانية، و3 دقائق للمحلي) */
export async function testModel(it: ModelItem): Promise<boolean> {
  const { ep, m } = it;
  const key = it.key || mkey(ep.id, m.id);
  const T = useModelTests.getState();
  if (ep.kind !== 'local' && ep.proto !== 'llama' && !ep.key) { noteResult(key, { ok: false, err: 'لا يوجد مفتاح API لهذه النقطة' }); return false; }
  T.set(key, { busy: true });
  const ctl = new AbortController();
  const local = ep.proto === 'llama';
  const tm = setTimeout(() => ctl.abort(), local ? 180000 : 25000);
  const t0 = Date.now();
  try {
    await completeOnce({ ep, model: m.id, messages: [{ role: 'user', content: 'Reply with the single word: OK' }], system: '', params: { max_tokens: 20 }, signal: ctl.signal });
    noteResult(key, { ok: true, ms: Date.now() - t0 });
    return true;
  } catch (e) {
    noteResult(key, { ok: false, err: (e as any)?.name === 'AbortError' ? 'انتهت المهلة' : niceErr(e) });
    log('test', `${m.id} · ${(e as any)?.name === 'AbortError' ? 'انتهت المهلة' : niceErr(e)}`, 'warn');
    return false;
  } finally {
    clearTimeout(tm);
  }
}

/** اختبار قائمة بثلاثة عمّال متوازين */
export async function testMany(list: ModelItem[]): Promise<{ ok: number; bad: number }> {
  const q = [...list];
  let ok = 0, bad = 0;
  const worker = async () => { for (let it; (it = q.shift()); ) (await testModel(it)) ? ok++ : bad++; };
  await Promise.all([worker(), worker(), worker()]);
  return { ok, bad };
}

export { niceErr };
