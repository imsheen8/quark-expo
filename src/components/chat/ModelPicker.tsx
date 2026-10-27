import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { shortModel } from '../../lib/util';
import { useSettings } from '../../store/settings';
import { useColors } from '../../theme';
import { Empty, Field, Icon, Sheet, T, haptic, Button } from '../ui/kit';

export function ModelPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const router = useRouter();
  const { endpoints, sel, select } = useSettings();
  const [q, setQ] = useState('');
  const groups = useMemo(
    () =>
      endpoints
        .filter((e) => e.enabled)
        .map((e) => ({ e, models: e.models.filter((m) => m.on && m.id.toLowerCase().includes(q.trim().toLowerCase())) }))
        .filter((g) => g.models.length),
    [endpoints, q],
  );
  const custom = q.trim();
  const firstEp = endpoints.find((e) => e.enabled);

  const pick = (ep: string, model: string) => {
    haptic();
    select(ep, model);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="اختيار النموذج" full>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Field placeholder="ابحث أو اكتب معرّف نموذج مخصص…" value={q} onChangeText={setQ} ltr />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }} keyboardShouldPersistTaps="handled">
        {groups.length === 0 && !custom ? (
          <Empty icon="cpu" title="لا توجد نماذج مفعّلة" sub="أضف نقطة اتصال ثم فعّل النماذج من صفحة «النماذج»." />
        ) : null}
        {groups.map(({ e, models }) => (
          <View key={e.id} style={{ gap: 6 }}>
            <T size={12.5} weight="semibold" color="muted">{e.label}</T>
            {models.map((m) => {
              const on = sel?.ep === e.id && sel.model === m.id;
              return (
                <Pressable key={m.id} onPress={() => pick(e.id, m.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: on ? c.accentSoft : pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: on ? c.accent : c.border })}>
                  <T ltr size={14} weight={on ? 'semibold' : 'regular'} style={{ flex: 1 }} numberOfLines={1}>{m.id}</T>
                  {on ? <Icon name="check" size={18} color={c.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        {custom && firstEp ? (
          <Pressable onPress={() => { useSettings.getState().addModel(firstEp.id, custom); pick(firstEp.id, custom); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.accent }}>
            <Icon name="plus" size={16} color={c.accent} />
            <T size={13.5} color="accent" style={{ flex: 1 }}>استخدام «{shortModel(custom)}» على {firstEp.label}</T>
          </Pressable>
        ) : null}
        <Button title="إدارة النماذج ونقاط الاتصال" kind="soft" icon="settings" onPress={() => { onClose(); router.push('/models'); }} />
      </ScrollView>
    </Sheet>
  );
}
