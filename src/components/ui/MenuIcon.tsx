import { View } from 'react-native';
import { useColors } from '../../theme';

/** أيقونة القائمة: ثلاثة خطوط متدرّجة الطول محاذاة للبداية */
export function MenuIcon({ size = 20 }: { size?: number }) {
  const c = useColors();
  const bar = (w: number) => <View style={{ width: size * w, height: 2, borderRadius: 1, backgroundColor: c.text }} />;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'flex-start', gap: 4.5 }}>
      {bar(1)}
      {bar(0.72)}
      {bar(0.46)}
    </View>
  );
}
