/** جسر تنفيذ جافاسكريبت المعزول: المكوّن JsSandbox (WebView مخفي + Worker) يسجّل نفسه هنا، والوكيل يستدعي runJs. */

type Runner = (id: string, code: string, ms: number) => void;
type Canceller = (id: string) => void;

let runner: Runner | null = null;
let canceller: Canceller | null = null;
let ready: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
const pending = new Map<string, { res: (s: string) => void; rej: (e: Error) => void; timer: ReturnType<typeof setTimeout>; acc: string; onLog?: (acc: string) => void }>();
let seq = 0;

export const MAX_JS_OUT = 6000;
export const JS_TIMEOUT = 10_000;

export const sandboxBridge = {
  /** يُستدعى من المكوّن عند تحميل الصفحة */
  attach(fn: Runner, cancel?: Canceller) {
    runner = fn;
    canceller = cancel ?? null;
    ready = new Promise<void>((r) => { resolveReady = r; });
  },
  markReady() { resolveReady?.(); },
  detach() {
    runner = null;
    canceller = null;
    ready = null;
    for (const [, p] of pending) { clearTimeout(p.timer); p.rej(new Error('أُغلقت بيئة التنفيذ.')); }
    pending.clear();
  },
  /** رسالة واردة من الصفحة: {id, ok, out} */
  onMessage(raw: string) {
    let m: any;
    try { m = JSON.parse(raw); } catch { return; }
    const p = m && pending.get(String(m.id));
    if (!p) return;
    if (m.log !== undefined) { p.acc = (p.acc + String(m.log) + '\n').slice(-MAX_JS_OUT); p.onLog?.(p.acc); return; }
    pending.delete(String(m.id));
    clearTimeout(p.timer);
    const out = String(m.out ?? '').slice(0, MAX_JS_OUT);
    if (m.ok) p.res(out || '(لا مخرجات — استخدم console.log لطباعة النتيجة)');
    else p.rej(new Error(out || 'فشل التنفيذ'));
  },
};

/** ينفّذ الكود في البيئة المعزولة ويعيد المخرجات، أو يرمي خطأً عربيًا */
export async function runJs(code: string, signal?: AbortSignal, ms = JS_TIMEOUT, onLog?: (acc: string) => void): Promise<string> {
  if (!code.trim()) throw new Error('الكود فارغ.');
  if (!runner || !ready) throw new Error('بيئة تنفيذ الجافاسكريبت غير جاهزة. فعّل وضع الوكيل وأداة «تنفيذ جافاسكريبت» ثم أعد المحاولة.');
  const wait = new Promise<void>((_, rej) => setTimeout(() => rej(new Error('تعذّر تهيئة بيئة التنفيذ.')), 8000));
  await Promise.race([ready, wait]);
  const id = 'js' + ++seq;
  return new Promise<string>((res, rej) => {
    const timer = setTimeout(() => { pending.delete(id); rej(new Error('انتهت مهلة التنفيذ.')); }, ms + 3000);
    pending.set(id, { res, rej, timer, acc: '', onLog });
    signal?.addEventListener('abort', () => { const p = pending.get(id); if (p) { pending.delete(id); clearTimeout(p.timer); try { canceller?.(id); } catch {} rej(Object.assign(new Error('أُلغي التنفيذ.'), { name: 'AbortError' })); } }, { once: true });
    try { runner!(id, code, ms); } catch (e) { pending.delete(id); clearTimeout(timer); rej(e instanceof Error ? e : new Error(String(e))); }
  });
}
