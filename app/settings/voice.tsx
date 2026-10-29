import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { micCancel, micStart, micStop, speak, stopSpeaking, testConn, transcribeUri, useSpeaker } from '../../src/api/voice';
import {
  SAMPLE_AR, SAMPLE_EN, STT_LANGS, STT_PROVIDERS, TTS_PROVIDERS, VOICE_PRESETS, connCaps, connHost, connLabel, connsFor, ttsVoiceList, voiceConf, type Preset,
} from '../../src/api/voiceCore';
import { Button, Card, Chip, Empty, Field, Group, Icon, IconButton, Row, Screen, Sheet, T } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useVoice } from '../../src/store/voice';
import { useColors } from '../../src/theme';
import * as FileSystem from 'expo-file-system/legacy';

type Tab = 'keys' | 'tts' | 'stt';

export default function VoiceSettings() {
  const [tab, setTab] = useState<Tab>('tts');
  const c = useColors();
  return (
    <Screen title="الصوت">
      <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: 14, padding: 4 }}>
        {([['tts', 'القراءة', 'volume-2'], ['stt', 'التعرّف', 'mic'], ['keys', 'المفاتيح', 'key']] as const).map(([k, l, ic]) => (
          <Pressable key={k} onPress={() => { stopSpeaking(); setTab(k); }} style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 10, backgroundColor: tab === k ? c.surface3 : 'transparent' }}>
            <Icon name={ic} size={15} color={tab === k ? c.text : c.muted} />
            <T size={13} weight={tab === k ? 'bold' : 'medium'} color={tab === k ? 'text' : 'muted'}>{l}</T>
          </Pressable>
        ))}
      </View>
      {tab === 'keys' ? <Keys /> : tab === 'tts' ? <Tts goKeys={() => setTab('keys')} /> : <Stt goKeys={() => setTab('keys')} />}
    </Screen>
  );
}

