import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { hostOf } from '../api/providers';
import { noteResult, niceErr, runModel, testModel } from '../api/modelBench';
import {
  LABELS, PRESETS, ago, benchBest, benchSort, capReason, capVision, ctxOf, estTok, famOf, fmtCtx, latOf, secs, type BenchRes, type ModelItem,
} from '../api/modelsCore';
import { shortModel } from '../lib/util';
import { toast } from '../store/data';
import { useModelMeta, useModelTests } from '../store/modelMeta';
import { modelKey, useSettings } from '../store/settings';
import { useColors } from '../theme';
import { Button, Card, Chip, Field, Icon, IconButton, Sheet, T } from './ui/kit';

const Badge = ({ label, accent }: { label: string; accent?: boolean }) => {
  const c = useColors();
  return <T size={11} color={accent ? 'accent' : 'text2'} style={{ backgroundColor: accent ? c.accentSoft : c.surface2, paddingHorizontal: 8, borderRadius: 8 }}>{label}</T>;
};

function Stat({ v, l }: { v: string; l: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: '40%', backgroundColor: c.surface2, borderRadius: 12, padding: 10, alignItems: 'center' }}>
      <T weight="bold" size={15}>{v}</T>
      <T size={11} color="muted" style={{ textAlign: 'center' }}>{l}</T>
    </View>
  );
}

