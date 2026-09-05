import { GameObjects, Scene, Textures } from 'phaser';
import {
    REGION_HEIGHT,
    REGION_WIDTH,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    startCenter
} from './constants';
import { Wash, mulberry32, paintWash } from './watercolorPaint';

const LAYERS = 8;
const STEP_MS = 80;
const CREATION_DEPTH = 0;
const RAIN_DEPTH = 1;
const CELL = 283;
const VIEW_PAD = 240;
const MAX_PENDING = 8;
const FALL_PX = 210;
const INTRO_BLOB_SIZE = 4.485;
const WORLD_BLOB_SIZE = INTRO_BLOB_SIZE * 2;

type HeavenWash = Wash & { sky?: string };

const HEAVENS: HeavenWash[] = [
    { x: 0.50, y: 0.20, rx: 0.72, ry: 0.32, color: '#f0e4d0', sky: '#c5d8ea', sides: 10 },
    { x: 0.28, y: 0.16, rx: 0.36, ry: 0.22, color: '#e8c992', sky: '#8eafd0', sides: 8 },
    { x: 0.74, y: 0.14, rx: 0.34, ry: 0.20, color: '#d4b896', sky: '#7a9cc4', sides: 8 },
    { x: 0.50, y: 0.38, rx: 0.58, ry: 0.16, color: '#f0d5a8', sides: 8 },
    { x: 0.22, y: 0.30, rx: 0.24, ry: 0.12, color: '#f7f0e4', sides: 7 },
    { x: 0.68, y: 0.26, rx: 0.26, ry: 0.12, color: '#fff8ee', sides: 7 }
];

const EARTH: Wash[] = [
    { x: 0.50, y: 0.74, rx: 0.72, ry: 0.36, color: '#c4a574', sides: 10 },
    { x: 0.32, y: 0.62, rx: 0.34, ry: 0.22, color: '#8fbc7a', sides: 8 },
    { x: 0.58, y: 0.68, rx: 0.30, ry: 0.24, color: '#7eab6a', sides: 8 },
    { x: 0.72, y: 0.80, rx: 0.28, ry: 0.20, color: '#6b8f4e', sides: 8 },
    { x: 0.24, y: 0.82, rx: 0.26, ry: 0.16, color: '#a67c52', sides: 7 },
    { x: 0.48, y: 0.86, rx: 0.24, ry: 0.14, color: '#d8c4a0', sides: 7 }
];

const GOLD = ['#f0d5a8', '#e8c992', '#f7f0e4', '#d4b896', '#efe4d0', '#fff8ee'];
const LAND = ['#c4a574', '#8fbc7a', '#7eab6a', '#6b8f4e', '#a67c52', '#d8c4a0', '#7a5c3e', '#f4f0e6'];

type DropSpec = {
    x: number;
    y: number;
    rx: number;
    ry: number;
    color: string;
    alpha: number;
    seed: number;
    creation?: boolean;
    groundColor?: string;
};

type PaintBlob = {
    key: string;
    x: number;
    y: number;
    radius: number;
    width: number;
    height: number;
    depth: number;
    spec: DropSpec;
    painter: { canvas: HTMLCanvasElement; step: () => boolean };
    texture: Textures.CanvasTexture;
    done: boolean;
    image?: GameObjects.Image;
};

export class WatercolorWorld {
    private readonly blobs: PaintBlob[] = [];
    private readonly pending: DropSpec[] = [];
    private readonly creationQueue: DropSpec[] = [];
    private readonly painted: Uint8Array;
    private readonly gridCols: number;
    private readonly gridRows: number;
    private nextStepAt = 0;
    private nextBlobId = 1;
    private creationStarted = false;

    constructor () {
        this.gridCols = Math.ceil(WORLD_WIDTH / CELL);
        this.gridRows = Math.ceil(WORLD_HEIGHT / CELL);
        this.painted = new Uint8Array(this.gridCols * this.gridRows);
    }

    /** World center of the main intro sky wash — keep this on screen in landscape. */
    heavenFocus (): { x: number; y: number } {
        const start = startCenter();
        const wash = HEAVENS[0];

        return {
            x: start.x - REGION_WIDTH / 2 + wash.x * REGION_WIDTH,
            y: start.y - REGION_HEIGHT / 2 + wash.y * REGION_HEIGHT
        };
    }

    beginCreation (asSky = false): void {
        if (this.creationStarted) {
            return;
        }

        this.creationStarted = true;

        const start = startCenter();
        const originX = start.x - REGION_WIDTH / 2;
        const originY = start.y - REGION_HEIGHT / 2;

        for (const [index, wash] of [...HEAVENS, ...EARTH].entries()) {
            const skyColor = 'sky' in wash && typeof wash.sky === 'string' ? wash.sky : undefined;

            this.creationQueue.push({
                x: originX + wash.x * REGION_WIDTH,
                y: originY + wash.y * REGION_HEIGHT,
                rx: wash.rx * REGION_WIDTH,
                ry: wash.ry * REGION_HEIGHT,
                color: asSky && skyColor ? skyColor : wash.color,
                alpha: wash.y < 0.5 ? 0.13 : 0.11,
                seed: seedFor(index + 1),
                creation: true,
                groundColor: asSky && skyColor ? wash.color : undefined
            });
        }
    }

