import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  cancelDownload, deleteModel, deviceRamGB, engineAvailable, LOCAL_EP, resolveRepo, searchHf, startDownload, suggestVariant,
  useDownloads, useLocal, type HfHit, type LocalModel,
} from '../src/api/local';
import { approxBytes, fit, fmtBytes, SEED, type SeedModel, type Variant } from '../src/api/localCore';
import { fmtCtx } from '../src/api/modelsCore';
import { Button, Card, Chip, Dialog, Empty, Field, Group, Icon, IconButton, Row, Sheet, T, haptic } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

/** صفحة «نماذج على الجهاز»: بنفس تصميم صفحة النماذج (رأس بأيقونات، تبويبات سفلية الخط، بطاقات بوسوم، أوراق تصفية وإجراءات). */

type Tab = 'rec' | 'mine' | 'search';
type Target = { repo: string; name: string; params: number };
type Ui = { cap: 'all' | 'think' | 'code' | 'small' | 'ar'; fit: 'all' | 'ok' | 'great'; fam: string; sort: 'name' | 'size' | 'params' | 'ar' };

const DEF: Ui = { cap: 'all', fit: 'all', fam: 'all', sort: 'ar' };
const CAPS: [Ui['cap'], string][] = [['all', 'الكل'], ['think', 'تفكير'], ['code', 'برمجة'], ['small', 'خفيف'], ['ar', 'عربي جيد']];
const FITS: [Ui['fit'], string][] = [['all', 'الكل'], ['ok', 'يناسب جهازي'], ['great', 'ممتاز فقط']];
const SORTS: [Ui['sort'], string][] = [['ar', 'دعم العربية'], ['name', 'الاسم'], ['size', 'الأصغر حجمًا'], ['params', 'الأكبر معاملات']];
const FIT_TONE = { great: 'accent', good: 'accent', slow: 'plain', tight: 'plain', no: 'bad' } as const;
const FIT_COLOR = { great: 'ok', good: 'ok', slow: 'accent', tight: 'accent', no: 'danger' } as const;
const active = (u: Ui) => u.cap !== 'all' || u.fit !== 'all' || u.fam !== 'all' || u.sort !== DEF.sort;

