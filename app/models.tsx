import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { hostOf } from '../src/api/providers';
import { fetchModels } from '../src/api/stream';
import { EndpointForm } from '../src/components/EndpointForm';
import { Button, Card, Empty, Field, IconButton, Icon, Screen, Switch, T } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

export default function Models() {
  const c = useColors();
  const router = useRouter();
  const { endpoints, sel, select, toggleModel, addModel, setModels, updateEndpoint } = useSettings();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [openEp, setOpenEp] = useState<string | null>(endpoints[0]?.id ?? null);
  const needle = q.trim().toLowerCase();

  const refresh = async (id: string) => {
    const ep = useSettings.getState().endpoints.find((e) => e.id === id);
    if (!ep) return;
    setBusy(id);
    try {
      const ids = await fetchModels(ep);
      setModels(id, ids);
      toast(`جُلب ${ids.length} نموذج`);
    } catch (e) {
      toast(e instanceof Error ? e.message.slice(0, 140) : 'تعذّر الجلب');
    } finally {
      setBusy(null);
    }
  };

  const shown = useMemo(
    () => endpoints.map((e) => ({ e, models: e.models.filter((m) => !needle || m.id.toLowerCase().includes(needle)).sort((a, b) => Number(b.on) - Number(a.on)) })),
    [endpoints, needle],
  );

  return (
    <Screen title="النماذج" menu right={<IconButton name="plus" onPress={() => setAdding(true)} label="إضافة" />}>
      <Pressable onPress={() => router.push('/local')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: pressed ? c.surface3 : c.accentSoft })}>
        <Icon name="smartphone" size={22} color={c.accent} />
        <View style={{ flex: 1 }}>
          <T weight="semibold">نماذج على الجهاز (llama.cpp)</T>
          <T size={12.5} color="text2">نزّل نموذجًا واعمل دون إنترنت</T>
        </View>
        <Icon name="chevron-left" size={18} color={c.muted} />
      </Pressable>
      {endpoints.length === 0 ? (
        <>
          <Empty icon="cpu" title="لا توجد نقاط اتصال" sub="أضف مفتاح API أو خادمًا محليًا لتظهر نماذجك هنا." />
          <Button title="إضافة نقطة اتصال" icon="plus" onPress={() => setAdding(true)} />
        </>
      ) : (
        <>
          <Field placeholder="ابحث في النماذج…" value={q} onChangeText={setQ} ltr />
          {shown.map(({ e, models }) => {
            const open = openEp === e.id || !!needle;
            return (
              <Card key={e.id} style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
                <Pressable onPress={() => setOpenEp(open && !needle ? null : e.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                  <View style={{ flex: 1 }}>
                    <T weight="semibold">{e.label}</T>
                    <T size={12} color="muted" ltr numberOfLines={1}>{hostOf(e.url)} · {e.models.filter((m) => m.on).length}/{e.models.length}</T>
                  </View>
                  <Switch value={e.enabled} onValueChange={(v) => updateEndpoint(e.id, { enabled: v })} />
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
                </Pressable>
                {open ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: c.border, padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button title="جلب النماذج" icon="refresh-cw" kind="soft" small loading={busy === e.id} onPress={() => refresh(e.id)} style={{ flex: 1 }} />
                      <Button
                        title="تفعيل الكل"
                        kind="ghost"
                        small
                        onPress={() => e.models.forEach((m) => !m.on && toggleModel(e.id, m.id, true))}
                        style={{ flex: 1 }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                      <Field style={{ flex: 1 }} placeholder="معرّف نموذج مخصص" value={custom[e.id] ?? ''} onChangeText={(t) => setCustom((p) => ({ ...p, [e.id]: t }))} ltr />
                      <IconButton
                        name="plus"
                        style={{ backgroundColor: c.accentSoft, marginBottom: 2 }}
                        color={c.accent}
                        onPress={() => {
                          const id = (custom[e.id] ?? '').trim();
                          if (!id) return;
                          addModel(e.id, id);
                          setCustom((p) => ({ ...p, [e.id]: '' }));
                        }}
                      />
                    </View>
                    {models.length === 0 ? <T size={13} color="muted" style={{ textAlign: 'center', padding: 10 }}>لا توجد نماذج — اضغط «جلب النماذج»</T> : null}
                    {models.map((m) => {
                      const active = sel?.ep === e.id && sel.model === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          disabled={!m.on}
                          onPress={() => select(e.id, m.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: m.on ? 1 : 0.65 }}
                        >
                          <Icon name={active ? 'check-circle' : 'circle'} size={20} color={active ? c.accent : c.muted} />
                          <T ltr size={13.5} style={{ flex: 1 }} numberOfLines={1} weight={active ? 'semibold' : 'regular'}>{m.id}</T>
                          <Switch value={m.on} onValueChange={(v) => toggleModel(e.id, m.id, v)} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
      <EndpointForm key={adding ? 'open' : 'closed'} visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}
