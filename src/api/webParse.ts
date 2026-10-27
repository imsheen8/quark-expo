/** تحليل صفحات الويب ونتائج البحث — منطق صرف قابل للاختبار. */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', rlm: '', lrm: '' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeChr(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => safeChr(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}
const safeChr = (n: number) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
};

const attr = (tag: string, name: string): string => {
  const m = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag);
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : '';
};

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** نتائج DuckDuckGo HTML (html.duckduckgo.com/html) */
export function parseDDG(html: string): SearchResult[] {
  const items: SearchResult[] = [];
  const re = /<a\s([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const cls = attr(m[1], 'class');
    if (cls.includes('result__a')) {
      let href = attr(m[1], 'href');
      const u = /[?&]uddg=([^&]+)/.exec(href);
      if (u) {
        try {
          href = decodeURIComponent(u[1]);
        } catch {
          href = u[1];
        }
      } else if (href.startsWith('//')) href = 'https:' + href;
      if (!/^https?:\/\//i.test(href) || href.includes('duckduckgo.com/y.js')) continue;
      items.push({ title: stripTags(m[2]), url: href, snippet: '' });
    } else if (cls.includes('result__snippet') && items.length) {
      const last = items[items.length - 1];
      if (!last.snippet) last.snippet = stripTags(m[2]);
    }
  }
  return items;
}

export function looksBlocked(html: string): boolean {
  return /(anomaly|captcha|unusual traffic)/i.test(html);
}

/** تحويل HTML إلى نص مقروء */
export function htmlToText(html: string, max = 6000): { title: string; text: string } {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = t ? stripTags(t[1]) : '';
  let h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head|nav|footer|aside|form|iframe|template|select|button)\b[\s\S]*?<\/\1>/gi, ' ');
  const main = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(h);
  if (main && stripTags(main[2]).length > 400) h = main[2];
  h = h
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|h[1-6]|li|tr|table|ul|ol|blockquote|pre)>/gi, '\n')
    .replace(/<(li)\b[^>]*>/gi, '\n• ')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n## ');
  let text = decodeEntities(h.replace(/<[^>]+>/g, ' '));
  text = text
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  if (text.length > max) text = text.slice(0, max) + '…';
  return { title, text };
}

const PRIVATE = /^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
/** يمنع قراءة الشبكة الداخلية وعناوين الـ metadata من أدوات النموذج */
export function isPrivateUrl(u: string): boolean {
  let host = '';
  try {
    host = new URL(u).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return true;
  }
  if (PRIVATE.test(host)) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (v4) {
    const [a, b] = [+v4[1], +v4[2]];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (host.includes(':')) return /^(::1?|fe80|fc|fd)/i.test(host);
  return false;
}

export const hostOfUrl = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

export function rankUrls(rows: SearchResult[], terms: Set<string>, seen: Set<string>): SearchResult[] {
  const LOW = /(pinterest|facebook|instagram|tiktok|quora|linkedin\.com\/(pulse|posts)|youtube\.com\/shorts|aliexpress|temu)/i;
  const score = (r: SearchResult) => {
    let s = 0;
    const t = (r.title + ' ' + r.snippet).toLowerCase();
    terms.forEach((w) => {
      if (t.includes(w)) s += 1;
    });
    if (LOW.test(r.url)) s -= 3;
    if (/\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(r.url)) s -= 2;
    return s;
  };
  const out: SearchResult[] = [];
  const hosts = new Set<string>();
  for (const r of rows.slice().sort((a, b) => score(b) - score(a))) {
    if (seen.has(r.url) || score(r) < -1) continue;
    out.push(r);
    hosts.add(hostOfUrl(r.url));
  }
  return out;
}

export function terms(q: string): Set<string> {
  return new Set(
    q
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(the|and|for|with|that|this|what|هل|ما|ماذا|كيف|عن|في|من|إلى|على|هذا|هذه|التي|الذي)$/.test(w)),
  );
}

/** يستخرج JSON (كائن أو مصفوفة) من رد نموذج قد يحيطه كلام أو سياج كود */
export function extractJSON(t: string): any {
  const s = String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
  for (const [o, c] of [['{', '}'], ['[', ']']] as const) {
    const a = s.indexOf(o);
    const b = s.lastIndexOf(c);
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(s.slice(a, b + 1));
      } catch {}
    }
  }
  return null;
}
