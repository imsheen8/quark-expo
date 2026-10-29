import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { chatStream } from '../src/api/stream';
import { completeChain, utilModels } from '../src/api/chains';
import { SK_SENS, cut, skBlock, skDupes, skEmit, skFold, skFromExtraction, skFromJson, skFromText, skNew, skRawUrl, uniqueName, type SkSens } from '../src/api/skillsCore';
import { splitThink } from '../src/api/parsers';
import type { Chat, Skill } from '../src/api/types';
import { Button, Card, Chip, Dialog, Empty, Field, Group, Icon, IconButton, Row, Screen, Sheet, Switch, T } from '../src/components/ui/kit';
import { readTextFile } from '../src/lib/images';
import { shareFile } from '../src/lib/share';
import { relTime } from '../src/lib/util';
import { useChats } from '../src/store/chats';
import { toast, useSkills } from '../src/store/data';
import { activeModel, useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

type Filter = 'all' | 'published' | 'draft' | 'off';
const STT = { published: 'منشورة', draft: 'مسودة', off: 'موقوفة' } as const;
const SRC: Record<Skill['source'], string> = { builtin: 'مدمجة', import: 'مستوردة', extracted: 'مستخرجة', manual: '' };
const SORTS = [['name', 'الاسم'], ['uses', 'الأكثر استخدامًا'], ['recent', 'الأحدث']] as const;

const safeName = (n: string) => n.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';

export default function Skills() {
  const c = useColors();
  const { items, add, addMany, update, remove, restoreStarters } = useSkills();
  const cfg = useSettings((s) => s.skills);
  const patch = useSettings((s) => s.patch);
  const setCfg = (p: Partial<typeof cfg>) => patch({ skills: { ...cfg, ...p } });

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('name');
  const [showSet, setShowSet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState<{ base?: Skill; v: Skill } | null>(null);
  const [del, setDel] = useState<Skill | null>(null);
  const [test, setTest] = useState<Skill | null>(null);
  const [text, setText] = useState<{ title: string; hint: string; kind: 'url' | 'paste'; value: string } | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState('');

  const dupes = useMemo(() => skDupes(items), [items]);
  const list = useMemo(() => {
    const n = skFold(q.trim());
    const l = items.filter((s) => (filter === 'all' || s.status === filter) && (!n || skFold([s.name, s.description, s.when, s.tags.join(' '), s.category, s.body].join(' ')).includes(n)));
    if (sort === 'uses') l.sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'ar'));
    else if (sort === 'recent') l.sort((a, b) => b.updatedAt - a.updatedAt);
    else l.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return l;
  }, [items, q, filter, sort]);
  const cnt = { published: items.filter((s) => s.status === 'published').length, draft: items.filter((s) => s.status === 'draft').length };

  const addImported = (arr: Skill[]) => {
    const have = new Set(items.map((x) => skFold(x.name)));
    const out = arr.map((s) => { const name = uniqueName(s.name, have); have.add(skFold(name)); return { ...s, name }; });
    addMany(out);
    return out;
  };

  async function importUrl(url: string) {
    if (!/^https?:\/\//i.test(url)) return toast('أدخل رابطًا يبدأ بـ http أو https');
    setBusy('جارٍ الجلب…');
    try {
      const r = await fetch(skRawUrl(url));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const sk = skFromText((await r.text()).slice(0, 60000), { source: 'import', sourceUrl: url });
      const [s] = addImported([sk]);
      toast('تم الاستيراد');
      setEdit({ base: s, v: s });
    } catch (e) {
      toast('تعذّر الاستيراد: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy('');
    }
  }
  function importPaste(t: string) {
    try {
      addImported([skFromText(t, { source: 'import' })]);
      toast('تم الاستيراد');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }
  async function importFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['*/*'] });
      if (r.canceled) return;
      const a = r.assets[0];
      const t = (await readTextFile(a.uri, 400_000)).trim();
      const arr = /\.json$/i.test(a.name) || t.startsWith('{') || t.startsWith('[') ? skFromJson(t) : [skFromText(t, { source: 'import' })];
      if (!arr.length) throw new Error('لا مهارات صالحة في الملف');
      toast(`تم استيراد ${addImported(arr).length} مهارة`);
    } catch (e) {
      toast('تعذّر الاستيراد: ' + (e instanceof Error ? e.message : String(e)));
    }
  }
  async function extract(chat: Chat) {
    const models = utilModels();
    if (!models.length) return toast('أضف نقطة اتصال واختر نموذجًا أولًا');
    const turns = chat.messages.filter((m) => !m.error && m.content).slice(-14).map((m) => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${cut(m.content, 1400)}`).join('\n\n');
    if (turns.length < 80) return toast('المحادثة قصيرة جدًا للاستخراج');
    setPick(false);
    setBusy('جارٍ تحليل المحادثة…');
    try {
      const { text: raw } = await completeChain(models, {
        params: { temperature: 0.3, max_tokens: 2200 },
        system: 'أنت تستخرج «مهارات» قابلة لإعادة الاستخدام من محادثات ناجحة، وتُجيب بـ JSON فقط.',
        messages: [{ role: 'user', content:
          `المحادثة:\n${turns}\n\nاستخرج مهارة واحدة (أو اثنتين كحد أقصى إن وُجد نمطان مختلفان) تُجسّد طريقة عمل ناجحة يمكن إعادة تطبيقها على طلبات مشابهة، بصيغة تعليمات عامة لا تذكر تفاصيل هذه المحادثة الخاصة. ` +
          'أجب بـ {"skills":[{"name":"اسم قصير","description":"جملة","when_to_use":"متى تُطبَّق","category":"فئة","tags":["وسم"],"instructions":"خطوات مرقمة واضحة"}]}. إن لم يوجد ما يستحق فأعد {"skills":[]}.' }],
      });
      const found = skFromExtraction(splitThink(raw).ans || raw, cfg.autoApprove);
      if (!found.length) return toast('لم أجد نمطًا يستحق الحفظ في هذه المحادثة');
      const out = addImported(found);
      toast(`استُخرجت ${out.length} مهارة`);
      setEdit({ base: out[0], v: out[0] });
    } catch (e) {
      toast('تعذّر الاستخراج: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy('');
    }
  }
  const exportAll = () =>
    shareFile('quark-skills.json', JSON.stringify({ format: 'quark-skills', version: 1, skills: items.map(({ name, description, when, body, tags, category, status }) => ({ name, description, when, body, tags, category, status })) }, null, 2), 'application/json').catch(() => toast('تعذّر التصدير'));
  const exportOne = (s: Skill) => shareFile(safeName(s.name) + '.SKILL.md', skEmit(s), 'text/markdown').catch(() => toast('تعذّر التصدير'));
  const dup = (s: Skill) => { const n = skNew({ ...s, name: s.name + ' (نسخة)', uses: 0, lastUsed: 0, source: 'manual', status: 'draft' }); add(n); toast('أُنشئت نسخة كمسودة'); };

  function saveEdit() {
    if (!edit) return;
    const v = edit.v;
    if (!v.name.trim()) return toast('أدخل اسم المهارة');
    if (v.body.trim().length < 10) return toast('اكتب تعليمات المهارة');
    if (!v.when.trim() && !v.description.trim() && v.status === 'published') return toast('أضف وصفًا أو «متى تُستخدم» لتُطابَق تلقائيًا');
    const clean = { ...v, name: v.name.trim(), body: v.body.trim() };
    if (edit.base) update(v.id, clean);
    else add({ ...clean, updatedAt: Date.now() });
    setEdit(null);
    toast('تم الحفظ');
  }

  return (
    <Screen title="المهارات" menu right={<IconButton name="plus" onPress={() => setMenu(true)} label="إضافة" />}>
      <T size={13} color="text2">
        المهارة حزمة تعليمات (مثل «بريد مهني» أو «مراجعة كود») تُحقن تلقائيًا في سياق النموذج عندما يناسب طلبك وصفها. تظهر أسفل الرد أسماء المهارات المستخدمة. يمكنك تثبيت مهارة للرسالة التالية بكتابة «/» في خانة الرسالة.
      </T>
      <T size={12} color="muted">
        {items.length} مهارة · {cnt.published} منشورة{cnt.draft ? ` · ${cnt.draft} مسودة` : ''} · {items.reduce((n, s) => n + s.uses, 0)} استخدامًا{cfg.enabled ? '' : ' · المطابقة التلقائية متوقفة'}
      </T>

      <Group>
        <Row icon="sliders" title="إعدادات المهارات" sub="المطابقة التلقائية · الحساسية · العدد" onPress={() => setShowSet(true)} />
      </Group>

      <Field placeholder="ابحث في المهارات…" value={q} onChangeText={setQ} autoCapitalize="sentences" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(['all', 'published', 'draft', 'off'] as Filter[]).map((k) => (
          <Chip key={k} label={k === 'all' ? 'الكل' : STT[k]} active={filter === k} onPress={() => setFilter(k)} />
        ))}
        <View style={{ width: 8 }} />
        {SORTS.map(([k, l]) => <Chip key={k} label={l} icon="arrow-down" active={sort === k} onPress={() => setSort(k)} />)}
      </ScrollView>

      {busy ? <T size={13} color="accent">{busy}</T> : null}
      {list.length === 0 ? <Empty icon="zap" title={items.length ? 'لا نتائج مطابقة' : 'لا توجد مهارات'} sub={items.length ? undefined : 'اضغط + لإضافة مهارة.'} /> : null}
      {list.map((s) => (
        <Pressable key={s.id} onPress={() => setEdit({ base: s, v: s })}>
          <Card style={{ gap: 6, opacity: s.status === 'off' ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <T weight="bold" style={{ flexShrink: 1 }}>{s.name}</T>
              <T size={11} color={s.status === 'published' ? 'accent' : 'muted'} style={{ backgroundColor: s.status === 'published' ? c.accentSoft : c.surface2, paddingHorizontal: 8, borderRadius: 8 }}>{STT[s.status]}</T>
              {SRC[s.source] ? <T size={11} color="muted" style={{ backgroundColor: c.surface2, paddingHorizontal: 8, borderRadius: 8 }}>{SRC[s.source]}</T> : null}
              {dupes.has(s.id) ? <T size={11} color="danger">مكررة؟ ({dupes.get(s.id)})</T> : null}
            </View>
            {s.description ? <T size={13} color="text2" numberOfLines={2}>{s.description}</T> : null}
            {s.when ? <T size={12.5} color="muted" numberOfLines={2}>متى: {s.when}</T> : null}
            {s.tags.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {s.tags.map((t) => <T key={t} size={11.5} color="accent">#{t}</T>)}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T size={11.5} color="muted" style={{ flex: 1 }}>{s.uses ? `استُخدمت ${s.uses} مرة · ${relTime(s.lastUsed)}` : 'لم تُستخدم'}</T>
              <IconButton name={s.status === 'published' ? 'pause' : 'play'} size={16} label={s.status === 'published' ? 'إيقاف' : 'نشر'} onPress={() => update(s.id, { status: s.status === 'published' ? 'off' : 'published' })} />
              <IconButton name="play-circle" size={16} label="تجربة" onPress={() => setTest(s)} />
            </View>
          </Card>
        </Pressable>
      ))}

      {/* إضافة */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title="إضافة مهارة">
        <ScrollView>
          <Group>
            <Row icon="plus" title="مهارة جديدة" onPress={() => { setMenu(false); setEdit({ v: skNew({}, undefined) }); }} />
            <Row icon="message-circle" title="استخراج من محادثة" sub="يقترح النموذج مهارة من محادثة ناجحة" onPress={() => { setMenu(false); setTimeout(() => setPick(true), 250); }} />
            <Row icon="link" title="استيراد من رابط" sub="SKILL.md من GitHub أو رابط مباشر" onPress={() => { setMenu(false); setTimeout(() => setText({ title: 'استيراد من رابط', hint: 'https://github.com/…/SKILL.md', kind: 'url', value: '' }), 250); }} />
            <Row icon="clipboard" title="لصق SKILL.md" onPress={() => { setMenu(false); setTimeout(() => setText({ title: 'لصق SKILL.md', hint: '---\nname: …\n---', kind: 'paste', value: '' }), 250); }} />
            <Row icon="file" title="استيراد من ملف" sub=".md أو .json" onPress={() => { setMenu(false); setTimeout(importFile, 250); }} />
          </Group>
        </ScrollView>
      </Sheet>

      {/* إعدادات */}
      <Sheet visible={showSet} onClose={() => setShowSet(false)} title="إعدادات المهارات" full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Group>
            <Row icon="zap" title="المطابقة التلقائية" chevron={false} right={<Switch value={cfg.enabled} onValueChange={(v) => setCfg({ enabled: v })} />} />
            <Row icon="check-square" title="اعتماد المستخرجة تلقائيًا" sub="وإلا تُحفظ كمسودة لتراجعها" chevron={false} right={<Switch value={cfg.autoApprove} onValueChange={(v) => setCfg({ autoApprove: v })} />} />
            <Row icon="hash" title="أقصى عدد مهارات تُحقن" sub={`${cfg.max} في كل رد`} chevron={false}
              right={<View style={{ flexDirection: 'row' }}><IconButton name="minus" size={18} onPress={() => setCfg({ max: Math.max(1, cfg.max - 1) })} /><IconButton name="plus" size={18} onPress={() => setCfg({ max: Math.min(5, cfg.max + 1) })} /></View>} />
          </Group>
          <View style={{ gap: 8 }}>
            <T size={12.5} weight="medium" color="muted">حساسية المطابقة</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(Object.keys(SK_SENS) as SkSens[]).map((k) => <Chip key={k} label={SK_SENS[k].l} active={cfg.sens === k} onPress={() => setCfg({ sens: k })} />)}
            </View>
          </View>
          <Button title="استعادة المهارات المدمجة" kind="ghost" icon="rotate-ccw" onPress={() => { const n = restoreStarters(); toast(n ? `أُعيدت ${n} مهارة` : 'كل المهارات المدمجة موجودة'); }} />
          <Button title="تصدير الكل (JSON)" kind="ghost" icon="share-2" onPress={exportAll} />
          <T size={12} color="muted">المهارات تُحفظ على هذا الجهاز (وتُزامَن مع حسابك إن فعّلت المزامنة). محتواها إرشادات تقرؤها النماذج التي تستخدمها، فلا تضع فيها أسرارًا.</T>
        </ScrollView>
      </Sheet>

      {/* محرّر */}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.base ? 'تعديل المهارة' : 'مهارة جديدة'} full>
        {edit ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Field label="الاسم" value={edit.v.name} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, name: t } })} autoCapitalize="sentences" maxLength={80} />
            <Field label="الوصف (ماذا تفعل؟)" value={edit.v.description} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, description: t } })} autoCapitalize="sentences" />
            <Field label="متى تُستخدم؟ (أساس المطابقة — كن محددًا)" value={edit.v.when} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, when: t } })} multiline inputStyle={{ minHeight: 70 }} autoCapitalize="sentences" />
            <Field label="الفئة" value={edit.v.category} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, category: t } })} autoCapitalize="sentences" />
            <Field label="الوسوم (افصل بفاصلة)" value={edit.v.tags.join('، ')} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, tags: t.split(/[,،]/).map((x) => x.trim().replace(/^#/, '')).filter(Boolean).slice(0, 12) } })} autoCapitalize="sentences" />
            <View style={{ gap: 6 }}>
              <T size={12.5} weight="medium" color="muted">الحالة</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['published', 'draft', 'off'] as const).map((k) => <Chip key={k} label={STT[k]} active={edit.v.status === k} onPress={() => setEdit({ ...edit, v: { ...edit.v, status: k } })} />)}
              </View>
            </View>
            <Field label="التعليمات (Markdown)" value={edit.v.body} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, body: t } })} multiline inputStyle={{ minHeight: 200, fontFamily: undefined }} autoCapitalize="sentences" placeholder={'1. …\n2. …'} />
            <Button title="حفظ" icon="check" onPress={saveEdit} />
            {edit.base ? (
              <View style={{ gap: 8 }}>
                <Button title="تجربة" kind="ghost" icon="play-circle" onPress={() => { const t = edit.v; setEdit(null); setTimeout(() => setTest(t), 250); }} />
                <Button title="تصدير SKILL.md" kind="ghost" icon="share-2" onPress={() => exportOne(edit.v)} />
                <Button title="تكرار" kind="ghost" icon="copy" onPress={() => { dup(edit.v); setEdit(null); }} />
                <Button title="حذف" kind="danger" icon="trash-2" onPress={() => { const s = edit.base!; setEdit(null); setTimeout(() => setDel(s), 250); }} />
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </Sheet>

      {/* اختيار محادثة للاستخراج */}
      <ChatPicker visible={pick} onClose={() => setPick(false)} onPick={extract} sub={cfg.autoApprove ? 'تُحفظ منشورة' : 'تُحفظ كمسودة لتراجعها'} />
      <TestSheet skill={test} onClose={() => setTest(null)} />

      <Dialog visible={!!del} title="حذف هذه المهارة نهائيًا؟" message={del?.name} onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { if (del) remove([del.id]); setDel(null); toast('تم الحذف'); } }, { title: 'إلغاء', onPress: () => setDel(null) }]} />
      <Dialog visible={!!text} title={text?.title || ''} onClose={() => setText(null)}
        actions={[{ title: 'استيراد', onPress: () => { const t = text!; setText(null); if (t.kind === 'url') void importUrl(t.value.trim()); else importPaste(t.value); } }, { title: 'إلغاء', onPress: () => setText(null) }]}>
        {text ? <Field value={text.value} onChangeText={(v) => setText({ ...text, value: v })} placeholder={text.hint} multiline={text.kind === 'paste'} ltr={text.kind === 'url'} inputStyle={text.kind === 'paste' ? { minHeight: 160 } : undefined} /> : null}
      </Dialog>
    </Screen>
  );
}

function ChatPicker({ visible, onClose, onPick, sub }: { visible: boolean; onClose: () => void; onPick: (c: Chat) => void; sub: string }) {
  const chats = useChats((s) => s.chats);
  const list = chats.filter((x) => !x.temp && x.messages.length >= 2).slice(0, 40);
  return (
    <Sheet visible={visible} onClose={onClose} title="استخراج مهارة من محادثة" full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <T size={13} color="text2">اختر محادثة ناجحة، وسيقترح النموذج مهارة منها. {sub}</T>
        {list.length === 0 ? <Empty icon="message-circle" title="لا توجد محادثات كافية" /> : null}
        {list.map((ch) => (
          <Pressable key={ch.id} onPress={() => onPick(ch)}>
            <Card style={{ gap: 2 }}>
              <T weight="medium" numberOfLines={1}>{ch.title || 'محادثة'}</T>
              <T size={12} color="muted">{ch.messages.length} رسالة · {relTime(ch.updated)}</T>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function TestSheet({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [out, setOut] = useState('');
  const [run, setRun] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const close = () => { ctl.current?.abort(); setRun(false); setOut(''); onClose(); };

  async function go() {
    if (run) { ctl.current?.abort(); return; }
    const am = activeModel();
    if (!am) return toast('أضف نقطة اتصال واختر نموذجًا أولًا');
    if (!input.trim() || !skill) return toast('اكتب طلبًا تجريبيًا');
    ctl.current = new AbortController();
    setRun(true);
    setOut('…');
    let acc = '';
    try {
      for await (const ch of chatStream({ ep: am.ep, model: am.model, params: {}, system: '', signal: ctl.current.signal, messages: [{ role: 'user', content: skBlock([skill]) + '\n\n--- طلب المستخدم ---\n' + input.trim() }] })) {
        if (ch.kind === 'text') { acc += ch.text; setOut(splitThink(acc).ans || '…'); }
      }
      if (!acc) setOut('لم يُرجع النموذج ردًا.');
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') setOut('تعذّر: ' + (e instanceof Error ? e.message : String(e)));
    }
    setRun(false);
  }
  return (
    <Sheet visible={!!skill} onClose={close} title={skill ? 'تجربة: ' + skill.name : ''} full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Field label="اكتب طلبًا تجريبيًا لترى كيف تؤثر المهارة في الرد" value={input} onChangeText={setInput} multiline autoCapitalize="sentences" placeholder="مثال: اكتب بريدًا أطلب فيه موعدًا" />
        <Button title={run ? 'إيقاف' : 'تشغيل'} icon={run ? 'square' : 'play'} onPress={go} />
        <View style={{ minHeight: 80 }}><T selectable>{out || 'سيظهر الرد هنا.'}</T></View>
      </ScrollView>
    </Sheet>
  );
}
