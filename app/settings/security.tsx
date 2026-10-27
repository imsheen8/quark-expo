import { useEffect, useState } from 'react';
import { Dialog, Field, Group, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { biometricAvailable, clearPin, getBio, hasPin, setBio, setPin, verifyPin } from '../../src/lib/security';
import { toast } from '../../src/store/data';

type Mode = null | 'set' | 'remove' | 'change-old';

export default function Security() {
  const [has, setHas] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [bio, setBioState] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [oldOk, setOldOk] = useState(false);

  const load = async () => {
    setHas(await hasPin());
    setBioOk(await biometricAvailable());
    setBioState(await getBio());
  };
  useEffect(() => {
    load();
  }, []);

  const close = () => {
    setMode(null);
    setV1('');
    setV2('');
    setOldOk(false);
  };

  const submit = async () => {
    if (mode === 'remove') {
      if (!(await verifyPin(v1))) return toast('الرمز غير صحيح');
      await clearPin();
      toast('أُزيل القفل');
    } else if (mode === 'change-old' && !oldOk) {
      if (!(await verifyPin(v1))) return toast('الرمز غير صحيح');
      setOldOk(true);
      setV1('');
      return;
    } else {
      if (!/^\d{4}$/.test(v1)) return toast('الرمز يجب أن يكون 4 أرقام');
      if (v1 !== v2) return toast('الرمزان غير متطابقين');
      await setPin(v1);
      toast('تم تفعيل القفل');
    }
    close();
    load();
  };

  const creating = mode === 'set' || (mode === 'change-old' && oldOk);

  return (
    <Screen title="الأمان">
      <Group footer="يُطلب الرمز عند فتح التطبيق وعند العودة إليه بعد غيابه لأكثر من 20 ثانية. الرمز يُخزَّن مُجزَّأً في مخزن النظام الآمن.">
        {has ? (
          <>
            <Row icon="refresh-cw" title="تغيير الرمز" onPress={() => setMode('change-old')} />
            {bioOk ? <Row icon="unlock" title="الفتح بالبصمة / الوجه" chevron={false} right={<Switch value={bio} onValueChange={async (v) => { await setBio(v); setBioState(v); }} />} /> : null}
            <Row icon="trash-2" title="إزالة القفل" danger onPress={() => setMode('remove')} />
          </>
        ) : (
          <Row icon="lock" title="تفعيل رمز القفل" sub="4 أرقام" onPress={() => setMode('set')} />
        )}
      </Group>
      <T size={12} color="muted">تنبيه: لا توجد طريقة لاستعادة الرمز إن نسيته؛ ستحتاج لإعادة تثبيت التطبيق (ويُحذف محتواه).</T>
      <Dialog
        visible={mode !== null}
        title={mode === 'remove' ? 'أدخل الرمز الحالي' : creating ? 'اختر رمزًا جديدًا' : 'أدخل الرمز الحالي'}
        onClose={close}
        actions={[{ title: 'تأكيد', onPress: submit }, { title: 'إلغاء', onPress: close }]}
      >
        <Field value={v1} onChangeText={(t) => setV1(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} ltr placeholder="••••" autoFocus />
        {creating ? <Field value={v2} onChangeText={(t) => setV2(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} ltr placeholder="أعد إدخال الرمز" /> : null}
      </Dialog>
    </Screen>
  );
}
