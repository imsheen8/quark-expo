/* اختبارات المنطق الصرف (بدون React Native): npm test */
import assert from 'node:assert/strict';
import { httpErrorText } from '../src/api/errors';
import { buildHistory } from '../src/api/history';
import { LineBuffer, mergeUsage, parseEvent, parseFull, parseModelList, splitThink, sseData } from '../src/api/parsers';
import { buildRequest, modelsRequest, rejectedField } from '../src/api/payload';
import type { Endpoint, MemoryItem, Msg } from '../src/api/types';
import { chatToMarkdown } from '../src/lib/chatFormat';
import { highlight, parseInline, parseMarkdown } from '../src/lib/mdParse';
import { extractRemember, isSensitive, pickMemories, similarity } from '../src/lib/memoryRank';
import { aggregate } from '../src/lib/stats';
import { fillTemplate, parseVars } from '../src/lib/template';
import { mixHex, relTime } from '../src/lib/util';
import { decodeEntities, htmlToText, isPrivateUrl, parseDDG, extractJSON } from '../src/api/webParse';
import { nextRun, parseCron, validateSchedule } from '../src/lib/schedule';
import { calc, compact, needsApproval, parseCalls, validate, wrapResult, defaultAgent } from '../src/api/agentCore';
import { buildApiRequest, hmacSha256Hex, parseApiCall, type Integration } from '../src/api/integCore';
import { parsePlan } from '../src/api/researchCore';
import { guessPreset, parseAddr, validateCompose } from '../src/api/mailCore';
import { fromBag, mergeBags, toBag } from '../src/api/syncCore';
import { createHash } from 'node:crypto';
import { passFilter } from '../src/lib/chatFilter';
import { cleanRepo, fit, hfFileUrl, pickVariant, quantOf, variantsFromFiles } from '../src/api/localCore';

let n = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n', e);
    process.exitCode = 1;
  }
};
const ep = (p: Partial<Endpoint>): Endpoint => ({ id: 'e', preset: 'x', label: 'x', url: 'https://h/v1', key: 'K', proto: 'openai', kind: 'api', enabled: true, models: [], ...p });

