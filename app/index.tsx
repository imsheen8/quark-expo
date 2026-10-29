import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Keyboard, Modal, Platform, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { MenuIcon } from '../src/components/ui/MenuIcon';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FONT } from '../src/theme/themes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { regenerate, sendMessage, stopGeneration } from '../src/api/generate';
import type { Msg } from '../src/api/types';
import { ChatActions } from '../src/components/ChatActions';
import { Composer, type ComposerValue } from '../src/components/chat/Composer';
import { MessageView, Thinking, Typing } from '../src/components/chat/Message';
import { AgentSteps } from '../src/components/chat/Extras';
import { Markdown } from '../src/components/chat/Markdown';
import { ModelPicker } from '../src/components/chat/ModelPicker';
import { Button, Header, Icon, IconButton, T, haptic } from '../src/components/ui/kit';
import { useChats, useStream } from '../src/store/chats';
import { toast, useUi } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useColors } from '../src/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'مساء الخير' : h < 12 ? 'صباح الخير' : h < 18 ? 'نهارك سعيد' : 'مساء الخير';
}

function Welcome() {
  const c = useColors();
  const router = useRouter();
  const hasEp = useSettings((s) => s.endpoints.length > 0);
  const incog = useChats((s) => s.incog);
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28, gap: 14 }}>
      <T size={26} style={{ fontFamily: FONT.serif, textAlign: 'center', lineHeight: 40 }}>
        {incog ? 'محادثة خفية — لن تُحفظ' : `${greeting()}، كيف أساعدك اليوم؟`}
      </T>
      {!hasEp ? (
        <View style={{ width: '100%', backgroundColor: c.accentSoft, borderRadius: 16, padding: 14, gap: 10 }}>
          <T size={13.5} color="text2">أضف مفتاح API من أي مزوّد أو خادمًا محليًا مثل Ollama ثم اختر نموذجًا.</T>
          <Button title="إضافة نقطة اتصال" icon="key" onPress={() => router.push('/settings/endpoints')} />
        </View>
      ) : null}
    </View>
  );
}

