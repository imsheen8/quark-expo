import {
  IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Amiri_400Regular } from '@expo-google-fonts/amiri';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { AppState, I18nManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalDialogs } from '../src/components/chat/Extras';
import { ensureManaged } from '../src/api/managed';
import { runDueTasks, syncTaskNotifications } from '../src/api/engines';
import { registerBackground } from '../src/api/background';
import { scheduleSync } from '../src/api/sync';
import { useChats } from '../src/store/chats';
import { useTasks } from '../src/store/features';
import { Intro } from '../src/components/Intro';
import { LockScreen } from '../src/components/LockScreen';
import { Sidebar } from '../src/components/Sidebar';
import { RTL, Toast } from '../src/components/ui/kit';
import { useHydrated } from '../src/hooks/useHydrated';
import { hasPin } from '../src/lib/security';
import { useUi } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors, useMode } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// الواجهة عربية بالكامل. الاتجاه يُفرض أيضًا على مستوى النظام (يسري من التشغيل التالي)،
// وكل شاشة تفرض direction:'rtl' بنفسها فلا تعتمد على إعادة التشغيل.
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {}

const LOCK_AFTER_MS = 20_000;

function Shell() {
  const c = useColors();
  const mode = useMode();
  const locked = useUi((s) => s.locked);
  const setLocked = useUi((s) => s.setLocked);
  const introOn = useSettings((s) => s.introOn);
  const [intro, setIntro] = useState(introOn);
  const away = useRef(0);

  useEffect(() => {
    ensureManaged();
    void runDueTasks().then(() => syncTaskNotifications());
    void registerBackground();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void runDueTasks().then(() => syncTaskNotifications()); });
    const u1 = useChats.subscribe(scheduleSync);
    const u2 = useTasks.subscribe(scheduleSync);
    return () => { sub.remove(); u1(); u2(); };
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  useEffect(() => {
    hasPin().then((h) => h && setLocked(true));
    const sub = AppState.addEventListener('change', async (st) => {
      if (st === 'background') away.current = Date.now();
      else if (st === 'active' && away.current && Date.now() - away.current > LOCK_AFTER_MS && (await hasPin())) setLocked(true);
    });
    return () => sub.remove();
  }, [setLocked]);

  return (
    <RTL style={{ backgroundColor: c.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_left', contentStyle: { backgroundColor: c.bg } }} />
      <Sidebar />
      <Toast />
      <GlobalDialogs />
      {locked ? <LockScreen /> : null}
      {intro && !locked ? <Intro onDone={() => setIntro(false)} /> : null}
    </RTL>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold, Amiri_400Regular,
  });
  const hydrated = useHydrated();
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
