/** الحساب المُدار (خادم QUARK): نقطة اتصال، تسجيل الدخول بـ Google، الخطط، الأكواد، الإحالة. */
import { fetch as xfetch } from 'expo/fetch';
import { useSettings } from '../store/settings';
import { toast } from '../store/data';
import { uid } from '../lib/util';

export const MANAGED_URL = 'https://quark.wisp.uno/qk';
export const MANAGED_MODEL = 'quark';
export const GOOGLE_CLIENT_ID = '549746092483-2j03teo8tjkrp4i3ucshg2edjbe2bhqo.apps.googleusercontent.com';

export const PLAN_IDS = ['free', 'plus', 'pro', 'max'] as const;
export const PLAN_LABEL: Record<string, string> = { free: 'مجاني', plus: 'بلس', pro: 'برو', max: 'برو ماكس' };
export let PLAN_LIMITS: Record<string, { limit: number; cloudMb: number }> = {
  free: { limit: 25, cloudMb: 5 }, plus: { limit: 50, cloudMb: 20 }, pro: { limit: 100, cloudMb: 50 }, max: { limit: 250, cloudMb: 200 },
};

export interface MeInfo {
  pro?: boolean; plan?: string; exp?: number | null;
  left?: number; limit?: number;
  referral?: { code?: string; invited?: number; rewards?: number };
}

/** معرّف الجهاز (مفتاح الضيف) */
let deviceId = '';
export const getDeviceId = () => deviceId || (deviceId = 'q' + uid(34));
export const setDeviceId = (v: string) => { if (v && v.length >= 16) deviceId = v; };

export const managedKey = () => {
  const m = useSettings.getState().managed;
  return m.token || getDeviceId();
};
export const signedIn = () => !!useSettings.getState().managed.token;

/** يضمن وجود نقطة اتصال QUARK ويحدّث مفتاحها */
export function ensureManaged() {
  const st = useSettings.getState();
  const key = managedKey();
  let e = st.endpoints.find((x) => x.id === 'managed');
  if (!e) {
    useSettings.setState((s) => ({
      endpoints: [{ id: 'managed', preset: 'custom', label: 'QUARK', url: MANAGED_URL, key, proto: 'openai', kind: 'api', enabled: true, models: [{ id: MANAGED_MODEL, on: true }] }, ...s.endpoints],
      sel: s.sel ?? { ep: 'managed', model: MANAGED_MODEL },
    }));
  } else if (e.key !== key || e.url !== MANAGED_URL) st.updateEndpoint('managed', { key, url: MANAGED_URL, enabled: true });
}

async function api<T = any>(method: string, path: string, body?: unknown, auth = true): Promise<{ s: number; j: T } | null> {
  try {
    const r = await xfetch(MANAGED_URL + path, {
      method,
      headers: { ...(auth ? { authorization: 'Bearer ' + managedKey() } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    let j: any = {};
    try { j = JSON.parse(txt); } catch {}
    return { s: r.status, j };
  } catch {
    return null;
  }
}
const errMsg = (r: { j: any } | null, fb: string) => (r ? r.j?.error?.message || fb : 'تعذّر الاتصال بالخدمة. تحقق من الإنترنت.');

export async function loadPlans(): Promise<boolean> {
  const r = await api<{ plans?: { id: string; limit: number; cloudMb: number }[] }>('GET', '/plans', undefined, false);
  if (!r || r.s !== 200) return false;
  for (const p of r.j.plans || []) if (PLAN_LIMITS[p.id]) PLAN_LIMITS[p.id] = { limit: p.limit, cloudMb: p.cloudMb };
  return true;
}

export async function fetchMe(): Promise<MeInfo | null> {
  if (!signedIn()) return null;
  const r = await api<MeInfo>('GET', '/me');
  if (!r || r.s !== 200) return null;
  useSettings.getState().patch({ managed: { ...useSettings.getState().managed, plan: r.j.pro ? r.j.plan || 'pro' : 'free' } });
  return r.j;
}

export async function usageLeft(): Promise<{ left: number; limit: number } | null> {
  const r = await api<any>('GET', '/usage');
  return r && r.s === 200 ? r.j : null;
}

/** تسجيل الدخول: idToken من Google → توكن الخادم */
export async function exchangeIdToken(idToken: string): Promise<void> {
  const r = await api<any>('POST', '/auth', { idToken }, false);
  if (!r || r.s !== 200 || !r.j.token) throw new Error(errMsg(r, 'تعذّر تسجيل الدخول.'));
  useSettings.getState().patch({ managed: { token: r.j.token, email: r.j.email || '', name: r.j.name || '', plan: 'free', ep: 'managed' } });
  ensureManaged();
  void fetchMe();
}

/** Google native sign-in: تحتاج بناء تطوير (Dev Build)؛ لا تعمل في Expo Go. */
export async function googleSignIn(): Promise<void> {
  let mod: any;
  try {
    // تحميل كسول كي لا ينهار التطبيق في Expo Go
    mod = require('@react-native-google-signin/google-signin');
  } catch {
    throw new Error('تسجيل الدخول بـ Google يحتاج نسخة مبنيّة (Development Build) وليس Expo Go. راجع README.');
  }
  const { GoogleSignin } = mod;
  GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  const idToken = res?.data?.idToken ?? res?.idToken;
  if (!idToken) throw new Error('لم يصل رمز الهوية من Google.');
  await exchangeIdToken(idToken);
}

export function signOut() {
  useSettings.getState().patch({ managed: { token: '', email: '', name: '', plan: 'free', ep: '' }, sync: { ...useSettings.getState().sync, on: false } });
  ensureManaged();
  try { require('@react-native-google-signin/google-signin').GoogleSignin.signOut(); } catch {}
}

export const normCode = (v: string) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const validCodeLen = (c: string) => c.length >= 4 && c.length <= 16;

export async function redeemCode(raw: string): Promise<{ ok: boolean; msg: string }> {
  const c = normCode(raw);
  if (!validCodeLen(c)) return { ok: false, msg: 'الكود غير صحيح. تحقق منه وحاول مجددًا.' };
  if (!signedIn()) return { ok: false, msg: 'سجّل الدخول بحساب Google أولًا لتفعيل الكود.' };
  const r = await api<any>('POST', '/redeem', { code: c });
  if (!r || r.s !== 200) return { ok: false, msg: errMsg(r, 'تعذّر تفعيل الكود.') };
  await fetchMe();
  toast('تم تفعيل الكود');
  return { ok: true, msg: r.j.label || 'تم التفعيل' };
}

/* ---- المزامنة ---- */
export const syncInfo = () => api<{ used: number; quota: number; updated: number }>('GET', '/sync');
export const syncGet = () => api<any>('GET', '/sync/data');
export async function syncPutRaw(body: string): Promise<{ s: number; j: any } | null> {
  try {
    const r = await xfetch(MANAGED_URL + '/sync', { method: 'PUT', headers: { authorization: 'Bearer ' + managedKey(), 'content-type': 'application/json' }, body });
    let j: any = {};
    try { j = JSON.parse(await r.text()); } catch {}
    return { s: r.status, j };
  } catch {
    return null;
  }
}
