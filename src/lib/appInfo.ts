import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** داخل Expo Go تكون الحزمة الأصلية هي Expo Go نفسه، فنقرأ إصدار مشروعنا من الإعدادات */
const inExpoGo = () => (Constants as any).executionEnvironment === 'storeClient';

/** إصدار التطبيق الفعلي المثبّت (من الحزمة الأصلية)، وعند عدم توفره من إعدادات المشروع */
export function appVersion(): { version: string; build: string } {
  let version = '', build = '';
  if (!inExpoGo()) {
    try {
      const A = require('expo-application');
      version = A.nativeApplicationVersion || '';
      build = A.nativeBuildVersion || '';
    } catch {}
  }
  if (!version) version = Constants.expoConfig?.version ?? '';
  if (!build) build = String((Constants.expoConfig as any)?.android?.versionCode ?? '');
  return { version: version || '—', build };
}
export const versionLabel = () => { const v = appVersion(); return v.build ? `${v.version} (${v.build})` : v.version; };

/** مثل: Android 15; 23049PCD8G */
export function osLabel(): string {
  let model = '', osv = '';
  try { const D = require('expo-device'); model = D.modelName || ''; osv = D.osVersion || ''; } catch {}
  const name = Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : String(Platform.OS);
  return `${name} ${osv || Platform.Version}${model ? '; ' + model : ''}`;
}
