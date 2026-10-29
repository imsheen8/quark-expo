export type Proto = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'llama';

export interface ModelEntry {
  id: string;
  on: boolean;
  /** هل النموذج يولّد صورًا؟ (غير مستخدم حاليًا في الواجهة) */
  img?: boolean;
}

export interface Endpoint {
  id: string;
  preset: string;
  label: string;
  url: string;
  key: string;
  proto: Proto;
  kind: 'api' | 'local';
  enabled: boolean;
  models: ModelEntry[];
}

export type ThinkingMode = 'auto' | 'on' | 'off';

export interface Params {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

export interface ImageRef {
  id: string;
  mime: string;
  /** مسار الملف المحلي */
  uri: string;
}

export interface FileRef {
  name: string;
  text: string;
}

export interface Usage {
  in: number;
  out: number;
  think?: number;
  /** true إن كانت الأرقام تقديرية وليست من المزوّد */
  est?: boolean;
}

export interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  model?: string;
  thinking?: string;
  thinkSecs?: number;
  error?: boolean;
  imgs?: ImageRef[];
  files?: FileRef[];
  usage?: Usage;
  /** رد البحث العميق: معرّف البحث الذي تعرضه البطاقة في المحادثة */
  researchId?: string;
  /** مصادر الويب المستخدمة في الرد */
  sources?: { n: number; title: string; url: string; host: string }[];
  /** أسماء المهارات المستخدمة في الرد */
  skills?: string[];
  /** نسخ التعديل (على رسائل المستخدم): الذيل من هذه الرسالة لكل نسخة. خانة النسخة الحالية null */
  vers?: (Msg[] | null)[];
  /** رقم النسخة الحالية */
  vi?: number;
  /** خطوات الوكيل */
  steps?: AgentStep[];
  /** رد النموذج الثاني في وضع المقارنة */
  alt?: { model: string; content: string; thinking?: string; usage?: Usage; error?: boolean };
  /** رد من مهمة مجدولة */
  task?: string;
}

export interface AgentStep {
  id: string;
  tool: string;
  args: Record<string, any>;
  status: 'run' | 'ok' | 'error' | 'denied';
  result?: string;
  ts: number;
}

export interface Chat {
  id: string;
  title: string;
  autoTitle: boolean;
  created: number;
  updated: number;
  messages: Msg[];
  /** مفضلة */
  pinned?: boolean;
  tags?: string[];
  /** محادثة خفية: لا تُحفظ */
  temp?: boolean;
  params?: Params;
}

/** رسالة بصيغة جاهزة للإرسال للمزوّد */
export interface WireMsg {
  role: 'user' | 'assistant';
  content: string;
  images?: { mime: string; data: string }[];
}

export type Chunk =
  | { kind: 'text'; text: string }
  | { kind: 'think'; text: string }
  | { kind: 'usage'; usage: Partial<Usage> };

export interface LibItem {
  id: string;
  kind: 'persona' | 'template';
  name: string;
  text: string;
  fav?: boolean;
  tags?: string[];
  ts: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  when: string;
  body: string;
  tags: string[];
  status: 'published' | 'draft' | 'off';
  source: 'manual' | 'builtin' | 'import' | 'extracted';
  sourceUrl: string;
  uses: number;
  lastUsed: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  text: string;
  cat: 'fact' | 'identity' | 'preference' | 'contact' | 'project' | 'goal' | 'task';
  pinned: boolean;
  uses: number;
  lastUsed: number;
  source: 'manual' | 'auto';
  createdAt: number;
  updatedAt: number;
}

export interface UsageRecord {
  ts: number;
  model: string;
  ep: string;
  in: number;
  out: number;
  think: number;
  est: boolean;
}
