import { View } from 'react-native';
import { SK_SENS, type SkSens } from '../../src/api/skillsCore';
import { Button, Chip, Group, IconButton, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { shareFile } from '../../src/lib/share';
import { toast, useSkills } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';

export default function SkillsSettings() {
  const { items, restoreStarters } = useSkills();
  const cfg = useSettings((s) => s.skills);
  const patch = useSettings((s) => s.patch);
  const setCfg = (p: Partial<typeof cfg>) => patch({ skills: { ...cfg, ...p } });
  const published = items.filter((s) => s.status === 'published').length;
  const exportAll = () =>
    shareFile('quark-skills.json', JSON.stringify({ format: 'quark-skills', version: 1, skills: items.map(({ name, description, when, body, tags, status }) => ({ name, description, when, body, tags, status })) }, null, 2), 'application/json').catch(() => toast('تعذّر التصدير'));
  return (
    <Screen title="إعدادات المهارات">
      <T size={13} color="text2">
        المهارة حزمة تعليمات (مثل «بريد مهني» أو «مراجعة كود») تُحقن تلقائيًا في سياق النموذج عندما يناسب طلبك وصفها. تُدار المهارات نفسها من المكتبة، وهنا إعدادات عملها فقط.
      </T>
      <T size={12} color="muted">
        {items.length} مهارة · {published} منشورة · {items.reduce((n, s) => n + s.uses, 0)} استخدامًا{cfg.enabled ? '' : ' · المطابقة التلقائية متوقفة'}
      </T>
      <Group>
        <Row icon="zap" title="المطابقة التلقائية" chevron={false} right={<Switch value={cfg.enabled} onValueChange={(v) => setCfg({ enabled: v })} />} />
        <Row icon="check-square" title="اعتماد المستخرجة تلقائيًا" sub="وإلا تُحفظ كمسودة لتراجعها" chevron={false} right={<Switch value={cfg.autoApprove} onValueChange={(v) => setCfg({ autoApprove: v })} />} />
        <Row icon="hash" title="أقصى عدد مهارات تُحقن" sub={`${cfg.max} في كل رد`} chevron={false}
          right={<View style={{ flexDirection: 'row' }}><IconButton name="minus" size={18} onPress={() => setCfg({ max: Math.max(1, cfg.max - 1) })} /><IconButton name="plus" size={18} onPress={() => setCfg({ max: Math.min(5, cfg.max + 1) })} /></View>} />
      </Group>
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="medium" color="muted">حساسية المطابقة</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(Object.keys(SK_SENS) as SkSens[]).map((k) => <Chip key={k} label={SK_SENS[k].l} active={cfg.sens === k} onPress={() => setCfg({ sens: k })} />)}
        </View>
      </View>
      <Button title="استعادة المهارات المدمجة" kind="ghost" icon="rotate-ccw" onPress={() => { const n = restoreStarters(); toast(n ? `أُعيدت ${n} مهارة` : 'كل المهارات المدمجة موجودة'); }} />
      <Button title="تصدير الكل (JSON)" kind="ghost" icon="share-2" onPress={exportAll} />
      <T size={12} color="muted">المهارات تُحفظ على هذا الجهاز (وتُزامَن مع حسابك إن فعّلت المزامنة). محتواها إرشادات تقرؤها النماذج التي تستخدمها، فلا تضع فيها أسرارًا.</T>
    </Screen>
  );
}
