/** سجل الأخطاء والأحداث — منطق صرف قابل للاختبار. */
export type LogLevel = 'info' | 'warn' | 'error';
export interface LogEntry { id: number; ts: number; tag: string; msg: string; level: LogLevel }
export const MAX_LOGS = 400;
export const MAX_MSG = 2000;

/** يُخفي المفاتيح والتوكنات قبل الحفظ (روابط ?key= وترويسات Bearer ومفاتيح شائعة) */
export function redact(s: string): string {
  return String(s)
    .replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"']+/gi, '$1***')
    .replace(/(bearer\s+)[A-Za-z0-9._\-~+/=]{8,}/gi, '$1***')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{20,}|xai-[A-Za-z0-9]{8,})/g, '***')
    .replace(/("?(?:api[_-]?key|authorization|x-api-key|password|pass)"?\s*[:=]\s*"?)[^",\s}]{4,}/gi, '$1***');
}

export function makeEntry(id: number, tag: string, msg: unknown, level: LogLevel = 'info', ts = Date.now()): LogEntry {
  const m = msg instanceof Error ? msg.message : typeof msg === 'string' ? msg : (() => { try { return JSON.stringify(msg); } catch { return String(msg); } })();
  return { id, ts, tag: String(tag).slice(0, 16) || 'app', msg: redact(m ?? '').slice(0, MAX_MSG), level };
}

/** يضيف مدخلًا ويحتفظ بآخر `max` فقط. يتجاهل تكرار نفس الرسالة المتتالي خلال ثانيتين */
export function pushLog(list: LogEntry[], e: LogEntry, max = MAX_LOGS): LogEntry[] {
  const last = list[list.length - 1];
  if (last && last.tag === e.tag && last.msg === e.msg && last.level === e.level && e.ts - last.ts < 2000) return list;
  const out = [...list, e];
  return out.length > max ? out.slice(out.length - max) : out;
}

export type LogOrder = 'new' | 'old';
export interface LogView { e: LogEntry; sum: number; delta: number }

/** Σ: الزمن منذ أول مدخل، Δ: منذ المدخل السابق (بالثواني) — يُحسبان على الترتيب الزمني ثم يُرتَّب العرض */
export function viewLogs(list: LogEntry[], q: string, order: LogOrder, errorsOnly = false): { rows: LogView[]; badRegex: boolean } {
  const chrono = [...list].sort((a, b) => a.ts - b.ts || a.id - b.id);
  const t0 = chrono[0]?.ts ?? 0;
  const all: LogView[] = chrono.map((e, i) => ({ e, sum: (e.ts - t0) / 1000, delta: i ? (e.ts - chrono[i - 1].ts) / 1000 : 0 }));
  let test: (s: string) => boolean = () => true;
  let bad = false;
  const needle = q.trim();
  if (needle) {
    try { const re = new RegExp(needle, 'i'); test = (s) => re.test(s); }
    catch { bad = true; const n = needle.toLowerCase(); test = (s) => s.toLowerCase().includes(n); }
  }
  let rows = all.filter((r) => test(`[${r.e.tag}]: ${r.e.msg}`) && (!errorsOnly || r.e.level === 'error'));
  if (order === 'new') rows = rows.reverse();
  return { rows, badRegex: bad };
}

export const fmtHead = (r: LogView) => `${new Date(r.e.ts).toISOString()} Σ:${r.sum.toFixed(3)}s, Δ:${r.delta.toFixed(3)}s`;
export const fmtEntry = (r: LogView) => `${fmtHead(r)}\n[${r.e.tag}]: ${r.e.msg}`;
export const exportLogs = (rows: LogView[]) => rows.map(fmtEntry).join('\n\n');
