import { GameObjects, Scene } from 'phaser';
import { BIBLE_GEMS, BibleGemId, bibleGemLine } from '../data/scripture';
import {
    REGION_COLS,
    REGION_HEIGHT,
    REGION_ROWS,
    REGION_WIDTH,
    regionCenter,
    startCenter
} from './constants';
import { mulberry32 } from './watercolorPaint';

const PICKUP_RANGE = 72;
const TEXTURE_KEY = 'bible-gem';
const GLINT_KEY = 'bible-gem-glint';
const SIZE = 64;
const DISPLAY = 31;
/** How many collectible gems sit in the world at once. */
export const WORLD_GEM_LIMIT = 10;
const MIN_FROM_PLAYER = REGION_WIDTH * 1.75;
const MIN_FROM_GEMS = REGION_WIDTH * 1.35;

export class BibleGem {
    readonly id: BibleGemId;
    readonly sprite: GameObjects.Sprite;
    private readonly glint: GameObjects.Image;

    constructor (scene: Scene, id: BibleGemId, x: number, y: number) {
        ensureGemTextures(scene);

        this.id = id;
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDepth(4);
        this.sprite.setDisplaySize(DISPLAY, DISPLAY);

        this.glint = scene.add.image(x + 6, y - 9, GLINT_KEY);
        this.glint.setDepth(5);
        this.glint.setAlpha(0.25);
        this.glint.setScale(0.7);

        scene.tweens.add({
            targets: this.sprite,
            scaleX: this.sprite.scaleX * 1.1,
            scaleY: this.sprite.scaleY * 1.1,
            duration: 1300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        scene.tweens.add({
            targets: this.glint,
            alpha: 0.95,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    line (): string {
        return bibleGemLine(this.id);
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < PICKUP_RANGE;
    }

    destroy (): void {
        this.sprite.scene.tweens.killTweensOf(this.sprite);
        this.sprite.scene.tweens.killTweensOf(this.glint);
        this.sprite.destroy();
        this.glint.destroy();
    }
}

export function placeBibleGems (
    scene: Scene,
    collected: string[],
    awayFrom: { x: number; y: number } = startCenter()
): BibleGem[] {
    const gems: BibleGem[] = [];
    const pool = remainingGemIds(collected, []);

    for (let i = 0; i < Math.min(WORLD_GEM_LIMIT, pool.length); i++) {
        const id = pool[i];
        const at = findGemSpot(awayFrom, gems, i);
        gems.push(new BibleGem(scene, id, at.x, at.y));
    }

    return gems;
}

/** Spawn one uncollected gem far from the player (and other gems), if any remain. */
export function spawnBibleGemAway (
    scene: Scene,
    collected: string[],
    present: BibleGem[],
    awayFrom: { x: number; y: number }
): BibleGem | null {
    if (present.length >= WORLD_GEM_LIMIT) {
        return null;
    }

    const pool = remainingGemIds(collected, present.map((gem) => gem.id));
    const id = pool[0];

    if (!id) {
        return null;
    }

    const at = findGemSpot(awayFrom, present, present.length + collected.length);

    return new BibleGem(scene, id, at.x, at.y);
}

function findGemSpot (
    player: { x: number; y: number },
    others: { x: number; y: number }[],
    salt: number
): { x: number; y: number } {
    const tries = [
        { fromPlayer: MIN_FROM_PLAYER, fromGems: MIN_FROM_GEMS },
        { fromPlayer: REGION_WIDTH * 1.2, fromGems: REGION_HEIGHT },
        { fromPlayer: REGION_WIDTH, fromGems: REGION_HEIGHT * 0.7 }
    ];

    for (const need of tries) {
        const at = pickGemRegion(player, others, salt, need.fromPlayer, need.fromGems);

        if (at) {
            return at;
        }
    }

    return regionCenter(0, 0);
}

function pickGemRegion (
    player: { x: number; y: number },
    others: { x: number; y: number }[],
    salt: number,
    minFromPlayer: number,
    minFromGems: number
): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestScore = -1;

    for (let row = 0; row < REGION_ROWS; row++) {
        for (let col = 0; col < REGION_COLS; col++) {
            const at = jitteredRegion(col, row, salt);
            const fromPlayer = Math.hypot(at.x - player.x, at.y - player.y);

            if (fromPlayer < minFromPlayer) {
                continue;
            }

            let fromGems = Number.POSITIVE_INFINITY;

            for (const other of others) {
                fromGems = Math.min(fromGems, Math.hypot(at.x - other.x, at.y - other.y));
            }

            if (others.length > 0 && fromGems < minFromGems) {
                continue;
            }

            const score = others.length === 0 ? fromPlayer : fromGems;

            if (score > bestScore) {
                bestScore = score;
                best = at;
            }
        }
    }

    return best;
}

function jitteredRegion (col: number, row: number, salt: number): { x: number; y: number } {
    const at = regionCenter(col, row);
    const rng = mulberry32((0x9e3779b9 + salt * 17 + col * 131 + row * 257) >>> 0);

    return {
        x: at.x + (rng() - 0.5) * REGION_WIDTH * 0.28,
        y: at.y + (rng() - 0.5) * REGION_HEIGHT * 0.28
    };
}

function remainingGemIds (collected: string[], present: string[]): BibleGemId[] {
    const taken = new Set([...collected, ...present]);
    return BIBLE_GEMS
        .map((gem) => gem.id)
        .filter((id) => !taken.has(id));
}

function ensureGemTextures (scene: Scene): void {
    if (!scene.textures.exists(TEXTURE_KEY)) {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not create gem sprite');
        }

        paintGem(ctx);
        scene.textures.addCanvas(TEXTURE_KEY, canvas);
    }

    if (scene.textures.exists(GLINT_KEY)) {
        return;
    }

    const glint = scene.add.graphics();
    glint.fillStyle(0xfff8ee, 1);
    glint.fillTriangle(8, 1, 6, 8, 10, 8);
    glint.fillTriangle(8, 15, 6, 8, 10, 8);
    glint.fillTriangle(1, 8, 8, 6, 8, 10);
    glint.fillTriangle(15, 8, 8, 6, 8, 10);
    glint.fillStyle(0xf0d78a, 0.9);
    glint.fillCircle(8, 8, 2.2);
    glint.generateTexture(GLINT_KEY, 16, 16);
    glint.destroy();
}

function paintGem (ctx: CanvasRenderingContext2D): void {
    const rng = mulberry32(0x6e31);
    const cx = 32;
    const cy = 30;

    ctx.fillStyle = 'rgba(58, 42, 24, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, 52, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const outer = hexagon(cx, cy, 20);
    const inner = hexagon(cx, cy, 8);
    const dark = ['#1a4568', '#2a6d9a', '#17405f', '#3a86b5', '#1d4e72', '#4f9ec4'];
    const light = ['#6ec0dc', '#8fd4ea', '#5eb3d4', '#b8e8f4', '#7ec8e3', '#d5f3fa'];

    fillPoly(ctx, hexagon(cx, cy + 1, 22), '#c4a574');
    fillPoly(ctx, outer, '#2a6d9a');

    for (let i = 0; i < 6; i++) {
        fillPoly(
            ctx,
            [outer[i], outer[(i + 1) % 6], inner[(i + 1) % 6], inner[i]],
            i % 2 === 0 ? dark[i] : light[i]
        );
    }

    fillPoly(ctx, inner, '#d8f4fb');

    ctx.fillStyle = 'rgba(255, 252, 247, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - 3, cy - 3, 4.5, 2.6, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff8ee';
    fillDot(ctx, cx + 11, cy - 10, 1.6);
    fillDot(ctx, cx - 12, cy + 2, 1.2);
    ctx.fillStyle = '#f0d78a';
    fillDot(ctx, cx + 6, cy + 8, 1.1);

    grainOpaque(ctx, rng);
}

function grainOpaque (ctx: CanvasRenderingContext2D, rng: () => number): void {
    const { width, height } = ctx.canvas;
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) {
            continue;
        }

        const n = (rng() - 0.5) * 16;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }

    ctx.putImageData(image, 0, 0);
}

function hexagon (cx: number, cy: number, r: number): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < 6; i++) {
        const t = -Math.PI / 2 + i * Math.PI / 3;
        points.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }

    return points;
}

function fillPoly (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();
    ctx.fill();
}

function fillDot (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}
