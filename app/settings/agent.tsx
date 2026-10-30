import { AG_TOOLS } from '../../src/api/agentCore';
import { Chip, Group, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';
import { View } from 'react-native';

export default function AgentSettings() {
  const ag = useSettings((s) => s.agent);
  const patch = useSettings((s) => s.patch);
  const set = (p: Partial<typeof ag>) => patch({ agent: { ...ag, ...p } });
  return (
    <Screen title="وضع الوكيل">
      <T size={13} color="text2">يفعَّل الوضع من زر + في المحادثة. الوكيل ينفّذ أدوات بالتتابع ويطلب موافقتك على الإجراءات التي تغيّر شيئًا، خاصةً بعد قراءته محتوى من الويب (حماية من حقن التعليمات).</T>
      <T size={13} weight="medium">الحد الأقصى للخطوات</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>{[4, 8, 12, 20].map((n) => <Chip key={n} label={String(n)} active={ag.maxSteps === n} onPress={() => set({ maxSteps: n })} />)}</View>
      <Group title="الأداء">
        <Row title="استدعاء الأدوات الأصلي" sub="مع OpenAI وAnthropic يستعمل واجهة الأدوات الرسمية (أدق) وإلا يرجع تلقائيًا للكتل النصية" chevron={false} right={<Switch value={ag.native !== false} onValueChange={(v) => set({ native: v })} />} />
        <Row title="تنفيذ متوازٍ" sub="الأدوات المستقلة (بحث، قراءة صفحات، حساب) تُنفَّذ معًا لتسريع المهام" chevron={false} right={<Switch value={ag.parallel !== false} onValueChange={(v) => set({ parallel: v })} />} />
      </Group>
      <T size={13} weight="medium">الموافقات</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="ذكية" active={ag.approval === 'smart'} onPress={() => set({ approval: 'smart' })} />
        <Chip label="صارمة (كل أداة)" active={ag.approval === 'strict'} onPress={() => set({ approval: 'strict' })} />
      </View>
      <Group title="الأدوات">
        {Object.entries(AG_TOOLS).map(([k, t]) => (
          <Row key={k} title={t.label} sub={t.desc.slice(0, 70) + '…'} chevron={false} right={<Switch value={ag.tools[k] !== false} onValueChange={(v) => set({ tools: { ...ag.tools, [k]: v } })} />} />
        ))}
      </Group>
    </Screen>
  );
}
