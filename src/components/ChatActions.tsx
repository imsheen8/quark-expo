import { useState } from 'react';
import { View } from 'react-native';
import { chatToJSON, chatToMarkdown, chatToText, safeName } from '../lib/chatFormat';
import { shareFile } from '../lib/share';
import { deleteImages } from '../lib/images';
import { makeTitle } from '../api/generate';
import { useChats } from '../store/chats';
import { toast } from '../store/data';
import { Dialog, Field, Group, Row, Sheet } from './ui/kit';
import { TagPicker } from './TagDialogs';

/** قائمة إجراءات محادثة: إعادة تسمية، تثبيت، عنوان تلقائي، تصدير، حذف */
export function ChatActions({ chatId, onClose, onDeleted }: { chatId: string | null; onClose: () => void; onDeleted?: () => void }) {
  const chat = useChats((s) => s.chats.find((c) => c.id === chatId));
  const [rename, setRename] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [tagIds, setTagIds] = useState<string[] | null>(null);

  const exp = async (kind: 'md' | 'txt' | 'json') => {
    if (!chat) return;
    onClose();
    try {
      const name = safeName(chat.title);
      if (kind === 'md') await shareFile(name + '.md', chatToMarkdown(chat), 'text/markdown');
      else if (kind === 'txt') await shareFile(name + '.txt', chatToText(chat));
      else await shareFile(name + '.json', chatToJSON(chat), 'application/json');
    } catch {
      toast('تعذّر التصدير');
    }
  };

  return (
    <>
      <Sheet visible={!!chat && rename === null && !confirm && !tagIds} onClose={onClose} title={chat?.title}>
        <View style={{ padding: 16 }}>
          <Group>
            <Row icon="edit-2" title="إعادة تسمية" onPress={() => setRename(chat?.title ?? '')} />
            <Row icon="star" title={chat?.pinned ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} onPress={() => { if (chat) useChats.getState().togglePin(chat.id); onClose(); }} />
            <Row icon="tag" title="إضافة وسم" onPress={() => chat && setTagIds([chat.id])} />
            <Row icon="zap" title="عنوان تلقائي بالنموذج" onPress={() => { if (chat) void makeTitle(chat.id, true); onClose(); }} />
            <Row icon="file-text" title="تصدير Markdown" onPress={() => exp('md')} />
            <Row icon="align-left" title="تصدير نص" onPress={() => exp('txt')} />
            <Row icon="code" title="تصدير JSON" onPress={() => exp('json')} />
            <Row icon="trash-2" title="حذف المحادثة" danger onPress={() => setConfirm(true)} />
          </Group>
        </View>
      </Sheet>
      <TagPicker ids={tagIds} onClose={() => { setTagIds(null); onClose(); }} />
      <Dialog
        visible={rename !== null}
        title="إعادة تسمية المحادثة"
        onClose={() => { setRename(null); onClose(); }}
        actions={[
          { title: 'حفظ', onPress: () => { if (chat && rename) useChats.getState().rename(chat.id, rename); setRename(null); onClose(); } },
          { title: 'إلغاء', onPress: () => { setRename(null); onClose(); } },
        ]}
      >
        <Field value={rename ?? ''} onChangeText={setRename} autoFocus />
      </Dialog>
      <Dialog
        visible={confirm}
        title="حذف المحادثة؟"
        message="سيُحذف هذا الحوار نهائيًا من جهازك."
        onClose={() => { setConfirm(false); onClose(); }}
        actions={[
          {
            title: 'حذف',
            kind: 'danger',
            onPress: () => {
              if (chat) {
                void deleteImages(chat.messages.flatMap((m) => m.imgs || []));
                useChats.getState().remove(chat.id);
              }
              setConfirm(false);
              onClose();
              onDeleted?.();
            },
          },
          { title: 'إلغاء', onPress: () => { setConfirm(false); onClose(); } },
        ]}
      />
    </>
  );
}
