import type { UsageRecord } from '../api/types';
import { dayKey } from './util';

export interface ModelStat {
  model: string;
  calls: number;
  in: number;
  out: number;
  think: number;
}

export interface Stats {
  calls: number;
  in: number;
  out: number;
  think: number;
  est: number;
  models: ModelStat[];
  days: { key: string; label: string; total: number }[];
}

/** يجمع سجل الاستهلاك: الإجمالي، حسب النموذج، وآخر N يوم */
export function aggregate(log: UsageRecord[], now = Date.now(), nDays = 7): Stats {
  const byModel = new Map<string, ModelStat>();
  const byDay = new Map<string, number>();
  let calls = 0, tin = 0, tout = 0, tthink = 0, est = 0;
  for (const r of log) {
    calls++;
    tin += r.in;
    tout += r.out;
    tthink += r.think;
    if (r.est) est++;
    const m = byModel.get(r.model) ?? { model: r.model, calls: 0, in: 0, out: 0, think: 0 };
    m.calls++;
    m.in += r.in;
    m.out += r.out;
    m.think += r.think;
    byModel.set(r.model, m);
    const k = dayKey(r.ts);
    byDay.set(k, (byDay.get(k) ?? 0) + r.in + r.out);
  }
  const days: Stats['days'] = [];
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = dayKey(d.getTime());
    days.push({ key, label: d.toLocaleDateString('ar', { weekday: 'short' }), total: byDay.get(key) ?? 0 });
  }
  return { calls, in: tin, out: tout, think: tthink, est, models: [...byModel.values()].sort((a, b) => b.in + b.out - (a.in + a.out)), days };
}