    creationSpawned (): boolean {
        return this.creationStarted && this.creationQueue.length === 0;
    }

    attachToWorld (scene: Scene): void {
        this.settleSkyToGround();
        this.stripOldRegionTiles(scene);
        this.painted.fill(0);

        for (const blob of this.blobs) {
            this.placeBlob(scene, blob);
            blob.image?.setPosition(blob.x, blob.y).setAlpha(1).setDepth(blob.depth);

            if (blob.depth === RAIN_DEPTH) {
                this.markCoverage(blob.x, blob.y, blob.radius);
            }
        }
    }

    rainIntoView (scene: Scene): void {
        if (this.pending.length >= MAX_PENDING) {
            return;
        }

        const gap = this.pickGap(scene);

        if (!gap) {
            return;
        }

        const rng = mulberry32(seedFor(this.nextBlobId + gap.cx * 13 + gap.cy * 29));
        const x = clamp(gap.x + (rng() - 0.5) * CELL * 0.6, 40, WORLD_WIDTH - 40);
        const y = clamp(gap.y + (rng() - 0.5) * CELL * 0.6, 40, WORLD_HEIGHT - 40);
        const rx = 90 + rng() * 80;
        const ry = 70 + rng() * 70;

        this.markCoverage(x, y, Math.max(rx, ry) * 0.85);
        this.pending.push({
            x,
            y,
            rx,
            ry,
            color: trailColor(x, y, rng),
            alpha: 0.12,
            seed: seedFor(this.nextBlobId)
        });
    }

    tick (scene: Scene, time: number): void {
        if (time < this.nextStepAt) {
            return;
        }

        this.nextStepAt = time + STEP_MS;

        const drops = this.creationQueue.length > 0 ? 1 : 2;

        for (let i = 0; i < drops; i++) {
            this.spawnNext(scene);
        }

        for (const blob of this.blobs) {
            if (!blob.done) {
                this.stepBlob(blob);
            }
        }
    }

    private settleSkyToGround (): void {
        for (const spec of this.creationQueue) {
            if (!spec.groundColor) {
                continue;
            }

            spec.color = spec.groundColor;
            spec.groundColor = undefined;
        }

        for (const blob of this.blobs) {
            if (!blob.spec.groundColor) {
                continue;
            }

            blob.spec.color = blob.spec.groundColor;
            blob.spec.groundColor = undefined;
            blob.painter = createBlobPainter(blob.spec, mulberry32(blob.spec.seed), blob.painter.canvas);

            for (let layer = 0; layer < LAYERS; layer++) {
                blob.painter.step();
            }

            blob.done = true;
            blob.texture.refresh();
        }
    }

    private spawnNext (scene: Scene): void {
        const spec = this.creationQueue.shift() ?? this.pending.shift();

        if (!spec) {
            return;
        }

        const blob = this.createBlob(scene, spec);
        this.blobs.push(blob);

        if (!spec.creation) {
            this.markCoverage(blob.x, blob.y, blob.radius);
        }

        this.stepBlob(blob);
        this.fallIn(scene, blob, spec.seed);
    }

    private createBlob (scene: Scene, spec: DropSpec): PaintBlob {
        const key = `watercolor-blob-${this.nextBlobId}`;
        this.nextBlobId += 1;

        const rng = mulberry32(spec.seed);
        const painter = createBlobPainter(spec, rng);

        if (scene.textures.exists(key)) {
            scene.textures.remove(key);
        }

        const texture = scene.textures.addCanvas(key, painter.canvas);

        if (!texture) {
            throw new Error(`Could not create watercolor blob ${key}`);
        }

        const size = spec.creation ? INTRO_BLOB_SIZE : WORLD_BLOB_SIZE;
        const blob: PaintBlob = {
            key,
            x: spec.x,
            y: spec.y,
            radius: Math.max(spec.rx, spec.ry),
            width: spec.rx * size,
            height: spec.ry * size,
            depth: spec.creation ? CREATION_DEPTH : RAIN_DEPTH,
            spec,
            painter,
            texture,
            done: false
        };

        this.placeBlob(scene, blob);
        return blob;
    }

    private placeBlob (scene: Scene, blob: PaintBlob): GameObjects.Image {
        if (blob.image?.active && blob.image.scene === scene) {
            blob.image.setPosition(blob.x, blob.y);
            blob.image.setDisplaySize(blob.width, blob.height);
            blob.image.setDepth(blob.depth);
            return blob.image;
        }

        blob.image = scene.add.image(blob.x, blob.y, blob.key).setDepth(blob.depth);
        blob.image.setDisplaySize(blob.width, blob.height);
        return blob.image;
    }

