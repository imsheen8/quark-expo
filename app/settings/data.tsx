import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import { Dialog, Group, Row, Screen, T } from '../../src/components/ui/kit';
import { deleteImages } from '../../src/lib/images';
import { shareFile } from '../../src/lib/share';
import { useChats } from '../../src/store/chats';
import { toast, useLibrary, useMemory, useUsage } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';

export default function Data() {
  const chats = useChats((s) => s.chats.length);
  const [confirm, setConfirm] = useState<null | 'chats' | 'usage' | 'all'>(null);

  const exportAll = async () => {
    const st = useSettings.getState();
    const payload = {
      app: 'quark-ai', version: 1, exportedAt: new Date().toISOString(),
      settings: { ...st, patch: undefined, addEndpoint: undefined },
      chats: useChats.getState().chats.filter((c) => !c.temp).map((c) => ({ ...c, messages: c.messages.map(({ imgs, ...m }) => m) })),
      library: useLibrary.getState().items,
      memory: useMemory.getState().items,
    };
    try {
      await shareFile(`quark-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload), 'application/json');
    } catch {
      toast('تعذّر التصدير');
    }
  };

  const importAll = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (r.canceled) return;
      const j = JSON.parse(await FileSystem.readAsStringAsync(r.assets[0].uri));
      if (j?.app !== 'quark-ai') return toast('الملف ليس نسخة QUARK AI');
      if (Array.isArray(j.chats)) useChats.getState().replaceAll(j.chats);
      if (Array.isArray(j.library)) useLibrary.getState().replaceAll(j.library);
      if (Array.isArray(j.memory)) useMemory.getState().replaceAll(j.memory);
      if (j.settings && typeof j.settings === 'object') {
        const { endpoints, sel, theme, themeSel, fontSize, systemPrompt, autoTitle, params, profile, memory, thinking } = j.settings;
        useSettings.getState().patch(JSON.parse(JSON.stringify({ endpoints, sel, theme, themeSel, fontSize, systemPrompt, autoTitle, params, profile, memory, thinking })));
      }
      toast('تم الاستيراد');
    } catch {
      toast('ملف غير صالح');
    }
  };

  const run = async () => {
    if (confirm === 'chats' || confirm === 'all') {
      await deleteImages(useChats.getState().chats.flatMap((c) => c.messages.flatMap((m) => m.imgs || [])));
      useChats.getState().clearAll();
    }
    if (confirm === 'usage' || confirm === 'all') useUsage.getState().clear();
    if (confirm === 'all') {
      useMemory.getState().clear();
      useSettings.setState({ endpoints: [], sel: null });
    }
    setConfirm(null);
    toast('تم الحذف');
  };

  return (
    <Screen title="التخزين والنسخ الاحتياطي">
      <Group title="النسخ الاحتياطي" footer="تحتوي النسخة على مفاتيح API (نصًا صريحًا) — احفظها في مكان آمن ولا تشاركها.">
        <Row icon="upload" title="تصدير نسخة احتياطية" sub={`${chats} محادثة + الإعدادات والمكتبة والذاكرة`} onPress={exportAll} />
        <Row icon="download" title="استيراد نسخة احتياطية" sub="يستبدل المحادثات والمكتبة والذاكرة الحالية" onPress={importAll} />
      </Group>
      <Group title="حذف البيانات">
        <Row icon="message-square" title="حذف كل المحادثات" danger onPress={() => setConfirm('chats')} />
        <Row icon="bar-chart-2" title="مسح الإحصائيات" danger onPress={() => setConfirm('usage')} />
        <Row icon="alert-triangle" title="حذف كل شيء" sub="المحادثات والذاكرة والمفاتيح والإحصائيات" danger onPress={() => setConfirm('all')} />
      </Group>
      <T size={12} color="muted">كل بياناتك مخزّنة على هذا الجهاز فقط.</T>
      <Dialog
        visible={!!confirm}
        title="تأكيد الحذف"
        message="لا يمكن التراجع عن هذا الإجراء."
        onClose={() => setConfirm(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: run }, { title: 'إلغاء', onPress: () => setConfirm(null) }]}
      />
    </Screen>
  );
}
