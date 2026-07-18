import { Platform } from 'react-native';
import { FadeIn } from 'react-native-reanimated';

/**
 * Entering animation for list/grid cards. Disabled on web: reanimated entering
 * anims run on the JS thread there, so a screenful of simultaneously-mounting
 * cards sits visibly dimmed for seconds (and entering has rendered content
 * fully invisible on web before) — instant render beats a laggy fade.
 */
export const cardEntering = Platform.OS === 'web' ? undefined : FadeIn.duration(250);
