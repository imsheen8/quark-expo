import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { bytesToB64 } from '../api/voiceCore';
import { makeZip, slug, wsStats, type Files } from '../api/workspaceCore';

/** يضغط المشروع zip ويفتح مشاركته. يعيد اسم الملف النهائي */
export async function exportZip(files: Files, name: string): Promise<{ file: string; count: number; bytes: number }> {
  const st = wsStats(files);
  if (!st.count) throw new Error('المشروع فارغ؛ لا شيء للتصدير.');
  const base = slug(name, 'project');
  const zip = makeZip(files, base);
  const uri = (FS.cacheDirectory || FS.documentDirectory) + base + '.zip';
  await FS.writeAsStringAsync(uri, bytesToB64(zip), { encoding: FS.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/zip', dialogTitle: base + '.zip', UTI: 'public.zip-archive' });
  return { file: base + '.zip', count: st.count, bytes: zip.length };
}
