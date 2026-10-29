/** معاينة HTML/SVG مباشرة: منطق صرف. تُعرض في WebView بلا شبكة (CSP) وبلا وصول لبيانات التطبيق. */
export const PV_CSP =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src data: blob: https:; font-src data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; media-src data: blob: https:; form-action 'none'; base-uri 'none'">`;

export const isSvgCode = (code: string, lang = '') =>
  lang.toLowerCase() === 'svg' || (/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(code) && !/<html[\s>]/i.test(code));

/** هل تُعرض للكتلة زر معاينة؟ */
export function canPreview(lang: string, code: string): boolean {
  const l = (lang || '').toLowerCase();
  if (!code.trim()) return false;
  if (l === 'svg') return /<svg[\s>]/i.test(code);
  if (l === 'html' || l === 'htm' || l === 'xhtml') return true;
  // كتلة بلا لغة أو xml تبدو HTML/SVG كاملة
  if (!l || l === 'xml') return isSvgCode(code, l) || /^\s*(<!doctype html|<html[\s>])/i.test(code);
  return false;
}

export function previewDoc(code: string, lang = ''): string {
  const meta = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  if (isSvgCode(code, lang)) {
    const svg = code.replace(/^\s*<\?xml[^>]*>/i, '');
    return `<!doctype html><html><head>${meta}${PV_CSP}<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${svg}</body></html>`;
  }
  if (/<head[^>]*>/i.test(code)) return code.replace(/<head[^>]*>/i, (m) => m + PV_CSP);
  if (/<html[^>]*>/i.test(code)) return code.replace(/<html[^>]*>/i, (m) => m + '<head>' + PV_CSP + '</head>');
  return `<!doctype html><html><head>${meta}${PV_CSP}</head><body>${code}</body></html>`;
}

/** يسمح فقط بالصفحة المضمّنة نفسها (about:blank/data/html) — يمنع الانتقال لأي موقع */
export const allowNav = (url: string) => !url || /^(about:|data:|blob:)/i.test(url);
