import { PRESETS, hostOf } from './providers';
import { fetchModels } from './stream';
import type { Endpoint, Proto } from './types';
import { toast } from '../store/data';
import { useSettings } from '../store/settings';

export type EndpointDraft = Pick<Endpoint, 'preset' | 'label' | 'url' | 'key' | 'proto' | 'kind'>;

/** يضيف «http://» إن غاب المخطط، ويحذف الشرطة الأخيرة */
export const normUrl = (u: string): string => {
  const t = u.trim().replace(/\/+$/, '');
  return t && !/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? 'http://' + t : t;
};

const full = (d: EndpointDraft): Endpoint => ({ ...d, id: 'tmp', enabled: true, models: [] });

/** اختبار الاتصال: يعيد عدد النماذج أو يرمي خطأ مقروءًا */
export async function testEndpoint(d: EndpointDraft): Promise<number> {
  return (await fetchModels(full(d))).length;
}

/** يضيف نقطة اتصال جديدة ويجلب نماذجها (يفعّلها إن كانت ≤ 15). يعيد true عند نجاح الإضافة نفسها. */
export async function addEndpointFlow(d: EndpointDraft): Promise<boolean> {
  const st = useSettings.getState();
  const id = st.addEndpoint({ ...d, enabled: true, models: [] });
  try {
    const ids = await fetchModels({ ...full(d), id });
    st.setModels(id, ids, ids.length <= 15);
    const ep = useSettings.getState().endpoints.find((e) => e.id === id);
    const first = ep?.models.find((m) => m.on);
    if (first && !useSettings.getState().sel) st.select(id, first.id);
    toast(ids.length <= 15 ? `أُضيفت النقطة وفُعّلت ${ids.length} نموذجًا` : `أُضيفت النقطة — فعّل ما تريد من نماذجها (${ids.length})`);
  } catch (e) {
    toast('حُفظت النقطة لكن تعذّر جلب النماذج: ' + (e instanceof Error ? e.message.slice(0, 100) : ''));
  }
  return true;
}

export interface Found { name: string; url: string; proto: Proto; host: string }

async function probe(url: string, ms = 1500): Promise<boolean> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** بحث سريع عن خوادم محلية شائعة (Ollama وLM Studio) على عناوين الجهاز المعروفة */
export async function scanServers(): Promise<Found[]> {
  const hosts = ['localhost', '10.0.2.2'];
  const jobs: Promise<Found | null>[] = [];
  for (const h of hosts) {
    jobs.push(probe(`http://${h}:11434/api/tags`).then((ok) => (ok ? { name: 'Ollama', url: `http://${h}:11434`, proto: 'ollama' as Proto, host: `${h}:11434` } : null)));
    jobs.push(probe(`http://${h}:1234/v1/models`).then((ok) => (ok ? { name: 'LM Studio', url: `http://${h}:1234/v1`, proto: 'openai' as Proto, host: `${h}:1234` } : null)));
  }
  const res = (await Promise.all(jobs)).filter(Boolean) as Found[];
  // نحذف المكرر (نفس الخدمة على عنوانين)
  return res.filter((f, i) => res.findIndex((x) => x.name === f.name) === i);
}

export const localPreset = (proto: Proto) => (proto === 'ollama' ? 'ollama' : 'ollama_openai');
export const localLabel = (url: string) => hostOf(url);
export const apiLabel = (preset: string) => PRESETS[preset]?.label ?? 'مخصص';
