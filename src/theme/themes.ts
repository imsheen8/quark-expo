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
}

export const THEMES: ThemeDef[] = [
  { id: 'default', mode: 'dark', name: 'الافتراضي' },
  { id: 'midnight', mode: 'dark', name: 'منتصف الليل', bg: '#0f1420', surface: '#172033', text: '#e6ecf7', accent: '#5b8def' },
  { id: 'forest', mode: 'dark', name: 'غابة', bg: '#0f1a14', surface: '#16251c', text: '#e4efe7', accent: '#4f9d69' },
  { id: 'violet', mode: 'dark', name: 'بنفسجي', bg: '#17121f', surface: '#211a2e', text: '#ece6f5', accent: '#b66dd6' },
  { id: 'amber', mode: 'dark', name: 'عنبر', bg: '#1a1510', surface: '#261e16', text: '#f0e6d8', accent: '#d4a017' },
  { id: 'oled', mode: 'dark', name: 'أسود نقي', bg: '#000000', surface: '#0e0e0e', text: '#eaeaea', accent: '#e07a5f' },
  { id: 'default', mode: 'light', name: 'الافتراضي' },
  { id: 'snow', mode: 'light', name: 'ثلجي', bg: '#f5f8fc', surface: '#ffffff', text: '#17202e', accent: '#2f6fed' },
  { id: 'mint', mode: 'light', name: 'نعناع', bg: '#f1f8f4', surface: '#ffffff', text: '#15251c', accent: '#2f9e5a' },
  { id: 'rose', mode: 'light', name: 'وردي', bg: '#fbf3f6', surface: '#ffffff', text: '#2a1a21', accent: '#d6457a' },
  { id: 'paper', mode: 'light', name: 'ورقي', bg: '#f6efe0', surface: '#fffaf0', text: '#2d2415', accent: '#b7791f' },
  { id: 'white', mode: 'light', name: 'أبيض نقي', bg: '#ffffff', surface: '#f4f4f5', text: '#111111', accent: '#d97757' },
];

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
