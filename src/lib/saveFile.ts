/**
 * Save a text file to the user's device. Web build: hand the file to the OS via
 * `navigator.share` where supported (mobile browsers), else trigger a download.
 * The native counterpart lives in `saveFile.native.ts` (Metro picks it on
 * iOS/Android). Mirrors the Wrapped share helper's web/native split.
 */

export type SaveResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string,
): Promise<SaveResult> {
  if (typeof document === 'undefined') return 'unsupported';
  try {
    const blob = new Blob([content], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Senpai library backup' });
      return 'shared';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    console.warn('[backup] save failed', err);
    return 'error';
  }
}
