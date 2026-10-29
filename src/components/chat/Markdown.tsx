import * as Clipboard from 'expo-clipboard';
import { memo, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { canPreview } from '../../api/previewCore';
import { PreviewFull, PreviewView } from './LivePreview';
import { highlight, parseMarkdown, type Block, type Inline } from '../../lib/mdParse';
import { toast } from '../../store/data';
import { useColors, useScale } from '../../theme';
import { FONT } from '../../theme/themes';
import { Icon, T, haptic } from '../ui/kit';

function Inl({ inl, base }: { inl: Inline[]; base?: object }) {
  const c = useColors();
  return (
    <>
      {inl.map((x, i) => {
        switch (x.t) {
          case 'bold':
            return <Text key={i} style={{ fontFamily: FONT.bold }}>{x.v}</Text>;
          case 'italic':
            return <Text key={i} style={{ fontStyle: 'italic' }}>{x.v}</Text>;
          case 'code':
            return (
              <Text key={i} style={{ fontFamily: FONT.mono, backgroundColor: c.codeBg, color: c.accent, fontSize: 13.5 }}>
                {' ' + x.v + ' '}
              </Text>
            );
          case 'link':
            return (
              <Text key={i} style={{ color: c.accent, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(x.href).catch(() => {})}>
                {x.v}
              </Text>
            );
          default:
            return <Text key={i} style={base}>{x.v}</Text>;
        }
      })}
    </>
  );
}

function CodeBlock({ lang, code, open }: { lang: string; code: string; open: boolean }) {
  const c = useColors();
  const toks = useMemo(() => highlight(code, lang), [code, lang]);
  const [prev, setPrev] = useState(false);
  const [full, setFull] = useState(false);
  const can = !open && canPreview(lang, code);
  const col = { c: c.tkC, s: c.tkS, n: c.tkN, k: c.tkK, '': c.codeFg } as const;
  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.codeBorder, backgroundColor: c.codeBg, marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.codeHead, paddingHorizontal: 12, height: 36 }}>
        <T size={12} color={c.codeMute} ltr style={{ flex: 1 }}>{lang || 'code'}</T>
        {can ? (
          <Pressable onPress={() => { haptic(); setPrev((v) => !v); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginEnd: 14 }} hitSlop={8}>
            <Icon name={prev ? 'code' : 'eye'} size={14} color={c.codeMute} />
            <T size={12} color={c.codeMute}>{prev ? 'الكود' : 'معاينة'}</T>
          </Pressable>
        ) : null}
        {can && prev ? (
          <Pressable onPress={() => { haptic(); setFull(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginEnd: 14 }} hitSlop={8}>
            <Icon name="maximize-2" size={14} color={c.codeMute} />
            <T size={12} color={c.codeMute}>ملء الشاشة</T>
          </Pressable>
        ) : null}
        <Pressable
          onPress={async () => {
            haptic();
            await Clipboard.setStringAsync(code);
            toast('تم النسخ');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          hitSlop={8}
        >
          <Icon name="copy" size={14} color={c.codeMute} />
          <T size={12} color={c.codeMute}>نسخ</T>
        </Pressable>
      </View>
      {can && prev ? <PreviewView code={code} lang={lang} height={340} /> : null}
      {can && full ? <PreviewFull code={code} lang={lang} onClose={() => setFull(false)} /> : null}
      {can && prev ? null : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12 }} style={{ direction: 'ltr' }}>
        <Text selectable style={{ fontFamily: FONT.mono, fontSize: 13, lineHeight: 20, color: c.codeFg, writingDirection: 'ltr', textAlign: 'left' }}>
          {toks.map((t, i) => (
            <Text key={i} style={{ color: col[t.k] }}>{t.v}</Text>
          ))}
          {open ? ' ▍' : ''}
        </Text>
      </ScrollView>}
    </View>
  );
}

function BlockView({ b }: { b: Block }) {
  const c = useColors();
  const sc = useScale();
  const fs = 15.5 * sc;
  const txt = { color: c.text, fontFamily: FONT.regular, fontSize: fs, lineHeight: fs * 1.7 };
  switch (b.t) {
    case 'p':
      return (
        <Text selectable style={txt}>
          <Inl inl={b.inl} />
        </Text>
      );
    case 'h': {
      const size = [0, 24, 21, 18.5, 17, 16, 15.5][b.level] * sc;
      return (
        <Text selectable style={{ ...txt, fontFamily: FONT.bold, fontSize: size, lineHeight: size * 1.5, marginTop: 6 }}>
          <Inl inl={b.inl} />
        </Text>
      );
    }
    case 'ul':
    case 'ol':
      return (
        <View style={{ gap: 4 }}>
          {b.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text style={{ ...txt, color: c.accent, minWidth: 18, textAlign: 'center' }}>{b.t === 'ul' ? '•' : `${b.start + i}.`}</Text>
              <Text selectable style={{ ...txt, flex: 1 }}>
                <Inl inl={it} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View style={{ borderStartWidth: 3, borderStartColor: c.accent, paddingStart: 12, paddingVertical: 2 }}>
          <Text selectable style={{ ...txt, color: c.text2 }}>
            <Inl inl={b.inl} />
          </Text>
        </View>
      );
    case 'code':
      return <CodeBlock lang={b.lang} code={b.code} open={b.open} />;
    case 'hr':
      return <View style={{ height: 1, backgroundColor: c.border, marginVertical: 6 }} />;
    case 'table':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: 'hidden' }}>
            {[b.head, ...b.rows].map((r, ri) => (
              <View key={ri} style={{ flexDirection: 'row', backgroundColor: ri === 0 ? c.surface2 : ri % 2 ? c.surface : c.bg }}>
                {r.map((cell, ci) => (
                  <View key={ci} style={{ minWidth: 96, maxWidth: 220, padding: 8, borderStartWidth: ci ? 1 : 0, borderStartColor: c.border }}>
                    <Text selectable style={{ ...txt, fontSize: 14 * sc, lineHeight: 22, fontFamily: ri === 0 ? FONT.bold : FONT.regular }}>
                      <Inl inl={cell} />
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
  }
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </View>
  );
});
