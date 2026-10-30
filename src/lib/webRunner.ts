/** جسر تشغيل صفحة ويب في متصفح مخفي: المكوّن WebRunner يسجّل نفسه هنا، والوكيل يستدعي runWebPage ويحصل على أخطاء وقت التشغيل. */
export type RunMsg = { t: string; m: string };
type Job = { id: number; html: string } | null;

let listener: ((j: Job) => void) | null = null;
let seq = 0;
let cur: { id: number; msgs: RunMsg[]; loaded: boolean; loadedAt: number } | null = null;

export const webRunBridge = {
  attach(fn: (j: Job) => void) { listener = fn; },
  detach() { listener = null; },
  onMessage(id: number, raw: string) {
    if (!cur || cur.id !== id) return;
    try {
      const m = JSON.parse(raw);
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'load') { cur.loaded = true; cur.loadedAt = Date.now(); } else if (cur.msgs.length < 100) cur.msgs.push({ t: m.t, m: String(m.m ?? '') });
    } catch { /* رسالة غير مفهومة */ }
  },
};

export const RUN_MIN = 500;
export const RUN_MAX = 8000;

export function runWebPage(html: string, waitMs = 2500, signal?: AbortSignal): Promise<{ msgs: RunMsg[]; loaded: boolean }> {
  if (!listener) return Promise.reject(new Error('بيئة تشغيل الصفحات غير جاهزة. فعّل وضع الوكيل ثم أعد المحاولة.'));
  if (cur) return Promise.reject(new Error('هناك تشغيل آخر جارٍ؛ انتظر انتهاءه.'));
  const wait = Math.min(RUN_MAX, Math.max(RUN_MIN, Math.round(waitMs) || 2500));
  const id = ++seq;
  const job = { id, msgs: [] as RunMsg[], loaded: false, loadedAt: 0 };
  cur = job;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const end = () => { clearInterval(poll); listener?.(null); if (cur === job) cur = null; };
    const poll = setInterval(() => {
      const now = Date.now();
      // ننتهي بعد المهلة، أو بعد تحميل الصفحة وانقضاء فترة هدوء قصيرة لالتقاط أخطاء ما بعد التحميل
      if ((job.loaded && now - job.loadedAt >= Math.min(wait, 1500)) || now - start >= wait + 3000) { end(); resolve({ msgs: job.msgs, loaded: job.loaded }); }
    }, 100);
    signal?.addEventListener('abort', () => { end(); reject(Object.assign(new Error('أُلغي التشغيل.'), { name: 'AbortError' })); }, { once: true });
    try { listener!({ id, html }); } catch (e) { end(); reject(e instanceof Error ? e : new Error(String(e))); }
  });
}
