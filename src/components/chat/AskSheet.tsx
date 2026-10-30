import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAsk, type AskAns } from '../../store/features';
import { useColors } from '../../theme';
import { Icon, IconButton, RTL, T, haptic } from '../ui/kit';

/** بطاقة أسئلة الوكيل: سؤال أو عدة أسئلة باختيار مفرد أو متعدد، مع «شيء آخر» وتخطٍّ */
export function AskSheet() {
  const q = useAsk((s) => s.queue);
  const pop = useAsk((s) => s.pop);
  const c = useColors();
  const ins = useSafeAreaInsets();
  const req = q[0];
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<string[][]>([]);
  const [other, setOther] = useState<(string | undefined)[]>([]);
  const [typing, setTyping] = useState(false);
  const [txt, setTxt] = useState('');

  useEffect(() => { setIdx(0); setSel([]); setOther([]); setTyping(false); setTxt(''); }, [req?.id]);
  if (!req) return null;

  const n = req.questions.length;
  const cur = req.questions[idx];
  const mine = sel[idx] ?? [];
  const finish = (s: string[][], o: (string | undefined)[], skipped: Set<number>) => {
    const ans: AskAns[] = req.questions.map((_, i) => {
      if (skipped.has(i)) return null;
      const a = [...(s[i] ?? []), ...(o[i] ? [o[i] as string] : [])];
      return a.length ? a : null;
    });
    req.resolve(ans);
    pop(req.id);
  };
  const go = (s = sel, o = other, skip?: number) => {
    setTyping(false); setTxt('');
    if (idx >= n - 1) {
      const sk = new Set(req.questions.map((_, i) => i).filter((i) => !(s[i]?.length || o[i])));
      if (skip != null) sk.add(skip);
      finish(s, o, sk);
    } else setIdx(idx + 1);
  };
  const setAt = <X,>(arr: X[], v: X) => { const a = [...arr]; a[idx] = v; return a; };
  const pick = (label: string) => {
    haptic();
    if (cur.multi) { setSel(setAt(sel, mine.includes(label) ? mine.filter((x) => x !== label) : [...mine, label])); return; }
    const s = setAt(sel, [label]); const o = setAt(other, undefined);
    setSel(s); setOther(o); go(s, o);
  };
  const submitOther = () => {
    const v = txt.trim();
    if (!v) return;
    const o = setAt(other, v);
    const s = cur.multi ? sel : setAt(sel, []);
    setOther(o); setSel(s); go(s, o);
  };
  const skip = () => { const s = setAt(sel, []); const o = setAt(other, undefined); setSel(s); setOther(o); go(s, o, idx); };
  const count = mine.length + (other[idx] ? 1 : 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { req.resolve(null); pop(req.id); }} statusBarTranslucent navigationBarTranslucent>
      <RTL style={{ backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.bg, borderRadius: 26, borderWidth: 1, borderColor: c.border, marginHorizontal: 12, marginBottom: ins.bottom + 8, maxHeight: 560, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
              <T weight="bold" size={16} style={{ flex: 1 }}>{cur.question}</T>
              {n > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconButton name="chevron-right" size={18} label="السابق" onPress={() => idx > 0 && (setTyping(false), setIdx(idx - 1))} color={idx > 0 ? c.text2 : c.surface3} style={{ width: 30, height: 30 }} />
                  <T size={13} color="muted">{idx + 1} من {n}</T>
                  <IconButton name="chevron-left" size={18} label="التالي" onPress={() => idx < n - 1 && (setTyping(false), setIdx(idx + 1))} color={idx < n - 1 ? c.text2 : c.surface3} style={{ width: 30, height: 30 }} />
                </View>
              ) : null}
              <IconButton name="x" size={18} label="إغلاق" onPress={() => { req.resolve(null); pop(req.id); }} style={{ width: 32, height: 32 }} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 2 }}>
              {cur.options.map((o, i) => {
                const on = mine.includes(o.label);
                return (
                  <Pressable key={o.label} onPress={() => pick(o.label)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: on ? c.accentSoft : 'transparent' }}>
                    {cur.multi ? (
                      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <Icon name="check" size={15} color="#fff" /> : null}
                      </View>
                    ) : (
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                        <T size={13} weight="medium" color="text2">{i + 1}</T>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 1 }}>
                      <T size={15} weight="medium">{o.label}</T>
                      {o.description ? <T size={12.5} color="muted">{o.description}</T> : null}
                    </View>
                  </Pressable>
                );
              })}
              {typing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6 }}>
                  <TextInput autoFocus value={txt} onChangeText={setTxt} onSubmitEditing={submitOther} returnKeyType="send" placeholder="اكتب إجابتك…" placeholderTextColor={c.muted} cursorColor={c.accent} selectionColor={c.accent + '55'} style={{ flex: 1, color: c.text, backgroundColor: c.surface2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, minHeight: 42, textAlign: 'right' }} />
                  <Pressable onPress={submitOther} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: txt.trim() ? c.accent : c.surface3, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="arrow-left" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => { haptic(); setTxt(other[idx] ?? ''); setTyping(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: other[idx] ? c.accentSoft : 'transparent' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="edit-2" size={16} color={c.muted} />
                  </View>
                  <T size={15} color={other[idx] ? 'text' : 'text2'} numberOfLines={2} style={{ flex: 1 }}>{other[idx] || 'شيء آخر'}</T>
                </Pressable>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 }}>
              <View style={{ flex: 1 }}>{cur.multi && count > 0 ? <T size={13} color="muted">{count} محدد</T> : null}</View>
              <Pressable onPress={skip} style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <T size={13.5} color="text2">تخطّي</T>
              </Pressable>
              {cur.multi ? (
                <Pressable disabled={count === 0} onPress={() => { haptic(); go(); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: count ? c.accent : c.surface3, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="arrow-left" size={18} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </RTL>
    </Modal>
  );
}
