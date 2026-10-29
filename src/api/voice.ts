/** تشغيل الصوت: تسجيل الميكروفون وتحويله إلى نص، وقراءة النص بصوت API (مع رجوع لصوت الجهاز بلا مفتاح). */
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { create } from 'zustand';
import { toast } from '../store/data';
import { voiceSnapshot } from '../store/voice';
import {
  audioMime, b64ToBytes, buildSttRequest, buildTestRequest, buildTtsRequest, bytesToB64, geminiAudioB64, geminiSttBody, httpErrText, parseSttResponse,
  pcmToWav, speakClean, voiceConf, type Preset, type VConf, type VoiceCfg,
} from './voiceCore';
import { logErr } from '../store/logs';

/* expo-audio وحدة أصلية: نحمّلها عند الحاجة فقط كي لا تتعطل الشاشات الأخرى إن غابت */
let AUD: any;
function audio(): any {
  if (AUD === undefined) {
    try { AUD = require('expo-audio'); } catch { AUD = null; }
  }
  return AUD;
}

const netMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /network request failed|failed to fetch/i.test(m) ? 'تعذّر الاتصال (تحقق من الإنترنت أو من عنوان API)' : m;
};

/* ======================= تحويل الصوت إلى نص ======================= */
export async function transcribeUri(uri: string, signal?: AbortSignal): Promise<string> {
  const snap = voiceSnapshot();
  const c = voiceConf(snap, 'stt');
  if (!c.ready) throw new Error('أضف مفتاح صوت يدعم التعرّف على الكلام من الإعدادات ← الصوت.');
  const mime = audioMime(uri);
  const req = buildSttRequest(c, snap.stt.lang, mime);
  let body: any;
  if (req.kind === 'form') {
    const fd = new FormData();
    Object.entries(req.fields || {}).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', { uri, name: req.fileName, type: mime } as any);
    body = fd; // لا نضبط Content-Type: يضيفه RN مع الحدّ
  } else if (req.kind === 'raw') {
    body = await (await fetch(uri)).blob();
  } else {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    body = JSON.stringify(geminiSttBody(req, b64, mime));
  }
  let r: Response;
  try { r = await fetch(req.url, { method: 'POST', headers: req.headers, body, signal }); } catch (e) { if ((e as any)?.name === 'AbortError') throw e; throw new Error(netMsg(e)); }
  if (!r.ok) throw new Error(httpErrText(r.status, await r.text().catch(() => '')));
  return parseSttResponse(c.p, await r.json());
}

/* ======================= الميكروفون ======================= */
type MicState = 'idle' | 'rec' | 'busy';
export const useMic = create<{ state: MicState; set: (s: MicState) => void }>()((set) => ({ state: 'idle', set: (state) => set({ state }) }));
let recorder: any = null;
let micCtl: AbortController | null = null;

