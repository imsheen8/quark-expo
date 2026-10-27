import { useEffect, useState } from 'react';
import { syncNow } from '../../src/api/sync';
import { PLAN_LABEL, PLAN_LIMITS, signedIn, syncInfo } from '../../src/api/managed';
import { Button, Card, Group, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { useRouter } from 'expo-router';

export default function Cloud() {
  const r = useRouter();
  const sync = useSettings((s) => s.sync);
  const plan = useSettings((s) => s.managed.plan);
  const patch = useSettings((s) => s.patch);
  const [info, setInfo] = useState<{ used: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (signedIn()) void syncInfo().then((x) => x?.s === 200 && setInfo(x.j)); }, [sync.last]);
  const go = async () => { setBusy(true); const x = await syncNow(); toast(x.msg); setBusy(false); };
  if (!signedIn()) return (
    <Screen title="المزامنة السحابية">
      <Card style={{ gap: 8 }}>
        <T size={13} color="text2">المزامنة تحتاج تسجيل الدخول بحساب QUARK.</T>
        <Button title="الذهاب إلى الاشتراك" onPress={() => r.push('/plan')} />
      </Card>
    </Screen>
  );
  return (
    <Screen title="المزامنة السحابية">
      <Card style={{ gap: 4 }}>
        <T size={13} color="muted">المساحة ({PLAN_LABEL[plan] ?? 'مجاني'} · {PLAN_LIMITS[plan]?.cloudMb ?? 5} MB)</T>
        <T size={16} weight="bold">{info ? `${(info.used / 1048576).toFixed(2)} / ${(info.quota / 1048576).toFixed(0)} MB` : '—'}</T>
        <T size={12} color="muted">آخر مزامنة: {sync.last ? new Date(sync.last).toLocaleString('ar') : 'لم تتم بعد'}</T>
      </Card>
      <Group>
        <Row icon="cloud" title="تفعيل المزامنة" chevron={false} right={<Switch value={sync.on} onValueChange={(v) => patch({ sync: { ...sync, on: v } })} />} />
        <Row icon="refresh-cw" title="مزامنة تلقائية بعد التعديل" chevron={false} right={<Switch value={sync.auto} onValueChange={(v) => patch({ sync: { ...sync, auto: v } })} />} />
      </Group>
      <Button title="زامن الآن" icon="refresh-cw" onPress={go} loading={busy} />
      <T size={12} color="muted">تُزامَن المحادثات والمكتبة والذاكرة والمهام (بلا صور ولا تشفير بكلمة سر). تطبيق الويب الأصلي يتجاهل هذه البيانات ولا يمسّ بياناته، لكن رفعه قد يستبدل نسخة هذا التطبيق، فزامن بعده. الدمج يعتمد الأحدث تعديلًا.</T>
    </Screen>
  );
}
