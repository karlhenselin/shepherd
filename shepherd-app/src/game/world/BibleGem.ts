import { GameObjects, Scene } from 'phaser';
import { BIBLE_GEMS, BibleGemId, bibleGemLine } from '../data/scripture';
import {
    PASTURE_COL,
    PASTURE_ROW,
    REGION_COLS,
    REGION_HEIGHT,
    REGION_ROWS,
    REGION_WIDTH,
    START_COL,
    START_ROW,
    WATER_COL,
    WATER_ROW,
    regionCenter,
    startCenter,
    worldToRegion
} from './constants';
import { mulberry32 } from './watercolorPaint';

const PICKUP_RANGE = 72;
const TEXTURE_KEY = 'bible-gem';
const GLINT_KEY = 'bible-gem-glint';
const SIZE = 64;
const DISPLAY = 31;
/** How many collectible gems sit in the world at once. */
export const WORLD_GEM_LIMIT = 20;
/** Prefer at least ~one region away from the shepherd when placing. */
const MIN_FROM_PLAYER = REGION_WIDTH * 0.9;
/** Soft floor so replacements do not land on top of an existing gem. */
const MIN_FROM_GEMS = REGION_WIDTH * 0.85;

type RegionCell = { col: number; row: number };

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
    const count = Math.min(WORLD_GEM_LIMIT, pool.length);
    const cells = pickSpreadRegions(count, collected.length);

    for (let i = 0; i < count; i++) {
        const id = pool[i];
        const cell = cells[i] ?? fallbackCell(awayFrom, gems);
        const at = spotInRegion(cell, awayFrom, gems, i);
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

    const used = occupiedRegions(present);
    const cell = nextSpreadRegion(awayFrom, present, used, present.length + collected.length);
    const at = spotInRegion(cell, awayFrom, present, present.length + collected.length);

    return new BibleGem(scene, id, at.x, at.y);
}

/**
 * Farthest-point sample of eligible 7×7 cells so gems cover the whole map
 * instead of clustering near corners or the start region.
 */
function pickSpreadRegions (count: number, salt: number): RegionCell[] {
    const free = eligibleRegions();

    if (count <= 0 || free.length === 0) {
        return [];
    }

    const rng = mulberry32((0xc0ffee ^ (salt * 2654435761)) >>> 0);
    const picked: RegionCell[] = [];
    const first = free[Math.floor(rng() * free.length)];
    picked.push(first);

    while (picked.length < Math.min(count, free.length)) {
        let best: RegionCell | null = null;
        let bestScore = -1;

        for (const cell of free) {
            if (picked.some((p) => p.col === cell.col && p.row === cell.row)) {
                continue;
            }

            let nearest = Number.POSITIVE_INFINITY;

            for (const p of picked) {
                nearest = Math.min(nearest, regionDist(cell, p));
            }

            // Tiny jitter breaks ties so the layout is not a rigid lattice.
            const score = nearest + rng() * 0.01;

            if (score > bestScore) {
                bestScore = score;
                best = cell;
            }
        }

        if (!best) {
            break;
        }

        picked.push(best);
    }

    return picked;
}

function nextSpreadRegion (
    player: { x: number; y: number },
    others: { x: number; y: number }[],
    used: Set<string>,
    salt: number
): RegionCell {
    const free = eligibleRegions().filter((cell) => !used.has(regionKey(cell)));
    const candidates = free.length > 0 ? free : eligibleRegions();
    let best = candidates[0] ?? { col: 0, row: 0 };
    let bestScore = -1;
    const rng = mulberry32((0xbad5eed ^ (salt * 97)) >>> 0);

    for (const cell of candidates) {
        const at = jitteredRegion(cell.col, cell.row, salt);
        const fromPlayer = Math.hypot(at.x - player.x, at.y - player.y);
        let fromGems = Number.POSITIVE_INFINITY;

        for (const other of others) {
            fromGems = Math.min(fromGems, Math.hypot(at.x - other.x, at.y - other.y));
        }

        if (others.length === 0) {
            fromGems = fromPlayer;
        }

        const score = fromGems + fromPlayer * 0.15 + rng() * 8;

        if (score > bestScore) {
            bestScore = score;
            best = cell;
        }
    }

    return best;
}

function spotInRegion (
    cell: RegionCell,
    player: { x: number; y: number },
    others: { x: number; y: number }[],
    salt: number
): { x: number; y: number } {
    const primary = jitteredRegion(cell.col, cell.row, salt);

    if (isClearSpot(primary, player, others)) {
        return primary;
    }

    for (let nudge = 1; nudge <= 8; nudge++) {
        const alt = jitteredRegion(cell.col, cell.row, salt + nudge * 31);

        if (isClearSpot(alt, player, others)) {
            return alt;
        }
    }

    return primary;
}

function isClearSpot (
    at: { x: number; y: number },
    player: { x: number; y: number },
    others: { x: number; y: number }[]
): boolean {
    if (Math.hypot(at.x - player.x, at.y - player.y) < MIN_FROM_PLAYER) {
        return false;
    }

    return others.every((other) => Math.hypot(at.x - other.x, at.y - other.y) >= MIN_FROM_GEMS);
}

function fallbackCell (
    player: { x: number; y: number },
    others: { x: number; y: number }[]
): RegionCell {
    return nextSpreadRegion(player, others, occupiedRegions(others), others.length);
}

function eligibleRegions (): RegionCell[] {
    const cells: RegionCell[] = [];

    for (let row = 0; row < REGION_ROWS; row++) {
        for (let col = 0; col < REGION_COLS; col++) {
            if (isReservedRegion(col, row)) {
                continue;
            }

            cells.push({ col, row });
        }
    }

    return cells;
}

function isReservedRegion (col: number, row: number): boolean {
    if (col === START_COL && row === START_ROW) {
        return true;
    }

    if (col === PASTURE_COL && row === PASTURE_ROW) {
        return true;
    }

    if (col === WATER_COL && row === WATER_ROW) {
        return true;
    }

    const edgeCol = col === 0 || col === REGION_COLS - 1;
    const edgeRow = row === 0 || row === REGION_ROWS - 1;

    // Map corners host the sheepfold; keep gems out of those cells.
    return edgeCol && edgeRow;
}

function occupiedRegions (points: { x: number; y: number }[]): Set<string> {
    const used = new Set<string>();

    for (const point of points) {
        const region = worldToRegion(point.x, point.y);
        used.add(regionKey(region));
    }

    return used;
}

function regionKey (cell: RegionCell): string {
    return `${cell.col},${cell.row}`;
}

function regionDist (a: RegionCell, b: RegionCell): number {
    const dx = (a.col - b.col) * REGION_WIDTH;
    const dy = (a.row - b.row) * REGION_HEIGHT;

    return Math.hypot(dx, dy);
}

function jitteredRegion (col: number, row: number, salt: number): { x: number; y: number } {
    const at = regionCenter(col, row);
    const rng = mulberry32((0x9e3779b9 + salt * 17 + col * 131 + row * 257) >>> 0);

    return {
        x: at.x + (rng() - 0.5) * REGION_WIDTH * 0.45,
        y: at.y + (rng() - 0.5) * REGION_HEIGHT * 0.45
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