/* ====================== لوحة التفاصيل ====================== */
export function DetailSheet({
  item, onClose, onPlay, onDelete, onParams,
}: { item: ModelItem | null; onClose: () => void; onPlay: (i: ModelItem) => void; onDelete: (i: ModelItem) => void; onParams: (i: ModelItem) => void }) {
  const c = useColors();
  const { meta, fav, use, setMeta, toggleFav } = useModelMeta();
  const tests = useModelTests((s) => s.t);
  const { sel, select, toggleModel, patch, params, modes } = useSettings();
  if (!item) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const { ep, m, key } = item;
  const mt = meta[key] || {};
  const u = use[key];
  const hist = (mt.hist || []).slice(-8);
  const mx = Math.max(1, ...hist.map((h) => h.ms));
  const isA = sel?.ep === ep.id && sel.model === m.id;
  const isFav = fav.includes(key);
  const lat = latOf(mt, tests[key]);
  const P = params.models[modelKey(ep.id, m.id)] || {};
  const G = params.global || {};
  const kv = (k: 'temperature' | 'top_p' | 'max_tokens') => (P[k] != null ? String(P[k]) : G[k] != null ? G[k] + ' (عام)' : 'افتراضي');
  const act = (fn: () => void) => () => { fn(); };

  return (
    <Sheet visible onClose={onClose} title="تفاصيل النموذج" full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: mt.color || c.surface3 }} />
          <View style={{ flex: 1 }}>
            <T weight="bold" size={16} ltr selectable>{m.id}</T>
            <T size={12} color="muted" ltr>{hostOf(ep.url)} · {ep.proto === 'anthropic' ? 'Anthropic' : ep.proto === 'llama' ? 'llama.cpp' : ep.proto === 'gemini' ? 'Gemini' : 'OpenAI-compatible'}</T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={famOf(m.id)} accent />
          {capReason(m.id) ? <Badge label="تفكير" /> : null}
          {capVision(m.id) ? <Badge label="رؤية" /> : null}
          {ep.kind === 'local' || ep.proto === 'llama' ? <Badge label="محلي" /> : null}
          {!ep.enabled ? <Badge label="نقطة معطّلة" /> : !m.on ? <Badge label="معطّل" /> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Stat v={String(u?.n || 0)} l="استخدام" />
          <Stat v={ago(u?.ts)} l="آخر استخدام" />
          <Stat v={ctxOf(m.id) ? '≈' + fmtCtx(ctxOf(m.id)) : '—'} l="نافذة السياق (تقدير)" />
          <Stat v={lat != null ? secs(lat) : '—'} l="زمن الاستجابة" />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title={isA ? 'قيد الاستخدام' : 'استخدام'} icon="check" small disabled={!ep.enabled || isA} onPress={() => { toggleModel(ep.id, m.id, true); select(ep.id, m.id); toast('تم اختيار النموذج: ' + shortModel(m.id)); onClose(); }} />
          <Button title="ساحة التجربة" icon="send" kind="soft" small onPress={() => { onClose(); setTimeout(() => onPlay(item), 250); }} />
          <Button title="اختبار" icon="clock" kind="ghost" small onPress={() => void testModel(item)} />
          <Button title="للمقارنة" icon="columns" kind="ghost" small disabled={!ep.enabled} onPress={() => { patch({ cmpSel: { ep: ep.id, model: m.id }, modes: { ...modes, compare: true } }); toast('النموذج الثاني: ' + shortModel(m.id)); onClose(); }} />
          <Button title={isFav ? 'إزالة المفضلة' : 'مفضلة'} icon="star" kind="ghost" small onPress={() => toggleFav(key)} />
          <Button title="المعاملات" icon="sliders" kind="ghost" small onPress={() => { onClose(); setTimeout(() => onParams(item), 250); }} />
        </View>

        <T weight="bold">سجل الاختبارات</T>
        {hist.length ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 56 }}>
              {hist.map((h, i) => (
                <View key={i} style={{ flex: 1, height: h.ok ? `${Math.max(14, (h.ms / mx) * 100)}%` : '100%', borderRadius: 4, backgroundColor: h.ok ? c.accent : c.danger, opacity: h.ok ? 0.85 : 0.5 }} />
              ))}
            </View>
            {hist.slice().reverse().slice(0, 4).map((h, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <T size={12.5} color="muted">{ago(h.ts)}</T>
                <T size={12.5} color={h.ok ? 'text' : 'danger'} style={{ flexShrink: 1 }} numberOfLines={2}>{h.ok ? '✓ ' + secs(h.ms) + (h.tps ? ` · ≈${h.tps} tok/s` : '') : '✕ ' + (h.err || 'فشل')}</T>
              </View>
            ))}
          </>
        ) : <T size={12.5} color="muted">لم يُختبر بعد. اضغط «اختبار» لقياس الاتصال وزمن الاستجابة.</T>}

        <T weight="bold">تخصيص</T>
        <Field label="اسم مستعار (يظهر في بطاقة النموذج)" value={mt.alias || ''} onChangeText={(t) => setMeta(key, { alias: t.trim() ? t : '' })} maxLength={40} placeholder="مثال: المترجم السريع" autoCapitalize="sentences" />
        <Field label="ملاحظة" value={mt.note || ''} onChangeText={(t) => setMeta(key, { note: t.trim() ? t : '' })} maxLength={300} multiline inputStyle={{ minHeight: 76 }} placeholder="متى تستخدم هذا النموذج؟ نقاط قوته وضعفه…" autoCapitalize="sentences" />
        <View style={{ gap: 6 }}>
          <T size={12.5} weight="medium" color="muted">لون التصنيف</T>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable onPress={() => setMeta(key, { color: '' })} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: !mt.color ? c.accent : c.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={14} color={c.muted} />
            </Pressable>
            {LABELS.map((col) => (
              <Pressable key={col} onPress={() => setMeta(key, { color: col })} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: 2, borderColor: mt.color === col ? c.text : 'transparent' }} />
            ))}
          </View>
        </View>

        <T weight="bold">المعاملات الفعّالة</T>
        {(['temperature', 'top_p', 'max_tokens'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} color="muted" ltr>{k}</T>
            <T size={13} weight="medium">{kv(k)}</T>
          </View>
        ))}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="نسخ المعرّف" icon="copy" kind="ghost" small onPress={async () => { await Clipboard.setStringAsync(m.id); toast('تم نسخ المعرّف'); }} />
          <Button title={m.on ? 'تعطيل' : 'تفعيل'} icon="power" kind="ghost" small onPress={act(() => toggleModel(ep.id, m.id, !m.on))} />
          <Button title="حذف" icon="trash-2" kind="danger" small onPress={() => { onClose(); setTimeout(() => onDelete(item), 250); }} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

