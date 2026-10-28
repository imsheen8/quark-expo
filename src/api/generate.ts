import { activeModel, modelKey, useSettings } from '../store/settings';
import { useChats, useStream } from '../store/chats';
import { toast, useLibrary, useMemory, useUsage } from '../store/data';
import { loadAll } from '../lib/images';
import { extractRemember, memoryContext, pickMemories } from '../lib/memoryRank';
import { estTokens, shortModel, uid } from '../lib/util';
import { buildHistory } from './history';
import { mergeUsage, splitThink } from './parsers';
import { chatStream, completeOnce } from './stream';
import { agentLoop, fireTaskEvent, fireWebhooks, runApiCall, searchForChat, streamTurn } from './engines';
import { wrapResult } from './agentCore';
import { integPrompt, parseApiCall } from './integCore';
import { useInteg } from '../store/features';
import type { AgentStep, Chat, FileRef, ImageRef, Msg, Params, Usage } from './types';

let controller: AbortController | null = null;

export const isBusy = () => useStream.getState().busy;

export function stopGeneration() {
  controller?.abort();
}

/** المعاملات: العامة ← الخاصة بالنموذج ← الخاصة بالمحادثة */
export function resolveParams(chat?: Chat, am = activeModel()): Params {
  const s = useSettings.getState();
  const clean = (o?: Params): Params => {
    const r: Params = {};
    (['temperature', 'top_p', 'max_tokens'] as const).forEach((k) => {
      const v = o?.[k];
      if (typeof v === 'number' && isFinite(v)) r[k] = v;
    });
    return r;
  };
  return { ...clean(s.params.global), ...clean(am ? s.params.models[modelKey(am.ep.id, am.model)] : undefined), ...clean(chat?.params) };
}

