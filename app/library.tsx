import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LibItem, Skill } from '../src/api/types';
import { useSkillsUi } from '../src/components/SkillsPanel';
import { TagDot, TagEditor, TagLabels, TagPicker } from '../src/components/TagDialogs';
import { MenuIcon } from '../src/components/ui/MenuIcon';
import { Button, Chip, Dialog, Empty, Field, Icon, IconButton, Sheet, T, haptic } from '../src/components/ui/kit';
import { toast, useLibrary, useSkills, useUi } from '../src/store/data';
import { useChats } from '../src/store/chats';
import { syncSkillTags, tagStoreFor, usePersonaTags, useSkillTags, useTemplateTags, type Tag, type TagTarget } from '../src/store/tags';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

type Kind = 'persona' | 'template' | 'skill';
type Tab = 'all' | 'fav' | Kind | `tag:${Kind}:${string}`;
const KIND_LABEL: Record<Kind, string> = { persona: 'الشخصيات', template: 'القوالب', skill: 'المهارات' };
const parseTag = (tab: Tab): { kind: Kind; id: string } | null => {
  if (!tab.startsWith('tag:')) return null;
  const [, kind, ...rest] = tab.split(':');
  return { kind: kind as Kind, id: rest.join(':') };
};

export default function Library() {
  const c = useColors();
  const router = useRouter();
  const { items, add, update, remove } = useLibrary();
  const active = useSettings((s) => s.activePersonaId);
  const patch = useSettings((s) => s.patch);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const setSidebar = useUi((s) => s.setSidebar);
  const [actions, setActions] = useState<LibItem | null>(null);
  const [skillMenu, setSkillMenu] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const skillsN = useSkills((s) => s.items.length);
  const pTags = usePersonaTags((s) => s.items);
  const tTags = useTemplateTags((s) => s.items);
  const sTags = useSkillTags((s) => s.items);
  const tagsOf: Record<Kind, Tag[]> = { persona: pTags, template: tTags, skill: sTags };
  const skillItems = useSkills((s) => s.items);
  useEffect(() => { syncSkillTags(); }, [skillItems]);
  const tt = parseTag(tab);
  // نوع التبويب الحالي (للشخصيات/القوالب/المهارات أو وسم تابع لها)
  const curTagObj = tt ? tagsOf[tt.kind].find((t) => t.id === tt.id) ?? null : null;
  const sk = useSkillsUi(q, skillMenu, () => setSkillMenu(false), tt?.kind === 'skill' ? curTagObj?.name ?? '\u0000' : null, (k) => setPicker({ ids: [k.id], target: 'skill' }));
  const curKind: Kind | null = tab === 'persona' || tab === 'template' || tab === 'skill' ? tab : tt ? tt.kind : null;
  const [multi, setMulti] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tagMenu, setTagMenu] = useState(false);
  const [tagEditor, setTagEditor] = useState<{ id?: string; target: TagTarget } | null>(null);
  const [picker, setPicker] = useState<{ ids: string[]; target: TagTarget } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delTag, setDelTag] = useState<{ id: string; kind: Kind } | null>(null);
  const [form, setForm] = useState<{ id?: string; kind: LibItem['kind']; name: string; text: string } | null>(null);
  const [del, setDel] = useState<LibItem | null>(null);

  const list = useMemo(() => {
    if (tab === 'skill' || tt?.kind === 'skill') return [];
    const t = q.trim().toLowerCase();
    return items
      .filter((i) => tab === 'all' || (tab === 'fav' ? !!i.fav : tt ? i.kind === tt.kind && !!i.tags?.includes(tt.id) : i.kind === tab))
      .filter((i) => !t || i.name.toLowerCase().includes(t) || i.text.toLowerCase().includes(t))
      .sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || b.ts - a.ts);
  }, [items, tab, q, tt?.kind, tt?.id]);

  type Entry = { k: 'lib'; i: LibItem; key: string } | { k: 'skill'; s: Skill; key: string };
  const data: Entry[] = [
    ...list.map((i) => ({ k: 'lib' as const, i, key: i.id })),
    ...((tab === 'all' && !multi) || tab === 'skill' || tt?.kind === 'skill' ? sk.list.map((s) => ({ k: 'skill' as const, s, key: 's' + s.id })) : []),
  ];
  const curTag = curTagObj;
  const countTag = (kind: Kind, t: Tag) => (kind === 'skill' ? skillItems.filter((k) => k.tags.includes(t.name)).length : items.filter((x) => x.kind === kind && x.tags?.includes(t.id)).length);
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selList: { id: string }[] = curKind === 'skill' ? sk.list : list;
  const allSelected = selList.length > 0 && selList.every((x) => sel.has(x.id));
  const exitMulti = () => { setMulti(false); setSel(new Set()); };
  const switchTab = (k: Tab) => { haptic(); setTab(k); if ((k === 'skill' || parseTag(k)?.kind === 'skill') !== (curKind === 'skill')) exitMulti(); };

  const use = (i: LibItem) => {
    if (i.kind === 'persona') {
      const on = active === i.id;
      patch({ activePersonaId: on ? null : i.id });
      toast(on ? 'أُلغيت الشخصية' : 'الشخصية المفعّلة: ' + i.name);
    } else {
      useChats.getState().setCurrent(null);
      useUi.getState().setDraft(i.text);
      router.replace('/');
    }
  };

  const save = () => {
    if (!form || !form.name.trim() || !form.text.trim()) return toast('أدخل الاسم والنص');
    if (form.id) update(form.id, { name: form.name.trim(), text: form.text, kind: form.kind });
    else add({ kind: form.kind, name: form.name.trim(), text: form.text });
    setForm(null);
  };

  const tabBtn = (k: Tab, label: string, n: number) => (
    <Pressable key={k} onPress={() => switchTab(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderBottomWidth: 2.5, borderBottomColor: tab === k ? c.accent : 'transparent', marginBottom: -1 }}>
      <T size={14} weight="medium" color={tab === k ? 'accent' : 'text2'}>{label}</T>
      <T size={12} color="muted">{n}</T>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 56 }}>
        <Pressable onPress={() => { haptic(); setSidebar(true); }} accessibilityLabel="القائمة" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MenuIcon /></Pressable>
        <T size={20} weight="bold" style={{ flex: 1 }}>المكتبة</T>
        <IconButton name="search" label="بحث" active={searching} onPress={() => { setSearching((v) => !v); setQ(''); }} />
        <IconButton name="check-square" label="تحديد متعدد" active={multi} onPress={() => { setMulti((v) => !v); setSel(new Set()); }} />
        <IconButton name="tag" label="الوسوم" active={!!curTag || tagMenu} onPress={() => setTagMenu(true)} color={curTag?.color} />
        <IconButton name="plus-circle" label="إضافة" onPress={() => (curKind === 'skill' ? setSkillMenu(true) : !curKind ? setAddMenu(true) : setForm({ kind: curKind, name: '', text: '' }))} />
      </View>
      {searching ? (
        <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: c.accent, height: 44 }}>
          <Icon name="search" size={18} color={c.accent} />
          <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} autoFocus value={q} onChangeText={setQ} placeholder="بحث" placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 15, textAlign: 'auto' }} />
        </View>
      ) : null}
      {multi ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Button small kind="soft" title={allSelected ? 'إلغاء التحديد' : 'تحديد الكل'} onPress={() => setSel(allSelected ? new Set() : new Set(selList.map((x) => x.id)))} />
          <Button small kind="soft" icon="tag" title="وسم" disabled={!sel.size} onPress={() => { if (curKind === 'skill') return setPicker({ ids: [...sel], target: 'skill' }); const kinds = new Set(items.filter((x) => sel.has(x.id)).map((x) => x.kind)); if (kinds.size !== 1) return toast('حدّد عناصر من نوع واحد (شخصيات أو قوالب) لإضافة وسم'); setPicker({ ids: [...sel], target: [...kinds][0] }); }} />
          {curKind !== 'skill' ? <Button small kind="soft" icon="star" title="مفضلة" disabled={!sel.size} onPress={() => { const on = items.filter((x) => sel.has(x.id)).some((x) => !x.fav); sel.forEach((id) => update(id, { fav: on })); toast(on ? 'أُضيفت للمفضلة' : 'أُزيلت من المفضلة'); }} /> : null}
          <Button small kind="danger" icon="trash-2" title="حذف" disabled={!sel.size} onPress={() => setConfirmDel(true)} />
          <T size={12.5} color="muted">{sel.size ? sel.size + ' محدد' : ''}</T>
        </View>
      ) : null}
      <View style={{ marginHorizontal: 16, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {tabBtn('all', 'الكل', items.length + skillsN)}
          {tabBtn('fav', 'المفضلة', items.filter((i) => i.fav).length)}
          {curTag ? tabBtn(tab, curTag.name, countTag(tt!.kind, curTag)) : null}
          {tabBtn('persona', 'الشخصيات', items.filter((i) => i.kind === 'persona').length)}
          {tabBtn('template', 'القوالب', items.filter((i) => i.kind === 'template').length)}
          {tabBtn('skill', 'المهارات', skillsN)}
        </ScrollView>
      </View>
      <FlatList
        data={data}
        keyExtractor={(e) => e.key}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}
        ListHeaderComponent={curKind === 'skill' ? sk.header : null}
        ListEmptyComponent={<Empty icon="book-open" title={q ? 'لا نتائج مطابقة' : tab === 'skill' ? 'لا توجد مهارات' : tab === 'fav' ? 'لا توجد عناصر مفضلة' : curTag ? 'لا توجد عناصر بهذا الوسم' : 'لا يوجد شيء هنا'} sub={tab === 'fav' ? 'أضف عنصرًا للمفضلة من قائمة ⋮ على البطاقة.' : 'أضف قوالب وشخصيات لتستخدمها بسرعة. اكتب / في المحادثة لاستدعائها.'} />}
        renderItem={({ item: e }) => {
          if (e.k === 'skill') return sk.renderCard(e.s, multi ? { picked: sel.has(e.s.id), toggle: () => toggle(e.s.id) } : undefined);
          const i = e.i;
          const on = i.kind === 'persona' && active === i.id;
          const picked = sel.has(i.id);
          const tg = (i.tags ?? []).map((id) => tagsOf[i.kind].find((t) => t.id === id)).filter(Boolean) as Tag[];
          return (
            <Pressable onPress={() => (multi ? toggle(i.id) : use(i))} onLongPress={() => { if (!multi) { setMulti(true); setSel(new Set([i.id])); } }} style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1.5, borderColor: picked || on ? c.accent : c.border, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {multi ? <Icon name={picked ? 'check-circle' : 'circle'} size={22} color={picked ? c.accent : c.muted} /> : null}
                <T size={16} weight="semibold" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{i.name}</T>
                {i.fav ? <Icon name="star" size={17} color={c.accent} /> : null}
                {!multi ? <IconButton name="more-vertical" size={19} label="المزيد" onPress={() => setActions(i)} style={{ width: 34, height: 34 }} /> : null}
              </View>
              <T size={13} color="text2" numberOfLines={2}>{i.text}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 }}>
                  <T size={12} color="muted">{i.kind === 'persona' ? 'شخصية' : 'قالب'}{on ? ' · مفعّلة' : ''}</T>
                  <TagLabels tags={tg} />
                </View>
                {!multi ? <Button small kind={on ? 'ghost' : 'soft'} title={i.kind === 'persona' ? (on ? 'إلغاء التفعيل' : 'تفعيل') : 'استخدام'} onPress={() => use(i)} /> : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Dialog
        visible={!!actions}
        title={actions?.name ?? ''}
        onClose={() => setActions(null)}
        actions={[
          { title: actions?.fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة', onPress: () => { if (actions) update(actions.id, { fav: !actions.fav }); setActions(null); } },
          { title: 'الوسوم', onPress: () => { const x = actions; setActions(null); if (x) setTimeout(() => setPicker({ ids: [x.id], target: x.kind }), 250); } },
          { title: 'تعديل', onPress: () => { if (actions) setForm({ id: actions.id, kind: actions.kind, name: actions.name, text: actions.text }); setActions(null); } },
          { title: 'حذف', kind: 'danger', onPress: () => { const x = actions; setActions(null); if (x) setTimeout(() => setDel(x), 250); } },
        ]}
      />
      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'تعديل عنصر' : 'عنصر جديد'} full>
        {form ? (
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="قالب" icon="file-text" active={form.kind === 'template'} onPress={() => setForm({ ...form, kind: 'template' })} />
              <Chip label="شخصية" icon="user" active={form.kind === 'persona'} onPress={() => setForm({ ...form, kind: 'persona' })} />
            </View>
            <Field label="الاسم" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} autoCapitalize="sentences" />
            <Field label={form.kind === 'persona' ? 'تعليمات الشخصية' : 'نص القالب'} multiline value={form.text} onChangeText={(t) => setForm({ ...form, text: t })} inputStyle={{ minHeight: 140 }} />
            {form.kind === 'template' ? <T size={12} color="muted">للمتغيرات استخدم {'{{الاسم}}'} أو {'{{الاسم|قيمة افتراضية}}'}.</T> : null}
            <Button title="حفظ" icon="check" onPress={save} />
          </View>
        ) : null}
      </Sheet>
      {sk.overlays}
      <Dialog
        visible={addMenu}
        title="إضافة"
        onClose={() => setAddMenu(false)}
        actions={[
          { title: 'قالب', onPress: () => { setAddMenu(false); setTimeout(() => setForm({ kind: 'template', name: '', text: '' }), 250); } },
          { title: 'شخصية', onPress: () => { setAddMenu(false); setTimeout(() => setForm({ kind: 'persona', name: '', text: '' }), 250); } },
          { title: 'مهارة', onPress: () => { setAddMenu(false); setTimeout(() => setSkillMenu(true), 250); } },
        ]}
      />
      {/* قائمة الوسوم: تتغير بحسب التبويب (وسوم كل نوع منفصلة) */}
      <Dialog visible={tagMenu} title={curKind ? 'وسوم ' + KIND_LABEL[curKind] : 'الوسوم'} onClose={() => setTagMenu(false)} actions={[{ title: 'إغلاق', onPress: () => setTagMenu(false) }]}>
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ gap: 6 }}>
            {tt ? <Pressable onPress={() => { setTab(tt.kind); setTagMenu(false); }} style={{ padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="list" size={18} color={c.text2} /><T>كل {KIND_LABEL[tt.kind]}</T></Pressable> : null}
            {(curKind ? [curKind] : (['persona', 'template', 'skill'] as Kind[])).map((k) => (
              <View key={k} style={{ gap: 2 }}>
                {!curKind ? <T size={12.5} weight="semibold" color="muted" style={{ paddingHorizontal: 10, paddingTop: 6 }}>{KIND_LABEL[k]}</T> : null}
                {tagsOf[k].length === 0 ? <T size={13} color="muted" style={{ textAlign: 'center', padding: 12 }}>لا توجد وسوم بعد</T> : null}
                {tagsOf[k].map((t) => (
                  <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={() => { setTab(('tag:' + k + ':' + t.id) as Tab); setTagMenu(false); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
                      <TagDot color={t.color} size={12} />
                      <View style={{ flex: 1 }}>
                        <T weight={tab === 'tag:' + k + ':' + t.id ? 'bold' : 'regular'}>{t.name}</T>
                        {t.desc ? <T size={11.5} color="muted" numberOfLines={1}>{t.desc}</T> : null}
                      </View>
                      <T size={12} color="muted">{countTag(k, t)}</T>
                    </Pressable>
                    {curKind ? (
                      <>
                        <IconButton name="edit-2" size={17} label="تعديل" style={{ width: 34, height: 34 }} onPress={() => { setTagMenu(false); setTimeout(() => setTagEditor({ id: t.id, target: k }), 250); }} />
                        <IconButton name="trash-2" size={17} label="حذف" style={{ width: 34, height: 34 }} onPress={() => { setTagMenu(false); setTimeout(() => setDelTag({ id: t.id, kind: k }), 250); }} />
                      </>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
            {curKind && curKind !== 'skill' ? (
              <Pressable onPress={() => { setTagMenu(false); setTimeout(() => setTagEditor({ target: curKind }), 250); }} style={{ padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="plus-circle" size={18} color={c.accent} /><T color="accent">وسم جديد</T></Pressable>
            ) : null}
            {!curKind ? <T size={12} color="muted" style={{ padding: 10 }}>لإدارة الوسوم (إنشاء/تعديل/حذف) افتح تبويب الشخصيات أو القوالب أو المهارات.</T> : null}
          </View>
        </ScrollView>
      </Dialog>
      <TagEditor target={tagEditor?.target ?? 'persona'} visible={!!tagEditor} editId={tagEditor?.id} onClose={() => setTagEditor(null)} />
      <TagPicker target={picker?.target ?? 'persona'} ids={picker?.ids ?? null} onClose={() => setPicker(null)} />
      <Dialog
        visible={confirmDel}
        title={`حذف ${sel.size} عنصر؟`}
        message="لا يمكن التراجع عن الحذف."
        onClose={() => setConfirmDel(false)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (curKind === 'skill') useSkills.getState().remove([...sel]); else sel.forEach((id) => { remove(id); if (active === id) patch({ activePersonaId: null }); }); exitMulti(); setConfirmDel(false); toast('تم الحذف'); } },
          { title: 'إلغاء', onPress: () => setConfirmDel(false) },
        ]}
      />
      <Dialog
        visible={!!delTag}
        title={`حذف الوسم «${delTag ? tagsOf[delTag.kind].find((t) => t.id === delTag.id)?.name ?? '' : ''}»؟`}
        message={delTag ? 'سيُزال من كل ' + KIND_LABEL[delTag.kind] + '.' : ''}
        onClose={() => setDelTag(null)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (delTag) { tagStoreFor(delTag.kind).getState().remove(delTag.id); if (tab === 'tag:' + delTag.kind + ':' + delTag.id) setTab(delTag.kind); } setDelTag(null); toast('تم حذف الوسم'); } },
          { title: 'إلغاء', onPress: () => setDelTag(null) },
        ]}
      />
      <Dialog
        visible={!!del}
        title="حذف العنصر؟"
        message={del?.name}
        onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { if (del) { remove(del.id); if (active === del.id) patch({ activePersonaId: null }); } setDel(null); } }, { title: 'إلغاء', onPress: () => setDel(null) }]}
      />
    </SafeAreaView>
  );
}
