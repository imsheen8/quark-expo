import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DEFAULT_SYSTEM } from '../../src/api/providers';
import type { Params } from '../../src/api/types';
import { Button, Card, Field, Screen, T } from '../../src/components/ui/kit';
import { Segmented } from '../../src/components/ui/panels';
import { shortModel } from '../../src/lib/util';
import { modelKey, useSettings } from '../../src/store/settings';
import { toast } from '../../src/store/data';

type Tab = 'instructions' | 'params';

const num = (t: string): number | undefined => {
  const v = parseFloat(t.replace(',', '.'));
  return isFinite(v) ? v : undefined;
};

function Editor({ value, onSave, title, hint }: { value: Params; onSave: (p: Params) => void; title: string; hint?: string }) {
  const [t, setT] = useState(value.temperature?.toString() ?? '');
  const [p, setP] = useState(value.top_p?.toString() ?? '');
  const [m, setM] = useState(value.max_tokens?.toString() ?? '');
  return (
    <Card>
      <T weight="semibold">{title}</T>
      {hint ? <T size={12} color="muted">{hint}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field style={{ flex: 1 }} label="Temperature (0–2)" value={t} onChangeText={setT} keyboardType="decimal-pad" ltr placeholder="افتراضي" />
        <Field style={{ flex: 1 }} label="Top P (0–1)" value={p} onChangeText={setP} keyboardType="decimal-pad" ltr placeholder="افتراضي" />
      </View>
      <Field label="Max Tokens" value={m} onChangeText={setM} keyboardType="number-pad" ltr placeholder="افتراضي" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title="حفظ"
          small
          style={{ flex: 1 }}
          onPress={() => {
            const r: Params = {};
            const tv = num(t), pv = num(p), mv = num(m);
            if (tv != null) r.temperature = Math.min(2, Math.max(0, tv));
            if (pv != null) r.top_p = Math.min(1, Math.max(0, pv));
            if (mv != null) r.max_tokens = Math.max(1, Math.round(mv));
            onSave(r);
            toast('تم الحفظ');
          }}
        />
        <Button title="مسح" kind="ghost" small style={{ flex: 1 }} onPress={() => { setT(''); setP(''); setM(''); onSave({}); }} />
      </View>
    </Card>
  );
}

function InstructionsTab() {
  const { customInstructions, systemPrompt, patch } = useSettings();
  return (
    <View style={{ gap: 14 }}>
      <T size={13} color="muted">تُرسل هذه التعليمات للنموذج مع كل محادثة. تبقى على جهازك.</T>
      <Field
        label="تعليمات خاصة"
        multiline
        value={customInstructions}
        onChangeText={(t) => patch({ customInstructions: t })}
        placeholder="مثال: أجب بإيجاز، واستخدم أمثلة برمجية بلغة Python، وخاطبني بالفصحى المبسّطة."
        inputStyle={{ minHeight: 120 }}
      />
      <View style={{ gap: 8 }}>
        <Field label="موجّه النظام (System Prompt)" multiline value={systemPrompt} onChangeText={(t) => patch({ systemPrompt: t })} inputStyle={{ minHeight: 120 }} />
        <Button title="استعادة الافتراضي" kind="ghost" small onPress={() => patch({ systemPrompt: DEFAULT_SYSTEM })} style={{ alignSelf: 'flex-start' }} />
      </View>
    </View>
  );
}

function ParamsTab() {
  const { params, setGlobalParams, setModelParams, sel } = useSettings();
  const key = sel ? modelKey(sel.ep, sel.model) : null;
  return (
    <View style={{ gap: 14 }}>
      <Editor title="عامة (لكل النماذج)" hint="اترك الحقل فارغًا لاستخدام قيمة المزوّد الافتراضية." value={params.global} onSave={setGlobalParams} />
      {key && sel ? (
        <Editor key={key} title={'خاصة بالنموذج: ' + shortModel(sel.model)} hint="تتقدّم على العامة لهذا النموذج فقط." value={params.models[key] ?? {}} onSave={(p) => setModelParams(key, p)} />
      ) : null}
    </View>
  );
}

export default function Personalize() {
  const { tab: initial } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(initial === 'params' ? 'params' : 'instructions');
  return (
    <Screen title="التخصيص">
      <Segmented<Tab>
        items={[{ key: 'instructions', label: 'التعليمات' }, { key: 'params', label: 'معاملات التوليد' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'instructions' ? <InstructionsTab /> : <ParamsTab />}
    </Screen>
  );
}
