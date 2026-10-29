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
import { AppState, I18nManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalDialogs } from '../src/components/chat/Extras';
import { runDueTasks, syncTaskNotifications } from '../src/api/engines';
import { registerBackground } from '../src/api/background';
import { Intro } from '../src/components/Intro';
import { LockScreen } from '../src/components/LockScreen';
import { Sidebar } from '../src/components/Sidebar';
import { RTL, Toast } from '../src/components/ui/kit';
import { useHydrated } from '../src/hooks/useHydrated';
import { hasPin } from '../src/lib/security';
import { useUi } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors, useMode } from '../src/theme';
import { log, logErr } from '../src/store/logs';

SplashScreen.preventAutoHideAsync().catch(() => {});

// أخطاء JavaScript غير المعالجة تُسجَّل في «سجل الأخطاء» ثم تُمرَّر للمعالج الأصلي
try {
  const EU = (globalThis as any).ErrorUtils;
  const prev = EU?.getGlobalHandler?.();
  EU?.setGlobalHandler?.((e: any, fatal?: boolean) => {
    logErr('js', (fatal ? '[fatal] ' : '') + (e?.message || String(e)) + (e?.stack ? '\n' + String(e.stack).split('\n').slice(0, 6).join('\n') : ''));
    prev?.(e, fatal);
  });
} catch {}
log('app', 'بدء التطبيق · ' + Platform.OS + ' ' + Platform.Version);

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
    void runDueTasks().then(() => syncTaskNotifications());
    void registerBackground();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void runDueTasks().then(() => syncTaskNotifications()); });
    return () => { sub.remove(); };
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
