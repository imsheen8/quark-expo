import { useRouter } from 'expo-router';
import { Group, Row, Screen, T } from '../../src/components/ui/kit';
import { useMemory } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';

export default function SettingsHome() {
  const r = useRouter();
  const eps = useSettings((s) => s.endpoints.length);
  const mem = useMemory((s) => s.items.length);
  const name = useSettings((s) => s.profile.nick || s.profile.name);
  return (
    <Screen title="الإعدادات">
      <Group title="الاتصال">
        <Row icon="key" title="المفاتيح ونقاط الاتصال" sub={`${eps} نقطة`} onPress={() => r.push('/settings/endpoints')} />
        <Row icon="cpu" title="النماذج" sub="تفعيل النماذج واختيار الافتراضي" onPress={() => r.push('/models')} />
        <Row icon="sliders" title="معاملات التوليد" sub="Temperature · Top P · Max Tokens" onPress={() => r.push('/settings/params')} />
      </Group>
      <Group title="الأدوات الذكية">
        <Row icon="search" title="البحث العميق" sub="تقارير بمصادر" onPress={() => r.push('/research')} />
        <Row icon="clock" title="المهام المجدولة" onPress={() => r.push('/tasks')} />
        <Row icon="globe" title="بحث الويب" sub="المحرك والمفاتيح والبدائل" onPress={() => r.push('/settings/web')} />
        <Row icon="tool" title="وضع الوكيل" sub="الأدوات والموافقات" onPress={() => r.push('/settings/agent')} />
        <Row icon="link" title="التكاملات" sub="خدمات REST وWebhooks" onPress={() => r.push('/settings/integrations')} />
        <Row icon="mail" title="البريد" sub="البوابة والحسابات" onPress={() => r.push('/settings/mail')} />
      </Group>
      <Group title="الحساب">
        <Row icon="award" title="الاشتراك" sub="الخطة والأكواد" onPress={() => r.push('/plan')} />
        <Row icon="cloud" title="المزامنة السحابية" onPress={() => r.push('/settings/cloud')} />
      </Group>
      <Group title="التخصيص">
        <Row icon="user" title="الملف الشخصي" sub={name || 'الاسم والتفضيلات'} onPress={() => r.push('/settings/profile')} />
        <Row icon="message-square" title="عام" sub="موجّه النظام · العنوان التلقائي · التفكير" onPress={() => r.push('/settings/general')} />
        <Row icon="database" title="الذاكرة" sub={`${mem} ذكرى`} onPress={() => r.push('/memory')} />
        <Row icon="book-open" title="المكتبة" sub="القوالب والشخصيات" onPress={() => r.push('/library')} />
        <Row icon="droplet" title="المظهر" sub="الثيمات وحجم الخط" onPress={() => r.push('/settings/appearance')} />
      </Group>
      <Group title="الأمان والبيانات">
        <Row icon="lock" title="الأمان" sub="رمز القفل والبصمة" onPress={() => r.push('/settings/security')} />
        <Row icon="bar-chart-2" title="الإحصائيات" onPress={() => r.push('/stats')} />
        <Row icon="hard-drive" title="التخزين والنسخ الاحتياطي" onPress={() => r.push('/settings/data')} />
      </Group>
      <Group>
        <Row icon="info" title="حول التطبيق" onPress={() => r.push('/settings/about')} />
      </Group>
      <T size={12} color="muted" style={{ textAlign: 'center' }}>QUARK AI · بواسطة شين</T>
    </Screen>
  );
}