console.log('parsers');
t('splitThink: مغلق ومفتوح وجزئي', () => {
  assert.deepEqual(splitThink('<think>أفكر</think>الجواب'), { think: 'أفكر', ans: 'الجواب' });
  assert.deepEqual(splitThink('<think>ما زلت'), { think: 'ما زلت', ans: '' });
  assert.equal(splitThink('مرحبا <thi').ans, 'مرحبا ');
  assert.deepEqual(splitThink('نص عادي'), { think: '', ans: 'نص عادي' });
});
t('LineBuffer يجمع الأسطر المقسومة', () => {
  const b = new LineBuffer();
  assert.deepEqual(b.push('data: {"a"'), []);
  assert.deepEqual(b.push(':1}\ndata: 2\nda'), ['data: {"a":1}', 'data: 2']);
  assert.deepEqual(b.flush(), ['da']);
});
t('sseData', () => {
  assert.equal(sseData('data: [DONE]'), '[DONE]');
  assert.equal(sseData('event: x'), null);
});
t('openai: نص + تفكير + استهلاك', () => {
  assert.deepEqual(parseEvent('openai', { choices: [{ delta: { content: 'م' } }] }), [{ kind: 'text', text: 'م' }]);
  assert.deepEqual(parseEvent('openai', { choices: [{ delta: { reasoning_content: 'ف' } }] }), [{ kind: 'think', text: 'ف' }]);
  const u = parseEvent('openai', { choices: [], usage: { prompt_tokens: 5, completion_tokens: 7, completion_tokens_details: { reasoning_tokens: 2 } } });
  assert.deepEqual(u, [{ kind: 'usage', usage: { in: 5, out: 7, think: 2 } }]);
  assert.throws(() => parseEvent('openai', { error: { message: 'boom' } }), /boom/);
});
t('anthropic: الأحداث', () => {
  assert.deepEqual(parseEvent('anthropic', { type: 'content_block_delta', delta: { type: 'text_delta', text: 'a' } }), [{ kind: 'text', text: 'a' }]);
  assert.deepEqual(parseEvent('anthropic', { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'b' } }), [{ kind: 'think', text: 'b' }]);
  const s = parseEvent('anthropic', { type: 'message_start', message: { usage: { input_tokens: 9, output_tokens: 1 } } });
  const d = parseEvent('anthropic', { type: 'message_delta', usage: { output_tokens: 30 } });
  let u: any = {};
  for (const c of [...s, ...d]) if (c.kind === 'usage') u = mergeUsage(u, c.usage);
  assert.equal(u.in, 9);
  assert.equal(u.out, 30);
  assert.throws(() => parseEvent('anthropic', { type: 'error', error: { message: 'bad' } }), /bad/);
});
t('gemini: thought وtext واستهلاك', () => {
  const r = parseEvent('gemini', { candidates: [{ content: { parts: [{ text: 'x', thought: true }, { text: 'y' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 } });
  assert.deepEqual(r, [{ kind: 'think', text: 'x' }, { kind: 'text', text: 'y' }, { kind: 'usage', usage: { in: 3, out: 4, think: undefined } }]);
  assert.throws(() => parseEvent('gemini', { promptFeedback: { blockReason: 'SAFETY' } }), /SAFETY/);
});
t('ollama: message + done', () => {
  assert.deepEqual(parseEvent('ollama', { message: { content: 'h', thinking: 't' } }), [{ kind: 'think', text: 't' }, { kind: 'text', text: 'h' }]);
  assert.deepEqual(parseEvent('ollama', { done: true, prompt_eval_count: 2, eval_count: 3 }), [{ kind: 'usage', usage: { in: 2, out: 3 } }]);
});
t('parseFull لكل صيغة', () => {
  assert.equal(parseFull('openai', { choices: [{ message: { content: 'A' } }] }), 'A');
  assert.equal(parseFull('anthropic', { content: [{ text: 'A' }, { text: 'B' }] }), 'AB');
  assert.equal(parseFull('gemini', { candidates: [{ content: { parts: [{ text: 'A' }, { text: 'T', thought: true }] } }] }), 'A');
  assert.equal(parseFull('ollama', { message: { content: 'A' } }), 'A');
});
t('parseModelList يخفي غير المحادثة', () => {
  assert.deepEqual(parseModelList('openai', { data: [{ id: 'gpt-4o' }, { id: 'text-embedding-3' }, { id: 'whisper-1' }, { id: 'a-model' }] }), ['a-model', 'gpt-4o']);
  assert.deepEqual(parseModelList('gemini', { models: [{ name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }] }), ['gemini-2.5-pro']);
  assert.deepEqual(parseModelList('ollama', { models: [{ name: 'llama3:8b' }] }), ['llama3:8b']);
});

console.log('payload');
const msgs = [{ role: 'user' as const, content: 'hi', images: [{ mime: 'image/png', data: 'AAA' }] }];
t('openai: ترويسات ومعاملات وصور', () => {
  const r = buildRequest({ ep: ep({}), model: 'gpt-4o', messages: msgs, system: 'S', params: { temperature: 0.5, max_tokens: 100 }, stream: true });
  assert.equal(r.url, 'https://h/v1/chat/completions');
  assert.equal(r.headers.authorization, 'Bearer K');
  assert.equal(r.body.temperature, 0.5);
  assert.equal(r.body.max_tokens, 100);
  assert.deepEqual(r.body.stream_options, { include_usage: true });
  assert.equal(r.body.messages[0].role, 'system');
  assert.equal(r.body.messages[1].content[1].image_url.url, 'data:image/png;base64,AAA');
});
t('openai: o-series وapi.openai.com', () => {
  const r = buildRequest({ ep: ep({ url: 'https://api.openai.com/v1/' }), model: 'o3-mini', messages: msgs, system: '', params: { temperature: 1, max_tokens: 10 }, stream: false });
  assert.equal(r.body.temperature, undefined);
  assert.equal(r.body.max_completion_tokens, 10);
  assert.equal(r.body.stream_options, undefined);
  assert.equal(r.url, 'https://api.openai.com/v1/chat/completions');
});
t('openai: الحذف عند الرفض', () => {
  const r = buildRequest({ ep: ep({}), model: 'm', messages: msgs, system: '', params: { top_p: 0.9 }, stream: true, drop: new Set(['stream_options', 'top_p']) });
  assert.equal(r.body.stream_options, undefined);
  assert.equal(r.body.top_p, undefined);
});
t('anthropic', () => {
  const r = buildRequest({ ep: ep({ proto: 'anthropic', url: 'https://api.anthropic.com/v1' }), model: 'claude-sonnet-4-5', messages: msgs, system: 'S', params: { temperature: 1.7 }, stream: true });
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(r.headers['x-api-key'], 'K');
  assert.equal(r.body.max_tokens, 4096);
  assert.equal(r.body.temperature, 1);
  assert.equal(r.body.system, 'S');
  assert.equal(r.body.messages[0].content[0].type, 'image');
  const o = buildRequest({ ep: ep({ proto: 'anthropic' }), model: 'claude-opus-4-7', messages: msgs, system: '', params: { temperature: 0.2 }, stream: true });
  assert.equal(o.body.temperature, undefined);
});
t('gemini', () => {
  const r = buildRequest({ ep: ep({ proto: 'gemini', url: 'https://g/v1beta' }), model: 'gemini-2.5-flash', messages: [{ role: 'assistant', content: 'x' }, ...msgs], system: 'S', params: { top_p: 0.8, max_tokens: 50 }, stream: true, thinking: 'on' });
  assert.equal(r.url, 'https://g/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse');
  assert.equal(r.headers['x-goog-api-key'], 'K');
  assert.equal(r.body.contents[0].role, 'user');
  assert.deepEqual(r.body.generationConfig, { topP: 0.8, maxOutputTokens: 50, thinkingConfig: { includeThoughts: true } });
  assert.deepEqual(r.body.systemInstruction, { parts: [{ text: 'S' }] });
});
t('ollama', () => {
  const r = buildRequest({ ep: ep({ proto: 'ollama', url: 'http://10.0.0.2:11434' }), model: 'llama3', messages: msgs, system: 'S', params: { max_tokens: 64 }, stream: true });
  assert.equal(r.url, 'http://10.0.0.2:11434/api/chat');
  assert.deepEqual(r.body.options, { num_predict: 64 });
  assert.deepEqual(r.body.messages[1].images, ['AAA']);
});
t('rejectedField وmodelsRequest', () => {
  assert.equal(rejectedField("(400) Unsupported parameter: 'temperature' is not supported"), 'temperature');
  assert.equal(rejectedField('(400) Unknown field stream_options'), 'stream_options');
  assert.equal(rejectedField('(400) bad key'), null);
  assert.equal(modelsRequest(ep({ proto: 'ollama', url: 'http://x:1/' })).url, 'http://x:1/api/tags');
  assert.equal(modelsRequest(ep({})).headers.authorization, 'Bearer K');
});
t('رسائل الأخطاء', () => {
  assert.match(httpErrorText(401, '{"error":{"message":"nope"}}'), /مفتاح API.*nope/);
  assert.match(httpErrorText(429, 'slow'), /حد الطلبات/);
});

console.log('history');
t('buildHistory يدمج ويتجاوز الأخطاء ويضم الملفات', () => {
  const m = (role: 'user' | 'assistant', content: string, extra: Partial<Msg> = {}): Msg => ({ id: content, role, content, ts: 1, ...extra });
  const h = buildHistory(
    [m('user', 'a'), m('user', 'b', { files: [{ name: 'f.txt', text: 'XYZ' }] }), m('assistant', 'خطأ', { error: true }), m('assistant', 'ok'), m('user', 'c', { imgs: [{ id: 'i1', mime: 'image/png', uri: 'u' }] })],
    new Map([['i1', 'B64']]),
  );
  assert.equal(h.length, 3);
  assert.match(h[0].content, /^a\n\nb/);
  assert.match(h[0].content, /f\.txt[\s\S]*XYZ/);
  assert.equal(h[1].content, 'ok');
  assert.deepEqual(h[2].images, [{ mime: 'image/png', data: 'B64' }]);
});

console.log('markdown');
t('كتل أساسية', () => {
  const b = parseMarkdown('# عنوان\n\nفقرة **غامق** و`كود`\n\n- أ\n- ب\n\n1. x\n2. y\n\n> اقتباس\n\n---\n\n```py\nprint(1)\n```');
  assert.deepEqual(b.map((x) => x.t), ['h', 'p', 'ul', 'ol', 'quote', 'hr', 'code']);
  const code = b[6] as any;
  assert.equal(code.lang, 'py');
  assert.equal(code.open, false);
});
t('كتلة كود غير مغلقة أثناء البث', () => {
  const b = parseMarkdown('نص\n```js\nconst a = 1');
  assert.equal((b[1] as any).open, true);
  assert.equal((b[1] as any).code, 'const a = 1');
});
t('جدول', () => {
  const b = parseMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |');
  assert.equal(b[0].t, 'table');
  assert.equal((b[0] as any).rows.length, 2);
});
t('inline: رابط وغامق ومائل', () => {
  const r = parseInline('انظر [موقع](https://x.io) و **قوي** و *مائل*');
  assert.deepEqual(r.map((x) => x.t), ['text', 'link', 'text', 'bold', 'text', 'italic']);
});
t('highlight', () => {
  const k = highlight('const x = "s" // c', 'js').filter((x) => x.k).map((x) => x.k);
  assert.deepEqual(k, ['k', 's', 'c']);
});

console.log('memory');
const mem = (text: string, cat: MemoryItem['cat'] = 'fact', pinned = false): MemoryItem => ({ id: text, text, cat, pinned, uses: 0, lastUsed: 0, source: 'manual', createdAt: 1, updatedAt: 1 });
t('similarity يتجاهل التصريف العربي', () => {
  assert.ok(similarity('عندي سيارة حمراء', 'السيارات') > 0);
  assert.equal(similarity('قطة', 'ملعب'), 0);
});
t('pickMemories: مثبّتة + هوية + الأقرب', () => {
  const all = [mem('أحب القهوة', 'fact'), mem('اسمي سارة', 'identity'), mem('أعمل على مشروع تطبيق جوال', 'project'), mem('مثبّت دائمًا', 'fact', true)];
  const p = pickMemories(all, 'ما حال مشروع التطبيق؟', 3).map((x) => x.text);
  assert.ok(p.includes('مثبّت دائمًا'));
  assert.ok(p.includes('اسمي سارة'));
  assert.ok(p.includes('أعمل على مشروع تطبيق جوال'));
  assert.ok(!p.includes('أحب القهوة'));
});
t('extractRemember وisSensitive', () => {
  assert.equal(extractRemember('تذكّر: أنا أسكن في بغداد'), 'أنا أسكن في بغداد');
  assert.equal(extractRemember('remember my cat is Tom'), 'my cat is Tom');
  assert.equal(extractRemember('مرحبا'), null);
  assert.equal(extractRemember('تذكر: مفتاحي sk-abcdefghijklmnopqrstuvwx'), null);
  assert.ok(isSensitive('4111 1111 1111 1111'));
});

console.log('أخرى');
t('القوالب', () => {
  const v = parseVars('ترجم إلى {{اللغة|العربية}}: {{النص}} {{النص}}');
  assert.deepEqual(v, [{ name: 'اللغة', def: 'العربية' }, { name: 'النص', def: '' }]);
  assert.equal(fillTemplate('ترجم إلى {{اللغة|العربية}}: {{النص}}', { النص: 'hello' }), 'ترجم إلى العربية: hello');
});
t('الإحصائيات', () => {
  const now = new Date('2026-10-26T12:00:00').getTime();
  const s = aggregate(
    [
      { ts: now, model: 'a', ep: 'e', in: 10, out: 5, think: 0, est: false },
      { ts: now - 86400000, model: 'a', ep: 'e', in: 1, out: 1, think: 3, est: true },
      { ts: now, model: 'b', ep: 'e', in: 100, out: 1, think: 0, est: false },
    ],
    now,
  );
  assert.equal(s.calls, 3);
  assert.equal(s.models[0].model, 'b');
  assert.equal(s.days.length, 7);
  assert.equal(s.days[6].total, 116);
  assert.equal(s.est, 1);
});
t('أدوات', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(relTime(1000, 1000 + 5 * 60000), 'قبل 5 د');
});
t('تصدير Markdown', () => {
  const md = chatToMarkdown({ id: '1', title: 'T', autoTitle: false, created: 0, updated: 0, messages: [{ id: 'a', role: 'user', content: 'سؤال', ts: 0 }, { id: 'b', role: 'assistant', content: 'جواب', ts: 0, model: 'm' }] });
  assert.match(md, /^# T/);
  assert.match(md, /\*\*أنت\*\*\n\nسؤال/);
  assert.match(md, /QUARK · m/);
});

t('webParse: DDG وكيانات وروابط خاصة', () => {
  const html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">عنوان &amp; اختبار</a><a class="result__snippet" href="x">مقتطف</a>';
  const r = parseDDG(html);
  assert.equal(r[0]?.url, 'https://example.com/a');
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.ok(htmlToText('<title>T</title><body><p>مرحبا</p><script>x</script></body>', 100).text.includes('مرحبا'));
  assert.equal(isPrivateUrl('http://192.168.1.5/x'), true);
  assert.equal(isPrivateUrl('http://localhost:3000'), true);
  assert.equal(isPrivateUrl('https://example.com'), false);
  assert.deepEqual(extractJSON('نص {"a":1} نهاية'), { a: 1 });
});
t('cron والجدولة', () => {
  const base = new Date(2026, 0, 5, 10, 0, 0).getTime(); // اثنين
  const d = new Date(nextRun({ mode: 'daily', time: '08:00' }, base)!);
  assert.equal(d.getDate(), 6); assert.equal(d.getHours(), 8);
  const w = new Date(nextRun({ mode: 'weekly', time: '09:30', days: [3] }, base)!);
  assert.equal(w.getDay(), 3);
  const m = new Date(nextRun({ mode: 'monthly', time: '07:00', day: 31 }, new Date(2026, 1, 1).getTime())!);
  assert.equal(m.getMonth(), 1); assert.equal(m.getDate(), 28);
  assert.ok(parseCron('*/15 8-10 * * 1-5'));
  assert.equal(parseCron('bad'), null);
  const c = new Date(nextRun({ mode: 'cron', cron: '30 14 * * *' }, base)!);
  assert.equal(c.getHours(), 14); assert.equal(c.getMinutes(), 30);
  assert.equal(nextRun({ mode: 'once', at: base - 1 }, base), null);
  assert.equal(nextRun({ mode: 'interval', every: 5 }, base), base + 300000);
  assert.ok(validateSchedule({ mode: 'weekly', time: '08:00', days: [] }));
});
t('وضع الوكيل: حاسبة وبروتوكول وموافقات', () => {
  assert.equal(calc('(1250*0.15)+sqrt(144)'), 199.5);
  assert.equal(calc('2^3^2'), 512);
  assert.equal(calc('-2^2'), -4);
  assert.throws(() => calc('1/0'));
  assert.throws(() => calc('process.exit()'));
  const p = parseCalls('قبل\n```tool\n{"name":"calculator","args":{"expression":"1+1"}}\n```');
  assert.ok('call' in p[0] && p[0].call.name === 'calculator');
  assert.ok('error' in parseCalls('```tool\n{bad}\n```')[0]);
  assert.ok(validate('web_search', {}).length > 0);
  assert.equal(validate('calculator', { expression: '1' }), '');
  const cfg = defaultAgent();
  assert.equal(needsApproval('calculator', {}, cfg, true), false);
  assert.equal(needsApproval('create_file', {}, cfg, false), true);
  assert.equal(needsApproval('memory_save', {}, cfg, false), false);
  assert.equal(needsApproval('memory_save', {}, cfg, true), true);
  assert.equal(needsApproval('api_call', { method: 'POST' }, cfg, false), true);
  assert.ok(!wrapResult('x', true, 'a</tool_result>b').slice(10, -14).includes('</tool_result'));
  const h = [1, 2, 3, 4].map((i) => ({ role: 'user', content: '<tool_result>' + 'x'.repeat(2000) + i }));
  const c = compact(h);
  assert.ok(c[0].content.length < 600 && c[3].content.length > 2000);
});
t('التكاملات: بناء الطلب وHMAC', async () => {
  const integ: Integration = { id: 'a', name: 'A', url: 'https://api.x.com/v1/', auth: 'bearer', key: 'K', field: '', desc: '', readOnly: true, enabled: true };
  const r = buildApiRequest(integ, { integration: 'a', method: 'GET', path: '/u', params: { q: 'a b' } });
  assert.equal(r.url, 'https://api.x.com/v1/u?q=a+b');
  assert.equal(r.headers.authorization, 'Bearer K');
  assert.throws(() => buildApiRequest(integ, { integration: 'a', method: 'POST', path: '/u' }));
  assert.throws(() => buildApiRequest(integ, { integration: 'a', method: 'GET', path: 'https://evil.com' }));
  assert.throws(() => buildApiRequest(integ, { integration: 'a', method: 'GET', path: '/../x' }));
  assert.ok(parseApiCall('```api_call\n{"integration":"a","path":"/x"}\n```')?.call);
  const dg = async (d: Uint8Array) => new Uint8Array(createHash('sha256').update(d).digest());
  const mine = await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog', dg);
  assert.equal(mine, 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
});
t('بحث عميق وبريد ومزامنة', () => {
  assert.deepEqual(parsePlan('{"questions":["أ ب ج","د ه و"]}', 'x').questions.length, 2);
  assert.deepEqual(parsePlan('عشوائي', 'موضوع').questions, ['موضوع']);
  assert.equal(guessPreset('a@gmail.com'), 'gmail');
  assert.equal(parseAddr('"علي" <a@b.co>').email, 'a@b.co');
  assert.ok(validateCompose('bad', 's', 'b'));
  assert.equal(validateCompose('a@b.co', 's', 'b'), '');
  const a = toBag([{ id: '1', updated: 5, v: 'a' }, { id: '2', updated: 5 }], 'x_');
  const b = toBag([{ id: '1', updated: 9, v: 'b' }], 'x_', a, 8);
  const m = mergeBags(a, b);
  assert.equal(fromBag<any>(m, 'x_').length, 1);
  assert.equal(fromBag<any>(m, 'x_')[0].v, 'b');
});

t('تصفية المحادثات', () => {
  const now = new Date(2026, 5, 15, 12).getTime();
  const mk = (days: number, extra = {}) => ({ updated: now - days * 864e5, ...extra });
  assert.equal(passFilter(mk(0.2), 'today', now), true);
  assert.equal(passFilter(mk(2), 'today', now), false);
  assert.equal(passFilter(mk(6), 'week', now), true);
  assert.equal(passFilter(mk(8), 'week', now), false);
  assert.equal(passFilter(mk(29), 'month', now), true);
  assert.equal(passFilter(mk(40), 'month', now), false);
  assert.equal(passFilter(mk(1, { pinned: true }), 'fav', now), true);
  assert.equal(passFilter(mk(1, { tags: ['a'] }), 'tag:a', now), true);
  assert.equal(passFilter(mk(1, { tags: ['a'] }), 'tag:b', now), false);
});

t('نماذج محلية: صيغ GGUF والملاءمة', () => {
  assert.equal(quantOf('Qwen3-1.7B-Q4_K_M.gguf'), 'Q4_K_M');
  const GB = 1024 ** 3;
  const files = [
    { path: 'm-Q4_K_M.gguf', size: 1.0 * GB }, { path: 'm-Q8_0.gguf', size: 1.8 * GB }, { path: 'm-Q2_K.gguf', size: 0.6 * GB },
    { path: 'mmproj-F16.gguf', size: 0.3 * GB }, { path: 'big-Q4_K_M-00001-of-00002.gguf', size: GB },
    { path: 'part/x-Q4_K_M-00001-of-00002.gguf', size: GB }, { path: 'part/x-Q4_K_M-00002-of-00002.gguf', size: GB }, { path: 'README.md', size: 1 },
  ];
  const v = variantsFromFiles(files);
  assert.deepEqual(v.map((x) => x.quant).sort(), ['Q2_K', 'Q4_K_M', 'Q4_K_M', 'Q8_0']); // الجزء الناقص مستبعد، mmproj مستبعد
  assert.equal(pickVariant(v)?.quant, 'Q4_K_M');
  assert.equal(pickVariant(v, 0.7 * GB)?.quant, 'Q2_K');
  assert.equal(cleanRepo('https://huggingface.co/unsloth/Qwen3-4B-GGUF?x=1'), 'unsloth/Qwen3-4B-GGUF');
  assert.equal(hfFileUrl('a/b', 'd/x y.gguf'), 'https://huggingface.co/a/b/resolve/main/d/x%20y.gguf');
  assert.equal(fit(0.5 * GB, 0.6, 8).level === 'no', false);
  assert.equal(fit(8 * GB, 14, 4).level, 'no');
});

console.log(`\n${n} اختبارًا نجح`);
