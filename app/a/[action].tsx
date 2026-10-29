import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { applyDefaultChatModel } from '../../src/api/chains';
import { needsComposer, parseNativeAction, startsChat } from '../../src/api/nativeCore';
import { useChats } from '../../src/store/chats';
import { useUi } from '../../src/store/data';

/** وجهة روابط الودجتات والاختصارات وبلاطة الإعدادات السريعة: quarkai://a/<action> */
export default function NativeAction() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const router = useRouter();
  useEffect(() => {
    const a = parseNativeAction(action);
    if (!a) return void router.replace('/');
    if (startsChat(a)) {
      useChats.getState().setCurrent(null);
      applyDefaultChatModel();
    }
    if (a === 'settings') return void router.replace('/settings');
    if (a === 'stats') return void router.replace('/stats');
    if (needsComposer(a)) useUi.getState().setAction(a);
    router.replace('/');
  }, [action]);
  return null;
}
