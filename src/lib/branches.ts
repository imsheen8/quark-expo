/** تفريع المحادثة بالتعديل — منطق صرف.
 *  كل رسالة مستخدم لها vers (نُسخ الذيل من هذه الرسالة فصاعدًا) وvi (النسخة الحالية).
 *  خانة النسخة الحالية في vers هي null لأنها هي الذيل الحيّ في chat.messages. */
import type { Msg } from '../api/types';

const strip = (m: Msg): Msg => {
  const { vers, vi, ...rest } = m;
  return rest as Msg;
};

/** يبدأ نسخة جديدة من رسالة: يحفظ الذيل الحالي كنسخة ويقصّ المحادثة قبل الرسالة.
 *  يعيد الرسائل المقصوصة وبيانات النسخ التي يجب أن تحملها الرسالة الجديدة. */
export function startBranch(messages: Msg[], id: string): { messages: Msg[]; vers: (Msg[] | null)[]; vi: number } | null {
  const i = messages.findIndex((m) => m.id === id);
  if (i < 0 || messages[i].role !== 'user') return null;
  const head = messages[i];
  const vers: (Msg[] | null)[] = head.vers && head.vers.length ? [...head.vers] : [null];
  const cur = Math.min(head.vi ?? vers.length - 1, vers.length - 1);
  vers[cur] = messages.slice(i).map((m, j) => (j === 0 ? strip(m) : m));
  vers.push(null);
  return { messages: messages.slice(0, i), vers, vi: vers.length - 1 };
}

/** ينتقل إلى نسخة أخرى: يحفظ الذيل الحيّ في خانته ويحمّل ذيل النسخة المطلوبة. */
export function switchVersion(messages: Msg[], id: string, k: number): Msg[] | null {
  const i = messages.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const head = messages[i];
  const vers = head.vers;
  if (!vers || k < 0 || k >= vers.length) return null;
  const cur = Math.min(head.vi ?? vers.length - 1, vers.length - 1);
  if (k === cur) return messages;
  const target = vers[k];
  if (!target || !target.length) return null;
  const stored = [...vers];
  stored[cur] = messages.slice(i).map((m, j) => (j === 0 ? strip(m) : m));
  stored[k] = null;
  const newHead: Msg = { ...target[0], vers: stored, vi: k };
  return [...messages.slice(0, i), newHead, ...target.slice(1)];
}

/** عدد النسخ لرسالة (1 = لا تفريع) */
export const versionCount = (m: Msg) => (m.vers && m.vers.length > 1 ? m.vers.length : 1);
export const versionIndex = (m: Msg) => Math.min(m.vi ?? (m.vers ? m.vers.length - 1 : 0), (m.vers?.length ?? 1) - 1);

/** تفريع إلى محادثة جديدة: نسخ الرسائل حتى رسالة معيّنة (بلا بيانات النسخ) */
export function forkUpTo(messages: Msg[], id: string, newId: (m: Msg) => string): Msg[] | null {
  const i = messages.findIndex((m) => m.id === id);
  if (i < 0) return null;
  return messages.slice(0, i + 1).map((m) => ({ ...strip(m), id: newId(m) }));
}