async function resetMode() {
  try { await audio()?.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
}

export async function micStart(): Promise<boolean> {
  const A = audio();
  if (!A) { toast('وحدة الصوت غير متوفرة في هذه النسخة.'); return false; }
  if (!voiceConf(voiceSnapshot(), 'stt').ready) { toast('أضف مفتاح صوت للتعرّف على الكلام من الإعدادات ← الصوت.'); return false; }
  try {
    const perm = await A.AudioModule.requestRecordingPermissionsAsync();
    if (!perm?.granted) { toast('اسمح للتطبيق بالوصول إلى الميكروفون'); return false; }
    stopSpeaking();
    await A.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    recorder = new A.AudioModule.AudioRecorder(A.RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();
    useMic.getState().set('rec');
    return true;
  } catch (e) {
    recorder = null;
    logErr('voice', 'mic: ' + (e instanceof Error ? e.message : String(e)));
    await resetMode();
    toast('تعذّر بدء التسجيل: ' + (e instanceof Error ? e.message : String(e)));
    return false;
  }
}

/** يوقف التسجيل ويعيد مسار الملف (أو null إن كان قصيرًا جدًا) */
export async function micStop(): Promise<string | null> {
  const r = recorder;
  recorder = null;
  if (!r) return null;
  try { await r.stop(); } catch {}
  const uri: string | null = r.uri || null;
  await resetMode();
  if (!uri) return null;
  try {
    const info: any = await FileSystem.getInfoAsync(uri);
    if (!info.exists || (info.size ?? 0) < 1200) return null;
  } catch {}
  return uri;
}

export async function micCancel() {
  micCtl?.abort();
  micCtl = null;
  const uri = await micStop().catch(() => null);
  if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  useMic.getState().set('idle');
}

/** نقرة واحدة: يبدأ التسجيل، ونقرة ثانية توقفه وتحوّله إلى نص يُمرَّر إلى onText */
export async function dictateToggle(onText: (t: string) => void) {
  const st = useMic.getState().state;
  if (st === 'busy') return;
  if (st === 'idle') { await micStart(); return; }
  useMic.getState().set('busy');
  const ctl = (micCtl = new AbortController());
  try {
    const uri = await micStop();
    if (!uri) { toast('لم يُسمع أي صوت'); return; }
    const t = await transcribeUri(uri, ctl.signal);
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    if (!t) toast('لم يُفهم أي كلام');
    else if (micCtl === ctl) onText(t);
  } catch (e) {
    if ((e as any)?.name !== 'AbortError') { logErr('voice', 'stt: ' + netMsg(e)); toast('فشل تحويل الصوت: ' + netMsg(e)); }
  } finally {
    if (micCtl === ctl) micCtl = null;
    useMic.getState().set('idle');
  }
}

/* ======================= القراءة الصوتية ======================= */
export const useSpeaker = create<{ key: string | null; loading: boolean; set: (p: { key: string | null; loading?: boolean }) => void }>()((set) => ({
  key: null, loading: false, set: (p) => set({ key: p.key, loading: !!p.loading }),
}));

let player: any = null;
let speakCtl: AbortController | null = null;
let playingFile: string | null = null;
const cache = new Map<string, string>(); // مفتاح التوليد → ملف (للمعاينة فقط)

function dropPlayer() {
  if (player) {
    try { player.pause?.(); } catch {}
    try { (player.release ?? player.remove)?.call(player); } catch {}
    player = null;
  }
  if (playingFile && ![...cache.values()].includes(playingFile)) FileSystem.deleteAsync(playingFile, { idempotent: true }).catch(() => {});
  playingFile = null;
}

export function stopSpeaking() {
  speakCtl?.abort();
  speakCtl = null;
  try { Speech.stop(); } catch {}
  dropPlayer();
  useSpeaker.getState().set({ key: null });
}

/** يبني إعداد مزوّد محدد بلا تغيير الاختيار المحفوظ (للمعاينة في صفحة الأصوات) */
export function confFor(preset: Preset, over: { voice?: string; model?: string } = {}): { c: VConf; cfg: VoiceCfg } | null {
  const snap = voiceSnapshot();
  const conn = snap.conns.find((x) => x.id === snap.tts.conn && x.preset === preset && x.enabled) || snap.conns.find((x) => x.preset === preset && x.enabled);
  if (!conn) return null;
  const cfg: VoiceCfg = {
    ...snap,
    tts: { ...snap.tts, conn: conn.id, p: preset, cfg: { ...snap.tts.cfg, [preset]: { ...(snap.tts.cfg[preset] || {}), ...over } } },
  };
  return { c: voiceConf(cfg, 'tts'), cfg };
}

export async function synthToFile(c: VConf, text: string, rate: number, signal?: AbortSignal): Promise<string> {
  const req = buildTtsRequest(c, text, rate);
  let r: Response;
  try { r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal }); } catch (e) { if ((e as any)?.name === 'AbortError') throw e; throw new Error(netMsg(e)); }
  if (!r.ok) throw new Error(httpErrText(r.status, await r.text().catch(() => '')));
  const bytes = req.kind === 'gemini' ? pcmToWav(b64ToBytes(geminiAudioB64(await r.json())), 24000) : new Uint8Array(await r.arrayBuffer());
  const uri = (FileSystem.cacheDirectory || '') + `tts-${Date.now()}.${req.ext}`;
  await FileSystem.writeAsStringAsync(uri, bytesToB64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

async function playFile(uri: string, key: string, rate: number, c: VConf, signal: AbortSignal): Promise<void> {
  const A = audio();
  if (!A) throw new Error('وحدة الصوت غير متوفرة في هذه النسخة.');
  await A.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  dropPlayer();
  playingFile = uri;
  const p = A.createAudioPlayer({ uri });
  player = p;
  useSpeaker.getState().set({ key, loading: false });
  // OpenAI والمخصص يطبّقان السرعة على الخادم؛ البقية عند التشغيل
  if (c.p !== 'openai' && c.p !== 'custom') { try { p.setPlaybackRate?.(Math.min(2, Math.max(0.5, rate))); } catch {} }
  await new Promise<void>((resolve) => {
    const sub = p.addListener?.('playbackStatusUpdate', (st: any) => { if (st?.didJustFinish) { sub?.remove?.(); resolve(); } });
    signal.addEventListener('abort', () => resolve());
    p.play();
  });
}

/** يقرأ نصًا. بلا مفتاح قراءة يستخدم صوت الجهاز. نقرة ثانية على نفس المفتاح توقف القراءة. */
export async function speak(text: string, key: string): Promise<void> {
  if (useSpeaker.getState().key === key) return stopSpeaking();
  stopSpeaking();
  const snap = voiceSnapshot();
  const c = voiceConf(snap, 'tts');
  const clean = speakClean(text);
  if (!clean) return;
  if (!c.ready) {
    useSpeaker.getState().set({ key });
    Speech.speak(clean, {
      language: /[؀-ۿ]/.test(clean) ? 'ar' : undefined, rate: Math.min(2, Math.max(0.5, snap.tts.rate || 1)),
      onDone: () => useSpeaker.getState().key === key && useSpeaker.getState().set({ key: null }),
      onStopped: () => useSpeaker.getState().key === key && useSpeaker.getState().set({ key: null }),
      onError: () => useSpeaker.getState().key === key && useSpeaker.getState().set({ key: null }),
    });
    return;
  }
  const ctl = (speakCtl = new AbortController());
  useSpeaker.getState().set({ key, loading: true });
  try {
    const uri = await synthToFile(c, clean, snap.tts.rate || 1, ctl.signal);
    if (speakCtl !== ctl) { FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); return; }
    await playFile(uri, key, snap.tts.rate || 1, c, ctl.signal);
  } catch (e) {
    if ((e as any)?.name !== 'AbortError') { logErr('voice', 'tts: ' + netMsg(e)); toast('تعذّرت القراءة: ' + netMsg(e)); }
  } finally {
    if (speakCtl === ctl) { speakCtl = null; dropPlayer(); if (useSpeaker.getState().key === key) useSpeaker.getState().set({ key: null }); }
  }
}

/** معاينة صوت محدد (تُخزَّن مؤقتًا). تعيد زمن التوليد بالمللي ثانية (0 = من الذاكرة). */
export async function preview(preset: Preset, voiceId: string, model: string | undefined, text: string, key: string): Promise<number | null> {
  if (useSpeaker.getState().key === key) { stopSpeaking(); return null; }
  stopSpeaking();
  const f = confFor(preset, { voice: voiceId, ...(model ? { model } : {}) });
  if (!f || !f.c.ready) { toast('أضف مفتاح API لهذا المزوّد أولًا من «مفاتيح الصوت».'); return null; }
  const rate = voiceSnapshot().tts.rate || 1;
  const ctl = (speakCtl = new AbortController());
  useSpeaker.getState().set({ key, loading: true });
  const ck = [preset, voiceId, f.c.model, rate, text].join('\u0001');
  let ms: number | null = null;
  try {
    let uri = cache.get(ck);
    if (uri) ms = 0;
    else {
      const t0 = Date.now();
      uri = await synthToFile(f.c, text, rate, ctl.signal);
      ms = Date.now() - t0;
      cache.set(ck, uri);
      if (cache.size > 16) { const [k0, u0] = cache.entries().next().value as [string, string]; cache.delete(k0); FileSystem.deleteAsync(u0, { idempotent: true }).catch(() => {}); }
    }
    if (speakCtl !== ctl) return ms;
    await playFile(uri, key, rate, f.c, ctl.signal);
  } catch (e) {
    if ((e as any)?.name !== 'AbortError') toast('تعذّرت القراءة: ' + netMsg(e));
  } finally {
    if (speakCtl === ctl) { speakCtl = null; dropPlayer(); if (useSpeaker.getState().key === key) useSpeaker.getState().set({ key: null }); }
  }
  return ms;
}

/** اختبار مفتاح (يرمي خطأً مفهومًا عند الفشل) */
export async function testConn(preset: Preset, url: string, key: string): Promise<void> {
  const req = buildTestRequest(preset, url, key);
  let r: Response;
  try { r = await fetch(req.url, { headers: req.headers }); } catch (e) { throw new Error(netMsg(e)); }
  if (!r.ok) throw new Error(httpErrText(r.status, await r.text().catch(() => '')));
}
