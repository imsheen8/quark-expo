import { View } from 'react-native';
import { ENGINE_LABEL, webSearch, type Engine } from '../../src/api/web';
import { ModelSelect } from '../../src/components/ModelSelect';
import { Segmented } from '../../src/components/ui/panels';
import { Button, Card, Chip, Field, Screen, T } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { useState } from 'react';

const ENGINES = Object.keys(ENGINE_LABEL) as Engine[];

export default function SearchSettings() {
  const [tab, setTab] = useState<'web' | 'deep'>('web');
  const conf = useSettings((s) => s.search);
  const patch = useSettings((s) => s.patch);
  const set = (p: Partial<typeof conf>) => patch({ search: { ...conf, ...p } });
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    try {
      const r = await webSearch(conf, 'QUARK AI');
      toast(`نجح: ${r.rows.length} نتيجة عبر ${ENGINE_LABEL[r.engine]}`);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const needKey = ['tavily', 'brave', 'serper', 'google_pse'].includes(conf.engine);
  return (
    <Screen title="البحث">
      <Segmented
        value={tab}
        onChange={setTab}
        items={[
          { key: 'web', label: 'بحث الويب', icon: 'globe' },
          { key: 'deep', label: 'البحث العميق', icon: 'search' },
        ]}
      />
      {tab === 'deep' ? <DeepSettings /> : <>
      <T size={13} color="text2">DuckDuckGo يعمل دون مفتاح لكنه قد يحجب الطلبات الكثيرة؛ للنتائج الأوثق استخدم Tavily أو Brave أو Serper أو SearXNG خاص بك. عند فشل المحرك الأساسي تُجرَّب البدائل المحدّدة بالترتيب.</T>
      <T size={13} weight="medium">المحرك الأساسي</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{ENGINES.map((e) => <Chip key={e} label={ENGINE_LABEL[e]} active={conf.engine === e} onPress={() => set({ engine: e })} />)}</View>
      {needKey ? <Field label="مفتاح API" ltr secureTextEntry value={conf.key} onChangeText={(t) => set({ key: t })} /> : null}
      {conf.engine === 'google_pse' ? <Field label="معرّف محرك البحث (cx)" ltr value={conf.cx} onChangeText={(t) => set({ cx: t })} /> : null}
      {conf.engine === 'searxng' ? <Field label="عنوان SearXNG" ltr placeholder="https://searx.example.com" value={conf.url} onChangeText={(t) => set({ url: t })} /> : null}
      <Field label="عدد النتائج" ltr keyboardType="number-pad" value={String(conf.results)} onChangeText={(t) => set({ results: Math.max(1, Math.min(10, +t || 8)) })} />
      <T size={13} weight="medium">بدائل عند الفشل</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ENGINES.filter((e) => e !== conf.engine).map((e) => <Chip key={e} label={ENGINE_LABEL[e]} active={conf.fallbacks.includes(e)} onPress={() => set({ fallbacks: conf.fallbacks.includes(e) ? conf.fallbacks.filter((x) => x !== e) : [...conf.fallbacks, e] })} />)}
      </View>
      <Button title="اختبار البحث" icon="check" kind="soft" onPress={test} loading={busy} />
      </>}
    </Screen>
  );
}

/** إعدادات البحث العميق: تظهر الأبحاث نفسها في المحادثة، وهنا الإعدادات فقط */
function DeepSettings() {
  const deep = useSettings((s) => s.deep);
  const defs = useSettings((s) => s.defs);
  const patch = useSettings((s) => s.patch);
  const set = (p: Partial<typeof deep>) => patch({ deep: { ...useSettings.getState().deep, ...p } });
  return (
    <>
      <T size={13} color="text2">فعّل «بحث عميق» من قائمة + في خانة الرسالة؛ يحدّد النموذج بنفسه هل رسالتك تحتاج بحثًا، فيخطّط أسئلة فرعية ويبحث في الويب ويقرأ الصفحات ثم يكتب تقريرًا مع مصادر يظهر في المحادثة. يعمل والتطبيق مفتوح وقد يستغرق دقائق.</T>
      <Card style={{ gap: 8 }}>
        <T weight="bold">نموذج البحث العميق</T>
        <T size={12.5} color="muted">ينفّذ تحديد نوع الرسالة والتخطيط واستخلاص الملاحظات وكتابة التقرير.</T>
        <ModelSelect label="نموذج البحث العميق" value={defs.research} onChange={(v) => patch({ defs: { ...useSettings.getState().defs, research: v } })} empty="نفس نموذج المحادثة" />
      </Card>
      <Field label="عدد الأسئلة الفرعية (2–8)" ltr keyboardType="number-pad" value={String(deep.questions)} onChangeText={(t) => set({ questions: Math.max(2, Math.min(8, +t || 4)) })} />
      <Field label="عدد الصفحات المقروءة لكل سؤال (1–5)" ltr keyboardType="number-pad" value={String(deep.pages)} onChangeText={(t) => set({ pages: Math.max(1, Math.min(5, +t || 3)) })} />
      <T size={12} color="muted">القيم الأعلى تعطي تقريرًا أشمل لكنها أبطأ وتستهلك رموزًا أكثر. يستخدم البحث العميق محرك بحث الويب المحدد في التبويب الآخر.</T>
    </>
  );
}
