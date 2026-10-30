import { applyDefaultChatModel } from '../api/chains';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Platform, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FILTERS, passFilter } from '../lib/chatFilter';
import { useSettings } from '../store/settings';
import { useTags } from '../store/tags';
import { TagDot } from './TagDialogs';
import { useChats } from '../store/chats';
import { useUi } from '../store/data';
import { useColors } from '../theme';
import { FONT } from '../theme/themes';
import { ChatActions } from './ChatActions';
import { Icon, IconButton, T, haptic, type IconName } from './ui/kit';

const NAV: { icon: IconName; label: string; href: string }[] = [
  { icon: 'book-open', label: 'المكتبة', href: '/library' },
  { icon: 'clock', label: 'المهام', href: '/tasks' },
  { icon: 'folder', label: 'مشاريع الوكيل', href: '/workspace' },
  { icon: 'cpu', label: 'النماذج', href: '/models' },
];

export function Sidebar() {
  const c = useColors();
  const ins = useSafeAreaInsets();
  const router = useRouter();
  const open = useUi((s) => s.sidebarOpen);
  const setOpen = useUi((s) => s.setSidebar);
  const { chats, currentId, setCurrent } = useChats();
  const W = Math.min(330, Dimensions.get('window').width * 0.86);
  const x = useRef(new Animated.Value(W)).current;
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [actions, setActions] = useState<string | null>(null);
  const filter = useSettings((st) => st.chatFilter);
  const patch = useSettings((st) => st.patch);
  const avatar = useSettings((st) => st.profile.avatar);
  const tags = useTags((st) => st.items);
  const [menu, setMenu] = useState<null | 'main' | 'tags'>(null);
  const [showAll, setShowAll] = useState(false);
  const [menuY, setMenuY] = useState(300);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(x, { toValue: open ? 0 : W, duration: 240, useNativeDriver: true }).start(() => {
      if (!open) setMounted(false);
    });
  }, [open, W, x]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return chats
      .filter((ch) => !ch.temp && passFilter(ch, filter))
      .filter((ch) => !t || ch.title.toLowerCase().includes(t) || ch.messages.some((m) => m.content.toLowerCase().includes(t)))
      .sort((a, b) => b.updated - a.updated);
  }, [chats, q, filter]);

  if (!mounted && !open) return null;

  const go = (href: string) => {
    haptic();
    setOpen(false);
    router.push(href as any);
  };
  const newChat = () => {
    haptic();
    setCurrent(null);
    applyDefaultChatModel();
    setOpen(false);
    router.replace('/');
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: open ? 1 : 0 }]} onPress={() => setOpen(false)} />
      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, start: 0, width: W, backgroundColor: c.sidebar, paddingTop: ins.top, paddingBottom: ins.bottom,
          transform: [{ translateX: x }], borderStartWidth: 1, borderColor: c.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 52 }}>
          <T weight="bold" size={21} style={{ flex: 1, letterSpacing: 3 }}>QUARK AI</T>
          <Pressable onPress={() => { haptic(); setShowSearch((v) => !v); setQ(''); }} accessibilityLabel="بحث" style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: showSearch ? c.surface2 : 'transparent' }}>
            <Icon name="search" size={21} color={c.text} />
          </Pressable>
        </View>
        {showSearch ? (
          <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: c.accent, height: 44 }}>
            <Icon name="search" size={18} color={c.accent} />
            <TextInput cursorColor={c.accent} selectionColor={c.accent + '55'} selectionHandleColor={c.accent} autoFocus value={q} onChangeText={setQ} placeholder="بحث" placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 15, textAlign: 'auto' }} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 8, gap: 2 }}>
          {NAV.map((n) => (
            <Pressable key={n.href} onPress={() => go(n.href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
              <Icon name={n.icon} size={19} color={c.text2} />
              <T weight="medium">{n.label}</T>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8, marginHorizontal: 14 }} />
        <View onLayout={(e) => setMenuY(e.nativeEvent.layout.y + e.nativeEvent.layout.height)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 4 }}>
          <T size={12} weight="semibold" color="muted" style={{ flex: 1 }}>{q ? 'نتائج البحث' : filterLabel(filter, tags)}</T>
          <Pressable onPress={() => { haptic(); setMenu(menu ? null : 'main'); }} accessibilityLabel="تصفية" style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: menu || filter !== 'recent' ? c.surface2 : 'transparent' }}>
            <Icon name="filter" size={17} color={filter !== 'recent' ? c.accent : c.text2} />
          </Pressable>
        </View>
        <FlatList
          data={q || showAll ? list : list.slice(0, 7)}
          keyExtractor={(i) => i.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<T size={13} color="muted" style={{ textAlign: 'center', padding: 24 }}>{q ? 'لا نتائج مطابقة' : filter === 'recent' ? 'لا توجد محادثات بعد' : filter === 'fav' ? 'لا توجد محادثات مفضلة' : filter.startsWith('tag:') ? 'لا توجد محادثات بهذا الوسم' : 'لا توجد محادثات في هذه الفترة'}</T>}
          ListFooterComponent={!q && list.length > 7 ? <Pressable onPress={() => setShowAll((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14 }}><T size={14} color="accent">{showAll ? 'عرض أقل' : 'عرض الكل'}</T></Pressable> : null}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { haptic(); setCurrent(item.id); setOpen(false); router.replace('/'); }}
              onLongPress={() => { haptic(); setActions(item.id); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: item.id === currentId ? c.accentSoft : pressed ? c.surface2 : 'transparent' })}
            >
              <Icon name={item.pinned ? 'bookmark' : 'message-circle'} size={17} color={item.pinned ? c.accent : c.text2} />
              <T size={14} color={item.id === currentId ? 'text' : 'text2'} numberOfLines={1} style={{ flex: 1 }}>{item.title}</T>
              {item.tags?.slice(0, 3).map((id) => { const t = tags.find((x) => x.id === id); return t ? <TagDot key={id} color={t.color} size={8} /> : null; })}
              <IconButton name="more-vertical" size={16} onPress={() => setActions(item.id)} style={{ width: 32, height: 32 }} />
            </Pressable>
          )}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8 }}>
          <Pressable onPress={() => go('/settings')} accessibilityLabel="الإعدادات" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {avatar ? <Image source={{ uri: avatar }} style={{ width: 44, height: 44 }} /> : <Icon name="user" size={20} color={c.text2} />}
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={newChat} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.accent, borderRadius: 24, height: 46, paddingHorizontal: 20 }}>
            <T weight="semibold" color="onAccent">محادثة جديدة</T>
            <Icon name="plus" size={18} color={c.onAccent} />
          </Pressable>
        </View>
        {menu ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />
            <View style={{ position: 'absolute', top: menuY, end: 14, width: 240, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, paddingVertical: 6, elevation: 12, zIndex: 20 }}>
              {menu === 'main' ? (
                <>
                  <MenuRow icon="list" label="الكل" go onPress={() => { setMenu(null); setOpen(false); router.push('/chats'); }} />
                  {FILTERS.map((f) => <MenuRow key={f.k} icon={f.icon} label={f.label} on={filter === f.k} onPress={() => { patch({ chatFilter: f.k }); setMenu(null); }} />)}
                  <MenuRow icon="tag" label="الوسوم" go on={filter.startsWith('tag:')} onPress={() => setMenu('tags')} />
                </>
              ) : (
                <>
                  <MenuRow icon="chevron-right" label="الوسوم" onPress={() => setMenu('main')} />
                  {tags.length === 0 ? (
                    <>
                      <T size={13} color="muted" style={{ textAlign: 'center', padding: 12 }}>لا توجد وسوم بعد</T>
                      <MenuRow icon="plus" label="إضافة وسم" onPress={() => { setMenu(null); setOpen(false); router.push('/chats'); }} />
                    </>
                  ) : tags.map((t) => (
                    <MenuRow key={t.id} dot={t.color} label={t.name} count={chats.filter((x) => x.tags?.includes(t.id)).length} on={filter === 'tag:' + t.id} onPress={() => { patch({ chatFilter: 'tag:' + t.id }); setMenu(null); }} />
                  ))}
                </>
              )}
            </View>
          </>
        ) : null}
        <ChatActions chatId={actions} onClose={() => setActions(null)} />
      </Animated.View>
    </View>
  );
}

function filterLabel(f: string, tags: { id: string; name: string }[]) {
  if (f.startsWith('tag:')) return 'وسم: ' + (tags.find((t) => t.id === f.slice(4))?.name ?? '');
  return FILTERS.find((x) => x.k === f)?.label ?? 'الأخيرة';
}

function MenuRow({ icon, label, on, go, dot, count, onPress }: { icon?: IconName; label: string; on?: boolean; go?: boolean; dot?: string; count?: number; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={() => { haptic(); onPress(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
      {dot ? <TagDot color={dot} size={12} /> : icon ? <Icon name={icon} size={18} color={on ? c.accent : c.text2} /> : null}
      <T size={14} color={on ? 'accent' : 'text'} style={{ flex: 1 }}>{label}</T>
      {count != null ? <T size={12} color="muted">{count}</T> : null}
      {on && !go ? <Icon name="check" size={18} color={c.accent} /> : null}
      {go ? <Icon name="chevron-left" size={18} color={c.muted} /> : null}
    </Pressable>
  );
}
