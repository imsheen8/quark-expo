import { useMemo } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { allowNav, previewDoc } from '../../api/previewCore';
import { useColors } from '../../theme';
import { Icon, RTL, T } from '../ui/kit';

/** WebView معزول: بلا ملفات ولا تخزين ولا نوافذ جديدة، والشبكة محجوبة بسياسة CSP داخل المستند. */
export function PreviewView({ code, lang, height }: { code: string; lang: string; height?: number }) {
  const html = useMemo(() => previewDoc(code, lang), [code, lang]);
  return (
    <WebView
      style={height ? { height, backgroundColor: '#fff' } : { flex: 1, backgroundColor: '#fff' }}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'about:blank' }}
      javaScriptEnabled
      domStorageEnabled={false}
      allowFileAccess={false}
      allowUniversalAccessFromFileURLs={false}
      allowsLinkPreview={false}
      setSupportMultipleWindows={false}
      mixedContentMode="never"
      nestedScrollEnabled
      onShouldStartLoadWithRequest={(r) => allowNav(r.url)}
      onFileDownload={() => {}}
    />
  );
}

export function PreviewFull({ code, lang, onClose }: { code: string; lang: string; onClose: () => void }) {
  const c = useColors();
  const ins = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <RTL style={{ backgroundColor: c.bg, paddingTop: ins.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <T weight="bold" style={{ flex: 1 }}>معاينة</T>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="إغلاق"><Icon name="x" size={22} color={c.text} /></Pressable>
        </View>
        <View style={{ flex: 1, marginBottom: ins.bottom }}>
          <PreviewView code={code} lang={lang} />
        </View>
      </RTL>
    </Modal>
  );
}
