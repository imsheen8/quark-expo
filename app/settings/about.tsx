import { Linking, View } from 'react-native';
import { Group, Row, Screen, T } from '../../src/components/ui/kit';
import { osLabel, versionLabel } from '../../src/lib/appInfo';

export default function About() {
  return (
    <Screen title="حول التطبيق">
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 14 }}>
        <T weight="bold" size={32} color="accent" style={{ letterSpacing: 3 }}>QUARK AI</T>
        <T color="muted" size={13}>الإصدار {versionLabel()}</T>
      </View>
      <Group>
        <Row icon="smartphone" title="نظام التشغيل" sub={osLabel()} chevron={false} />
        <Row icon="user" title="المطوّر" sub="شين (Sheen)" chevron={false} />
        <Row icon="briefcase" title="الشركة" sub="Krazos" chevron={false} />
        <Row icon="shield" title="المعلومات القانونية" sub={`© ${new Date().getFullYear()} Krazos. جميع الحقوق محفوظة.`} chevron={false} />
        <Row icon="file-text" title="الرخصة" sub="AGPL-3.0-only" onPress={() => Linking.openURL('https://www.gnu.org/licenses/agpl-3.0.html')} />
      </Group>
    </Screen>
  );
}
