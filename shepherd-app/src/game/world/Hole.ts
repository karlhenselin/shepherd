import { GameObjects, Scene } from 'phaser';
import { mulberry32, paintWash } from './watercolorPaint';

const TEXTURE_KEY = 'sheep-hole';
const WIDTH = 200;
const HEIGHT = 150;
const DISPLAY_WIDTH = 220;
const DISPLAY_HEIGHT = 160;

/**
 * Keep-out radius for following sheep around the hole center.
 * Larger than the painted pit (~half of display width ≈ 110px).
 */
export const HOLE_KEEP_OUT_RADIUS = 140;

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

    /** Scale + fade out, then destroy the sprite. Safe to call once. */
    shrinkAway (durationMs = 720): void {
        if (!this.sprite.active) {
            return;
        }

        const scene = this.sprite.scene;
        scene.tweens.killTweensOf(this.sprite);
        scene.tweens.add({
            targets: this.sprite,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: durationMs,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.sprite.destroy();
            }
        });
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
    const { width, height } = ctx.canvas;

    ctx.clearRect(0, 0, width, height);

    // Inset washes so deformation never clips against the canvas rectangle.
    paintWash(ctx, { x: 0.50, y: 0.50, rx: 0.32, ry: 0.26, color: '#3a2a1e', sides: 9 }, rng, 0.26, 7);
    paintWash(ctx, { x: 0.50, y: 0.48, rx: 0.26, ry: 0.20, color: '#241610', sides: 8 }, rng, 0.36, 6);
    paintWash(ctx, { x: 0.48, y: 0.47, rx: 0.18, ry: 0.14, color: '#120a08', sides: 8 }, rng, 0.44, 5);
    paintWash(ctx, { x: 0.44, y: 0.42, rx: 0.09, ry: 0.06, color: '#060404', sides: 6 }, rng, 0.30, 4);
    paintWash(ctx, { x: 0.58, y: 0.56, rx: 0.11, ry: 0.07, color: '#4a3424', sides: 7 }, rng, 0.16, 4);
    paintWash(ctx, { x: 0.38, y: 0.56, rx: 0.10, ry: 0.06, color: '#523828', sides: 6 }, rng, 0.12, 3);

    // Soft outer dirt flecks for watercolor bleed (still inset).
    paintWash(ctx, { x: 0.50, y: 0.50, rx: 0.36, ry: 0.30, color: '#2e241c', sides: 10 }, rng, 0.10, 4);

    featherIrregularRim(ctx, rng);
}

/** Multiply alpha by a soft irregular oval so the pit fades to true transparency. */
function featherIrregularRim (ctx: CanvasRenderingContext2D, rng: () => number): void {
    const { width, height } = ctx.canvas;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const rx = width * 0.40;
    const ry = height * 0.34;

    const lobes = 14;
    const radiusMods: number[] = [];

    for (let i = 0; i < lobes; i++) {
        radiusMods.push(0.82 + rng() * 0.28);
    }

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const solid = 0.52;
    const rimWidth = 1 - solid;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            const angle = Math.atan2(dy, dx);
            const t = ((angle + Math.PI) / (Math.PI * 2)) * lobes;
            const i0 = Math.floor(t) % lobes;
            const i1 = (i0 + 1) % lobes;
            const f = t - Math.floor(t);
            const rimScale = radiusMods[i0] * (1 - f) + radiusMods[i1] * f;
            const dist = Math.hypot(dx, dy) / rimScale;

            let falloff = 1;

            if (dist >= 1) {
                falloff = 0;
            } else if (dist > solid) {
                const u = (dist - solid) / rimWidth;
                // Smoothstep fade — soft watercolor rim, not a hard cut.
                falloff = 1 - u * u * (3 - 2 * u);
            }

            const idx = (y * width + x) * 4;
            data[idx + 3] = Math.round(data[idx + 3] * falloff);
        }
    }

    ctx.putImageData(image, 0, 0);
}
