import { Scene } from 'phaser';
import { isDocumentAudioLive, isSoundOn } from './soundPref';

export const WALK_FILES: ReadonlyArray<{ key: string; file: string }> = [
    { key: 'walk-1', file: 'audio/sfx/walk-1.mp3' },
    { key: 'walk-2', file: 'audio/sfx/walk-2.mp3' },
    { key: 'walk-3', file: 'audio/sfx/walk-3.mp3' },
    { key: 'walk-4', file: 'audio/sfx/walk-4.mp3' }
];

const STEP_GAP_MS = 310;

let lastStepAt = 0;
let lastKey = '';

export function loadWalkSounds (load: Phaser.Loader.LoaderPlugin): void {
    for (const clip of WALK_FILES) {
        load.audio(clip.key, clip.file);
    }
}

export function tickWalkSounds (scene: Scene, moving: boolean): void {
    if (!moving) {
        return;
    }

    if (!canPlay(scene)) {
        return;
    }

    const now = scene.time.now;

    if (now - lastStepAt < STEP_GAP_MS) {
        return;
    }

    lastStepAt = now;

    if (!isSoundOn()) {
        return;
    }

    const ready = WALK_FILES.map((clip) => clip.key).filter((key) => scene.cache.audio.exists(key));

    if (ready.length === 0) {
        return;
    }

    const pool = ready.length > 1 ? ready.filter((key) => key !== lastKey) : ready;
    const key = pool[Math.floor(Math.random() * pool.length)];
    lastKey = key;

    scene.sound.play(key, {
        volume: 0.22 + Math.random() * 0.08,
        detune: -40 + Math.random() * 80,
        rate: 0.96 + Math.random() * 0.08
    });
}

function canPlay (scene: Scene): boolean {
    if (!isDocumentAudioLive() || !scene.sys.isActive() || scene.sys.isPaused()) {
        return false;
    }

    if (scene.sound.locked || scene.sound.gameLostFocus) {
        return false;
    }

    const sound = scene.sound as { context?: AudioContext };

    return !(sound.context instanceof AudioContext && sound.context.state !== 'running');
}
