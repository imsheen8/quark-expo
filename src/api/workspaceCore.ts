/** مساحة عمل الوكيل: مشروع ملفات نصية في الذاكرة (مسار ← محتوى). منطق صرف بلا React Native — يُختبر بـ npm test. */

export type Files = Record<string, string>;
export interface PlanItem { t: string; done?: boolean }

export const WS_LIMITS = { file: 200_000, files: 300, total: 2_500_000, path: 160 };

const fail = (m: string): never => { throw new Error(m); };
const lines = (s: string) => (s === '' ? 0 : s.split('\n').length);
const kb = (n: number) => (n < 1024 ? n + 'B' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + 'KB');

/* ---------------- المسارات ---------------- */
/** يطبّع مسارًا نسبيًا داخل المشروع ويرفض الخروج منه أو الأسماء الخطرة */
export function normPath(p: unknown): string {
  if (typeof p !== 'string' || !p.trim()) return fail('المسار مفقود.');
  let s = p.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (!s) return fail('المسار فارغ.');
  if (s.length > WS_LIMITS.path) return fail('المسار أطول من المسموح.');
  if (/[\u0000-\u001f<>:"|?*]/.test(s)) return fail('المسار يحوي رموزًا غير مسموحة: ' + p);
  for (const seg of s.split('/')) {
    if (seg === '..' || seg === '.') return fail('لا يُسمح بـ «..» أو «.» داخل المسار: ' + p);
    if (!seg.trim()) return fail('اسم مجلد/ملف فارغ في المسار: ' + p);
  }
  return s;
}
const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);

export const wsStats = (f: Files) => {
  let bytes = 0;
  for (const k in f) bytes += f[k].length;
  return { count: Object.keys(f).length, bytes };
};

function similar(f: Files, path: string): string[] {
  const b = baseOf(path).toLowerCase();
  return Object.keys(f).filter((k) => baseOf(k).toLowerCase() === b || k.toLowerCase().includes(b) || b.includes(baseOf(k).toLowerCase())).slice(0, 4);
}

/* ---------------- الكتابة ---------------- */
export function wsWrite(files: Files, list: { path: unknown; content: unknown }[]): { files: Files; msg: string } {
  if (!Array.isArray(list) || !list.length) fail('files يجب أن تكون قائمة فيها path وcontent لكل ملف.');
  const out: Files = { ...files };
  const done: string[] = [];
  for (const it of list) {
    const path = normPath(it?.path);
    if (typeof it?.content !== 'string') fail(`المحتوى مفقود أو ليس نصًا للملف ${path}.`);
    const content = (it.content as string).replace(/\r\n/g, '\n');
    if (content.length > WS_LIMITS.file) fail(`الملف ${path} كبير (${kb(content.length)}) والحد ${kb(WS_LIMITS.file)}؛ قسّمه إلى ملفات أصغر.`);
    const isNew = !(path in out);
    out[path] = content;
    done.push(`${isNew ? '+' : '~'} ${path} (${lines(content)} سطر)`);
  }
  const st = wsStats(out);
  if (st.count > WS_LIMITS.files) fail(`عدد الملفات (${st.count}) تجاوز الحد ${WS_LIMITS.files}.`);
  if (st.bytes > WS_LIMITS.total) fail(`حجم المشروع (${kb(st.bytes)}) تجاوز الحد ${kb(WS_LIMITS.total)}.`);
  return { files: out, msg: `كُتب ${done.length} ملف:\n${done.join('\n')}` };
}

export interface Edit { old: string; new: string; all?: boolean }

/** أقرب تطابق للسطر الأول من النص القديم: يساعد النموذج على تصحيح تعديل لم يجد موضعه */
function nearHint(content: string, old: string): string {
  const first = old.split('\n').map((x) => x.trim()).find(Boolean);
  if (!first) return '';
  const ls = content.split('\n');
  const i = ls.findIndex((l) => l.includes(first));
  if (i >= 0) return ` أقرب موضع: السطر ${i + 1}: «${ls[i].trim().slice(0, 100)}» — انسخ النص حرفيًا بمسافاته (استخدم fs_read).`;
  return ' لم يوجد حتى أول سطر منه؛ اقرأ الملف بـ fs_read ثم أعد المحاولة.';
}

export function wsEdit(files: Files, pathIn: unknown, edits: Edit[]): { files: Files; msg: string } {
  const path = normPath(pathIn);
  if (!(path in files)) return fail(`الملف ${path} غير موجود.` + (similar(files, path).length ? ' ربما تقصد: ' + similar(files, path).join('، ') : ''));
  if (!Array.isArray(edits) || !edits.length) fail('edits يجب أن تكون قائمة فيها old وnew لكل تعديل.');
  let cur = files[path];
  let n = 0;
  edits.forEach((e, k) => {
    const tag = edits.length > 1 ? `[تعديل ${k + 1}] ` : '';
    const o = typeof e?.old === 'string' ? e.old.replace(/\r\n/g, '\n') : '';
    const nw = typeof e?.new === 'string' ? e.new.replace(/\r\n/g, '\n') : fail(tag + 'new مفقود.');
    if (!o) fail(tag + 'old فارغ؛ لإضافة نص استعمل fs_write أو ضع في old سطرًا موجودًا قرب موضع الإضافة.');
    if (o === nw) fail(tag + 'old وnew متطابقان.');
    const cnt = cur.split(o).length - 1;
    if (cnt === 0) fail(tag + 'النص old غير موجود في الملف.' + nearHint(cur, o));
    if (cnt > 1 && !e.all) fail(tag + `النص old يظهر ${cnt} مرات؛ أضف سياقًا يجعله فريدًا أو مرّر all:true.`);
    cur = cnt > 1 ? cur.split(o).join(nw) : cur.slice(0, cur.indexOf(o)) + nw + cur.slice(cur.indexOf(o) + o.length);
    n += cnt;
  });
  if (cur.length > WS_LIMITS.file) fail(`الملف ${path} صار أكبر من الحد المسموح.`);
  return { files: { ...files, [path]: cur }, msg: `عُدّل ${path}: ${n} موضع (الآن ${lines(cur)} سطر).` };
}

export function wsDelete(files: Files, pathIn: unknown): { files: Files; msg: string } {
  const path = normPath(pathIn);
  const out: Files = {};
  let n = 0;
  for (const k of Object.keys(files)) {
    if (k === path || k.startsWith(path + '/')) n++;
    else out[k] = files[k];
  }
  if (!n) fail(`لا ملف ولا مجلد بالاسم ${path}.`);
  return { files: out, msg: `حُذف ${n} ملف (${path}).` };
}

export function wsMove(files: Files, fromIn: unknown, toIn: unknown): { files: Files; msg: string } {
  const from = normPath(fromIn);
  const to = normPath(toIn);
  if (to === from || to.startsWith(from + '/')) fail('الوجهة غير صالحة.');
  const out: Files = {};
  let n = 0;
  for (const k of Object.keys(files)) {
    if (k === from || k.startsWith(from + '/')) {
      const nk = to + k.slice(from.length);
      if (nk in files) fail(`الوجهة موجودة مسبقًا: ${nk}.`);
      out[nk] = files[k];
      n++;
    } else out[k] = files[k];
  }
  if (!n) fail(`لا ملف ولا مجلد بالاسم ${from}.`);
  return { files: out, msg: `نُقل ${n} ملف من ${from} إلى ${to}.` };
}

/* ---------------- القراءة والبحث ---------------- */
export function wsRead(files: Files, pathIn: unknown, from?: unknown, to?: unknown): string {
  const path = normPath(pathIn);
  if (!(path in files)) {
    const dir = Object.keys(files).filter((k) => k.startsWith(path + '/'));
    if (dir.length) return `«${path}» مجلد. محتواه:\n` + dir.map((k) => `- ${k}`).join('\n');
    return fail(`الملف ${path} غير موجود.` + (similar(files, path).length ? ' ربما تقصد: ' + similar(files, path).join('، ') : ''));
  }
  const all = files[path].split('\n');
  const a = Math.max(1, Math.floor(Number(from)) || 1);
  const want = Math.min(all.length, Math.floor(Number(to)) || a + 399, a + 399);
  if (a > all.length) return fail(`الملف ${path} فيه ${all.length} سطر فقط.`);
  const w = String(want).length;
  const rows: string[] = [];
  let size = 0, b = a - 1;
  for (let i = a; i <= want; i++) {
    const l = all[i - 1];
    const row = `${String(i).padStart(w)}│ ${l.length > 400 ? l.slice(0, 400) + '…' : l}`;
    if (size + row.length > 5000 && rows.length) break;
    rows.push(row);
    size += row.length + 1;
    b = i;
  }
  return `${path} — ${all.length} سطر${a > 1 || b < all.length ? ` (يُعرض ${a}–${b})` : ''}\n${rows.join('\n')}${b < all.length ? `\n… بقي ${all.length - b} سطر (استكمل بـ from:${b + 1})` : ''}`;
}

/** قائمة مسطحة مرتبة بأحجام الملفات؛ dir اختياري لتضييق العرض */
export function wsList(files: Files, dir?: unknown, max = 80): string {
  const d = typeof dir === 'string' && dir.trim() ? normPath(dir) : '';
  const ks = Object.keys(files).filter((k) => !d || k === d || k.startsWith(d + '/')).sort();
  if (!ks.length) return d ? `لا ملفات تحت «${d}».` : 'مساحة العمل فارغة.';
  const st = wsStats(files);
  const rows = ks.slice(0, max).map((k) => `${k}  (${lines(files[k])} سطر · ${kb(files[k].length)})`);
  return `${st.count} ملف · ${kb(st.bytes)}\n` + rows.join('\n') + (ks.length > max ? `\n… و${ks.length - max} ملف آخر (ضيّق بـ dir)` : '');
}

export function wsSearch(files: Files, pattern: unknown, opts: { path?: unknown; regex?: unknown; max?: number } = {}): string {
  const p = String(pattern ?? '');
  if (!p) return fail('pattern فارغ.');
  const max = opts.max ?? 40;
  let test: (l: string) => boolean;
  if (opts.regex) {
    let re: RegExp;
    try { re = new RegExp(p, 'i'); } catch (e) { return fail('تعبير نمطي غير صالح: ' + (e instanceof Error ? e.message : String(e))); }
    test = (l) => re.test(l);
  } else {
    const q = p.toLowerCase();
    test = (l) => l.toLowerCase().includes(q);
  }
  const d = typeof opts.path === 'string' && opts.path.trim() ? normPath(opts.path) : '';
  const hits: string[] = [];
  let total = 0;
  for (const k of Object.keys(files).sort()) {
    if (d && k !== d && !k.startsWith(d + '/')) continue;
    const ls = files[k].split('\n');
    for (let i = 0; i < ls.length; i++) {
      if (!test(ls[i])) continue;
      total++;
      if (hits.length < max) hits.push(`${k}:${i + 1}: ${ls[i].trim().slice(0, 160)}`);
    }
  }
  return hits.length ? hits.join('\n') + (total > hits.length ? `\n… و${total - hits.length} تطابق آخر` : '') : 'لا تطابقات.';
}

/** ملخص قصير للمشروع يُحقن في موجّه النظام ليعرف الوكيل حالته دون استدعاء fs_list */
export function wsContext(files: Files, plan: PlanItem[] | undefined, name?: string, max = 60): string {
  const ks = Object.keys(files).sort();
  const L = ['# مساحة العمل الحالية' + (name ? ` («${name}»)` : '')];
  if (!ks.length) L.push('فارغة — لا ملفات بعد.');
  else {
    const st = wsStats(files);
    L.push(`${st.count} ملف · ${kb(st.bytes)}:`);
    ks.slice(0, max).forEach((k) => L.push(`- ${k} (${lines(files[k])})`));
    if (ks.length > max) L.push(`- … و${ks.length - max} ملف آخر (fs_list)`);
  }
  if (plan?.length) {
    L.push('الخطة المحفوظة من الجلسة السابقة (أكمل غير المنجَز ولا تبدأ من الصفر):');
    plan.slice(0, 20).forEach((it) => L.push(`${it.done ? '✓' : '○'} ${it.t}`));
  }
  return L.join('\n');
}

/* ---------------- فحص المشروع ---------------- */
export interface Issue { level: 'error' | 'warn'; path: string; line?: number; msg: string }

const CODE_EXT = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i;
const RESOLVE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const ASSET_EXT = /\.(?:png|jpe?g|gif|webp|bmp|ico|icns|ttf|otf|woff2?|mp3|mp4|wav|m4a|ogg|mov|pdf|db|sqlite|lottie|glb|gltf|obj)$/i;
const NODE_BUILTIN = new Set(['fs', 'path', 'http', 'https', 'crypto', 'os', 'url', 'util', 'stream', 'events', 'child_process', 'zlib', 'net', 'readline', 'assert', 'buffer', 'querystring', 'tls', 'dns', 'worker_threads', 'process', 'timers', 'module', 'vm']);

/** يمسح الأقواس في كود جافاسكريبت/CSS مع تجاهل النصوص والتعليقات وقوالب النص والتعابير النمطية؛ يعيد أول مشكلة أو null */
export function scanBrackets(src: string, css = false): { line: number; msg: string } | null {
  const n = src.length;
  const stack: { ch: string; line: number }[] = [];
  const OPEN: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let i = 0, line = 1, prev = '', prevWord = '';
  let tplStart = 0;
  const tpl = (): 'end' | 'expr' | 'eof' => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '\n') line++;
      if (c === '`') { i++; return 'end'; }
      if (c === '$' && src[i + 1] === '{') { stack.push({ ch: '${', line }); i += 2; return 'expr'; }
      i++;
    }
    return 'eof';
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) return { line, msg: 'تعليق /* لم يُغلق (الملف مبتور؟)' };
      for (let k = i; k < e; k++) if (src[k] === '\n') line++;
      i = e + 2;
      continue;
    }
    if (!css && c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    // فاصلة عليا بين حرفين (Don't) داخل نص JSX ليست بداية نص
    if ((c === '"' || c === "'") && !/[\p{L}\p{N}]/u.test(src[i - 1] ?? '')) {
      // نص أحادي السطر؛ إن لم يُغلق في السطر نفسه (فاصلة عليا داخل نص JSX) نعامل الرمز كحرف عادي
      let k = i + 1;
      while (k < n && src[k] !== c && src[k] !== '\n') k += src[k] === '\\' ? 2 : 1;
      if (src[k] === c) { i = k + 1; prev = 's'; prevWord = ''; continue; }
      i++;
      continue;
    }
    if (c === '`' && !css) {
      tplStart = line;
      i++;
      const r = tpl();
      if (r === 'eof') return { line: tplStart, msg: 'قالب نصي ` لم يُغلق (الملف مبتور؟)' };
      prev = 's'; prevWord = '';
      continue;
    }
    if (!css && c === '/') {
      const regexOk = !prev || '(,=:[!&|?{};+-*%~^'.includes(prev) || ['return', 'typeof', 'case', 'void', 'in', 'of'].includes(prevWord);
      if (regexOk) {
        let k = i + 1, cls = false;
        while (k < n && src[k] !== '\n') {
          const d = src[k];
          if (d === '\\') { k += 2; continue; }
          if (d === '[') cls = true;
          else if (d === ']') cls = false;
          else if (d === '/' && !cls) break;
          k++;
        }
        if (src[k] === '/' && k > i + 1) { i = k + 1; while (/[a-z]/i.test(src[i] ?? '')) i++; prev = 's'; prevWord = ''; continue; }
      }
    }
    if (c === '(' || c === '[' || c === '{') { stack.push({ ch: c, line }); prev = c; prevWord = ''; i++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      if (!top) return { line, msg: `قوس «${c}» زائد بلا قوس فتح` };
      if (top.ch === '${') {
        if (c !== '}') return { line, msg: `قوس «${c}» لا يطابق «\${» المفتوح في السطر ${top.line}` };
        tplStart = top.line;
        const r = tpl();
        if (r === 'eof') return { line: tplStart, msg: 'قالب نصي ` لم يُغلق (الملف مبتور؟)' };
        prev = 's'; prevWord = '';
        continue;
      }
      if (top.ch !== OPEN[c]) return { line, msg: `قوس «${c}» لا يطابق «${top.ch}» المفتوح في السطر ${top.line}` };
      prev = c; prevWord = ''; i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let k = i + 1;
      while (k < n && /[\w$]/.test(src[k])) k++;
      prevWord = src.slice(i, k); prev = 'w'; i = k;
      continue;
    }
    prev = c; prevWord = ''; i++;
  }
  const top = stack[stack.length - 1];
  if (top) return { line: top.line, msg: `قوس «${top.ch}» فُتح في السطر ${top.line} ولم يُغلق حتى نهاية الملف (الملف مبتور؟)` };
  return null;
}

