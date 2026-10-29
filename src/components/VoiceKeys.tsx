import { useState } from 'react';
import { View } from 'react-native';
import { testConn } from '../api/voice';
import { STT_PROVIDERS, TTS_PROVIDERS, VOICE_PRESETS, connCaps, connHost, type Preset } from '../api/voiceCore';
import { toast } from '../store/data';
import { useVoice } from '../store/voice';
import { useColors } from '../theme';
import { SelectBox } from './SelectBox';
import { Badge, Panel } from './ui/panels';
import { Button, Dialog, Field, T } from './ui/kit';

const OPTS = (Object.keys(VOICE_PRESETS) as Preset[]).map((key) => ({ key, label: VOICE_PRESETS[key].label }));
const errText = (e: unknown) => (e instanceof Error ? e.message.slice(0, 140) : 'فشل الاختبار');

/** «إضافة مفتاح صوت»: نفس شكل «إضافة نماذج» — المزوّد | الرابط ثم المفتاح */
export function VoiceKeyAdd() {
  const c = useColors();
  const addConn = useVoice((s) => s.addConn);
  const [preset, setPreset] = useState<Preset>('openai');
  const [url, setUrl] = useState(VOICE_PRESETS.openai.url);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const P = VOICE_PRESETS[preset];
  const help = (STT_PROVIDERS[preset] || TTS_PROVIDERS[preset])?.help || '';

  const choose = (p: Preset) => { setPreset(p); setUrl(VOICE_PRESETS[p].url); };

  const test = async () => {
    if (!key.trim() && !P.custom) return toast('أدخل مفتاح API');
    setBusy(true);
    try { await testConn(preset, url.trim(), key.trim()); toast('المفتاح يعمل ✓'); } catch (e) { toast('فشل الاختبار: ' + errText(e)); } finally { setBusy(false); }
  };
  const add = () => {
    if (!key.trim() && !P.custom) return toast('أدخل مفتاح API');
    if (P.custom && !/^https?:\/\//i.test(url.trim())) return toast('أدخل عنوان API يبدأ بـ http');
    addConn({ preset, url: P.fixed ? '' : url.trim().replace(/\/+$/, ''), key: key.trim() });
    setKey('');
    toast('أُضيف المفتاح');
  };

  return (
    <Panel icon="mic" title="إضافة مفتاح صوت" tag="القراءة والتعرّف">
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <SelectBox
          title="المزوّد"
          value={preset}
          options={OPTS}
          onChange={choose}
          chevronFirst
          style={P.fixed ? { flex: 1 } : { flex: 1, borderRadius: 0, borderTopStartRadius: 12, borderBottomStartRadius: 12 }}
        />
        {!P.fixed ? (
          <View
            style={{
              flex: 1.5, height: 46, justifyContent: 'center', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
              borderRadius: 0, borderTopEndRadius: 12, borderBottomEndRadius: 12, overflow: 'hidden',
            }}
          >
            <Field
              value={url}
              onChangeText={setUrl}
              ltr
              keyboardType="url"
              placeholder="الرابط"
              inputStyle={{ height: 44, paddingVertical: 0, fontSize: 14, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' }}
            />
          </View>
        ) : null}
      </View>

      <Field value={key} onChangeText={setKey} ltr secureTextEntry placeholder={P.custom ? 'مفتاح API (اختياري)' : 'مفتاح API'} />

      {help ? <T size={12} color="muted">{help}</T> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="إضافة" onPress={add} style={{ flex: 1 }} />
        <Button title="اختبار" kind="ghost" onPress={test} loading={busy} style={{ flex: 1 }} />
      </View>
    </Panel>
  );
}

/** «المفاتيح المضافة»: بطاقات بنفس شكل بطاقات نقاط الاتصال */
export function VoiceKeyList() {
  const c = useColors();
  const { conns, updateConn, removeConn, stt, tts } = useVoice();
  const [del, setDel] = useState<string | null>(null);
  const target = conns.find((x) => x.id === del);

  return (
    <Panel icon="key" title="مفاتيح الصوت المضافة" tag="القراءة والتعرّف" sub="أدِر المفاتيح التي أضفتها، ثم اختر المزوّد من إعدادات الصوت.">
      {conns.length === 0 ? <T size={13.5} color="muted">لم تُضف أي مفتاح صوت بعد. أضف مفتاحًا من الأعلى.</T> : null}
      {conns.map((cn) => {
        const caps = connCaps(cn);
        const used = (['tts', 'stt'] as const).filter((k) => (k === 'tts' ? tts : stt).conn === cn.id);
        return (
          <View key={cn.id} style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, opacity: cn.enabled ? 1 : 0.7 }}>
            <View style={{ padding: 12, gap: 8 }}>
              <T size={15.5} weight="bold" ltr numberOfLines={1}>{connHost(cn)}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {caps.tts ? <Badge text="قراءة" /> : null}
                {caps.stt ? <Badge text="تعرّف" /> : null}
                {used.length ? <Badge text={'مستخدم في ' + used.map((k) => (k === 'tts' ? 'القراءة' : 'التعرّف')).join(' و')} tone="ok" /> : null}
                {!cn.enabled ? <Badge text="معطّل" tone="muted" /> : null}
              </View>
              <T size={12} color="muted">{cn.key ? 'المفتاح: ••••' + cn.key.slice(-4) : 'بدون مفتاح'}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
              <Button title={cn.enabled ? 'تعطيل' : 'تفعيل'} kind="ghost" small onPress={() => updateConn(cn.id, { enabled: !cn.enabled })} />
              <Button title="حذف" kind="danger" small onPress={() => setDel(cn.id)} />
            </View>
          </View>
        );
      })}
      <Dialog
        visible={!!target}
        title="حذف مفتاح الصوت؟"
        message={target ? `سيُحذف مفتاح «${connHost(target)}» من هذا الجهاز.` : ''}
        onClose={() => setDel(null)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (del) removeConn(del); setDel(null); } },
          { title: 'إلغاء', onPress: () => setDel(null) },
        ]}
      />
    </Panel>
  );
}
