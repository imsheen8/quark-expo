import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { LibItem } from '../src/api/types';
import { Button, Card, Chip, Dialog, Empty, Field, IconButton, Screen, Sheet, T } from '../src/components/ui/kit';
import { toast, useLibrary, useUi } from '../src/store/data';
import { useChats } from '../src/store/chats';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

type Tab = 'all' | 'persona' | 'template';

export default function Library() {
  const c = useColors();
  const router = useRouter();
  const { items, add, update, remove } = useLibrary();
  const active = useSettings((s) => s.activePersonaId);
  const patch = useSettings((s) => s.patch);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ id?: string; kind: LibItem['kind']; name: string; text: string } | null>(null);
  const [del, setDel] = useState<LibItem | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items
      .filter((i) => tab === 'all' || i.kind === tab)
      .filter((i) => !t || i.name.toLowerCase().includes(t) || i.text.toLowerCase().includes(t))
      .sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || b.ts - a.ts);
  }, [items, tab, q]);

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

  return (
    <Screen title="المكتبة" menu right={<IconButton name="plus" onPress={() => setForm({ kind: tab === 'persona' ? 'persona' : 'template', name: '', text: '' })} label="إضافة" />}>
      <Field placeholder="ابحث في المكتبة…" value={q} onChangeText={setQ} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="الكل" active={tab === 'all'} onPress={() => setTab('all')} />
        <Chip label="الشخصيات" icon="user" active={tab === 'persona'} onPress={() => setTab('persona')} />
        <Chip label="القوالب" icon="file-text" active={tab === 'template'} onPress={() => setTab('template')} />
      </View>
      {list.length === 0 ? <Empty icon="book-open" title="لا يوجد شيء هنا" sub="أضف قوالب وشخصيات لتستخدمها بسرعة. اكتب / في المحادثة لاستدعائها." /> : null}
      {list.map((i) => {
        const on = i.kind === 'persona' && active === i.id;
        return (
          <Card key={i.id} style={on ? { borderColor: c.accent } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="semibold" style={{ flex: 1 }}>{i.name}</T>
              <T size={11.5} color="accent" style={{ backgroundColor: c.accentSoft, paddingHorizontal: 8, borderRadius: 8 }}>{i.kind === 'persona' ? 'شخصية' : 'قالب'}</T>
              <IconButton name={i.fav ? 'star' : 'star'} color={i.fav ? c.accent : c.muted} size={18} onPress={() => update(i.id, { fav: !i.fav })} style={{ width: 32, height: 32 }} />
            </View>
            <T size={13} color="text2" numberOfLines={3}>{i.text}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title={i.kind === 'persona' ? (on ? 'إلغاء التفعيل' : 'تفعيل') : 'استخدام'} icon={i.kind === 'persona' ? 'user-check' : 'send'} small kind={on ? 'ghost' : 'primary'} onPress={() => use(i)} style={{ flex: 1 }} />
              <Button title="تعديل" icon="edit-2" small kind="soft" onPress={() => setForm({ id: i.id, kind: i.kind, name: i.name, text: i.text })} />
              <Button title="" icon="trash-2" small kind="danger" onPress={() => setDel(i)} />
            </View>
          </Card>
        );
      })}

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
      <Dialog
        visible={!!del}
        title="حذف العنصر؟"
        message={del?.name}
        onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { if (del) { remove(del.id); if (active === del.id) patch({ activePersonaId: null }); } setDel(null); } }, { title: 'إلغاء', onPress: () => setDel(null) }]}
      />
    </Screen>
  );
}
