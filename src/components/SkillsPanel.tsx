import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { chatStream } from '../api/stream';
import { completeChain, utilModels } from '../api/chains';
import { cut, skBlock, skDupes, skEmit, skFold, skFromExtraction, skFromJson, skFromText, skNew, skRawUrl, uniqueName } from '../api/skillsCore';
import { splitThink } from '../api/parsers';
import type { Chat, Skill } from '../api/types';
import { Button, Card, Chip, Dialog, Empty, Field, Group, Icon, IconButton, Row, Sheet, T } from './ui/kit';
import { readTextFile } from '../lib/images';
import { shareFile } from '../lib/share';
import { relTime } from '../lib/util';
import { useChats } from '../store/chats';
import { toast, useSkills } from '../store/data';
import { activeModel, useSettings } from '../store/settings';
import { useSkillTags } from '../store/tags';
import { useColors } from '../theme';

type Filter = 'all' | 'published' | 'draft' | 'off';
const STT = { published: 'منشورة', draft: 'مسودة', off: 'موقوفة' } as const;
const SRC: Record<Skill['source'], string> = { builtin: 'مدمجة', import: 'مستوردة', extracted: 'مستخرجة', manual: '' };
const SORTS = [['name', 'الاسم'], ['uses', 'الأكثر استخدامًا'], ['recent', 'الأحدث']] as const;

const safeName = (n: string) => n.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';

