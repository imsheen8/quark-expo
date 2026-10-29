import { TAG_COLORS } from './chatFilter';

export interface SeedTag { id: string; name: string; color: string }

/** وسوم تلقائية للشخصيات المدمجة */
export const SEED_PERSONA_TAGS: SeedTag[] = [
  { id: 'pt_edu', name: 'تعليم', color: TAG_COLORS[1] },
  { id: 'pt_code', name: 'برمجة', color: TAG_COLORS[2] },
  { id: 'pt_write', name: 'كتابة', color: TAG_COLORS[0] },
];

/** وسوم تلقائية للقوالب المدمجة */
export const SEED_TEMPLATE_TAGS: SeedTag[] = [
  { id: 'tt_edu', name: 'تعليم', color: TAG_COLORS[1] },
  { id: 'tt_sum', name: 'تلخيص', color: TAG_COLORS[3] },
  { id: 'tt_lang', name: 'لغة', color: TAG_COLORS[4] },
];

/** وسوم العناصر المدمجة في المكتبة (بحسب المعرّف) */
export const SEED_LIB_TAGS: Record<string, string[]> = {
  t1: ['tt_edu'], t2: ['tt_sum'], t3: ['tt_lang'], t4: ['tt_lang'],
  p1: ['pt_edu'], p2: ['pt_code'], p3: ['pt_write'],
};
