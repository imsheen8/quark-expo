import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinPad } from '../../src/components/PinPad';
import { Group, IconButton, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { biometricAvailable, clearPin, getBio, hasPin, setBio, setPin, verifyPin } from '../../src/lib/security';
import { toast } from '../../src/store/data';
import { useColors } from '../../src/theme';

type Flow = { mode: 'set' | 'change' | 'remove'; step: 'old' | 'new' | 'confirm'; first?: string };

export default function Security() {
  const c = useColors();
  const ins = useSafeAreaInsets();
  const [has, setHas] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [bio, setBioState] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [entry, setEntry] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setHas(await hasPin());
    setBioOk(await biometricAvailable());
    setBioState(await getBio());
  };
  useEffect(() => { load(); }, []);

  const start = (mode: Flow['mode']) => { setEntry(''); setErr(''); setFlow({ mode, step: mode === 'set' ? 'new' : 'old' }); };
  const close = () => { setFlow(null); setEntry(''); setErr(''); };
  const fail = (msg: string, next?: Flow) => {
    setErr(msg);
    setTimeout(() => { setEntry(''); setErr(''); if (next) setFlow(next); }, 600);
  };

  useEffect(() => {
    if (!flow || entry.length < 4 || err) return;
    (async () => {
      if (flow.step === 'old') {
        if (!(await verifyPin(entry))) return fail('الرمز غير صحيح');
        if (flow.mode === 'remove') { await clearPin(); toast('أُزيل القفل'); close(); load(); return; }
        setEntry(''); setFlow({ mode: flow.mode, step: 'new' });
      } else if (flow.step === 'new') {
        const first = entry;
        setEntry(''); setFlow({ mode: flow.mode, step: 'confirm', first });
      } else {
        if (entry !== flow.first) return fail('الرمزان غير متطابقين', { mode: flow.mode, step: 'new' });
        await setPin(entry);
        toast('تم تفعيل القفل');
        close(); load();
      }
    })();
  }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: string) => {
    if (err) return;
    if (k === 'del') setEntry((p) => p.slice(0, -1));
    else if (k !== 'bio') setEntry((p) => (p.length < 4 ? p + k : p));
  };

  const head = !flow ? '' : flow.step === 'old' ? 'أدخل الرمز الحالي' : flow.step === 'new' ? 'اختر رمزًا جديدًا' : 'أعد إدخال الرمز';
  const sub = err || (!flow ? '' : flow.step === 'old' ? (flow.mode === 'remove' ? 'لتأكيد إزالة القفل' : 'للمتابعة بتغيير الرمز') : flow.step === 'new' ? '4 أرقام' : 'للتأكيد');

  return (
    <Screen title="الأمان">
      <Group footer="يُطلب الرمز عند فتح التطبيق وعند العودة إليه بعد غيابه لأكثر من 20 ثانية. الرمز يُخزَّن مُجزَّأً في مخزن النظام الآمن.">
        {has ? (
          <>
            <Row icon="refresh-cw" title="تغيير الرمز" onPress={() => start('change')} />
            {bioOk ? <Row icon="unlock" title="الفتح بالبصمة / الوجه" chevron={false} right={<Switch value={bio} onValueChange={async (v) => { await setBio(v); setBioState(v); }} />} /> : null}
            <Row icon="trash-2" title="إزالة القفل" danger onPress={() => start('remove')} />
          </>
        ) : (
          <Row icon="lock" title="تفعيل رمز القفل" sub="4 أرقام" onPress={() => start('set')} />
        )}
      </Group>
      <T size={12} color="muted">تنبيه: لا توجد طريقة لاستعادة الرمز إن نسيته؛ ستحتاج لإعادة تثبيت التطبيق (ويُحذف محتواه).</T>

      <Modal visible={!!flow} animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top, paddingBottom: ins.bottom }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 10, height: 56, alignItems: 'center' }}>
            <IconButton name="x" label="إغلاق" onPress={close} />
          </View>
          <PinPad title={head} sub={sub} pin={entry} err={!!err} onKey={press} />
        </View>
      </Modal>
    </Screen>
  );
}
