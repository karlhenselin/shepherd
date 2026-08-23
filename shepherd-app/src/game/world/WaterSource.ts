import { GameObjects, Scene } from 'phaser';
import { mulberry32, paintWash } from '../world/watercolorPaint';

const DRINK_RANGE = 92;
const TEXTURE_KEY = 'water-source';

export class WaterSource {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureWaterTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
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

function ensureWaterTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 110;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create water source sprite');
    }

    const rng = mulberry32(0x70ad);

    paintWash(ctx, { x: 0.50, y: 0.56, rx: 0.48, ry: 0.40, color: '#c4a574', sides: 8 }, rng, 0.28, 6);
    paintWash(ctx, { x: 0.50, y: 0.52, rx: 0.40, ry: 0.32, color: '#5f8f82', sides: 8 }, rng, 0.32, 8);
    paintWash(ctx, { x: 0.52, y: 0.54, rx: 0.30, ry: 0.24, color: '#4e7f74', sides: 7 }, rng, 0.28, 6);
    paintWash(ctx, { x: 0.42, y: 0.42, rx: 0.16, ry: 0.10, color: '#cfe0d6', sides: 6 }, rng, 0.20, 4);

    scene.textures.addCanvas(TEXTURE_KEY, canvas);
}
