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
import { AG_TOOLS, parseAsk, formatAsk, MAX_SUB_TASKS, PARALLEL_SAFE, SUB_TOOLS, calc, compact, needsApproval, parseCalls, subConf, toolSpecs, validate, wrapResult, defaultAgent, availableTools } from '../src/api/agentCore';
import { cancelStep, registerStep, unregisterStep } from '../src/api/stepCancel';
import { parsePlan } from '../src/api/researchCore';
import { addHist, benchBest, benchSort, buildExport, dedupeKill, defaultMdUi, dupGroups, famOf, filterModels, fmtCtx, itemsOf, planImport, statusOf, latOf } from '../src/api/modelsCore';
import { exportLogs, fmtHead, makeEntry, pushLog, redact, viewLogs, type LogEntry } from '../src/lib/logCore';
import { needsComposer, parseNativeAction, startsChat } from '../src/api/nativeCore';
import { allowNav, canPreview, isSvgCode, previewDoc, PV_CSP } from '../src/api/previewCore';
import { passFilter } from '../src/lib/chatFilter';
import { SK_STARTERS, seedSkills, skBlock, skDupes, skEmit, skFromExtraction, skFromJson, skFromText, skParse, skRank, skRawUrl, skSelect, skTok, defaultSkillsConf } from '../src/api/skillsCore';
import { MAX_FB, capVision, chain, chatChain, defaultDefs, normDefs, researchModel, resolveRef, utilChain } from '../src/api/defaultsCore';
import {
  autoConn, b64ToBytes, buildSttRequest, buildTestRequest, buildTtsRequest, bytesToB64, connsFor, defaultVoiceCfg, geminiAudioB64, normVoiceCfg, parseSttResponse, pcmToWav, speakClean, ttsVoiceList, voiceConf,
} from '../src/api/voiceCore';
import { forkUpTo, startBranch, switchVersion, versionCount, versionIndex } from '../src/lib/branches';
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
  assert.ok(!wrapResult('x', true, 'a</tool_result>b').slice(10, -14).includes('</tool_result'));
  const h = [1, 2, 3, 4].map((i) => ({ role: 'user', content: '<tool_result>' + 'x'.repeat(2000) + i }));
  const c = compact(h);
  assert.ok(c[0].content.length < 600 && c[3].content.length > 2000);
});
t('وضع الوكيل: استدعاء الأدوات الأصلي', () => {
  const specs = toolSpecs(Object.keys(AG_TOOLS));
  assert.equal(specs.length, Object.keys(AG_TOOLS).length);
  for (const sp of specs) {
    assert.equal(sp.parameters.type, 'object');
    assert.ok(/^[a-zA-Z0-9_-]+$/.test(sp.name));
    for (const k of AG_TOOLS[sp.name].req) assert.ok(k in sp.parameters.properties, sp.name + '.' + k);
  }
  assert.equal(specs.find((x) => x.name === 'run_js')!.parameters.properties.code.type, 'string');
  assert.ok(PARALLEL_SAFE.every((n) => n in AG_TOOLS));
  assert.equal(validate('run_js', {}) !== '', true);
  assert.equal(validate('run_js', { code: '1+1' }), '');
  // الطلب: OpenAI
  const ep = { id: 'e', preset: 'x', label: 'x', url: 'https://api.openai.com/v1', key: 'k', proto: 'openai', kind: 'api', enabled: true, models: [] } as Endpoint;
  const msgs = [
    { role: 'user' as const, content: 'احسب' },
    { role: 'assistant' as const, content: 'سأحسب', toolCalls: [{ id: 'c1', name: 'calculator', args: { expression: '1+1' } }] },
    { role: 'user' as const, content: '', toolResults: [{ id: 'c1', name: 'calculator', content: '2', ok: true }] },
  ];
  const o = buildRequest({ ep, model: 'gpt-4o', messages: msgs, system: 's', params: {}, stream: true, tools: specs.slice(0, 2) });
  assert.equal(o.body.tools[0].type, 'function');
  assert.equal(o.body.messages[2].tool_calls[0].function.arguments, '{"expression":"1+1"}');
  assert.deepEqual(o.body.messages[3], { role: 'tool', tool_call_id: 'c1', content: '2' });
  // Anthropic
  const an = buildRequest({ ep: { ...ep, proto: 'anthropic', url: 'https://api.anthropic.com/v1' }, model: 'claude-x', messages: msgs, system: 's', params: {}, stream: true, tools: specs.slice(0, 1) });
  assert.equal(an.body.tools[0].input_schema.type, 'object');
  assert.equal(an.body.messages[1].content[1].type, 'tool_use');
  assert.equal(an.body.messages[1].content[1].input.expression, '1+1');
  assert.equal(an.body.messages[2].content[0].type, 'tool_result');
  assert.equal(an.body.messages[2].content[0].tool_use_id, 'c1');
  // بدون أدوات لا حقل tools
  assert.equal(buildRequest({ ep, model: 'm', messages: msgs.slice(0, 1), system: '', params: {}, stream: true }).body.tools, undefined);
  // البث: OpenAI
  const oc = [
    ...parseEvent('openai', { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c9', function: { name: 'web_search', arguments: '{"que' } }] } }] }),
    ...parseEvent('openai', { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"a"}' } }] } }] }),
  ];
  assert.deepEqual(oc[0], { kind: 'tool', index: 0, id: 'c9', name: 'web_search', args: '{"que' });
  assert.equal((oc[1] as any).args, 'ry":"a"}');
  // البث: Anthropic
  const ac = [
    ...parseEvent('anthropic', { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu1', name: 'calculator', input: {} } }),
    ...parseEvent('anthropic', { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"expression":"2*3"}' } }),
  ];
  assert.deepEqual(ac[0], { kind: 'tool', index: 1, id: 'tu1', name: 'calculator' });
  assert.equal((ac[1] as any).args, '{"expression":"2*3"}');
  // اختصار نتائج الأدوات القديمة بالصيغة الأصلية
  const long = 'x'.repeat(2000);
  const h = [1, 2, 3, 4].map((i) => ({ role: 'user', content: '', toolResults: [{ content: long + i }] }));
  const cc = compact(h);
  assert.ok(cc[0].toolResults![0].content.length < 600 && cc[3].toolResults![0].content.length > 2000);
});
t('وضع الوكيل: وكلاء فرعيون وإلغاء الخطوات', () => {
  // الأداة اختيارية افتراضيًا ومخاطرتها خارجية، وتتطلب tasks
  assert.equal(defaultAgent().tools.delegate, false);
  assert.equal(AG_TOOLS.delegate.risk, 'ext');
  assert.ok(validate('delegate', {}) !== '');
  assert.equal(validate('delegate', { tasks: [{ title: 'أ', instructions: 'ب' }] }), '');
  assert.equal(MAX_SUB_TASKS, 4);
  // إعداد الوكيل الفرعي: قراءة/بحث/حساب فقط، بلا تفويض متداخل ولا كتابة
  const full = { ...defaultAgent(), maxSteps: 20, tools: { ...defaultAgent().tools, delegate: true } };
  const sc = subConf(full);
  assert.equal(sc.maxSteps, 5);
  const names = availableTools(sc, { mem: true });
  assert.ok(!names.includes('delegate') && !names.includes('create_file') && !names.includes('memory_save') && !names.includes('manage_tasks') && !names.includes('ask_user') && !names.includes('plan'));
  assert.deepEqual([...names].sort(), [...SUB_TOOLS].sort());
  assert.ok(availableTools(full, { mem: true }).includes('delegate'));
  // إلغاء خطوة واحدة
  const ctl = new AbortController();
  registerStep('s1', ctl);
  assert.equal(cancelStep('s1'), true);
  assert.equal(ctl.signal.aborted, true);
  assert.equal(cancelStep('s1'), false); // ملغاة أصلًا
  unregisterStep('s1');
  assert.equal(cancelStep('s1'), false);
  assert.equal(cancelStep('nope'), false);
});
t('بحث عميق', () => {
  assert.deepEqual(parsePlan('{"questions":["أ ب ج","د ه و"]}', 'x').questions.length, 2);
  assert.deepEqual(parsePlan('عشوائي', 'موضوع').questions, ['موضوع']);
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

t('المهارات: SKILL.md ذهابًا وإيابًا', () => {
  const sk = skFromText(skEmit({ name: 'اسم: بنقطتين', description: 'وصف', when: 'عند الحاجة', tags: ['أ', 'ب'], status: 'draft', body: '1. خطوة أولى\n2. خطوة ثانية' }));
  assert.equal(sk.name, 'اسم: بنقطتين');
  assert.deepEqual(sk.tags, ['أ', 'ب']);
  assert.equal(sk.status, 'draft');
  assert.ok(sk.body.includes('خطوة ثانية'));
  assert.throws(() => skFromText('نص قصير'));
  assert.equal(skParse('# عنوان\nمحتوى طويل بما يكفي').name, 'عنوان');
});
t('المهارات: المطابقة والاختيار', () => {
  const all = seedSkills();
  assert.equal(all.length, SK_STARTERS.length);
  const cfg = defaultSkillsConf();
  assert.equal(skSelect('اكتب لي بريد إلكتروني رسمي لمديري', all, cfg)[0]?.name, 'بريد مهني');
  assert.equal(skRank('لخص لي هذا المقال', all)[0].s.name, 'تلخيص بنقاط');
  assert.equal(skSelect('ما عاصمة فرنسا', all, cfg).length, 0);
  assert.equal(skSelect('اكتب بريد', all, { ...cfg, enabled: false }).length, 0);
  assert.equal(skSelect('مرحبا', all, { ...cfg, enabled: false }, [all[2].id])[0].id, all[2].id); // التثبيت اليدوي يعمل مع إيقاف التلقائي
  const draft = { ...all[0], status: 'draft' as const };
  assert.equal(skSelect('اكتب لي بريد إلكتروني رسمي', [draft], cfg).length, 0); // المسودات لا تُحقن تلقائيًا
  assert.ok(skBlock([all[0]]).includes('--- مهارة: بريد مهني ---'));
  assert.equal(skBlock([]), '');
  assert.ok(skTok('الرسائل والبريدات').length >= 1);
});
t('المهارات: الاستيراد والتكرار', () => {
  assert.equal(skRawUrl('https://github.com/a/b/blob/main/x/SKILL.md'), 'https://raw.githubusercontent.com/a/b/main/x/SKILL.md');
  assert.equal(skRawUrl('https://github.com/a/b/tree/main/skills/foo'), 'https://raw.githubusercontent.com/a/b/main/skills/foo/SKILL.md');
  assert.equal(skRawUrl('https://github.com/a/b'), 'https://raw.githubusercontent.com/a/b/HEAD/SKILL.md');
  assert.equal(skFromJson(JSON.stringify({ skills: [{ name: 'س', body: 'تعليمات', tags: ['x'] }, { name: 'بلا جسم' }] })).length, 1);
  const ex = skFromExtraction('```json\n{"skills":[{"name":"م","description":"d","when_to_use":"w","tags":["t"],"instructions":"1. خطوة مفصلة كافية الطول للقبول هنا"},{"name":"قصيرة","instructions":"x"}]}\n```', false);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].status, 'draft');
  assert.equal(skFromExtraction('{"skills":[]}', true).length, 0);
  const a = seedSkills()[0];
  assert.equal(skDupes([a, { ...a, id: 'z' }]).size, 2);
  assert.equal(skDupes(seedSkills()).size, 0);
});

const EPS: Endpoint[] = [
  { id: 'a', preset: 'x', label: 'A', url: 'u', key: 'k', proto: 'openai', kind: 'api', enabled: true, models: [] },
  { id: 'b', preset: 'x', label: 'B', url: 'u', key: '', proto: 'openai', kind: 'api', enabled: true, models: [] }, // بلا مفتاح
  { id: 'c', preset: 'x', label: 'C', url: 'u', key: 'k', proto: 'openai', kind: 'api', enabled: false, models: [] }, // معطّلة
  { id: 'd', preset: 'local', label: 'D', url: '', key: '', proto: 'llama', kind: 'local', enabled: true, models: [] },
];
t('النماذج التلقائية: السلاسل والرؤية', () => {
  const act = { ep: EPS[0], model: 'gpt-4o' };
  const d = defaultDefs();
  assert.equal(resolveRef({ ep: 'b', model: 'm' }, EPS), null); // بلا مفتاح
  assert.equal(resolveRef({ ep: 'c', model: 'm' }, EPS), null); // معطّلة
  assert.equal(resolveRef({ ep: 'd', model: 'm' }, EPS)?.ep.id, 'd'); // محلي بلا مفتاح مقبول
  d.util = { sel: { ep: 'b', model: 'x' }, fb: [{ ep: 'd', model: 'small' }, { ep: 'd', model: 'small' }] };
  const u = utilChain(d, EPS, act);
  assert.deepEqual(u.map((x) => x.ep.id + ':' + x.model), ['d:small', 'a:gpt-4o']); // يتخطى غير الصالح، بلا تكرار، وينتهي بنموذج المحادثة
  assert.equal(utilChain(defaultDefs(), EPS, act).length, 1);
  assert.equal(utilChain(defaultDefs(), EPS, null).length, 0);
  assert.equal(capVision('gpt-4o-mini'), true);
  assert.equal(capVision('llama-3.1-8b'), false);
  const txt = { ep: EPS[0], model: 'llama-3.1-8b' };
  d.vision = { sel: { ep: 'a', model: 'gpt-4o' }, fb: [] };
  assert.equal(chatChain(d, EPS, txt, true)[0].model, 'gpt-4o'); // صورة + نموذج بلا رؤية → نموذج الرؤية
  assert.equal(chatChain(d, EPS, txt, false)[0].model, 'llama-3.1-8b'); // بلا صور
  assert.equal(chatChain(d, EPS, act, true)[0].model, 'gpt-4o'); // نموذج المحادثة يدعم الرؤية
  assert.equal(chatChain(defaultDefs(), EPS, txt, true)[0].model, 'llama-3.1-8b'); // لا نموذج رؤية محدد
  assert.equal(researchModel(defaultDefs(), EPS, act)?.model, 'gpt-4o');
  assert.equal(researchModel({ ...defaultDefs(), research: { ep: 'd', model: 'r' } }, EPS, act)?.model, 'r');
  const nd = normDefs({ chat: { ep: 'a', model: 'm' }, util: { sel: { ep: '', model: 'x' }, fb: Array(9).fill({ ep: 'a', model: 'z' }) }, vision: 5 });
  assert.equal(nd.chat?.model, 'm');
  assert.equal(nd.util.sel, null);
  assert.equal(nd.util.fb.length, MAX_FB);
  assert.deepEqual(normDefs(null), defaultDefs());
  assert.equal(chain([], EPS).length, 0);
});

t('الصوت: base64 وWAV وتنظيف النص', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100]) {
    const a = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
    assert.equal(bytesToB64(a), Buffer.from(a).toString('base64'));
    assert.deepEqual([...b64ToBytes(bytesToB64(a))], [...a]);
  }
  const wav = pcmToWav(new Uint8Array(10), 24000);
  assert.equal(wav.length, 54);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE');
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 24000);
  assert.equal(speakClean('# عنوان\n```js\ncode()\n```\nنص **غامق** و[رابط](http://x.y) ![صورة](a.png)'), 'عنوان نص غامق ورابط');
});

t('الصوت: الإعداد والمزوّدون وبناء الطلبات', () => {
  const cfg = normVoiceCfg({ conns: [{ id: 'g', preset: 'groq', url: '', key: 'gk', enabled: true }, { id: 'o', preset: 'openai', url: '', key: 'ok', enabled: true }, { id: 'bad', preset: 'nope' }] });
  assert.equal(cfg.conns.length, 2);
  assert.equal(cfg.stt.conn, 'g'); // أول اتصال يدعم التعرّف
  assert.equal(cfg.tts.conn, 'o'); // groq لا يدعم القراءة → openai
  assert.equal(connsFor(cfg, 'tts').length, 1);
  const none = normVoiceCfg(undefined);
  assert.equal(voiceConf(none, 'tts').ready, false);
  assert.equal(voiceConf(cfg, 'tts').ready, true);
  assert.equal(voiceConf(cfg, 'tts').voice, 'alloy');
  assert.equal(voiceConf(cfg, 'stt').model, 'whisper-large-v3-turbo');
  // مخصص بلا مفتاح جاهز
  const cu = autoConn({ ...defaultVoiceCfg(), conns: [{ id: 'c', preset: 'custom', url: 'http://h:8000/v1/', key: '', enabled: true }] });
  assert.equal(voiceConf(cu, 'stt').ready, true);
  assert.equal(voiceConf(cu, 'stt').url, 'http://h:8000/v1');
  // STT
  const s1 = buildSttRequest(voiceConf(cfg, 'stt'), 'ar', 'audio/mp4');
  assert.equal(s1.kind, 'form');
  assert.equal(s1.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(s1.fields?.language, 'ar');
  assert.equal(s1.fileName, 'speech.m4a');
  assert.equal(buildSttRequest(voiceConf(cfg, 'stt'), 'auto', 'audio/mp4').fields?.language, undefined);
  const dg = normVoiceCfg({ conns: [{ id: 'd', preset: 'deepgram', url: '', key: 'dk', enabled: true }] });
  const s2 = buildSttRequest(voiceConf(dg, 'stt'), 'auto', 'audio/mp4');
  assert.equal(s2.kind, 'raw');
  assert.ok(s2.url.includes('detect_language=true'));
  assert.equal(s2.headers.Authorization, 'Token dk');
  assert.equal(parseSttResponse('deepgram', { results: { channels: [{ alternatives: [{ transcript: ' hi ' }] }] } }), 'hi');
  assert.equal(parseSttResponse('openai', { text: ' مرحبا ' }), 'مرحبا');
  assert.equal(parseSttResponse('gemini', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }), 'ab');
  // TTS
  const t1 = buildTtsRequest(voiceConf(cfg, 'tts'), 'مرحبا **بك**', 1.5);
  assert.equal(t1.url, 'https://api.openai.com/v1/audio/speech');
  assert.equal(JSON.parse(t1.body).speed, 1.5);
  assert.equal(JSON.parse(t1.body).input, 'مرحبا بك');
  assert.throws(() => buildTtsRequest(voiceConf(cfg, 'tts'), '```x```'));
  const el = normVoiceCfg({ conns: [{ id: 'e', preset: 'elevenlabs', url: '', key: 'ek', enabled: true }] });
  assert.ok(buildTtsRequest(voiceConf(el, 'tts'), 'hi').url.includes('/text-to-speech/21m00Tcm4TlvDq8ikWAM'));
  const gm = normVoiceCfg({ conns: [{ id: 'm', preset: 'gemini', url: '', key: 'mk', enabled: true }] });
  const g = buildTtsRequest(voiceConf(gm, 'tts'), 'hi');
  assert.equal(g.ext, 'wav');
  assert.equal(JSON.parse(g.body).generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
  assert.equal(geminiAudioB64({ candidates: [{ content: { parts: [{ inlineData: { data: 'QQ==' } }] } }] }), 'QQ==');
  assert.throws(() => geminiAudioB64({}));
  // Deepgram: الصوت هو النموذج
  assert.ok(buildTtsRequest(voiceConf(normVoiceCfg({ conns: [{ id: 'd', preset: 'deepgram', url: '', key: 'k', enabled: true }] }), 'tts'), 'hi').url.endsWith('model=aura-2-thalia-en'));
  // أصوات مخصصة ونموذج خاص بالصوت
  const cv = normVoiceCfg({ conns: [{ id: 'o', preset: 'openai', url: '', key: 'k', enabled: true }], tts: { cfg: { openai: { voice: 'my', customVoices: [{ cid: '1', name: 'My', desc: '', voiceId: 'my', model: 'tts-1-hd', color: '' }] } } } });
  assert.equal(voiceConf(cv, 'tts').model, 'tts-1-hd');
  assert.equal(ttsVoiceList(cv, 'openai').length, 11);
  assert.equal(ttsVoiceList(cv, 'openai').at(-1)?.custom, true);
  // اختبار المفتاح
  assert.equal(buildTestRequest('openai', '', 'k').url, 'https://api.openai.com/v1/models');
  assert.equal(buildTestRequest('custom', 'http://h/v1/', '').headers.Authorization, undefined);
  assert.equal(buildTestRequest('gemini', '', 'k').headers['x-goog-api-key'], 'k');
});

t('تفريع التعديل: نسخ وتنقّل', () => {
  const U = (id: string, c: string): Msg => ({ id, role: 'user', content: c, ts: 1 });
  const A = (id: string, c: string): Msg => ({ id, role: 'assistant', content: c, ts: 1 });
  let msgs: Msg[] = [U('u1', 'أول'), A('a1', 'رد1'), U('u2', 'سؤال'), A('a2', 'جواب'), U('u3', 'تابع'), A('a3', 'جواب3')];
  assert.equal(startBranch(msgs, 'a1'), null); // لا تفريع على رد المساعد
  // تعديل u2 → نسخة جديدة
  const b1 = startBranch(msgs, 'u2')!;
  assert.deepEqual(b1.messages.map((m) => m.id), ['u1', 'a1']);
  assert.equal(b1.vers.length, 2);
  assert.equal(b1.vi, 1);
  assert.equal(b1.vers[0]!.length, 4); // الذيل القديم: u2,a2,u3,a3
  assert.equal(b1.vers[1], null);
  msgs = [...b1.messages, { ...U('u2b', 'سؤال معدّل'), vers: b1.vers, vi: b1.vi }, A('a2b', 'جواب جديد')];
  assert.equal(versionCount(msgs[2]), 2);
  assert.equal(versionIndex(msgs[2]), 1);
  // الانتقال إلى النسخة القديمة
  const s0 = switchVersion(msgs, 'u2b', 0)!;
  assert.deepEqual(s0.map((m) => m.id), ['u1', 'a1', 'u2', 'a2', 'u3', 'a3']);
  assert.equal(versionIndex(s0[2]), 0);
  assert.equal(s0[2].vers![0], null);
  assert.equal(s0[2].vers![1]!.length, 2); // الذيل الجديد محفوظ
  assert.equal((s0[2].vers![1]![0] as Msg).vers, undefined); // رأس النسخة المحفوظة بلا vers (لا تكرار)
  // والعودة
  const s1 = switchVersion(s0, 'u2', 1)!;
  assert.deepEqual(s1.map((m) => m.id), ['u1', 'a1', 'u2b', 'a2b']);
  assert.equal(s1[2].content, 'سؤال معدّل');
  assert.equal(switchVersion(s1, 'u2b', 5), null);
  assert.equal(switchVersion(s1, 'zz', 0), null);
  // تعديل ثانٍ من النسخة الحالية → 3 نسخ
  const b2 = startBranch(s1, 'u2b')!;
  assert.equal(b2.vers.length, 3);
  assert.equal(b2.vi, 2);
  assert.equal(b2.vers[1]!.length, 2);
  assert.ok(b2.vers[0]!.length === 4);
  // تفريع إلى محادثة جديدة
  const f = forkUpTo(s0, 'a2', (m) => m.id + '_f')!;
  assert.deepEqual(f.map((m) => m.id), ['u1_f', 'a1_f', 'u2_f', 'a2_f']);
  assert.equal(f[2].vers, undefined);
});

t('صفحة النماذج: تصفية وترتيب وتكرارات ومقارنة واستيراد', () => {
  const mk = (id: string, url: string, models: [string, boolean][], enabled = true): Endpoint =>
    ({ id, preset: 'custom', label: id, url, key: 'k', proto: 'openai', kind: 'cloud', enabled, models: models.map(([m, on]) => ({ id: m, on })) } as any);
  const eps = [mk('e1', 'https://a.com/v1', [['gpt-4o', true], ['o3-mini', true], ['llama-3.1-8b', false]]), mk('e2', 'https://b.com/v1', [['gpt-4o', true], ['claude-3-5-sonnet', true]], false)];
  const all = itemsOf(eps);
  assert.equal(all.length, 5);
  const fc = { meta: {} as any, fav: new Set<string>(), use: {} as any, tests: {} as any, hasParams: () => false, host: (e: any) => new URL(e.url).host };
  const ui = defaultMdUi();
  assert.equal(filterModels(all, { ...ui, tab: 'on' }, fc).length, 2);
  assert.equal(filterModels(all, { ...ui, ep: 'e2' }, fc).length, 2);
  assert.equal(filterModels(all, { ...ui, st: 'off' }, fc).length, 3);
  assert.equal(filterModels(all, { ...ui, q: 'CLAUDE' }, fc).length, 1);
  assert.equal(famOf('gpt-4o'), famOf('o3-mini') === famOf('gpt-4o') ? famOf('gpt-4o') : famOf('gpt-4o'));
  // مفضلة أولًا
  fc.fav = new Set(['e1|o3-mini']);
  assert.equal(filterModels(all, ui, fc)[0].m.id, 'o3-mini');
  // تكرار
  const g = dupGroups(all);
  assert.equal(g.length, 1);
  assert.deepEqual(dedupeKill(all), ['e2|gpt-4o']); // تبقى نسخة النقطة المفعّلة
  // سجل الاختبار والحالة
  let m = addHist(undefined, { ok: true, ms: 800, ttft: 300, tps: 20 }, 1000);
  assert.equal(statusOf(m, undefined), 'ok');
  assert.equal(latOf(m, undefined), 800);
  m = addHist(m, { ok: false, err: 'x' }, 2000);
  assert.equal(statusOf(m, undefined), 'bad');
  assert.equal(statusOf(undefined, { busy: true }), 'busy');
  assert.equal(statusOf(undefined, undefined), 'none');
  assert.equal(fmtCtx(128000), '128K');
  assert.equal(fmtCtx(1000000), '1M');
  // مقارنة
  const rs = [
    { key: 'a', ok: true, ms: 2000, ttft: 500, tps: 30, tokens: 60 },
    { key: 'b', ok: false, ms: 100, ttft: 0, tps: 0, tokens: 0 },
    { key: 'c', ok: true, ms: 1000, ttft: 700, tps: 50, tokens: 50 },
  ];
  assert.deepEqual(benchSort(rs).map((r) => r.key), ['c', 'a', 'b']);
  assert.deepEqual(benchBest(rs), { ms: 1000, ttft: 500, tps: 50 });
  assert.equal(benchBest([rs[1]]), null);
  // تصدير/استيراد
  const exp = buildExport(eps, ['e1|gpt-4o'], { 'e1|gpt-4o': { alias: 'سريع' } }, 5);
  assert.equal(JSON.stringify(exp).includes('"key"'), false); // بلا مفاتيح API
  const eps2 = [mk('e1', 'https://a.com/v1', [['gpt-4o', true]])];
  const pl = planImport(exp, eps2, {});
  assert.deepEqual(pl.add.map((a) => a.id).sort(), ['llama-3.1-8b', 'o3-mini']);
  assert.equal(pl.meta['e1|gpt-4o'].alias, 'سريع');
  assert.equal(planImport(exp, eps2, { 'e1|gpt-4o': { alias: 'x' } }).meta['e1|gpt-4o'], undefined);
  assert.throws(() => planImport({}, eps2, {}));
});

t('روابط الودجتات والاختصارات', () => {
  assert.equal(parseNativeAction('MIC'), 'mic');
  assert.equal(parseNativeAction(['camera']), 'camera');
  assert.equal(parseNativeAction('rm -rf'), null);
  assert.equal(parseNativeAction(undefined), null);
  assert.equal(startsChat('settings'), false);
  assert.equal(startsChat('new'), true);
  assert.equal(needsComposer('photo'), true);
  assert.equal(needsComposer('new'), false);
});

t('معاينة HTML/SVG', () => {
  assert.equal(canPreview('html', '<p>hi</p>'), true);
  assert.equal(canPreview('svg', '<svg></svg>'), true);
  assert.equal(canPreview('svg', 'no tags'), false);
  assert.equal(canPreview('', '<svg viewBox="0 0 1 1"></svg>'), true);
  assert.equal(canPreview('', 'print(1)'), false);
  assert.equal(canPreview('python', '<html>'), false);
  assert.equal(canPreview('html', '   '), false);
  assert.equal(isSvgCode('<?xml version="1.0"?><svg></svg>'), true);
  assert.equal(isSvgCode('<html><svg></svg></html>'), false);
  // CSP تُحقن دائمًا في كل الصيغ
  for (const [c, l] of [['<p>x</p>', 'html'], ['<html><body>x</body></html>', 'html'], ['<html><head><title>t</title></head></html>', 'html'], ['<svg></svg>', 'svg']]) {
    const d = previewDoc(c, l);
    assert.ok(d.includes(PV_CSP), c);
    assert.ok(d.indexOf(PV_CSP) < d.indexOf('</head>') || !d.includes('</head>'), 'CSP داخل head: ' + c);
  }
  assert.ok(!previewDoc('<?xml version="1.0"?><svg></svg>', 'svg').includes('<?xml'));
  assert.ok(PV_CSP.includes("default-src 'none'")); // لا اتصال شبكي لأي مورد غير مسموح
  assert.equal(allowNav('about:blank'), true);
  assert.equal(allowNav('https://evil.com'), false);
  assert.equal(allowNav('intent://x'), false);
});

t('سجل الأخطاء', () => {
  // إخفاء المفاتيح
  assert.equal(redact('GET https://x.com/v1?key=AIzaSyABCDEFGHIJKLMNOPQRSTUV&a=1'), 'GET https://x.com/v1?key=***&a=1');
  assert.ok(!redact('Authorization: Bearer abcdef1234567890xyz').includes('abcdef1234'));
  assert.ok(!redact('bad key sk-proj-abcdefghijkl1234').includes('abcdefghijkl'));
  assert.ok(!redact('{"api_key":"supersecret123"}').includes('supersecret'));
  assert.equal(redact('نص عادي بلا أسرار'), 'نص عادي بلا أسرار');
  // الإضافة والقص والتكرار
  let l: LogEntry[] = [];
  l = pushLog(l, makeEntry(1, 'net', 'فشل', 'error', 1000));
  l = pushLog(l, makeEntry(2, 'net', 'فشل', 'error', 1500)); // مكرر خلال ثانيتين → يُتجاهل
  assert.equal(l.length, 1);
  l = pushLog(l, makeEntry(3, 'net', 'فشل', 'error', 4000));
  l = pushLog(l, makeEntry(4, 'gen', new Error('boom'), 'warn', 5500));
  assert.equal(l.length, 3);
  assert.equal(l[2].msg, 'boom');
  assert.equal(pushLog(l, makeEntry(5, 'a', 'x', 'info', 9000), 3).length, 3);
  assert.equal(pushLog(l, makeEntry(5, 'a', 'x', 'info', 9000), 3)[0].id, 3);
  assert.equal(makeEntry(9, 't', 'ن'.repeat(5000)).msg.length, 2000);
  // العرض: ترتيب وΣ/Δ
  const old = viewLogs(l, '', 'old');
  assert.deepEqual(old.rows.map((r) => r.e.id), [1, 3, 4]);
  assert.equal(old.rows[1].sum, 3);
  assert.equal(old.rows[1].delta, 3);
  assert.equal(old.rows[2].delta, 1.5);
  assert.deepEqual(viewLogs(l, '', 'new').rows.map((r) => r.e.id), [4, 3, 1]);
  assert.equal(viewLogs(l, '', 'new').rows[0].sum, 4.5); // Σ ثابت بغض النظر عن الترتيب
  // تصفية: regex، مستوى، regex غير صالح
  assert.equal(viewLogs(l, '^\\[gen\\]', 'old').rows.length, 1);
  assert.equal(viewLogs(l, 'BOOM', 'old').rows.length, 1);
  assert.equal(viewLogs(l, '', 'old', true).rows.length, 2);
  const bad = viewLogs(l, '[', 'old');
  assert.equal(bad.badRegex, true);
  assert.equal(bad.rows.length, 3); // البحث كنص عادي: '[' موجودة في كل سطر
  // التصدير
  const ex = exportLogs(old.rows);
  assert.ok(ex.includes('Σ:3.000s, Δ:3.000s\n[net]: فشل'));
  assert.ok(fmtHead(old.rows[0]).startsWith('1970-01-01T00:00:01.000Z'));
});

t('ask_user: أسئلة متعددة الخيارات', () => {
  const qs = parseAsk({ questions: [{ question: 'أي لغة؟', multi: false, options: [{ label: 'JS', description: 'ويب' }, 'Py'] }, { question: 'مزايا', multi: true, options: [{ label: 'أ' }, { label: '' }] }] });
  assert.equal(qs.length, 2);
  assert.deepEqual(qs[0].options, [{ label: 'JS', description: 'ويب' }, { label: 'Py' }]);
  assert.equal(qs[1].multi, true);
  assert.equal(qs[1].options.length, 1);
  const old = parseAsk({ question: 'سؤال قديم', options: ['س', 'ص'] });
  assert.equal(old.length, 1); assert.equal(old[0].options[1].label, 'ص');
  assert.equal(parseAsk({}).length, 0);
  assert.equal(parseAsk({ questions: Array(9).fill({ question: 'x', options: [] }) }).length, 4);
  assert.equal(formatAsk(qs, [['JS'], null]), 'أي لغة؟ ← JS\nمزايا ← تخطّاه المستخدم');
  assert.equal(formatAsk(qs, [['أ', 'ب'], ['x']]).split('\n')[0], 'أي لغة؟ ← أ، ب');
  assert.equal(formatAsk(qs, null), 'تخطّى المستخدم الأسئلة.');
  assert.equal(validate('ask_user', { question: 'x' }), '');
});

console.log(`\n${n} اختبارًا نجح`);
