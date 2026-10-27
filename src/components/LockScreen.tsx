import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { biometricAvailable, biometricUnlock, getBio, verifyPin } from '../lib/security';
import { useUi } from '../store/data';
import { useColors } from '../theme';
import { Icon, T } from './ui/kit';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

export function LockScreen() {
  const c = useColors();
  const ins = useSafeAreaInsets();
  const setLocked = useUi((s) => s.setLocked);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [bio, setBio] = useState(false);

  useEffect(() => {
    (async () => {
      if ((await getBio()) && (await biometricAvailable())) {
        setBio(true);
        if (await biometricUnlock()) setLocked(false);
      }
    })();
  }, [setLocked]);

  useEffect(() => {
    if (pin.length < 4) return;
    (async () => {
      if (await verifyPin(pin)) setLocked(false);
      else {
        setErr(true);
        setTimeout(() => {
          setPin('');
          setErr(false);
        }, 500);
      }
    })();
  }, [pin, setLocked]);

  const press = async (k: string) => {
    if (err) return;
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (k === 'bio') {
      if (bio && (await biometricUnlock())) setLocked(false);
    } else setPin((p) => (p.length < 4 ? p + k : p));
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, zIndex: 900, alignItems: 'center', justifyContent: 'center', paddingTop: ins.top, paddingBottom: ins.bottom }]}>
      <Icon name="lock" size={34} color={c.accent} />
      <T weight="bold" size={20} style={{ marginTop: 14 }}>QUARK AI مقفل</T>
      <T color="muted" size={13.5} style={{ marginTop: 4 }}>أدخل رمز الأمان</T>
      <View style={{ flexDirection: 'row', gap: 14, marginVertical: 28 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: err ? c.danger : c.accent, backgroundColor: i < pin.length ? (err ? c.danger : c.accent) : 'transparent' }} />
        ))}
      </View>
      <View style={{ width: 270, flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', direction: 'ltr' }}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => press(k)}
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
