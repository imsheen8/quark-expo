/** متغيرات القوالب: {{الاسم}} أو {{الاسم|القيمة الافتراضية}} */
export interface TplVar {
  name: string;
  def: string;
}

const RE = /\{\{\s*([^{}|]+?)\s*(?:\|\s*([^{}]*?)\s*)?\}\}/g;

export function parseVars(text: string): TplVar[] {
  const seen = new Map<string, TplVar>();
  let m: RegExpExecArray | null;
  const re = new RegExp(RE.source, 'g');
  while ((m = re.exec(text))) if (!seen.has(m[1])) seen.set(m[1], { name: m[1], def: m[2] ?? '' });
  return [...seen.values()];
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(new RegExp(RE.source, 'g'), (_s, name: string, def?: string) => (values[name]?.trim() ? values[name] : def ?? ''));
}
