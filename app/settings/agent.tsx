import { useRouter } from 'expo-router';
import { AG_TOOLS } from '../../src/api/agentCore';
import { Chip, Group, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';
import { View } from 'react-native';

export default function AgentSettings() {
  const ag = useSettings((s) => s.agent);
  const patch = useSettings((s) => s.patch);
  const router = useRouter();
  const set = (p: Partial<typeof ag>) => patch({ agent: { ...ag, ...p } });
  const rows = (ws: boolean) => Object.entries(AG_TOOLS).filter(([, t]) => (t.group === 'ws') === ws).map(([k, t]) => (
    <Row key={k} title={t.label} sub={t.desc.slice(0, 70) + '…'} chevron={false} right={<Switch value={ag.tools[k] !== false} onValueChange={(v) => set({ tools: { ...ag.tools, [k]: v } })} />} />
  ));
  return (
    <Screen title="وضع الوكيل">
      <T size={13} color="text2">يفعَّل الوضع من زر + في المحادثة. الوكيل يبني ويكتب ملفات مشروع حقيقية داخل مساحة عمل معزولة، ويشغّل الفحص ويصلح أخطاءه بنفسه، وينفّذ أدوات أخرى بالتتابع. يطلب موافقتك على الإجراءات التي تغيّر شيئًا خارج مساحة العمل، خاصةً بعد قراءته محتوى من الويب (حماية من حقن التعليمات).</T>
      <T size={13} weight="medium">الحد الأقصى للخطوات (استدعاءات الأدوات في المهمة الواحدة)</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[8, 15, 25, 40, 60].map((n) => <Chip key={n} label={String(n)} active={ag.maxSteps === n} onPress={() => set({ maxSteps: n })} />)}</View>
      <T size={12} color="muted">بناء تطبيق كامل يحتاج عادةً 20 خطوة فأكثر. إن توقف الوكيل عند الحد فاكتب «كمّل» وسيتابع من حيث وصل.</T>
      <Group title="مساحة العمل">
        <Row icon="folder" title="مشاريع الوكيل" sub="الملفات التي بناها الوكيل: عرض، معاينة، تصدير zip، حذف" onPress={() => router.push('/workspace' as any)} />
      </Group>
      <Group title="الأداء">
        <Row title="استدعاء الأدوات الأصلي" sub="مع OpenAI وAnthropic يستعمل واجهة الأدوات الرسمية (أدق) وإلا يرجع تلقائيًا للكتل النصية" chevron={false} right={<Switch value={ag.native !== false} onValueChange={(v) => set({ native: v })} />} />
        <Row title="تنفيذ متوازٍ" sub="الأدوات المستقلة (بحث، قراءة صفحات، حساب) تُنفَّذ معًا لتسريع المهام" chevron={false} right={<Switch value={ag.parallel !== false} onValueChange={(v) => set({ parallel: v })} />} />
      </Group>
      <T size={13} weight="medium">الموافقات</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="ذكية" active={ag.approval === 'smart'} onPress={() => set({ approval: 'smart' })} />
        <Chip label="صارمة (كل أداة)" active={ag.approval === 'strict'} onPress={() => set({ approval: 'strict' })} />
      </View>
      <Group title="أدوات المشروع" footer="تعمل داخل مساحة معزولة في التطبيق ولا تلمس بياناتك، لذلك لا تطلب موافقة في أي نمط.">{rows(true)}</Group>
      <Group title="الأدوات">{rows(false)}</Group>
    </Screen>
  );
}
