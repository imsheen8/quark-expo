import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { INTEG_PRESETS, type AuthKind, type Integration } from '../../src/api/integCore';
import { runApiCall } from '../../src/api/engines';
import { Button, Chip, Empty, Field, Group, Row, Screen, Sheet, Switch, T, IconButton } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useInteg } from '../../src/store/features';

const AUTHS: [AuthKind, string][] = [['none', 'بلا'], ['bearer', 'Bearer'], ['header', 'ترويسة'], ['query', 'معامل رابط'], ['basic', 'Basic']];
const blank = (): Omit<Integration, 'id'> => ({ name: '', url: '', auth: 'bearer', key: '', field: '', desc: '', readOnly: false, enabled: true });

export default function Integrations() {
  const { items, hooks, add, update, remove, addHook, updateHook, removeHook } = useInteg();
  const [ed, setEd] = useState<(Omit<Integration, 'id'> & { id?: string }) | null>(null);
  const [hook, setHook] = useState<{ url: string; secret: string } | null>(null);
  const save = () => {
    if (!ed?.name.trim() || !/^https?:\/\//.test(ed.url)) return toast('أدخل الاسم وعنوانًا يبدأ بـ http');
    if (ed.id) update(ed.id, ed); else add(ed);
    setEd(null);
  };
  const test = async () => {
    if (!ed) return;
    try {
      const id = ed.id ?? add(ed);
      if (!ed.id) setEd({ ...ed, id });
      const r = await runApiCall({ integration: id, method: 'GET', path: '/' });
      toast(r.split('\n')[0]);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Screen title="التكاملات" right={<IconButton name="plus" label="إضافة" onPress={() => setEd(blank())} />}>
      <T size={13} color="text2">اربط خدمات بواجهات REST (Home Assistant، GitHub، Todoist…) ليستعملها النموذج والوكيل. مفاتيحك تُحفظ على جهازك فقط. الطلبات التي تغيّر بيانات تحتاج موافقتك.</T>
      {items.length === 0 ? <Empty icon="link" title="لا توجد تكاملات" /> : (
        <Group>{items.map((i) => <Row key={i.id} icon="link" title={i.name} sub={i.url} chevron={false} onPress={() => setEd(i)} right={<Switch value={i.enabled} onValueChange={(v) => update(i.id, { enabled: v })} />} />)}</Group>
      )}
      <Group title="Webhooks (إشعار خارجي بالأحداث)">
        {hooks.map((h) => <Row key={h.id} icon="send" title={h.url} sub={h.events.join(' · ')} chevron={false} onLongPress={() => removeHook(h.id)} right={<Switch value={h.enabled} onValueChange={(v) => updateHook(h.id, { enabled: v })} />} />)}
        <Row icon="plus" title="إضافة Webhook" onPress={() => setHook({ url: '', secret: '' })} />
      </Group>
      <T size={11.5} color="muted">اضغط مطولًا على Webhook لحذفه. يُوقَّع الطلب بـ HMAC-SHA256 في ترويسة x-quark-signature إن وُضع سرّ.</T>

      <Sheet visible={!!ed} onClose={() => setEd(null)} title={ed?.id ? 'تعديل التكامل' : 'تكامل جديد'} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {!ed?.id ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{INTEG_PRESETS.map((p) => <Chip key={p.label} label={p.label} onPress={() => setEd({ ...blank(), ...p.v })} />)}</View> : null}
          <Field label="الاسم" value={ed?.name ?? ''} onChangeText={(t) => setEd({ ...ed!, name: t })} />
          <Field label="العنوان الأساسي" ltr value={ed?.url ?? ''} onChangeText={(t) => setEd({ ...ed!, url: t })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AUTHS.map(([k, l]) => <Chip key={k} label={l} active={ed?.auth === k} onPress={() => setEd({ ...ed!, auth: k })} />)}</View>
          {ed?.auth !== 'none' ? <Field label={ed?.auth === 'basic' ? 'كلمة المرور / المفتاح' : 'المفتاح'} ltr secureTextEntry value={ed?.key ?? ''} onChangeText={(t) => setEd({ ...ed!, key: t })} /> : null}
          {ed?.auth === 'header' || ed?.auth === 'query' || ed?.auth === 'basic' ? <Field label={ed.auth === 'header' ? 'اسم الترويسة' : ed.auth === 'query' ? 'اسم المعامل' : 'اسم المستخدم'} ltr value={ed.field} onChangeText={(t) => setEd({ ...ed, field: t })} /> : null}
          <Field label="وصف المسارات للنموذج" multiline value={ed?.desc ?? ''} onChangeText={(t) => setEd({ ...ed!, desc: t })} />
          <Row icon="eye" title="للقراءة فقط (GET)" chevron={false} right={<Switch value={!!ed?.readOnly} onValueChange={(v) => setEd({ ...ed!, readOnly: v })} />} />
          <Button title="حفظ" onPress={save} />
          <Button title="اختبار الاتصال" kind="soft" onPress={test} />
          {ed?.id ? <Button title="حذف" kind="danger" onPress={() => { remove(ed.id!); setEd(null); }} /> : null}
        </ScrollView>
      </Sheet>
      <Sheet visible={!!hook} onClose={() => setHook(null)} title="Webhook جديد">
        <View style={{ padding: 16, gap: 12 }}>
          <Field label="العنوان" ltr value={hook?.url ?? ''} onChangeText={(t) => setHook({ ...hook!, url: t })} />
          <Field label="السرّ (اختياري)" ltr secureTextEntry value={hook?.secret ?? ''} onChangeText={(t) => setHook({ ...hook!, secret: t })} />
          <Button title="حفظ" onPress={() => { if (!/^https?:\/\//.test(hook!.url)) return toast('عنوان غير صالح'); addHook({ url: hook!.url, secret: hook!.secret, events: ['chat.completed'], withText: false, enabled: true }); setHook(null); }} />
        </View>
      </Sheet>
    </Screen>
  );
}
