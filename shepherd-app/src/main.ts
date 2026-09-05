import { Capacitor, SystemBars } from '@capacitor/core';
import { bootAchievements } from './game/achievements/achievements';
import StartGame from './game/main';
import { installLandscapeGate } from './game/ui/landscapeGate';

async function hideChrome (): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    try {
        await SystemBars.hide();
    }
    catch {
        // Web / older bridges — native MainActivity still applies immersive mode.
    }
}

// Keep the WebView from scrolling/rubber-banding under Phaser lists.
document.addEventListener('touchmove', (event) => {
    event.preventDefault();
}, { passive: false });

document.addEventListener('DOMContentLoaded', () => {
    void hideChrome();
    void bootAchievements();
    const game = StartGame('game-container');
    installLandscapeGate(game);
});
