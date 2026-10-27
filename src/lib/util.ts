/** أدوات صغيرة مشتركة (بدون أي اعتماد على React Native ليسهل اختبارها). */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function uid(len = 10): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function shortModel(m?: string | null): string {
  return (m || '').split('/').pop() || '—';
}

/** عدّ رموز تقريبي عند غياب أرقام المزوّد (≈ 4 أحرف لكل رمز). */
export const estTokens = (s: string) => Math.ceil((s || '').length / 4);

export function fmtNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function relTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'الآن';
  const m = Math.round(s / 60);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(ts).toLocaleDateString('ar');
}

/** يمزج لونين سداسيّين: t=0 ← a ، t=1 ← b */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const x = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  };
  const A = p(a), B = p(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function alpha(hex: string, a: number): string {
  const x = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export const isHex6 = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
