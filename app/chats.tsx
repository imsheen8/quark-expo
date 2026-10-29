import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { stopGeneration } from '../src/api/generate';
import { ChatActions } from '../src/components/ChatActions';
import { MenuIcon } from '../src/components/ui/MenuIcon';
import { TagDot, TagEditor, TagLabels, TagPicker } from '../src/components/TagDialogs';
import { Button, Dialog, Icon, IconButton, T, haptic, Empty } from '../src/components/ui/kit';
import { deleteImages } from '../src/lib/images';
import { useChats, useStream } from '../src/store/chats';
import { toast, useUi } from '../src/store/data';
import { useTags } from '../src/store/tags';
import { useColors } from '../src/theme';

/** صفحة المحادثات: بحث، تبويبات الكل/المفضلة، وسوم، تحديد متعدد */
export default function ChatsPage() {
  const c = useColors();
  const r = useRouter();
  const chats = useChats((s) => s.chats);
  const tags = useTags((s) => s.items);
  const setSidebar = useUi((s) => s.setSidebar);
  const [tab, setTab] = useState<string>('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [multi, setMulti] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tagMenu, setTagMenu] = useState(false);
  const [editor, setEditor] = useState<{ id?: string } | null>(null);
  const [picker, setPicker] = useState<string[] | null>(null);
  const [actions, setActions] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delTag, setDelTag] = useState<string | null>(null);

  const all = useMemo(() => chats.filter((x) => !x.temp).sort((a, b) => b.updated - a.updated), [chats]);
  const view = useMemo(() => {
    let a = all;
    if (tab === 'fav') a = a.filter((x) => x.pinned);
    else if (tab.startsWith('tag:')) a = a.filter((x) => x.tags?.includes(tab.slice(4)));
    const t = q.trim().toLowerCase();
    if (t) a = a.filter((x) => (x.title + ' ' + x.messages.map((m) => m.content).join(' ')).toLowerCase().includes(t));
    return a;
  }, [all, tab, q]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const open = (id: string) => {
    haptic();
    if (useStream.getState().busy) stopGeneration();
    useChats.getState().setCurrent(id);
    r.replace('/');
  };
  const allSelected = view.length > 0 && view.every((x) => sel.has(x.id));
  const tabBtn = (k: string, label: string, n: number) => (
    <Pressable key={k} onPress={() => { haptic(); setTab(k); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderBottomWidth: 2.5, borderBottomColor: tab === k ? c.accent : 'transparent', marginBottom: -1 }}>
      <T size={14} weight="medium" color={tab === k ? 'accent' : 'text2'}>{label}</T>
      <T size={12} color="muted">{n}</T>
    </Pressable>
  );
  const curTag = tab.startsWith('tag:') ? tags.find((t) => t.id === tab.slice(4)) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 56 }}>
        <Pressable onPress={() => { haptic(); setSidebar(true); }} accessibilityLabel="القائمة" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MenuIcon /></Pressable>
        <T size={20} weight="bold" style={{ flex: 1 }}>المحادثات</T>
        <IconButton name="search" label="بحث" active={searching} onPress={() => { setSearching((v) => !v); setQ(''); }} />
        <IconButton name="check-square" label="تحديد متعدد" active={multi} onPress={() => { setMulti((v) => !v); setSel(new Set()); }} />
        <IconButton name="tag" label="الوسوم" active={!!curTag || tagMenu} onPress={() => setTagMenu(true)} color={curTag?.color} />
        <IconButton name="plus-circle" label="وسم جديد" onPress={() => setEditor({})} />
      </View>
      {searching ? (
        <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: c.accent, height: 44 }}>
          <Icon name="search" size={18} color={c.accent} />
          <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} autoFocus value={q} onChangeText={setQ} placeholder="بحث" placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 15, textAlign: 'auto' }} />
        </View>
      ) : null}
      {multi ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Button small kind="soft" title={allSelected ? 'إلغاء التحديد' : 'تحديد الكل'} onPress={() => setSel(allSelected ? new Set() : new Set(view.map((x) => x.id)))} />
          <Button small kind="soft" icon="tag" title="وسم" disabled={!sel.size} onPress={() => setPicker([...sel])} />
          <Button small kind="soft" icon="star" title="مفضلة" disabled={!sel.size} onPress={() => { const on = chats.filter((x) => sel.has(x.id)).some((x) => !x.pinned); useChats.setState((st) => ({ chats: st.chats.map((x) => (sel.has(x.id) ? { ...x, pinned: on } : x)) })); toast(on ? 'أُضيفت للمفضلة' : 'أُزيلت من المفضلة'); }} />
          <Button small kind="danger" icon="trash-2" title="حذف" disabled={!sel.size} onPress={() => setConfirmDel(true)} />
          <T size={12.5} color="muted">{sel.size ? sel.size + ' محدد' : ''}</T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 16, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {tabBtn('all', 'الكل', all.length)}
        {tabBtn('fav', 'المفضلة', all.filter((x) => x.pinned).length)}
        {curTag ? tabBtn(tab, curTag.name, all.filter((x) => x.tags?.includes(curTag.id)).length) : null}
      </View>
      <FlatList
        data={view}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}
        ListEmptyComponent={
          q ? <Empty icon="search" title="لا نتائج مطابقة" />
          : !all.length ? <Empty icon="message-circle" title="لا توجد محادثات بعد" sub="ابدأ محادثة جديدة من القائمة." />
          : tab === 'fav' ? <Empty icon="star" title="لا توجد محادثات مفضلة" sub="أضف محادثة للمفضلة من قائمة ⋮ على البطاقة." />
          : <Empty icon="tag" title="لا توجد محادثات بهذا الوسم" sub="أضف الوسم من قائمة ⋮ في أي محادثة." />
        }
        renderItem={({ item }) => {
          const last = item.messages[item.messages.length - 1];
          const prev = (last?.content || '').replace(/\s+/g, ' ').trim().slice(0, 160) || 'محادثة فارغة';
          const tg = (item.tags ?? []).map((id) => tags.find((t) => t.id === id)).filter(Boolean) as typeof tags;
          const on = sel.has(item.id);
          return (
            <Pressable onPress={() => (multi ? toggle(item.id) : open(item.id))} onLongPress={() => { if (!multi) { setMulti(true); setSel(new Set([item.id])); } }} style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1.5, borderColor: on ? c.accent : c.border, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {multi ? <Icon name={on ? 'check-circle' : 'circle'} size={22} color={on ? c.accent : c.muted} /> : null}
                <T size={16} weight="semibold" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{item.title}</T>
                {item.pinned ? <Icon name="star" size={17} color={c.accent} /> : null}
                {!multi ? <IconButton name="more-vertical" size={19} label="المزيد" onPress={() => setActions(item.id)} style={{ width: 34, height: 34 }} /> : null}
              </View>
              <T size={13} color="text2" numberOfLines={2}>{prev}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 }}>
                  <T size={12} color="muted">{item.messages.length} رسالة · {new Date(item.updated).toLocaleDateString('ar', { day: 'numeric', month: 'short' })}</T>
                  <TagLabels tags={tg} />
                </View>
                {!multi ? <Button small kind="soft" title="فتح" onPress={() => open(item.id)} /> : null}
              </View>
            </Pressable>
          );
        }}
      />

      {/* قائمة الوسوم */}
      <Dialog visible={tagMenu} title="الوسوم" onClose={() => setTagMenu(false)} actions={[{ title: 'إغلاق', onPress: () => setTagMenu(false) }]}>
        <View style={{ gap: 6 }}>
          {tab.startsWith('tag:') ? <Pressable onPress={() => { setTab('all'); setTagMenu(false); }} style={{ padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="list" size={18} color={c.text2} /><T>كل المحادثات</T></Pressable> : null}
          {tags.length === 0 ? <T size={13} color="muted" style={{ textAlign: 'center', padding: 12 }}>لا توجد وسوم بعد</T> : null}
          {tags.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => { setTab('tag:' + t.id); setTagMenu(false); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
                <TagDot color={t.color} size={12} />
                <View style={{ flex: 1 }}>
                  <T weight={tab === 'tag:' + t.id ? 'bold' : 'regular'}>{t.name}</T>
                  {t.desc ? <T size={11.5} color="muted" numberOfLines={1}>{t.desc}</T> : null}
                </View>
                <T size={12} color="muted">{all.filter((x) => x.tags?.includes(t.id)).length}</T>
              </Pressable>
              <IconButton name="edit-2" size={17} label="تعديل" style={{ width: 34, height: 34 }} onPress={() => { setTagMenu(false); setTimeout(() => setEditor({ id: t.id }), 250); }} />
              <IconButton name="trash-2" size={17} label="حذف" style={{ width: 34, height: 34 }} onPress={() => { setTagMenu(false); setTimeout(() => setDelTag(t.id), 250); }} />
            </View>
          ))}
        </View>
      </Dialog>
      <TagEditor visible={!!editor} editId={editor?.id} onClose={() => setEditor(null)} />
      <TagPicker ids={picker} onClose={() => setPicker(null)} />
      <ChatActions chatId={actions} onClose={() => setActions(null)} />
      <Dialog
        visible={confirmDel}
        title={`حذف ${sel.size} محادثة؟`}
        message="لا يمكن التراجع عن الحذف."
        onClose={() => setConfirmDel(false)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { sel.forEach((id) => { const ch = useChats.getState().chats.find((x) => x.id === id); if (ch) void deleteImages(ch.messages.flatMap((m) => m.imgs || [])); useChats.getState().remove(id); }); setSel(new Set()); setMulti(false); setConfirmDel(false); toast('تم الحذف'); } },
          { title: 'إلغاء', onPress: () => setConfirmDel(false) },
        ]}
      />
      <Dialog
        visible={!!delTag}
        title={`حذف الوسم «${tags.find((t) => t.id === delTag)?.name ?? ''}»؟`}
        message="سيُزال من كل المحادثات."
        onClose={() => setDelTag(null)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (delTag) useTags.getState().remove(delTag); if (tab === 'tag:' + delTag) setTab('all'); setDelTag(null); toast('تم حذف الوسم'); } },
          { title: 'إلغاء', onPress: () => setDelTag(null) },
        ]}
      />
    </SafeAreaView>
  );
}
