import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { preview, stopSpeaking, useSpeaker } from '../src/api/voice';
import { SAMPLE_AR, SAMPLE_EN, TTS_PROVIDERS, VOICE_PRESETS, connsFor, hueOf, ttsVoiceList, type Preset, type VoiceItem } from '../src/api/voiceCore';
import { Button, Card, Chip, Dialog, Empty, Field, Icon, IconButton, Screen, T } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useVoice } from '../src/store/voice';
import { useColors } from '../src/theme';

const SAMPLES: [string, string][] = [
  ['عربي', SAMPLE_AR],
  ['English', SAMPLE_EN],
  ['خبر', 'أعلنت الشركة اليوم عن إطلاق خدمة جديدة تهدف إلى تسهيل حياة المستخدمين في أنحاء العالم العربي.'],
  ['قصة', 'في قديم الزمان، كان هناك صياد يعيش بجوار البحر، وكل صباح كان يخرج بقاربه الصغير قبل شروق الشمس.'],
  ['أرقام', 'الساعة الآن الثالثة والنصف، ودرجة الحرارة خمس وعشرون درجة مئوية، ورقم طلبك: 4 7 1 9 0 2.'],
];
type Filter = 'all' | 'fav' | 'cust';
const secs = (ms: number) => (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + ' s';

export default function Voices() {
  const c = useColors();
  const r = useRouter();
  const snap = useVoice();
  const { toggleFav, addCustom, updateCustom, removeCustom, setProv, setTts, useConn } = snap;
  const ps = useMemo(() => {
    const a: Preset[] = [];
    connsFor(snap, 'tts').forEach((x) => { if (!a.includes(x.preset)) a.push(x.preset); });
    return a;
  }, [snap.conns]);
  const [vpSel, setVp] = useState<Preset | ''>('');
  const vp: Preset | '' = vpSel && ps.includes(vpSel) ? vpSel : ps.includes(snap.tts.p) ? snap.tts.p : ps[0] || '';
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const [text, setText] = useState('');
  const [lat, setLat] = useState<Record<string, number>>({});
  const key = useSpeaker((s) => s.key);
  const loadingKey = useSpeaker((s) => (s.loading ? s.key : null));
  const [form, setForm] = useState<{ cid?: string; name: string; voiceId: string; model: string; desc: string } | null>(null);
  const [del, setDel] = useState<VoiceItem | null>(null);

  if (!vp)
    return (
      <Screen title="الأصوات">
        <Empty icon="headphones" title="لا توجد مفاتيح صوت" sub="أضف مفتاح مزوّد يدعم القراءة الصوتية (OpenAI أو ElevenLabs أو Gemini أو Deepgram أو مخصص) لتجربة الأصوات واختيارها." />
        <Button title="إضافة مفتاح صوت" icon="key" onPress={() => r.push('/settings/voice')} />
      </Screen>
    );

  const d = TTS_PROVIDERS[vp]!;
  const cfg = snap.tts.cfg[vp] || {};
  const curId = d.voiceIsModel ? cfg.model || d.model : cfg.voice || d.voice;
  const isCurProv = snap.tts.p === vp;
  const sample = text || (vp === 'deepgram' ? SAMPLE_EN : SAMPLE_AR);
  const fk = (id: string) => vp + '|' + id;
  const pk = (id: string) => 'pv:' + vp + '|' + id;

  const list = ttsVoiceList(snap, vp).filter((v) => {
    const n = q.trim().toLowerCase();
    if (n && !(v.name + ' ' + v.desc + ' ' + v.id).toLowerCase().includes(n)) return false;
    if (f === 'fav') return snap.favs.includes(fk(v.id));
    if (f === 'cust') return !!v.custom;
    return true;
  });

  const play = async (v: VoiceItem) => {
    const ms = await preview(vp, v.id, v.custom && v.model ? v.model : undefined, sample, pk(v.id));
    if (ms != null) setLat((p) => ({ ...p, [pk(v.id)]: ms }));
  };
  const use = (v: VoiceItem) => {
    const conn = snap.conns.find((x) => x.preset === vp && x.enabled);
    if (conn) useConn('tts', conn.id);
    setTts({ p: vp });
    setProv('tts', vp, d.voiceIsModel ? { model: v.id } : { voice: v.id, ...(v.custom && v.model ? { model: v.model } : {}) });
    toast('الصوت المختار: ' + v.name);
  };
  const saveForm = () => {
    if (!form) return;
    if (!form.name.trim() || !form.voiceId.trim()) return toast('أدخل اسم الصوت ومعرّفه');
    const v = { name: form.name.trim(), voiceId: form.voiceId.trim(), model: form.model.trim(), desc: form.desc.trim(), color: '' };
    if (form.cid) updateCustom(vp, form.cid, v); else addCustom(vp, v);
    setForm(null);
  };

  return (
    <Screen title="الأصوات" right={<IconButton name="plus" onPress={() => setForm({ name: '', voiceId: '', model: '', desc: '' })} label="صوت مخصص" />}>
      <T size={13} color="text2">جرّب أي صوت بنص تجريبي ثم اضغط «استخدام» ليصبح صوت القراءة. التجربة لا تغيّر الصوت المختار.</T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {ps.map((p) => <Chip key={p} label={VOICE_PRESETS[p].label} active={vp === p} onPress={() => { stopSpeaking(); setVp(p); }} />)}
      </ScrollView>

      <Card style={{ gap: 8 }}>
        <Field label="النص التجريبي" value={text} onChangeText={setText} multiline placeholder={sample} inputStyle={{ minHeight: 70 }} autoCapitalize="sentences" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SAMPLES.map(([l, t]) => <Chip key={l} label={l} active={text === t} onPress={() => setText(t)} />)}
        </ScrollView>
        <T size={11.5} color="muted">السرعة: {(snap.tts.rate || 1).toFixed(1)}× (تُضبط من الإعدادات ← الصوت)</T>
      </Card>

      <Field placeholder="ابحث في الأصوات…" value={q} onChangeText={setQ} autoCapitalize="sentences" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['all', 'الكل'], ['fav', 'المفضلة'], ['cust', 'المخصصة']] as const).map(([k, l]) => <Chip key={k} label={l} active={f === k} onPress={() => setF(k)} />)}
      </View>

      {list.length === 0 ? <Empty icon="headphones" title="لا أصوات مطابقة" sub={f === 'cust' ? 'اضغط + لإضافة صوت مخصص.' : undefined} /> : null}
      {list.map((v) => {
        const cur = isCurProv && v.id === curId;
        const playing = key === pk(v.id);
        const loading = loadingKey === pk(v.id);
        const fav = snap.favs.includes(fk(v.id));
        const hue = hueOf(vp, v.id);
        return (
          <Card key={v.custom ? 'c' + v.cid : v.id} style={{ gap: 8, borderColor: cur ? c.accent : c.border, borderWidth: cur ? 1.5 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => play(v)} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: `hsla(${hue},60%,50%,0.22)` }} accessibilityLabel="تجربة">
                <Icon name={loading ? 'loader' : playing ? 'square' : 'play'} size={18} color={c.text} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T weight="bold" ltr numberOfLines={1} style={{ flexShrink: 1 }}>{v.name}</T>
                  {cur ? <T size={11} color="accent" style={{ backgroundColor: c.accentSoft, paddingHorizontal: 8, borderRadius: 8 }}>الحالي</T> : null}
                  {v.custom ? <T size={11} color="muted">مخصص</T> : null}
                </View>
                <T size={12.5} color="muted" numberOfLines={1}>{v.desc}</T>
                {lat[pk(v.id)] != null ? <T size={11} color="muted">{lat[pk(v.id)] === 0 ? 'من الذاكرة المؤقتة' : 'زمن التوليد ' + secs(lat[pk(v.id)])}</T> : null}
              </View>
              <IconButton name="star" size={18} active={fav} color={fav ? c.accent : undefined} onPress={() => toggleFav(fk(v.id))} label="مفضلة" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Button title={cur ? 'مستخدم' : 'استخدام'} kind={cur ? 'soft' : 'ghost'} small icon={cur ? 'check' : undefined} onPress={() => use(v)} disabled={cur} />
              {v.custom ? (
                <>
                  <Button title="تعديل" kind="ghost" small onPress={() => setForm({ cid: v.cid, name: v.name, voiceId: v.id, model: v.model || '', desc: v.desc === 'صوت مخصص' ? '' : v.desc })} />
                  <Button title="حذف" kind="danger" small onPress={() => setDel(v)} />
                </>
              ) : null}
              <View style={{ flex: 1 }} />
              <T size={10.5} color="muted" ltr numberOfLines={1} style={{ maxWidth: 120 }}>{v.id}</T>
            </View>
          </Card>
        );
      })}

      <Dialog visible={!!form} title={form?.cid ? 'تعديل الصوت' : 'صوت مخصص'} onClose={() => setForm(null)}
        actions={[{ title: 'حفظ', onPress: saveForm }, { title: 'إلغاء', onPress: () => setForm(null) }]}>
        {form ? (
          <View style={{ gap: 10 }}>
            <Field label="الاسم" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} autoCapitalize="sentences" />
            <Field label={d.voiceIsModel ? 'معرّف النموذج' : d.voiceHint || 'معرّف الصوت (Voice ID)'} value={form.voiceId} onChangeText={(t) => setForm({ ...form, voiceId: t })} ltr />
            {!d.voiceIsModel ? <Field label="نموذج خاص بهذا الصوت (اختياري)" value={form.model} onChangeText={(t) => setForm({ ...form, model: t })} ltr placeholder={d.model} /> : null}
            <Field label="وصف (اختياري)" value={form.desc} onChangeText={(t) => setForm({ ...form, desc: t })} autoCapitalize="sentences" />
          </View>
        ) : null}
      </Dialog>
      <Dialog visible={!!del} title="حذف هذا الصوت المخصص؟" message={del?.name} onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { if (del?.cid) removeCustom(vp, del.cid); setDel(null); } }, { title: 'إلغاء', onPress: () => setDel(null) }]} />
    </Screen>
  );
}
