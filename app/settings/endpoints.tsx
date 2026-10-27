import { useState } from 'react';
import { View } from 'react-native';
import { hostOf, PROTO_LABEL } from '../../src/api/providers';
import type { Endpoint } from '../../src/api/types';
import { EndpointForm } from '../../src/components/EndpointForm';
import { Button, Card, Dialog, Empty, IconButton, Screen, Switch, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';

export default function Endpoints() {
  const { endpoints, updateEndpoint, removeEndpoint } = useSettings();
  const [form, setForm] = useState<{ edit: Endpoint | null } | null>(null);
  const [del, setDel] = useState<Endpoint | null>(null);
  return (
    <Screen title="المفاتيح ونقاط الاتصال" right={<IconButton name="plus" onPress={() => setForm({ edit: null })} label="إضافة" />}>
      {endpoints.length === 0 ? <Empty icon="key" title="لا توجد نقاط اتصال" sub="أضف مفتاح API أو خادمًا محليًا مثل Ollama." /> : null}
      {endpoints.map((e) => (
        <Card key={e.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T weight="semibold">{e.label}</T>
              <T size={12} color="muted" ltr numberOfLines={1}>{hostOf(e.url)} · {PROTO_LABEL[e.proto]} · {e.kind === 'local' ? 'محلي' : 'API'}</T>
              <T size={12} color="muted" ltr>{e.key ? '•••• ' + e.key.slice(-4) : 'بلا مفتاح'}</T>
            </View>
            <Switch value={e.enabled} onValueChange={(v) => updateEndpoint(e.id, { enabled: v })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="تعديل" icon="edit-2" kind="soft" small onPress={() => setForm({ edit: e })} style={{ flex: 1 }} />
            <Button title="حذف" icon="trash-2" kind="danger" small onPress={() => setDel(e)} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
      <Button title="إضافة نقطة اتصال" icon="plus" onPress={() => setForm({ edit: null })} />
      {form ? <EndpointForm key={form.edit?.id ?? 'new'} visible edit={form.edit} onClose={() => setForm(null)} /> : null}
      <Dialog
        visible={!!del}
        title="حذف نقطة الاتصال؟"
        message={del ? `سيُحذف «${del.label}» ومفتاحه من هذا الجهاز.` : ''}
        onClose={() => setDel(null)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (del) removeEndpoint(del.id); setDel(null); } },
          { title: 'إلغاء', onPress: () => setDel(null) },
        ]}
      />
    </Screen>
  );
}
