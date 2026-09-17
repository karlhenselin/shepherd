import { Scene } from 'phaser';

export const SHEEP_VERSE_KEY = 'sheep-verse';
export const SHEEP_VERSE_SIZE = 40;
export const SHEEP_VERSE_LIST_SIZE = 28;

/** No-op when the PNG is preloaded in Preloader (Android launcher sheep face). */
export function ensureSheepVerseIcon (scene: Scene): void {
    if (!scene.textures.exists(SHEEP_VERSE_KEY)) {
        console.warn('sheep-verse texture missing — load assets/sheep-verse-icon.png in Preloader');
    }
}
