import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { FONT } from '../theme/themes';

/** انميشن الشعار عند فتح التطبيق: حروف تظهر تباعًا ثم يتلاشى الغطاء. */
export function Intro({ onDone }: { onDone: () => void }) {
  const letters = 'QUARK'.split('');
  const vals = useRef(letters.map(() => new Animated.Value(0))).current;
  const sub = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.stagger(
        90,
        vals.map((v) => Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
      ),
      Animated.timing(sub, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(450),
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    seq.start(({ finished }) => finished && onDone());
    return () => seq.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', opacity: fade, zIndex: 1000 }]} pointerEvents="auto">
      <View style={{ flexDirection: 'row', direction: 'ltr' }}>
        {letters.map((l, i) => (
          <Animated.Text
            key={i}
            style={{
              color: i === 4 ? '#e07a5f' : '#f2f2f2', fontFamily: FONT.bold, fontSize: 52, letterSpacing: 4, opacity: vals[i],
              transform: [{ translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            }}
          >
            {l}
          </Animated.Text>
        ))}
      </View>
      <Animated.Text style={{ color: '#8b8b8b', fontFamily: FONT.medium, fontSize: 15, marginTop: 6, opacity: sub }}>مساعدك الذكي</Animated.Text>
    </Animated.View>
  );
}