export function useSkillsUi(q: string, menuOpen: boolean, onMenuClose: () => void, tagName: string | null = null, onTags?: (s: Skill) => void) {
  const c = useColors();
  const { items, add, addMany, update, remove } = useSkills();
  const cfg = useSettings((s) => s.skills);

  const filter: Filter = 'all';
  const sort: (typeof SORTS)[number][0] = 'name';
  const [actions, setActions] = useState<Skill | null>(null);
  const [edit, setEdit] = useState<{ base?: Skill; v: Skill } | null>(null);
  const [del, setDel] = useState<Skill | null>(null);
  const [test, setTest] = useState<Skill | null>(null);
  const [text, setText] = useState<{ title: string; hint: string; kind: 'url' | 'paste'; value: string } | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState('');

  const skTags = useSkillTags((s) => s.items);
  const tagColor = (n: string) => skTags.find((t) => t.name === n)?.color ?? c.accent;
  const dupes = useMemo(() => skDupes(items), [items]);
  const list = useMemo(() => {
    const n = skFold(q.trim());
    const l = items.filter((s) => (tagName == null || s.tags.includes(tagName)) && (filter === 'all' || s.status === filter) && (!n || skFold([s.name, s.description, s.when, s.tags.join(' '), s.body].join(' ')).includes(n)));
    if (sort === 'uses') l.sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'ar'));
    else if (sort === 'recent') l.sort((a, b) => b.updatedAt - a.updatedAt);
    else l.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return l;
  }, [items, q, filter, sort, tagName]);

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
          'أجب بـ {"skills":[{"name":"اسم قصير","description":"جملة","when_to_use":"متى تُطبَّق","tags":["وسم"],"instructions":"خطوات مرقمة واضحة"}]}. إن لم يوجد ما يستحق فأعد {"skills":[]}.' }],
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

  const header = busy ? <T size={13} color="accent">{busy}</T> : null;
  const renderCard = (s: Skill, mp?: { picked: boolean; toggle: () => void }) => (
          <Pressable onPress={() => (mp ? mp.toggle() : setEdit({ base: s, v: s }))} style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1.5, borderColor: mp?.picked ? c.accent : c.border, padding: 14, gap: 8, opacity: s.status === 'off' ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {mp ? <Icon name={mp.picked ? 'check-circle' : 'circle'} size={22} color={mp.picked ? c.accent : c.muted} /> : null}
              <T size={16} weight="semibold" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{s.name}</T>
              {!mp ? <IconButton name="more-vertical" size={19} label="المزيد" onPress={() => setActions(s)} style={{ width: 34, height: 34 }} /> : null}
            </View>
            {s.description ? <T size={13} color="text2" numberOfLines={2}>{s.description}</T> : null}
            {s.when ? <T size={12.5} color="muted" numberOfLines={2}>متى: {s.when}</T> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 }}>
                <T size={12} color="muted">مهارة{s.status !== 'published' ? ' · ' + STT[s.status] : ''}{dupes.has(s.id) ? ` · مكررة؟ (${dupes.get(s.id)})` : ''}</T>
                {s.tags.map((t) => <T key={t} size={11.5} style={{ color: tagColor(t) }}>#{t}</T>)}
              </View>
              {!mp ? <Button small kind="soft" title="تجربة" onPress={() => setTest(s)} /> : null}
            </View>
          </Pressable>
  );
  const overlays = (
    <>
      <Sheet visible={!!actions} onClose={() => setActions(null)} title={actions?.name}>
        <View style={{ padding: 16 }}>
          {actions ? (
            <Group>
              <Row icon={actions.status === 'published' ? 'eye-off' : 'eye'} title={actions.status === 'published' ? 'إيقاف المهارة' : 'نشر المهارة'} onPress={() => { update(actions.id, { status: actions.status === 'published' ? 'off' : 'published' }); setActions(null); }} />
              <Row icon="tag" title="إضافة وسم" onPress={() => { const x = actions; setActions(null); if (onTags) setTimeout(() => onTags(x), 250); }} />
              <Row icon="edit-2" title="تعديل" onPress={() => { const x = actions; setActions(null); setEdit({ base: x, v: x }); }} />
              <Row icon="copy" title="تكرار" onPress={() => { dup(actions); setActions(null); }} />
              <Row icon="file-text" title="تصدير SKILL.md" onPress={() => { const x = actions; setActions(null); void exportOne(x); }} />
              <Row icon="trash-2" title="حذف المهارة" danger onPress={() => { const x = actions; setActions(null); setTimeout(() => setDel(x), 250); }} />
            </Group>
          ) : null}
        </View>
      </Sheet>

      {/* إضافة */}
      <Sheet visible={menuOpen} onClose={onMenuClose} title="إضافة مهارة">
        <ScrollView>
          <Group>
            <Row icon="plus" title="مهارة جديدة" onPress={() => { onMenuClose(); setEdit({ v: skNew({}, undefined) }); }} />
            <Row icon="message-circle" title="استخراج من محادثة" sub="يقترح النموذج مهارة من محادثة ناجحة" onPress={() => { onMenuClose(); setTimeout(() => setPick(true), 250); }} />
            <Row icon="link" title="استيراد من رابط" sub="SKILL.md من GitHub أو رابط مباشر" onPress={() => { onMenuClose(); setTimeout(() => setText({ title: 'استيراد من رابط', hint: 'https://github.com/…/SKILL.md', kind: 'url', value: '' }), 250); }} />
            <Row icon="clipboard" title="لصق SKILL.md" onPress={() => { onMenuClose(); setTimeout(() => setText({ title: 'لصق SKILL.md', hint: '---\nname: …\n---', kind: 'paste', value: '' }), 250); }} />
            <Row icon="file" title="استيراد من ملف" sub=".md أو .json" onPress={() => { onMenuClose(); setTimeout(importFile, 250); }} />
          </Group>
        </ScrollView>
      </Sheet>

      {/* محرّر */}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.base ? 'تعديل المهارة' : 'مهارة جديدة'} full>
        {edit ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Field label="الاسم" value={edit.v.name} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, name: t } })} autoCapitalize="sentences" maxLength={80} />
            <Field label="الوصف (ماذا تفعل؟)" value={edit.v.description} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, description: t } })} autoCapitalize="sentences" />
            <Field label="متى تُستخدم؟ (أساس المطابقة — كن محددًا)" value={edit.v.when} onChangeText={(t) => setEdit({ ...edit, v: { ...edit.v, when: t } })} multiline inputStyle={{ minHeight: 70 }} autoCapitalize="sentences" />
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
    </>
  );
  return { list, header, renderCard, overlays, busy };
}

function ChatPicker({ visible, onClose, onPick, sub }: { visible: boolean; onClose: () => void; onPick: (c: Chat) => void; sub: string }) {
  const chats = useChats((s) => s.chats);
  const list = chats.filter((x) => !x.temp && x.messages.length >= 2).slice(0, 40);
  return (
    <Sheet visible={visible} onClose={onClose} title="استخراج مهارة من محادثة" full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <T size={13} color="text2">اختر محادثة ناجحة، وسيقترح النموذج مهارة منها. {sub}</T>
        {list.length === 0 ? <Empty icon="message-circle" compact title="لا توجد محادثات كافية" /> : null}
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
