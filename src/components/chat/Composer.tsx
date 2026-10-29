import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import type { FileRef, ImageRef } from '../../api/types';
import { saveImage, readTextFile } from '../../lib/images';
import { dictateToggle, micCancel, useMic } from '../../api/voice';
import { fillTemplate, parseVars } from '../../lib/template';
import { shortModel } from '../../lib/util';
import { activeModel, useSettings } from '../../store/settings';
import { toast, useLibrary, useSkillPins, useSkills, useUi } from '../../store/data';
import { useColors, useScale } from '../../theme';
import { FONT } from '../../theme/themes';
import { Dialog, Field, Icon, IconButton, Sheet, Switch, T, haptic, Row, Group } from '../ui/kit';
import { SecondModelSheet } from './Extras';

export interface ComposerValue {
  text: string;
  imgs: ImageRef[];
  files: FileRef[];
}

interface Props {
  busy: boolean;
  onSend: (v: ComposerValue) => void;
  onStop: () => void;
  onPickModel: () => void;
  editing?: boolean;
  initial?: ComposerValue | null;
  onCancelEdit?: () => void;
}

export function Composer({ busy, onSend, onStop, onPickModel, editing, initial, onCancelEdit }: Props) {
  const c = useColors();
  const sc = useScale();
  const [text, setText] = useState('');
  const [imgs, setImgs] = useState<ImageRef[]>([]);
  const [files, setFiles] = useState<FileRef[]>([]);
  const [attach, setAttach] = useState(false);
  const [tplList, setTplList] = useState(false);
  const [second, setSecond] = useState(false);
  const modes = useSettings((st) => st.modes);
  const cmpSel = useSettings((st) => st.cmpSel);
  const setMode = (k: keyof typeof modes, v: boolean) => useSettings.getState().patch({ modes: { ...useSettings.getState().modes, [k]: v, ...(k === 'agent' && v ? { research: false } : {}), ...(k === 'research' && v ? { agent: false, compare: false } : {}) } });
  const [vars, setVars] = useState<{ text: string; list: ReturnType<typeof parseVars>; values: Record<string, string> } | null>(null);
  const draft = useUi((s) => s.draft);
  const setDraft = useUi((s) => s.setDraft);
  const lib = useLibrary((s) => s.items);
  const skills = useSkills((s) => s.items);
  const pins = useSkillPins((s) => s.ids);
  const items = useMemo(
    () => [
      ...lib.map((i) => ({ id: i.id, kind: i.kind as 'persona' | 'template' | 'skill', name: i.name, text: i.text })),
      ...skills.filter((k) => k.status === 'published').map((k) => ({ id: k.id, kind: 'skill' as const, name: k.name, text: k.description || k.when || k.body })),
    ],
    [lib, skills],
  );
  const am = activeModel();
  const input = useRef<TextInput>(null);
  const mic = useMic((st) => st.state);
  useEffect(() => () => { void micCancel(); }, []);
  const dictate = () => {
    haptic();
    void dictateToggle((t) => {
      setText((p) => (p && !/\s$/.test(p) ? p + ' ' : p) + t);
      setTimeout(() => input.current?.focus(), 50);
    });
  };

  // إجراء قادم من ودجت/اختصار: يُنفَّذ بعد فتح القفل وجاهزية الشاشة
  const nativeAct = useUi((st) => st.action);
  const locked = useUi((st) => st.locked);
  useEffect(() => {
    if (!nativeAct || locked) return;
    useUi.getState().setAction('');
    setTimeout(() => {
      if (nativeAct === 'chat') input.current?.focus();
      else if (nativeAct === 'camera') void pickImages(true);
      else if (nativeAct === 'photo') void pickImages(false);
      else if (nativeAct === 'mic') dictate();
    }, 450);
  }, [nativeAct, locked]);

  useEffect(() => {
    if (initial) {
      setText(initial.text);
      setImgs(initial.imgs);
      setFiles(initial.files);
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [initial]);

  useEffect(() => {
    if (draft) {
      insertTemplate(draft);
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const slash = text.startsWith('/') && !text.includes('\n') ? text.slice(1).trim().toLowerCase() : null;
  const slashItems = useMemo(
    () => (slash == null ? [] : items.filter((i) => i.name.toLowerCase().includes(slash) || i.text.toLowerCase().includes(slash)).slice(0, 6)),
    [slash, items],
  );

  const canSend = !!text.trim() || imgs.length > 0 || files.length > 0;

  function insertTemplate(t: string) {
    const list = parseVars(t);
    if (list.length) setVars({ text: t, list, values: {} });
    else {
      setText((p) => (p.startsWith('/') ? '' : p) + t);
      setTimeout(() => input.current?.focus(), 50);
    }
  }

  function chooseItem(it: (typeof items)[number]) {
    haptic();
    if (it.kind === 'skill') {
      useSkillPins.getState().toggle(it.id);
      setText('');
      toast('ثُبّتت المهارة للرسالة التالية: ' + it.name);
    } else if (it.kind === 'persona') {
      useSettings.getState().patch({ activePersonaId: it.id });
      setText('');
      toast('الشخصية المفعّلة: ' + it.name);
    } else {
      setText('');
      insertTemplate(it.text);
    }
  }

  async function pickImages(camera: boolean) {
    setAttach(false);
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return toast('لم تُمنح صلاحية الكاميرا');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true, allowsMultipleSelection: !camera };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled) return;
      const saved: ImageRef[] = [];
      for (const a of r.assets) if (a.base64) saved.push(await saveImage(a.base64, a.mimeType || 'image/jpeg'));
      setImgs((p) => [...p, ...saved].slice(0, 6));
    } catch (e) {
      toast('تعذّر إرفاق الصورة');
    }
  }

  async function pickFiles() {
    setAttach(false);
    try {
      const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ['text/*', 'application/json', 'application/xml', 'application/javascript', '*/*'] });
      if (r.canceled) return;
      const out: FileRef[] = [];
      for (const a of r.assets) {
        try {
          const t = await readTextFile(a.uri);
          if (/\u0000/.test(t.slice(0, 2000))) {
            toast('الملف ' + a.name + ' ليس نصيًا');
            continue;
          }
          out.push({ name: a.name, text: t });
        } catch {
          toast('تعذّر قراءة ' + a.name);
        }
      }
      setFiles((p) => [...p, ...out].slice(0, 5));
    } catch {
      toast('تعذّر إرفاق الملف');
    }
  }

  function send() {
    if (!canSend) return;
    haptic();
    onSend({ text, imgs, files });
    setText('');
    setImgs([]);
    setFiles([]);
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6 }}>
      {slashItems.length > 0 ? (
        <View style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: 'hidden' }}>
          <T size={12} color="muted" style={{ padding: 10, paddingBottom: 4 }}>القوالب والشخصيات والمهارات</T>
          {slashItems.map((it) => (
            <Pressable key={it.id} onPress={() => chooseItem(it)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
              <Icon name={it.kind === 'persona' ? 'user' : it.kind === 'skill' ? 'zap' : 'file-text'} size={16} color={c.accent} />
              <View style={{ flex: 1 }}>
                <T size={14} weight="medium">{it.name}</T>
                <T size={12} color="muted" numberOfLines={1}>{it.text}</T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {pins.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {pins.map((id) => {
            const k = skills.find((x) => x.id === id);
            return k ? (
              <Pressable key={id} onPress={() => useSkillPins.getState().toggle(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentSoft, borderRadius: 14, paddingHorizontal: 10, height: 30 }}>
                <Icon name="zap" size={13} color={c.accent} />
                <T size={12.5} color="accent">{k.name}</T>
                <Icon name="x" size={13} color={c.accent} />
              </Pressable>
            ) : null;
          })}
        </View>
      ) : null}

      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accentSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
          <Icon name="edit-2" size={14} color={c.accent} />
          <T size={12.5} color="accent" style={{ flex: 1 }}>تعديل الرسالة — سيُستبدل الرد التالي</T>
          <Pressable onPress={() => { setText(''); setImgs([]); setFiles([]); onCancelEdit?.(); }} hitSlop={8}>
            <Icon name="x" size={16} color={c.accent} />
          </Pressable>
        </View>
      ) : null}

      <View style={{ backgroundColor: c.surface, borderRadius: 26, borderWidth: 1, borderColor: c.border, padding: 10, gap: 8 }}>
        {imgs.length + files.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 4 }}>
            {imgs.map((i) => (
              <View key={i.id}>
                <Image source={{ uri: i.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                <Pressable onPress={() => setImgs((p) => p.filter((x) => x.id !== i.id))} style={{ position: 'absolute', top: -6, start: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={13} color={c.text} />
                </Pressable>
              </View>
            ))}
            {files.map((f, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface2, borderRadius: 10, paddingHorizontal: 10, height: 44, alignSelf: 'center' }}>
                <Icon name="file-text" size={15} color={c.accent} />
                <T size={12.5} ltr numberOfLines={1} style={{ maxWidth: 110 }}>{f.name}</T>
                <Pressable onPress={() => setFiles((p) => p.filter((_, j) => j !== idx))} hitSlop={8}>
                  <Icon name="x" size={14} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {modes.web || modes.research || modes.compare ? (
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 6, paddingTop: 2 }}>
            {modes.web ? <ModeTag icon="globe" label="ويب" /> : null}
            {modes.research ? <ModeTag icon="search" label="بحث عميق" /> : null}
            {modes.compare ? <ModeTag icon="columns" label="مقارنة" /> : null}
          </View>
        ) : null}

        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="اكتب رسالتك... أو / للقوالب"
          placeholderTextColor={c.muted}
          cursorColor={c.accent}
          selectionColor={c.accent + '55'}
          selectionHandleColor={c.accent}
          style={{
            color: c.text, fontFamily: FONT.regular, fontSize: 16 * sc, maxHeight: 160, minHeight: 44,
            paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 6, textAlign: 'auto', writingDirection: 'auto' as any,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton name="plus" onPress={() => setAttach(true)} label="إضافة" style={{ backgroundColor: c.surface2 }} />
          <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: 22, padding: 4 }}>
            {([['chat', 'محادثة', 'message-circle'], ['agent', 'وكيل', 'zap']] as const).map(([k, lb, ic]) => {
              const on = (k === 'agent') === modes.agent;
              return (
                <Pressable key={k} onPress={() => { haptic(); setMode('agent', k === 'agent'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: on ? c.surface3 : 'transparent' }}>
                  <T size={13} weight={on ? 'bold' : 'medium'} color={on ? 'text' : 'muted'}>{lb}</T>
                  <Icon name={ic} size={15} color={on ? c.text : c.muted} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          {!busy ? (
            <Pressable
              onPress={dictate}
              disabled={mic === 'busy'}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: mic === 'rec' ? c.danger : c.surface2 }}
              accessibilityLabel={mic === 'rec' ? 'إيقاف الإدخال الصوتي' : 'إدخال صوتي'}
            >
              <Icon name={mic === 'rec' ? 'square' : mic === 'busy' ? 'loader' : 'mic'} size={mic === 'rec' ? 15 : 19} color={mic === 'rec' ? '#fff' : mic === 'busy' ? c.muted : c.text2} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={busy ? onStop : send}
            disabled={!busy && !canSend}
            style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: busy || canSend ? c.accent : c.surface3 }}
            accessibilityLabel={busy ? 'إيقاف' : 'إرسال'}
          >
            <Icon name={busy ? 'square' : 'arrow-up'} size={busy ? 16 : 20} color={busy || canSend ? c.onAccent : c.muted} />
          </Pressable>
        </View>
      </View>

      <Sheet visible={attach} onClose={() => setAttach(false)} title="إضافة إلى المحادثة">
        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([['camera', 'كاميرا', () => pickImages(true)], ['image', 'صور', () => pickImages(false)], ['file-plus', 'ملفات', pickFiles]] as const).map(([ic, lb, fn]) => (
              <Pressable key={lb} onPress={fn} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: pressed ? c.surface3 : c.surface2 })}>
                <Icon name={ic} size={24} color={c.accent} />
                <T size={13} weight="medium">{lb}</T>
              </Pressable>
            ))}
          </View>
          <Group title="الأوضاع">
            <Row icon="globe" title="بحث الويب" sub="يبحث ويضيف مصادر إلى الرد" right={<Switch value={modes.web} onValueChange={(v) => setMode('web', v)} />} />
            <Row icon="search" title="بحث عميق" sub="تقرير مفصّل بمصادر (الرسالة التالية تصبح موضوع البحث)" right={<Switch value={modes.research} onValueChange={(v) => setMode('research', v)} />} />
            <Row icon="columns" title="مقارنة نماذج" sub={cmpSel ? 'مع ' + shortModel(cmpSel.model) : 'اختر نموذجًا ثانيًا'} right={<Switch value={modes.compare} onValueChange={(v) => (v && !cmpSel ? (setAttach(false), setTimeout(() => setSecond(true), 250)) : setMode('compare', v))} />} onPress={() => { setAttach(false); setTimeout(() => setSecond(true), 250); }} />
          </Group>
          <Group>
            <Row icon="cpu" title="النموذج" sub={am ? shortModel(am.model) : '—'} onPress={() => { setAttach(false); setTimeout(onPickModel, 250); }} />
            <Row icon="file-text" title="اختيار قالب" sub="أدرج قالبًا أو شخصية من المكتبة" onPress={() => { setAttach(false); setTimeout(() => setTplList(true), 250); }} />
          </Group>
        </View>
      </Sheet>

      <SecondModelSheet visible={second} onClose={() => setSecond(false)} />

      <Sheet visible={tplList} onClose={() => setTplList(false)} title="القوالب والشخصيات" full>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Group>
            {items.map((it) => (
              <Row key={it.id} icon={it.kind === 'persona' ? 'user' : 'file-text'} title={it.name} sub={it.text} onPress={() => { setTplList(false); setTimeout(() => chooseItem(it), 250); }} />
            ))}
          </Group>
        </ScrollView>
      </Sheet>

      <Dialog
        visible={!!vars}
        title="املأ المتغيرات"
        onClose={() => setVars(null)}
        actions={[
          {
            title: 'إدراج',
            onPress: () => {
              if (vars) {
                setText((p) => p + fillTemplate(vars.text, vars.values));
                setTimeout(() => input.current?.focus(), 50);
              }
              setVars(null);
            },
          },
          { title: 'إلغاء', onPress: () => setVars(null) },
        ]}
      >
        <View style={{ gap: 10 }}>
          {vars?.list.map((v) => (
            <Field key={v.name} label={v.name} placeholder={v.def} value={vars.values[v.name] ?? ''} onChangeText={(t) => setVars((p) => (p ? { ...p, values: { ...p.values, [v.name]: t } } : p))} />
          ))}
        </View>
      </Dialog>
    </View>
  );
}

function ModeTag({ icon, label }: { icon: any; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentSoft, borderRadius: 10, paddingHorizontal: 8, height: 26 }}>
      <Icon name={icon} size={12} color={c.accent} />
      <T size={11.5} weight="medium" color="accent">{label}</T>
    </View>
  );
}
