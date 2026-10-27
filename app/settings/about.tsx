import Constants from 'expo-constants';
import { Linking, View } from 'react-native';
import { Card, Group, Row, Screen, T } from '../../src/components/ui/kit';

export default function About() {
  return (
    <Screen title="حول التطبيق">
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 14 }}>
        <T weight="bold" size={32} color="accent" style={{ letterSpacing: 3 }}>QUARK AI</T>
        <T color="muted" size={13}>الإصدار {Constants.expoConfig?.version ?? '1.0.0'} · Expo / React Native</T>
      </View>
      <Card>
        <T size={14} color="text2">
          تطبيق محادثة بالذكاء الاصطناعي يتصل مباشرة بالمزوّد الذي تختاره (OpenAI، Anthropic، Gemini، OpenRouter، Ollama وغيرها). مفاتيحك ومحادثاتك تبقى على جهازك.
        </T>
      </Card>
      <Group>
        <Row icon="user" title="المطوّر" sub="شين (sheen)" chevron={false} />
        <Row icon="file-text" title="الرخصة" sub="AGPL-3.0-only" onPress={() => Linking.openURL('https://www.gnu.org/licenses/agpl-3.0.html')} />
      </Group>
    </Screen>
  );
}
