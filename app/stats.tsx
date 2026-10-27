import { useMemo } from 'react';
import { View } from 'react-native';
import { Card, Empty, Screen, T } from '../src/components/ui/kit';
import { aggregate } from '../src/lib/stats';
import { fmtNum, shortModel } from '../src/lib/util';
import { useChats } from '../src/store/chats';
import { useUsage } from '../src/store/data';
import { useColors } from '../src/theme';

function Tile({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: '45%', backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14 }}>
      <T size={12} color="muted">{label}</T>
      <T size={24} weight="bold" color="accent">{value}</T>
    </View>
  );
}

export default function Stats() {
  const c = useColors();
  const log = useUsage((s) => s.log);
  const chats = useChats((s) => s.chats);
  const st = useMemo(() => aggregate(log), [log]);
  const msgs = chats.reduce((n, ch) => n + ch.messages.length, 0);
  const max = Math.max(1, ...st.days.map((d) => d.total));

  return (
    <Screen title="الإحصائيات" menu>
      {st.calls === 0 && chats.length === 0 ? (
        <Empty icon="bar-chart-2" title="لا توجد بيانات بعد" sub="ستظهر هنا أرقام الاستهلاك بعد أول محادثة." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Tile label="المحادثات" value={String(chats.length)} />
            <Tile label="الرسائل" value={String(msgs)} />
            <Tile label="رموز الدخول" value={fmtNum(st.in)} />
            <Tile label="رموز الخروج" value={fmtNum(st.out)} />
          </View>
          {st.think > 0 ? <T size={12.5} color="muted">رموز التفكير: {fmtNum(st.think)}</T> : null}
          <Card>
            <T weight="semibold">آخر 7 أيام (إجمالي الرموز)</T>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130, direction: 'ltr' }}>
              {st.days.map((d) => (
                <View key={d.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <T size={10} color="muted">{d.total ? fmtNum(d.total) : ''}</T>
                  <View style={{ width: '70%', height: Math.max(3, (d.total / max) * 84), borderRadius: 6, backgroundColor: d.total ? c.accent : c.surface3 }} />
                  <T size={10.5} color="muted">{d.label}</T>
                </View>
              ))}
            </View>
          </Card>
          <Card>
            <T weight="semibold">حسب النموذج</T>
            {st.models.length === 0 ? <T color="muted" size={13}>—</T> : null}
            {st.models.map((m) => (
              <View key={m.model} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T ltr size={13} style={{ flex: 1 }} numberOfLines={1}>{shortModel(m.model)}</T>
                <T size={12} color="muted">{m.calls} طلب</T>
                <T size={12} color="text2" ltr>{fmtNum(m.in)} ↓ · {fmtNum(m.out)} ↑</T>
              </View>
            ))}
          </Card>
          {st.est > 0 ? <T size={12} color="muted">{st.est} من الطلبات أرقامها تقديرية لأن المزوّد لم يُرجع عدّ الرموز.</T> : null}
        </>
      )}
    </Screen>
  );
}
