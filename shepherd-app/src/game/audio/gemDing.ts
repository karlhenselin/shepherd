import { Scene } from 'phaser';
import { isDocumentAudioLive, isSoundOn } from './soundPref';

export const GEM_DING_KEY = 'gem-ding';
const GEM_DING_FILE = 'audio/sfx/gem-ding.mp3';

export function loadGemDing (load: Phaser.Loader.LoaderPlugin): void {
    load.audio(GEM_DING_KEY, GEM_DING_FILE);
}

export function playGemDing (scene: Scene): void {
    if (!isSoundOn() || !isDocumentAudioLive() || !scene.sys.isActive()) {
        return;
    }

    if (!scene.cache.audio.exists(GEM_DING_KEY) || scene.sound.locked) {
        return;
    }

    scene.sound.play(GEM_DING_KEY, {
        volume: 0.55,
        detune: -20 + Math.random() * 40
    });
}
