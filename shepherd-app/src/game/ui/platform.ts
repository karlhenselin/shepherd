import { Capacitor } from '@capacitor/core';

/** Native Android Capacitor build (not browser / desktop). */
export function isAndroidApp (): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Scripture typing minigame (ABC). Hidden on Android — sheep-click only there. */
export function showTypingMinigame (): boolean {
    return !isAndroidApp();
}
