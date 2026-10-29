import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { stopResearch } from '../../api/engines';
import { relTime } from '../../lib/util';
import { toast } from '../../store/data';
import { useResearch } from '../../store/features';
import { useColors } from '../../theme';
import { Button, Group, IconButton, Row, Sheet, T } from '../ui/kit';
import { Markdown } from './Markdown';

/** بطاقة البحث العميق داخل المحادثة: تعرض التقدّم ثم عدد المصادر، وتفتح التقرير */
export function ResearchCard({ id, onDelete }: { id: string; onDelete?: () => void }) {
  const c = useColors();
  const r = useResearch((s) => s.items.find((x) => x.id === id));
  const [open, setOpen] = useState(false);
  if (!r) return <T size={13} color="muted">تم حذف هذا البحث.</T>;
  const sub = (r.status === 'run' ? r.phase : r.status === 'done' ? `${r.sources.length} مصدر` : r.status === 'error' ? r.error : 'متوقف') + ' · ' + relTime(r.updated);
  return (
    <>
      <Group>
        <Row icon={r.status === 'run' ? 'loader' : r.status === 'done' ? 'file-text' : 'alert-circle'} title={r.topic} sub={sub} onPress={() => setOpen(true)} />
      </Group>
      <Sheet visible={open} onClose={() => setOpen(false)} title={r.topic} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {r.status === 'run' ? (
            <View style={{ gap: 10 }}>
              <ActivityIndicator color={c.accent} />
              <T size={13} color="text2" style={{ textAlign: 'center' }}>{r.phase}</T>
              {r.questions.map((q, i) => <T key={i} size={12.5} color="muted">• {q}</T>)}
              <Button title="إيقاف" kind="danger" onPress={() => stopResearch(r.id)} />
            </View>
          ) : r.status === 'done' ? (
            <>
              <View style={{ flexDirection: 'row' }}>
                <IconButton name="copy" label="نسخ" onPress={async () => { await Clipboard.setStringAsync(r.report); toast('تم النسخ'); }} />
                <IconButton name="share-2" label="مشاركة" onPress={() => Share.share({ message: r.report })} />
                {onDelete ? <IconButton name="trash-2" label="حذف" onPress={() => { setOpen(false); onDelete(); }} /> : null}
              </View>
              <Markdown text={r.report} />
            </>
          ) : (
            <>
              <T size={14} color="danger">{r.error || 'توقف البحث.'}</T>
              {onDelete ? <Button title="حذف" kind="danger" onPress={() => { setOpen(false); onDelete(); }} /> : null}
            </>
          )}
        </ScrollView>
      </Sheet>
    </>
  );
}
