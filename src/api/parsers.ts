import type { Chunk, Proto } from './types';

/** يقسّم النص المتدفّق إلى أسطر كاملة ويحتفظ بالباقي. */
export class LineBuffer {
  private buf = '';
  push(s: string): string[] {
    this.buf += s;
    const lines = this.buf.split('\n');
    this.buf = lines.pop() ?? '';
    return lines;
  }
  flush(): string[] {
    const r = this.buf ? [this.buf] : [];
    this.buf = '';
    return r;
  }
}

/** سطر SSE → حمولة data أو null */
export function sseData(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith('data:')) return null;
  return t.slice(5).trim();
}

export function splitThink(s: string): { think: string; ans: string } {
  const th: string[] = [];
  let out = '';
  let i = 0;
  for (;;) {
    const a = s.indexOf('<think>', i);
    if (a < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, a);
    const b = s.indexOf('</think>', a + 7);
    if (b < 0) {
      th.push(s.slice(a + 7));
      break;
    }
    th.push(s.slice(a + 7, b));
    i = b + 8;
  }
  // وسم <think> مبتور في آخر النص أثناء البث
  const m = /<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/.exec(out);
  if (m) out = out.slice(0, m.index);
  return { think: th.join('\n\n').trim(), ans: out.replace(/^\s+/, '') };
}

const num = (x: unknown): number | undefined => (typeof x === 'number' && isFinite(x) ? x : undefined);

/** يحوّل حدثًا واحدًا (JSON) من أي صيغة إلى شرائح موحّدة. يرمي خطأً إن كان الحدث خطأ من المزوّد. */
export function parseEvent(proto: Proto, j: any): Chunk[] {
  const out: Chunk[] = [];
  if (!j || typeof j !== 'object') return out;

  if (j.error && proto !== 'anthropic') {
    const m = typeof j.error === 'string' ? j.error : j.error.message || JSON.stringify(j.error);
    throw new Error(m || 'خطأ من المزوّد');
  }

  if (proto === 'openai') {
    const d = j.choices?.[0]?.delta;
    const rs = d?.reasoning_content ?? d?.reasoning;
    if (typeof rs === 'string' && rs) out.push({ kind: 'think', text: rs });
    if (typeof d?.content === 'string' && d.content) out.push({ kind: 'text', text: d.content });
    if (Array.isArray(d?.tool_calls)) {
      for (const tc of d.tool_calls) {
        if (!tc || typeof tc !== 'object') continue;
        out.push({ kind: 'tool', index: typeof tc.index === 'number' ? tc.index : 0, id: tc.id || undefined, name: tc.function?.name || undefined, args: typeof tc.function?.arguments === 'string' ? tc.function.arguments : undefined });
      }
    }
    if (j.usage) {
      out.push({
        kind: 'usage',
        usage: {
          in: num(j.usage.prompt_tokens),
          out: num(j.usage.completion_tokens),
          think: num(j.usage.completion_tokens_details?.reasoning_tokens),
        },
      });
    }
  } else if (proto === 'anthropic') {
    if (j.type === 'error') throw new Error(j.error?.message || 'خطأ من الخادم');
    if (j.type === 'message_start' && j.message?.usage) {
      out.push({ kind: 'usage', usage: { in: num(j.message.usage.input_tokens), out: num(j.message.usage.output_tokens) } });
    } else if (j.type === 'content_block_start' && j.content_block?.type === 'tool_use') {
      out.push({ kind: 'tool', index: typeof j.index === 'number' ? j.index : 0, id: j.content_block.id, name: j.content_block.name });
    } else if (j.type === 'content_block_delta') {
      if (j.delta?.type === 'input_json_delta') out.push({ kind: 'tool', index: typeof j.index === 'number' ? j.index : 0, args: String(j.delta.partial_json ?? '') });
      else if (j.delta?.type === 'thinking_delta' || j.delta?.thinking) out.push({ kind: 'think', text: j.delta.thinking });
      else if (j.delta?.text) out.push({ kind: 'text', text: j.delta.text });
    } else if (j.type === 'message_delta' && j.usage) {
      out.push({ kind: 'usage', usage: { out: num(j.usage.output_tokens), in: num(j.usage.input_tokens) } });
    }
  } else if (proto === 'gemini') {
    if (j.promptFeedback?.blockReason) throw new Error('حجب Gemini الطلب: ' + j.promptFeedback.blockReason);
    const parts = j.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (!p || typeof p.text !== 'string' || !p.text) continue;
        out.push({ kind: p.thought === true ? 'think' : 'text', text: p.text });
      }
    }
    const fr = j.candidates?.[0]?.finishReason;
    if (fr === 'SAFETY' || fr === 'PROHIBITED_CONTENT') throw new Error('أوقف Gemini الرد لأسباب تتعلق بالسلامة.');
    if (j.usageMetadata) {
      out.push({
        kind: 'usage',
        usage: {
          in: num(j.usageMetadata.promptTokenCount),
          out: num(j.usageMetadata.candidatesTokenCount),
          think: num(j.usageMetadata.thoughtsTokenCount),
        },
      });
    }
  } else if (proto === 'ollama') {
    const m = j.message;
    if (typeof m?.thinking === 'string' && m.thinking) out.push({ kind: 'think', text: m.thinking });
    if (typeof m?.content === 'string' && m.content) out.push({ kind: 'text', text: m.content });
    if (j.done) out.push({ kind: 'usage', usage: { in: num(j.prompt_eval_count), out: num(j.eval_count) } });
  }
  return out;
}

/** نص الرد الكامل من استجابة غير متدفّقة */
export function parseFull(proto: Proto, j: any): string {
  if (!j) return '';
  if (proto === 'openai') {
    const c = j.choices?.[0]?.message?.content;
    return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x: any) => x?.text || '').join('') : '';
  }
  if (proto === 'anthropic') return (j.content || []).map((b: any) => b?.text || '').join('');
  if (proto === 'gemini') {
    return (j.candidates?.[0]?.content?.parts || []).filter((p: any) => p && !p.thought).map((p: any) => p.text || '').join('');
  }
  if (proto === 'ollama') return j.message?.content || '';
  return '';
}

/** يدمج تحديثات الاستهلاك الجزئية */
export function mergeUsage<T extends Record<string, any>>(acc: T, u: Partial<T>): T {
  const r: any = { ...acc };
  for (const k of Object.keys(u)) if (typeof (u as any)[k] === 'number') r[k] = (u as any)[k];
  return r;
}

/** استخراج معرّفات النماذج من ردّ قائمة النماذج */
export function parseModelList(proto: Proto, j: any): string[] {
  let ids: string[] = [];
  if (proto === 'openai' || proto === 'anthropic') {
    ids = (j?.data || j?.models || []).map((m: any) => (typeof m === 'string' ? m : m?.id)).filter(Boolean);
  } else if (proto === 'gemini') {
    ids = (j?.models || [])
      .filter((m: any) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter(Boolean);
  } else if (proto === 'ollama') {
    ids = (j?.models || []).map((m: any) => m?.name || m?.model).filter(Boolean);
  }
  // إخفاء ما ليس نماذج محادثة (تضمين/صوت/إشراف)
  const skip = /(embed|embedding|whisper|tts|moderation|rerank|dall-e|image-|imagen|transcribe|speech|audio-preview|realtime)/i;
  return Array.from(new Set(ids.filter((id) => !skip.test(id)))).sort((a, b) => a.localeCompare(b));
}
