import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { testMany, testModel } from '../api/modelBench';
import {
  FAMS, buildExport, capReason, capVision, ctxOf, dedupeKill, defaultMdUi, dupGroups, famOf, filterModels, filtersActive, fmtCtx, itemsOf, latOf, planImport, secs, statusOf,
  type MdUi, type ModelItem,
} from '../api/modelsCore';
import { hostOf } from '../api/providers';
import { readTextFile } from '../lib/images';
import { shareFile } from '../lib/share';
import { shortModel } from '../lib/util';
import { toast, useUi } from '../store/data';
import { useModelMeta, useModelTests } from '../store/modelMeta';
import { modelKey, useSettings } from '../store/settings';
import { useRouter } from 'expo-router';
import { useColors } from '../theme';
import { BenchSheet, DetailSheet, PlaySheet } from './ModelSheets';
import { MenuIcon } from './ui/MenuIcon';
import { Button, Card, Chip, Dialog, Empty, Group, Icon, IconButton, Row, Sheet, T, haptic } from './ui/kit';

const TABS: [MdUi['tab'], string][] = [['all', 'الكل'], ['fav', 'المفضلة'], ['on', 'المفعّلة'], ['used', 'المستخدمة']];
const CAPS: [MdUi['cap'], string][] = [['all', 'الكل'], ['reason', 'تفكير'], ['vision', 'رؤية'], ['params', 'معاملات مخصصة']];
const STS: [MdUi['st'], string][] = [['all', 'الكل'], ['ok', 'سليم'], ['bad', 'فاشل'], ['none', 'لم يُختبر'], ['off', 'معطّل']];
const SORTS: [MdUi['sort'], string][] = [['name', 'الاسم'], ['used', 'الأكثر استخدامًا'], ['recent', 'الأحدث استخدامًا'], ['speed', 'الأسرع'], ['ctx', 'الأكبر سياقًا'], ['ep', 'النقطة']];
const hasP = (p?: Record<string, unknown>) => !!p && ['temperature', 'top_p', 'max_tokens'].some((k) => typeof p[k] === 'number');

