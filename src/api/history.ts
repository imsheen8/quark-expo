import type { Msg, WireMsg } from './types';

/** النص الكامل للرسالة كما يراه النموذج (يضم الملفات النصية المرفقة) */
export function fullContent(m: Msg): string {
  let t = m.content || '';
  if (m.files?.length) {
    t += m.files.map((f) => `\n\n--- ملف: ${f.name} ---\n${f.text}\n--- نهاية الملف ---`).join('');
  }
  return t.trim();
}

/**
 * يبني سجل الرسائل للإرسال: يتجاوز رسائل الأخطاء، يدمج الرسائل المتتالية من الدور نفسه،
 * ويرفق الصور من الذاكرة (images: معرّف الصورة → base64).
 */
export function buildHistory(messages: Msg[], images: Map<string, string> = new Map()): WireMsg[] {
  const out: WireMsg[] = [];
  for (const m of messages) {
    if (m.error) continue;
    const content = fullContent(m);
    const imgs = (m.imgs || [])
      .map((i) => ({ mime: i.mime, data: images.get(i.id) || '' }))
      .filter((i) => i.data);
    if (!content && !imgs.length) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content += (last.content && content ? '\n\n' : '') + content;
      if (imgs.length) last.images = [...(last.images || []), ...imgs];
    } else {
      out.push({ role: m.role, content, ...(imgs.length ? { images: imgs } : {}) });
    }
  }
  return out;
}
