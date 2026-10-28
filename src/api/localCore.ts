/** النماذج على الجهاز (llama.cpp): كتالوج، قراءة ملفات GGUF، اختيار الصيغة، تقدير الملاءمة — منطق صرف. */

const GB = 1024 * 1024 * 1024;

export interface SeedModel {
  id: string; name: string; fam: string; params: number; repo: string;
  /** دعم العربية: 0 ضعيف · 1 مقبول · 2 جيد */
  ar: 0 | 1 | 2;
  tags: ('small' | 'think' | 'chat' | 'code')[];
  ctx: number; note: string;
}

/** بذور الكتالوج: المستودع والعائلة والحجم؛ أسماء الملفات تُقرأ حيًّا من المستودع. (النماذج النصية فقط) */
export const SEED: SeedModel[] = [
  { id: 'qwen3-0.6b', name: 'Qwen3 0.6B', fam: 'Qwen', params: 0.6, repo: 'unsloth/Qwen3-0.6B-GGUF', ar: 2, tags: ['small', 'think'], ctx: 32768, note: 'أصغر نموذج جيد بالعربية، يفكّر قبل الرد' },
  { id: 'qwen25-0.5b', name: 'Qwen2.5 0.5B', fam: 'Qwen', params: 0.5, repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF', ar: 1, tags: ['small'], ctx: 32768, note: 'خفيف جدًا للأجهزة الضعيفة' },
  { id: 'smollm2-360m', name: 'SmolLM2 360M', fam: 'SmolLM', params: 0.36, repo: 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF', ar: 0, tags: ['small'], ctx: 8192, note: 'للتجربة السريعة فقط، إنجليزي في الغالب' },
  { id: 'gemma3-1b', name: 'Gemma 3 1B', fam: 'Gemma', params: 1.0, repo: 'unsloth/gemma-3-1b-it-GGUF', ar: 2, tags: ['chat'], ctx: 32768, note: 'متوازن وسريع، عربي جيد' },
  { id: 'llama32-1b', name: 'Llama 3.2 1B', fam: 'Llama', params: 1.2, repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF', ar: 1, tags: ['chat'], ctx: 131072, note: 'سياق طويل بحجم صغير' },
  { id: 'qwen25-1.5b', name: 'Qwen2.5 1.5B', fam: 'Qwen', params: 1.5, repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF', ar: 2, tags: ['chat'], ctx: 32768, note: 'أفضل توازن بين الجودة والسرعة على الهاتف' },
  { id: 'qwen3-1.7b', name: 'Qwen3 1.7B', fam: 'Qwen', params: 1.7, repo: 'unsloth/Qwen3-1.7B-GGUF', ar: 2, tags: ['think'], ctx: 32768, note: 'يدعم وضع التفكير، عربي جيد' },
  { id: 'smollm2-1.7b', name: 'SmolLM2 1.7B', fam: 'SmolLM', params: 1.7, repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF', ar: 0, tags: ['chat'], ctx: 8192, note: 'جيد بالإنجليزية' },
  { id: 'qwen25c-1.5b', name: 'Qwen2.5 Coder 1.5B', fam: 'Qwen', params: 1.5, repo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF', ar: 1, tags: ['code'], ctx: 32768, note: 'مساعد برمجة خفيف' },
  { id: 'gemma2-2b', name: 'Gemma 2 2B', fam: 'Gemma', params: 2.6, repo: 'bartowski/gemma-2-2b-it-GGUF', ar: 1, tags: ['chat'], ctx: 8192, note: 'نموذج مستقر من جوجل' },
  { id: 'llama32-3b', name: 'Llama 3.2 3B', fam: 'Llama', params: 3.2, repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF', ar: 1, tags: ['chat'], ctx: 131072, note: 'أذكى لكنه أبطأ على الهاتف' },
  { id: 'qwen25-3b', name: 'Qwen2.5 3B', fam: 'Qwen', params: 3.1, repo: 'Qwen/Qwen2.5-3B-Instruct-GGUF', ar: 2, tags: ['chat'], ctx: 32768, note: 'جودة أعلى بالعربية' },
  { id: 'qwen25c-3b', name: 'Qwen2.5 Coder 3B', fam: 'Qwen', params: 3.1, repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF', ar: 1, tags: ['code'], ctx: 32768, note: 'برمجة أقوى' },
  { id: 'qwen3-4b', name: 'Qwen3 4B', fam: 'Qwen', params: 4.0, repo: 'unsloth/Qwen3-4B-GGUF', ar: 2, tags: ['think'], ctx: 32768, note: 'الأذكى ضمن ما يتسع للهاتف، لأجهزة قوية' },
  { id: 'gemma3-4b', name: 'Gemma 3 4B', fam: 'Gemma', params: 4.3, repo: 'unsloth/gemma-3-4b-it-GGUF', ar: 2, tags: ['chat'], ctx: 131072, note: 'عربي ممتاز، ثقيل نسبيًا (النص فقط هنا)' },
  { id: 'phi35-mini', name: 'Phi-3.5 mini', fam: 'Phi', params: 3.8, repo: 'bartowski/Phi-3.5-mini-instruct-GGUF', ar: 0, tags: ['chat'], ctx: 131072, note: 'قوي في الاستدلال، ضعيف بالعربية' },
  { id: 'tinyllama', name: 'TinyLlama 1.1B', fam: 'Llama', params: 1.1, repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF', ar: 0, tags: ['small'], ctx: 2048, note: 'قديم لكنه خفيف جدًا' },
];

const BITS: Record<string, number> = { Q2_K: 3.0, Q3_K_S: 3.5, Q3_K_M: 3.9, Q3_K_L: 4.2, IQ4_XS: 4.3, Q4_0: 4.6, Q4_K_S: 4.6, Q4_K_M: 4.85, Q5_K_S: 5.5, Q5_K_M: 5.7, Q6_K: 6.6, Q8_0: 8.5, F16: 16, BF16: 16 };
const QUANT_PREF = ['Q4_K_M', 'Q4_K_S', 'Q4_0', 'IQ4_XS', 'Q5_K_M', 'Q5_K_S', 'Q3_K_M', 'Q3_K_L', 'Q3_K_S', 'Q6_K', 'Q8_0', 'Q2_K'];
const QUANT_RE = /(?:^|[-_.])((?:IQ\d_[A-Z]+|Q\d_K_[SML]|Q\d_K|Q\d_[01]|BF16|F16|F32))(?=$|[-_.])/i;

export const approxBytes = (paramsB: number, quant = 'Q4_K_M') => Math.round(((paramsB * 1e9 * (BITS[quant] || 4.85)) / 8) * 1.02);

export function quantOf(name: string): string {
  const base = String(name).replace(/\.gguf$/i, '').replace(/-\d{5}-of-\d{5}$/i, '');
  const m = QUANT_RE.exec(base);
  return m ? m[1].toUpperCase() : '';
}

export interface RepoFile { path: string; size: number }
export interface Variant { key: string; quant: string; files: { path: string; size: number; idx: number }[]; total: number; size: number }

/** يحوّل ملفات المستودع إلى «صيغ» (ملف واحد أو أجزاء). يتجاهل mmproj وimatrix والأجزاء الناقصة. */
export function variantsFromFiles(files: RepoFile[]): Variant[] {
  const map = new Map<string, Variant>();
  for (const f of files || []) {
    const path = String(f.path || '');
    if (!/\.gguf$/i.test(path) || /mmproj|imatrix|vocab/i.test(path)) continue;
    const file = path.split('/').pop()!;
    const part = /-(\d{5})-of-(\d{5})\.gguf$/i.exec(file);
    const quant = quantOf(file) || 'غير معروف';
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) + '/' : '';
    const key = dir + file.replace(/-\d{5}-of-\d{5}\.gguf$/i, '').replace(/\.gguf$/i, '');
    let v = map.get(key);
    if (!v) { v = { key, quant, files: [], total: part ? +part[2] : 1, size: 0 }; map.set(key, v); }
    v.files.push({ path, size: Number(f.size) || 0, idx: part ? +part[1] : 1 });
  }
  const out: Variant[] = [];
  for (const v of map.values()) {
    v.files.sort((a, b) => a.idx - b.idx);
    v.size = v.files.reduce((n, f) => n + f.size, 0);
    if (v.files.length === v.total) out.push(v);
  }
  return out;
}

/** أنسب صيغة: الأعلى تفضيلًا مما يتسع في maxBytes، وإلا الأصغر */
export function pickVariant(vars: Variant[], maxBytes?: number): Variant | null {
  if (!vars.length) return null;
  const score = (v: Variant) => { const i = QUANT_PREF.indexOf(v.quant); return i < 0 ? 99 : i; };
  const sorted = [...vars].sort((a, b) => score(a) - score(b) || a.size - b.size);
  if (maxBytes) return sorted.find((v) => v.size > 0 && v.size <= maxBytes) ?? [...vars].sort((a, b) => a.size - b.size)[0];
  return sorted[0];
}

export const cleanRepo = (s: string) => String(s || '').trim().replace(/^https?:\/\/[^/]+\//i, '').replace(/^models\//, '').split(/[?#]/)[0].split('/').slice(0, 2).join('/');
export const validRepo = (s: string) => /^[\w.-]+\/[\w.-]+$/.test(s);
export const hfFileUrl = (repo: string, path: string, base = 'https://huggingface.co') => `${base.replace(/\/+$/, '')}/${repo}/resolve/main/${path.split('/').map(encodeURIComponent).join('/')}`;
export const paramsFromName = (s: string): number => {
  const m = /(?:^|[^\d.])(\d+(?:\.\d+)?)\s*[bB](?![a-zA-Z])/.exec(s);
  const m2 = /(\d+(?:\.\d+)?)\s*[mM](?![a-zA-Z])/.exec(s);
  return m ? parseFloat(m[1]) : m2 ? parseFloat(m2[1]) / 1000 : 0;
};
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/* ---------- ملاءمة الجهاز (تقديرية) ---------- */
export interface Fit { level: 'great' | 'good' | 'slow' | 'tight' | 'no'; label: string; tps: number; ctx: number; needBytes: number; why: string }
export const LEVEL_LABEL = { great: 'ممتاز لجهازك', good: 'مناسب', slow: 'بطيء', tight: 'على الحد', no: 'لا يناسب' } as const;

export const kvBytes = (paramsB: number, ctx: number) => Math.min(0.45 * GB, Math.max(0.05 * GB, (0.07 * GB * paramsB * ctx) / 2048));

/** ramGB = ذاكرة الجهاز الكلية. النظام يحتفظ بنحو نصفها */
export function fit(sizeBytes: number, paramsB: number, ramGB: number, wantCtx = 0): Fit {
  const usable = Math.max(0.8, ramGB * 0.5) * GB;
  const bw = ramGB >= 11 ? 20 : ramGB >= 7.5 ? 14 : ramGB >= 5 ? 9 : 6; // GB/s تقريبًا
  const top = wantCtx || (ramGB >= 11 ? 8192 : ramGB >= 7.5 ? 4096 : ramGB >= 5 ? 2048 : 1536);
  const params = paramsB || sizeBytes / GB / 0.6;
  const need = (c: number) => sizeBytes * 1.06 + kvBytes(params, c) + 0.35 * GB;
  let ctx = top;
  if (!wantCtx) for (const c of [top, 4096, 2048, 1536, 1024]) if (c <= top && need(c) <= usable) { ctx = c; break; } else ctx = 1024;
  const n = need(ctx);
  const tps = bw / Math.max(0.05, sizeBytes / GB);
  let level: Fit['level'], why = '';
  if (n > usable) { level = 'no'; why = `يحتاج ≈${(n / GB).toFixed(1)} GB وجهازك يتّسع لحوالي ${(usable / GB).toFixed(1)} GB`; }
  else if (n > usable * 0.88) { level = 'tight'; why = 'قريب جدًا من حد الذاكرة وقد يتعطل مع تطبيقات أخرى'; }
  else if (tps < 3) { level = 'slow'; why = `بطيء (≈${tps.toFixed(1)} رمز/ث تقديريًا)`; }
  else if (tps >= 6 && n < usable * 0.6) level = 'great';
  else level = 'good';
  return { level, label: LEVEL_LABEL[level], tps, ctx, needBytes: n, why };
}

export function fmtBytes(b: number): string {
  if (!(b > 0)) return '—';
  return b >= GB ? (b / GB >= 10 ? Math.round(b / GB) : (b / GB).toFixed(1).replace(/\.0$/, '')) + ' GB' : Math.round(b / 1048576) + ' MB';
}
