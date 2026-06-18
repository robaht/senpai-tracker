import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { WrappedSummary } from '../stats/wrapped';

/**
 * Native share: capture the off-screen <WrappedShareCard> (real cover art and
 * all — no canvas/CORS limit on device) to a PNG, then hand it to the OS share
 * sheet via expo-sharing. The web build's canvas version lives in `shareCard.ts`;
 * Metro picks this `.native` file on iOS/Android automatically.
 *
 * Requires a dev build (react-native-view-shot is a native module, not in Expo Go).
 */

export type ShareResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export interface SharePalette {
  from: string;
  to: string;
  accent: string;
}

export async function shareWrapped(
  summary: WrappedSummary,
  _palette: SharePalette,
  shareRef?: RefObject<View | null>,
): Promise<ShareResult> {
  if (!shareRef?.current) return 'unsupported';
  try {
    // The card view is 360×640; upscale the capture to a crisp 1080×1920.
    const uri = await captureRef(shareRef, { format: 'png', quality: 1, width: 1080, height: 1920 });
    if (!(await Sharing.isAvailableAsync())) return 'unsupported';
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: `My ${summary.year} Anime Wrapped`,
      UTI: 'public.png',
    });
    return 'shared';
  } catch (err) {
    console.warn('[wrapped] native share failed', err);
    return 'error';
  }
}
