/** إجراءات الودجتات والاختصارات (روابط quarkai://a/<action>) — منطق صرف قابل للاختبار. */
export type NativeAction = 'chat' | 'new' | 'camera' | 'photo' | 'mic' | 'settings' | 'stats';
export const NATIVE_ACTIONS: NativeAction[] = ['chat', 'new', 'camera', 'photo', 'mic', 'settings', 'stats'];

export const parseNativeAction = (v: unknown): NativeAction | null => {
  const s = String(Array.isArray(v) ? v[0] : v ?? '').trim().toLowerCase();
  return (NATIVE_ACTIONS as string[]).includes(s) ? (s as NativeAction) : null;
};

/** هل يبدأ الإجراء محادثة جديدة؟ */
export const startsChat = (a: NativeAction) => a !== 'settings' && a !== 'stats';
/** هل يُمرَّر لمربع الكتابة (يحتاج الشاشة الرئيسية)؟ */
export const needsComposer = (a: NativeAction) => a === 'chat' || a === 'camera' || a === 'photo' || a === 'mic';
