import { View } from 'react-native';
import { ENGINE_LABEL, webSearch, type Engine } from '../../src/api/web';
import { Button, Chip, Field, Group, Screen, T } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { useState } from 'react';

const ENGINES = Object.keys(ENGINE_LABEL) as Engine[];

export default function WebSettings() {
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
    <Screen title="بحث الويب">
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
    </Screen>
  );
}
