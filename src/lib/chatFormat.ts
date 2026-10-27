import type { Chat } from '../api/types';

export function chatToMarkdown(c: Chat): string {
  const head = `# ${c.title}\n\n_${new Date(c.created).toLocaleString('ar')}_\n`;
  const body = c.messages
    .filter((m) => !m.error)
    .map((m) => {
      const who = m.role === 'user' ? '**أنت**' : `**QUARK${m.model ? ' · ' + m.model : ''}**`;
      return `${who}\n\n${m.content}`;
    })
    .join('\n\n---\n\n');
  return head + '\n' + body + '\n';
}

export function chatToText(c: Chat): string {
  return (
    c.title +
    '\n' +
    '='.repeat(Math.min(40, c.title.length)) +
    '\n\n' +
    c.messages
      .filter((m) => !m.error)
      .map((m) => `${m.role === 'user' ? 'أنت' : 'QUARK'}:\n${m.content}`)
      .join('\n\n')
  );
}

export function chatToJSON(c: Chat): string {
  return JSON.stringify({ ...c, messages: c.messages.map(({ imgs, ...m }) => m) }, null, 2);
}

export const safeName = (s: string) => (s || 'chat').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 60) || 'chat';
