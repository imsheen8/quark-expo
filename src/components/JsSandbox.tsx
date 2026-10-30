import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { sandboxBridge } from '../lib/jsSandbox';
import { useSettings } from '../store/settings';

/** كود العامل (نص عادي لا دالة: Function.prototype.toString لا يعيد المصدر في Hermes). يُنفَّذ داخل Worker يُقتل عند انتهاء المهلة؛ لا شبكة (CSP) ولا وصول لبيانات التطبيق. */
const WORKER_SRC = `
var logs = [];
function fmt(v) {
  try {
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return String(v);
    return JSON.stringify(v, function (k, x) { return typeof x === 'bigint' ? x.toString() : x; }, 1);
  } catch (e) { return String(v); }
}
var posted = 0;
function push() {
  var line = Array.prototype.slice.call(arguments).map(fmt).join(' ');
  logs.push(line);
  if (posted++ < 200) self.postMessage({ log: line.slice(0, 2000) });
}
self.console = { log: push, info: push, warn: push, error: push, debug: push, table: push };
var geval = eval;
self.onmessage = async function (ev) {
  var code = String(ev.data), res, err = null;
  try {
    res = /\\bawait\\b/.test(code) ? await geval('(async()=>{\\n' + code + '\\n})()') : geval(code);
    if (res && typeof res.then === 'function') res = await res;
  } catch (e) { err = (e && e.message) ? (e.name ? e.name + ': ' + e.message : e.message) : String(e); }
  var out = logs.join('\\n') + (res !== undefined ? (logs.length ? '\\n' : '') + '\u21d2 ' + fmt(res) : '');
  self.postMessage({ ok: err === null, out: err !== null ? (out ? out + '\\n' : '') + err : out });
};
`;

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:">
</head><body><script>
var SRC = ${JSON.stringify(WORKER_SRC)};
var running = {};
function post(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
window.__run = function(id, code, ms){
  var w, url, done = false, t;
  try {
    url = URL.createObjectURL(new Blob([SRC], {type:'text/javascript'}));
    w = new Worker(url);
  } catch (e) { post({id:id, ok:false, out:'تعذّر إنشاء بيئة التنفيذ: ' + e}); return; }
  var end = function(o){ if (done) return; done = true; clearTimeout(t); delete running[id]; try{w.terminate();}catch(e){} try{URL.revokeObjectURL(url);}catch(e){} o.id = id; post(o); };
  running[id] = function(){ end({ok:false, out:'أُلغي التنفيذ.'}); };
  t = setTimeout(function(){ end({ok:false, out:'انتهت مهلة التنفيذ (' + Math.round(ms/1000) + ' ثوانٍ) — ربما حلقة لا نهائية.'}); }, ms);
  w.onmessage = function(e){ if (e.data && e.data.log !== undefined) { if (!done) post({id:id, log:e.data.log}); return; } end(e.data); };
  w.onerror = function(e){ end({ok:false, out:'خطأ: ' + (e && e.message ? e.message : e)}); };
  w.postMessage(code);
};
window.__cancel = function(id){ if (running[id]) running[id](); };
post({ready:true});
</script></body></html>`;

/** WebView مخفي يوفّر بيئة معزولة لأداة run_js. يُحمَّل فقط حين يكون وضع الوكيل والأداة مفعّلين. */
export function JsSandbox() {
  const on = useSettings((s) => s.modes.agent && s.agent.tools.run_js !== false);
  if (!on) return null;
  return <Inner />;
}

function Inner() {
  const ref = useRef<WebView>(null);
  useEffect(() => {
    sandboxBridge.attach(
      (id, code, ms) => { ref.current?.injectJavaScript(`window.__run(${JSON.stringify(id)}, ${JSON.stringify(code)}, ${Math.round(ms)}); true;`); },
      (id) => { ref.current?.injectJavaScript(`window.__cancel(${JSON.stringify(id)}); true;`); },
    );
    return () => sandboxBridge.detach();
  }, []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
      <WebView
        ref={ref}
        source={{ html: HTML }}
        originWhitelist={['about:*', 'data:*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          const d = e.nativeEvent.data;
          if (d.includes('"ready"')) { try { if (JSON.parse(d).ready) { sandboxBridge.markReady(); return; } } catch {} }
          sandboxBridge.onMessage(d);
        }}
      />
    </View>
  );
}
