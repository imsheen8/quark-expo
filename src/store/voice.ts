import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { autoConn, defaultVoiceCfg, normVoiceCfg, type CustomVoice, type Preset, type VoiceConn, type VoiceCfg } from '../api/voiceCore';
import { uid } from '../lib/util';
import { persistStorage } from './storage';

interface VoiceState extends VoiceCfg {
  addConn: (c: Omit<VoiceConn, 'id' | 'enabled'>) => string;
  updateConn: (id: string, p: Partial<VoiceConn>) => void;
  removeConn: (id: string) => void;
  /** يختار الاتصال والمزوّد لقسم */
  useConn: (kind: 'stt' | 'tts', id: string) => void;
  setStt: (p: Partial<VoiceCfg['stt']>) => void;
  setTts: (p: Partial<VoiceCfg['tts']>) => void;
  /** يحدّث إعداد مزوّد (نموذج/صوت) لقسم */
  setProv: (kind: 'stt' | 'tts', preset: Preset, p: { model?: string; voice?: string }) => void;
  toggleFav: (key: string) => void;
  addCustom: (preset: Preset, v: Omit<CustomVoice, 'cid'>) => void;
  updateCustom: (preset: Preset, cid: string, v: Partial<CustomVoice>) => void;
  removeCustom: (preset: Preset, cid: string) => void;
}

const fixed = (s: VoiceCfg): VoiceCfg => autoConn({ ...s, stt: { ...s.stt }, tts: { ...s.tts } });

export const useVoice = create<VoiceState>()(
  persist(
    (set, get) => ({
      ...defaultVoiceCfg(),
      addConn: (c) => {
        const id = 'c' + uid(7);
        set((s) => fixed({ ...s, conns: [...s.conns, { ...c, id, enabled: true }] }));
        return id;
      },
      updateConn: (id, p) => set((s) => fixed({ ...s, conns: s.conns.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      removeConn: (id) => set((s) => fixed({ ...s, conns: s.conns.filter((x) => x.id !== id) })),
      useConn: (kind, id) => {
        const c = get().conns.find((x) => x.id === id);
        if (!c) return;
        set((s) => ({ [kind]: { ...s[kind], conn: id, p: c.preset } } as any));
      },
      setStt: (p) => set((s) => ({ stt: { ...s.stt, ...p } })),
      setTts: (p) => set((s) => ({ tts: { ...s.tts, ...p } })),
      setProv: (kind, preset, p) =>
        set((s) => ({ [kind]: { ...s[kind], cfg: { ...s[kind].cfg, [preset]: { ...(s[kind].cfg[preset] || {}), ...p } } } } as any)),
      toggleFav: (key) => set((s) => ({ favs: s.favs.includes(key) ? s.favs.filter((x) => x !== key) : [...s.favs, key] })),
      addCustom: (preset, v) =>
        set((s) => {
          const cur = s.tts.cfg[preset] || {};
          return { tts: { ...s.tts, cfg: { ...s.tts.cfg, [preset]: { ...cur, customVoices: [...(cur.customVoices || []), { ...v, cid: 'v' + uid(7) }] } } } };
        }),
      updateCustom: (preset, cid, v) =>
        set((s) => {
          const cur = s.tts.cfg[preset] || {};
          return { tts: { ...s.tts, cfg: { ...s.tts.cfg, [preset]: { ...cur, customVoices: (cur.customVoices || []).map((x) => (x.cid === cid ? { ...x, ...v } : x)) } } } };
        }),
      removeCustom: (preset, cid) =>
        set((s) => {
          const cur = s.tts.cfg[preset] || {};
          return { tts: { ...s.tts, cfg: { ...s.tts.cfg, [preset]: { ...cur, customVoices: (cur.customVoices || []).filter((x) => x.cid !== cid) } } } };
        }),
    }),
    {
      name: 'ai_voice_v1',
      storage: persistStorage,
      version: 1,
      merge: (saved: any, cur: any) => ({ ...cur, ...normVoiceCfg(saved) }),
    },
  ),
);

/** لقطة الإعداد الحالية (بلا دوال) */
export const voiceSnapshot = (): VoiceCfg => {
  const { stt, tts, conns, favs } = useVoice.getState();
  return { stt, tts, conns, favs };
};
