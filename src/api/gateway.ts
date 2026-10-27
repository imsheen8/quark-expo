/** عميل بوابة بايثون (البريد): POST {url}/api/gw/mail/<op> برأس x-quark-token. */
import { fetch as xfetch } from 'expo/fetch';
import { useSettings } from '../store/settings';
import type { MailAccount, MailFull, MailHead } from './mailCore';

export interface Folder { name: string; label: string; role: string; delim?: string; unseen?: number; total?: number }

const acctBody = (a: MailAccount) => ({
  user: a.user || a.email,
  pass: a.pass,
  imap_host: a.imapHost,
  imap_port: a.imapPort,
  imap_sec: a.ssl ? 'ssl' : 'starttls',
  smtp_host: a.smtpHost,
  smtp_port: a.smtpPort,
  smtp_sec: a.smtpPort === 587 ? 'starttls' : a.ssl ? 'ssl' : 'none',
  from: a.email,
  display: a.label,
});

export const gwConfigured = () => !!useSettings.getState().gw.url.trim();

async function call<T = any>(path: string, body?: unknown, method = 'POST', signal?: AbortSignal): Promise<T> {
  const { url, token } = useSettings.getState().gw;
  if (!url.trim()) throw new Error('لم تُضبط بوابة البريد. أدخل عنوانها في «إعدادات ← البريد».');
  const base = url.trim().replace(/\/+$/, '');
  let res;
  try {
    res = await xfetch(base + '/api/gw/' + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { 'x-quark-token': token } : {}) },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal,
    });
  } catch (e) {
    if ((e as any)?.name === 'AbortError') throw e;
    throw new Error('تعذّر الوصول إلى بوابة البريد. تأكد أن الخادم يعمل (python3 serve.py) وأن العنوان صحيح.');
  }
  const txt = await res.text();
  let j: any = null;
  try { j = JSON.parse(txt); } catch {}
  if (!res.ok || (j && j.ok === false)) throw new Error(j?.error || `خطأ من البوابة (${res.status})`);
  return (j ?? {}) as T;
}

export const gwHealth = () => call<{ ok: boolean; version?: string; token?: boolean }>('health', undefined, 'GET');
export const mailTest = (a: MailAccount) => call<{ imap: boolean; smtp: boolean | null; smtp_error?: string }>('mail/test', { acct: acctBody(a) });
export const mailFolders = async (a: MailAccount) => (await call<{ folders: Folder[] }>('mail/folders', { acct: acctBody(a) })).folders;

const toHead = (r: any): MailHead => ({
  uid: String(r.uid),
  from: r.from?.name ? `${r.from.name} <${r.from.addr}>` : r.from?.addr || '',
  to: (r.to || []).map((x: any) => x.addr).join(', '),
  subject: r.subject || '(بلا موضوع)',
  date: Date.parse(r.date) || 0,
  seen: !r.unread,
});

export async function mailList(a: MailAccount, o: { folder: string; page?: number; q?: string; filter?: 'all' | 'unread' | 'flagged'; size?: number }) {
  const r = await call<{ rows: any[]; total: number; more: boolean }>('mail/list', { acct: acctBody(a), folder: o.folder, page: o.page ?? 0, size: o.size ?? 30, q: o.q || '', filter: o.filter || 'all' });
  return { rows: r.rows.map(toHead), total: r.total, more: r.more };
}

export async function mailRead(a: MailAccount, folder: string, uid: string): Promise<MailFull & { attachments: { index: number; name: string; size: number }[]; replyTo: string; msgid: string; references: string }> {
  const r = await call<any>('mail/read', { acct: acctBody(a), folder, uid: +uid, mark_seen: true, inline: false });
  return {
    uid,
    from: r.from?.name ? `${r.from.name} <${r.from.addr}>` : r.from?.addr || '',
    to: (r.to || []).map((x: any) => x.addr).join(', '),
    cc: (r.cc || []).map((x: any) => x.addr).join(', '),
    subject: r.subject || '(بلا موضوع)',
    date: Date.parse(r.date) || 0,
    seen: true,
    body: r.text || htmlFallback(r.html || ''),
    html: r.html,
    messageId: r.msgid,
    msgid: r.msgid,
    references: r.references || '',
    replyTo: (r.reply_to?.[0]?.addr as string) || r.from?.addr || '',
    attachments: r.attachments || [],
  };
}

const htmlFallback = (h: string) =>
  h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();

export const mailSend = (a: MailAccount, m: { to: string[]; cc?: string[]; subject: string; text: string; inReplyTo?: string; references?: string; replyUid?: string; replyFolder?: string }) =>
  call('mail/send', { acct: acctBody(a), to: m.to, cc: m.cc || [], subject: m.subject, text: m.text, in_reply_to: m.inReplyTo || '', references: m.references || '', reply_uid: m.replyUid ? +m.replyUid : 0, reply_folder: m.replyFolder || '', save_sent: true });

export const mailDraft = (a: MailAccount, m: { to: string[]; subject: string; text: string }) => call('mail/draft', { acct: acctBody(a), to: m.to, subject: m.subject, text: m.text });
export const mailMark = (a: MailAccount, folder: string, uids: string[], op: 'read' | 'unread' | 'flag' | 'unflag' | 'spam') => call('mail/mark', { acct: acctBody(a), folder, uids: uids.map(Number), op });
export const mailDelete = (a: MailAccount, folder: string, uids: string[]) => call('mail/delete', { acct: acctBody(a), folder, uids: uids.map(Number) });
export const mailArchive = (a: MailAccount, folder: string, uids: string[]) => call('mail/archive', { acct: acctBody(a), folder, uids: uids.map(Number) });
