import { GameObjects, Scene } from 'phaser';

const DRINK_RANGE = 120;
const TEXTURE_KEY = 'water-source';
const LAKE_WIDTH = 260;
const LAKE_HEIGHT = 173;

export class WaterSource {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        if (!scene.textures.exists(TEXTURE_KEY)) {
            throw new Error('Water source texture was not loaded');
        }

        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(LAKE_WIDTH, LAKE_HEIGHT);
        this.sprite.setDepth(2);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < DRINK_RANGE;
    }
}
