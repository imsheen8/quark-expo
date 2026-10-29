import { useState } from 'react';
import { Linking, View } from 'react-native';
import { addEndpointFlow, apiLabel, localLabel, normUrl, testEndpoint } from '../api/endpointFlow';
import { PRESETS, PROTO_LABEL } from '../api/providers';
import type { Proto } from '../api/types';
import { toast } from '../store/data';
import { useColors } from '../theme';
import { SelectBox } from './SelectBox';
import { Panel } from './ui/panels';
import { Button, Field, T } from './ui/kit';

type Kind = 'local' | 'api';

const optsOf = (kind: Kind) => {
  const list = Object.entries(PRESETS).filter(([, p]) => p.kind === kind).map(([key, p]) => ({ key, label: p.label }));
  // «مخصص» معرَّف في الإعدادات الجاهزة كـ API؛ للمحلي نضيفه يدويًا
  return kind === 'local' ? [...list, { key: 'custom', label: 'مخصص' }] : list;
};
const OPTS: Record<Kind, { key: string; label: string }[]> = { local: optsOf('local'), api: optsOf('api') };
const FIRST: Record<Kind, string> = { local: 'ollama', api: 'openrouter' };

const errText = (e: unknown) => (e instanceof Error ? e.message.slice(0, 140) : 'فشل الاتصال');

/** «إضافة نماذج»: اختيار (محلي / مفتاح)، ثم المزوّد | الرابط، ثم المفتاح */
export function EndpointAdd() {
  const c = useColors();
  const [kind, setKind] = useState<Kind>('local');
  const [preset, setPreset] = useState(FIRST.local);
  const [url, setUrl] = useState(PRESETS[FIRST.local].url);
  const [key, setKey] = useState('');
  const [proto, setProto] = useState<Proto>(PRESETS[FIRST.local].proto);
  const [busy, setBusy] = useState(false);
  const p = PRESETS[preset] ?? PRESETS.custom;

  const switchKind = (k: Kind) => {
    setKind(k);
    setPreset(FIRST[k]);
    setUrl(PRESETS[FIRST[k]].url);
    setProto(PRESETS[FIRST[k]].proto);
    setKey('');
  };

  const choose = (id: string) => {
    setPreset(id);
    setUrl(PRESETS[id].url);
    setProto(PRESETS[id].proto);
  };

  const draft = () => {
    const u = normUrl(url);
    // عنوان ينتهي بـ /v1 على Ollama يعني الواجهة المتوافقة مع OpenAI
    const pr: Proto = proto === 'ollama' && /\/v1$/.test(u) ? 'openai' : proto;
    return { preset, label: kind === 'local' ? localLabel(u) : apiLabel(preset), url: u, key: key.trim(), proto: pr, kind };
  };

  const test = async () => {
    const d = draft();
    if (!d.url) return toast('أدخل عنوان الخدمة');
    setBusy(true);
    try {
      toast(`الاتصال ناجح — ${await testEndpoint(d)} نموذج`);
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const d = draft();
    if (!d.url) return toast('أدخل عنوان الخدمة');
    if (kind === 'api' && !d.key && preset !== 'custom') return toast('أدخل مفتاح API');
    setBusy(true);
    await addEndpointFlow(d);
    setBusy(false);
    setKey('');
  };

  return (
    <Panel icon="server" title="إضافة نماذج" tag="نقاط الاتصال">
      <SelectBox
        title="النوع"
        value={kind}
        options={[{ key: 'local', label: 'محلي' }, { key: 'api', label: 'مفتاح' }]}
        onChange={switchKind}
        chevronFirst
      />

      {/* المزوّد | الرابط: نصفان بينهما فجوة بلون الخلفية، الزوايا الخارجية منحنية والداخلية حادّة، والسهم في الطرف البعيد */}
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <SelectBox
          title="المزوّد"
          value={preset}
          options={OPTS[kind]}
          onChange={choose}
          chevronFirst
          style={{ flex: 1, borderRadius: 0, borderTopStartRadius: 12, borderBottomStartRadius: 12 }}
        />
        {/* حاوية View تقصّ الزوايا: TextInput لا يحترم الزوايا المنطقية على أندرويد */}
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
      </View>

      <Field
        value={key}
        onChangeText={setKey}
        ltr
        secureTextEntry
        placeholder={kind === 'local' ? 'المفتاح (اختياري)' : 'مفتاح API'}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SelectBox
          title="البروتوكول"
          value={proto}
          options={(Object.keys(PROTO_LABEL) as Proto[]).map((x) => ({ key: x, label: PROTO_LABEL[x] }))}
          onChange={setProto}
          chevronFirst
          style={{ flex: 1 }}
        />
        <Button title="إضافة" onPress={add} loading={busy} style={{ flex: 1 }} />
      </View>

      {p.help ? (
        <View style={{ gap: 2 }}>
          <T size={12} color="muted">{p.help}</T>
          {p.link ? (
            <T size={12} color="accent" ltr onPress={() => Linking.openURL(p.link!)} style={{ textDecorationLine: 'underline' }}>
              {p.link.replace('https://', '')}
            </T>
          ) : null}
        </View>
      ) : null}

      <Button title="اختبار" kind="ghost" onPress={test} loading={busy} />
    </Panel>
  );
}
