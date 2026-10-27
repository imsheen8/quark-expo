import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { MemoryItem } from '../src/api/types';
import { Button, Card, Chip, Dialog, Empty, Field, Group, IconButton, Row, Screen, Switch, T } from '../src/components/ui/kit';
import { isSensitive, MEM_CATS } from '../src/lib/memoryRank';
import { toast, useMemory } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

export default function Memory() {
  const c = useColors();
  const { items, add, update, remove, clear } = useMemory();
  const mem = useSettings((s) => s.memory);
  const patch = useSettings((s) => s.patch);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<MemoryItem['cat']>('fact');
  const [edit, setEdit] = useState<MemoryItem | null>(null);
  const [editText, setEditText] = useState('');
  const [confirm, setConfirm] = useState(false);

  const addIt = () => {
    if (!text.trim()) return;
    if (isSensitive(text)) return toast('لا تُحفظ المفاتيح وكلمات السر وأرقام البطاقات');
    add(text, cat, 'manual');
    setText('');
  };
  const sorted = [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

  return (
    <Screen title="الذاكرة" menu>
      <T size={13} color="text2">حقائق قصيرة تتذكرها عنك في كل المحادثات (هويتك، تفضيلاتك، مشاريعك). تُحقن في سياق النموذج عند الصلة فقط. اكتب «تذكّر: …» في أي رسالة لحفظ شيء تلقائيًا.</T>
      <Group>
        <Row icon="database" title="تفعيل الذاكرة" chevron={false} right={<Switch value={mem.enabled} onValueChange={(v) => patch({ memory: { ...mem, enabled: v } })} />} />
        <Row icon="zap" title="الحفظ التلقائي بأمر «تذكّر»" chevron={false} right={<Switch value={mem.auto} onValueChange={(v) => patch({ memory: { ...mem, auto: v } })} />} />
        <Row
          icon="hash"
          title="الحد الأقصى المحقون"
          sub={`${mem.max} ذكريات في كل رد`}
          chevron={false}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton name="minus" size={18} onPress={() => patch({ memory: { ...mem, max: Math.max(3, mem.max - 1) } })} />
              <IconButton name="plus" size={18} onPress={() => patch({ memory: { ...mem, max: Math.min(20, mem.max + 1) } })} />
            </View>
          }
        />
      </Group>
      <Card>
        <Field placeholder="أضف ذكرى…" value={text} onChangeText={setText} multiline inputStyle={{ minHeight: 64 }} autoCapitalize="sentences" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(MEM_CATS) as MemoryItem['cat'][]).map((k) => (
            <Chip key={k} label={MEM_CATS[k]} active={cat === k} onPress={() => setCat(k)} />
          ))}
        </View>
        <Button title="إضافة" icon="plus" onPress={addIt} disabled={!text.trim()} />
      </Card>
      {sorted.length === 0 ? <Empty icon="database" title="لا توجد ذكريات" sub="أضف ذكرى أو اكتب «تذكّر: …» في المحادثة." /> : null}
      {sorted.map((m) => (
        <Card key={m.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={11.5} color="accent" style={{ backgroundColor: c.accentSoft, paddingHorizontal: 8, borderRadius: 8 }}>{MEM_CATS[m.cat]}</T>
            {m.source === 'auto' ? <T size={11.5} color="muted">تلقائي</T> : null}
            <View style={{ flex: 1 }} />
            <T size={11.5} color="muted">استُخدمت {m.uses}</T>
          </View>
          <Pressable onPress={() => { setEdit(m); setEditText(m.text); }}>
            <T selectable>{m.text}</T>
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            <IconButton name="bookmark" active={m.pinned} size={18} onPress={() => update(m.id, { pinned: !m.pinned })} label="تثبيت" />
            <IconButton name="edit-2" size={18} onPress={() => { setEdit(m); setEditText(m.text); }} label="تعديل" />
            <IconButton name="trash-2" size={18} color={c.danger} onPress={() => remove([m.id])} label="حذف" />
          </View>
        </Card>
      ))}
      {items.length > 0 ? <Button title="مسح كل الذكريات" kind="danger" icon="trash" onPress={() => setConfirm(true)} /> : null}

      <Dialog
        visible={!!edit}
        title="تعديل الذكرى"
        onClose={() => setEdit(null)}
        actions={[{ title: 'حفظ', onPress: () => { if (edit && editText.trim() && !isSensitive(editText)) update(edit.id, { text: editText.trim() }); setEdit(null); } }, { title: 'إلغاء', onPress: () => setEdit(null) }]}
      >
        <Field value={editText} onChangeText={setEditText} multiline autoCapitalize="sentences" />
      </Dialog>
      <Dialog
        visible={confirm}
        title="مسح كل الذكريات؟"
        onClose={() => setConfirm(false)}
        actions={[{ title: 'مسح', kind: 'danger', onPress: () => { clear(); setConfirm(false); } }, { title: 'إلغاء', onPress: () => setConfirm(false) }]}
      />
    </Screen>
  );
}