/* ====================== ساحة التجربة ====================== */
export function PlaySheet({ item, onClose }: { item: ModelItem | null; onClose: () => void }) {
  const c = useColors();
  const [prompt, setPrompt] = useState(PRESETS[0][1]);
  const [temp, setTemp] = useState(0.7);
  const [max, setMax] = useState(0);
  const [out, setOut] = useState('');
  const [think, setThink] = useState('');
  const [err, setErr] = useState('');
  const [mt, setMt] = useState<{ ttft: number; ms: number; tps: number; tok: number } | null>(null);
  const [run, setRun] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => { if (!item) { ctl.current?.abort(); } }, [item]);

  const go = async () => {
    if (!item) return;
    if (run) { ctl.current?.abort(); return; }
    if (!prompt.trim()) return toast('اكتب سؤالًا أولًا');
    if (!item.ep.enabled) return toast('نقطة الاتصال معطّلة');
    const my = (ctl.current = new AbortController());
    setRun(true); setOut(''); setThink(''); setErr(''); setMt(null);
    try {
      const r = await runModel(item, prompt.trim(), { temperature: temp, max_tokens: max || 0 }, (o, t) => { setOut(o); setThink(t); }, my.signal);
      noteResult(item.key, { ok: true, ms: r.ms, ttft: r.ttft, tps: r.tps });
      useModelMeta.getState().bump(item.key);
      setMt({ ttft: r.ttft, ms: r.ms, tps: r.tps, tok: r.tokens });
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') { const m = niceErr(e); setErr(m); noteResult(item.key, { ok: false, err: m }); }
    } finally { setRun(false); }
  };

  return (
    <Sheet visible={!!item} onClose={() => { ctl.current?.abort(); onClose(); }} title="ساحة التجربة" full>
      {item ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <T weight="bold" ltr numberOfLines={1}>{item.m.id}</T>
          <T size={12} color="muted" ltr>{hostOf(item.ep.url)}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PRESETS.map(([l, t]) => <Chip key={l} label={l} active={prompt === t} onPress={() => setPrompt(t)} />)}
          </ScrollView>
          <Field value={prompt} onChangeText={setPrompt} multiline inputStyle={{ minHeight: 92 }} placeholder="اكتب سؤالك لتجربة هذا النموذج…" autoCapitalize="sentences" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stepper label="الحرارة" value={temp.toFixed(1)} onMinus={() => setTemp((v) => Math.max(0, Math.round((v - 0.1) * 10) / 10))} onPlus={() => setTemp((v) => Math.min(2, Math.round((v + 0.1) * 10) / 10))} />
            <Stepper label="أقصى طول" value={max ? String(max) : 'تلقائي'} onMinus={() => setMax((v) => Math.max(0, v - 256))} onPlus={() => setMax((v) => Math.min(8192, v + 256))} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={run ? 'إيقاف' : 'تشغيل'} icon={run ? 'square' : 'send'} onPress={go} style={{ flex: 1 }} />
            <Button title="نسخ" icon="copy" kind="ghost" disabled={!out} onPress={async () => { await Clipboard.setStringAsync(out); toast('تم النسخ'); }} />
          </View>
          {mt ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Stat v={secs(mt.ttft)} l="أول رمز" /><Stat v={secs(mt.ms)} l="الإجمالي" /><Stat v={'≈' + mt.tps} l="رمز/ثانية" /><Stat v={'≈' + mt.tok} l="رمز" />
            </View>
          ) : null}
          {think ? <Card><T size={12.5} color="muted" selectable>{think}</T></Card> : null}
          {out || err ? <Card><T selectable color={err ? 'danger' : 'text'}>{err ? '⚠ ' + err : out}</T></Card> : null}
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface2, borderRadius: 12, padding: 8, gap: 2, alignItems: 'center' }}>
      <T size={11.5} color="muted">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="minus" size={16} onPress={onMinus} />
        <T weight="bold" style={{ minWidth: 52, textAlign: 'center' }}>{value}</T>
        <IconButton name="plus" size={16} onPress={onPlus} />
      </View>
    </View>
  );
}

/* ====================== مقارنة الأداء ====================== */
type RowState = { st: 'wait' | 'run' | 'done' | 'fail'; out: string; res?: BenchRes };

