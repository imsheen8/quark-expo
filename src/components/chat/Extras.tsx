import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AG_TOOLS } from '../../api/agentCore';
import { cancelStep } from '../../api/stepCancel';
import type { AgentStep, Msg } from '../../api/types';
import { shortModel } from '../../lib/util';
import { useDialogs } from '../../store/features';
import { useChats } from '../../store/chats';
import { useWorkspace } from '../../store/workspace';
import { wsStats } from '../../api/workspaceCore';
import { useSettings } from '../../store/settings';
import { useColors } from '../../theme';
import { FONT } from '../../theme/themes';
import { Dialog, Icon, IconButton, Sheet, T, Row, Group, haptic, type IconName } from '../ui/kit';
import { Markdown } from './Markdown';

export function SourceChips({ sources }: { sources: NonNullable<Msg['sources']> }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <T size={12} color="muted">المصادر</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {sources.map((s) => (
          <Pressable key={s.n} onPress={() => Linking.openURL(s.url).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 10, height: 34, maxWidth: 220 }}>
            <T size={12} weight="bold" color="accent">{s.n}</T>
            <T size={12} numberOfLines={1} ltr style={{ flexShrink: 1 }}>{s.host.replace(/^www\./, '')}</T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const TOOL_ICON: Record<string, IconName> = {
  web_search: 'search', read_url: 'globe', calculator: 'hash', now: 'clock', memory_search: 'database', memory_save: 'save',
  search_chats: 'message-circle', read_chat: 'message-square', ask_user: 'help-circle', manage_tasks: 'check-square', create_file: 'file-plus', run_js: 'terminal', delegate: 'users',
  fs_write: 'file-plus', fs_edit: 'edit-3', fs_read: 'file-text', fs_list: 'folder', fs_search: 'search', fs_delete: 'trash-2', fs_move: 'move',
  scaffold_project: 'layers', check_project: 'check-circle', run_project: 'play', preview_project: 'eye', export_project: 'package',
};
const summ = (s: AgentStep) => {
  if (s.tool === 'fs_write' && Array.isArray(s.args.files)) return s.args.files.map((f: any) => f?.path).filter(Boolean).join('، ').slice(0, 160);
  if (s.tool === 'scaffold_project') return [s.args.template, s.args.name].filter(Boolean).join(' · ');
  if (s.tool === 'fs_move') return `${s.args.from ?? ''} ← ${s.args.to ?? ''}`;
  if (s.tool === 'fs_list') return String(s.args.dir ?? '');
  const v = s.args.query ?? s.args.url ?? s.args.expression ?? s.args.code ?? s.args.path ?? s.args.action ?? s.args.filename ?? s.args.question ?? s.args.text ?? s.args.content;
  if (v != null && typeof v !== 'object') return String(v).replace(/\s+/g, ' ').slice(0, 160);
  const j = JSON.stringify(s.args ?? {});
  return j === '{}' ? '' : j.slice(0, 160);
};

/** خطوات الوكيل كخط زمني: مربع أيقونة لكل أداة، وخط عمودي يصل الخطوات، والتفاصيل بخط ثابت العرض */
export function AgentSteps({ steps }: { steps: AgentStep[]; live?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState<string | null>(null);
  const plan = [...steps].reverse().find((s) => s.tool === 'plan');
  const rest = steps.filter((s) => s.tool !== 'plan');

  const Line = () => <View style={{ flex: 1, width: 1.5, backgroundColor: c.border, marginTop: 4 }} />;
  const Dot = () => <View style={{ width: 32, height: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.muted }} /></View>;

  type TRow = { key: string; node: React.ReactNode };
  const rows: TRow[] = [];
  if (plan && Array.isArray(plan.args.items)) {
    rows.push({
      key: 'plan',
      node: (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center' }}><Dot />{rest.length ? <Line /> : null}</View>
          <View style={{ flex: 1, gap: 2, paddingBottom: rest.length ? 14 : 0 }}>
            {plan.args.items.map((it: any, i: number) => (
              <T key={i} size={13.5} color={it.done ? 'muted' : 'text2'} style={{ textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.done ? '✓ ' : '○ '}{it.t}</T>
            ))}
          </View>
        </View>
      ),
    });
  }
  rest.forEach((st, i) => {
    const last = i === rest.length - 1;
    const err = st.status === 'error' || st.status === 'denied';
    const icon: IconName = st.status === 'denied' || st.status === 'cancelled' ? 'slash' : err ? 'alert-circle' : TOOL_ICON[st.tool] ?? 'terminal';
    const tint = err ? c.danger : st.status === 'run' ? c.accent : c.text2;
    const detail = summ(st);
    const isOpen = open === st.id;
    rows.push({
      key: st.id,
      node: (
        <Pressable onPress={() => { haptic(); setOpen(isOpen ? null : st.id); }} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: err ? c.danger : c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              {st.status === 'run' ? <ActivityIndicator size="small" color={c.accent} /> : <Icon name={icon} size={16} color={tint} />}
            </View>
            {!last ? <Line /> : null}
          </View>
          <View style={{ flex: 1, gap: 3, paddingBottom: last ? 0 : 14, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T size={15} weight="semibold" color={err ? 'danger' : st.status === 'cancelled' ? 'muted' : 'text'} numberOfLines={1} style={{ flex: 1 }}>{AG_TOOLS[st.tool]?.label ?? st.tool}{st.status === 'cancelled' ? ' · أُلغيت' : ''}</T>
              {st.status === 'run' ? <IconButton name="x-circle" size={18} label="إلغاء هذه الخطوة" color={c.muted} onPress={() => { haptic(); cancelStep(st.id); }} style={{ width: 30, height: 30 }} /> : null}
            </View>
            {detail ? <T size={12.5} color="muted" ltr numberOfLines={isOpen ? undefined : 2} style={{ fontFamily: FONT.mono }}>{detail}</T> : null}
            {st.status === 'run' && st.result ? <T size={12} color="text2" ltr numberOfLines={8} style={{ fontFamily: FONT.mono, marginTop: 2 }}>{st.result}</T> : null}
            {isOpen && st.status !== 'run' && st.result ? <T size={12} color="text2" selectable ltr style={{ fontFamily: FONT.mono, marginTop: 4 }}>{st.result}</T> : null}
          </View>
        </Pressable>
      ),
    });
  });
  return <View>{rows.map((r) => <View key={r.key}>{r.node}</View>)}</View>;
}

/** يعرض نص الرد والخطوات متداخلة بترتيب حدوثها: نص ← خطوات ← نص ← خطوات … (الخطوات القديمة بلا موضع تُعرض في الأعلى) */
export function AgentFlow({ text, steps }: { text: string; steps: AgentStep[] }) {
  const parts: ({ k: 't'; v: string } | { k: 's'; v: AgentStep[] })[] = [];
  let pos = 0;
  for (const st of steps) {
    const at = Math.min(text.length, Math.max(pos, st.at ?? 0));
    if (at > pos) {
      const seg = text.slice(pos, at).trim();
      if (seg) parts.push({ k: 't', v: seg });
      pos = at;
    }
    const lastP = parts[parts.length - 1];
    if (lastP && lastP.k === 's') lastP.v.push(st); else parts.push({ k: 's', v: [st] });
  }
  const tail = text.slice(pos).trim();
  if (tail) parts.push({ k: 't', v: tail });
  return (
    <View style={{ gap: 10 }}>
      {parts.map((p, i) => (p.k === 't' ? <Markdown key={i} text={p.v} /> : <AgentSteps key={i} steps={p.v} />))}
    </View>
  );
}

/** بطاقة مشروع الوكيل تحت ردّه: تفتح شاشة الملفات للتصدير والمعاينة */
const WS_BUILD = ['fs_write', 'fs_edit', 'scaffold_project'];
export function WorkspaceChip({ steps }: { steps: AgentStep[] }) {
  const c = useColors();
  const router = useRouter();
  const cid = useChats((s) => s.currentId);
  const p = useWorkspace((s) => (cid ? s.projects[cid] : undefined));
  if (!p || !steps.some((s) => WS_BUILD.includes(s.tool))) return null;
  const st = wsStats(p.files);
  return (
    <Pressable onPress={() => { haptic(); router.push(('/workspace?id=' + encodeURIComponent(p.id)) as any); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.accentSoft, borderRadius: 14, padding: 12 }}>
      <Icon name="folder" size={20} color={c.accent} />
      <View style={{ flex: 1 }}>
        <T size={14} weight="semibold" numberOfLines={1}>{p.name}</T>
        <T size={12} color="text2">{st.count} ملف · {Math.max(1, Math.round(st.bytes / 1024))} KB — عرض وتصدير</T>
      </View>
      <Icon name="chevron-left" size={18} color={c.accent} />
    </Pressable>
  );
}

/** مقارنة رد النموذج الأساسي بالثاني */
export function CompareView({ msg }: { msg: Msg }) {
  const c = useColors();
  const [tab, setTab] = useState<'a' | 'b'>('a');
  if (!msg.alt) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {([['a', msg.model || 'A'], ['b', msg.alt.model]] as const).map(([k, lb]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: tab === k ? c.accentSoft : c.surface2 }}>
            <T size={12.5} weight="medium" color={tab === k ? 'accent' : 'text2'} ltr numberOfLines={1}>{shortModel(lb)}</T>
          </Pressable>
        ))}
      </View>
      {tab === 'a' ? <Markdown text={msg.content} /> : (msg.alt.error ? <T size={14} color="danger" selectable>{msg.alt.content}</T> : <Markdown text={msg.alt.content} />)}
    </View>
  );
}

/** نافذة الحوارات العامة (موافقات الوكيل وأسئلته) */
export function GlobalDialogs() {
  const q = useDialogs((s) => s.queue);
  const pop = useDialogs((s) => s.pop);
  const [val, setVal] = useState('');
  const c = useColors();
  const d = q[0];
  const done = (ok: boolean, value?: string) => { if (!d) return; d.resolve({ ok, value }); pop(d.id); setVal(''); };
  return (
    <Dialog
      visible={!!d}
      title={d?.title ?? ''}
      message={d?.message}
      onClose={() => done(false)}
      actions={d?.options ? [{ title: d.cancel || 'تخطّي', onPress: () => done(false) }] : [{ title: d?.confirm || 'موافق', kind: d?.danger ? 'danger' : 'primary', onPress: () => done(true, val) }, { title: d?.cancel || 'إلغاء', onPress: () => done(false) }]}
    >
      {d?.options ? (
        <View style={{ gap: 8 }}>
          {d.options.map((o) => (
            <Pressable key={o} onPress={() => done(true, o)} style={{ padding: 12, borderRadius: 12, backgroundColor: c.surface2 }}>
              <T size={14}>{o}</T>
            </Pressable>
          ))}
        </View>
      ) : d?.input ? (
        <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} value={val} onChangeText={setVal} multiline autoFocus placeholderTextColor={c.muted} style={{ color: c.text, backgroundColor: c.surface2, borderRadius: 12, padding: 10, minHeight: 44 }} />
      ) : null}
    </Dialog>
  );
}

/** اختيار نموذج المقارنة الثاني */
export function SecondModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const eps = useSettings((s) => s.endpoints);
  const sel = useSettings((s) => s.cmpSel);
  const patch = useSettings((s) => s.patch);
  return (
    <Sheet visible={visible} onClose={onClose} title="النموذج الثاني للمقارنة" full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {eps.filter((e) => e.enabled).map((e) => (
          <Group key={e.id} title={e.label}>
            {e.models.filter((m) => m.on).map((m) => (
              <Row key={m.id} title={m.id} icon={sel?.ep === e.id && sel.model === m.id ? 'check-circle' : 'circle'} onPress={() => { patch({ cmpSel: { ep: e.id, model: m.id }, modes: { ...useSettings.getState().modes, compare: true } }); onClose(); }} />
            ))}
          </Group>
        ))}
      </ScrollView>
    </Sheet>
  );
}