export default function ChatScreen() {
  const c = useColors();
  const ins = useSafeAreaInsets();
  const setSidebar = useUi((st) => st.setSidebar);
  const chat = useChats((s) => s.chats.find((x) => x.id === s.currentId));
  const { incog, setIncog, setCurrent } = useChats();
  const stream = useStream();
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [kb, setKb] = useState(0);
  const [compH, setCompH] = useState(120);
  const [rootH, setRootH] = useState(0);
  const maxH = useRef(0);
  const empty = !chat || chat.messages.length === 0;
  // ارتفاع الكيبورد الفعلي، مع طرح ما قد يكون النظام قد قلّصه من نافذة التطبيق (لتجنّب الرفع المزدوج)
  const shrink = rootH && maxH.current ? Math.max(0, maxH.current - rootH) : 0;
  const lift = Math.max(0, kb - shrink);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const sh = Keyboard.addListener(ios ? 'keyboardWillChangeFrame' : 'keyboardDidShow', (e) => setKb(Math.max(0, Dimensions.get('screen').height - e.endCoordinates.screenY)));
    const hd = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => { sh.remove(); hd.remove(); };
  }, []);
  const list = useRef<FlatList>(null);
  const bottom = useRef(true);

  const live = stream.busy && !!chat && stream.chatId === chat.id;
  const data = useMemo(() => (chat ? [...chat.messages, ...(live ? [{ id: '__live' } as any] : [])] : []), [chat, live]);

  useEffect(() => {
    if (bottom.current) requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
  }, [data.length, stream.text, stream.think]);

  useEffect(() => {
    bottom.current = true;
    setEditing(null);
  }, [chat?.id]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const near = contentOffset.y + layoutMeasurement.height >= contentSize.height - 140;
    bottom.current = near;
    setAtBottom(near);
  };

  const send = (v: ComposerValue) => {
    bottom.current = true;
    // التعديل: تُحفظ النسخة القديمة بردودها ويمكن العودة إليها من سهم النسخ
    const branch = editing && chat ? useChats.getState().branchFrom(chat.id, editing.id) ?? undefined : undefined;
    setEditing(null);
    void sendMessage({ text: v.text, imgs: v.imgs, files: v.files, branch });
  };

  const lastId = chat?.messages[chat.messages.length - 1]?.id;
  const initial = useMemo(() => (editing ? { text: editing.content, imgs: editing.imgs ?? [], files: editing.files ?? [] } : null), [editing]);

  return (
    <View onLayout={(e) => { const h = e.nativeEvent.layout.height; maxH.current = Math.max(maxH.current, h); setRootH(h); }} style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 56 }}>
        <Pressable onPress={() => { haptic(); setSidebar(true); }} accessibilityLabel="القائمة" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MenuIcon /></Pressable>
        <T size={14} color="muted" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{chat?.title ?? ''}</T>
        {chat && !chat.temp ? <IconButton name="more-vertical" label="المزيد" onPress={() => setMenu(chat.id)} /> : null}
        {empty ? (
        <Pressable
          onPress={() => { haptic(); const v = !incog; setIncog(v); if (v) setCurrent(null); }}
          accessibilityLabel="محادثة خفية"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name={incog ? 'ghost' : 'ghost-outline'} size={26} color={incog ? c.accent : c.text} />
        </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, marginBottom: empty ? 0 : lift }}>
        {!empty ? (
          <FlatList
            ref={list}
            data={data}
            keyExtractor={(m) => m.id}
            onScroll={onScroll}
            scrollEventThrottle={64}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: compH + 14, gap: 18 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.id === '__live' ? (
                <View style={{ paddingHorizontal: 16, gap: 8 }}>
                  {stream.status ? <T size={12.5} color="accent">{stream.status}</T> : null}
                  {stream.steps.length ? <AgentSteps steps={stream.steps} live /> : null}
                  {stream.think ? <Thinking text={stream.think} secs={stream.secs} live={!stream.text} /> : null}
                  {stream.text ? <Markdown text={stream.text} /> : !stream.think ? <Typing /> : null}
                </View>
              ) : (
                <MessageView
                  msg={item}
                  isLast={item.id === lastId && !live}
                  onRegenerate={() => chat && regenerate(chat.id)}
                  onEdit={item.role === 'user' && !live ? setEditing : undefined}
                  onDelete={!live ? (m) => chat && useChats.getState().deleteMessage(chat.id, m.id) : undefined}
                  onImage={setViewer}
                  onSwitch={!live ? (m, k) => chat && useChats.getState().switchVer(chat.id, m.id, k) : undefined}
                  onFork={!live ? (m) => { if (chat && useChats.getState().fork(chat.id, m.id)) toast('تم التفريع إلى محادثة جديدة'); } : undefined}
                />
              )
            }
          />
        ) : null}
        {!atBottom && !empty ? (
          <Pressable onPress={() => list.current?.scrollToEnd({ animated: true })} style={{ position: 'absolute', alignSelf: 'center', bottom: compH + 10, width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
            <Icon name="arrow-down" size={18} color={c.text} />
          </Pressable>
        ) : null}
      </View>

      {/* منطقة الإدخال: عائمة فوق المحتوى بلا شريط خلفها. العنصر نفسه يبقى (لا يُعاد إنشاؤه) عند الإرسال الأول فلا يُغلق الكيبورد */}
      <View
        pointerEvents="box-none"
        onLayout={(e) => !empty && setCompH(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute', start: 0, end: 0,
          bottom: empty ? lift : lift || ins.bottom,
          ...(empty ? { top: 56 + ins.top, justifyContent: 'center', paddingBottom: lift ? 0 : ins.bottom + 70 } : {}),
        }}
      >
        {empty ? <Welcome /> : null}
        <Composer busy={stream.busy} onSend={send} onStop={stopGeneration} onPickModel={() => setPicker(true)} editing={!!editing} initial={initial} onCancelEdit={() => setEditing(null)} />
      </View>

      <ModelPicker visible={picker} onClose={() => setPicker(false)} />
      <ChatActions chatId={menu} onClose={() => setMenu(null)} onDeleted={() => setCurrent(null)} />
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={{ width: '94%', height: '80%' }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}
