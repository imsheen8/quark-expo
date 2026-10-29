import { useState } from 'react';
import { View } from 'react-native';
import { MAX_FB, type Defs, type ModelRef } from '../../src/api/defaultsCore';
import { ModelSelect } from '../../src/components/ModelSelect';
import { Button, Card, Empty, Screen, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';

type Sec = 'util' | 'vision';

export default function Defaults() {
  const defs = useSettings((s) => s.defs);
  const hasModels = useSettings((s) => s.endpoints.some((e) => e.enabled && e.models.some((m) => m.on)));
  const patch = useSettings((s) => s.patch);
  const [adding, setAdding] = useState<Record<Sec, boolean>>({ util: false, vision: false });
  const set = (p: Partial<Defs>) => patch({ defs: { ...useSettings.getState().defs, ...p } });
  const setSec = (k: Sec, p: Partial<Defs[Sec]>) => set({ [k]: { ...useSettings.getState().defs[k], ...p } } as any);
  const setFb = (k: Sec, i: number, v: ModelRef | null) => {
    const fb = [...useSettings.getState().defs[k].fb];
    if (v) fb[i] = v; else fb.splice(i, 1);
    setSec(k, { fb });
  };

  if (!hasModels)
    return (
      <Screen title="النماذج التلقائية">
        <Empty icon="cpu" title="لا توجد نماذج مفعّلة" sub="أضف نقطة اتصال وفعّل بعض النماذج من صفحة «النماذج» ثم عُد لتحديد النموذج المناسب لكل مهمة." />
      </Screen>
    );

  const fbBlock = (k: Sec, vision?: boolean) => (
    <View style={{ gap: 8 }}>
      <T size={12.5} weight="medium" color="muted">البدائل الاحتياطية (تُجرَّب بالترتيب إن فشل السابق قبل أن يصل أي رد)</T>
      {defs[k].fb.map((v, i) => (
        <ModelSelect key={i} label={`البديل ${i + 1}`} value={v} onChange={(x) => setFb(k, i, x)} empty="—" vision={vision} />
      ))}
      {adding[k] ? (
        <ModelSelect label="بديل جديد" value={null} onChange={(x) => { if (x) setFb(k, defs[k].fb.length, x); setAdding((p) => ({ ...p, [k]: false })); }} empty="اختر نموذجًا…" vision={vision} />
      ) : defs[k].fb.length < MAX_FB ? (
        <Button title="إضافة بديل" icon="plus" kind="ghost" small onPress={() => setAdding((p) => ({ ...p, [k]: true }))} />
      ) : null}
    </View>
  );

  return (
    <Screen title="النماذج التلقائية">
      <T size={13} color="text2">حدّد نموذجًا مستقلًا لكل مهمة بدل نموذج المحادثة. تُحفظ التغييرات فورًا. أي نموذج غير متاح (نقطة اتصال معطّلة أو بلا مفتاح) يُتخطّى تلقائيًا.</T>

      <Card style={{ gap: 8 }}>
        <T weight="bold">نموذج المحادثات الجديدة</T>
        <T size={12.5} color="muted">يُختار تلقائيًا عند الضغط على «محادثة جديدة» أو عند الإرسال بلا محادثة مفتوحة. اتركه فارغًا لتبقى آخر نموذج اخترته.</T>
        <ModelSelect label="نموذج المحادثات الجديدة" value={defs.chat} onChange={(v) => set({ chat: v })} empty="آخر نموذج مستخدم" />
      </Card>

      <Card style={{ gap: 8 }}>
        <T weight="bold">نموذج المهام الخلفية</T>
        <T size={12.5} color="muted">العنوان التلقائي واستخراج المهارات من المحادثات، بنموذج صغير وسريع بدل نموذج المحادثة. إن فشل جُرّبت البدائل ثم نموذج المحادثة.</T>
        <ModelSelect label="نموذج المهام الخلفية" value={defs.util.sel} onChange={(v) => setSec('util', { sel: v })} empty="نفس نموذج المحادثة" />
        {fbBlock('util')}
      </Card>

      <Card style={{ gap: 8 }}>
        <T weight="bold">نموذج الرؤية</T>
        <T size={12.5} color="muted">يُستخدم لتحليل الصور حين لا يدعم نموذج المحادثة الرؤية (◉ = يدعمها بحسب الاسم). إن لم يُحدَّد يُستخدم نموذج المحادثة.</T>
        <ModelSelect label="نموذج الرؤية" value={defs.vision.sel} onChange={(v) => setSec('vision', { sel: v })} empty="تلقائي (نموذج المحادثة)" vision />
        {fbBlock('vision', true)}
      </Card>

      <Card style={{ gap: 8 }}>
        <T weight="bold">نموذج البحث العميق</T>
        <T size={12.5} color="muted">ينفّذ التخطيط واستخلاص الملاحظات وكتابة التقرير في «البحث العميق».</T>
        <ModelSelect label="نموذج البحث العميق" value={defs.research} onChange={(v) => set({ research: v })} empty="نفس نموذج المحادثة" />
      </Card>
    </Screen>
  );
}
