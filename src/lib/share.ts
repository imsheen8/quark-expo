import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

/** يكتب ملفًا مؤقتًا ويشاركه عبر نافذة المشاركة؛ وإن لم تتوفر يشارك النص نفسه. */
export async function shareFile(name: string, content: string, mime = 'text/plain'): Promise<void> {
  const uri = (FileSystem.cacheDirectory || '') + name;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
  } else {
    await Share.share({ message: content, title: name });
  }
}
