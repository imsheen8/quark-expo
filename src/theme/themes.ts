import { alpha, mixHex } from '../lib/util';

export type Mode = 'light' | 'dark';

export interface Colors {
  mode: Mode;
  bg: string; sidebar: string; surface: string; surface2: string; surface3: string;
  text: string; text2: string; muted: string; border: string; bubble: string;
  accent: string; accentSoft: string; onAccent: string; danger: string; dangerSoft: string; ok: string;
  codeBg: string; codeHead: string; codeBorder: string; codeFg: string; codeMute: string;
  tkC: string; tkS: string; tkN: string; tkK: string;
  overlay: string;
}

export interface ThemeDef {
  id: string;
  mode: Mode;
  name: string;
  bg?: string; surface?: string; text?: string; accent?: string;
  /** تجاوزات دقيقة تُطبَّق فوق الألوان المشتقة (مثل ثيم GPT) */
  over?: Partial<Colors>;
}

export const THEMES: ThemeDef[] = [
  { id: 'default', mode: 'dark', name: 'الافتراضي' },
  // ثيم GPT — ألوان مطابقة لثيم «gpt» في تطبيق Odysseus
  {
    id: 'gpt', mode: 'dark', name: 'GPT',
    bg: '#212121', surface: '#2f2f2f', text: '#ececec', accent: '#949494',
    over: {
      sidebar: '#171717', surface2: '#2f2f2f', surface3: '#424242', border: '#424242', bubble: '#2f2f2f',
      text2: '#c5c5c5', muted: '#8e8e8e', accentSoft: 'rgba(148,148,148,0.18)', onAccent: '#171717',
      codeBg: '#171717', codeHead: '#2f2f2f', codeBorder: '#424242',
    },
  },
  // ثيم Claude — ألوان مطابقة لثيم «claude» في تطبيق Odysseus
  {
    id: 'claude', mode: 'dark', name: 'Claude',
    bg: '#1f1e1b', surface: '#2b2926', text: '#f5f1e8', accent: '#d97757',
    over: {
      sidebar: '#181715', border: '#514b43', surface2: '#35322e', surface3: '#47433d', bubble: '#2b2926',
      text2: '#cfc9bb', muted: '#968f80', accentSoft: 'rgba(217,119,87,0.16)', onAccent: '#ffffff',
      codeBg: '#171614', codeHead: '#2b2926', codeBorder: '#3d3933',
    },
  },
  { id: 'default', mode: 'light', name: 'الافتراضي' },
  // نسخ فاتحة صُمّمت هنا (Odysseus ليس فيه نسخ فاتحة منهما)
  {
    id: 'gpt', mode: 'light', name: 'GPT',
    bg: '#ffffff', surface: '#f4f4f4', text: '#0d0d0d', accent: '#5d5d5d',
    over: {
      sidebar: '#f9f9f9', surface2: '#ececec', surface3: '#e0e0e0', border: '#e5e5e5', bubble: '#f4f4f4',
      text2: '#424242', muted: '#8e8e8e', accentSoft: 'rgba(93,93,93,0.12)', onAccent: '#ffffff',
      codeBg: '#f9f9f9', codeHead: '#ececec', codeBorder: '#e0e0e0', codeFg: '#0d0d0d',
    },
  },
  {
    id: 'claude', mode: 'light', name: 'Claude',
    bg: '#f5f1e8', surface: '#fffdf8', text: '#1f1e1b', accent: '#d97757',
    over: {
      sidebar: '#ece6d8', surface2: '#ebe5d6', surface3: '#ddd5c4', border: '#ddd5c4', bubble: '#ebe5d6',
      text2: '#55524b', muted: '#8a867b', accentSoft: 'rgba(217,119,87,0.14)', onAccent: '#ffffff',
      codeBg: '#ece6d8', codeHead: '#e2dac8', codeBorder: '#d6cdb9', codeFg: '#1f1e1b',
    },
  },
];

/** معرّف ثيم صالح للوضع، وإلا «الافتراضي» (يعالج اختيارًا محفوظًا لثيم محذوف) */
export function validThemeId(mode: Mode, id?: string): string {
  return THEMES.some((t) => t.mode === mode && t.id === id) ? (id as string) : 'default';
}

const LIGHT: Colors = {
  mode: 'light', bg: '#faf9f5', sidebar: '#f3f1ea', surface: '#ffffff', surface2: '#ece9df', surface3: '#dfdbcd',
  text: '#1f1e1c', text2: '#55524b', muted: '#8a867b', border: '#e2dfd4', bubble: '#ece9df',
  accent: '#d97757', accentSoft: 'rgba(217,119,87,0.14)', onAccent: '#ffffff', danger: '#e5484d', dangerSoft: 'rgba(229,72,77,0.12)', ok: '#2f9e5a',
  codeBg: '#f1efe7', codeHead: '#e7e4d9', codeBorder: '#dcd8ca', codeFg: '#1f1e1c', codeMute: '#8f8b80',
  tkC: '#6b7585', tkS: '#2f7d32', tkN: '#c25b12', tkK: '#8a3fc2', overlay: 'rgba(0,0,0,0.4)',
};

const DARK: Colors = {
  mode: 'dark', bg: '#161616', sidebar: '#101010', surface: '#1c1c1c', surface2: '#2a2a2a', surface3: '#363636',
  text: '#ececec', text2: '#bdbdbd', muted: '#8b8b8b', border: '#2c2c2c', bubble: '#2b2b2b',
  accent: '#e07a5f', accentSoft: 'rgba(224,122,95,0.16)', onAccent: '#ffffff', danger: '#e5484d', dangerSoft: 'rgba(229,72,77,0.16)', ok: '#2f9e5a',
  codeBg: '#0e0e0e', codeHead: '#171717', codeBorder: '#262626', codeFg: '#e4e4e4', codeMute: '#8d8d8d',
  tkC: '#6f7a8c', tkS: '#a5e075', tkN: '#f8a56b', tkK: '#e0a0ff', overlay: 'rgba(0,0,0,0.6)',
};

export function buildColors(mode: Mode, def?: ThemeDef): Colors {
  const base = mode === 'dark' ? DARK : LIGHT;
  if (!def || !def.bg || !def.surface || !def.text || !def.accent) return base;
  const { bg, surface, text, accent } = def;
  const dark = mode === 'dark';
  return {
    ...base,
    bg,
    surface,
    text,
    accent,
    accentSoft: alpha(accent, 0.15),
    sidebar: mixHex(bg, dark ? '#000000' : '#000000', dark ? 0.35 : 0.04),
    surface2: mixHex(surface, text, 0.08),
    surface3: mixHex(surface, text, 0.16),
    text2: mixHex(text, bg, 0.3),
    muted: mixHex(text, bg, 0.55),
    border: mixHex(bg, text, 0.12),
    bubble: mixHex(surface, text, 0.08),
    ...(def.over ?? {}),
  };
}

export const FONT = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  serif: 'Amiri_400Regular',
  mono: 'Courier',
};

export const FONT_SCALE = { sm: 0.9, md: 1, lg: 1.15 } as const;
