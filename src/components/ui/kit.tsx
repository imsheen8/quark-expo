import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch as RNSwitch,
  Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSettings } from '../../store/settings';
import { useUi } from '../../store/data';
import { useColors, useScale } from '../../theme';
import { FONT, type Colors } from '../../theme/themes';

/** كل الواجهة من اليمين لليسار — تُطبَّق على كل جذر (التطبيق وكل Modal). */
export const RTL = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flex: 1, direction: 'rtl' }, style]}>{children}</View>
);

export const haptic = () => {
  if (useSettings.getState().haptics && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

type ColorKey = 'text' | 'text2' | 'muted' | 'accent' | 'danger' | 'onAccent' | 'ok';

export function T({
  children, size = 15, weight = 'regular', color = 'text', style, serif, ltr, ...rest
}: {
  children?: ReactNode; size?: number; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; color?: ColorKey | string;
  style?: StyleProp<TextStyle>; serif?: boolean; ltr?: boolean;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const c = useColors();
  const sc = useScale();
  const col = (c as any)[color] ?? color;
  return (
    <Text
      {...rest}
      style={[
        { color: col, fontSize: size * sc, fontFamily: serif ? FONT.serif : FONT[weight], lineHeight: size * sc * 1.55 },
        ltr && { writingDirection: 'ltr', textAlign: 'left' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export type IconName = React.ComponentProps<typeof Feather>['name'];

export const Icon = ({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) => {
  const c = useColors();
  return <Feather name={name} size={size} color={color ?? c.text2} />;
};

export function IconButton({
  name, onPress, color, size = 21, active, label, style, onLongPress,
}: { name: IconName; onPress?: () => void; onLongPress?: () => void; color?: string; size?: number; active?: boolean; label?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => { haptic(); onPress?.(); }}
      onLongPress={onLongPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
        active && { backgroundColor: c.accentSoft },
        pressed && { backgroundColor: c.surface2 },
        style,
      ]}
    >
      <Icon name={name} size={size} color={color ?? (active ? c.accent : c.text2)} />
    </Pressable>
  );
}

export function Button({
  title, onPress, kind = 'primary', icon, loading, disabled, style, small,
}: { title: string; onPress?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'soft'; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? c.dangerSoft : kind === 'soft' ? c.accentSoft : 'transparent';
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? c.danger : kind === 'soft' ? c.accent : c.text;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => { haptic(); onPress?.(); }}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12,
          paddingHorizontal: small ? 14 : 18, paddingVertical: small ? 8 : 12, backgroundColor: bg,
          borderWidth: kind === 'ghost' ? 1 : 0, borderColor: c.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <T size={small ? 13 : 15} weight="semibold" color={fg}>{title}</T>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 }, style]}>{children}</View>;
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function Row({
  icon, title, sub, onPress, right, danger, chevron = true, onLongPress, style,
}: { icon?: IconName; title: string; sub?: string; onPress?: () => void; onLongPress?: () => void; right?: ReactNode; danger?: boolean; chevron?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress ? () => { haptic(); onPress(); } : undefined}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? c.surface2 : c.surface },
        style,
      ]}
    >
      {icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? c.dangerSoft : c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={danger ? c.danger : c.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T weight="medium" color={danger ? 'danger' : 'text'}>{title}</T>
        {sub ? <T size={12.5} color="muted" numberOfLines={2}>{sub}</T> : null}
      </View>
      {right}
      {onPress && chevron && !right ? <Icon name="chevron-left" size={18} color={c.muted} /> : null}
    </Pressable>
  );
}

/** مجموعة صفوف داخل بطاقة مستديرة */
export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const c = useColors();
  const arr = (Array.isArray(children) ? children : [children]).flat().filter(Boolean) as ReactNode[];
  return (
    <View style={{ gap: 6 }}>
      {title ? <T size={12.5} weight="semibold" color="muted" style={{ paddingHorizontal: 6 }}>{title}</T> : null}
      <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
        {arr.map((ch, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {ch}
          </View>
        ))}
      </View>
      {footer ? <T size={12} color="muted" style={{ paddingHorizontal: 6 }}>{footer}</T> : null}
    </View>
  );
}

export function Switch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const c = useColors();
  return <RNSwitch value={value} onValueChange={(v) => { haptic(); onValueChange(v); }} trackColor={{ false: c.surface3, true: c.accent }} thumbColor="#fff" />;
}

export function Field({
  label, ltr, style, inputStyle, ...p
}: TextInputProps & { label?: string; ltr?: boolean; inputStyle?: StyleProp<TextStyle>; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const sc = useScale();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T size={12.5} weight="medium" color="muted">{label}</T> : null}
      <TextInput
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent + '55'}
        selectionHandleColor={c.accent}
        autoCapitalize="none"
        autoCorrect={false}
        {...p}
        style={[
          {
            backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: c.text,
            fontFamily: FONT.regular, fontSize: 15 * sc, textAlign: ltr ? 'left' : 'right', writingDirection: ltr ? 'ltr' : 'rtl',
            borderWidth: 1, borderColor: c.border,
          },
          p.multiline && { minHeight: 90, textAlignVertical: 'top' },
          inputStyle,
        ]}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { haptic(); onPress?.(); }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: active ? c.accentSoft : c.surface2, borderWidth: 1, borderColor: active ? c.accent : 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={14} color={active ? c.accent : c.text2} /> : null}
      <T size={13} weight="medium" color={active ? 'accent' : 'text2'}>{label}</T>
    </Pressable>
  );
}

