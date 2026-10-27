/** المزامنة السحابية: نرفع عناصر x_* فقط ونُبقي عناصر ai_* القادمة من تطبيق الويب كما هي. */
import { useChats } from '../store/chats';
import { useLibrary, useMemory, toast } from '../store/data';
import { useTasks } from '../store/features';
import { useSettings } from '../store/settings';
import type { Chat, LibItem, MemoryItem } from './types';
import { syncGet, syncInfo, syncPutRaw, signedIn } from './managed';
import { mergeBags, overQuota, toBag, fromBag, type SyncBag } from './syncCore';

const P = { chat: 'x_chat:', lib: 'x_lib:', mem: 'x_mem:', task: 'x_task:' };
const TOMB_KEY = 'x_tomb';
let busy = false;
let lastBag: SyncBag | null = null;

export type SyncResult = { ok: boolean; msg: string };

function localBag(prev?: SyncBag): SyncBag {
  const chats = useChats.getState().chats.filter((c) => !c.temp).map((c) => ({ ...c, updated: c.updated }));
  const lib = useLibrary.getState().items.map((x) => ({ ...x, updated: x.ts }));
  const mem = useMemory.getState().items.map((x) => ({ ...x, updated: x.updatedAt }));
  const tasks = useTasks.getState().items.map((x) => ({ ...x, runs: [], updated: x.updated }));
  const bags = [toBag(chats, P.chat, prev), toBag(lib, P.lib, prev), toBag(mem, P.mem, prev), toBag(tasks, P.task, prev)];
  return bags.reduce((a, b) => ({ items: { ...a.items, ...b.items }, tombs: { ...a.tombs, ...b.tombs } }), { items: {}, tombs: {} });
}

function applyBag(bag: SyncBag) {
  const chats = fromBag<Chat & { updated: number }>(bag, P.chat);
  const keepTemp = useChats.getState().chats.filter((c) => c.temp);
  useChats.setState({ chats: [...chats.sort((a, b) => b.updated - a.updated), ...keepTemp] });
  useLibrary.getState().replaceAll(fromBag<LibItem>(bag, P.lib).map(({ ...x }) => { delete (x as any).updated; return x; }));
  useMemory.getState().replaceAll(fromBag<MemoryItem>(bag, P.mem));
  useTasks.getState().replaceAll(fromBag<any>(bag, P.task).map((t) => ({ ...t, runs: t.runs || [] })));
}

/** مزامنة كاملة: سحب ← دمج ← تطبيق ← رفع */
export async function syncNow(): Promise<SyncResult> {
  if (busy) return { ok: false, msg: 'المزامنة جارية.' };
  if (!signedIn()) return { ok: false, msg: 'سجّل الدخول أولًا.' };
  busy = true;
  try {
    const info = await syncInfo();
    if (!info) return { ok: false, msg: 'تعذّر الاتصال بالخدمة.' };
    if (info.s === 401) return { ok: false, msg: 'انتهت الجلسة. سجّل الدخول من جديد.' };
    if (info.s === 403) return { ok: false, msg: info.j?.error?.message || 'الحساب موقوف.' };
    const quotaMb = (info.j.quota || 5 * 1048576) / 1048576;

    let remote: any = {};
    let remoteBag: SyncBag = { items: {}, tombs: {} };
    if (info.j.used > 0) {
      const r = await syncGet();
      if (!r || r.s !== 200) return { ok: false, msg: 'تعذّر جلب النسخة السحابية.' };
      if (r.j?.enc) return { ok: false, msg: 'نسختك السحابية مشفّرة بكلمة سر من تطبيق الويب، وهذا التطبيق لا يدعم فكّ التشفير. أوقف التشفير هناك أولًا.' };
      remote = r.j || {};
      const items: Record<string, any> = {};
      for (const [k, v] of Object.entries<any>(remote.items || {})) if (k.startsWith('x_') && k !== TOMB_KEY) items[k] = v;
      remoteBag = { items, tombs: remote.items?.[TOMB_KEY] || {} };
    }
    const local = localBag(lastBag ?? undefined);
    const merged = mergeBags(local, remoteBag);
    applyBag(merged);
    lastBag = merged;

    // ما لا نملكه (ai_* من الويب) يبقى كما هو
    const keep: Record<string, any> = {};
    for (const [k, v] of Object.entries<any>(remote.items || {})) if (!k.startsWith('x_')) keep[k] = v;
    const inner = { ...remote, v: 1, at: Date.now(), items: { ...keep, ...merged.items, [TOMB_KEY]: merged.tombs } };
    if (overQuota(inner, quotaMb - 0.01)) return { ok: false, msg: `البيانات أكبر من مساحتك السحابية (${quotaMb.toFixed(0)} MB). احذف محادثات قديمة أو رقِّ الخطة.` };
    const put = await syncPutRaw(JSON.stringify(inner));
    if (!put) return { ok: false, msg: 'تعذّر رفع النسخة.' };
    if (put.s !== 200) return { ok: false, msg: put.j?.error?.message || `فشل الرفع (${put.s})` };
    useSettings.getState().patch({ sync: { ...useSettings.getState().sync, last: Date.now() } });
    return { ok: true, msg: 'تمت المزامنة.' };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    busy = false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** مزامنة مؤجّلة بعد التعديلات */
export function scheduleSync() {
  const s = useSettings.getState();
  if (busy || !s.sync.on || !s.sync.auto || !signedIn()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const r = await syncNow();
    if (!r.ok) toast('المزامنة: ' + r.msg);
  }, 8000);
}
