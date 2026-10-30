/** سجل إلغاء الخطوات: يتيح للواجهة إلغاء خطوة واحدة جارية دون إيقاف بقية مهمة الوكيل. */
const reg = new Map<string, AbortController>();
export const registerStep = (id: string, c: AbortController) => { reg.set(id, c); };
export const unregisterStep = (id: string) => { reg.delete(id); };
/** يلغي الخطوة إن كانت جارية؛ يعيد true إن وُجدت */
export const cancelStep = (id: string): boolean => {
  const c = reg.get(id);
  if (!c || c.signal.aborted) return false;
  c.abort();
  return true;
};
