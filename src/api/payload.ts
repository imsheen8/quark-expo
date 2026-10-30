import type { Endpoint, Params, ThinkingMode, ToolSpec, WireMsg } from './types';

export interface BuildArgs {
  ep: Endpoint;
  model: string;
  messages: WireMsg[];
  system: string;
  params: Params;
  stream: boolean;
  thinking?: ThinkingMode;
  /** أدوات للاستدعاء الأصلي (OpenAI-compatible وAnthropic فقط) */
  tools?: ToolSpec[];
  /** حقول رفضها المزوّد سابقًا — تُحذف عند إعادة المحاولة */
  drop?: Set<string>;
}

export interface Built {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

const trimSlash = (u: string) => u.replace(/\/+$/, '');
const dataUrl = (i: { mime: string; data: string }) => `data:${i.mime};base64,${i.data}`;

/** نماذج لا تقبل temperature / top_p */
const NO_SAMPLING = /(^|[\/\-_:])(o\d|gpt-5)([\/\-_:.]|$)/i;
const NO_SAMPLING_ANTHROPIC = /opus-4[-.]?([7-9])|opus-([5-9])/i;

export function buildRequest(a: BuildArgs): Built {
  const { ep, model, system, params: P, stream } = a;
  const drop = a.drop ?? new Set<string>();
  const base = trimSlash(ep.url);
  const use = (k: string) => !drop.has(k);

  if (ep.proto === 'anthropic') {
    const messages = a.messages.map((m) => {
      if (m.toolResults?.length) {
        return { role: 'user', content: m.toolResults.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content || ' ', ...(r.ok ? {} : { is_error: true }) })) };
      }
      if (m.toolCalls?.length) {
        return { role: 'assistant', content: [...(m.content.trim() ? [{ type: 'text', text: m.content }] : []), ...m.toolCalls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args }))] };
      }
      return {
      role: m.role,
      content: m.images?.length
        ? [
            ...m.images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } })),
            { type: 'text', text: m.content || ' ' },
          ]
        : m.content || ' ',
      };
    });
    const body: Record<string, any> = { model, max_tokens: P.max_tokens ?? 4096, stream, messages };
    if (system) body.system = system;
    if (a.tools?.length) body.tools = a.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    if (!NO_SAMPLING_ANTHROPIC.test(model)) {
      if (P.temperature != null && use('temperature')) body.temperature = Math.min(P.temperature, 1);
      else if (P.top_p != null && use('top_p')) body.top_p = P.top_p;
    }
    return {
      url: base + '/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': ep.key, 'anthropic-version': '2023-06-01' },
      body,
    };
  }

  if (ep.proto === 'gemini') {
    const path = /^(models|tunedModels)\//.test(model) ? model : 'models/' + model;
    const msgs = a.messages[0]?.role === 'assistant' ? [{ role: 'user', content: '.' } as WireMsg, ...a.messages] : a.messages;
    const body: Record<string, any> = {
      contents: msgs.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          ...(m.content ? [{ text: m.content }] : [{ text: ' ' }]),
          ...(m.images || []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } })),
        ],
      })),
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const gen: Record<string, any> = {};
    if (P.temperature != null && use('temperature')) gen.temperature = P.temperature;
    if (P.top_p != null && use('top_p')) gen.topP = P.top_p;
    if (P.max_tokens) gen.maxOutputTokens = Math.round(P.max_tokens);
    if (a.thinking === 'on' && use('thinking')) gen.thinkingConfig = { includeThoughts: true };
    else if (a.thinking === 'off' && use('thinking')) gen.thinkingConfig = { thinkingBudget: 0 };
    if (Object.keys(gen).length) body.generationConfig = gen;
    return {
      url: `${base}/${path}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': ep.key },
      body,
    };
  }

  if (ep.proto === 'ollama') {
    const messages: any[] = [];
    if (system) messages.push({ role: 'system', content: system });
    for (const m of a.messages) {
      messages.push({ role: m.role, content: m.content, ...(m.images?.length ? { images: m.images.map((i) => i.data) } : {}) });
    }
    const options: Record<string, any> = {};
    if (P.temperature != null) options.temperature = P.temperature;
    if (P.top_p != null) options.top_p = P.top_p;
    if (P.max_tokens) options.num_predict = Math.round(P.max_tokens);
    const body: Record<string, any> = { model, messages, stream };
    if (Object.keys(options).length) body.options = options;
    if (a.thinking === 'on') body.think = true;
    else if (a.thinking === 'off') body.think = false;
    return { url: base + '/api/chat', headers: { 'content-type': 'application/json' }, body };
  }

  // OpenAI-compatible
  const messages: any[] = [];
  if (system) messages.push({ role: 'system', content: system });
  for (const m of a.messages) {
    if (m.toolResults?.length) {
      for (const r of m.toolResults) messages.push({ role: 'tool', tool_call_id: r.id, content: r.content || ' ' });
      continue;
    }
    if (m.toolCalls?.length) {
      messages.push({ role: 'assistant', content: m.content || '', tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) });
      continue;
    }
    if (m.images?.length) {
      messages.push({
        role: m.role,
        content: [
          { type: 'text', text: m.content || ' ' },
          ...m.images.map((i) => ({ type: 'image_url', image_url: { url: dataUrl(i) } })),
        ],
      });
    } else messages.push({ role: m.role, content: m.content });
  }
  const body: Record<string, any> = { model, messages, stream };
  if (a.tools?.length) body.tools = a.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  if (stream && use('stream_options')) body.stream_options = { include_usage: true };
  if (!NO_SAMPLING.test(model)) {
    if (P.temperature != null && use('temperature')) body.temperature = P.temperature;
    if (P.top_p != null && use('top_p')) body.top_p = P.top_p;
  }
  if (P.max_tokens != null) {
    const key = /api\.openai\.com/.test(base) ? 'max_completion_tokens' : 'max_tokens';
    if (use(key)) body[key] = Math.round(P.max_tokens);
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ep.key) headers.authorization = 'Bearer ' + ep.key;
  if (/openrouter\.ai/.test(base)) {
    headers['X-Title'] = 'QUARK AI';
    headers['HTTP-Referer'] = 'https://quark.ai';
  }
  return { url: base + '/chat/completions', headers, body };
}

/** يستخرج اسم الحقل الذي رفضه المزوّد من نص الخطأ ليُحذف عند إعادة المحاولة */
export function rejectedField(err: string): string | null {
  const e = err.toLowerCase();
  if (!/unsupported|not supported|unknown|invalid|unrecognized|deprecated|does not support|not allowed|extra inputs/.test(e)) return null;
  if (e.includes('stream_options')) return 'stream_options';
  if (e.includes('max_completion_tokens')) return 'max_completion_tokens';
  if (e.includes('max_tokens')) return 'max_tokens';
  if (e.includes('top_p')) return 'top_p';
  if (e.includes('temperature')) return 'temperature';
  if (e.includes('thinking')) return 'thinking';
  return null;
}

export function modelsRequest(ep: Endpoint): { url: string; headers: Record<string, string> } {
  const base = trimSlash(ep.url);
  if (ep.proto === 'anthropic') {
    return { url: base + '/models?limit=1000', headers: { 'x-api-key': ep.key, 'anthropic-version': '2023-06-01' } };
  }
  if (ep.proto === 'gemini') return { url: base + '/models?pageSize=1000', headers: { 'x-goog-api-key': ep.key } };
  if (ep.proto === 'ollama') return { url: base + '/api/tags', headers: {} };
  return { url: base + '/models', headers: ep.key ? { authorization: 'Bearer ' + ep.key } : {} };
}
