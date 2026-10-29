import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { PRESETS, PROTO_LABEL } from '../api/providers';
import { fetchModels } from '../api/stream';
import type { Endpoint, Proto } from '../api/types';
import { endpointFromPreset, useSettings } from '../store/settings';
import { toast } from '../store/data';
import { useColors } from '../theme';
import { SelectBox } from './SelectBox';
import { Badge } from './ui/panels';
import { Button, Chip, Field, Sheet, T } from './ui/kit';

/** إضافة أو تعديل نقطة اتصال (ورقة سفلية) */
export function EndpointForm({ visible, onClose, edit }: { visible: boolean; onClose: () => void; edit?: Endpoint | null }) {
  const c = useColors();
  const base = edit ?? { ...endpointFromPreset('openrouter'), id: '' };
  const [preset, setPreset] = useState(edit?.preset ?? 'openrouter');
  const [url, setUrl] = useState(base.url);
  const [key, setKey] = useState(base.key);
  const [proto, setProto] = useState<Proto>(base.proto);
  const [kind, setKind] = useState<'api' | 'local'>(base.kind);
  const [busy, setBusy] = useState(false);
  const p = PRESETS[preset] ?? PRESETS.custom;

  const choose = (id: string) => {
    const x = PRESETS[id];
    setPreset(id);
    setUrl(x.url);
    setProto(x.proto);
    setKind(x.kind);
  };

  const draft = (): Endpoint => ({ ...(edit ?? { id: 'tmp', models: [], enabled: true }), preset, label: PRESETS[preset]?.label ?? 'مخصص', url: url.trim(), key: key.trim(), proto, kind });

  const test = async () => {
    if (!url.trim()) return toast('أدخل عنوان الخدمة');
    setBusy(true);
    try {
      const ids = await fetchModels(draft());
      toast(`الاتصال ناجح — ${ids.length} نموذج`);
    } catch (e) {
      toast(e instanceof Error ? e.message.slice(0, 140) : 'فشل الاتصال');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!url.trim()) return toast('أدخل عنوان الخدمة');
    if (kind === 'api' && !key.trim() && preset !== 'custom') return toast('أدخل مفتاح API');
    setBusy(true);
    const st = useSettings.getState();
    let id: string;
    if (edit) {
      id = edit.id;
      st.updateEndpoint(id, { preset, label: draft().label, url: url.trim(), key: key.trim(), proto, kind });
    } else {
      id = st.addEndpoint({ preset, label: draft().label, url: url.trim(), key: key.trim(), proto, kind, enabled: true, models: [] });
    }
    try {
      const ids = await fetchModels({ ...draft(), id });
      st.setModels(id, ids, !edit && ids.length <= 15);
      const ep = useSettings.getState().endpoints.find((e) => e.id === id);
      const first = ep?.models.find((m) => m.on);
      if (first && !useSettings.getState().sel) st.select(id, first.id);
      toast(edit ? 'تم الحفظ' : ids.length <= 15 ? `أُضيفت النقطة وفُعّلت ${ids.length} نموذجًا` : `أُضيفت النقطة — فعّل النماذج من صفحة «النماذج» (${ids.length})`);
    } catch (e) {
      toast('حُفظت النقطة لكن تعذّر جلب النماذج: ' + (e instanceof Error ? e.message.slice(0, 100) : ''));
    }
    setBusy(false);
    onClose();
  };

  if (edit) {
    return (
      <Sheet visible={visible} onClose={onClose} title="تعديل نقطة الاتصال">
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={15.5} weight="bold" ltr numberOfLines={1} style={{ flexShrink: 1 }}>{edit.label}</T>
            <Badge text={edit.kind === 'local' ? 'محلي' : 'API'} />
          </View>
          {kind === 'local' ? <Field label="العنوان الأساسي" value={url} onChangeText={setUrl} ltr placeholder="http://192.168.1.5:8080" keyboardType="url" /> : null}
          <Field label={kind === 'local' ? 'المفتاح (اختياري)' : 'مفتاح API'} value={key} onChangeText={setKey} ltr secureTextEntry placeholder="sk-…" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SelectBox
              title="البروتوكول"
              value={proto}
              options={(Object.keys(PROTO_LABEL) as Proto[]).map((x) => ({ key: x, label: PROTO_LABEL[x] }))}
              onChange={setProto}
              chevronFirst
              style={{ flex: 1 }}
            />
            <Button title="حفظ" onPress={save} loading={busy} style={{ flex: 1 }} />
          </View>
          <Button title="اختبار" kind="ghost" onPress={test} loading={busy} />
        </ScrollView>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="إضافة نقطة اتصال" full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <T size={12.5} weight="medium" color="muted">المزوّد</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(PRESETS).map(([id, x]) => (
              <Chip key={id} label={x.label} active={preset === id} onPress={() => choose(id)} />
            ))}
          </View>
        </View>
        <Field label="العنوان الأساسي" value={url} onChangeText={setUrl} ltr placeholder="https://api.example.com/v1" keyboardType="url" />
        <Field label={kind === 'local' ? 'المفتاح (اختياري)' : 'مفتاح API'} value={key} onChangeText={setKey} ltr secureTextEntry placeholder="sk-…" />
        <View style={{ gap: 6 }}>
          <T size={12.5} weight="medium" color="muted">البروتوكول</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(PROTO_LABEL) as Proto[]).map((x) => (
              <Chip key={x} label={PROTO_LABEL[x]} active={proto === x} onPress={() => setProto(x)} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="API سحابي" icon="cloud" active={kind === 'api'} onPress={() => setKind('api')} />
          <Chip label="خادم محلي" icon="server" active={kind === 'local'} onPress={() => setKind('local')} />
        </View>
        <View style={{ backgroundColor: c.surface2, borderRadius: 12, padding: 12, gap: 6 }}>
          <T size={13} color="text2">
            {p.help}
          </T>
          {p.link ? (
            <T size={13} color="accent" ltr onPress={() => Linking.openURL(p.link!)} style={{ textDecorationLine: 'underline' }}>
              {p.link.replace('https://', '')}
            </T>
          ) : null}
          <T size={12} color="muted">تُحفظ مفاتيحك على جهازك فقط ولا تُرسل إلا إلى العنوان الذي تحدده.</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="اختبار" kind="ghost" icon="activity" onPress={test} loading={busy} style={{ flex: 1 }} />
          <Button title={edit ? 'حفظ' : 'إضافة'} icon="check" onPress={save} loading={busy} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </Sheet>
  );
}
