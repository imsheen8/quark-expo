import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { biometricAvailable, biometricUnlock, getBio, verifyPin } from '../lib/security';
import { useUi } from '../store/data';
import { useColors } from '../theme';
import { PinPad } from './PinPad';

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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, zIndex: 900, paddingTop: ins.top, paddingBottom: ins.bottom }]}>
      <PinPad title="QUARK AI مقفل" sub="أدخل رمز الأمان" pin={pin} err={err} bio={bio} onKey={press} />
    </View>
  );
}
