/** يربط النماذج التلقائية بالمخازن: سلاسل المهام الخلفية والرؤية، وتبديل نموذج المحادثة الجديدة. */
import { activeModel, useSettings } from '../store/settings';
import { chatChain, researchModel, resolveRef, utilChain, type AM } from './defaultsCore';
import { chatStream, completeOnce } from './stream';
import type { Chunk } from './types';
import type { BuildArgs } from './payload';
import { log } from '../store/logs';

export const utilModels = (): AM[] => {
  const S = useSettings.getState();
  return utilChain(S.defs, S.endpoints, activeModel());
};
export const chatModels = (hasImages: boolean): AM[] => {
  const S = useSettings.getState();
  return chatChain(S.defs, S.endpoints, activeModel(), hasImages);
};
export const researchAM = (): AM | null => {
  const S = useSettings.getState();
  return researchModel(S.defs, S.endpoints, activeModel());
};

/** عند بدء محادثة جديدة: يختار النموذج التلقائي إن كان محدّدًا وصالحًا */
export function applyDefaultChatModel() {
  const S = useSettings.getState();
  const a = resolveRef(S.defs.chat, S.endpoints);
  if (a && !(S.sel?.ep === a.ep.id && S.sel.model === a.model)) S.select(a.ep.id, a.model);
}

type A = Omit<BuildArgs, 'stream' | 'drop' | 'ep' | 'model'> & { signal?: AbortSignal };

/** طلب غير متدفّق مع الانتقال للبديل عند الفشل. يعيد النص والنموذج الذي نجح. */
export async function completeChain(list: AM[], a: A): Promise<{ text: string; am: AM }> {
  let last: unknown;
  for (const am of list) {
    try {
      return { text: await completeOnce({ ...a, ep: am.ep, model: am.model }), am };
    } catch (e) {
      if ((e as any)?.name === 'AbortError' || a.signal?.aborted) throw e;
      log('fallback', `${am.model}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('لا يوجد نموذج صالح. أضف نقطة اتصال وفعّل نموذجًا.');
}

/** بثّ مع الانتقال للبديل إن فشل قبل وصول أي جزء من الرد */
export async function* streamChain(list: AM[], a: A, onPick?: (am: AM) => void): AsyncGenerator<Chunk> {
  let last: unknown;
  for (const am of list) {
    let got = false;
    try {
      onPick?.(am);
      for await (const ch of chatStream({ ...a, ep: am.ep, model: am.model })) {
        got = true;
        yield ch;
      }
      return;
    } catch (e) {
      if ((e as any)?.name === 'AbortError' || a.signal?.aborted || got) throw e;
      log('fallback', `${am.model}: ${e instanceof Error ? e.message : String(e)}`, 'warn');
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('لا يوجد نموذج');
}
