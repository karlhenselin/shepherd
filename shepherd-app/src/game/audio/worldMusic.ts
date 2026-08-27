import { Scene, Sound, Tweens } from 'phaser';

export const WANDERLUST_KEY = 'wanderlust';
export const WONDERS_KEY = 'wonders-of-nature';

const TRACKS = [WANDERLUST_KEY, WONDERS_KEY] as const;
export type WorldMusicKey = typeof TRACKS[number];

const VOLUME = 0.4;

type VolumeSound = Sound.BaseSound & {
    volume: number;
    seek: number;
    duration: number;
    totalDuration: number;
};

let activeKey: WorldMusicKey = WANDERLUST_KEY;
let volumeTween: Tweens.Tween | null = null;
/** Applied once on the next play start (survives audio unlock / context resume). */
let pendingSeek: number | undefined;
/**
 * Last known playback position for the active track.
 * Kept across same-track stop/fade so day saves and mid-day resume still work.
 * Cleared when crossing night (and when switching tracks).
 */
let lastSeek = 0;
/**
 * When true, ignore the live Phaser sound seek (night fade still playing, or
 * seek was intentionally cleared). Cleared once playback starts again.
 */
let ignoreLiveSeek = false;

export function isWorldMusicKey (key: string | undefined | null): key is WorldMusicKey {
    return key === WANDERLUST_KEY || key === WONDERS_KEY;
}

/**
 * Restore saved BGM progress into module state without starting playback.
 * Used for day loads so play / checkpoints resume mid-song.
 */
export function applySavedWorldMusic (key: WorldMusicKey, seekSeconds: number): void {
    const seek = Number.isFinite(seekSeconds) && seekSeconds > 0 ? seekSeconds : 0;

    activeKey = key;
    lastSeek = seek;
    pendingSeek = seek > 0 ? seek : undefined;
    ignoreLiveSeek = seek <= 0;
}

/** Zero seek/pending but keep the active track key. */
export function clearWorldMusicSeek (): void {
    lastSeek = 0;
    pendingSeek = undefined;
    ignoreLiveSeek = true;
}

export function clearWorldMusicProgress (): void {
    activeKey = WANDERLUST_KEY;
    clearWorldMusicSeek();
}

export function getWorldMusicProgress (scene: Scene): { key: WorldMusicKey; seek: number } {
    rememberSeek(scene);

    return { key: activeKey, seek: lastSeek };
}

function stillInWorld (scene: Scene): boolean {
    return scene.sys.isActive() || scene.sys.isPaused();
}

function audioContextOf (scene: Scene): AudioContext | null {
    const sound = scene.sound as { context?: AudioContext };

    return sound.context instanceof AudioContext ? sound.context : null;
}

function musicOf (scene: Scene): VolumeSound | null {
    const music = scene.sound.get(activeKey);

    return music ? music as VolumeSound : null;
}

function clearVolumeTween (): void {
    volumeTween?.stop();
    volumeTween = null;
}

function rememberSeek (scene: Scene): void {
    if (ignoreLiveSeek) {
        return;
    }

    const music = musicOf(scene);

    if (music && Number.isFinite(music.seek) && music.seek > 0) {
        lastSeek = music.seek;
    }
}

