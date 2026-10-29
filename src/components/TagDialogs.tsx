import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { TAG_COLORS } from '../lib/chatFilter';
import { useChats } from '../store/chats';
import { toast, useLibrary, useSkills } from '../store/data';
import { setItemTag, tagStoreFor, type Tag, type TagTarget } from '../store/tags';
import { useColors } from '../theme';
import { Button, Field, Icon, IconButton, Sheet, T } from './ui/kit';

export const TagDot = ({ color, size = 10 }: { color: string; size?: number }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;

/** إنشاء/تعديل وسم */
export function TagEditor({ visible, editId, onClose, target = 'chat' }: { visible: boolean; editId?: string | null; onClose: () => void; target?: TagTarget }) {
  const c = useColors();
  const { items, add, update } = tagStoreFor(target)();
  const t = items.find((x) => x.id === editId);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  useEffect(() => {
    if (visible) { setName(t?.name ?? ''); setDesc(t?.desc ?? ''); setColor(t?.color ?? TAG_COLORS[items.length % TAG_COLORS.length]); }
  }, [visible, editId]);
  const save = () => {
    if (!name.trim()) return toast('اكتب اسم الوسم');
    if (t) { if (!update(t.id, name, color, desc)) return toast('هذا الوسم موجود مسبقًا'); toast('تم حفظ التعديل'); }
    else { const n = add(name, color, desc); if (!n) return; toast('تم إنشاء الوسم'); }
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t ? 'تعديل الوسم' : 'إنشاء وسم'}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TagDot color={color} size={14} />
          <T weight="medium">{name.trim() || 'اسم الوسم'}</T>
        </View>
        <Field label="الاسم" value={name} onChangeText={setName} maxLength={24} />
        <Field label="الوصف (اختياري)" value={desc} onChangeText={setDesc} maxLength={120} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {TAG_COLORS.map((x) => (
            <Pressable key={x} onPress={() => setColor(x)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: x, alignItems: 'center', justifyContent: 'center', borderWidth: color === x ? 3 : 0, borderColor: c.text }}>
              {color === x ? <Icon name="check" size={18} color="#fff" /> : null}
            </Pressable>
          ))}
        </View>
        <Button title={t ? 'حفظ' : 'إنشاء'} onPress={save} />
      </ScrollView>
    </Sheet>
  );
}

/** اختيار وسوم لمحادثة أو أكثر */
export function TagPicker({ ids, onClose, target = 'chat' }: { ids: string[] | null; onClose: () => void; target?: TagTarget }) {
  const c = useColors();
  const items = tagStoreFor(target)((s) => s.items);
  const chats = useChats((s) => s.chats);
  const lib = useLibrary((s) => s.items);
  const skills = useSkills((s) => s.items);
  const [name, setName] = useState('');
  const pool: { id: string; tags?: string[] }[] = target === 'chat' ? chats : target === 'skill' ? skills : lib;
  const sel = ids ? pool.filter((x) => ids.includes(x.id)) : [];
  const has = (x: { tags?: string[] }, t: Tag) => !!x.tags?.includes(target === 'skill' ? t.name : t.id);
  const create = () => {
    const t = tagStoreFor(target).getState().add(name);
    if (!t) return toast('اكتب اسم الوسم');
    if (ids) setItemTag(target, ids, t.id, true);
    setName('');
  };
  return (
    <Sheet visible={!!ids} onClose={onClose} title={target === 'chat' ? (ids && ids.length > 1 ? `وسوم ${ids.length} محادثات` : 'وسوم المحادثة') : ids && ids.length > 1 ? `وسوم ${ids.length} عناصر` : 'وسوم العنصر'} full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field placeholder="وسم جديد…" value={name} onChangeText={setName} onSubmitEditing={create} maxLength={24} /></View>
          <IconButton name="plus" label="إضافة" onPress={create} style={{ backgroundColor: c.accentSoft }} />
        </View>
        {items.length === 0 ? <T size={13} color="muted" style={{ textAlign: 'center', padding: 20 }}>لا توجد وسوم بعد — أضف أول وسم من الحقل أعلاه</T> : null}
        {items.map((t) => {
          const have = sel.filter((x) => has(x, t)).length;
          const on = have > 0 && have === sel.length;
          return (
            <Pressable key={t.id} onPress={() => ids && setItemTag(target, ids, t.id, !on)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: pressed ? c.surface3 : c.surface2 })}>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: on || have ? c.accent : c.muted, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Icon name="check" size={15} color={c.onAccent} /> : have ? <View style={{ width: 10, height: 2, backgroundColor: c.accent }} /> : null}
              </View>
              <TagDot color={t.color} />
              <T style={{ flex: 1 }}>{t.name}</T>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/** وسوم نصّية بشكل #وسم (بلا مربعات) لتوضع بجانب نص البطاقة في نفس السطر */
export function TagLabels({ tags, max = 3 }: { tags: Tag[]; max?: number }) {
  return (
    <>
      {tags.slice(0, max).map((t) => <T key={t.id} size={11.5} style={{ color: t.color }}>#{t.name}</T>)}
      {tags.length > max ? <T size={11.5} color="muted">+{tags.length - max}</T> : null}
    </>
  );
}
