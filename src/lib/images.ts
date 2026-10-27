import * as FileSystem from 'expo-file-system/legacy';
import type { ImageRef } from '../api/types';
import { uid } from './util';

const DIR = (FileSystem.documentDirectory || '') + 'images/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** يحفظ صورة (base64) في مخزن التطبيق ويعيد مرجعًا خفيفًا للمحادثة */
export async function saveImage(base64: string, mime = 'image/jpeg'): Promise<ImageRef> {
  await ensureDir();
  const id = uid(10);
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const uri = `${DIR}${id}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { id, mime, uri };
}

export async function loadBase64(ref: ImageRef): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(ref.uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return '';
  }
}

export async function loadAll(refs: ImageRef[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  await Promise.all(
    refs.map(async (r) => {
      const d = await loadBase64(r);
      if (d) m.set(r.id, d);
    }),
  );
  return m;
}

export async function deleteImages(refs: ImageRef[]) {
  await Promise.all(refs.map((r) => FileSystem.deleteAsync(r.uri, { idempotent: true }).catch(() => {})));
}

export async function readTextFile(uri: string, max = 200_000): Promise<string> {
  const t = await FileSystem.readAsStringAsync(uri);
  return t.length > max ? t.slice(0, max) + '\n…[قُصّ الملف]' : t;
}
