/** محلّل Markdown خفيف يعطي كتلًا بسيطة يعرضها مكوّن React Native. */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export type Block =
  | { t: 'p'; inl: Inline[] }
  | { t: 'h'; level: number; inl: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][]; start: number }
  | { t: 'quote'; inl: Inline[] }
  | { t: 'code'; lang: string; code: string; open: boolean }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'hr' };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(^|[^*])\*([^*\n]+)\*(?!\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const lead = m[6] ? m[6].length : 0;
    if (m.index + lead > last) out.push({ t: 'text', v: s.slice(last, m.index + lead) });
    if (m[1] != null) out.push({ t: 'code', v: m[1] });
    else if (m[2] != null || m[3] != null) out.push({ t: 'bold', v: (m[2] ?? m[3]) as string });
    else if (m[4] != null) out.push({ t: 'link', v: m[4], href: m[5] });
    else if (m[7] != null) out.push({ t: 'italic', v: m[7] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

const splitRow = (r: string) =>
  r
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

function parseText(src: string, out: Block[]) {
  const lines = src.split('\n');
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push({ t: 'p', inl: parseInline(para.join('\n')) });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) {
      flush();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {
      flush();
      out.push({ t: 'h', level: m[1].length, inl: parseInline(m[2]) });
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(l)) {
      flush();
      out.push({ t: 'hr' });
    } else if (/^\s*>/.test(l)) {
      flush();
      const q: string[] = [l.replace(/^\s*>\s?/, '')];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) q.push(lines[++i].replace(/^\s*>\s?/, ''));
      out.push({ t: 'quote', inl: parseInline(q.join('\n')) });
    } else if (/^\s*[-*+•]\s+/.test(l)) {
      flush();
      const items = [parseInline(l.replace(/^\s*[-*+•]\s+/, ''))];
      while (i + 1 < lines.length && /^\s*[-*+•]\s+/.test(lines[i + 1])) items.push(parseInline(lines[++i].replace(/^\s*[-*+•]\s+/, '')));
      out.push({ t: 'ul', items });
    } else if ((m = /^\s*(\d+)[.)]\s+/.exec(l))) {
      flush();
      const start = parseInt(m[1], 10);
      const items = [parseInline(l.replace(/^\s*\d+[.)]\s+/, ''))];
      while (i + 1 < lines.length && /^\s*\d+[.)]\s+/.test(lines[i + 1])) items.push(parseInline(lines[++i].replace(/^\s*\d+[.)]\s+/, '')));
      out.push({ t: 'ol', items, start });
    } else if (l.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      flush();
      const head = splitRow(l).map(parseInline);
      i++;
      const rows: Inline[][][] = [];
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) rows.push(splitRow(lines[++i]).map(parseInline));
      out.push({ t: 'table', head, rows });
    } else para.push(l);
  }
  flush();
}

export function parseMarkdown(text: string): Block[] {
  const out: Block[] = [];
  const re = /```([\w+#.-]*)[ \t]*\n?([\s\S]*?)(```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    parseText(text.slice(last, m.index), out);
    out.push({ t: 'code', lang: m[1] || '', code: m[2].replace(/\n$/, ''), open: m[3] !== '```' });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  parseText(text.slice(last), out);
  return out;
}

/* ---------- تلوين الأكواد ---------- */
export type Tok = { v: string; k: 'c' | 's' | 'n' | 'k' | '' };
const KW = /^(?:function|const|let|var|return|if|else|for|while|class|import|from|export|default|new|this|async|await|try|catch|throw|def|self|lambda|None|True|False|true|false|null|undefined|public|private|static|void|int|string|bool|fn|pub|struct|enum|impl|use|mod|match|in|is|not|and|or|elif|with|as|yield|switch|case|break|continue|extends|interface|type|package|func|go|defer|chan|range)$/;
const REST = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/;
const RE_C = new RegExp('(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|' + REST.source, 'g');
const RE_H = new RegExp('(#[^\\n]*)|' + REST.source, 'g');

export function highlight(code: string, lang: string): Tok[] {
  const re = /^(python|py|bash|sh|shell|zsh|yaml|yml|ruby|rb|toml|perl)$/i.test(lang) ? RE_H : RE_C;
  re.lastIndex = 0;
  const out: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ v: code.slice(last, m.index), k: '' });
    const t = m[0];
    out.push({ v: t, k: m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : KW.test(t) ? 'k' : '' });
    last = m.index + t.length;
    if (t.length === 0) re.lastIndex++;
  }
  if (last < code.length) out.push({ v: code.slice(last), k: '' });
  return out;
}
