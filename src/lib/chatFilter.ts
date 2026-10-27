import type { Chat } from '../api/types';

export const FILTERS = [
  { k: 'recent', label: 'الأخيرة', icon: 'message-circle' },
  { k: 'today', label: 'اليوم', icon: 'clock' },
  { k: 'week', label: 'هذا الأسبوع', icon: 'calendar' },
  { k: 'month', label: 'هذا الشهر', icon: 'calendar' },
  { k: 'fav', label: 'المفضلة', icon: 'star' },
] as const;

export function passFilter(c: Pick<Chat, 'updated' | 'pinned' | 'tags'>, f: string, now = Date.now()): boolean {
  if (f === 'recent') return true;
  if (f === 'fav') return !!c.pinned;
  if (f.startsWith('tag:')) return !!c.tags?.includes(f.slice(4));
  const ts = c.updated || 0;
  if (f === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return ts >= d.getTime();
  }
  if (f === 'week') return ts >= now - 7 * 864e5;
  if (f === 'month') return ts >= now - 30 * 864e5;
  return true;
}

export const TAG_COLORS = ['#d97757', '#4f9d69', '#5b8def', '#b66dd6', '#d4a017', '#e0527a', '#2fa5a5', '#8a7bd8'];

export const cleanTagName = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 24);
