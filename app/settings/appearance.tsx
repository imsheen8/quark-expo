import { Pressable, View } from 'react-native';
import { Chip, Group, Screen, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';
import { useColors, useMode } from '../../src/theme';
import { buildColors, THEMES, type Mode } from '../../src/theme/themes';

function Swatches({ mode }: { mode: Mode }) {
  const c = useColors();
  const sel = useSettings((s) => s.themeSel[mode]);
  const patch = useSettings((s) => s.patch);
  const themeSel = useSettings((s) => s.themeSel);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, backgroundColor: c.surface }}>
      {THEMES.filter((t) => t.mode === mode).map((t) => {
        const col = buildColors(mode, t);
        const on = sel === t.id;
        return (
          <Pressable key={t.id} onPress={() => patch({ themeSel: { ...themeSel, [mode]: t.id } })} style={{ alignItems: 'center', gap: 6, width: 72 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: col.bg, borderWidth: on ? 2.5 : 1, borderColor: on ? c.accent : c.border, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 30, height: 18, borderRadius: 6, backgroundColor: col.surface2 }} />
              <View style={{ position: 'absolute', bottom: 6, end: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: col.accent }} />
            </View>
            <T size={11.5} color={on ? 'accent' : 'text2'} weight={on ? 'semibold' : 'regular'}>{t.name}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Appearance() {
  const { theme, fontSize, patch } = useSettings();
  const mode = useMode();
  return (
    <Screen title="المظهر">
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="semibold" color="muted">وضع الألوان</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="تلقائي" icon="smartphone" active={theme === 'auto'} onPress={() => patch({ theme: 'auto' })} />
          <Chip label="فاتح" icon="sun" active={theme === 'light'} onPress={() => patch({ theme: 'light' })} />
          <Chip label="داكن" icon="moon" active={theme === 'dark'} onPress={() => patch({ theme: 'dark' })} />
        </View>
      </View>
      <Group title={`ثيمات الوضع ${mode === 'dark' ? 'الداكن' : 'الفاتح'}`}>
        <Swatches mode={mode} />
      </Group>
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="semibold" color="muted">حجم الخط</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="صغير" active={fontSize === 'sm'} onPress={() => patch({ fontSize: 'sm' })} />
          <Chip label="متوسط" active={fontSize === 'md'} onPress={() => patch({ fontSize: 'md' })} />
          <Chip label="كبير" active={fontSize === 'lg'} onPress={() => patch({ fontSize: 'lg' })} />
        </View>
      </View>
    </Screen>
  );
}