    private fallIn (scene: Scene, blob: PaintBlob, seed: number): void {
        const image = blob.image;

        if (!image) {
            return;
        }

        image.setDisplaySize(blob.width, blob.height);

        const rng = mulberry32(seed ^ 0x51ed);
        const fromY = blob.y - (FALL_PX + rng() * 90);
        const landScaleX = image.scaleX;
        const landScaleY = image.scaleY;

        image.setPosition(blob.x, fromY);
        image.setAlpha(0.15);
        image.setScale(landScaleX * 0.72, landScaleY * 0.72);

        scene.tweens.add({
            targets: image,
            y: blob.y,
            alpha: 1,
            scaleX: landScaleX,
            scaleY: landScaleY,
            duration: 520 + rng() * 280,
            ease: 'Cubic.easeIn'
        });
    }

    private stepBlob (blob: PaintBlob): void {
        if (blob.done) {
            return;
        }

        const more = blob.painter.step();
        blob.texture.refresh();

        if (!more) {
            blob.done = true;
        }
    }

    private pickGap (scene: Scene): { cx: number; cy: number; x: number; y: number } | null {
        const view = scene.cameras.main.worldView;
        const left = Math.max(0, Math.floor((view.x - VIEW_PAD) / CELL));
        const right = Math.min(this.gridCols - 1, Math.floor((view.right + VIEW_PAD) / CELL));
        const top = Math.max(0, Math.floor((view.y - VIEW_PAD) / CELL));
        const bottom = Math.min(this.gridRows - 1, Math.floor((view.bottom + VIEW_PAD) / CELL));
        const gaps: { cx: number; cy: number; x: number; y: number }[] = [];

        for (let cy = top; cy <= bottom; cy++) {
            for (let cx = left; cx <= right; cx++) {
                if (this.painted[cy * this.gridCols + cx]) {
                    continue;
                }

                gaps.push({
                    cx,
                    cy,
                    x: (cx + 0.5) * CELL,
                    y: (cy + 0.5) * CELL
                });
            }
        }

        if (gaps.length === 0) {
            return null;
        }

        gaps.sort((a, b) => a.y - b.y || a.x - b.x);
        const rainFront = Math.max(1, Math.ceil(gaps.length * 0.35));
        return gaps[Math.floor(Math.random() * rainFront)];
    }

    private markCoverage (x: number, y: number, radius: number): void {
        const reach = Math.max(CELL * 0.7, radius * 0.7);
        const left = Math.max(0, Math.floor((x - reach) / CELL));
        const right = Math.min(this.gridCols - 1, Math.floor((x + reach) / CELL));
        const top = Math.max(0, Math.floor((y - reach) / CELL));
        const bottom = Math.min(this.gridRows - 1, Math.floor((y + reach) / CELL));

        for (let cy = top; cy <= bottom; cy++) {
            for (let cx = left; cx <= right; cx++) {
                const px = (cx + 0.5) * CELL;
                const py = (cy + 0.5) * CELL;

                if (Math.hypot(px - x, py - y) <= reach) {
                    this.painted[cy * this.gridCols + cx] = 1;
                }
            }
        }
    }

    private stripOldRegionTiles (scene: Scene): void {
        for (const tex of scene.textures.getTextureKeys()) {
            if (!tex.startsWith('watercolor-region-')) {
                continue;
            }

            const images = scene.children.list.filter((child) => {
                return 'texture' in child && (child as GameObjects.Image).texture?.key === tex;
            });

            for (const image of images) {
                image.destroy();
            }

            scene.textures.remove(tex);
        }
    }
}

let instance: WatercolorWorld | null = null;

export function watercolorWorld (): WatercolorWorld {
    if (!instance) {
        instance = new WatercolorWorld();
    }

    return instance;
}

function createBlobPainter (
    spec: DropSpec,
    rng: () => number,
    existing?: HTMLCanvasElement
): { canvas: HTMLCanvasElement; step: () => boolean } {
    // Match canvas aspect to the blob so tall/wide washes aren't clipped into
    // a hard horizontal (or vertical) edge by a square texture.
    const aspect = clamp(spec.ry / Math.max(spec.rx, 1), 0.25, 4);
    const base = 512;
    const canvasW = aspect >= 1 ? base : Math.round(base / aspect);
    const canvasH = aspect >= 1 ? Math.round(base * aspect) : base;

    const canvas = existing ?? document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create watercolor blob canvas');
    }

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Normalized circle on an aspect-matched canvas → correct ellipse in pixels,
    // with margin left for deformPolygon wander so edges stay soft.
    const wash: Wash = {
        x: 0.5,
        y: 0.5,
        rx: 0.36,
        ry: 0.36,
        color: spec.color,
        sides: 7 + Math.floor(rng() * 4)
    };

    let layer = 0;

    return {
        canvas,
        step: () => {
            if (layer >= LAYERS) {
                return false;
            }

            paintWash(ctx, wash, rng, spec.alpha, 1);
            layer += 1;
            return layer < LAYERS;
        }
    };
}

function trailColor (_x: number, y: number, rng: () => number): string {
    const start = startCenter();
    const north = (start.y - y) / WORLD_HEIGHT;
    const goldChance = 0.22 + Math.max(0, north) * 0.5;
    const palette = rng() < goldChance ? GOLD : LAND;
    return palette[Math.floor(rng() * palette.length)];
}

function seedFor (id: number): number {
    return (id * 83492791 ^ 0x1eaf) >>> 0;
}

function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
