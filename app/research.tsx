import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import { runResearch, stopResearch } from '../src/api/engines';
import { Markdown } from '../src/components/chat/Markdown';
import { Button, Card, Empty, Field, Group, IconButton, Row, Screen, Sheet, T } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useResearch } from '../src/store/features';
import { relTime } from '../src/lib/util';
import { useColors } from '../src/theme';
import { ScrollView } from 'react-native';

export default function ResearchScreen() {
  const c = useColors();
  const items = useResearch((s) => s.items);
  const remove = useResearch((s) => s.remove);
  const [topic, setTopic] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const cur = items.find((x) => x.id === openId);
  const start = () => {
    if (!topic.trim()) return;
    void runResearch(topic.trim());
    setTopic('');
  };
  return (
    <Screen title="البحث العميق" menu>
      <T size={13} color="text2">يخطّط النموذج أسئلة فرعية، يبحث في الويب، يقرأ الصفحات ثم يكتب تقريرًا مع مصادر. يعمل والتطبيق مفتوح؛ قد يستغرق دقائق.</T>
      <Card style={{ gap: 10 }}>
        <Field placeholder="موضوع البحث…" value={topic} onChangeText={setTopic} multiline />
        <Button title="ابدأ البحث" icon="search" onPress={start} disabled={!topic.trim()} />
      </Card>
      {items.length === 0 ? <Empty icon="search" title="لا توجد أبحاث بعد" /> : (
        <Group>
          {items.map((r) => (
            <Row key={r.id} icon={r.status === 'run' ? 'loader' : r.status === 'done' ? 'file-text' : 'alert-circle'} title={r.topic} sub={(r.status === 'run' ? r.phase : r.status === 'done' ? `${r.sources.length} مصدر` : r.status === 'error' ? r.error : 'متوقف') + ' · ' + relTime(r.updated)} onPress={() => setOpenId(r.id)} />
          ))}
        </Group>
      )}
      <Sheet visible={!!cur} onClose={() => setOpenId(null)} title={cur?.topic} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {cur?.status === 'run' ? (
            <View style={{ gap: 10 }}>
              <ActivityIndicator color={c.accent} />
              <T size={13} color="text2" style={{ textAlign: 'center' }}>{cur.phase}</T>
              {cur.questions.map((q, i) => <T key={i} size={12.5} color="muted">• {q}</T>)}
              <Button title="إيقاف" kind="danger" onPress={() => stopResearch(cur.id)} />
            </View>
          ) : cur?.status === 'done' ? (
            <>
              <View style={{ flexDirection: 'row' }}>
                <IconButton name="copy" label="نسخ" onPress={async () => { await Clipboard.setStringAsync(cur.report); toast('تم النسخ'); }} />
                <IconButton name="share-2" label="مشاركة" onPress={() => Share.share({ message: cur.report })} />
                <IconButton name="trash-2" label="حذف" onPress={() => { remove(cur.id); setOpenId(null); }} />
              </View>
              <Markdown text={cur.report} />
            </>
          ) : cur ? (
            <>
              <T size={14} color="danger">{cur.error || 'توقف البحث.'}</T>
              <Button title="حذف" kind="danger" onPress={() => { remove(cur.id); setOpenId(null); }} />
            </>
          ) : null}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
