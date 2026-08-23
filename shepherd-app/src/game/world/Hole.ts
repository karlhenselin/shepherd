import { GameObjects, Scene } from 'phaser';
import { mulberry32, paintWash } from './watercolorPaint';

const TEXTURE_KEY = 'sheep-hole';
const WIDTH = 180;
const HEIGHT = 130;
const DISPLAY_WIDTH = 220;
const DISPLAY_HEIGHT = 160;

export class Hole {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureHoleTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_WIDTH, DISPLAY_HEIGHT);
        this.sprite.setDepth(2);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }
}

function ensureHoleTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create hole sprite');
    }

    paintHole(ctx);
    scene.textures.addCanvas(TEXTURE_KEY, canvas);
}

function paintHole (ctx: CanvasRenderingContext2D): void {
    const rng = mulberry32(0x40e1);

    paintWash(ctx, { x: 0.50, y: 0.58, rx: 0.46, ry: 0.34, color: '#6b5340', sides: 8 }, rng, 0.28, 6);
    paintWash(ctx, { x: 0.50, y: 0.56, rx: 0.38, ry: 0.28, color: '#4a3426', sides: 7 }, rng, 0.32, 6);
    paintWash(ctx, { x: 0.48, y: 0.54, rx: 0.28, ry: 0.20, color: '#2c1c14', sides: 7 }, rng, 0.36, 5);
    paintWash(ctx, { x: 0.42, y: 0.48, rx: 0.12, ry: 0.08, color: '#1a100c', sides: 6 }, rng, 0.22, 4);
    paintWash(ctx, { x: 0.62, y: 0.72, rx: 0.16, ry: 0.10, color: '#7a5a3e', sides: 6 }, rng, 0.20, 4);
    paintWash(ctx, { x: 0.34, y: 0.70, rx: 0.14, ry: 0.09, color: '#8a6a4a', sides: 6 }, rng, 0.16, 3);
}
