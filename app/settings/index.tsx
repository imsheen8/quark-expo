import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, IconButton, Icon, RTL, Row, Screen, T } from '../../src/components/ui/kit';
import { versionLabel } from '../../src/lib/appInfo';
import { useColors } from '../../src/theme';
import { useMemory, useSkills } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';

export default function SettingsHome() {
  const r = useRouter();
  const c = useColors();
  const ins = useSafeAreaInsets();
  const [info, setInfo] = useState(false);
  const eps = useSettings((s) => s.endpoints.length);
  const mem = useMemory((s) => s.items.length);
  const skillsN = useSkills((s) => s.items.length);
  const name = useSettings((s) => s.profile.nick || s.profile.name);
  return (
    <Screen title="الإعدادات" right={<IconButton name="info" onPress={() => setInfo(true)} label="حول التطبيق" />}>
      <Group title="الاتصال">
        <Row icon="key" title="المفاتيح ونقاط الاتصال" sub={`${eps} نقطة`} onPress={() => r.push('/settings/endpoints')} />
      </Group>
      <Group title="الأدوات الذكية">
        <Row icon="search" title="البحث" sub="بحث الويب والبحث العميق" onPress={() => r.push('/settings/web')} />
        <Row icon="tool" title="وضع الوكيل" sub="الأدوات والموافقات" onPress={() => r.push('/settings/agent')} />
        <Row icon="link" title="التكاملات" sub="خدمات REST وWebhooks" onPress={() => r.push('/settings/integrations')} />
        <Row icon="mail" title="البريد" sub="البوابة والحسابات" onPress={() => r.push('/settings/mail')} />
      </Group>
      <Group title="التخصيص">
        <Row icon="sliders" title="التخصيص" sub="التعليمات · معاملات التوليد" onPress={() => r.push('/settings/personalize')} />
        <Row icon="user" title="الملف الشخصي" sub={name || 'الاسم واللقب'} onPress={() => r.push('/settings/profile')} />
        <Row icon="message-square" title="عام" sub="موجّه النظام · العنوان التلقائي · التفكير" onPress={() => r.push('/settings/general')} />
        <Row icon="database" title="الذاكرة" sub={`${mem} ذكرى`} onPress={() => r.push('/memory')} />
        <Row icon="headphones" title="الصوت" sub="القراءة والتعرّف على الكلام والأصوات" onPress={() => r.push('/settings/voice')} />
        <Row icon="git-branch" title="النماذج التلقائية" sub="نموذج لكل مهمة مع بدائل" onPress={() => r.push('/settings/defaults')} />
        <Row icon="zap" title="إعدادات المهارات" sub={`المطابقة التلقائية · ${skillsN} مهارة`} onPress={() => r.push('/settings/skills')} />
        <Row icon="droplet" title="المظهر" sub="الثيمات وحجم الخط" onPress={() => r.push('/settings/appearance')} />
      </Group>
      <Group title="الأمان والبيانات">
        <Row icon="lock" title="الأمان" sub="رمز القفل والبصمة" onPress={() => r.push('/settings/security')} />
        <Row icon="bar-chart-2" title="الإحصائيات" onPress={() => r.push('/stats')} />
        <Row icon="hard-drive" title="التخزين والنسخ الاحتياطي" onPress={() => r.push('/settings/data')} />
        <Row icon="alert-triangle" title="سجل الأخطاء" sub="أخطاء الاتصال والتوليد" onPress={() => r.push('/logs')} />
      </Group>
      <Modal visible={info} transparent animationType="fade" onRequestClose={() => setInfo(false)} statusBarTranslucent>
        <RTL>
          <Pressable style={{ flex: 1 }} onPress={() => setInfo(false)}>
            <View style={{ position: 'absolute', top: ins.top + 52, end: 12, width: 250, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, paddingVertical: 6, elevation: 12 }}>
              <Pressable onPress={() => { setInfo(false); r.push('/settings/about'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 46 }}>
                <Icon name="info" size={18} color={c.text2} /><T size={14.5}>حول التطبيق</T>
              </Pressable>
              <Pressable onPress={() => { setInfo(false); void Linking.openURL('https://www.gnu.org/licenses/agpl-3.0.html'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 46 }}>
                <Icon name="file-text" size={18} color={c.text2} /><T size={14.5}>الرخصة</T>
              </Pressable>
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
                <T size={12.5} color="muted">الإصدار</T>
                <T size={12.5} color="muted" ltr>{versionLabel()}</T>
              </View>
            </View>
          </Pressable>
        </RTL>
      </Modal>
    </Screen>
  );
}
