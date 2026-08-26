import { Scene, Sound, Tweens } from 'phaser';

export const WANDERLUST_KEY = 'wanderlust';
export const WONDERS_KEY = 'wonders-of-nature';

const TRACKS = [WANDERLUST_KEY, WONDERS_KEY] as const;
export type WorldMusicKey = typeof TRACKS[number];

const VOLUME = 0.4;

type VolumeSound = Sound.BaseSound & {
    volume: number;
};

let activeKey: WorldMusicKey = WANDERLUST_KEY;
let volumeTween: Tweens.Tween | null = null;

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
        music.play({
            loop: true,
            volume
        });
    }
}

export function setWorldMusicTrack (scene: Scene, key: WorldMusicKey): void {
    if (activeKey === key) {
        return;
    }

    clearVolumeTween();
    scene.sound.stopByKey(activeKey);
    activeKey = key;
}

export function startWorldMusic (scene: Scene): void {
    clearVolumeTween();

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
    clearVolumeTween();

    for (const key of TRACKS) {
        scene.sound.stopByKey(key);
    }
}

export function fadeOutWorldMusic (scene: Scene, duration: number): void {
    const music = musicOf(scene);

    if (!music || !music.isPlaying) {
        return;
    }

    if (duration <= 0) {
        stopWorldMusic(scene);
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
