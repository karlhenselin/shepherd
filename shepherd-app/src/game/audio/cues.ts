import { Scene } from 'phaser';
import { isDocumentAudioLive, isSoundOn } from './soundPref';

const FOOTSTEP_KEY = 'footstep';
const GEM_DING_KEY = 'gem-ding';
const STEP_GAP_MS = 340;

let lastStepAt = 0;

export function loadCueSounds (load: Phaser.Loader.LoaderPlugin): void {
    load.audio(FOOTSTEP_KEY, 'audio/footstep.wav');
    load.audio(GEM_DING_KEY, 'audio/gem-ding.wav');
}

export function tickWalkSound (scene: Scene, walking: boolean): void {
    if (!walking || !isDocumentAudioLive() || !scene.cache.audio.exists(FOOTSTEP_KEY)) {
        return;
    }

    const now = scene.time.now;

    if (now - lastStepAt < STEP_GAP_MS) {
        return;
    }

    lastStepAt = now;
    scene.sound.play(FOOTSTEP_KEY, {
        volume: 0.2,
        detune: -50 + Math.random() * 100,
        rate: 0.92 + Math.random() * 0.16
    });
}

export function playGemDing (scene: Scene): void {
    if (!isSoundOn() || !scene.cache.audio.exists(GEM_DING_KEY) || scene.sound.locked) {
        return;
    }

    scene.sound.play(GEM_DING_KEY, { volume: 0.55 });
}
