import { View } from 'react-native';
import { DEFAULT_SYSTEM } from '../../src/api/providers';
import { Button, Chip, Field, Group, Row, Screen, Switch, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';

export default function General() {
  const s = useSettings();
  return (
    <Screen title="عام">
      <View style={{ gap: 8 }}>
        <Field label="موجّه النظام (System Prompt)" multiline value={s.systemPrompt} onChangeText={(t) => s.patch({ systemPrompt: t })} inputStyle={{ minHeight: 120 }} />
        <Button title="استعادة الافتراضي" kind="ghost" small onPress={() => s.patch({ systemPrompt: DEFAULT_SYSTEM })} style={{ alignSelf: 'flex-start' }} />
      </View>
      <Group>
        <Row icon="type" title="عنوان تلقائي للمحادثات" sub="يولّد النموذج عنوانًا بعد أول رد" chevron={false} right={<Switch value={s.autoTitle} onValueChange={(v) => s.patch({ autoTitle: v })} />} />
        <Row icon="smartphone" title="اهتزاز خفيف" chevron={false} right={<Switch value={s.haptics} onValueChange={(v) => s.patch({ haptics: v })} />} />
        <Row icon="film" title="انميشن الدخول" sub="يظهر عند فتح التطبيق" chevron={false} right={<Switch value={s.introOn} onValueChange={(v) => s.patch({ introOn: v })} />} />
      </Group>
      <View style={{ gap: 8 }}>
        <T size={12.5} weight="semibold" color="muted">التفكير (Gemini / Ollama)</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="افتراضي النموذج" active={s.thinking === 'auto'} onPress={() => s.patch({ thinking: 'auto' })} />
          <Chip label="تشغيل" active={s.thinking === 'on'} onPress={() => s.patch({ thinking: 'on' })} />
          <Chip label="إيقاف" active={s.thinking === 'off'} onPress={() => s.patch({ thinking: 'off' })} />
        </View>
        <T size={12} color="muted">تظهر أفكار النماذج التي تُرسلها (DeepSeek، Claude، Gemini، وسوم think) في كتلة قابلة للطيّ فوق الرد.</T>
      </View>
    </Screen>
  );
}
