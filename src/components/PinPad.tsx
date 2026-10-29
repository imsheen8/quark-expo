import { Pressable, View } from 'react-native';
import { useColors } from '../theme';
import { Icon, T, type IconName } from './ui/kit';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

/** لوحة إدخال الرمز المشتركة بين شاشة القفل وشاشة إعداد القفل (نفس التصميم). */
export function PinPad({ title, sub, pin, err, bio, onKey, icon = 'lock' }: {
  title: string; sub?: string; pin: string; err?: boolean; bio?: boolean; onKey: (k: string) => void; icon?: IconName;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={34} color={c.accent} />
      <T weight="bold" size={20} style={{ marginTop: 14 }}>{title}</T>
      <T color={err ? 'danger' : 'muted'} size={13.5} style={{ marginTop: 4, minHeight: 20 }}>{sub ?? ''}</T>
      <View style={{ flexDirection: 'row', gap: 14, marginVertical: 28 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: err ? c.danger : c.accent, backgroundColor: i < pin.length ? (err ? c.danger : c.accent) : 'transparent' }} />
        ))}
      </View>
      <View style={{ width: 270, flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', direction: 'ltr' }}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => onKey(k)}
            disabled={k === 'bio' && !bio}
            style={({ pressed }) => ({ width: 78, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'bio' && !bio ? 'transparent' : pressed ? c.surface3 : c.surface2 })}
          >
            {k === 'del' ? <Icon name="delete" size={22} color={c.text} /> : k === 'bio' ? (bio ? <Icon name="unlock" size={22} color={c.accent} /> : null) : <T size={24} weight="medium">{k}</T>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
