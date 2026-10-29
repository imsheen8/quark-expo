import { Pressable, View } from 'react-native';
import { Segmented } from '../../src/components/ui/panels';
import { haptic, Icon, Screen, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';
import { useColors, useMode } from '../../src/theme';
import { buildColors, THEMES, validThemeId, type Mode } from '../../src/theme/themes';

/** بطاقة ثيم: شاشة مصغّرة بألوانه الحقيقية */
function ThemeCard({ mode, id, name, selected, onPress }: { mode: Mode; id: string; name: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const t = buildColors(mode, THEMES.find((x) => x.mode === mode && x.id === id));
  const bar = (w: string, op: number) => (
    <View style={{ height: 4, width: w as any, borderRadius: 2, backgroundColor: t.text, opacity: op }} />
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={name} style={{ width: '48%' }}>
      <View style={{ padding: 3, borderRadius: 20, borderWidth: 2, borderColor: selected ? t.accent : 'transparent' }}>
        <View
          style={{
            height: 118, borderRadius: 16, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border,
            padding: 10, justifyContent: 'space-between', overflow: 'hidden',
          }}
        >
          <View style={{ width: '64%', alignSelf: 'flex-start', backgroundColor: t.bubble, borderRadius: 10, borderTopStartRadius: 3, paddingVertical: 7, paddingHorizontal: 8, gap: 4 }}>
            {bar('90%', 0.55)}
            {bar('55%', 0.55)}
          </View>
          <View style={{ gap: 4, paddingHorizontal: 2 }}>
            {bar('88%', 0.3)}
            {bar('60%', 0.3)}
          </View>
          <View style={{ height: 24, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingStart: 8, paddingEnd: 4 }}>
            {bar('34%', 0.25)}
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t.accent }} />
          </View>
        </View>
        {selected ? (
          <View style={{ position: 'absolute', top: 10, end: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={13} color={t.onAccent} />
          </View>
        ) : null}
      </View>
      <T size={13} weight={selected ? 'semibold' : 'regular'} color={selected ? 'text' : 'text2'} style={{ textAlign: 'center', marginTop: 6 }}>{name}</T>
    </Pressable>
  );
}

export default function Appearance() {
  const { theme, fontSize, themeSel, patch } = useSettings();
  const mode = useMode();
  const sel = validThemeId(mode, themeSel[mode]);
  const list = THEMES.filter((t) => t.mode === mode);
  return (
    <Screen title="المظهر">
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="semibold" color="muted" style={{ marginHorizontal: 4 }}>وضع الألوان</T>
        <Segmented
          value={theme}
          onChange={(k) => patch({ theme: k })}
          items={[
            { key: 'auto', label: 'تلقائي', icon: 'smartphone' },
            { key: 'light', label: 'فاتح', icon: 'sun' },
            { key: 'dark', label: 'داكن', icon: 'moon' },
          ]}
        />
      </View>
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="semibold" color="muted" style={{ marginHorizontal: 4 }}>الثيمات</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
          {list.map((t) => (
            <ThemeCard
              key={t.id}
              mode={mode}
              id={t.id}
              name={t.name}
              selected={sel === t.id}
              onPress={() => { haptic(); patch({ themeSel: { ...themeSel, [mode]: t.id } }); }}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="semibold" color="muted" style={{ marginHorizontal: 4 }}>حجم الخط</T>
        <Segmented
          value={fontSize}
          onChange={(k) => patch({ fontSize: k })}
          items={[
            { key: 'sm', label: 'صغير' },
            { key: 'md', label: 'متوسط' },
            { key: 'lg', label: 'كبير' },
          ]}
        />
      </View>
    </Screen>
  );
}