export function buildSystem(query: string): string {
  const s = useSettings.getState();
  const persona = useLibrary.getState().items.find((i) => i.id === s.activePersonaId && i.kind === 'persona');
  const nm = s.profile.nick || s.profile.name;
  const parts: string[] = [s.systemPrompt];
  if (persona) parts.push('الشخصية المطلوبة منك: ' + persona.text);
  if (nm) parts.push('اسم المستخدم: ' + nm);
  if (s.profile.prefs) parts.push('تفضيلات المستخدم الشخصية (طبّقها في كل الردود): ' + s.profile.prefs);
  if (s.memory.enabled) {
    const mem = useMemory.getState();
    const picked = pickMemories(mem.items, query, s.memory.max);
    if (picked.length) {
      parts.push(memoryContext(picked));
      mem.markUsed(picked.map((p) => p.id));
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

export interface Outgoing {
  text: string;
  imgs?: ImageRef[];
  files?: FileRef[];
}

/** يضيف رسالة المستخدم (وينشئ المحادثة عند الحاجة) ثم يولّد الرد. */
export async function sendMessage(o: Outgoing): Promise<void> {
  if (isBusy()) return;
  const st = useChats.getState();
  let chat = st.current();
  if (!chat) chat = st.create();
  const text = o.text.trim();

  const mem = useSettings.getState().memory;
  const rem = extractRemember(text);
  if (rem && mem.enabled && mem.auto) {
    useMemory.getState().add(rem, 'fact', 'auto');
    toast('حُفظ في الذاكرة');
  }

  const msg: Msg = { id: uid(), role: 'user', content: text, ts: Date.now(), ...(o.imgs?.length ? { imgs: o.imgs } : {}), ...(o.files?.length ? { files: o.files } : {}) };
  const isNew = chat.messages.length === 0;
  st.addMessage(chat.id, msg);
  if (isNew) { fireTaskEvent('newchat'); void fireWebhooks('session.created', { chatId: chat.id }); }
  fireTaskEvent('messages');
  void fireWebhooks('chat.message', { chatId: chat.id, text });
  await generateReply(chat.id);
}

/** يعيد توليد آخر رد (يحذف آخر رسالة مساعد إن وُجدت). */
export async function regenerate(chatId: string): Promise<void> {
  if (isBusy()) return;
  const c = useChats.getState().chats.find((x) => x.id === chatId);
  if (!c) return;
  const last = c.messages[c.messages.length - 1];
  if (last && last.role === 'assistant') useChats.getState().deleteMessage(chatId, last.id);
  await generateReply(chatId);
}

export async function generateReply(chatId: string): Promise<void> {
  const am = activeModel();
  const store = useChats.getState();
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return;
  if (!am) {
    store.addMessage(chatId, { id: uid(), role: 'assistant', content: 'لا يوجد نموذج محدد. أضف نقطة اتصال وفعّل نموذجًا من «النماذج» ثم اخترْه.', ts: Date.now(), error: true });
    return;
  }

  const stream = useStream.getState();
  stream.set({ chatId, busy: true, text: '', think: '', secs: 0, status: '' });
  controller = new AbortController();
  const signal = controller.signal;

  let full = '';
  let reason = '';
  let usage: Partial<Usage> = {};
  let t0 = 0;
  let t1 = 0;
  let steps: AgentStep[] = [];
  let sources: { n: number; title: string; url: string; host: string }[] = [];
  let altP: Promise<NonNullable<Msg['alt']>> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const view = () => {
    const sp = splitThink(full);
    const think = [reason, sp.think].filter(Boolean).join('\n\n');
    if (think && !t0) t0 = Date.now();
    if (sp.ans && t0 && !t1) t1 = Date.now();
    return { think, ans: sp.ans, secs: t0 ? Math.max(1, Math.round(((t1 || Date.now()) - t0) / 1000)) : 0 };
  };
  const paint = () => {
    timer = null;
    const v = view();
    useStream.getState().set({ text: v.ans, think: v.think, secs: v.secs });
  };

  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
  let errMsg: string | null = null;
  try {
    const imgs = await loadAll(chat.messages.flatMap((m) => m.imgs || []));
    const history = buildHistory(chat.messages, imgs);
    if (!history.length || history[history.length - 1].role !== 'user') throw new Error('لا توجد رسالة لإرسالها.');
    let system = buildSystem(lastUser?.content || '');
    const params = resolveParams(chat, am);
    const thinking = useSettings.getState().thinking;
    const S = useSettings.getState();
    const integOn = useInteg.getState().items.some((i) => i.enabled);

    if (S.modes.agent) {
      useStream.getState().set({ status: 'وضع الوكيل' });
      const r = await agentLoop({
        am, history, system, signal, conf: S.agent,
        onStep: (st) => { steps = st; useStream.getState().set({ steps: st }); },
        onDelta: (a, t) => { full = a; reason = t; if (!timer) timer = setTimeout(paint, 60); },
      });
      full = r.text; reason = r.think; usage = r.usage; steps = r.steps;
    } else {
      if (S.modes.web && lastUser) {
        useStream.getState().set({ status: 'يبحث في الويب…' });
        try {
          const w = await searchForChat(lastUser.content, signal);
          system += '\n\n' + w.ctx;
          sources = w.sources;
        } catch (e) {
          if ((e as any)?.name === 'AbortError' || signal.aborted) throw e;
          toast('تعذّر بحث الويب: ' + (e instanceof Error ? e.message : String(e)));
        }
        useStream.getState().set({ status: '' });
      }
      if (integOn) system += '\n\n' + integPrompt(useInteg.getState().items);
      const cmp = S.modes.compare && S.cmpSel ? S.endpoints.find((e) => e.id === S.cmpSel!.ep) : null;
      if (cmp && S.cmpSel) {
        altP = completeOnce({ ep: cmp, model: S.cmpSel.model, messages: history, system, params, signal })
          .then((t) => ({ model: shortModel(S.cmpSel!.model), content: splitThink(t).ans || t, thinking: splitThink(t).think || undefined }))
          .catch((e) => ({ model: shortModel(S.cmpSel!.model), content: e instanceof Error ? e.message : String(e), error: true }));
      }
      for await (const ch of chatStream({ ep: am.ep, model: am.model, messages: history, system, params, thinking, signal })) {
        if (ch.kind === 'text') full += ch.text;
        else if (ch.kind === 'think') reason += ch.text;
        else usage = mergeUsage(usage as Usage, ch.usage);
        if (!timer) timer = setTimeout(paint, 60);
      }
      const pc = integOn ? parseApiCall(splitThink(full).ans) : null;
      if (pc) {
        let res: string;
        try { res = pc.call ? await runApiCall(pc.call, signal, true) : pc.error || 'خطأ'; } catch (e) { if (signal.aborted) throw e; res = 'خطأ: ' + (e instanceof Error ? e.message : String(e)); }
        steps.push({ id: uid(5), tool: 'api_call', args: (pc.call as any) || {}, status: pc.call ? 'ok' : 'error', result: res.slice(0, 1500), ts: Date.now() });
        useStream.getState().set({ steps: [...steps] });
        const r2 = await streamTurn(am, [...history, { role: 'assistant', content: splitThink(full).ans }, { role: 'user', content: wrapResult('api_call', !!pc.call, res) }], system, signal);
        full = r2.text; reason = r2.think || reason; usage = mergeUsage(usage as Usage, r2.usage);
      }
    }
    if (!full && !reason) throw new Error('لم يصل أي رد من النموذج. تأكد من صحة معرّف النموذج.');
  } catch (e) {
    if ((e as any)?.name === 'AbortError' || signal.aborted) {
      if (full || reason) toast('تم الإيقاف');
      else toast('تم الإيقاف');
    } else errMsg = e instanceof Error ? e.message : String(e);
  } finally {
    if (timer) clearTimeout(timer);
  }

  let alt: Msg['alt'] | undefined;
  if (altP) alt = await altP;
  const v = view();
  const cur = useChats.getState();
  if (errMsg && !v.ans) {
    cur.addMessage(chatId, { id: uid(), role: 'assistant', content: errMsg, ts: Date.now(), error: true, model: shortModel(am.model) });
  } else if (v.ans || v.think) {
    const inEst = estTokens(chat.messages.map((m) => m.content).join(' '));
    const outEst = estTokens(v.ans + v.think);
    const u: Usage = { in: usage.in ?? inEst, out: usage.out ?? outEst, think: usage.think, est: usage.in == null || usage.out == null };
    const m: Msg = {
      id: uid(),
      role: 'assistant',
      content: v.ans || '(انتهى النموذج من التفكير دون إجابة نهائية. جرّب إعادة المحاولة أو زِد Max Tokens.)',
      ts: Date.now(),
      model: shortModel(am.model),
      usage: u,
      ...(v.think ? { thinking: v.think, thinkSecs: v.secs } : {}),
      ...(errMsg ? { error: true } : {}),
      ...(steps.length ? { steps } : {}),
      ...(sources.length ? { sources } : {}),
      ...(alt ? { alt } : {}),
    };
    cur.addMessage(chatId, m);
    if (!chat.temp)
      useUsage.getState().push({ ts: Date.now(), model: am.model, ep: am.ep.id, in: u.in, out: u.out, think: u.think ?? 0, est: !!u.est });
  }
  useStream.getState().reset();
  controller = null;
  if (!errMsg) void fireWebhooks('chat.completed', { chatId, text: v.ans });

  const c2 = useChats.getState().chats.find((c) => c.id === chatId);
  if (c2 && !errMsg && useSettings.getState().autoTitle && c2.autoTitle && !c2.temp && c2.messages.filter((m) => m.role === 'assistant').length === 1) {
    // النموذج المحلي بطيء: عنوان من أول كلمات الرسالة بدل توليد ثانٍ
    if (am.ep.proto === 'llama') useChats.getState().rename(c2.id, cleanTitle((lastUser?.content || '').slice(0, 60)) || 'محادثة جديدة', true);
    else void makeTitle(c2.id);
  }
}

export function cleanTitle(t: string): string {
  t = String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  t = t.split('\n').map((x) => x.trim()).find(Boolean) || '';
  t = t
    .replace(/^(العنوان|عنوان المحادثة|title)\s*[:：]\s*/i, '')
    .replace(/^[#>*\-\s"'«»“”`]+|[\s"'«»“”`*.،。!؟?:؛;]+$/g, '')
    .replace(/\s+/g, ' ');
  if (t.length > 50) {
    t = t.slice(0, 50);
    t = t.slice(0, t.lastIndexOf(' ') > 20 ? t.lastIndexOf(' ') : 50);
  }
  return t;
}

export async function makeTitle(chatId: string, manual = false): Promise<boolean> {
  const am = activeModel();
  const c = useChats.getState().chats.find((x) => x.id === chatId);
  if (!am || !c) {
    if (manual) toast('أضف نقطة اتصال أولًا');
    return false;
  }
  const u = c.messages.find((m) => m.role === 'user' && !m.error);
  const a = c.messages.find((m) => m.role === 'assistant' && !m.error);
  if (!u) return false;
  const cut = (x: string, n: number) => (x.length > n ? x.slice(0, n) + '…' : x);
  const prompt =
    'اكتب عنوانًا قصيرًا جدًا (من 2 إلى 5 كلمات) يلخّص موضوع هذه المحادثة، بنفس لغة المستخدم، دون علامات اقتباس أو نقطة، وأجب بالعنوان فقط.\n\nالمستخدم: ' +
    cut(u.content, 600) +
    (a ? '\n\nالمساعد: ' + cut(a.content, 600) : '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const t = cleanTitle(await completeOnce({ ep: am.ep, model: am.model, messages: [{ role: 'user', content: prompt }], system: '', params: { max_tokens: 60 }, signal: ctl.signal }));
    if (!t) {
      if (manual) toast('لم يتمكن النموذج من توليد عنوان');
      return false;
    }
    const fresh = useChats.getState().chats.find((x) => x.id === chatId);
    if (!fresh || (!manual && !fresh.autoTitle)) return false;
    useChats.getState().rename(chatId, t, false);
    if (manual) toast('تم تحديث عنوان المحادثة');
    return true;
  } catch (e) {
    if (manual) toast('تعذّر توليد العنوان: ' + (e instanceof Error ? e.message : String(e)));
    return false;
  } finally {
    clearTimeout(timer);
  }
}
