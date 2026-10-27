import { useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { AG_TOOLS } from '../../api/agentCore';
import type { AgentStep, Msg } from '../../api/types';
import { shortModel } from '../../lib/util';
import { useDialogs } from '../../store/features';
import { useSettings } from '../../store/settings';
import { useColors } from '../../theme';
import { Dialog, Icon, Sheet, T, Row, Group, haptic } from '../ui/kit';
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

const ICON = { run: 'loader', ok: 'check-circle', error: 'alert-circle', denied: 'slash' } as const;

export function AgentSteps({ steps, live }: { steps: AgentStep[]; live?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState<string | null>(null);
  const plan = [...steps].reverse().find((s) => s.tool === 'plan');
  const rest = steps.filter((s) => s.tool !== 'plan');
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="tool" size={15} color={c.accent} />
        <T size={13} weight="medium" color="text2">{live ? 'الوكيل يعمل…' : `خطوات الوكيل (${rest.length})`}</T>
      </View>
      {plan && Array.isArray(plan.args.items) ? (
        <View style={{ gap: 2, paddingBottom: 4 }}>
          {plan.args.items.map((it: any, i: number) => (
            <T key={i} size={12.5} color={it.done ? 'muted' : 'text'} style={{ textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.done ? '✓ ' : '○ '}{it.t}</T>
          ))}
        </View>
      ) : null}
      {rest.map((s) => (
        <View key={s.id}>
          <Pressable onPress={() => { haptic(); setOpen(open === s.id ? null : s.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <Icon name={ICON[s.status]} size={14} color={s.status === 'ok' ? c.accent : s.status === 'run' ? c.muted : c.danger} />
            <T size={12.5} weight="medium" style={{ flex: 1 }} numberOfLines={1}>{AG_TOOLS[s.tool]?.label ?? s.tool}{summ(s) ? ' · ' + summ(s) : ''}</T>
            <Icon name={open === s.id ? 'chevron-up' : 'chevron-down'} size={14} color={c.muted} />
          </Pressable>
          {open === s.id ? <T size={12} color="muted" selectable ltr style={{ paddingStart: 22, paddingBottom: 6 }}>{s.result || JSON.stringify(s.args)}</T> : null}
        </View>
      ))}
    </View>
  );
}
const summ = (s: AgentStep) => String(s.args.query ?? s.args.url ?? s.args.expression ?? s.args.path ?? s.args.action ?? s.args.filename ?? '').slice(0, 40);

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
      {tab === 'a' ? <Markdown text={msg.content.replace(/```api_call[\s\S]*?```/g, '')} /> : (msg.alt.error ? <T size={14} color="danger" selectable>{msg.alt.content}</T> : <Markdown text={msg.alt.content} />)}
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
