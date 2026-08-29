import { Scene } from 'phaser';

export const TREASURE_CHEST_KEY = 'treasure-chest';
export const TREASURE_CHEST_SIZE = 40;

/** No-op when the PNG is preloaded in Preloader. */
export function ensureTreasureChest (scene: Scene): void {
    if (!scene.textures.exists(TREASURE_CHEST_KEY)) {
        console.warn('treasure-chest texture missing — load assets/treasure-chest.png in Preloader');
    }
}