/* ---------------- مفاتيح الصوت ---------------- */
function Keys() {
  const c = useColors();
  const { conns, addConn, updateConn, removeConn, stt, tts } = useVoice();
  const [preset, setPreset] = useState<Preset>('openai');
  const [url, setUrl] = useState(VOICE_PRESETS.openai.url);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const P = VOICE_PRESETS[preset];
  const help = (STT_PROVIDERS[preset] || TTS_PROVIDERS[preset])?.help || '';

  const pick = (p: Preset) => { setPreset(p); setUrl(VOICE_PRESETS[p].url); };
  const test = async () => {
    if (!key.trim() && !P.custom) return toast('أدخل مفتاح API');
    setBusy(true);
    try { await testConn(preset, url.trim(), key.trim()); toast('المفتاح يعمل ✓'); } catch (e) { toast('فشل الاختبار: ' + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  };
  const add = () => {
    if (!key.trim() && !P.custom) return toast('أدخل مفتاح API');
    if (P.custom && !/^https?:\/\//i.test(url.trim())) return toast('أدخل عنوان API يبدأ بـ http');
    addConn({ preset, url: P.fixed ? '' : url.trim().replace(/\/+$/, ''), key: key.trim() });
    setKey('');
    toast('أُضيف المفتاح');
  };

  return (
    <>
      <T size={13} color="text2">أضف مفتاح المزوّد مرة واحدة ثم اختره في تبويبي «القراءة» و«التعرّف». تُحفظ المفاتيح على جهازك وتُرسل مباشرة إلى المزوّد.</T>
      <Card style={{ gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(Object.keys(VOICE_PRESETS) as Preset[]).map((p) => <Chip key={p} label={VOICE_PRESETS[p].label} active={preset === p} onPress={() => pick(p)} />)}
        </ScrollView>
        {!P.fixed ? <Field label="عنوان API" value={url} onChangeText={setUrl} ltr placeholder="https://api.example.com/v1" keyboardType="url" /> : null}
        <Field label={P.custom ? 'مفتاح API (اختياري)' : 'مفتاح API'} value={key} onChangeText={setKey} ltr secureTextEntry placeholder="sk-…" />
        {help ? <T size={12} color="muted">{help}</T> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="اختبار" kind="ghost" icon="check-circle" onPress={test} loading={busy} style={{ flex: 1 }} />
          <Button title="إضافة" icon="plus" onPress={add} style={{ flex: 1 }} />
        </View>
      </Card>

      <T weight="bold">المفاتيح المضافة</T>
      {conns.length === 0 ? <Empty icon="key" title="لم تُضف أي مفتاح بعد" sub="استخدم النموذج أعلاه لإضافة أول مفتاح." /> : null}
      {conns.map((cn) => {
        const caps = connCaps(cn);
        const used = (['tts', 'stt'] as const).filter((k) => (k === 'tts' ? tts : stt).conn === cn.id);
        return (
          <Card key={cn.id} style={{ gap: 6, opacity: cn.enabled ? 1 : 0.6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <T weight="bold" ltr>{connHost(cn)}</T>
              {caps.tts ? <T size={11} color="accent" style={{ backgroundColor: c.accentSoft, paddingHorizontal: 8, borderRadius: 8 }}>قراءة</T> : null}
              {caps.stt ? <T size={11} color="accent" style={{ backgroundColor: c.accentSoft, paddingHorizontal: 8, borderRadius: 8 }}>تعرّف</T> : null}
              {!cn.enabled ? <T size={11} color="muted">معطّل</T> : null}
            </View>
            <T size={12} color="muted">{cn.key ? 'المفتاح: ••••' + cn.key.slice(-4) : 'بدون مفتاح'}{used.length ? ' · مستخدم في ' + used.map((k) => (k === 'tts' ? 'القراءة' : 'التعرّف')).join(' و') : ''}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title={cn.enabled ? 'تعطيل' : 'تفعيل'} kind="ghost" small onPress={() => updateConn(cn.id, { enabled: !cn.enabled })} />
              <Button title="حذف" kind="danger" small onPress={() => removeConn(cn.id)} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

/* ---------------- مختار المزوّد ---------------- */
function ConnPicker({ kind, visible, onClose }: { kind: 'tts' | 'stt'; visible: boolean; onClose: () => void }) {
  const c = useColors();
  const snap = useVoice();
  const list = connsFor(snap, kind);
  return (
    <Sheet visible={visible} onClose={onClose} title="المزوّد">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {list.map((cn) => {
          const on = snap[kind].conn === cn.id;
          return (
            <Pressable key={cn.id} onPress={() => { useVoice.getState().useConn(kind, cn.id); onClose(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: on ? c.accentSoft : c.surface, borderWidth: 1, borderColor: on ? c.accent : c.border }}>
              <T style={{ flex: 1 }} ltr>{connLabel(cn)}</T>
              {on ? <Icon name="check" size={18} color={c.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/* ---------------- القراءة الصوتية ---------------- */
function Tts({ goKeys }: { goKeys: () => void }) {
  const r = useRouter();
  const snap = useVoice();
  const setProv = useVoice((s) => s.setProv);
  const [pick, setPick] = useState(false);
  const playing = useSpeaker((s) => s.key === 'test');
  const loading = useSpeaker((s) => s.key === 'test' && s.loading);
  const cf = voiceConf(snap, 'tts');
  const d = TTS_PROVIDERS[cf.p]!;
  const list = connsFor(snap, 'tts');
  const cur = list.find((x) => x.id === snap.tts.conn);
  const vid = d.voiceIsModel ? cf.model : cf.voice;
  const vname = ttsVoiceList(snap, cf.p).find((v) => v.id === vid)?.name || vid || 'غير محدد';
  const rate = snap.tts.rate || 1;

  return (
    <>
      <T size={13} color="text2">تُقرأ ردود المساعد بصوت المزوّد الذي تختاره. بلا مفتاح قراءة يُستخدم صوت الجهاز.</T>
      {list.length === 0 ? (
        <Card style={{ gap: 10 }}>
          <T color="text2">لم تُضف مفتاحًا يدعم القراءة الصوتية بعد. سيُستخدم صوت الجهاز.</T>
          <Button title="إضافة مفتاح صوت" icon="key" onPress={goKeys} />
        </Card>
      ) : (
        <>
          <Group>
            <Row icon="monitor" title="المزوّد" sub={cur ? connLabel(cur) : 'اختر مزوّدًا'} onPress={() => setPick(true)} />
            <Row icon="user" title="الصوت" sub={vname} onPress={() => r.push('/voices')} />
            <Row icon="fast-forward" title="سرعة القراءة" sub={`${rate.toFixed(1)}×`} chevron={false}
              right={<View style={{ flexDirection: 'row' }}><IconButton name="minus" size={18} onPress={() => snap.setTts({ rate: Math.max(0.5, Math.round((rate - 0.1) * 10) / 10) })} /><IconButton name="plus" size={18} onPress={() => snap.setTts({ rate: Math.min(2, Math.round((rate + 0.1) * 10) / 10) })} /></View>} />
          </Group>
          {!d.voiceIsModel ? (
            <Field label="النموذج" value={snap.tts.cfg[cf.p]?.model ?? ''} placeholder={d.model} onChangeText={(t) => setProv('tts', cf.p, { model: t.trim() })} ltr />
          ) : null}
          {!d.voiceIsModel && d.models.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {d.models.map((m) => <Chip key={m} label={m} active={cf.model === m} onPress={() => setProv('tts', cf.p, { model: m })} />)}
            </ScrollView>
          ) : null}
          <Button title={playing ? 'إيقاف' : 'تجربة القراءة'} icon={loading ? 'loader' : playing ? 'square' : 'play'} kind="soft" onPress={() => speak(cf.p === 'deepgram' ? SAMPLE_EN : SAMPLE_AR, 'test')} />
          <T size={12} color="muted">{d.help}</T>
          <T size={12} color="muted">لاختيار صوت آخر أو إضافة صوت مخصص افتح «الأصوات».</T>
          <Button title="استوديو الأصوات" icon="headphones" kind="ghost" onPress={() => r.push('/voices')} />
        </>
      )}
      <ConnPicker kind="tts" visible={pick} onClose={() => setPick(false)} />
    </>
  );
}

/* ---------------- التعرّف على الكلام ---------------- */
function Stt({ goKeys }: { goKeys: () => void }) {
  const snap = useVoice();
  const setProv = useVoice((s) => s.setProv);
  const [pick, setPick] = useState(false);
  const [state, setState] = useState<'idle' | 'rec' | 'busy'>('idle');
  const [res, setRes] = useState('');
  const cf = voiceConf(snap, 'stt');
  const d = STT_PROVIDERS[cf.p]!;
  const list = connsFor(snap, 'stt');
  const cur = list.find((x) => x.id === snap.stt.conn);

  const run = useRef(0);
  const test = async () => {
    if (state !== 'idle') { run.current++; await micCancel(); setState('idle'); return; }
    if (!(await micStart())) return;
    const my = ++run.current;
    setState('rec'); setRes('');
    setTimeout(async () => {
      if (run.current !== my) return;
      setState('busy');
      try {
        const uri = await micStop();
        if (!uri) { setRes('لم يُسمع أي صوت.'); return; }
        const t = await transcribeUri(uri);
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        setRes(t || 'لم يُفهم أي كلام.');
      } catch (e) { setRes('فشل: ' + (e instanceof Error ? e.message : String(e))); } finally { setState('idle'); }
    }, 4000);
  };

  return (
    <>
      <T size={13} color="text2">زر الميكروفون في خانة الرسالة يسجّل صوتك ثم يحوّله إلى نص عبر المزوّد الذي تختاره هنا.</T>
      {list.length === 0 ? (
        <Card style={{ gap: 10 }}>
          <T color="text2">لم تُضف مفتاحًا يدعم التعرّف على الكلام بعد.</T>
          <Button title="إضافة مفتاح صوت" icon="key" onPress={goKeys} />
        </Card>
      ) : (
        <>
          <Group>
            <Row icon="monitor" title="المزوّد" sub={cur ? connLabel(cur) : 'اختر مزوّدًا'} onPress={() => setPick(true)} />
          </Group>
          <Field label="النموذج" value={snap.stt.cfg[cf.p]?.model ?? ''} placeholder={d.model} onChangeText={(t) => setProv('stt', cf.p, { model: t.trim() })} ltr />
          {d.models.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {d.models.map((m) => <Chip key={m} label={m} active={cf.model === m} onPress={() => setProv('stt', cf.p, { model: m })} />)}
            </ScrollView>
          ) : null}
          <T size={12.5} weight="medium" color="muted">اللغة</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STT_LANGS.map(([k, l]) => <Chip key={k} label={l} active={snap.stt.lang === k} onPress={() => snap.setStt({ lang: k })} />)}
          </View>
          <Button title={state === 'rec' ? 'جارٍ التسجيل (4 ثوانٍ)… اضغط للإلغاء' : state === 'busy' ? 'جارٍ التحويل…' : 'اختبار (تسجيل 4 ثوانٍ)'} icon="mic" kind="soft" onPress={test} disabled={state === 'busy'} />
          {res ? <Card><T selectable>{res}</T></Card> : null}
          <T size={12} color="muted">{d.help}</T>
        </>
      )}
      <ConnPicker kind="stt" visible={pick} onClose={() => setPick(false)} />
    </>
  );
}
