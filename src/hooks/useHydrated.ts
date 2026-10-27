import { useEffect, useState } from 'react';
import { useChats } from '../store/chats';
import { useLibrary, useMemory, useUsage } from '../store/data';
import { useSettings } from '../store/settings';

const stores = [useSettings, useChats, useLibrary, useMemory, useUsage] as const;
const all = () => stores.every((s) => s.persist.hasHydrated());

/** ينتظر استعادة كل المخازن الدائمة من AsyncStorage قبل عرض الواجهة */
export function useHydrated(): boolean {
  const [ok, setOk] = useState(all());
  useEffect(() => {
    if (all()) return setOk(true);
    const un = stores.map((s) => s.persist.onFinishHydration(() => all() && setOk(true)));
    return () => un.forEach((u) => u());
  }, []);
  return ok;
}
