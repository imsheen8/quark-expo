import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { buildWebPreview, htmlEntries, wsStats } from '../src/api/workspaceCore';
import { Button, Empty, Group, Row, Screen, Sheet, T } from '../src/components/ui/kit';
import { exportZip } from '../src/lib/wsExport';
import { relTime } from '../src/lib/util';
import { toast } from '../src/store/data';
import { confirmAsk } from '../src/store/features';
import { loadWorkspaces, removeProject, usePreviewHost, useWorkspace } from '../src/store/workspace';
import { FONT } from '../src/theme/themes';

const kb = (n: number) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB');
const MAX_VIEW = 60_000;

export default function WorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const projects = useWorkspace((s) => s.projects);
  const ready = useWorkspace((s) => s.ready);
  const [openId, setOpenId] = useState<string | null>(id ? String(id) : null);
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadWorkspaces(); }, []);
  useEffect(() => { if (id) setOpenId(String(id)); }, [id]);
  const list = useMemo(() => Object.values(projects).sort((a, b) => b.updated - a.updated), [projects]);
  const p = openId ? projects[openId] : undefined;
  const files = p ? Object.keys(p.files).sort() : [];

  const doExport = async () => {
    if (!p) return;
    setBusy(true);
    try { await exportZip(p.files, p.name); } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const doPreview = () => {
    if (!p) return;
    try {
      const html = buildWebPreview(p.files);
      setOpenId(null);
      setTimeout(() => usePreviewHost.getState().open(html), 250);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };
  const doDelete = async () => {
    if (!p) return;
    const ok = await confirmAsk('حذف المشروع', `سيُحذف «${p.name}» وكل ملفاته من الجهاز. لا يمكن التراجع.`, { confirm: 'حذف', cancel: 'إلغاء' });
    if (!ok) return;
    setOpenId(null);
    await removeProject(p.id);
  };

  return (
    <Screen title="مشاريع الوكيل" back>
      {!ready ? null : list.length === 0 ? (
        <Empty icon="folder" title="لا مشاريع بعد" sub="فعّل وضع الوكيل من زر + واطلب منه بناء تطبيق أو موقع؛ ستظهر ملفاته هنا." />
      ) : (
        <Group footer="لكل محادثة وكيل مشروعها الخاص؛ يتابع الوكيل العمل عليه حين تكتب «كمّل» في المحادثة نفسها.">
          {list.map((x) => {
            const st = wsStats(x.files);
            return <Row key={x.id} icon="folder" title={x.name} sub={`${st.count} ملف · ${kb(st.bytes)} · ${relTime(x.updated)}`} onPress={() => setOpenId(x.id)} />;
          })}
        </Group>
      )}

      <Sheet visible={!!p} onClose={() => setOpenId(null)} title={p?.name} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button small icon="package" title="تصدير zip" loading={busy} onPress={doExport} />
            {p && htmlEntries(p.files).length ? <Button small kind="soft" icon="eye" title="معاينة" onPress={doPreview} /> : null}
            <Button small kind="danger" icon="trash-2" title="حذف" onPress={doDelete} />
          </View>
          {p?.plan?.length ? (
            <Group title="الخطة">
              {p.plan.map((it, i) => <Row key={i} title={(it.done ? '✓ ' : '○ ') + it.t} chevron={false} />)}
            </Group>
          ) : null}
          <Group title={`الملفات (${files.length})`}>
            {files.map((k) => <Row key={k} title={k} sub={`${p!.files[k].split('\n').length} سطر · ${kb(p!.files[k].length)}`} onPress={() => setView(k)} />)}
          </Group>
        </ScrollView>
      </Sheet>

      <Sheet visible={!!(p && view && view in p.files)} onClose={() => setView(null)} title={view ?? ''} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Button small kind="soft" icon="copy" title="نسخ الملف" onPress={async () => { if (p && view) { await Clipboard.setStringAsync(p.files[view]); toast('تم النسخ'); } }} />
          <T size={12} ltr selectable style={{ fontFamily: FONT.mono, lineHeight: 19 }}>{p && view && view in p.files ? (p.files[view].length > MAX_VIEW ? p.files[view].slice(0, MAX_VIEW) + '\n…[اقتُطع العرض؛ انسخ الملف أو صدّره كاملًا]' : p.files[view]) : ''}</T>
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
