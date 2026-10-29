import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { capVision, type ModelRef } from '../api/defaultsCore';
import { shortModel } from '../lib/util';
import { useSettings } from '../store/settings';
import { useColors } from '../theme';
import { Empty, Field, Icon, Sheet, T, haptic } from './ui/kit';

/** اختيار نموذج (نقطة اتصال + نموذج) أو «بلا اختيار». يُستخدم في صفحة النماذج التلقائية. */
export function ModelSelect({
  label, value, onChange, empty, vision, last,
}: { label: string; value: ModelRef | null; onChange: (v: ModelRef | null) => void; empty: string; vision?: boolean; last?: boolean }) {
  const c = useColors();
  const endpoints = useSettings((s) => s.endpoints);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ep = value ? endpoints.find((e) => e.id === value.ep) : null;
  const missing = !!value && (!ep || !ep.enabled);

  const groups = useMemo(
    () =>
      endpoints
        .filter((e) => e.enabled)
        .map((e) => ({ e, models: e.models.filter((m) => m.on && m.id.toLowerCase().includes(q.trim().toLowerCase())) }))
        .filter((g) => g.models.length),
    [endpoints, q],
  );

  return (
    <>
      <Pressable
        onPress={() => { haptic(); setOpen(true); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: pressed ? c.surface3 : c.surface2, borderWidth: 1, borderColor: missing ? c.danger : c.border })}
        accessibilityLabel={label}
      >
        <View style={{ flex: 1 }}>
          <T ltr={!!value} size={14} weight={value ? 'medium' : 'regular'} color={value ? (missing ? 'danger' : 'text') : 'muted'} numberOfLines={1}>
            {value ? shortModel(value.model) : empty}
          </T>
          {value ? <T size={11.5} color={missing ? 'danger' : 'muted'} numberOfLines={1}>{missing ? 'غير متاح — فعّل نقطة الاتصال أو غيّره' : ep?.label}</T> : null}
        </View>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityLabel="إزالة">
            <Icon name="x" size={16} color={c.muted} />
          </Pressable>
        ) : (
          <Icon name="chevron-down" size={16} color={c.muted} />
        )}
      </Pressable>
      <Sheet visible={open} onClose={() => { setOpen(false); setQ(''); }} title={label} full>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Field placeholder="ابحث…" value={q} onChangeText={setQ} ltr />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => { onChange(null); setOpen(false); }} style={{ padding: 12, borderRadius: 12, backgroundColor: !value ? c.accentSoft : c.surface, borderWidth: 1, borderColor: !value ? c.accent : c.border }}>
            <T size={14} weight={!value ? 'semibold' : 'regular'}>{empty}</T>
          </Pressable>
          {groups.length === 0 ? <Empty icon="cpu" title="لا توجد نماذج مفعّلة" sub="أضف نقطة اتصال وفعّل النماذج من صفحة «النماذج»." /> : null}
          {groups.map(({ e, models }) => (
            <View key={e.id} style={{ gap: 6 }}>
              <T size={12.5} weight="semibold" color="muted">{e.label}</T>
              {models.map((m) => {
                const on = value?.ep === e.id && value.model === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => { haptic(); onChange({ ep: e.id, model: m.id }); setOpen(false); setQ(''); }}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: on ? c.accentSoft : pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: on ? c.accent : c.border })}
                  >
                    <T ltr size={14} weight={on ? 'semibold' : 'regular'} style={{ flex: 1 }} numberOfLines={1}>{m.id}</T>
                    {vision && capVision(m.id) ? <T size={12} color="accent">◉ رؤية</T> : null}
                    {on ? <Icon name="check" size={18} color={c.accent} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}
