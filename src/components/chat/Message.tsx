import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Image, Pressable, Share, View } from 'react-native';
import type { Msg } from '../../api/types';
import { toast } from '../../store/data';
import { useColors } from '../../theme';
import { Icon, IconButton, T, haptic } from '../ui/kit';
import { Markdown } from './Markdown';
import { AgentSteps, CompareView, SourceChips } from './Extras';

export function Thinking({ text, secs, live }: { text: string; secs: number; live?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(!!live);
  return (
    <View style={{ borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <Pressable onPress={() => { haptic(); setOpen((o) => !o); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}>
        <Icon name="cpu" size={15} color={c.accent} />
        <T size={13} weight="medium" color="text2" style={{ flex: 1 }}>
          {live ? 'يفكّر…' : `فكّر لمدة ${secs || 1} ث`}
        </T>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <T size={13} color="muted" selectable style={{ lineHeight: 21 }}>{text}</T>
        </View>
      ) : null}
    </View>
  );
}

export function Typing() {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 5, padding: 6 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.muted, opacity: 0.4 + i * 0.25 }} />
      ))}
    </View>
  );
}

interface Props {
  msg: Msg;
  isLast?: boolean;
  onRegenerate?: () => void;
  onEdit?: (m: Msg) => void;
  onDelete?: (m: Msg) => void;
  onImage?: (uri: string) => void;
}

export function MessageView({ msg, isLast, onRegenerate, onEdit, onDelete, onImage }: Props) {
  const c = useColors();
  const [speaking, setSpeaking] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(msg.content);
    toast('تم النسخ');
  };
  const speak = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(msg.content.replace(/```[\s\S]*?```/g, ' '), {
      language: /[؀-ۿ]/.test(msg.content) ? 'ar' : undefined,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  if (msg.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-start', paddingHorizontal: 14, gap: 4 }}>
        <View style={{ maxWidth: '88%', backgroundColor: c.bubble, borderRadius: 18, borderTopStartRadius: 6, padding: 12, gap: 8 }}>
          {msg.imgs?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {msg.imgs.map((i) => (
                <Pressable key={i.id} onPress={() => onImage?.(i.uri)}>
                  <Image source={{ uri: i.uri }} style={{ width: 96, height: 96, borderRadius: 10 }} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {msg.files?.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, padding: 8, borderRadius: 10 }}>
              <Icon name="file-text" size={16} color={c.accent} />
              <T size={13} numberOfLines={1} ltr style={{ flexShrink: 1 }}>{f.name}</T>
            </View>
          ))}
          {msg.content ? <T selectable size={15.5} style={{ lineHeight: 25 }}>{msg.content}</T> : null}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <IconButton name="copy" size={15} onPress={copy} label="نسخ" style={{ width: 32, height: 32 }} />
          {onEdit ? <IconButton name="edit-2" size={15} onPress={() => onEdit(msg)} label="تعديل" style={{ width: 32, height: 32 }} /> : null}
          {onDelete ? <IconButton name="trash-2" size={15} onPress={() => onDelete(msg)} label="حذف" style={{ width: 32, height: 32 }} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      {msg.task ? <T size={12} color="accent">⏰ مهمة مجدولة: {msg.task}</T> : null}
      {msg.steps?.length ? <AgentSteps steps={msg.steps} /> : null}
      {msg.thinking ? <Thinking text={msg.thinking} secs={msg.thinkSecs ?? 0} /> : null}
      {msg.alt ? <CompareView msg={msg} /> : null}
      {msg.error ? (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 }}>
          <Icon name="alert-circle" size={18} color={c.danger} />
          <T size={14} color="danger" selectable style={{ flex: 1 }}>{msg.content}</T>
        </View>
      ) : msg.alt ? null : (
        <Markdown text={msg.content.replace(/```api_call[\s\S]*?```/g, '')} />
      )}
      {msg.sources?.length ? <SourceChips sources={msg.sources} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {!msg.error ? <IconButton name="copy" size={16} onPress={copy} label="نسخ" style={{ width: 34, height: 34 }} /> : null}
        {!msg.error ? <IconButton name={speaking ? 'volume-x' : 'volume-2'} size={16} onPress={speak} label="قراءة" active={speaking} style={{ width: 34, height: 34 }} /> : null}
        {!msg.error ? <IconButton name="share-2" size={16} onPress={() => Share.share({ message: msg.content })} label="مشاركة" style={{ width: 34, height: 34 }} /> : null}
        {isLast && onRegenerate ? <IconButton name="refresh-cw" size={16} onPress={onRegenerate} label="إعادة التوليد" style={{ width: 34, height: 34 }} /> : null}
        {onDelete ? <IconButton name="trash-2" size={16} onPress={() => onDelete(msg)} label="حذف" style={{ width: 34, height: 34 }} /> : null}
        <View style={{ flex: 1 }} />
        {msg.model ? <T size={11.5} color="muted" ltr numberOfLines={1} style={{ maxWidth: 150 }}>{msg.model}</T> : null}
      </View>
    </View>
  );
}

