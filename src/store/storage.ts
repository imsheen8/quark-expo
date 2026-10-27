import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** تخزين zustand الدائم على AsyncStorage */
export const persistStorage = createJSONStorage(() => AsyncStorage);
