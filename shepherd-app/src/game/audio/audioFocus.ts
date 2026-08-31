import type { Game } from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { setBackgroundAudioHold } from './soundPref';
import { hushSpeech, unhushSpeech } from '../ui/speech';

/**
 * Stop music, voice, and other audio when the app backgrounds or the screen locks.
 * Android WebView often keeps Web Audio running through lock unless we pause it.
 */
export function installAudioFocus (game: Game): void {
    const hold = (): void => {
        setBackgroundAudioHold(true);
        game.sound.pauseAll();
        hushSpeech();
    };

    const release = (): void => {
        setBackgroundAudioHold(false);
        game.sound.resumeAll();
        unhushSpeech();
    };

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            hold();
        }
        else {
            release();
        }
    });
    window.addEventListener('pagehide', hold);
    window.addEventListener('pageshow', release);
    window.addEventListener('freeze', hold);

    if (!Capacitor.isNativePlatform()) {
        return;
    }

    void App.addListener('pause', hold);
    void App.addListener('resume', release);
}
