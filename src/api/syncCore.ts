/** المزامنة السحابية: دمج عناصر مع شواهد حذف — منطق صرف. */

export interface SyncItem { id: string; updated: number; [k: string]: any }
export interface SyncBag { items: Record<string, SyncItem>; tombs: Record<string, number> }

/** يدمج نسختين: الأحدث يفوز، والحذف الأحدث من التعديل يفوز */
export function mergeBags(a: SyncBag, b: SyncBag): SyncBag {
  const tombs: Record<string, number> = { ...a.tombs };
  for (const [k, t] of Object.entries(b.tombs)) tombs[k] = Math.max(tombs[k] || 0, t);
  const items: Record<string, SyncItem> = {};
  for (const src of [a.items, b.items])
    for (const [k, v] of Object.entries(src)) {
      const cur = items[k];
      if (!cur || v.updated > cur.updated) items[k] = v;
    }
  for (const k of Object.keys(items)) if ((tombs[k] || 0) >= items[k].updated) delete items[k];
  return { items, tombs };
}

export function toBag<T extends { id: string; updated?: number }>(list: T[], prefix: string, prev?: SyncBag, now = Date.now()): SyncBag {
  const items: Record<string, SyncItem> = {};
  for (const x of list) items[prefix + x.id] = { ...(x as any), updated: x.updated ?? now };
  const tombs = { ...(prev?.tombs || {}) };
  if (prev) for (const k of Object.keys(prev.items)) if (k.startsWith(prefix) && !items[k]) tombs[k] = now;
  return { items, tombs };
}

export const fromBag = <T>(bag: SyncBag, prefix: string): T[] =>
  Object.entries(bag.items).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v as unknown as T);

export const sizeOf = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;
export const overQuota = (x: unknown, mb: number) => sizeOf(x) > mb * 1024 * 1024;
