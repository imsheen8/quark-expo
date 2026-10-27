import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchMe, googleSignIn, loadPlans, PLAN_IDS, PLAN_LABEL, PLAN_LIMITS, redeemCode, signedIn, signOut, type MeInfo } from '../src/api/managed';
import { Button, Card, Field, Group, Row, Screen, T } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

export default function PlanScreen() {
  const c = useColors();
  const m = useSettings((s) => s.managed);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => { void loadPlans().then(() => bump((x) => x + 1)); if (signedIn()) void fetchMe().then(setMe); }, [m.token]);
  const login = async () => {
    setBusy(true);
    try { await googleSignIn(); toast('تم تسجيل الدخول'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const redeem = async () => {
    setBusy(true);
    const r = await redeemCode(code);
    toast(r.msg);
    if (r.ok) { setCode(''); setMe(await fetchMe()); }
    setBusy(false);
  };
  const plan = me?.pro ? me.plan || 'pro' : m.plan || 'free';
  return (
    <Screen title="الاشتراك" menu>
      <Card style={{ gap: 6 }}>
        <T size={13} color="muted">خطتك الحالية</T>
        <T size={22} weight="bold" color="accent">{PLAN_LABEL[plan] ?? 'مجاني'}</T>
        {me?.exp ? <T size={12.5} color="text2">تنتهي في {new Date(me.exp).toLocaleDateString('ar')}</T> : null}
        {me?.left != null ? <T size={12.5} color="text2">المتبقي اليوم: {me.left} من {me.limit}</T> : null}
      </Card>
      {signedIn() ? (
        <Group>
          <Row icon="user" title={m.name || m.email} sub={m.email} chevron={false} />
          <Row icon="log-out" title="تسجيل الخروج" onPress={signOut} danger />
        </Group>
      ) : (
        <Card style={{ gap: 8 }}>
          <T size={13} color="text2">سجّل الدخول بحساب Google لاستخدام نموذج QUARK المُدار وتفعيل الأكواد والمزامنة. (يحتاج نسخة Development Build؛ لا يعمل داخل Expo Go.)</T>
          <Button title="الدخول بـ Google" icon="log-in" onPress={login} loading={busy} />
        </Card>
      )}
      <Group title="الخطط">
        {PLAN_IDS.map((p) => (
          <Row key={p} icon={p === plan ? 'check-circle' : 'circle'} title={PLAN_LABEL[p]} sub={`${PLAN_LIMITS[p].limit} رسالة يوميًا · ${PLAN_LIMITS[p].cloudMb} MB سحابة`} chevron={false} />
        ))}
      </Group>
      <Card style={{ gap: 8 }}>
        <T size={14} weight="medium">تفعيل كود</T>
        <Field placeholder="XXXX-XXXX" ltr autoCapitalize="characters" value={code} onChangeText={setCode} />
        <Button title="تفعيل" kind="soft" onPress={redeem} disabled={!code.trim() || busy} />
      </Card>
      {me?.referral ? (
        <Card style={{ gap: 4 }}>
          <T size={14} weight="medium">الإحالة</T>
          {me.referral.code ? <T size={18} weight="bold" ltr selectable>{me.referral.code}</T> : null}
          <T size={12.5} color="text2">المدعوّون: {me.referral.invited ?? 0} · المكافآت: {me.referral.rewards ?? 0}</T>
        </Card>
      ) : null}
    </Screen>
  );
}
