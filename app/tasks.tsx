import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { runTask, syncTaskNotifications } from '../src/api/engines';
import { Button, Chip, Dialog, Empty, Field, Group, IconButton, Row, Screen, Sheet, Switch, T } from '../src/components/ui/kit';
import { describeSchedule, validateSchedule, type Schedule } from '../src/lib/schedule';
import { toast } from '../src/store/data';
import { useTasks, type Task } from '../src/store/features';
import { relTime } from '../src/lib/util';

const MODES: [Schedule['mode'], string][] = [['daily', 'يوميًا'], ['weekly', 'أسبوعيًا'], ['monthly', 'شهريًا'], ['interval', 'كل فترة'], ['once', 'مرة'], ['cron', 'Cron'], ['event', 'حدث']];
const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function TasksScreen() {
  const { items, add, update, remove } = useTasks();
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [mode, setMode] = useState<Schedule['mode']>('daily');
  const [f, setF] = useState({ time: '08:00', days: [1] as number[], day: '1', every: '60', cron: '0 8 * * *', n: '10', kind: 'messages' as 'messages' | 'newchat' | 'research', at: '' });
  const [detail, setDetail] = useState<Task | null>(null);

  const open = (t?: Task) => {
    setEdit(t ?? { name: '', prompt: '', web: false, notify: true });
    if (t) {
      const s = t.schedule;
      setMode(s.mode);
      setF((p) => ({ ...p, ...(s.mode === 'daily' ? { time: s.time } : s.mode === 'weekly' ? { time: s.time, days: s.days } : s.mode === 'monthly' ? { time: s.time, day: String(s.day) } : s.mode === 'interval' ? { every: String(s.every) } : s.mode === 'cron' ? { cron: s.cron } : s.mode === 'event' ? { n: String(s.n), kind: s.kind } : { at: new Date(s.at).toISOString().slice(0, 16).replace('T', ' ') }) }));
    }
  };
  const build = (): Schedule => {
    switch (mode) {
      case 'daily': return { mode, time: f.time };
      case 'weekly': return { mode, time: f.time, days: f.days };
      case 'monthly': return { mode, time: f.time, day: +f.day };
      case 'interval': return { mode, every: +f.every };
      case 'cron': return { mode, cron: f.cron };
      case 'event': return { mode, kind: f.kind, n: +f.n };
      default: return { mode: 'once', at: new Date(f.at.replace(' ', 'T')).getTime() || 0 };
    }
  };
  const save = () => {
    if (!edit?.name?.trim() || !edit.prompt?.trim()) return toast('أدخل الاسم والتعليمات');
    const schedule = build();
    const bad = validateSchedule(schedule);
    if (bad) return toast(bad);
    if (edit.id) update(edit.id, { name: edit.name, prompt: edit.prompt, web: edit.web, notify: edit.notify, schedule });
    else add({ name: edit.name, prompt: edit.prompt, schedule, web: edit.web, notify: edit.notify });
    setEdit(null);
    void syncTaskNotifications();
  };

  return (
    <Screen title="المهام المجدولة" menu right={<IconButton name="plus" label="مهمة جديدة" onPress={() => open()} />}>
      <T size={13} color="text2">تُنفَّذ المهمة عند فتح التطبيق إن حان موعدها، وتصلك إشعارات محلية في مواعيدها. نظام أندرويد يحدّ التنفيذ في الخلفية، فلا تتوقع دقة بالثانية.</T>
      {items.length === 0 ? <Empty icon="clock" title="لا توجد مهام" sub="اضغط + لإنشاء مهمة (ملخص صباحي، تذكير، بحث دوري…)" /> : (
        <Group>
          {items.map((t) => (
            <Row key={t.id} icon="clock" title={t.name} sub={`${describeSchedule(t.schedule)}${t.next ? ' · التالي ' + new Date(t.next).toLocaleString('ar') : ''}`} onPress={() => setDetail(t)} right={<Switch value={t.enabled} onValueChange={(v) => { update(t.id, { enabled: v }); void syncTaskNotifications(); }} />} chevron={false} />
          ))}
        </Group>
      )}

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.name} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <T size={13} color="text2">{detail?.prompt}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small title="تشغيل الآن" icon="play" onPress={() => { if (detail) { void runTask(detail.id); toast('بدأ التنفيذ'); } }} />
            <Button small kind="soft" title="تعديل" icon="edit-2" onPress={() => { const d = detail!; setDetail(null); setTimeout(() => open(d), 250); }} />
            <Button small kind="danger" title="حذف" icon="trash-2" onPress={() => { if (detail) remove(detail.id); setDetail(null); }} />
          </View>
          <T size={12} color="muted">آخر التنفيذات</T>
          {(items.find((x) => x.id === detail?.id)?.runs ?? []).map((r, i) => (
            <View key={i} style={{ gap: 2 }}>
              <T size={12} color={r.ok ? 'accent' : 'danger'}>{r.ok ? '✓' : '✗'} {relTime(r.ts)}</T>
              <T size={12.5} color="text2" numberOfLines={4}>{r.text}</T>
            </View>
          ))}
        </ScrollView>
      </Sheet>

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'تعديل المهمة' : 'مهمة جديدة'} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Field label="الاسم" value={edit?.name ?? ''} onChangeText={(t) => setEdit((p) => ({ ...p, name: t }))} />
          <Field label="التعليمات للنموذج" value={edit?.prompt ?? ''} onChangeText={(t) => setEdit((p) => ({ ...p, prompt: t }))} multiline />
          <T size={13} weight="medium">التكرار</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{MODES.map(([k, l]) => <Chip key={k} label={l} active={mode === k} onPress={() => setMode(k)} />)}</View>
          {['daily', 'weekly', 'monthly'].includes(mode) ? <Field label="الوقت (HH:MM)" ltr value={f.time} onChangeText={(t) => setF({ ...f, time: t })} /> : null}
          {mode === 'weekly' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{DAYS.map((d, i) => <Chip key={i} label={d} active={f.days.includes(i)} onPress={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })} />)}</View> : null}
          {mode === 'monthly' ? <Field label="يوم الشهر" ltr keyboardType="number-pad" value={f.day} onChangeText={(t) => setF({ ...f, day: t })} /> : null}
          {mode === 'interval' ? <Field label="كل كم دقيقة" ltr keyboardType="number-pad" value={f.every} onChangeText={(t) => setF({ ...f, every: t })} /> : null}
          {mode === 'once' ? <Field label="الموعد (YYYY-MM-DD HH:MM)" ltr value={f.at} onChangeText={(t) => setF({ ...f, at: t })} /> : null}
          {mode === 'cron' ? <Field label="Cron (دقيقة ساعة يوم شهر أسبوع)" ltr value={f.cron} onChangeText={(t) => setF({ ...f, cron: t })} /> : null}
          {mode === 'event' ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {([['messages', 'رسائل'], ['newchat', 'محادثات جديدة'], ['research', 'أبحاث عميقة']] as const).map(([k, l]) => <Chip key={k} label={l} active={f.kind === k} onPress={() => setF({ ...f, kind: k })} />)}
              </View>
              <Field label="كل كم حدث" ltr keyboardType="number-pad" value={f.n} onChangeText={(t) => setF({ ...f, n: t })} />
            </>
          ) : null}
          <Group>
            <Row icon="globe" title="استخدام بحث الويب" chevron={false} right={<Switch value={!!edit?.web} onValueChange={(v) => setEdit((p) => ({ ...p, web: v }))} />} />
            <Row icon="bell" title="إشعار عند الانتهاء" chevron={false} right={<Switch value={edit?.notify !== false} onValueChange={(v) => setEdit((p) => ({ ...p, notify: v }))} />} />
          </Group>
          <Button title="حفظ" onPress={save} />
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