export default function LocalModels() {
  const c = useColors();
  const router = useRouter();
  const ram = useMemo(() => deviceRamGB(), []);
  const engine = useMemo(() => engineAvailable(), []);
  const models = useLocal((s) => s.models);
  const hfToken = useLocal((s) => s.hfToken);
  const dls = useDownloads((s) => s.items);
  const sel = useSettings((s) => s.sel);

  const [tab, setTab] = useState<Tab>('rec');
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [ui, setUi] = useState<Ui>(DEF);
  const [filt, setFilt] = useState(false);
  const [cfg, setCfg] = useState(false);
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [acts, setActs] = useState<LocalModel | null>(null);
  const [hits, setHits] = useState<HfHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [vars, setVars] = useState<Variant[] | null>(null);
  const [vErr, setVErr] = useState('');
  const [del, setDel] = useState<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (p: Partial<Ui>) => setUi((u) => ({ ...u, ...p }));

  useEffect(() => {
    if (tab !== 'search') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setHits(await searchHf(q)); } catch (e) { toast(e instanceof Error ? e.message : String(e)); setHits([]); }
      setBusy(false);
    }, q ? 500 : 0);
  }, [q, tab]);

  const go = (t: Tab) => { haptic(); setTab(t); setQ(''); setMulti(false); setPicked([]); setSearching(t === 'search'); };
  const open = async (t: Target) => {
    setTarget(t); setVars(null); setVErr('');
    try { setVars((await resolveRepo(t.repo)).variants); } catch (e) { setVErr(e instanceof Error ? e.message : String(e)); }
  };
  const download = (v: Variant) => {
    if (!target) return;
    const t = target;
    setTarget(null);
    toast('بدأ التنزيل');
    void startDownload({ repo: t.repo, name: t.name, variant: v, params: t.params || v.size / 1024 ** 3 / 0.6 });
  };
  const isSel = (id: string) => sel?.ep === LOCAL_EP && sel.model === id;
  const useIt = (m: LocalModel) => { useSettings.getState().select(LOCAL_EP, m.id); toast('تم اختيار النموذج: ' + m.name); };
  const remove = (ids: string[]) => { ids.forEach((id) => void deleteModel(id)); setPicked((p) => p.filter((k) => !ids.includes(k))); toast('تم الحذف'); };
  const toggleSel = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const rec = vars ? suggestVariant(vars) : null;
  const dlList = Object.values(dls);
  const needle = q.trim().toLowerCase();
  const fams = useMemo(() => [...new Set(SEED.map((m) => m.fam))].sort(), []);

  const recView = useMemo(() => {
    const rows = SEED.map((m) => ({ m, size: approxBytes(m.params), f: fit(approxBytes(m.params), m.params, ram) }))
      .filter(({ m, f }) =>
        (!needle || (m.name + ' ' + m.repo + ' ' + m.note).toLowerCase().includes(needle)) &&
        (ui.cap === 'all' || (ui.cap === 'ar' ? m.ar === 2 : m.tags.includes(ui.cap))) &&
        (ui.fam === 'all' || m.fam === ui.fam) &&
        (ui.fit === 'all' || (ui.fit === 'great' ? f.level === 'great' : f.level !== 'no')));
    const by = { name: (a: typeof rows[0], b: typeof rows[0]) => a.m.name.localeCompare(b.m.name), size: (a: typeof rows[0], b: typeof rows[0]) => a.size - b.size, params: (a: typeof rows[0], b: typeof rows[0]) => b.m.params - a.m.params, ar: (a: typeof rows[0], b: typeof rows[0]) => b.m.ar - a.m.ar || a.size - b.size };
    return rows.sort(by[ui.sort]);
  }, [needle, ui, ram]);
  const mineView = useMemo(() => models.filter((m) => !needle || (m.name + ' ' + m.repo + ' ' + m.quant).toLowerCase().includes(needle)), [models, needle]);
  const allPicked = mineView.length > 0 && mineView.every((m) => picked.includes(m.id));

  const tabBtn = (k: Tab, label: string, n?: number) => (
    <Pressable key={k} onPress={() => go(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderBottomWidth: 2.5, borderBottomColor: tab === k ? c.accent : 'transparent', marginBottom: -1 }}>
      <T size={14} weight="medium" color={tab === k ? 'accent' : 'text2'}>{label}</T>
      {n != null ? <T size={12} color="muted">{n}</T> : null}
    </Pressable>
  );

  const recCard = ({ m, size, f }: { m: SeedModel; size: number; f: ReturnType<typeof fit> }) => {
    const have = models.some((x) => x.repo === m.repo);
    return (
      <Pressable key={m.id} onPress={() => { haptic(); void open({ repo: m.repo, name: m.name, params: m.params }); }}>
        <Card style={{ gap: 8, borderRadius: 18, borderWidth: 1.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={16} weight="semibold" ltr numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{m.name}</T>
            {have ? <Icon name="check-circle" size={17} color={c.ok} /> : null}
          </View>
          <T size={12} color="muted" ltr numberOfLines={1}>{m.repo}</T>
          <T size={12.5} color="text2" numberOfLines={2}>{m.note}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Tag label={'≈' + fmtBytes(size)} />
            <Tag label={f.label} tone={FIT_TONE[f.level]} />
            {m.tags.includes('think') ? <Tag label="تفكير" /> : null}
            {m.tags.includes('code') ? <Tag label="برمجة" /> : null}
            {m.ar === 2 ? <Tag label="عربي جيد" accent /> : m.ar === 1 ? <Tag label="عربي مقبول" /> : null}
            <Tag label={fmtCtx(m.ctx)} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T size={11.5} color={FIT_COLOR[f.level]} numberOfLines={1} style={{ flex: 1 }}>{f.why || (have ? 'منزَّل على جهازك' : 'غير منزَّل')}</T>
            <Button small kind={have ? 'soft' : 'ghost'} icon="download" title={have ? 'منزَّل — صيغة أخرى' : 'تنزيل'} onPress={() => void open({ repo: m.repo, name: m.name, params: m.params })} />
          </View>
        </Card>
      </Pressable>
    );
  };

  const mineCard = (m: LocalModel) => {
    const cur = isSel(m.id);
    const picked1 = picked.includes(m.id);
    return (
      <Pressable key={m.id} onPress={() => { haptic(); multi ? toggleSel(m.id) : setActs(m); }} onLongPress={() => { if (!multi) { setMulti(true); setPicked([m.id]); } }}>
        <Card style={{ gap: 8, borderRadius: 18, borderWidth: 1.5, borderColor: picked1 ? c.accent : c.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {multi ? <Icon name={picked1 ? 'check-circle' : 'circle'} size={22} color={picked1 ? c.accent : c.muted} /> : null}
            <T size={16} weight="semibold" ltr numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{m.name}</T>
            {!multi ? <IconButton name="more-vertical" size={19} label="المزيد" onPress={() => setActs(m)} style={{ width: 34, height: 34 }} /> : null}
          </View>
          <T size={12} color="muted" ltr numberOfLines={1}>{m.repo}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Tag label={m.quant || '—'} />
            <Tag label={fmtBytes(m.size)} />
            <Tag label={'سياق ' + fmtCtx(m.ctx)} />
            {cur ? <Tag label="الحالي" accent /> : null}
          </View>
          {!multi ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T size={11.5} color="muted" style={{ flex: 1 }}>محلي · يعمل دون إنترنت</T>
              <Button small kind={cur ? 'soft' : 'ghost'} title={cur ? 'قيد الاستخدام' : 'استخدام'} disabled={cur} onPress={() => useIt(m)} />
            </View>
          ) : null}
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 56 }}>
        <IconButton name="arrow-right" label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace('/models'))} style={{ width: 44, height: 44 }} />
        <T size={20} weight="bold" style={{ flex: 1 }} numberOfLines={1}>نماذج على الجهاز</T>
        {tab !== 'search' ? <IconButton name="search" label="بحث" active={searching || !!q} onPress={() => { setSearching((v) => !v); setQ(''); }} /> : null}
        {tab === 'rec' ? <IconButton name="sliders" label="تصفية وترتيب" active={active(ui)} onPress={() => setFilt(true)} /> : null}
        {tab === 'mine' ? <IconButton name="check-square" label="تحديد متعدد" active={multi} onPress={() => { setMulti((m) => !m); setPicked([]); }} /> : null}
        <IconButton name="settings" label="إعدادات التنزيل" onPress={() => setCfg(true)} />
      </View>

      {searching || tab === 'search' ? (
        <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: c.accent, height: 44 }}>
          <Icon name="search" size={18} color={c.accent} />
          <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} autoFocus={tab !== 'search'} value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false}
            placeholder={tab === 'search' ? 'ابحث عن GGUF… أو الصق owner/repo أو رابطًا' : 'بحث'} placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 15, textAlign: 'auto' }} />
        </View>
      ) : null}

      {multi && tab === 'mine' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Button small kind="soft" title={allPicked ? 'إلغاء التحديد' : 'تحديد الكل'} onPress={() => setPicked(allPicked ? [] : mineView.map((m) => m.id))} />
          <Button small kind="danger" icon="trash-2" title="حذف" disabled={!picked.length} onPress={() => setDel(picked)} />
          <T size={12.5} color="muted">{picked.length ? picked.length + ' محدد' : ''}</T>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 16, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {tabBtn('rec', 'المقترحة', SEED.length)}
        {tabBtn('mine', 'تنزيلاتي', models.length)}
        {tabBtn('search', 'بحث HF')}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: engine ? c.accentSoft : c.dangerSoft }}>
          <Icon name={engine ? 'cpu' : 'alert-triangle'} size={22} color={engine ? c.accent : c.danger} />
          <View style={{ flex: 1 }}>
            <T weight="semibold">{engine ? 'محرك llama.cpp جاهز' : 'المحرك غير متوفر في هذه النسخة'}</T>
            <T size={12.5} color="text2">{engine ? `ذاكرة جهازك ≈ ${ram.toFixed(1)} GB — التقديرات تقريبية ولا تُرسل بياناتك لأي خادم.` : 'التنزيل يعمل، لكن التشغيل يحتاج Development Build (ليس Expo Go).'}</T>
          </View>
        </View>

        {dlList.map((d) => (
          <Card key={d.id} style={{ gap: 8, borderRadius: 18, borderWidth: 1.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T weight="semibold" ltr style={{ flex: 1 }} numberOfLines={1}>{d.name}</T>
              {d.state === 'run' ? <T size={12} color="muted">{fmtBytes(d.done)} / {fmtBytes(d.total)}</T> : null}
              <IconButton name="x" label="إلغاء" size={19} onPress={() => void cancelDownload(d.id)} style={{ width: 34, height: 34 }} />
            </View>
            {d.state === 'error' ? <T size={12.5} color="danger">{d.err}</T> : (
              <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: 'hidden' }}>
                <View style={{ width: `${d.total ? Math.min(100, (d.done / d.total) * 100) : 5}%`, height: 8, backgroundColor: c.accent }} />
              </View>
            )}
          </Card>
        ))}

        {tab === 'rec' ? (
          recView.length ? recView.map(recCard) : <Empty icon="cpu" title="لا نتائج مطابقة للتصفية" sub="جرّب إعادة ضبط التصفية أو البحث بكلمة أخرى." />
        ) : null}

        {tab === 'mine' ? (
          mineView.length ? (
            <>
              {mineView.map(mineCard)}
              <T size={11.5} color="muted">اضغط نموذجًا لخياراته. أول رد بعد الاختيار أبطأ لأن النموذج يُحمَّل في الذاكرة.</T>
            </>
          ) : <Empty icon="download" title={models.length ? 'لا نتائج مطابقة' : 'لا توجد نماذج منزَّلة'} sub={models.length ? undefined : 'اختر نموذجًا من «المقترحة» أو ابحث في Hugging Face.'} />
        ) : null}

        {tab === 'search' ? (
          <>
            {q.includes('/') ? <Button title="فتح هذا المستودع" kind="soft" icon="external-link" onPress={() => void open({ repo: q, name: q.trim().split('/').slice(-1)[0] || q, params: 0 })} /> : null}
            {busy ? <ActivityIndicator color={c.accent} /> : null}
            {(hits ?? []).map((h) => (
              <Pressable key={h.repo} onPress={() => { haptic(); void open({ repo: h.repo, name: h.repo.split('/')[1], params: h.params }); }}>
                <Card style={{ gap: 8, borderRadius: 18, borderWidth: 1.5 }}>
                  <T size={16} weight="semibold" ltr numberOfLines={1}>{h.repo}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <Tag label={'↓ ' + h.downloads.toLocaleString('en')} />
                    <Tag label={'♥ ' + h.likes} />
                    {h.params ? <Tag label={h.params + 'B'} /> : null}
                    {h.gated ? <Tag label="يتطلب رمزًا" bad /> : null}
                  </View>
                </Card>
              </Pressable>
            ))}
            {!busy && hits && !hits.length ? <Empty icon="search" title="لا نتائج" sub="جرّب كلمة أخرى أو الصق owner/repo." /> : null}
          </>
        ) : null}
      </ScrollView>

      {/* التصفية */}
      <Sheet visible={filt} onClose={() => setFilt(false)} title="تصفية وترتيب" full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Group2 title="النوع">{CAPS.map(([k, l]) => <Chip key={k} label={l} active={ui.cap === k} onPress={() => set({ cap: k })} />)}</Group2>
          <Group2 title="الملاءمة لجهازك">{FITS.map(([k, l]) => <Chip key={k} label={l} active={ui.fit === k} onPress={() => set({ fit: k })} />)}</Group2>
          <Group2 title="العائلة">
            <Chip label="الكل" active={ui.fam === 'all'} onPress={() => set({ fam: 'all' })} />
            {fams.map((f) => <Chip key={f} label={f} active={ui.fam === f} onPress={() => set({ fam: f })} />)}
          </Group2>
          <Group2 title="الترتيب">{SORTS.map(([k, l]) => <Chip key={k} label={l} active={ui.sort === k} onPress={() => set({ sort: k })} />)}</Group2>
          {active(ui) ? <Button title="إعادة ضبط التصفية" kind="ghost" icon="x" onPress={() => setUi(DEF)} /> : null}
          <Button title="تم" onPress={() => setFilt(false)} />
        </ScrollView>
      </Sheet>

      {/* إعدادات التنزيل */}
      <Sheet visible={cfg} onClose={() => setCfg(false)} title="إعدادات التنزيل">
        <View style={{ padding: 16, gap: 10 }}>
          <Field label="رمز Hugging Face (اختياري، للمستودعات المقيّدة)" ltr secureTextEntry value={hfToken} onChangeText={(t) => useLocal.getState().patch({ hfToken: t })} placeholder="hf_…" />
          <T size={11.5} color="muted">التنزيل يحتاج بقاء التطبيق مفتوحًا. استخدم Wi‑Fi: النماذج بحجم مئات الميغابايت إلى عدة غيغابايت.</T>
          <Button title="تم" onPress={() => setCfg(false)} />
        </View>
      </Sheet>

      {/* إجراءات النموذج المنزَّل */}
      <Sheet visible={!!acts} onClose={() => setActs(null)} title={acts?.name}>
        <View style={{ padding: 16 }}>
          {acts ? (
            <Group>
              <Row icon="check-circle" title="استخدام هذا النموذج" onPress={() => { useIt(acts); setActs(null); }} />
              <Row icon="trash-2" title="حذف النموذج" danger onPress={() => { const m = acts; setActs(null); setTimeout(() => setDel([m.id]), 250); }} />
            </Group>
          ) : null}
        </View>
      </Sheet>

      {/* اختيار الصيغة */}
      <Sheet visible={!!target} onClose={() => setTarget(null)} title={target?.name} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {!vars && !vErr ? <ActivityIndicator color={c.accent} /> : null}
          {vErr ? <T size={13.5} color="danger">{vErr}</T> : null}
          {vars ? (
            <>
              <T size={12.5} color="text2">اختر صيغة التكميم. الأصغر أسرع وأخف وأقل جودة. المقترحة لجهازك مُعلَّمة.</T>
              {[...vars].sort((a, b) => a.size - b.size).map((v) => {
                const f = fit(v.size, target?.params || v.size / 1024 ** 3 / 0.6, ram);
                const best = rec?.key === v.key;
                return (
                  <Pressable key={v.key} onPress={() => download(v)}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1.5, borderColor: best ? c.accent : c.border }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <T weight="semibold" ltr>{v.quant}{v.total > 1 ? ` · ${v.total} أجزاء` : ''}</T>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {best ? <Tag label="★ مقترح" accent /> : null}
                          <Tag label={f.label} tone={FIT_TONE[f.level]} />
                        </View>
                        {f.why ? <T size={11.5} color={FIT_COLOR[f.level]}>{f.why}</T> : null}
                      </View>
                      <T size={13} color="text2">{fmtBytes(v.size)}</T>
                      <Icon name="download" size={18} color={c.accent} />
                    </Card>
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </Sheet>

      <Dialog visible={!!del} title={`حذف ${del?.length ?? 0} نموذج؟`} message="سيُحذف الملف من جهازك ويمكنك تنزيله لاحقًا." onClose={() => setDel(null)}
        actions={[{ title: 'حذف', kind: 'danger', onPress: () => { if (del) remove(del); setDel(null); } }, { title: 'إلغاء', onPress: () => setDel(null) }]} />
    </SafeAreaView>
  );
}

function Tag({ label, accent, bad, tone }: { label: string; accent?: boolean; bad?: boolean; tone?: 'accent' | 'bad' | 'plain' }) {
  const c = useColors();
  const b = bad || tone === 'bad';
  const a = accent || tone === 'accent';
  return <T size={11} numberOfLines={1} color={b ? 'danger' : a ? 'accent' : 'text2'} style={{ backgroundColor: b ? c.dangerSoft : a ? c.accentSoft : c.surface2, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>{label}</T>;
}
function Group2({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={12.5} weight="medium" color="muted">{title}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}