export function ModelsPro() {
  const c = useColors();
  const router = useRouter();
  const endpoints = useSettings((s) => s.endpoints);
  const sel = useSettings((s) => s.sel);
  const cmpSel = useSettings((s) => s.cmpSel);
  const params = useSettings((s) => s.params);
  const { meta, fav, use, setFav, toggleFav } = useModelMeta();
  const tests = useModelTests((s) => s.t);

  const setSidebar = useUi((s) => s.setSidebar);
  const [searching, setSearching] = useState(false);
  const [ui, setUi] = useState<MdUi>(defaultMdUi());
  const [limit, setLimit] = useState(60);
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [filt, setFilt] = useState(false);
  const [over, setOver] = useState(false);
  const [detail, setDetail] = useState<ModelItem | null>(null);
  const [acts, setActs] = useState<ModelItem | null>(null);
  const [play, setPlay] = useState<ModelItem | null>(null);
  const [bench, setBench] = useState<ModelItem[] | null>(null);
  const [del, setDel] = useState<string[] | null>(null);
  const [dedupe, setDedupe] = useState<string[] | null>(null);
  const set = (p: Partial<MdUi>) => { setUi((u) => ({ ...u, ...p })); setLimit(60); };

  const all = useMemo(() => itemsOf(endpoints), [endpoints]);
  const fc = useMemo(
    () => ({ meta, fav: new Set(fav), use, tests, hasParams: (k: string) => hasP(params.models[k] as any), host: (ep: any) => hostOf(ep.url) }),
    [meta, fav, use, tests, params.models],
  );
  const view = useMemo(() => filterModels(all, ui, fc), [all, ui, fc]);
  const shown = view.slice(0, limit);
  const fams = useMemo(() => [...new Set(all.map((i) => famOf(i.m.id)))].sort(), [all]);
  const counts = {
    all: all.length, fav: all.filter((i) => fc.fav.has(i.key)).length, on: all.filter((i) => i.m.on && i.ep.enabled).length, used: all.filter((i) => use[i.key]?.n).length,
  };
  const pickedItems = all.filter((i) => picked.includes(i.key));

  const useIt = (it: ModelItem) => {
    if (!it.ep.enabled) return toast('نقطة الاتصال معطّلة — فعّلها من الإعدادات ← المفاتيح ونقاط الاتصال');
    useSettings.getState().toggleModel(it.ep.id, it.m.id, true);
    useSettings.getState().select(it.ep.id, it.m.id);
    toast('تم اختيار النموذج: ' + shortModel(it.m.id));
  };
  const goParams = (it: ModelItem) => { useSettings.getState().select(it.ep.id, it.m.id); router.push({ pathname: '/settings/personalize', params: { tab: 'params' } }); };
  const remove = (keys: string[]) => {
    const local = all.filter((i) => keys.includes(i.key) && i.ep.proto === 'llama');
    const ok = keys.filter((k) => !local.some((i) => i.key === k));
    if (ok.length) { useSettings.getState().removeModels(ok); useModelMeta.getState().forget(ok); }
    setPicked((p) => p.filter((k) => !keys.includes(k)));
    toast(local.length ? `حُذف ${ok.length} — النماذج المحلية تُحذف من «نماذج على الجهاز»` : 'تم الحذف');
  };
  const toggleSel = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const setOn = (keys: string[], on: boolean) => { const S = useSettings.getState(); all.filter((i) => keys.includes(i.key)).forEach((i) => S.toggleModel(i.ep.id, i.m.id, on)); };

  /* ---------- نظرة عامة ---------- */
  const st = { ok: 0, bad: 0, none: 0 };
  all.forEach((i) => { const s = statusOf(meta[i.key], tests[i.key]); st[s === 'busy' ? 'none' : s]++; });
  const famRows = Object.entries(all.reduce<Record<string, number>>((a, i) => { const f = famOf(i.m.id); a[f] = (a[f] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topUsed = all.filter((i) => use[i.key]?.n).sort((a, b) => use[b.key].n - use[a.key].n).slice(0, 5);
  const fastest = all.filter((i) => latOf(meta[i.key], tests[i.key]) != null).sort((a, b) => latOf(meta[a.key], tests[a.key])! - latOf(meta[b.key], tests[b.key])!).slice(0, 5);
  const dups = dupGroups(all);

  const exportCfg = () =>
    shareFile('quark-models-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(buildExport(endpoints, fav, meta), null, 2), 'application/json').catch(() => toast('تعذّر التصدير'));
  const importCfg = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['*/*'] });
      if (r.canceled) return;
      const plan = planImport(JSON.parse(await readTextFile(r.assets[0].uri, 2_000_000)), endpoints, meta);
      const S = useSettings.getState();
      plan.add.forEach((a) => { S.addModel(a.ep, a.id); if (!a.on) S.toggleModel(a.ep, a.id, false); });
      useModelMeta.getState().merge({ fav: plan.fav, meta: plan.meta });
      toast(`تم الاستيراد — ${plan.add.length} نموذج جديد`);
    } catch { toast('ملف غير صالح'); }
  };

  const Bar = ({ label, n, mx, tip }: { label: string; n: number; mx: number; tip?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T size={12.5} style={{ width: 96 }} numberOfLines={1} ltr>{label}</T>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: 'hidden' }}>
        <View style={{ width: `${mx ? Math.max(3, (n / mx) * 100) : 0}%`, height: 8, backgroundColor: c.accent }} />
      </View>
      <T size={12} color="muted" style={{ minWidth: 44, textAlign: 'left' }}>{tip ?? n}</T>
    </View>
  );

  const tabBtn = (k: MdUi['tab'], label: string, n: number) => (
    <Pressable key={k} onPress={() => { haptic(); set({ tab: k }); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderBottomWidth: 2.5, borderBottomColor: ui.tab === k ? c.accent : 'transparent', marginBottom: -1 }}>
      <T size={14} weight="medium" color={ui.tab === k ? 'accent' : 'text2'}>{label}</T>
      <T size={12} color="muted">{n}</T>
    </Pressable>
  );
  const allSelected = view.length > 0 && view.every((i) => picked.includes(i.key));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 56 }}>
        <Pressable onPress={() => { haptic(); setSidebar(true); }} accessibilityLabel="القائمة" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MenuIcon /></Pressable>
        <T size={20} weight="bold" style={{ flex: 1 }}>النماذج</T>
        <IconButton name="search" label="بحث" active={searching || !!ui.q} onPress={() => { setSearching((v) => !v); set({ q: '' }); }} />
        <IconButton name="sliders" label="تصفية وترتيب" active={filtersActive(ui)} onPress={() => setFilt(true)} />
        <IconButton name="bar-chart-2" label="نظرة عامة" onPress={() => setOver(true)} />
        <IconButton name="check-square" label="تحديد متعدد" active={multi} onPress={() => { setMulti((m) => !m); setPicked([]); }} />
      </View>
      {searching ? (
        <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: c.accent, height: 44 }}>
          <Icon name="search" size={18} color={c.accent} />
          <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} autoFocus value={ui.q} onChangeText={(q) => set({ q })} placeholder="بحث" placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 15, textAlign: 'auto' }} />
        </View>
      ) : null}
      {multi ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Button small kind="soft" title={allSelected ? 'إلغاء التحديد' : 'تحديد الكل'} onPress={() => setPicked(allSelected ? [] : view.map((i) => i.key))} />
          <Button small kind="soft" icon="activity" title="مقارنة أداء" disabled={picked.length < 2} onPress={() => setBench(pickedItems.slice(0, 8))} />
          <Button small kind="soft" title="تفعيل" disabled={!picked.length} onPress={() => setOn(picked, true)} />
          <Button small kind="soft" title="تعطيل" disabled={!picked.length} onPress={() => setOn(picked, false)} />
          <Button small kind="soft" icon="star" title="مفضلة" disabled={!picked.length} onPress={() => setFav(picked, !picked.every((k) => fc.fav.has(k)))} />
          <Button small kind="soft" icon="clock" title="اختبار" disabled={!picked.length} onPress={() => { toast(`يختبر ${pickedItems.length} نموذجًا…`); void testMany(pickedItems).then((r) => toast(`اكتمل الاختبار — ناجح: ${r.ok} · فاشل: ${r.bad}`)); }} />
          <Button small kind="danger" icon="trash-2" title="حذف" disabled={!picked.length} onPress={() => setDel(picked)} />
          <T size={12.5} color="muted">{picked.length ? picked.length + ' محدد' : ''}</T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 16, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {TABS.map(([k, l]) => tabBtn(k, l, counts[k]))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.push('/local')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: pressed ? c.surface3 : c.accentSoft })}>
        <Icon name="smartphone" size={22} color={c.accent} />
        <View style={{ flex: 1 }}>
          <T weight="semibold">نماذج على الجهاز (llama.cpp)</T>
          <T size={12.5} color="text2">نزّل نموذجًا واعمل دون إنترنت</T>
        </View>
        <Icon name="chevron-left" size={18} color={c.muted} />
      </Pressable>

      {shown.length === 0 ? (
        <Empty icon="cpu" title={!endpoints.length ? 'لم تُضف أي نقطة اتصال بعد' : filtersActive(ui) ? 'لا نتائج مطابقة للتصفية' : ui.tab === 'fav' ? 'لا توجد نماذج مفضلة بعد' : ui.tab === 'used' ? 'لم تستخدم أي نموذج بعد' : 'لا توجد نماذج هنا'}
          sub={!endpoints.length ? 'أضف نقطة اتصال من الإعدادات ← المفاتيح ونقاط الاتصال.' : 'أضف نقطة اتصال أو اجلب نماذجها من الإعدادات ← المفاتيح ونقاط الاتصال.'} />
      ) : null}

      {shown.map((it) => {
        const mt = meta[it.key] || {};
        const on = sel?.ep === it.ep.id && sel.model === it.m.id;
        const second = cmpSel?.ep === it.ep.id && cmpSel.model === it.m.id;
        const isFav = fc.fav.has(it.key);
        const s = statusOf(mt, tests[it.key]);
        const lat = latOf(mt, tests[it.key]);
        const off = !it.ep.enabled || !it.m.on;
        const isSel = picked.includes(it.key);
        const ctx = ctxOf(it.m.id);
        const hasTags = on || second || !!capReason(it.m.id) || !!capVision(it.m.id) || hasP(params.models[modelKey(it.ep.id, it.m.id)] as any) || !!ctx || s !== 'none';
        return (
          <Pressable
            key={it.key}
            onPress={() => { haptic(); multi ? toggleSel(it.key) : setDetail(it); }}
            onLongPress={() => { if (!multi) { setMulti(true); setPicked([it.key]); } }}
            style={{ opacity: off ? 0.62 : 1 }}
          >
            <Card style={{ gap: 8, borderRadius: 18, borderStartWidth: mt.color ? 4 : 1.5, borderStartColor: isSel ? c.accent : mt.color || c.border, borderColor: isSel ? c.accent : c.border, borderWidth: 1.5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {multi ? <Icon name={isSel ? 'check-circle' : 'circle'} size={22} color={isSel ? c.accent : c.muted} /> : null}
                <T size={16} weight="semibold" ltr={!mt.alias} numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{mt.alias || it.m.id}</T>
                {isFav ? <Icon name="star" size={17} color={c.accent} /> : null}
                {!multi ? <IconButton name="more-vertical" size={19} label="المزيد" onPress={() => setActs(it)} style={{ width: 34, height: 34 }} /> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {it.ep.kind === 'local' || it.ep.proto === 'llama' ? <T size={11} color="muted">محلي</T> : null}
                {!it.ep.enabled ? <T size={11} color="danger">نقطة معطّلة</T> : !it.m.on ? <T size={11} color="muted">معطّل</T> : null}
                <T size={12} color="muted" ltr numberOfLines={1} style={{ flexShrink: 1 }}>{mt.alias ? it.m.id + ' · ' : ''}{hostOf(it.ep.url)}</T>
              </View>
              {mt.note ? <T size={12.5} color="text2" numberOfLines={2}>{mt.note}</T> : null}
              {hasTags ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {capReason(it.m.id) ? <Tag label="تفكير" /> : null}
                {capVision(it.m.id) ? <Tag label="رؤية" /> : null}
                {hasP(params.models[modelKey(it.ep.id, it.m.id)] as any) ? <Tag label="معاملات مخصصة" accent /> : null}
                {ctx ? <Tag label={'≈' + fmtCtx(ctx)} /> : null}
                {s === 'busy' ? <Tag label="يختبر…" /> : s === 'ok' ? <Tag label={'✓ ' + (lat != null ? secs(lat) : '')} accent /> : s === 'bad' ? <Tag label="فشل" bad /> : null}
                {on ? <Tag label="الحالي" accent /> : null}
                {second ? <Tag label="الثاني" accent /> : null}
              </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T size={11.5} color="muted" style={{ flex: 1 }}>{use[it.key]?.n ? use[it.key].n + ' استخدام' : 'لم يُستخدم بعد'}</T>
                {!multi ? <Button title={on ? 'قيد الاستخدام' : 'استخدام'} kind={on ? 'soft' : 'ghost'} small disabled={on || !it.ep.enabled} onPress={() => useIt(it)} /> : null}
              </View>
            </Card>
          </Pressable>
        );
      })}
      {view.length > shown.length ? <Button title={`عرض المزيد (${view.length - shown.length})`} kind="ghost" onPress={() => setLimit((l) => l + 60)} /> : null}
      </ScrollView>

      {/* التصفية */}
      <Sheet visible={filt} onClose={() => setFilt(false)} title="تصفية وترتيب" full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Group2 title="القدرات (تقدير بحسب الاسم)">{CAPS.map(([k, l]) => <Chip key={k} label={l} active={ui.cap === k} onPress={() => set({ cap: k })} />)}</Group2>
          <Group2 title="حالة الاتصال">{STS.map(([k, l]) => <Chip key={k} label={l} active={ui.st === k} onPress={() => set({ st: k })} />)}</Group2>
          {endpoints.length > 1 ? (
            <Group2 title="النقطة">
              <Chip label="كل النقاط" active={ui.ep === 'all'} onPress={() => set({ ep: 'all' })} />
              {endpoints.map((e) => <Chip key={e.id} label={`${hostOf(e.url)} · ${e.models.length}`} active={ui.ep === e.id} onPress={() => set({ ep: e.id })} />)}
            </Group2>
          ) : null}
          <Group2 title="العائلة">
            <Chip label="الكل" active={ui.fam === 'all'} onPress={() => set({ fam: 'all' })} />
            {fams.map((f) => <Chip key={f} label={f} active={ui.fam === f} onPress={() => set({ fam: f })} />)}
          </Group2>
          <Group2 title="الترتيب">{SORTS.map(([k, l]) => <Chip key={k} label={l} active={ui.sort === k} onPress={() => set({ sort: k })} />)}</Group2>
          {filtersActive(ui) ? <Button title="إعادة ضبط التصفية" kind="ghost" icon="x" onPress={() => set({ q: '', cap: 'all', ep: 'all', st: 'all', fam: 'all' })} /> : null}
          <Button title="تم" onPress={() => setFilt(false)} />
        </ScrollView>
      </Sheet>

      {/* نظرة عامة */}
      <Sheet visible={over} onClose={() => setOver(false)} title="نظرة عامة" full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Card style={{ gap: 8 }}>
            <T weight="bold">صحة الاتصال</T>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.surface2 }}>
              <View style={{ flex: st.ok, backgroundColor: c.accent }} /><View style={{ flex: st.bad, backgroundColor: c.danger }} /><View style={{ flex: st.none, backgroundColor: c.surface3 }} />
            </View>
            <T size={12.5} color="text2">سليم {st.ok} · فاشل {st.bad} · لم يُختبر {st.none}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Button title="اختبار المفعّلة" icon="clock" kind="ghost" small disabled={!counts.on} onPress={() => { const l = all.filter((i) => i.m.on && i.ep.enabled); toast(`يختبر ${l.length} نموذجًا…`); void testMany(l).then((r) => toast(`ناجح: ${r.ok} · فاشل: ${r.bad}`)); }} />
              <Button title="اختبار غير المختبرة" kind="ghost" small disabled={!st.none} onPress={() => { const l = all.filter((i) => i.ep.enabled && statusOf(meta[i.key], tests[i.key]) === 'none'); toast(`يختبر ${l.length} نموذجًا…`); void testMany(l).then((r) => toast(`ناجح: ${r.ok} · فاشل: ${r.bad}`)); }} />
              <Button title="عرض الفاشلة" kind="ghost" small disabled={!st.bad} onPress={() => { set({ tab: 'all', st: 'bad', ep: 'all' }); setOver(false); }} />
            </View>
          </Card>
          <Card style={{ gap: 8 }}>
            <T weight="bold">الأسرع استجابةً</T>
            {fastest.length ? fastest.map((i) => <Bar key={i.key} label={shortModel(i.m.id)} n={latOf(meta[i.key], tests[i.key])!} mx={latOf(meta[fastest[fastest.length - 1].key], tests[fastest[fastest.length - 1].key])!} tip={secs(latOf(meta[i.key], tests[i.key]))} />) : <T size={12.5} color="muted">اختبر بعض النماذج لتظهر هنا.</T>}
          </Card>
          <Card style={{ gap: 8 }}>
            <T weight="bold">الأكثر استخدامًا</T>
            {topUsed.length ? topUsed.map((i) => <Bar key={i.key} label={meta[i.key]?.alias || shortModel(i.m.id)} n={use[i.key].n} mx={use[topUsed[0].key].n} />) : <T size={12.5} color="muted">لم تستخدم أي نموذج بعد.</T>}
          </Card>
          <Card style={{ gap: 8 }}>
            <T weight="bold">العائلات</T>
            {famRows.length ? famRows.map(([f, n]) => <Bar key={f} label={f} n={n} mx={famRows[0][1]} tip={`${n} · ${Math.round((n / (all.length || 1)) * 100)}%`} />) : <T size={12.5} color="muted">لا توجد نماذج.</T>}
            <T size={11} color="muted">{FAMS.length} عائلات معروفة، والباقي «أخرى». التصنيف بحسب الاسم.</T>
          </Card>
          {dups.length ? (
            <Card style={{ gap: 8 }}>
              <T weight="bold">نماذج مكررة عبر النقاط ({dups.length})</T>
              {dups.slice(0, 6).map((g) => (
                <View key={g[0].m.id}>
                  <T size={13} ltr weight="medium">{g[0].m.id}</T>
                  <T size={11.5} color="muted" ltr>{g.map((x) => hostOf(x.ep.url)).join(' · ')}</T>
                </View>
              ))}
              <Button title="تنظيف المكررات" kind="ghost" small onPress={() => setDedupe(dedupeKill(all))} />
            </Card>
          ) : null}
          <Card style={{ gap: 8 }}>
            <T weight="bold">النسخ الاحتياطي</T>
            <T size={12.5} color="muted">يحفظ المفضلة والأسماء المستعارة والملاحظات والألوان وقوائم النماذج — دون مفاتيح API.</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="تصدير" icon="download" kind="ghost" small onPress={exportCfg} style={{ flex: 1 }} />
              <Button title="استيراد" icon="upload" kind="ghost" small onPress={importCfg} style={{ flex: 1 }} />
            </View>
          </Card>
        </ScrollView>
      </Sheet>

      <Sheet visible={!!acts} onClose={() => setActs(null)} title={acts ? (meta[acts.key]?.alias || acts.m.id) : undefined}>
        <View style={{ padding: 16 }}>
          {acts ? (
            <Group>
              <Row icon="info" title="التفاصيل والتعديل" onPress={() => { const i = acts; setActs(null); setTimeout(() => setDetail(i), 250); }} />
              <Row icon="check-circle" title="استخدام هذا النموذج" onPress={() => { useIt(acts); setActs(null); }} />
              <Row icon="star" title={fc.fav.has(acts.key) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} onPress={() => { toggleFav(acts.key); setActs(null); }} />
              <Row icon={acts.m.on ? 'eye-off' : 'eye'} title={acts.m.on ? 'تعطيل النموذج' : 'تفعيل النموذج'} onPress={() => { setOn([acts.key], !acts.m.on); setActs(null); }} />
              <Row icon="clock" title="اختبار الاتصال" onPress={() => { const i = acts; setActs(null); toast('يختبر النموذج…'); void testModel(i).then((ok) => toast(ok ? 'الاتصال سليم' : 'فشل الاختبار')); }} />
              <Row icon="send" title="ساحة التجربة" onPress={() => { const i = acts; setActs(null); setTimeout(() => setPlay(i), 250); }} />
              <Row icon="sliders" title="المعاملات" onPress={() => { goParams(acts); setActs(null); }} />
              <Row icon="trash-2" title="حذف النموذج" danger onPress={() => { const i = acts; setActs(null); setTimeout(() => setDel([i.key]), 250); }} />
            </Group>
          ) : null}
        </View>
      </Sheet>

      <DetailSheet item={detail} onClose={() => setDetail(null)} onPlay={setPlay} onDelete={(i) => setDel([i.key])} onParams={goParams} />
      <PlaySheet item={play} onClose={() => setPlay(null)} />
      <BenchSheet items={bench} onClose={() => setBench(null)} />

      <Dialog visible={!!del} title={`حذف ${del?.length ?? 0} نموذج؟`} message="يُحذف من قائمتك فقط (لا يؤثر على المزوّد). يمكنك جلبه من جديد." onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { if (del) remove(del); setDel(null); } }, { title: 'إلغاء', onPress: () => setDel(null) }]} />
      <Dialog visible={!!dedupe} title="تنظيف المكررات" message={`يُبقي نسخة واحدة من كل نموذج مكرر (يُفضَّل المفعّل) ويحذف ${dedupe?.length ?? 0} من قائمتك فقط.`} onClose={() => setDedupe(null)}
        actions={[{ title: 'تنظيف', onPress: () => { if (dedupe) remove(dedupe); setDedupe(null); } }, { title: 'إلغاء', onPress: () => setDedupe(null) }]} />
    </SafeAreaView>
  );
}

function Tag({ label, accent, bad }: { label: string; accent?: boolean; bad?: boolean }) {
  const c = useColors();
  return <T size={11} numberOfLines={1} color={bad ? 'danger' : accent ? 'accent' : 'text2'} style={{ backgroundColor: bad ? c.dangerSoft : accent ? c.accentSoft : c.surface2, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>{label}</T>;
}
function Group2({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={12.5} weight="medium" color="muted">{title}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}
