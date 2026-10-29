import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useColors } from '../theme';
import { Icon, Sheet, T, haptic } from './ui/kit';

export interface Opt<K extends string> { key: K; label: string }

/** قائمة منسدلة: زر بحدّ يعرض القيمة الحالية، وتفتح ورقة سفلية بالخيارات */
export function SelectBox<K extends string>({ value, options, onChange, title, style, chevronFirst }: {
  value: K; options: Opt<K>[]; onChange: (k: K) => void; title: string; style?: object;
  /** السهم قبل النص (يمين الخانة في RTL) بدل نهايتها */
  chevronFirst?: boolean;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.key === value);
  return (
    <>
      <Pressable
        onPress={() => { haptic(); setOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }, style]}
      >
        {chevronFirst ? <Icon name="chevron-down" size={18} color={c.muted} /> : null}
        <T size={14.5} weight="medium" style={{ flex: 1 }} numberOfLines={1}>{cur?.label ?? '—'}</T>
        {chevronFirst ? null : <Icon name="chevron-down" size={18} color={c.muted} />}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 4 }}>
          {options.map((o) => {
            const on = o.key === value;
            return (
              <Pressable
                key={o.key}
                onPress={() => { haptic(); onChange(o.key); setOpen(false); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, height: 48, borderRadius: 12, backgroundColor: on ? c.accentSoft : pressed ? c.surface2 : 'transparent' })}
              >
                <T size={15} weight={on ? 'semibold' : 'regular'} color={on ? 'accent' : 'text'} style={{ flex: 1 }}>{o.label}</T>
                {on ? <Icon name="check" size={18} color={c.accent} /> : <View style={{ width: 18 }} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}
