import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import {
  cancelDownload, deleteModel, deviceRamGB, engineAvailable, LOCAL_EP, resolveRepo, searchHf, startDownload, suggestVariant,
  useDownloads, useLocal, type HfHit,
} from '../src/api/local';
import { fit, fmtBytes, approxBytes, SEED, type Variant } from '../src/api/localCore';
import { Button, Card, Chip, Dialog, Empty, Field, Group, Icon, Row, Screen, Sheet, T } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

type Target = { repo: string; name: string; params: number };
const FIT_COLOR = { great: 'ok', good: 'ok', slow: 'accent', tight: 'accent', no: 'danger' } as const;

export default function LocalModels() {
  const c = useColors();
  const ram = useMemo(() => deviceRamGB(), []);
  const engine = useMemo(() => engineAvailable(), []);
  const models = useLocal((s) => s.models);
  const hfToken = useLocal((s) => s.hfToken);
  const dls = useDownloads((s) => s.items);
  const sel = useSettings((s) => s.sel);
  const [tab, setTab] = useState<'rec' | 'mine' | 'search'>('rec');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<HfHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [vars, setVars] = useState<Variant[] | null>(null);
  const [vErr, setVErr] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tab !== 'search') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setHits(await searchHf(q)); } catch (e) { toast(e instanceof Error ? e.message : String(e)); setHits([]); }
      setBusy(false);
    }, q ? 500 : 0);
  }, [q, tab]);

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
  const rec = vars ? suggestVariant(vars) : null;
  const dlList = Object.values(dls);
  const isSel = (id: string) => sel?.ep === LOCAL_EP && sel.model === id;

  return (
    <Screen title="نماذج على الجهاز">
      <Card style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={engine ? 'check-circle' : 'alert-triangle'} size={18} color={engine ? c.ok : c.danger} />
          <T weight="semibold">{engine ? 'محرك llama.cpp جاهز' : 'المحرك غير متوفر في هذه النسخة'}</T>
        </View>
        <T size={12.5} color="text2">ذاكرة جهازك ≈ {ram.toFixed(1)} GB — التقديرات أدناه تقريبية. تُحفظ النماذج داخل التطبيق ولا تُرسل بياناتك لأي خادم أثناء الاستخدام.</T>
        {!engine ? <T size={12.5} color="danger">التنزيل يعمل، لكن التشغيل يحتاج Development Build (ليس Expo Go). التفاصيل في README.</T> : null}
      </Card>

      {dlList.map((d) => (
        <Card key={d.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T weight="medium" style={{ flex: 1 }} numberOfLines={1}>{d.name}</T>
            {d.state === 'run' ? <T size={12} color="muted">{fmtBytes(d.done)} / {fmtBytes(d.total)}</T> : null}
            <Pressable onPress={() => cancelDownload(d.id)} hitSlop={8}><Icon name="x" size={18} color={c.muted} /></Pressable>
          </View>
          {d.state === 'error' ? <T size={12.5} color="danger">{d.err}</T> : (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface3, overflow: 'hidden' }}>
              <View style={{ width: `${d.total ? Math.min(100, (d.done / d.total) * 100) : 5}%`, height: 6, backgroundColor: c.accent }} />
            </View>
          )}
        </Card>
      ))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="المقترحة" active={tab === 'rec'} onPress={() => setTab('rec')} />
        <Chip label={`تنزيلاتي (${models.length})`} active={tab === 'mine'} onPress={() => setTab('mine')} />
        <Chip label="بحث HF" icon="search" active={tab === 'search'} onPress={() => setTab('search')} />
      </View>

      {tab === 'rec' ? (
        <View style={{ gap: 10 }}>
          {SEED.map((m) => {
            const size = approxBytes(m.params);
            const f = fit(size, m.params, ram);
            const have = models.some((x) => x.repo === m.repo);
            return (
              <Pressable key={m.id} onPress={() => open({ repo: m.repo, name: m.name, params: m.params })} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface3 : c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 4 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T weight="semibold" style={{ flex: 1 }}>{m.name}</T>
                  {have ? <Icon name="check-circle" size={16} color={c.ok} /> : null}
                  <T size={12} color={FIT_COLOR[f.level]}>{f.label}</T>
                </View>
                <T size={12.5} color="text2">{m.note}</T>
                <T size={11.5} color="muted">≈{fmtBytes(size)} · {'★'.repeat(m.ar + 1)}{'☆'.repeat(2 - m.ar)} عربي{m.tags.includes('think') ? ' · تفكير' : ''}{m.tags.includes('code') ? ' · برمجة' : ''}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {tab === 'mine' ? (
        models.length === 0 ? <Empty icon="download" title="لا توجد نماذج منزَّلة" sub="اختر نموذجًا من «المقترحة» أو ابحث في Hugging Face." /> : (
          <Group>
            {models.map((m) => (
              <Row key={m.id} icon={isSel(m.id) ? 'check-circle' : 'cpu'} title={m.name} sub={`${m.quant} · ${fmtBytes(m.size)} · سياق ${m.ctx}`} chevron={false}
                onPress={() => { useSettings.getState().select(LOCAL_EP, m.id); toast('تم اختيار ' + m.name); }}
                onLongPress={() => setDel(m.id)}
                right={<Pressable onPress={() => setDel(m.id)} hitSlop={8}><Icon name="trash-2" size={18} color={c.muted} /></Pressable>} />
            ))}
          </Group>
        )
      ) : null}
      {tab === 'mine' && models.length ? <T size={11.5} color="muted">اضغط نموذجًا لاختياره للمحادثة. أول رد بعد الاختيار أبطأ لأن النموذج يُحمَّل في الذاكرة.</T> : null}

      {tab === 'search' ? (
        <View style={{ gap: 10 }}>
          <Field placeholder="ابحث عن نموذج GGUF… أو الصق owner/repo أو رابطًا" value={q} onChangeText={setQ} ltr />
          {q.includes('/') ? <Button title="فتح هذا المستودع" kind="soft" onPress={() => open({ repo: q, name: q.trim().split('/').slice(-1)[0] || q, params: 0 })} /> : null}
          {busy ? <ActivityIndicator color={c.accent} /> : null}
          {(hits ?? []).map((h) => (
            <Pressable key={h.repo} onPress={() => open({ repo: h.repo, name: h.repo.split('/')[1], params: h.params })} style={({ pressed }) => ({ backgroundColor: pressed ? c.surface3 : c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12, gap: 2 })}>
              <T size={13.5} weight="medium" ltr numberOfLines={1}>{h.repo}</T>
              <T size={11.5} color="muted">↓ {h.downloads.toLocaleString('en')} · ♥ {h.likes}{h.gated ? ' · يتطلب رمزًا' : ''}{h.params ? ` · ${h.params}B` : ''}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Group title="إعدادات التنزيل">
        <View style={{ padding: 12, gap: 8 }}>
          <Field label="رمز Hugging Face (اختياري، للمستودعات المقيّدة)" ltr secureTextEntry value={hfToken} onChangeText={(t) => useLocal.getState().patch({ hfToken: t })} placeholder="hf_…" />
          <T size={11.5} color="muted">التنزيل يحتاج بقاء التطبيق مفتوحًا. استخدم Wi‑Fi: النماذج بحجم مئات الميغابايت إلى عدة غيغابايت.</T>
        </View>
      </Group>

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
                  <Pressable key={v.key} onPress={() => download(v)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: best ? c.accent : c.border, backgroundColor: pressed ? c.surface3 : c.surface })}>
                    <View style={{ flex: 1 }}>
                      <T weight="medium" ltr>{v.quant}{v.total > 1 ? ` · ${v.total} أجزاء` : ''}{best ? '  ★ مقترح' : ''}</T>
                      <T size={12} color={FIT_COLOR[f.level]}>{f.label}{f.why ? ' — ' + f.why : ''}</T>
                    </View>
                    <T size={13} color="text2">{fmtBytes(v.size)}</T>
                    <Icon name="download" size={18} color={c.accent} />
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </Sheet>

      <Dialog
        visible={!!del}
        title="حذف النموذج؟"
        message="سيُحذف الملف من جهازك ويمكنك تنزيله لاحقًا."
        onClose={() => setDel(null)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (del) void deleteModel(del); setDel(null); } },
          { title: 'إلغاء', onPress: () => setDel(null) },
        ]}
      />
    </Screen>
  );
}
