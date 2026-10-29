/** الصوت: مزوّدو القراءة (TTS) والتعرّف على الكلام (STT) — منطق صرف قابل للاختبار.
 *  نفس المزوّدين في تطبيق الويب: OpenAI · Groq · ElevenLabs · Deepgram · Gemini · مخصص (متوافق مع OpenAI). */

export type Preset = 'openai' | 'groq' | 'elevenlabs' | 'deepgram' | 'gemini' | 'custom';
export interface VoiceConn { id: string; preset: Preset; url: string; key: string; enabled: boolean }

export const VOICE_PRESETS: Record<Preset, { label: string; url: string; fixed?: boolean; custom?: boolean }> = {
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1' },
  groq: { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  elevenlabs: { label: 'ElevenLabs', url: 'https://api.elevenlabs.io', fixed: true },
  deepgram: { label: 'Deepgram', url: 'https://api.deepgram.com', fixed: true },
  gemini: { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com', fixed: true },
  custom: { label: 'مخصص (متوافق مع OpenAI)', url: '', custom: true },
};

interface ProvBase { label: string; url?: string; model: string; models: string[]; help: string; custom?: boolean; keyOptional?: boolean }
export interface SttProv extends ProvBase {}
export type VoiceRow = [id: string, name: string, desc: string];
export interface TtsProv extends ProvBase { voice?: string; voices: VoiceRow[]; voiceIsModel?: boolean; voiceHint?: string }

export const STT_PROVIDERS: Partial<Record<Preset, SttProv>> = {
  openai: { label: 'OpenAI Whisper', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini-transcribe', models: ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'], help: 'مفتاح من platform.openai.com/api-keys' },
  groq: { label: 'Groq Whisper', url: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo', models: ['whisper-large-v3-turbo', 'whisper-large-v3'], help: 'سريع جدًا. مفتاح من console.groq.com/keys' },
  deepgram: { label: 'Deepgram', model: 'nova-3', models: ['nova-3', 'nova-2'], help: 'مفتاح من console.deepgram.com' },
  elevenlabs: { label: 'ElevenLabs Scribe', model: 'scribe_v1', models: ['scribe_v1'], help: 'مفتاح من elevenlabs.io/app/settings/api-keys' },
  gemini: { label: 'Google Gemini', model: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'], help: 'مفتاح من aistudio.google.com/apikey' },
  custom: { label: 'مخصص (متوافق مع OpenAI)', url: '', model: 'whisper-1', models: [], custom: true, keyOptional: true, help: 'أي خدمة تدعم /audio/transcriptions مثل خادم Whisper محلي. اكتب العنوان الأساسي مع /v1.' },
};

export const TTS_PROVIDERS: Partial<Record<Preset, TtsProv>> = {
  openai: { label: 'OpenAI TTS', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts', models: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'], voice: 'alloy',
    voices: [['alloy', 'Alloy', 'محايد ومتوازن'], ['ash', 'Ash', 'واثق وحازم'], ['ballad', 'Ballad', 'معبّر وناعم'], ['coral', 'Coral', 'ودود ودافئ'], ['echo', 'Echo', 'هادئ وواضح'], ['fable', 'Fable', 'حكّاء ومعبّر'], ['nova', 'Nova', 'نشيط ومشرق'], ['onyx', 'Onyx', 'عميق وجاد'], ['sage', 'Sage', 'متزن وحكيم'], ['shimmer', 'Shimmer', 'خفيف وناعم']],
    help: 'مفتاح من platform.openai.com/api-keys. يدعم العربية بجودة جيدة.' },
  elevenlabs: { label: 'ElevenLabs', model: 'eleven_multilingual_v2', models: ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'], voice: '21m00Tcm4TlvDq8ikWAM',
    voices: [['21m00Tcm4TlvDq8ikWAM', 'Rachel', 'هادئة وواضحة'], ['pNInz6obpgDQGcFmaJgB', 'Adam', 'عميق وقوي'], ['ErXwobaYiN019PkySvjV', 'Antoni', 'ودود ومتزن'], ['EXAVITQu4vr4xnSDxMgb', 'Bella', 'ناعمة ودافئة'], ['TxGEqnHWrfWFTfGW9XjX', 'Josh', 'شاب وحيوي'], ['AZnzlk1XvdvUeBnXmlld', 'Domi', 'واثقة وحازمة'], ['MF3mGyEYCl7XYWbV9V6O', 'Elli', 'شابة ومشرقة']],
    voiceHint: 'معرّف الصوت (Voice ID) من مكتبة ElevenLabs', help: 'مفتاح من elevenlabs.io. تجد معرّفات الأصوات في Voice Library.' },
  gemini: { label: 'Google Gemini TTS', model: 'gemini-2.5-flash-preview-tts', models: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'], voice: 'Kore',
    voices: [['Kore', 'Kore', 'حازم وثابت'], ['Puck', 'Puck', 'مرح ونشيط'], ['Charon', 'Charon', 'إخباري وهادئ'], ['Fenrir', 'Fenrir', 'متحمّس'], ['Aoede', 'Aoede', 'خفيف وعذب'], ['Leda', 'Leda', 'شبابي'], ['Zephyr', 'Zephyr', 'مشرق'], ['Orus', 'Orus', 'قوي وواضح']],
    help: 'مفتاح من aistudio.google.com/apikey' },
  deepgram: { label: 'Deepgram Aura', model: 'aura-2-thalia-en', models: ['aura-2-thalia-en', 'aura-2-andromeda-en', 'aura-2-apollo-en', 'aura-asteria-en'], voiceIsModel: true,
    voices: [['aura-2-thalia-en', 'Thalia', 'أنثوي واضح'], ['aura-2-andromeda-en', 'Andromeda', 'أنثوي ودود'], ['aura-2-apollo-en', 'Apollo', 'ذكوري واثق'], ['aura-asteria-en', 'Asteria', 'أنثوي دافئ']],
    help: 'أصوات إنجليزية في الغالب. مفتاح من console.deepgram.com' },
  custom: { label: 'مخصص (متوافق مع OpenAI)', url: '', model: 'tts-1', models: [], voice: 'alloy', voices: [], custom: true, keyOptional: true, help: 'أي خدمة تدعم /audio/speech. اكتب العنوان الأساسي مع /v1.' },
};

export const STT_LANGS: [string, string][] = [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['tr', 'Türkçe'], ['fa', 'فارسی'], ['ur', 'اردو'], ['auto', 'تلقائي']];

export const SAMPLE_AR = 'مرحبًا! هذا اختبار للصوت من تطبيق كوارك. Hello, this is a voice test.';
export const SAMPLE_EN = 'Hello! This is a voice test from Quark AI.';

/* ---------- الإعداد المحفوظ ---------- */
export interface CustomVoice { cid: string; name: string; desc: string; voiceId: string; model: string; color: string }
interface ProvCfg { model?: string; voice?: string; customVoices?: CustomVoice[] }
export interface VoiceCfg {
  stt: { p: Preset; lang: string; conn: string; cfg: Record<string, ProvCfg> };
  tts: { p: Preset; rate: number; conn: string; cfg: Record<string, ProvCfg> };
  conns: VoiceConn[];
  /** أصوات مفضلة: "provider|voiceId" */
  favs: string[];
}

export const defaultVoiceCfg = (): VoiceCfg => ({
  stt: { p: 'groq', lang: 'ar', conn: '', cfg: {} },
  tts: { p: 'openai', rate: 1, conn: '', cfg: {} },
  conns: [],
  favs: [],
});

const provs = (k: 'stt' | 'tts') => (k === 'stt' ? STT_PROVIDERS : TTS_PROVIDERS) as Partial<Record<Preset, ProvBase>>;

export function normVoiceCfg(raw: any): VoiceCfg {
  const d = defaultVoiceCfg();
  const s = raw && typeof raw === 'object' ? raw : {};
  const out: VoiceCfg = {
    stt: { ...d.stt, ...(s.stt || {}), cfg: { ...(s.stt?.cfg || {}) } },
    tts: { ...d.tts, ...(s.tts || {}), cfg: { ...(s.tts?.cfg || {}) } },
    conns: Array.isArray(s.conns) ? s.conns.filter((c: any) => c && c.id && VOICE_PRESETS[c.preset as Preset]) : [],
    favs: Array.isArray(s.favs) ? s.favs.map(String) : [],
  };
  if (!STT_PROVIDERS[out.stt.p]) out.stt.p = d.stt.p;
  if (!TTS_PROVIDERS[out.tts.p]) out.tts.p = d.tts.p;
  return autoConn(out);
}

export const connsFor = (cfg: VoiceCfg, kind: 'stt' | 'tts') => cfg.conns.filter((c) => c.enabled && provs(kind)[c.preset]);
export const connCaps = (c: VoiceConn) => ({ tts: !!TTS_PROVIDERS[c.preset], stt: !!STT_PROVIDERS[c.preset] });
export function connHost(c: VoiceConn): string {
  try { return new URL(c.url || VOICE_PRESETS[c.preset].url).host; } catch { return VOICE_PRESETS[c.preset].label; }
}
export const connLabel = (c: VoiceConn) => (c.preset === 'custom' ? connHost(c) : VOICE_PRESETS[c.preset].label) + (c.key ? ' · ••••' + c.key.slice(-4) : '');

/** يختار اتصالًا تلقائيًا لكل قسم لا يملك اتصالًا صالحًا */
export function autoConn(cfg: VoiceCfg): VoiceCfg {
  for (const k of ['stt', 'tts'] as const) {
    const sec = cfg[k];
    const list = connsFor(cfg, k);
    const cur = list.find((c) => c.id === sec.conn);
    if (cur) sec.p = cur.preset;
    else if (list[0]) { sec.conn = list[0].id; sec.p = list[0].preset; }
    else sec.conn = '';
  }
  return cfg;
}

export interface VConf { p: Preset; def: ProvBase & Partial<TtsProv>; key: string; url: string; model: string; voice: string; ready: boolean }

/** إعداد المزوّد الحالي للقسم مع القيم الافتراضية */
export function voiceConf(cfg: VoiceCfg, kind: 'stt' | 'tts'): VConf {
  const sec = cfg[kind];
  const conn = cfg.conns.find((x) => x.id === sec.conn && x.enabled && provs(kind)[x.preset]);
  const p = (conn ? conn.preset : sec.p) as Preset;
  const def = (provs(kind)[p] || provs(kind).openai!) as VConf['def'];
  const c = sec.cfg[p] || {};
  const out: VConf = {
    p, def, key: (conn?.key || '').trim(),
    url: ((conn?.url || def.url || '') as string).trim().replace(/\/+$/, ''),
    model: (c.model || def.model || '').trim(), voice: (c.voice || (def as TtsProv).voice || '').trim(),
    ready: !!conn && (!!conn.key.trim() || !!def.keyOptional),
  };
  if (kind === 'tts' && !(def as TtsProv).voiceIsModel) {
    const cv = (cfg.tts.cfg[p]?.customVoices || []).find((v) => v.voiceId === out.voice);
    if (cv?.model) out.model = cv.model.trim(); // نموذج خاص بهذا الصوت
  }
  return out;
}

export interface VoiceItem { id: string; name: string; desc: string; custom?: boolean; cid?: string; model?: string; color?: string }
export const ttsVoiceList = (cfg: VoiceCfg, p: Preset): VoiceItem[] =>
  ((TTS_PROVIDERS[p]?.voices || []) as VoiceRow[]).map((v) => ({ id: v[0], name: v[1], desc: v[2] }))
    .concat((cfg.tts.cfg[p]?.customVoices || []).map((v) => ({ id: v.voiceId, name: v.name, desc: v.desc || 'صوت مخصص', custom: true, cid: v.cid, model: v.model, color: v.color })));

/* ---------- أدوات ---------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToB64(b: Uint8Array): string {
  let o = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return o;
}
export function b64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]), b = B64.indexOf(clean[i + 1]), c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1, d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[j++] = (a << 2) | (b >> 4);
    if (c >= 0) out[j++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[j++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, j);
}
/** PCM 16-bit أحادي → WAV */
export function pcmToWav(pcm: Uint8Array, rate = 24000): Uint8Array {
  const n = pcm.length, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n, true); new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}
/** تنظيف النص قبل القراءة: بدون كتل الكود والرموز */
export const speakClean = (t: string) =>
  String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*#>|_`~]/g, ' ').replace(/\s+/g, ' ').trim();

export function httpErrText(status: number, body: string): string {
  let m = body;
  try { const j = JSON.parse(body); m = j.error?.message || j.message || j.detail?.message || j.err_msg || (typeof j.detail === 'string' ? j.detail : '') || body; } catch {}
  return `${status} ${String(m).slice(0, 160)}`.trim();
}

/* ---------- بناء الطلبات ---------- */
export interface SttReq {
  kind: 'form' | 'raw' | 'gemini';
  url: string;
  headers: Record<string, string>;
  /** حقول نموذج multipart (kind=form) */
  fields?: Record<string, string>;
  fileName?: string;
  /** جسم JSON جاهز عدا الصوت (kind=gemini) */
  json?: any;
}
export const audioMime = (uri: string) => (/\.wav$/i.test(uri) ? 'audio/wav' : /\.mp3$/i.test(uri) ? 'audio/mpeg' : /\.(ogg|oga)$/i.test(uri) ? 'audio/ogg' : /\.webm$/i.test(uri) ? 'audio/webm' : 'audio/mp4');
const extOf = (mime: string) => (/wav/.test(mime) ? 'wav' : /mpeg|mp3/.test(mime) ? 'mp3' : /ogg/.test(mime) ? 'ogg' : /webm/.test(mime) ? 'webm' : 'm4a');

export function buildSttRequest(c: VConf, lang: string, mime: string): SttReq {
  const code = lang === 'auto' ? '' : lang;
  const name = 'speech.' + extOf(mime);
  if (c.p === 'openai' || c.p === 'groq' || c.p === 'custom') {
    if (!c.url) throw new Error('أدخل عنوان API');
    const fields: Record<string, string> = { model: c.model };
    if (code) fields.language = code;
    return { kind: 'form', url: c.url + '/audio/transcriptions', headers: c.key ? { Authorization: 'Bearer ' + c.key } : {}, fields, fileName: name };
  }
  if (c.p === 'deepgram') {
    const q = new URLSearchParams({ model: c.model, smart_format: 'true' });
    if (code) q.set('language', code); else q.set('detect_language', 'true');
    return { kind: 'raw', url: 'https://api.deepgram.com/v1/listen?' + q, headers: { Authorization: 'Token ' + c.key, 'Content-Type': mime } };
  }
  if (c.p === 'elevenlabs') {
    const fields: Record<string, string> = { model_id: c.model };
    if (code) fields.language_code = code;
    return { kind: 'form', url: 'https://api.elevenlabs.io/v1/speech-to-text', headers: { 'xi-api-key': c.key }, fields, fileName: name };
  }
  if (c.p === 'gemini') {
    return { kind: 'gemini', url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
      json: { prompt: 'فرّغ هذا التسجيل الصوتي حرفيًا بلغته الأصلية دون أي إضافة أو شرح، وأعد النص فقط. إن لم يكن فيه كلام فأعد نصًا فارغًا.' } };
  }
  throw new Error('مزوّد غير مدعوم');
}
export function geminiSttBody(req: SttReq, b64: string, mime: string) {
  return { contents: [{ parts: [{ text: req.json.prompt }, { inline_data: { mime_type: mime.split(';')[0], data: b64 } }] }] };
}
export function parseSttResponse(p: Preset, j: any): string {
  if (p === 'deepgram') return String(j?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
  if (p === 'gemini') return ((j?.candidates?.[0]?.content?.parts || []) as any[]).map((x) => x.text || '').join('').trim();
  return String(j?.text || '').trim();
}

export interface TtsReq { kind: 'audio' | 'gemini'; url: string; headers: Record<string, string>; body: string; ext: 'mp3' | 'wav' }
export function buildTtsRequest(c: VConf, rawText: string, rate = 1): TtsReq {
  const text = speakClean(rawText).slice(0, 4000);
  if (!text) throw new Error('لا يوجد نص للقراءة');
  if (c.p === 'openai' || c.p === 'custom') {
    if (!c.url) throw new Error('أدخل عنوان API');
    return { kind: 'audio', ext: 'mp3', url: c.url + '/audio/speech', headers: { 'Content-Type': 'application/json', ...(c.key ? { Authorization: 'Bearer ' + c.key } : {}) },
      body: JSON.stringify({ model: c.model, input: text, voice: c.voice || 'alloy', response_format: 'mp3', speed: Math.min(4, Math.max(0.25, rate || 1)) }) };
  }
  if (c.p === 'elevenlabs')
    return { kind: 'audio', ext: 'mp3', url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.voice)}?output_format=mp3_44100_128`, headers: { 'Content-Type': 'application/json', 'xi-api-key': c.key, Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: c.model }) };
  if (c.p === 'deepgram')
    return { kind: 'audio', ext: 'mp3', url: 'https://api.deepgram.com/v1/speak?model=' + encodeURIComponent(c.model), headers: { Authorization: 'Token ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) };
  if (c.p === 'gemini')
    return { kind: 'gemini', ext: 'wav', url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: c.voice || 'Kore' } } } } }) };
  throw new Error('مزوّد غير مدعوم');
}
/** يستخرج PCM base64 من رد Gemini */
export function geminiAudioB64(j: any): string {
  const part = ((j?.candidates?.[0]?.content?.parts || []) as any[]).find((x) => x.inlineData || x.inline_data);
  const d = part && (part.inlineData || part.inline_data);
  if (!d?.data) throw new Error('لم يرجع المزوّد صوتًا');
  return d.data;
}

/** طلب اختبار المفتاح */
export function buildTestRequest(preset: Preset, url: string, key: string): { url: string; headers: Record<string, string> } {
  const base = (url || VOICE_PRESETS[preset].url).replace(/\/+$/, '');
  if (preset === 'openai' || preset === 'groq' || preset === 'custom') return { url: base + '/models', headers: key ? { Authorization: 'Bearer ' + key } : {} };
  if (preset === 'elevenlabs') return { url: 'https://api.elevenlabs.io/v1/models', headers: { 'xi-api-key': key } };
  if (preset === 'deepgram') return { url: 'https://api.deepgram.com/v1/projects', headers: { Authorization: 'Token ' + key } };
  return { url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', headers: { 'x-goog-api-key': key } };
}

export const hueOf = (p: string, id: string) => { let h = 0; const s = p + id; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