const COMMENT = /^\s*(?:\/\/|#|\/\*+|\*|<!--)/;
const ELIDE = [
  /^\s*(?:\/\/|#|\/\*+|\*|<!--)\s*(?:\.{3}|…)/,
  /(?:rest of (?:the )?(?:code|file|component|app)|existing code|remains? the same|same as before|code (?:goes )?here|implement(?:ation)? (?:goes )?here|your code here)/i,
  /(?:باقي الكود|بقية الكود|كما هو دون تغيير|كما في السابق|الكود السابق|ضع الكود هنا)/,
];

function pkgName(spec: string): string {
  const p = spec.split('/');
  return spec.startsWith('@') ? p.slice(0, 2).join('/') : p[0];
}

function stripComments(src: string): string {
  return src.split('\n').map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? '' : l)).join('\n');
}

export function importsOf(src: string): string[] {
  const s = stripComments(src);
  const out = new Set<string>();
  const res = [
    /\bimport\s+(?:[^'";]*?\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /\bexport\s+(?:\*|\{[^}]*\}|[\w$]+)\s*(?:as\s+[\w$]+\s*)?from\s+['"]([^'"\n]+)['"]/g,
    /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const re of res) { let m: RegExpExecArray | null; while ((m = re.exec(s))) out.add(m[1]); }
  return [...out];
}

function joinPath(base: string, rel: string): string | null {
  const segs = base ? base.split('/') : [];
  for (const s of rel.split('/')) {
    if (s === '' || s === '.') continue;
    if (s === '..') { if (!segs.length) return null; segs.pop(); } else segs.push(s);
  }
  return segs.join('/');
}

function resolves(files: Files, target: string): boolean {
  if (target in files) return true;
  for (const e of RESOLVE_EXT) if (target + e in files) return true;
  for (const e of RESOLVE_EXT) if (`${target}/index${e}` in files) return true;
  return false;
}

export type Kind = 'expo' | 'web' | 'node' | 'empty' | 'unknown';
export function detectKind(files: Files): Kind {
  const ks = Object.keys(files);
  if (!ks.length) return 'empty';
  let pkg: any = null;
  try { if (files['package.json']) pkg = JSON.parse(files['package.json']); } catch {}
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  if (deps.expo || files['app.json']) return 'expo';
  if (pkg) return 'node';
  if (ks.some((k) => /\.html?$/i.test(k))) return 'web';
  return 'unknown';
}

export function lintProject(files: Files): Issue[] {
  const iss: Issue[] = [];
  const add = (level: Issue['level'], path: string, msg: string, line?: number) => iss.push({ level, path, msg, ...(line ? { line } : {}) });
  const ks = Object.keys(files).sort();
  let pkg: any = null;
  let deps: Set<string> | null = null;
  if ('package.json' in files) {
    try {
      pkg = JSON.parse(files['package.json']);
      deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {}), ...Object.keys(pkg.peerDependencies || {})]);
    } catch (e) { add('error', 'package.json', 'JSON غير صالح: ' + (e instanceof Error ? e.message : String(e))); }
  }
  const kind = detectKind(files);
  const router = !!deps?.has('expo-router');

  for (const k of ks) {
    const src = files[k];
    if (/\.json$/i.test(k) && !/(^|\/)tsconfig[^/]*\.json$/i.test(k)) {
      if (k !== 'package.json') { try { JSON.parse(src); } catch (e) { add('error', k, 'JSON غير صالح: ' + (e instanceof Error ? e.message : String(e))); } }
    }
    const isCode = CODE_EXT.test(k);
    const isCss = /\.css$/i.test(k);
    const isHtml = /\.html?$/i.test(k);
    if (!src.trim() && (isCode || isCss || isHtml)) { add('warn', k, 'الملف فارغ.'); continue; }
    if (isCode || isCss || isHtml) {
      const ls = src.split('\n');
      for (let i = 0; i < ls.length; i++) {
        const l = ls[i];
        if (l.length > 400) continue;
        if (COMMENT.test(l) && ELIDE.some((re) => re.test(l))) { add('error', k, 'اختصار بدل الكود الكامل («' + l.trim().slice(0, 70) + '»). اكتب الجزء الفعلي.', i + 1); break; }
      }
    }
    if (isCode) {
      const b = scanBrackets(src);
      if (b) add('error', k, b.msg, b.line);
      const dir = dirOf(k);
      for (const spec of importsOf(src)) {
        if (spec.startsWith('.')) {
          if (ASSET_EXT.test(spec)) { add('warn', k, `استيراد ملف ثنائي «${spec}» لا يمكن إنشاؤه هنا؛ أضفه يدويًا بعد التصدير أو استبدله.`); continue; }
          const t = joinPath(dir, spec);
          if (t === null || !resolves(files, t)) add('error', k, `الاستيراد «${spec}» لا يطابق أي ملف في المشروع.`);
        } else if (deps && !/^(node:|@\/|~\/|#)/.test(spec) && !NODE_BUILTIN.has(spec)) {
          const p = pkgName(spec);
          if (!deps.has(p)) add('warn', k, `الحزمة «${p}» غير معلنة في package.json.`);
        }
      }
      if (router && /^app\//.test(k) && !/\bexport\s+default\b/.test(src)) add('warn', k, 'ملف مسار في expo-router بلا export default.');
    } else if (isCss) {
      const b = scanBrackets(src, true);
      if (b) add('error', k, b.msg, b.line);
    } else if (isHtml) {
      const dir = dirOf(k);
      const re = /<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const u = m[1];
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(u)) continue;
        const t = joinPath(dir, u.split(/[?#]/)[0]);
        if (t === null || !(t in files)) add(ASSET_EXT.test(u) ? 'warn' : 'error', k, `المرجع «${u}» غير موجود في المشروع.`);
      }
      const sre = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
      while ((m = sre.exec(src))) {
        if (/\bsrc\s*=/.test(m[1]) || /type\s*=\s*["'](?!module|text\/javascript)/i.test(m[1]) || !m[2].trim()) continue;
        const b = scanBrackets(m[2]);
        if (b) add('error', k, 'داخل <script>: ' + b.msg, src.slice(0, m.index + m[0].indexOf(m[2])).split('\n').length + b.line - 1);
      }
      if (!/<html[\s>]/i.test(src) && !/<!doctype/i.test(src)) add('warn', k, 'لا يبدو مستند HTML كاملًا (لا <html> ولا <!doctype>).');
    }
  }

  if (kind === 'expo' && pkg) {
    for (const d of ['expo', 'react', 'react-native']) if (!deps!.has(d)) add('error', 'package.json', `الحزمة «${d}» مطلوبة لمشروع Expo.`);
    if (!('app.json' in files) && !('app.config.js' in files) && !('app.config.ts' in files)) add('error', 'app.json', 'ملف app.json مفقود.');
    const main = typeof pkg.main === 'string' ? pkg.main : '';
    if (main && !main.includes('expo-router') && !/^expo\//.test(main)) { const t = joinPath('', main); if (t === null || !resolves(files, t)) add('error', 'package.json', `الحقل main يشير إلى «${main}» وهو غير موجود.`); }
    if (!main && !['App.js', 'App.tsx', 'App.jsx', 'index.js', 'index.ts'].some((x) => x in files) && !router) add('error', 'package.json', 'لا نقطة دخول: أضف App.js أو حدّد main.');
    if (router && !ks.some((k) => /^app\//.test(k))) add('error', 'app/', 'expo-router يحتاج مجلد app/ فيه مسار واحد على الأقل.');
    if ('app.json' in files) {
      try {
        const aj = JSON.parse(files['app.json']);
        const ex = aj.expo ?? aj;
        if (!ex.name || !ex.slug) add('error', 'app.json', 'name وslug مطلوبان داخل expo.');
        if (!ex.android?.package) add('warn', 'app.json', 'android.package غير محدد (مطلوب لبناء APK).');
      } catch { /* أبلغ عنه فحص JSON أعلاه */ }
    }
  }
  if (kind === 'web' && !ks.some((k) => /(^|\/)index\.html?$/i.test(k))) add('warn', 'index.html', 'لا يوجد index.html كنقطة دخول.');
  if (kind === 'node' && pkg && !pkg.main && !pkg.scripts?.start && !('index.js' in files)) add('warn', 'package.json', 'لا scripts.start ولا main ولا index.js.');
  return iss.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

export function formatIssues(iss: Issue[], files: Files, max = 30): string {
  const e = iss.filter((x) => x.level === 'error').length;
  const w = iss.length - e;
  const head = `فُحص ${Object.keys(files).length} ملف (${detectKind(files)})`;
  if (!iss.length) return head + ': ✓ لا أخطاء ولا تحذيرات.' + (detectKind(files) === 'expo' ? '\nملاحظة: الفحص ساكن (بنية/أقواس/استيرادات) ولم يُشغَّل التطبيق فعليًا.' : '');
  return `${head}: ${e} خطأ، ${w} تحذير\n` + iss.slice(0, max).map((x) => `${x.level === 'error' ? '✗' : '⚠'} ${x.path}${x.line ? ':' + x.line : ''} — ${x.msg}`).join('\n') + (iss.length > max ? `\n… و${iss.length - max} مشكلة أخرى` : '');
}

/* ---------------- المعاينة ---------------- */
export const htmlEntries = (files: Files) => Object.keys(files).filter((k) => /\.html?$/i.test(k)).sort((a, b) => (/(^|\/)index\.html?$/i.test(a) ? -1 : 0) - (/(^|\/)index\.html?$/i.test(b) ? -1 : 0));

/** يدمج CSS/JS المحليين داخل الصفحة لتعمل في WebView معزول بلا ملفات */
export function buildWebPreview(files: Files, entryIn?: unknown): string {
  const entry = typeof entryIn === 'string' && entryIn.trim() ? normPath(entryIn) : htmlEntries(files)[0];
  if (!entry || !(entry in files)) return fail('لا يوجد ملف HTML للمعاينة' + (htmlEntries(files).length ? ' — المتاح: ' + htmlEntries(files).join('، ') : ' في المشروع.'));
  const dir = dirOf(entry);
  const get = (u: string) => { if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(u)) return null; const t = joinPath(dir, u.split(/[?#]/)[0]); return t !== null && t in files ? files[t] : null; };
  let html = files[entry];
  html = html.replace(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi, (tag) => {
    const h = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    const css = h ? get(h[1]) : null;
    return css === null ? tag : `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  });
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a: string, u: string, b: string) => {
    const js = get(u);
    return js === null ? tag : `<script${(a + b).replace(/\s+$/, '')}>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
  return html;
}

/** سكربت يلتقط الأخطاء ورسائل console داخل صفحة المعاينة المخفية ويرسلها لتطبيق الوكيل */
export const RUN_PROBE = `<script>(function(){function P(t,m){try{window.ReactNativeWebView.postMessage(JSON.stringify({t:t,m:String(m).slice(0,600)}))}catch(e){}}
function F(a){return Array.prototype.slice.call(a).map(function(x){try{return typeof x==='string'?x:(x instanceof Error?(x.stack||x.message):JSON.stringify(x))}catch(e){return String(x)}}).join(' ')}
['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){P(k,F(arguments));try{o.apply(console,arguments)}catch(e){}}});
window.addEventListener('error',function(e){P('error',(e.message||'خطأ')+(e.filename?' @'+String(e.filename).split('/').pop():'')+(e.lineno?':'+e.lineno:''))});
window.addEventListener('unhandledrejection',function(e){P('error','وعد مرفوض: '+(e.reason&&e.reason.message||e.reason))});
window.addEventListener('load',function(){P('load','ok')});})();</script>`;

export function instrumentHtml(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + RUN_PROBE);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + '<head>' + RUN_PROBE + '</head>');
  return RUN_PROBE + html;
}

export function formatRun(msgs: { t: string; m: string }[], loaded: boolean): string {
  const errs = msgs.filter((x) => x.t === 'error');
  const logs = msgs.filter((x) => x.t !== 'load' && x.t !== 'error');
  const L = [loaded ? 'اكتمل تحميل الصفحة.' : '⚠ لم يكتمل تحميل الصفحة ضمن المهلة.'];
  L.push(errs.length ? `✗ ${errs.length} خطأ وقت التشغيل:\n` + errs.slice(0, 12).map((x) => '- ' + x.m).join('\n') : '✓ لا أخطاء وقت التشغيل.');
  if (logs.length) L.push('مخرجات console:\n' + logs.slice(0, 20).map((x) => `[${x.t}] ${x.m}`).join('\n'));
  return L.join('\n');
}

/* ---------------- ZIP (تخزين بلا ضغط، أسماء UTF-8) ---------------- */
let CRC: Uint32Array | null = null;
export function crc32(b: Uint8Array): number {
  if (!CRC) {
    CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function makeZip(files: Files, root = '', now = new Date()): Uint8Array {
  const names = Object.keys(files).sort();
  const pre = root ? root.replace(/\/+$/, '') + '/' : '';
  const date = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const ents = names.map((k) => { const data = utf8(files[k]); return { name: utf8(pre + k), data, crc: crc32(data) }; });
  let size = 22;
  for (const e of ents) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let p = 0;
  const u16 = (v: number) => { dv.setUint16(p, v, true); p += 2; };
  const u32 = (v: number) => { dv.setUint32(p, v >>> 0, true); p += 4; };
  const offs: number[] = [];
  for (const e of ents) {
    offs.push(p);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(time); u16(date); u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
    out.set(e.name, p); p += e.name.length;
    out.set(e.data, p); p += e.data.length;
  }
  const cdStart = p;
  ents.forEach((e, i) => {
    u32(0x02014b50); u16(0x0314); u16(20); u16(0x0800); u16(0); u16(time); u16(date); u32(e.crc); u32(e.data.length); u32(e.data.length);
    u16(e.name.length); u16(0); u16(0); u16(0); u16(0); u32(((0o100644 << 16) >>> 0)); u32(offs[i]);
    out.set(e.name, p); p += e.name.length;
  });
  const cdSize = p - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(ents.length); u16(ents.length); u32(cdSize); u32(cdStart); u16(0);
  return out;
}

export const slug = (s: string, fallback = 'app') => {
  const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return t || fallback;
};

/* ---------------- قوالب البداية ---------------- */
export const TEMPLATES = ['expo', 'web', 'node'] as const;
export type Template = (typeof TEMPLATES)[number];

const APK_WORKFLOW = `name: Build Android APK

# التشغيل: تبويب Actions ← Build Android APK ← Run workflow
on:
  workflow_dispatch:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  apk:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Install dependencies
        run: npm install --legacy-peer-deps --no-audit --no-fund
      - name: Align Expo packages to the SDK
        run: npx expo install --fix || true
      - name: Generate native Android project
        run: npx expo prebuild --platform android --no-install --clean
      - name: Build release APK
        working-directory: android
        env:
          NODE_ENV: production
        run: |
          chmod +x gradlew
          ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
      - uses: actions/upload-artifact@v4
        with:
          name: app-apk
          path: android/app/build/outputs/apk/release/app-release.apk
          retention-days: 30
`;

export function scaffold(kind: unknown, nameIn?: unknown, opts: { ci?: boolean; pkg?: string } = {}): Files {
  const name = String(nameIn || '').trim() || 'MyApp';
  const sl = slug(name);
  const json = (o: unknown) => JSON.stringify(o, null, 2) + '\n';
  if (kind === 'expo') {
    const f: Files = {
      'package.json': json({
        name: sl, version: '1.0.0', main: 'index.js',
        scripts: { start: 'expo start', android: 'expo start --android' },
        dependencies: {
          '@expo/vector-icons': '^15.0.2', '@react-native-async-storage/async-storage': '2.2.0', expo: '~54.0.0', 'expo-status-bar': '~3.0.8',
          react: '19.1.0', 'react-native': '0.81.5', 'react-native-safe-area-context': '~5.6.0',
        },
      }),
      'app.json': json({
        expo: { name, slug: sl, version: '1.0.0', orientation: 'portrait', userInterfaceStyle: 'automatic', android: { package: opts.pkg || 'com.krazos.' + sl.replace(/-/g, '') } },
      }),
      'index.js': "import { registerRootComponent } from 'expo';\nimport App from './App';\n\nregisterRootComponent(App);\n",
      'App.js': `import { StatusBar } from 'expo-status-bar';\nimport { I18nManager, StyleSheet, Text, View } from 'react-native';\nimport { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';\n\nI18nManager.allowRTL(true);\n\nexport default function App() {\n  return (\n    <SafeAreaProvider>\n      <SafeAreaView style={styles.root}>\n        <StatusBar style=\"auto\" />\n        <View style={styles.center}>\n          <Text style={styles.title}>${name.replace(/[`$\\\\<>{}]/g, '')}</Text>\n        </View>\n      </SafeAreaView>\n    </SafeAreaProvider>\n  );\n}\n\nconst styles = StyleSheet.create({\n  root: { flex: 1, backgroundColor: '#fff' },\n  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },\n  title: { fontSize: 24, fontWeight: '700' },\n});\n`,
      '.gitignore': 'node_modules/\n.expo/\ndist/\nandroid/\nios/\n*.apk\n*.jks\n',
    };
    if (opts.ci) f['.github/workflows/build-apk.yml'] = APK_WORKFLOW;
    return f;
  }
  if (kind === 'web') {
    return {
      'index.html': `<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${name.replace(/[<>&]/g, '')}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main id="app"></main>\n  <script src="app.js"></script>\n</body>\n</html>\n`,
      'style.css': ':root { color-scheme: light dark; }\n* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; }\n#app { max-width: 720px; margin: 0 auto; padding: 16px; }\n',
      'app.js': "document.getElementById('app').textContent = 'مرحبًا';\n",
    };
  }
  if (kind === 'node') {
    return {
      'package.json': json({ name: sl, version: '1.0.0', type: 'module', main: 'index.js', scripts: { start: 'node index.js' } }),
      'index.js': "console.log('hello');\n",
      '.gitignore': 'node_modules/\n.env\n',
    };
  }
  return fail('قالب غير معروف. المتاح: ' + TEMPLATES.join('، '));
}

/* ---------------- اختصار السياق: محتوى الملفات المكتوبة سابقًا ---------------- */
export const WS_WRITE_TOOLS = ['fs_write', 'fs_edit'];

/** يختصر وسائط الكتابة القديمة (المحتوى الكامل) ليبقى السياق صغيرًا؛ المشروع محفوظ ويمكن قراءته بـ fs_read */
export function condenseArgs(name: string, a: Record<string, any>): Record<string, any> {
  const cut = (s: unknown) => (typeof s === 'string' && s.length > 160 ? s.slice(0, 80) + `…[اختُصر ${s.length} حرفًا]` : s);
  if (name === 'fs_write' && Array.isArray(a.files)) return { files: a.files.map((f: any) => ({ path: f?.path, content: typeof f?.content === 'string' ? `[محفوظ: ${lines(f.content)} سطر]` : f?.content })) };
  if (name === 'fs_edit') return { ...a, ...(Array.isArray(a.edits) ? { edits: a.edits.map((e: any) => ({ ...e, old: cut(e?.old), new: cut(e?.new) })) } : {}), ...('old' in a ? { old: cut(a.old), new: cut(a.new) } : {}) };
  return a;
}

const TOOL_BLOCK = /```[ \t]*tool[ \t]*\r?\n([\s\S]*?)```/gi;

/** يطبّق condenseArgs على استدعاءات الأدوات في الأدوار القديمة (أصلية أو كتل نصية) ويُبقي آخر keep دور كاملًا */
export function condenseHistory<T extends { role: string; content: string; toolCalls?: { id: string; name: string; args: Record<string, any> }[] }>(hist: T[], keep = 2): T[] {
  const idx = hist.map((m, i) => (m.role === 'assistant' ? i : -1)).filter((i) => i >= 0);
  const old = new Set(idx.slice(0, Math.max(0, idx.length - keep)));
  return hist.map((m, i) => {
    if (!old.has(i)) return m;
    if (m.toolCalls?.some((c) => WS_WRITE_TOOLS.includes(c.name))) return { ...m, toolCalls: m.toolCalls.map((c) => (WS_WRITE_TOOLS.includes(c.name) ? { ...c, args: condenseArgs(c.name, c.args) } : c)) } as T;
    if (!m.toolCalls && m.content.includes('```tool')) {
      const content = m.content.replace(TOOL_BLOCK, (all, body: string) => {
        try {
          const j = JSON.parse(body.trim());
          if (j && WS_WRITE_TOOLS.includes(j.name)) return '```tool\n' + JSON.stringify({ name: j.name, args: condenseArgs(j.name, j.args ?? {}) }) + '\n```';
        } catch { /* اتركها كما هي */ }
        return all;
      });
      return content === m.content ? m : ({ ...m, content } as T);
    }
    return m;
  });
}
