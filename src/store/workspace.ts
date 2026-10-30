import * as FS from 'expo-file-system/legacy';
import { create } from 'zustand';
import { wsStats, type Files, type PlanItem } from '../api/workspaceCore';
import { logErr } from './logs';
import { useChats } from './chats';

/** مشروع الوكيل: ملفات نصية + آخر خطة. يُحفظ كملف JSON لكل محادثة في مجلد التطبيق (لا يدخل AsyncStorage لكبر حجمه). */
export interface Project {
  id: string;
  name: string;
  files: Files;
  plan: PlanItem[];
  created: number;
  updated: number;
}

interface WsState { projects: Record<string, Project>; ready: boolean }
export const useWorkspace = create<WsState>()(() => ({ projects: {}, ready: false }));

const dir = () => (FS.documentDirectory || '') + 'quark-ws/';
const fileOf = (id: string) => dir() + id.replace(/[^\w-]/g, '_') + '.json';

let loading: Promise<void> | null = null;
/** يحمّل المشاريع المحفوظة مرة واحدة (آمن لاستدعائه مرارًا) */
export function loadWorkspaces(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      await FS.makeDirectoryAsync(dir(), { intermediates: true }).catch(() => {});
      const names = await FS.readDirectoryAsync(dir());
      const projects: Record<string, Project> = {};
      for (const n of names) {
        if (!n.endsWith('.json')) continue;
        try {
          const p = JSON.parse(await FS.readAsStringAsync(dir() + n));
          if (p && typeof p.id === 'string' && p.files && typeof p.files === 'object') {
            projects[p.id] = { id: p.id, name: String(p.name || 'مشروع'), files: p.files, plan: Array.isArray(p.plan) ? p.plan : [], created: +p.created || Date.now(), updated: +p.updated || Date.now() };
          }
        } catch { logErr('ws', 'ملف مشروع تالف: ' + n); }
      }
      // ما عُدّل في الذاكرة قبل انتهاء التحميل له الأولوية على القرص
      useWorkspace.setState((s) => ({ projects: { ...projects, ...s.projects }, ready: true }));
    } catch (e) {
      logErr('ws', e);
      useWorkspace.setState({ ready: true });
    }
  })();
  return loading;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
async function writeNow(id: string) {
  const p = useWorkspace.getState().projects[id];
  if (!p) return;
  try {
    await FS.makeDirectoryAsync(dir(), { intermediates: true }).catch(() => {});
    await FS.writeAsStringAsync(fileOf(id), JSON.stringify(p));
  } catch (e) { logErr('ws', e); }
}
function save(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.set(id, setTimeout(() => { timers.delete(id); void writeNow(id); }, 400));
}
/** يكتب أي تغييرات معلّقة فورًا (يُستدعى عند انتهاء مهمة الوكيل) */
export async function flushWorkspaces() {
  const ids = [...timers.keys()];
  for (const id of ids) { clearTimeout(timers.get(id)!); timers.delete(id); await writeNow(id); }
}

export const getProject = (id?: string | null): Project | undefined => (id ? useWorkspace.getState().projects[id] : undefined);

function fresh(id: string): Project {
  const t = useChats.getState().chats.find((c) => c.id === id)?.title;
  return { id, name: t && t !== 'محادثة جديدة' ? t : 'مشروع', files: {}, plan: [], created: Date.now(), updated: Date.now() };
}

/** يحدّث مشروع المحادثة (وينشئه عند أول كتابة) ويجدول حفظه */
export async function updateProject(id: string, fn: (p: Project) => Partial<Pick<Project, 'files' | 'plan' | 'name'>>): Promise<Project> {
  await loadWorkspaces();
  const cur = useWorkspace.getState().projects[id] ?? fresh(id);
  const next: Project = { ...cur, ...fn(cur), updated: Date.now() };
  useWorkspace.setState((s) => ({ projects: { ...s.projects, [id]: next } }));
  save(id);
  return next;
}

export async function removeProject(id: string) {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
  useWorkspace.setState((s) => { const p = { ...s.projects }; delete p[id]; return { projects: p }; });
  try { await FS.deleteAsync(fileOf(id), { idempotent: true }); } catch (e) { logErr('ws', e); }
}

export const projectSummary = (p: Project) => wsStats(p.files);

/* ---- معاينة تفاعلية للمستخدم (نافذة عامة) ---- */
export const usePreviewHost = create<{ html: string | null; open: (h: string) => void; close: () => void }>()((set) => ({
  html: null,
  open: (html) => set({ html }),
  close: () => set({ html: null }),
}));
