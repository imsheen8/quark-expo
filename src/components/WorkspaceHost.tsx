import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { previewDoc } from '../api/previewCore';
import { instrumentHtml } from '../api/workspaceCore';
import { webRunBridge } from '../lib/webRunner';
import { useSettings } from '../store/settings';
import { usePreviewHost } from '../store/workspace';
import { PreviewFull } from './chat/LivePreview';

/** متصفح مخفي يشغّل صفحة المشروع لأداة run_project ويلتقط الأخطاء. معزول: بلا شبكة (CSP) ولا ملفات ولا تخزين. */
function RunnerInner() {
  const [job, setJob] = useState<{ id: number; html: string } | null>(null);
  useEffect(() => {
    webRunBridge.attach(setJob);
    return () => webRunBridge.detach();
  }, []);
  if (!job) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: 390, height: 700, opacity: 0 }}>
      <WebView
        key={job.id}
        source={{ html: instrumentHtml(previewDoc(job.html, 'html')), baseUrl: 'about:blank' }}
        originWhitelist={['about:*', 'data:*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => webRunBridge.onMessage(job.id, e.nativeEvent.data)}
        onError={(e) => webRunBridge.onMessage(job.id, JSON.stringify({ t: 'error', m: 'تعذّر تحميل الصفحة: ' + (e.nativeEvent?.description || '') }))}
      />
    </View>
  );
}

/** يُركَّب مرة واحدة في الجذر: المتصفح المخفي + نافذة معاينة المشروع للمستخدم */
export function WorkspaceHost() {
  const agent = useSettings((s) => s.modes.agent);
  const html = usePreviewHost((s) => s.html);
  const close = usePreviewHost((s) => s.close);
  return (
    <>
      {agent ? <RunnerInner /> : null}
      {html ? <PreviewFull code={html} lang="html" onClose={close} /> : null}
    </>
  );
}
