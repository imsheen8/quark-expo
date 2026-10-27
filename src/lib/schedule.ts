/** جدولة المهام: حساب الموعد التالي (بتوقيت الجهاز المحلي) — منطق صرف. */

export type EventKind = 'messages' | 'newchat' | 'research';

export type Schedule =
  | { mode: 'once'; at: number }
  | { mode: 'interval'; every: number }
  | { mode: 'daily'; time: string }
  | { mode: 'weekly'; time: string; days: number[] }
  | { mode: 'monthly'; time: string; day: number }
  | { mode: 'cron'; cron: string }
  | { mode: 'event'; kind: EventKind; n: number };

const parseTime = (t: string): [number, number] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  if (!m) return [8, 0];
  return [Math.min(23, +m[1]), Math.min(59, +m[2])];
};

const at = (d: Date, h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
const daysIn = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/* ---------------- Cron (5 حقول: دقيقة ساعة يوم-شهر شهر يوم-أسبوع) ---------------- */
function parseField(f: string, lo: number, hi: number): Set<number> | null {
  const out = new Set<number>();
  for (const part of f.split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part.trim());
    if (!m) return null;
    const step = m[2] ? +m[2] : 1;
    if (step < 1) return null;
    let a = lo, b = hi;
    if (m[1] !== '*') {
      const [x, y] = m[1].split('-');
      a = +x;
      b = y !== undefined ? +y : m[2] ? hi : +x;
    }
    if (a < lo || b > hi || a > b) return null;
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out.size ? out : null;
}

export interface CronSpec {
  min: Set<number>; hour: Set<number>; dom: Set<number>; mon: Set<number>; dow: Set<number>; domStar: boolean; dowStar: boolean;
}

export function parseCron(s: string): CronSpec | null {
  const p = String(s || '').trim().split(/\s+/);
  if (p.length !== 5) return null;
  const min = parseField(p[0], 0, 59), hour = parseField(p[1], 0, 23), dom = parseField(p[2], 1, 31), mon = parseField(p[3], 1, 12);
  const dowRaw = parseField(p[4].replace(/\b7\b/g, '0'), 0, 6);
  if (!min || !hour || !dom || !mon || !dowRaw) return null;
  return { min, hour, dom, mon, dow: dowRaw, domStar: p[2] === '*', dowStar: p[4] === '*' };
}

export function cronNext(spec: CronSpec, after: number): number | null {
  const start = new Date(after);
  start.setSeconds(0, 0);
  for (let i = 0; i <= 800; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (!spec.mon.has(d.getMonth() + 1)) continue;
    const domOk = spec.dom.has(d.getDate()), dowOk = spec.dow.has(d.getDay());
    // قاعدة cron: إن تقيّد الحقلان معًا يكفي تحقق أحدهما
    const dayOk = spec.domStar && spec.dowStar ? true : spec.domStar ? dowOk : spec.dowStar ? domOk : domOk || dowOk;
    if (!dayOk) continue;
    for (const h of [...spec.hour].sort((a, b) => a - b)) {
      for (const m of [...spec.min].sort((a, b) => a - b)) {
        const t = at(d, h, m).getTime();
        if (t > after) return t;
      }
    }
  }
  return null;
}

/** الموعد التالي بعد `after` (للأحداث: لا موعد زمني). null = لن يتكرر */
export function nextRun(s: Schedule, after: number): number | null {
  switch (s.mode) {
    case 'once':
      return s.at > after ? s.at : null;
    case 'interval':
      return after + Math.max(1, s.every) * 60000;
    case 'daily': {
      const [h, m] = parseTime(s.time);
      const d = new Date(after);
      let t = at(d, h, m).getTime();
      if (t <= after) t = at(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), h, m).getTime();
      return t;
    }
    case 'weekly': {
      const [h, m] = parseTime(s.time);
      const days = s.days.length ? s.days : [0];
      const d = new Date(after);
      for (let i = 0; i < 8; i++) {
        const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
        if (!days.includes(c.getDay())) continue;
        const t = at(c, h, m).getTime();
        if (t > after) return t;
      }
      return null;
    }
    case 'monthly': {
      const [h, m] = parseTime(s.time);
      const d = new Date(after);
      for (let i = 0; i < 14; i++) {
        const y = d.getFullYear(), mo = d.getMonth() + i;
        const base = new Date(y, mo, 1);
        const day = Math.min(Math.max(1, s.day), daysIn(base.getFullYear(), base.getMonth()));
        const t = new Date(base.getFullYear(), base.getMonth(), day, h, m, 0, 0).getTime();
        if (t > after) return t;
      }
      return null;
    }
    case 'cron': {
      const spec = parseCron(s.cron);
      return spec ? cronNext(spec, after) : null;
    }
    case 'event':
      return null;
  }
}

const DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function describeSchedule(s: Schedule): string {
  switch (s.mode) {
    case 'once':
      return 'مرة واحدة: ' + new Date(s.at).toLocaleString('ar');
    case 'interval':
      return s.every % 1440 === 0 ? `كل ${s.every / 1440} يوم` : s.every % 60 === 0 ? `كل ${s.every / 60} ساعة` : `كل ${s.every} دقيقة`;
    case 'daily':
      return `يوميًا ${s.time}`;
    case 'weekly':
      return `أسبوعيًا (${s.days.map((d) => DAY_AR[d]).join('، ')}) ${s.time}`;
    case 'monthly':
      return `شهريًا يوم ${s.day} ${s.time}`;
    case 'cron':
      return 'Cron: ' + s.cron;
    case 'event':
      return s.kind === 'messages' ? `كل ${s.n} رسائل` : s.kind === 'newchat' ? `كل ${s.n} محادثات جديدة` : `بعد كل ${s.n} بحث عميق`;
  }
}

export function validateSchedule(s: Schedule): string {
  if (s.mode === 'once' && !(s.at > 0)) return 'حدّد وقت التنفيذ.';
  if (s.mode === 'interval' && !(s.every >= 1)) return 'الفاصل يجب أن يكون دقيقة واحدة على الأقل.';
  if ((s.mode === 'daily' || s.mode === 'weekly' || s.mode === 'monthly') && !/^\d{1,2}:\d{2}$/.test(s.time)) return 'الوقت بصيغة HH:MM.';
  if (s.mode === 'weekly' && !s.days.length) return 'اختر يومًا واحدًا على الأقل.';
  if (s.mode === 'monthly' && !(s.day >= 1 && s.day <= 31)) return 'يوم الشهر بين 1 و31.';
  if (s.mode === 'cron' && !parseCron(s.cron)) return 'تعبير Cron غير صالح (5 حقول).';
  if (s.mode === 'event' && !(s.n >= 1)) return 'عدد الأحداث يجب ألا يقل عن 1.';
  return '';
}