export function Empty({ icon, title, sub }: { icon: IconName; title: string; sub?: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 32 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={c.accent} />
      </View>
      <T weight="semibold" size={16}>{title}</T>
      {sub ? <T color="muted" size={13.5} style={{ textAlign: 'center' }}>{sub}</T> : null}
    </View>
  );
}

/** ورقة سفلية */
export function Sheet({ visible, onClose, title, children, full }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; full?: boolean }) {
  const c = useColors();
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <RTL>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        <View
          style={{
            backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: full ? '92%' : '80%',
            paddingBottom: ins.bottom + 8, borderWidth: 1, borderColor: c.border,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.surface3 }} />
          </View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <T weight="bold" size={17} style={{ flex: 1 }}>{title}</T>
              <IconButton name="x" onPress={onClose} label="إغلاق" />
            </View>
          ) : null}
          {children}
        </View>
      </RTL>
    </Modal>
  );
}

/** حوار تأكيد/إدخال بسيط */
export function Dialog({
  visible, title, message, onClose, children, actions,
}: { visible: boolean; title: string; message?: string; onClose: () => void; children?: ReactNode; actions: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger' }[] }) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <RTL style={{ backgroundColor: c.overlay, justifyContent: 'center', padding: 24 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ backgroundColor: c.bg, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: c.border }}>
          <T weight="bold" size={17}>{title}</T>
          {message ? <T color="text2">{message}</T> : null}
          {children}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start' }}>
            {actions.map((a, i) => (
              <Button key={i} title={a.title} kind={a.kind ?? (i === 0 ? 'primary' : 'ghost')} onPress={a.onPress} small />
            ))}
          </View>
        </View>
      </RTL>
    </Modal>
  );
}

export function Header({
  title, back, menu, right, sub,
}: { title: ReactNode; back?: boolean | (() => void); menu?: boolean; right?: ReactNode; sub?: string }) {
  const c = useColors();
  const router = useRouter();
  const setSidebar = useUi((s) => s.setSidebar);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, backgroundColor: c.bg }}>
      {menu ? <IconButton name="menu" onPress={() => setSidebar(true)} label="القائمة" /> : null}
      {back ? <IconButton name="arrow-right" onPress={typeof back === 'function' ? back : () => (router.canGoBack() ? router.back() : router.replace('/'))} label="رجوع" /> : null}
      <View style={{ flex: 1, paddingHorizontal: 6 }}>
        {typeof title === 'string' ? <T weight="bold" size={17} numberOfLines={1}>{title}</T> : title}
        {sub ? <T size={11.5} color="muted" numberOfLines={1}>{sub}</T> : null}
      </View>
      {right}
    </View>
  );
}

/** هيكل صفحة: رأس + محتوى قابل للتمرير */
export function Screen({
  title, back = true, menu, right, children, scroll = true, pad = true, sub,
}: { title: string; back?: boolean; menu?: boolean; right?: ReactNode; children: ReactNode; scroll?: boolean; pad?: boolean; sub?: string }) {
  const c = useColors();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top }}>
      <Header title={title} back={back && !menu} menu={menu} right={right} sub={sub} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: pad ? 16 : 0, gap: 18, paddingBottom: ins.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: ins.bottom }}>{children}</View>
      )}
    </View>
  );
}

export function Toast() {
  const c = useColors();
  const ins = useSafeAreaInsets();
  const { toastMsg, toastId } = useUi();
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toastId) return;
    op.setValue(1);
    const a = Animated.sequence([Animated.delay(2200), Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true })]);
    a.start();
    return () => a.stop();
  }, [toastId, op]);
  if (!toastId) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', alignSelf: 'center', bottom: ins.bottom + 90, opacity: op, backgroundColor: c.surface3, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, maxWidth: '86%', borderWidth: 1, borderColor: c.border, zIndex: 999 }}
    >
      <T size={13.5} style={{ textAlign: 'center' }}>{toastMsg}</T>
    </Animated.View>
  );
}
