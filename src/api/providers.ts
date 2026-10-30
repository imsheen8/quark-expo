import type { Proto } from './types';

export interface Preset {
  label: string;
  url: string;
  proto: Proto;
  kind: 'api' | 'local';
  help: string;
  link?: string;
}

/** نقاط الاتصال الجاهزة (مطابقة لما في النسخة الأصلية). على الهاتف لا توجد قيود CORS. */
export const PRESETS: Record<string, Preset> = {
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', proto: 'openai', kind: 'api', help: 'احصل على مفتاح من', link: 'https://openrouter.ai/keys' },
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic', url: 'https://api.anthropic.com/v1', proto: 'anthropic', kind: 'api', help: 'مفتاح من', link: 'https://console.anthropic.com' },
  gemini: { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta', proto: 'gemini', kind: 'api', help: 'الصيغة الأصلية لـ Gemini (تفكير + صور). مفتاح من', link: 'https://aistudio.google.com/apikey' },
  gemini_openai: { label: 'Gemini (متوافق مع OpenAI)', url: 'https://generativelanguage.googleapis.com/v1beta/openai', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://aistudio.google.com/apikey' },
  deepseek: { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://platform.deepseek.com' },
  groq: { label: 'Groq', url: 'https://api.groq.com/openai/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://console.groq.com/keys' },
  mistral: { label: 'Mistral', url: 'https://api.mistral.ai/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://console.mistral.ai/api-keys' },
  xai: { label: 'xAI (Grok)', url: 'https://api.x.ai/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://console.x.ai' },
  together: { label: 'Together', url: 'https://api.together.xyz/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://api.together.ai/settings/api-keys' },
  fireworks: { label: 'Fireworks', url: 'https://api.fireworks.ai/inference/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://fireworks.ai/account/api-keys' },
  cerebras: { label: 'Cerebras', url: 'https://api.cerebras.ai/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://cloud.cerebras.ai' },
  nvidia: { label: 'NVIDIA NIM', url: 'https://integrate.api.nvidia.com/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://build.nvidia.com' },
  moonshot: { label: 'Moonshot (Kimi)', url: 'https://api.moonshot.ai/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://platform.moonshot.ai' },
  siliconflow: { label: 'SiliconFlow', url: 'https://api.siliconflow.com/v1', proto: 'openai', kind: 'api', help: 'مفتاح من', link: 'https://cloud.siliconflow.com' },
  ollama: { label: 'Ollama', url: 'http://localhost:11434', proto: 'ollama', kind: 'local', help: 'لا يحتاج مفتاحًا. استبدل localhost بعنوان الجهاز الذي يشغّل Ollama على شبكتك (مثل http://192.168.1.5:11434) وشغّله مع OLLAMA_HOST=0.0.0.0.' },
  ollama_openai: { label: 'Ollama (متوافق مع OpenAI)', url: 'http://localhost:11434/v1', proto: 'openai', kind: 'local', help: 'لا يحتاج مفتاحًا. استبدل localhost بعنوان الجهاز على شبكتك.' },
  lmstudio: { label: 'LM Studio', url: 'http://localhost:1234/v1', proto: 'openai', kind: 'local', help: 'لا يحتاج مفتاحًا. شغّل الخادم المحلي واستبدل localhost بعنوان جهازك على الشبكة.' },
  custom: { label: 'مخصص', url: '', proto: 'openai', kind: 'api', help: 'أي خدمة متوافقة مع OpenAI أو Anthropic — اكتب العنوان الأساسي مع /v1.' },
};

export const PROTO_LABEL: Record<Proto, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  ollama: 'Ollama',
  llama: 'على الجهاز',
};

export const DEFAULT_SYSTEM = 'أنت مساعد ذكي ودود. أجب بنفس لغة المستخدم بوضوح وإيجاز، واستخدم التنسيق عند الحاجة.';

export const hostOf = (u: string): string => {
  try {
    return new URL(u).host;
  } catch {
    return u || '—';
  }
};
