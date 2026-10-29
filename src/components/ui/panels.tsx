import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useColors } from '../../theme';
import { Divider, Icon, T, haptic, type IconName } from './kit';

/** بطاقة كبيرة بعنوان وأيقونة (مثل «إضافة نماذج» و«النماذج المضافة») */
export function Panel({ icon, title, tag, sub, children }: { icon: IconName; title: string; tag?: string; sub?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={19} color={c.text2} />
        <T size={16.5} weight="bold">{title}</T>
        {tag ? <T size={12.5} color="muted">({tag})</T> : null}
      </View>
      <Divider />
      {sub ? <T size={13.5} color="text2">{sub}</T> : null}
      {children}
    </View>
  );
}

/** قسم قابل للطيّ برأس بسيط وسهم */
export function Collapse({ icon, title, defaultOpen = true, children }: { icon?: IconName; title: string; defaultOpen?: boolean; children: ReactNode }) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, overflow: 'hidden' }}>
      <Pressable
        onPress={() => { haptic(); setOpen(!open); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42 }}
      >
        {icon ? <Icon name={icon} size={16} color={c.text2} /> : null}
        <T size={13.5} weight="semibold" style={{ flex: 1 }}>{title}</T>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={17} color={c.muted} />
      </Pressable>
      {open ? (
        <View style={{ padding: 12, paddingTop: 4, gap: 10, borderTopWidth: 1, borderTopColor: c.border }}>{children}</View>
      ) : null}
    </View>
  );
}

/** شارة صغيرة (محلي / API / عدد النماذج) */
export function Badge({ text, tone = 'accent' }: { text: string; tone?: 'accent' | 'muted' | 'ok' }) {
  const c = useColors();
  const bg = tone === 'accent' ? c.accentSoft : tone === 'ok' ? 'rgba(47,158,90,0.16)' : c.surface2;
  const fg = tone === 'accent' ? c.accent : tone === 'ok' ? c.ok : c.text2;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
      <T size={11.5} weight="semibold" color={fg}>{text}</T>
    </View>
  );
}

/** شريط اختيار مقسّم (وضع الألوان / حجم الخط) */
export function Segmented<K extends string>({ items, value, onChange }: {
  items: { key: K; label: string; icon?: IconName }[]; value: K; onChange: (k: K) => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: c.surface2, borderRadius: 14, padding: 4 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => { haptic(); onChange(it.key); }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1, height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: on ? c.surface : 'transparent', borderWidth: 1, borderColor: on ? c.border : 'transparent',
            }}
          >
            {it.icon ? <Icon name={it.icon} size={16} color={on ? c.text : c.muted} /> : null}
            <T size={14} weight={on ? 'semibold' : 'regular'} color={on ? 'text' : 'text2'}>{it.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
