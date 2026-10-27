import type { MemoryItem } from '../api/types';

export const MEM_CATS: Record<MemoryItem['cat'], string> = {
  fact: 'معلومة',
  identity: 'هوية',
  preference: 'تفضيل',
  contact: 'جهة اتصال',
  project: 'مشروع',
  goal: 'هدف',
  task: 'مهمة',
};

const STOP = new Set(
  'و في من على الى إلى عن مع هذا هذه ذلك التي الذي هل ما ماذا كيف لماذا او أو ثم كل بعض لا لم لن قد كان يكون the a an of to in on for and or is are be with this that it'
    .split(' ')
    .map((x) => x.toLowerCase()),
);
const SUFFIX = ['ات', 'ان', 'ون', 'ين', 'يه', 'ها', 'ه', 'ا', 'ي'];

export const fold = (x: string) =>
  String(x || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

export function tokens(text: string): string[] {
  const out: string[] = [];
  fold(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .forEach((w0) => {
      let w = w0;
      if (!w || STOP.has(w)) return;
      if (w.length > 3 && w.startsWith('ال')) w = w.slice(2);
      if (/^[؀-ۿ]+$/.test(w)) {
        const suf = SUFFIX.find((s) => w.endsWith(s) && w.length - s.length >= 3);
        if (suf) w = w.slice(0, -suf.length);
        if (w.length > 3 && w.endsWith('ي')) w = w.slice(0, -1);
      }
      if (w.length >= 2) out.push(w);
    });
  return out;
}

export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let i = 0;
  A.forEach((t) => {
    if (B.has(t)) i++;
  });
  return i / (A.size + B.size - i);
}

/** بيانات لا نحفظها أبدًا: مفاتيح وكلمات سر وأرقام بطاقات */
export function isSensitive(t: string): boolean {
  return (
    /\bsk-[A-Za-z0-9_-]{16,}/.test(t) ||
    /\bAIza[0-9A-Za-z_-]{20,}/.test(t) ||
    /\bBearer\s+[A-Za-z0-9._-]{20,}/i.test(t) ||
    /(?:\d[ -]?){13,19}/.test(t) ||
    /(?:password|passwd|passcode|كلمة\s*(?:ال)?(?:سر|مرور))\s*(?:[:=]|هي|is)/i.test(t)
  );
}

/** يختار الذكريات التي تُحقن في السياق: المثبّتة + الهوية/التفضيل + الأقرب لموضوع الرسالة، ضمن حدّ أقصى. */
export function pickMemories(all: MemoryItem[], query: string, max: number): MemoryItem[] {
  const picked = new Map<string, MemoryItem>();
  for (const m of all) if (m.pinned) picked.set(m.id, m);
  for (const m of all) if (picked.size < max && (m.cat === 'identity' || m.cat === 'preference')) picked.set(m.id, m);
  const rest = all
    .filter((m) => !picked.has(m.id))
    .map((m) => ({ m, s: similarity(query, m.text) }))
    .filter((x) => x.s > 0.08)
    .sort((a, b) => b.s - a.s);
  for (const x of rest) {
    if (picked.size >= max) break;
    picked.set(x.m.id, x.m);
  }
  return [...picked.values()].slice(0, Math.max(max, [...all].filter((m) => m.pinned).length));
}

/** أمر «تذكّر: …» داخل الرسالة */
export function extractRemember(text: string): string | null {
  const m = /^\s*(?:تذكّر|تذكر|احفظ في الذاكرة|remember)\s*[:：،,]?\s*([\s\S]{3,400})$/i.exec(text);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, ' ').trim();
  return t && !isSensitive(t) ? t : null;
}

export function memoryContext(items: MemoryItem[]): string {
  if (!items.length) return '';
  return 'ما تعرفه عن المستخدم (ذاكرة طويلة المدى، استخدمها عند الصلة فقط):\n' + items.map((m) => '- ' + m.text).join('\n');
}
