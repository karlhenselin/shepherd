import { Capacitor } from '@capacitor/core';
import { PlayGames } from '@idleflowgames/capacitor-play-games';

let ready = false;

export function playGamesAvailable (): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Initialize PGS and attempt silent sign-in. Safe no-op on web. */
export async function initPlayGames (): Promise<boolean> {
    if (!playGamesAvailable()) {
        return false;
    }

    try {
        await PlayGames.initialize();
        const result = await PlayGames.signIn({ silent: true });
        ready = result.signedIn === true;
        return ready;
    }
    catch {
        ready = false;
        return false;
    }
}

export async function isPlayGamesSignedIn (): Promise<boolean> {
    if (!playGamesAvailable()) {
        return false;
    }

    try {
        const { signedIn } = await PlayGames.isSignedIn();
        ready = signedIn;
        return signedIn;
    }
    catch {
        return false;
    }
}

/** Unlock by Play Console achievement id. No-ops when blank, unsigned-in, or web. */
export async function unlockPlayAchievement (platformId: string): Promise<void> {
    if (!platformId || !playGamesAvailable()) {
        return;
    }

    try {
        if (!ready) {
            const signedIn = await isPlayGamesSignedIn();

            if (!signedIn) {
                return;
            }
        }

        await PlayGames.unlockAchievement({ id: platformId });
    }
    catch {
        // Achievements must never break gameplay.
    }
}

export async function showPlayAchievements (): Promise<void> {
    if (!playGamesAvailable()) {
        return;
    }

    try {
        if (!ready) {
            const signedIn = await isPlayGamesSignedIn();

            if (!signedIn) {
                await PlayGames.signIn({ silent: false });
            }
        }

        await PlayGames.showAchievements();
    }
    catch {
        // Native UI failures are non-fatal.
    }
}
