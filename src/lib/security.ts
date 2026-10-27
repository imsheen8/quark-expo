import * as Crypto from 'expo-crypto';
import * as LocalAuth from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const K_HASH = 'quark_pin_hash';
const K_SALT = 'quark_pin_salt';
const K_BIO = 'quark_pin_bio';

const digest = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + ':' + pin);

export async function hasPin(): Promise<boolean> {
  try {
    return !!(await SecureStore.getItemAsync(K_HASH));
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(K_SALT, salt);
  await SecureStore.setItemAsync(K_HASH, await digest(salt, pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [salt, hash] = await Promise.all([SecureStore.getItemAsync(K_SALT), SecureStore.getItemAsync(K_HASH)]);
  if (!salt || !hash) return true;
  return (await digest(salt, pin)) === hash;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(K_HASH);
  await SecureStore.deleteItemAsync(K_SALT);
  await SecureStore.deleteItemAsync(K_BIO);
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuth.hasHardwareAsync()) && (await LocalAuth.isEnrolledAsync());
  } catch {
    return false;
  }
}

export const getBio = async () => (await SecureStore.getItemAsync(K_BIO)) === '1';
export const setBio = (v: boolean) => (v ? SecureStore.setItemAsync(K_BIO, '1') : SecureStore.deleteItemAsync(K_BIO));

export async function biometricUnlock(): Promise<boolean> {
  try {
    const r = await LocalAuth.authenticateAsync({ promptMessage: 'افتح QUARK AI', cancelLabel: 'إلغاء', disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}