function trackDuration (music: VolumeSound): number {
    const duration = music.duration || music.totalDuration || 0;

    return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function normalizeSeek (music: VolumeSound, seek: number): number {
    if (!Number.isFinite(seek) || seek <= 0) {
        return 0;
    }

    const duration = trackDuration(music);

    if (duration > 0) {
        return seek % duration;
    }

    return seek;
}

function consumePendingSeek (music: VolumeSound): number | undefined {
    if (pendingSeek === undefined) {
        return undefined;
    }

    const seek = normalizeSeek(music, pendingSeek);
    pendingSeek = undefined;
    lastSeek = seek;

    return seek > 0 ? seek : undefined;
}

function playIfNeeded (scene: Scene, volume = VOLUME): void {
    if (!stillInWorld(scene) || !scene.cache.audio.exists(activeKey)) {
        return;
    }

    let music = musicOf(scene);

    if (!music) {
        music = scene.sound.add(activeKey, {
            loop: true,
            volume
        }) as VolumeSound;
    }

    music.volume = volume;

    if (!music.isPlaying) {
        const seek = consumePendingSeek(music);

        music.play({
            loop: true,
            volume,
            ...(seek !== undefined ? { seek } : {})
        });
        ignoreLiveSeek = false;
    }
    else {
        // Already playing — drop stale pending seek so a later restart uses lastSeek.
        pendingSeek = undefined;
        ignoreLiveSeek = false;
    }
}

export function setWorldMusicTrack (scene: Scene, key: WorldMusicKey): void {
    if (activeKey === key) {
        return;
    }

    clearVolumeTween();
    scene.sound.stopByKey(activeKey);
    activeKey = key;
    // New track always starts at 0 (e.g. dawn wonders after night).
    clearWorldMusicSeek();
}

export function startWorldMusic (scene: Scene, seekSeconds?: number): void {
    clearVolumeTween();

    if (typeof seekSeconds === 'number' && Number.isFinite(seekSeconds) && seekSeconds > 0) {
        pendingSeek = seekSeconds;
        lastSeek = seekSeconds;
    }
    else if (pendingSeek === undefined && lastSeek > 0) {
        // Resume after fade/stop when caller did not pass an explicit seek.
        pendingSeek = lastSeek;
    }

    const start = (): void => {
        const context = audioContextOf(scene);

        if (context && context.state !== 'running') {
            void context.resume().then(() => playIfNeeded(scene));
            return;
        }

        playIfNeeded(scene);
    };

    if (scene.sound.locked) {
        scene.sound.once('unlocked', start);
        return;
    }

    start();
}

export function stopWorldMusic (scene: Scene): void {
    rememberSeek(scene);
    clearVolumeTween();
    pendingSeek = undefined;

    for (const key of TRACKS) {
        scene.sound.stopByKey(key);
    }
}

/**
 * @param resetSeek When true (night), discard playback position so morning starts at 0.
 */
export function fadeOutWorldMusic (scene: Scene, duration: number, resetSeek = false): void {
    const music = musicOf(scene);

    if (!music || !music.isPlaying) {
        if (resetSeek) {
            clearWorldMusicSeek();
        }

        return;
    }

    if (resetSeek) {
        clearWorldMusicSeek();
    }
    else {
        rememberSeek(scene);
    }

    if (duration <= 0) {
        stopWorldMusic(scene);

        if (resetSeek) {
            clearWorldMusicSeek();
        }

        return;
    }

    clearVolumeTween();
    volumeTween = scene.tweens.add({
        targets: music,
        volume: 0,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
            volumeTween = null;

            if (resetSeek) {
                clearWorldMusicSeek();
            }
            else {
                rememberSeek(scene);
            }

            music.stop();
            music.volume = VOLUME;
        }
    });
}

export function fadeInWorldMusic (scene: Scene, duration: number): void {
    if (!stillInWorld(scene)) {
        return;
    }

    clearVolumeTween();

    // Resume this track from last known seek after a same-day stop/fade.
    if (pendingSeek === undefined && lastSeek > 0) {
        pendingSeek = lastSeek;
    }

    const start = (): void => {
        if (!stillInWorld(scene)) {
            return;
        }

        playIfNeeded(scene, duration <= 0 ? VOLUME : 0);

        if (duration <= 0) {
            return;
        }

        const music = musicOf(scene);

        if (!music) {
            return;
        }

        volumeTween = scene.tweens.add({
            targets: music,
            volume: VOLUME,
            duration,
            ease: 'Sine.easeOut',
            onComplete: () => {
                volumeTween = null;
            }
        });
    };

    const context = audioContextOf(scene);

    if (scene.sound.locked) {
        scene.sound.once('unlocked', start);
        return;
    }

    if (context && context.state !== 'running') {
        void context.resume().then(start);
        return;
    }

    start();
}