export function BenchSheet({ items, onClose }: { items: ModelItem[] | null; onClose: () => void }) {
  const c = useColors();
  const [prompt, setPrompt] = useState(PRESETS[0][1]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [run, setRun] = useState(false);
  const [done, setDone] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const list = (items || []).slice(0, 8);
  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => { setRows({}); setOrder((items || []).slice(0, 8).map((i) => i.key)); setDone(false); }, [items]);

  const patchRow = (k: string, p: Partial<RowState>) => setRows((r) => ({ ...r, [k]: { ...(r[k] || { st: 'wait', out: '' }), ...p } }));

  const go = async () => {
    if (run) { ctl.current?.abort(); return; }
    if (!prompt.trim()) return toast('اكتب سؤالًا أولًا');
    const my = (ctl.current = new AbortController());
    const results: BenchRes[] = [];
    setRun(true); setDone(false); setRows({});
    const queue = list.slice();
    const worker = async () => {
      for (let it; (it = queue.shift()) && !my.signal.aborted; ) {
        patchRow(it.key, { st: 'run', out: '' });
        try {
          if (!it.ep.enabled) throw new Error('نقطة الاتصال معطّلة');
          const r = await runModel(it, prompt.trim(), { max_tokens: 700 }, (o) => patchRow(it.key, { out: o }), my.signal);
          const res: BenchRes = { key: it.key, ok: true, ms: r.ms, ttft: r.ttft, tps: r.tps, tokens: r.tokens };
          results.push(res);
          noteResult(it.key, { ok: true, ms: r.ms, ttft: r.ttft, tps: r.tps });
          useModelMeta.getState().bump(it.key);
          patchRow(it.key, { st: 'done', res });
        } catch (e) {
          if (my.signal.aborted) break;
          const m = niceErr(e);
          const res: BenchRes = { key: it.key, ok: false, ms: 0, ttft: 0, tps: 0, tokens: 0, err: m };
          results.push(res);
          noteResult(it.key, { ok: false, err: m });
          patchRow(it.key, { st: 'fail', out: m, res });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setRun(false);
    if (my.signal.aborted) return;
    setOrder(benchSort(results).map((r) => r.key).concat(list.map((i) => i.key).filter((k) => !results.some((r) => r.key === k))));
    setDone(true);
    toast('اكتملت المقارنة');
  };

  const all = Object.values(rows).map((r) => r.res).filter(Boolean) as BenchRes[];
  const best = done ? benchBest(all) : null;
  const copy = async () => {
    const ordered = order.map((k) => rows[k]?.res).filter(Boolean) as BenchRes[];
    const t = ordered.map((r, i) => {
      const it = list.find((x) => x.key === r.key)!;
      return `${i + 1}. ${it.m.id} (${hostOf(it.ep.url)}) — ${r.ok ? `أول رمز ${secs(r.ttft)} · الكلي ${secs(r.ms)} · ≈${r.tps} tok/s` : 'فشل: ' + r.err}`;
    }).join('\n');
    await Clipboard.setStringAsync(t);
    toast('تم نسخ النتائج');
  };

  return (
    <Sheet visible={!!items} onClose={() => { ctl.current?.abort(); onClose(); }} title={`مقارنة أداء (${list.length})`} full>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <T size={12.5} color="text2">يُرسل السؤال نفسه إلى كل النماذج المحددة، ويقيس أول رمز والزمن الكلي والسرعة التقريبية.</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PRESETS.map(([l, t]) => <Chip key={l} label={l} active={prompt === t} onPress={() => setPrompt(t)} />)}
        </ScrollView>
        <Field value={prompt} onChangeText={setPrompt} multiline inputStyle={{ minHeight: 84 }} placeholder="سؤال المقارنة…" autoCapitalize="sentences" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title={run ? 'إيقاف' : done ? 'إعادة المقارنة' : 'ابدأ المقارنة'} icon={run ? 'square' : 'send'} onPress={go} style={{ flex: 1 }} />
          <Button title="نسخ النتائج" icon="copy" kind="ghost" disabled={!done} onPress={copy} />
        </View>
        {order.map((k) => {
          const it = list.find((x) => x.key === k);
          if (!it) return null;
          const r = rows[k];
          const res = r?.res;
          const tag = (on: boolean) => ({ color: on ? c.accent : undefined });
          return (
            <Card key={k} style={{ gap: 6, borderColor: r?.st === 'fail' ? c.danger : r?.st === 'done' ? c.accent : c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T weight="bold" ltr numberOfLines={1}>{it.m.id}</T>
                  <T size={11.5} color="muted" ltr>{hostOf(it.ep.url)}</T>
                </View>
                <T size={12} color={r?.st === 'fail' ? 'danger' : r?.st === 'done' ? 'accent' : 'muted'}>
                  {r?.st === 'run' ? 'يعمل…' : r?.st === 'done' ? '✓ اكتمل' : r?.st === 'fail' ? '✕ فشل' : 'بانتظار التشغيل'}
                </T>
              </View>
              {res?.ok ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <T size={12.5} style={tag(!!best && res.ttft === best.ttft)}>أول رمز <T size={12.5} weight="bold" style={tag(!!best && res.ttft === best.ttft)}>{secs(res.ttft)}</T></T>
                  <T size={12.5} style={tag(!!best && res.ms === best.ms)}>الكلي <T size={12.5} weight="bold" style={tag(!!best && res.ms === best.ms)}>{secs(res.ms)}</T></T>
                  <T size={12.5} style={tag(!!best && res.tps === best.tps)}>السرعة <T size={12.5} weight="bold" style={tag(!!best && res.tps === best.tps)}>≈{res.tps}</T> tok/s</T>
                  <T size={12.5}>الطول <T size={12.5} weight="bold">≈{res.tokens}</T></T>
                </View>
              ) : null}
              {r?.out ? <T size={13} color={r.st === 'fail' ? 'danger' : 'text2'} numberOfLines={r.st === 'run' ? 6 : 12} selectable>{r.out}</T> : null}
            </Card>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
