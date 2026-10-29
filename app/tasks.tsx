import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runTask, syncTaskNotifications } from '../src/api/engines';
import { MenuIcon } from '../src/components/ui/MenuIcon';
import { Button, Chip, Dialog, Empty, Field, Group, Icon, IconButton, Row, Sheet, Switch, T, haptic } from '../src/components/ui/kit';
import { useColors } from '../src/theme';
import { describeSchedule, validateSchedule, type Schedule } from '../src/lib/schedule';
import { toast, useUi } from '../src/store/data';
import { useTasks, type Task } from '../src/store/features';
import { relTime } from '../src/lib/util';

const MODES: [Schedule['mode'], string][] = [['daily', 'يوميًا'], ['weekly', 'أسبوعيًا'], ['monthly', 'شهريًا'], ['interval', 'كل فترة'], ['once', 'مرة'], ['cron', 'Cron'], ['event', 'حدث']];
const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

type Tab = 'all' | 'on' | 'off';

export default function TasksScreen() {
  const c = useColors();
  const { items, add, update, remove } = useTasks();
  const setSidebar = useUi((s) => s.setSidebar);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [acts, setActs] = useState<Task | null>(null);
  const [del, setDel] = useState<string[] | null>(null);
  const counts = { all: items.length, on: items.filter((t) => t.enabled).length, off: items.filter((t) => !t.enabled).length };
  const view = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((t) => (tab === 'all' || (tab === 'on' ? t.enabled : !t.enabled)) && (!n || t.name.toLowerCase().includes(n) || t.prompt.toLowerCase().includes(n)));
  }, [items, tab, q]);
  const allSelected = view.length > 0 && view.every((t) => picked.includes(t.id));
  const toggleSel = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setOn = (ids: string[], on: boolean) => { ids.forEach((id) => update(id, { enabled: on })); void syncTaskNotifications(); };
  const tabBtn = (k: Tab, label: string) => (
    <Pressable key={k} onPress={() => { haptic(); setTab(k); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderBottomWidth: 2.5, borderBottomColor: tab === k ? c.accent : 'transparent', marginBottom: -1 }}>
      <T size={14} weight="medium" color={tab === k ? 'accent' : 'text2'}>{label}</T>
      <T size={12} color="muted">{counts[k]}</T>
    </Pressable>
  );
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 56 }}>
        <Pressable onPress={() => { haptic(); setSidebar(true); }} accessibilityLabel="القائمة" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MenuIcon /></Pressable>
        <T size={20} weight="bold" style={{ flex: 1 }}>المهام</T>
        <IconButton name="search" label="بحث" active={searching || !!q} onPress={() => { setSearching((v) => !v); setQ(''); }} />
        <IconButton name="check-square" label="تحديد متعدد" active={multi} onPress={() => { setMulti((m) => !m); setPicked([]); }} />
        <IconButton name="plus-circle" label="مهمة جديدة" onPress={() => open()} />
      </View>
      {searching ? (
        <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: c.accent, height: 44 }}>
          <Icon name="search" size={18} color={c.accent} />
          <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} autoFocus value={q} onChangeText={setQ} placeholder="بحث" placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 15, textAlign: 'auto' }} />
        </View>
      ) : null}
      {multi ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Button small kind="soft" title={allSelected ? 'إلغاء التحديد' : 'تحديد الكل'} onPress={() => setPicked(allSelected ? [] : view.map((t) => t.id))} />
          <Button small kind="soft" title="تفعيل" disabled={!picked.length} onPress={() => setOn(picked, true)} />
          <Button small kind="soft" title="إيقاف" disabled={!picked.length} onPress={() => setOn(picked, false)} />
          <Button small kind="danger" icon="trash-2" title="حذف" disabled={!picked.length} onPress={() => setDel(picked)} />
          {picked.length ? <T size={12.5} color="muted">{picked.length + ' محدد'}</T> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 16, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {tabBtn('all', 'الكل')}{tabBtn('on', 'المفعّلة')}{tabBtn('off', 'المتوقفة')}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }} keyboardShouldPersistTaps="handled">
        <T size={12.5} color="muted">تُنفَّذ المهمة عند فتح التطبيق إن حان موعدها، وتصلك إشعارات محلية في مواعيدها. نظام أندرويد يحدّ التنفيذ في الخلفية، فلا تتوقع دقة بالثانية.</T>
        {view.length === 0 ? (
          <Empty icon="clock" title={q ? 'لا نتائج مطابقة' : items.length ? 'لا توجد مهام هنا' : 'لا توجد مهام'} sub={items.length ? undefined : 'اضغط + لإنشاء مهمة (ملخص صباحي، تذكير، بحث دوري…)'} />
        ) : null}
        {view.map((t) => {
          const isSel = picked.includes(t.id);
          return (
            <Pressable key={t.id} onPress={() => { haptic(); multi ? toggleSel(t.id) : setDetail(t); }} onLongPress={() => { if (!multi) { setMulti(true); setPicked([t.id]); } }} style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1.5, borderColor: isSel ? c.accent : c.border, padding: 14, gap: 8, opacity: t.enabled ? 1 : 0.62 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {multi ? <Icon name={isSel ? 'check-circle' : 'circle'} size={22} color={isSel ? c.accent : c.muted} /> : null}
                <T size={16} weight="semibold" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{t.name}</T>
                {!multi ? <IconButton name="more-vertical" size={19} label="المزيد" onPress={() => setActs(t)} style={{ width: 34, height: 34 }} /> : null}
              </View>
              <T size={13} color="text2" numberOfLines={2}>{t.prompt}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T size={12} color="muted" numberOfLines={1} style={{ flex: 1 }}>{describeSchedule(t.schedule)}{t.enabled ? '' : ' · متوقفة'}</T>
                {!multi ? <Button small kind="soft" title="تشغيل الآن" onPress={() => { void runTask(t.id); toast('بدأ التنفيذ'); }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Sheet visible={!!acts} onClose={() => setActs(null)} title={acts?.name}>
        <View style={{ padding: 16 }}>
          {acts ? (
            <Group>
              <Row icon="info" title="التفاصيل وآخر التنفيذات" onPress={() => { const x = acts; setActs(null); setTimeout(() => setDetail(x), 250); }} />
              <Row icon="play" title="تشغيل الآن" onPress={() => { void runTask(acts.id); toast('بدأ التنفيذ'); setActs(null); }} />
              <Row icon="edit-2" title="تعديل" onPress={() => { const x = acts; setActs(null); setTimeout(() => open(x), 250); }} />
              <Row icon={acts.enabled ? 'eye-off' : 'eye'} title={acts.enabled ? 'إيقاف المهمة' : 'تفعيل المهمة'} onPress={() => { setOn([acts.id], !acts.enabled); setActs(null); }} />
              <Row icon="trash-2" title="حذف المهمة" danger onPress={() => { const x = acts; setActs(null); setTimeout(() => setDel([x.id]), 250); }} />
            </Group>
          ) : null}
        </View>
      </Sheet>
      <Dialog visible={!!del} title={`حذف ${del?.length ?? 0} مهمة؟`} message="لا يمكن التراجع عن الحذف." onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { del?.forEach((id) => remove(id)); setPicked((p) => p.filter((k) => !del?.includes(k))); setDel(null); void syncTaskNotifications(); toast('تم الحذف'); } }, { title: 'إلغاء', onPress: () => setDel(null) }]} />

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.name} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <T size={13} color="text2">{detail?.prompt}</T>
          {detail?.next ? <T size={12} color="muted">التالي: {new Date(detail.next).toLocaleString('ar')}</T> : null}
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
    </SafeAreaView>
  );
}
