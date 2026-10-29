import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Dialog, Empty, Field, Header, Icon, IconButton, Sheet, T, haptic } from '../src/components/ui/kit';
import { exportLogs, fmtHead, viewLogs, type LogOrder, type LogView } from '../src/lib/logCore';
import { shareFile } from '../src/lib/share';
import { toast } from '../src/store/data';
import { useLogs } from '../src/store/logs';
import { useColors } from '../src/theme';
import { FONT } from '../src/theme/themes';

export default function Logs() {
  const c = useColors();
  const ins = useSafeAreaInsets();
  const items = useLogs((s) => s.items);
  const clear = useLogs((s) => s.clear);
  const [q, setQ] = useState('');
  const [order, setOrder] = useState<LogOrder>('new');
  const [errs, setErrs] = useState(false);
  const [filt, setFilt] = useState(false);
  const [ask, setAsk] = useState(false);
  const [tick, setTick] = useState(0);
  const { rows, badRegex } = useMemo(() => viewLogs(items, q, order, errs), [items, q, order, errs, tick]);

  const share = () => {
    if (!rows.length) return toast('لا سجلات للمشاركة');
    shareFile('quark-logs-' + new Date().toISOString().slice(0, 10) + '.txt', exportLogs(rows), 'text/plain').catch(() => toast('تعذّرت المشاركة'));
  };
  const color = (r: LogView) => (r.e.level === 'error' ? c.danger : r.e.level === 'warn' ? '#e5a23a' : c.accent);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top }}>
      <Header title="سجل الأخطاء" back />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: badRegex ? c.danger : c.border, borderRadius: 16, paddingStart: 14, paddingEnd: 4 }}>
          <Field style={{ flex: 1 }} inputStyle={{ borderWidth: 0, backgroundColor: 'transparent' }} placeholder="تصفية (regex)" value={q} onChangeText={setQ} ltr autoCapitalize="none" autoCorrect={false} />
          <IconButton name="sliders" active={order !== 'new' || errs} onPress={() => setFilt(true)} label="خيارات التصفية" />
        </View>
        <Pressable onPress={() => { haptic(); share(); }} accessibilityLabel="مشاركة" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="share" size={21} color={c.text} />
        </Pressable>
      </View>
      {badRegex ? <T size={11.5} color="danger" style={{ paddingHorizontal: 18, paddingBottom: 4 }}>تعبير غير صالح — يُبحث كنص عادي.</T> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.e.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 24, gap: 16, flexGrow: 1 }}
        ListEmptyComponent={<Empty icon="file-text" title={items.length ? 'لا نتائج مطابقة' : 'السجل فارغ'} sub={items.length ? undefined : 'تظهر هنا أخطاء الاتصال والتوليد والصوت والبحث عند حدوثها.'} />}
        renderItem={({ item: r }) => (
          <Pressable onLongPress={async () => { haptic(); await Clipboard.setStringAsync(`${fmtHead(r)}\n[${r.e.tag}]: ${r.e.msg}`); toast('تم نسخ السطر'); }}>
            <T size={11.5} color="muted" ltr style={{ fontFamily: FONT.mono }}>{fmtHead(r)}</T>
            <T size={14.5} ltr selectable style={{ fontFamily: FONT.mono, marginTop: 2 }}>
              <T size={14.5} ltr style={{ fontFamily: FONT.mono, color: color(r) }}>[{r.e.tag}]: </T>
              {r.e.msg}
            </T>
          </Pressable>
        )}
      />

      <Sheet visible={filt} onClose={() => setFilt(false)} title="خيارات التصفية">
        <View style={{ padding: 16, gap: 14 }}>
          <Button title="تحديث" icon="refresh-cw" kind="ghost" onPress={() => { setTick((x) => x + 1); toast('تم التحديث'); }} />
          <T size={12.5} weight="medium" color="muted">الترتيب</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="الأحدث أولًا" active={order === 'new'} onPress={() => setOrder('new')} />
            <Chip label="الأقدم أولًا" active={order === 'old'} onPress={() => setOrder('old')} />
          </View>
          <T size={12.5} weight="medium" color="muted">المستوى</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="الكل" active={!errs} onPress={() => setErrs(false)} />
            <Chip label="الأخطاء فقط" active={errs} onPress={() => setErrs(true)} />
          </View>
          <Button title="مسح السجل" icon="trash-2" kind="danger" disabled={!items.length} onPress={() => { setFilt(false); setAsk(true); }} />
        </View>
      </Sheet>
      <Dialog visible={ask} title="مسح السجل؟" message={`سيُحذف ${items.length} سطرًا من السجل المحفوظ على جهازك.`} onClose={() => setAsk(false)}
        actions={[{ title: 'مسح', kind: 'danger', onPress: () => { clear(); setAsk(false); } }, { title: 'إلغاء', onPress: () => setAsk(false) }]} />
    </View>
  );
}
