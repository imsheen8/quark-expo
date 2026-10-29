import { extractJSON, hostOfUrl, htmlToText, isPrivateUrl, looksBlocked, parseDDG, type SearchResult } from './webParse';
import { log } from '../store/logs';

export type Engine = 'duckduckgo' | 'searxng' | 'tavily' | 'brave' | 'serper' | 'google_pse';

export interface EngineConf {
  engine: Engine;
  key: string;
  url: string;
  cx: string;
}

export interface SearchConf extends EngineConf {
  results: number;
  fallbacks: EngineConf[];
}

export const ENGINE_LABEL: Record<Engine, string> = {
  duckduckgo: 'DuckDuckGo (بلا مفتاح)',
  searxng: 'SearXNG',
  tavily: 'Tavily',
  brave: 'Brave',
  serper: 'Serper',
  google_pse: 'Google PSE',
};

export const DEFAULT_SEARCH: SearchConf = { engine: 'duckduckgo', key: '', url: '', cx: '', results: 8, fallbacks: [] };

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

async function timed<T>(ms: number, signal: AbortSignal | undefined, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fn(ctl.signal);
  } finally {
    clearTimeout(t);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function json(url: string, init: RequestInit, signal?: AbortSignal): Promise<any> {
  return timed(20000, signal, async (s) => {
    const r = await fetch(url, { ...init, signal: s });
    const txt = await r.text();
    if (!r.ok) throw new Error(`(${r.status}) ${txt.slice(0, 160)}`);
    return JSON.parse(txt);
  });
}

async function searchOne(c: EngineConf, q: string, n: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const enc = encodeURIComponent;
  const norm = (rows: any[], t: string, u: string, s: string): SearchResult[] =>
    (rows || [])
      .map((x) => ({ title: String(x[t] || ''), url: String(x[u] || ''), snippet: String(x[s] || '') }))
      .filter((x) => /^https?:\/\//i.test(x.url));
  if (c.engine !== 'duckduckgo' && c.engine !== 'searxng' && !c.key) throw new Error(`محرك البحث ${ENGINE_LABEL[c.engine]} يحتاج مفتاح API.`);
  switch (c.engine) {
    case 'duckduckgo': {
      const html = await timed(25000, signal, async (s) => {
        const r = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          signal: s,
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA, accept: 'text/html' },
          body: `q=${enc(q)}&kl=wt-wt`,
        });
        return r.text();
      });
      const rows = parseDDG(html);
      if (!rows.length && looksBlocked(html)) throw new Error('DuckDuckGo حجب الطلب مؤقتًا. جرّب لاحقًا أو اختر محرك بحث بمفتاح.');
      return rows.slice(0, n);
    }
    case 'searxng': {
      const base = c.url.replace(/\/+$/, '');
      if (!base) throw new Error('أدخل عنوان خادم SearXNG.');
      const j = await json(`${base}/search?q=${enc(q)}&format=json`, { headers: { 'user-agent': UA } }, signal);
      return norm(j.results, 'title', 'url', 'content').slice(0, n);
    }
    case 'tavily': {
      const j = await json('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: c.key, query: q, max_results: n }) }, signal);
      return norm(j.results, 'title', 'url', 'content').slice(0, n);
    }
    case 'brave': {
      const j = await json(`https://api.search.brave.com/res/v1/web/search?q=${enc(q)}&count=${n}`, { headers: { 'x-subscription-token': c.key, accept: 'application/json' } }, signal);
      return norm(j.web?.results, 'title', 'url', 'description').slice(0, n);
    }
    case 'serper': {
      const j = await json('https://google.serper.dev/search', { method: 'POST', headers: { 'x-api-key': c.key, 'content-type': 'application/json' }, body: JSON.stringify({ q, num: n }) }, signal);
      return norm(j.organic, 'title', 'link', 'snippet').slice(0, n);
    }
    case 'google_pse': {
      if (!c.cx) throw new Error('Google PSE يحتاج معرّف CX.');
      const j = await json(`https://www.googleapis.com/customsearch/v1?key=${enc(c.key)}&cx=${enc(c.cx)}&q=${enc(q)}&num=${Math.min(n, 10)}`, {}, signal);
      return norm(j.items, 'title', 'link', 'snippet').slice(0, n);
    }
  }
}

/** يبحث بالمحرك الأساسي ثم الاحتياطيات عند الفشل أو غياب النتائج */
export async function webSearch(conf: SearchConf, q: string, signal?: AbortSignal): Promise<{ rows: SearchResult[]; engine: Engine }> {
  const chain: EngineConf[] = [conf, ...(conf.fallbacks || [])];
  let lastErr: unknown = null;
  for (const c of chain) {
    try {
      const rows = await searchOne(c, q.slice(0, 400), Math.max(1, Math.min(20, conf.results || 8)), signal);
      if (rows.length) return { rows, engine: c.engine };
    } catch (e) {
      if ((e as any)?.name === 'AbortError' || signal?.aborted) throw e;
      log('web', `${c.engine}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  return { rows: [], engine: conf.engine };
}

/** يجلب صفحة ويب ويعيد نصها. allowPrivate=false يرفض الشبكة الداخلية (أدوات النموذج). */
export async function fetchPage(url: string, max = 4000, signal?: AbortSignal, allowPrivate = false): Promise<{ title: string; text: string; host: string }> {
  if (!/^https?:\/\//i.test(url)) throw new Error('الرابط يجب أن يبدأ بـ http أو https.');
  if (!allowPrivate && isPrivateUrl(url)) throw new Error('الشبكة الداخلية غير مسموحة لهذه الأداة.');
  const html = await timed(12000, signal, async (s) => {
    const r = await fetch(url, { signal: s, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' } });
    if (!r.ok) throw new Error(`(${r.status}) تعذّر جلب الصفحة`);
    const ct = r.headers.get('content-type') || '';
    if (/pdf|image|video|audio|zip|octet/i.test(ct)) throw new Error('نوع الملف غير مدعوم للقراءة النصية.');
    return (await r.text()).slice(0, 1_500_000);
  });
  const { title, text } = htmlToText(html, max);
  return { title, text, host: hostOfUrl(url) };
}

export { extractJSON };
