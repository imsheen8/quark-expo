import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../store/settings';
import { buildColors, FONT_SCALE, THEMES, type Colors, type Mode } from './themes';

export function useMode(): Mode {
  const sys = useColorScheme();
  const t = useSettings((s) => s.theme);
  return t === 'auto' ? (sys === 'light' ? 'light' : 'dark') : t;
}

export function useColors(): Colors {
  const mode = useMode();
  const id = useSettings((s) => s.themeSel[mode]);
  return useMemo(() => buildColors(mode, THEMES.find((t) => t.mode === mode && t.id === id)), [mode, id]);
}

export function useScale(): number {
  return FONT_SCALE[useSettings((s) => s.fontSize)];
}
