import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Native save: write the file to the cache directory, then hand it to the OS
 * share sheet (expo-sharing) so the user can save it to Files, send it, etc.
 * The web counterpart (download / navigator.share) lives in `saveFile.ts`.
 */

export type SaveResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string,
): Promise<SaveResult> {
  try {
    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(content);

    if (!(await Sharing.isAvailableAsync())) return 'unsupported';
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: 'Save your Senpai library',
      UTI: 'public.xml',
    });
    return 'shared';
  } catch (err) {
    console.warn('[backup] native save failed', err);
    return 'error';
  }
}
