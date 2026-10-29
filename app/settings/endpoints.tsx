import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { hostOf } from '../../src/api/providers';
import { fetchModels } from '../../src/api/stream';
import type { Endpoint } from '../../src/api/types';
import { EndpointAdd } from '../../src/components/EndpointAdd';
import { EndpointForm } from '../../src/components/EndpointForm';
import { VoiceKeyAdd, VoiceKeyList } from '../../src/components/VoiceKeys';
import { Badge, Panel, Segmented } from '../../src/components/ui/panels';
import { Button, Dialog, Divider, Icon, Screen, T, haptic } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { useColors } from '../../src/theme';

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return <T size={12.5} weight="semibold" color="accent" onPress={() => { haptic(); onPress(); }}>{label}</T>;
}

function EndpointCard({ e, onDelete, onEdit }: { e: Endpoint; onDelete: () => void; onEdit: () => void }) {
  const c = useColors();
  const { updateEndpoint, setModels, toggleModel } = useSettings();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const on = e.models.filter((m) => m.on).length;
  const title = e.kind === 'local' ? hostOf(e.url) : e.label;

  const refresh = async () => {
    setBusy(true);
    try {
      const ids = await fetchModels(e);
      setModels(e.id, ids, false);
      toast(`تم التحديث — ${ids.length} نموذج`);
    } catch (err) {
      toast(err instanceof Error ? err.message.slice(0, 140) : 'فشل التحديث');
    }
    setBusy(false);
  };
  const setAll = (v: boolean) => updateEndpoint(e.id, { models: e.models.map((m) => ({ ...m, on: v })) });

  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, opacity: e.enabled ? 1 : 0.7 }}>
      <Pressable onPress={() => { haptic(); setOpen(!open); }} style={{ padding: 12, gap: 8 }} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T size={15.5} weight="bold" ltr numberOfLines={1} style={{ flexShrink: 1 }}>{title}</T>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={17} color={c.muted} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Badge text={e.kind === 'local' ? 'محلي' : 'API'} />
          <Badge text={`${on}/${e.models.length} نماذج مفعّلة`} tone={on ? 'ok' : 'muted'} />
          {!e.enabled ? <Badge text="معطّل" tone="muted" /> : null}
        </View>
        <T size={12} color="muted">اضغط لإدارة النماذج</T>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
        <Button title={e.enabled ? 'تعطيل' : 'تفعيل'} kind="ghost" small onPress={() => updateEndpoint(e.id, { enabled: !e.enabled })} />
        <Button title="تعديل" kind="ghost" small onPress={onEdit} />
        <Button title="حذف" kind="danger" small onPress={onDelete} />
      </View>
      {open ? (
        <View style={{ padding: 12, paddingTop: 0, gap: 10 }}>
          <Divider />
          <Pressable
            onPress={async () => { await Clipboard.setStringAsync(e.url); toast('تم نسخ العنوان'); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            accessibilityLabel="نسخ العنوان"
          >
            <T size={12.5} color="muted" ltr numberOfLines={1} style={{ flexShrink: 1 }}>{e.url}</T>
            <Icon name="copy" size={14} color={c.muted} />
          </Pressable>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T size={12} weight="bold" color="muted" style={{ flex: 1 }}>النماذج · {on}/{e.models.length} مفعّلة</T>
            <Action label={busy ? '…' : 'تحديث'} onPress={refresh} />
            <Action label="الكل" onPress={() => setAll(true)} />
            <Action label="لا شيء" onPress={() => setAll(false)} />
          </View>
          {e.models.length ? (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: c.border, maxHeight: 280 }}>
              <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 8, gap: 2 }}>
                {e.models.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => { haptic(); toggleModel(e.id, m.id); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, paddingHorizontal: 4 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: m.on }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: m.on ? c.accent : 'transparent', borderWidth: m.on ? 0 : 1.5, borderColor: c.border }}>
                      {m.on ? <Icon name="check" size={13} color={c.onAccent} /> : null}
                    </View>
                    <T size={13.5} ltr numberOfLines={1} style={{ flex: 1 }} color={m.on ? 'text' : 'text2'}>{m.id}</T>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <T size={12.5} color="muted">لا نماذج بعد. اضغط «تحديث» لجلبها.</T>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function Endpoints() {
  const { endpoints, removeEndpoint } = useSettings();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'text' | 'voice'>(params.tab === 'voice' ? 'voice' : 'text');
  const [edit, setEdit] = useState<Endpoint | null>(null);
  const [del, setDel] = useState<Endpoint | null>(null);
  const local = endpoints.filter((e) => e.kind === 'local');
  const api = endpoints.filter((e) => e.kind !== 'local');

  const group = (title: string, icon: 'monitor' | 'globe', list: Endpoint[]) =>
    list.length ? (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
          <Icon name={icon} size={15} />
          <T size={12.5} weight="bold" color="text2">{title}</T>
        </View>
        {list.map((e) => <EndpointCard key={e.id} e={e} onDelete={() => setDel(e)} onEdit={() => setEdit(e)} />)}
      </View>
    ) : null;

  return (
    <Screen title="المفاتيح ونقاط الاتصال">
      <Segmented
        value={tab}
        onChange={setTab}
        items={[
          { key: 'text', label: 'الكتابة', icon: 'type' },
          { key: 'voice', label: 'الصوت', icon: 'mic' },
        ]}
      />
      {tab === 'voice' ? (
        <>
          <VoiceKeyAdd />
          <VoiceKeyList />
        </>
      ) : (
        <>
          <EndpointAdd />
          <Panel icon="monitor" title="النماذج المضافة" tag="نقاط الاتصال" sub="أدِر النقاط التي أضفتها.">
            {endpoints.length === 0 ? <T size={13.5} color="muted">لم تُضف أي نقطة بعد. أضف خادمًا محليًا أو مفتاح API من الأعلى.</T> : null}
            {group('محلي', 'monitor', local)}
            {group('API', 'globe', api)}
          </Panel>
        </>
      )}
      {edit ? <EndpointForm key={edit.id} visible edit={edit} onClose={() => setEdit(null)} /> : null}
      <Dialog
        visible={!!del}
        title="حذف نقطة الاتصال؟"
        message={del ? `سيُحذف «${del.label}» ومفتاحه من هذا الجهاز.` : ''}
        onClose={() => setDel(null)}
        actions={[
          { title: 'حذف', kind: 'danger', onPress: () => { if (del) removeEndpoint(del.id); setDel(null); } },
          { title: 'إلغاء', onPress: () => setDel(null) },
        ]}
      />
    </Screen>
  );
}
