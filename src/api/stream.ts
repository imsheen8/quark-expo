import { fetch as xfetch } from 'expo/fetch';
import { httpErrorText, netErrorText } from './errors';
import { buildRequest, modelsRequest, rejectedField, type BuildArgs } from './payload';
import { LineBuffer, parseEvent, parseFull, parseModelList, sseData } from './parsers';
import { localModelIds, localStream } from './local';
import type { Chunk, Endpoint } from './types';

type Args = Omit<BuildArgs, 'stream' | 'drop'> & { signal?: AbortSignal };

async function post(ep: Endpoint, a: BuildArgs, signal?: AbortSignal) {
  const drop = new Set(a.drop ?? []);
  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const req = buildRequest({ ...a, drop });
    let res: Awaited<ReturnType<typeof xfetch>>;
    try {
      res = await xfetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal });
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e;
      throw new Error(netErrorText(e, req.url));
    }
    if (res.ok) return res;
    const body = await res.text().catch(() => '');
    lastErr = httpErrorText(res.status, body);
    // إصلاح تلقائي: إن رفض المزوّد حقلًا نعيد الطلب بدونه
    const bad = res.status === 400 || res.status === 422 ? rejectedField(lastErr) : null;
    if (bad && !drop.has(bad)) {
      drop.add(bad);
      continue;
    }
    throw new Error(lastErr);
  }
  throw new Error(lastErr);
}

/** بث رد النموذج كشرائح نص/تفكير/استهلاك */
export async function* chatStream(a: Args): AsyncGenerator<Chunk> {
  const { ep, signal } = a;
  if (ep.proto === 'llama') {
    yield* localStream({ ep, model: a.model, messages: a.messages, system: a.system, params: a.params, signal });
    return;
  }
  const res = await post(ep, { ...a, stream: true }, signal);
  if (!res.body) {
    // لا يوجد بث على هذه المنصة: نقرأ الرد كاملًا
    const txt = await res.text();
    const t = parseFull(ep.proto, safeJson(txt));
    if (t) yield { kind: 'text', text: t };
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const lb = new LineBuffer();
  const handle = function* (line: string): Generator<Chunk> {
    let payload: string | null;
    if (ep.proto === 'ollama') payload = line.trim() || null;
    else payload = sseData(line);
    if (!payload || payload === '[DONE]') return;
    const j = safeJson(payload);
    if (!j) return;
    yield* parseEvent(ep.proto, j);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const l of lb.push(dec.decode(value, { stream: true }))) yield* handle(l);
    }
    for (const l of lb.flush()) yield* handle(l);
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}

/** طلب واحد غير متدفّق (للعناوين التلقائية والاختبار) */
export async function completeOnce(a: Args): Promise<string> {
  if (a.ep.proto === 'llama') {
    let t = '';
    for await (const ch of localStream({ ep: a.ep, model: a.model, messages: a.messages, system: a.system, params: a.params, signal: a.signal })) if (ch.kind === 'text') t += ch.text;
    return t;
  }
  const res = await post(a.ep, { ...a, stream: false }, a.signal);
  return parseFull(a.ep.proto, safeJson(await res.text()));
}

export async function fetchModels(ep: Endpoint, signal?: AbortSignal): Promise<string[]> {
  if (ep.proto === 'llama') return localModelIds();
  const r = modelsRequest(ep);
  let res;
  try {
    res = await xfetch(r.url, { headers: r.headers, signal });
  } catch (e) {
    throw new Error(netErrorText(e, r.url));
  }
  const txt = await res.text();
  if (!res.ok) throw new Error(httpErrorText(res.status, txt));
  return parseModelList(ep.proto, safeJson(txt));
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
