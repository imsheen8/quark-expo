import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { TAG_COLORS } from '../lib/chatFilter';
import { useChats } from '../store/chats';
import { toast } from '../store/data';
import { setChatTag, useTags } from '../store/tags';
import { useColors } from '../theme';
import { Button, Field, Icon, IconButton, Sheet, T } from './ui/kit';

export const TagDot = ({ color, size = 10 }: { color: string; size?: number }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;

/** إنشاء/تعديل وسم */
export function TagEditor({ visible, editId, onClose }: { visible: boolean; editId?: string | null; onClose: () => void }) {
  const c = useColors();
  const { items, add, update } = useTags();
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
export function TagPicker({ ids, onClose }: { ids: string[] | null; onClose: () => void }) {
  const c = useColors();
  const items = useTags((s) => s.items);
  const chats = useChats((s) => s.chats);
  const [name, setName] = useState('');
  const sel = ids ? chats.filter((x) => ids.includes(x.id)) : [];
  const create = () => {
    const t = useTags.getState().add(name);
    if (!t) return toast('اكتب اسم الوسم');
    if (ids) setChatTag(ids, t.id, true);
    setName('');
  };
  return (
    <Sheet visible={!!ids} onClose={onClose} title={ids && ids.length > 1 ? `وسوم ${ids.length} محادثات` : 'وسوم المحادثة'} full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Field placeholder="وسم جديد…" value={name} onChangeText={setName} onSubmitEditing={create} maxLength={24} /></View>
          <IconButton name="plus" label="إضافة" onPress={create} style={{ backgroundColor: c.accentSoft }} />
        </View>
        {items.length === 0 ? <T size={13} color="muted" style={{ textAlign: 'center', padding: 20 }}>لا توجد وسوم بعد — أضف أول وسم من الحقل أعلاه</T> : null}
        {items.map((t) => {
          const have = sel.filter((x) => x.tags?.includes(t.id)).length;
          const on = have > 0 && have === sel.length;
          return (
            <Pressable key={t.id} onPress={() => ids && setChatTag(ids, t.id, !on)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: pressed ? c.surface3 : c.surface2 })}>
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
