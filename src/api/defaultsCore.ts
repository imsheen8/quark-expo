/** النماذج التلقائية لكل مهمة مع بدائل احتياطية — منطق صرف (مقابل defaults.js في تطبيق الويب). */
import type { Endpoint } from './types';

export interface ModelRef { ep: string; model: string }
export interface Defs {
  /** نموذج المحادثات الجديدة */
  chat: ModelRef | null;
  /** المهام الخلفية: العنوان التلقائي واستخراج المهارات */
  util: { sel: ModelRef | null; fb: ModelRef[] };
  /** الرؤية: تُستخدم حين تحمل الرسالة صورة ونموذج المحادثة لا يدعمها */
  vision: { sel: ModelRef | null; fb: ModelRef[] };
  /** البحث العميق */
  research: ModelRef | null;
}
export type AM = { ep: Endpoint; model: string };
export const MAX_FB = 4;

export const defaultDefs = (): Defs => ({ chat: null, util: { sel: null, fb: [] }, vision: { sel: null, fb: [] }, research: null });

export const normRef = (v: any): ModelRef | null => (v && v.ep && v.model ? { ep: String(v.ep), model: String(v.model) } : null);
const normList = (a: any): ModelRef[] => (Array.isArray(a) ? a : []).map(normRef).filter(Boolean).slice(0, MAX_FB) as ModelRef[];

/** يدمج قيمة محفوظة مع الافتراضي بأمان */
export function normDefs(raw: any): Defs {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    chat: normRef(r.chat),
    util: { sel: normRef(r.util?.sel), fb: normList(r.util?.fb) },
    vision: { sel: normRef(r.vision?.sel), fb: normList(r.vision?.fb) },
    research: normRef(r.research),
  };
}

/** اسم النموذج يدل على دعم الرؤية (تخمين من الاسم كما في التطبيق القديم) */
export const capVision = (id: string) =>
  /vision|gpt-4o|gpt-4\.1|gpt-5|(^|[\/\-_:.])o[134](-|$|:)|claude|gemini|llava|pixtral|-vl|vl-|gemma-?3|llama-?4|llama-?3\.2-(11|90)b|grok-?[24]/i.test(id);

export const usable = (ep: Endpoint | undefined | null): boolean => !!ep && ep.enabled && (ep.kind === 'local' || ep.proto === 'llama' || !!ep.key);

export function resolveRef(ref: ModelRef | null | undefined, endpoints: Endpoint[]): AM | null {
  const r = normRef(ref);
  if (!r) return null;
  const ep = endpoints.find((e) => e.id === r.ep);
  return ep && usable(ep) ? { ep, model: r.model } : null;
}

const same = (a: AM, b: AM) => a.ep.id === b.ep.id && a.model === b.model;

/** سلسلة نماذج صالحة بلا تكرار: القائمة بالترتيب ثم الذيل (غالبًا نموذج المحادثة) */
export function chain(list: (ModelRef | null)[], endpoints: Endpoint[], tail?: AM | null): AM[] {
  const out: AM[] = [];
  const add = (x: AM | null) => { if (x && usable(x.ep) && !out.some((o) => same(o, x))) out.push(x); };
  list.forEach((r) => add(resolveRef(r, endpoints)));
  add(tail ?? null);
  return out;
}

/** المهام الخلفية: النموذج الخاص ثم بدائله ثم نموذج المحادثة */
export const utilChain = (d: Defs, endpoints: Endpoint[], active: AM | null) => chain([d.util.sel, ...d.util.fb], endpoints, active);

/** الرؤية: إن حملت الرسالة صورًا ونموذج المحادثة لا يدعمها يُجرَّب نموذج الرؤية وبدائله، وإلا نموذج المحادثة */
export function chatChain(d: Defs, endpoints: Endpoint[], active: AM | null, hasImages: boolean): AM[] {
  if (hasImages && active && !capVision(active.model)) {
    const v = chain([d.vision.sel, ...d.vision.fb], endpoints, null);
    if (v.length) return v;
  }
  return active ? [active] : [];
}

/** البحث العميق: نموذجه الخاص أو نموذج المحادثة */
export const researchModel = (d: Defs, endpoints: Endpoint[], active: AM | null): AM | null => resolveRef(d.research, endpoints) ?? active;
