import { GameObjects, Scene } from 'phaser';
import { characterDepth, regionCenter } from './constants';
import { WaterSource } from './WaterSource';

const BRAMBLE_KEY = 'thorns';
const ROSES_KEY = 'thorns-roses';
const DISPLAY_SIZE = 180;
export const THORN_SNARE_RADIUS = 95;
/** After the change: close enough to a bloomed bush to hear Ezekiel 28:24. */
export const THORN_WALK_BY_RADIUS = 120;
const THORN_MIN_GAP = 200;
const WATER_EDGE_MARGIN = 16;
/** Ground decal: above water/holes, below grass and Y-sorted characters. */
const MOUND_DEPTH = 2.35;
const DEFAULT_STEM_ORIGIN = 0.64;
/** Foliage alpha while a sheep is nestled inside (easier to see / bandage). */
const SNARE_FOLIAGE_ALPHA = 0.48;

const stemOriginY: Record<string, number> = {};

export class Thorns {
    readonly sprite: GameObjects.Sprite;
    private readonly mound: GameObjects.Image;
    /** After 1 Corinthians 15:51, roses bloom and the bush no longer snares. */
    bloomed = false;

    constructor (scene: Scene, x: number, y: number) {
        this.mound = scene.add.image(x, y, moundKey(BRAMBLE_KEY));
        this.sprite = scene.add.sprite(x, y, BRAMBLE_KEY);
        this.applyLook(BRAMBLE_KEY);
        this.mound.setDepth(MOUND_DEPTH);
        this.sprite.setDepth(characterDepth(y));
    }

    bloom (): void {
        if (this.bloomed) {
            return;
        }

        this.bloomed = true;
        this.applyLook(ROSES_KEY);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    contains (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < THORN_SNARE_RADIUS;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < THORN_WALK_BY_RADIUS;
    }

    /** Deep in the foliage (above the stem origin), not on the snare rim. */
    snareSpot (): { x: number; y: number } {
        return {
            x: this.x,
            y: this.y - DISPLAY_SIZE * 0.24 + 30
        };
    }

    /** Soften the canopy so a snared sheep reads clearly. */
    revealSnare (): void {
        this.sprite.setAlpha(SNARE_FOLIAGE_ALPHA);
    }

    /** Restore full foliage after the sheep is freed. */
    hideSnare (): void {
        this.sprite.setAlpha(1);
    }

    private applyLook (plantKey: string): void {
        const originY = stemOriginY[plantKey] ?? DEFAULT_STEM_ORIGIN;
        this.sprite.setTexture(plantKey);
        this.sprite.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
        this.sprite.setOrigin(0.5, originY);
        this.mound.setTexture(moundKey(plantKey));
        this.mound.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
        this.mound.setOrigin(0.5, originY);
    }
}

/** Peel dirt discs off the plant sprites so characters Y-sort against foliage only. */
export function prepareThornArt (scene: Scene): void {
    splitThornGround(scene, BRAMBLE_KEY);
    splitThornGround(scene, ROSES_KEY);
}

/** Bramble patches around the map, clear of water and each other. */
export function placeThorns (scene: Scene, waters: WaterSource[] = []): Thorns[] {
    const spots = [
        { col: 1, row: 3, dx: 80, dy: -40 },
        { col: 4, row: 1, dx: -60, dy: 90 },
        { col: 6, row: 3, dx: -40, dy: 50 },
        { col: 2, row: 5, dx: 70, dy: -70 },
        { col: 5, row: 5, dx: -90, dy: 20 },
        { col: 0, row: 2, dx: 120, dy: 30 },
        { col: 0, row: 5, dx: 100, dy: -20 },
        { col: 1, row: 0, dx: 50, dy: 80 },
        { col: 1, row: 6, dx: 60, dy: -60 },
        { col: 2, row: 1, dx: -80, dy: 40 },
        { col: 2, row: 3, dx: 90, dy: 60 },
        { col: 3, row: 0, dx: 0, dy: 70 },
        { col: 3, row: 2, dx: -100, dy: -30 },
        { col: 3, row: 6, dx: 40, dy: -50 },
        { col: 4, row: 4, dx: -70, dy: -80 },
        { col: 4, row: 6, dx: 80, dy: 30 },
        { col: 5, row: 0, dx: -50, dy: 100 },
        { col: 5, row: 2, dx: 60, dy: -40 },
        { col: 5, row: 4, dx: -30, dy: 70 },
        { col: 6, row: 0, dx: -80, dy: 60 },
        { col: 6, row: 1, dx: 40, dy: -20 },
        { col: 6, row: 5, dx: -60, dy: -40 },
        { col: 0, row: 3, dx: 70, dy: 50 },
        { col: 1, row: 4, dx: -40, dy: -60 },
        { col: 4, row: 5, dx: 50, dy: -30 }
    ];
    const placed: Thorns[] = [];

    for (const spot of spots) {
        const center = regionCenter(spot.col, spot.row);
        const point = pickThornPoint(center.x + spot.dx, center.y + spot.dy, waters, placed);

        if (point) {
            placed.push(new Thorns(scene, point.x, point.y));
        }
    }

    return placed;
}

function moundKey (plantKey: string): string {
    return `${plantKey}-mound`;
}

function pickThornPoint (
    x: number,
    y: number,
    waters: WaterSource[],
    placed: Thorns[]
): { x: number; y: number } | null {
    if (isValidThornSpot(x, y, waters, placed)) {
        return { x, y };
    }

    for (let ring = 1; ring <= 4; ring++) {
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 + ring * 0.4;
            const jx = x + Math.cos(angle) * ring * 72;
            const jy = y + Math.sin(angle) * ring * 72;

            if (isValidThornSpot(jx, jy, waters, placed)) {
                return { x: jx, y: jy };
            }
        }
    }

    return null;
}

function isValidThornSpot (
    x: number,
    y: number,
    waters: WaterSource[],
    placed: Thorns[]
): boolean {
    for (const water of waters) {
        const minDist = water.keepOutRadius() + THORN_SNARE_RADIUS + WATER_EDGE_MARGIN;

        if (Math.hypot(x - water.x, y - water.y) < minDist) {
            return false;
        }
    }

    for (const thorn of placed) {
        if (Math.hypot(x - thorn.x, y - thorn.y) < THORN_MIN_GAP) {
            return false;
        }
    }

    return true;
}

function splitThornGround (scene: Scene, key: string): void {
    if (!scene.textures.exists(key) || scene.textures.exists(moundKey(key))) {
        return;
    }

    const texture = scene.textures.get(key);
    const src = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = src.width;
    const height = src.height;
    const read = document.createElement('canvas');
    read.width = width;
    read.height = height;
    const readCtx = read.getContext('2d');

    if (!readCtx) {
        return;
    }

    readCtx.drawImage(src, 0, 0);
    const image = readCtx.getImageData(0, 0, width, height);
    const px = image.data;
    const ellipse = fitDirtEllipse(px, width, height);

    if (!ellipse) {
        stemOriginY[key] = DEFAULT_STEM_ORIGIN;
        return;
    }

    stemOriginY[key] = ellipse.cy / height;

    const mound = readCtx.createImageData(width, height);
    const plant = readCtx.createImageData(width, height);
    const moundPx = mound.data;
    const plantPx = plant.data;

    for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];

        if (a < 24) {
            continue;
        }

        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];

        if (r <= 12 && g <= 12 && b <= 12) {
            continue;
        }

        const p = i / 4;
        const x = p % width;
        const y = (p - x) / width;
        const dx = (x - ellipse.cx) / ellipse.rx;
        const dy = (y - ellipse.cy) / ellipse.ry;
        const inDisc = dx * dx + dy * dy <= 1.08;
        const vegetation = isFlowerColor(r, g, b) || isLeafColor(r, g, b) || isThornWood(r, g, b);
        const ground = inDisc && !vegetation && (isDirtColor(r, g, b) || y >= ellipse.cy - 4);

        if (ground) {
            moundPx[i] = r;
            moundPx[i + 1] = g;
            moundPx[i + 2] = b;
            moundPx[i + 3] = a;
        }
        else {
            plantPx[i] = r;
            plantPx[i + 1] = g;
            plantPx[i + 2] = b;
            plantPx[i + 3] = a;
        }
    }

    const plantCanvas = document.createElement('canvas');
    plantCanvas.width = width;
    plantCanvas.height = height;
    const plantCtx = plantCanvas.getContext('2d');
    const moundCanvas = document.createElement('canvas');
    moundCanvas.width = width;
    moundCanvas.height = height;
    const moundCtx = moundCanvas.getContext('2d');

    if (!plantCtx || !moundCtx) {
        return;
    }

    plantCtx.putImageData(plant, 0, 0);
    moundCtx.putImageData(mound, 0, 0);
    scene.textures.remove(key);
    scene.textures.addCanvas(key, plantCanvas);
    scene.textures.addCanvas(moundKey(key), moundCanvas);
}

function fitDirtEllipse (
    px: Uint8ClampedArray,
    width: number,
    height: number
): { cx: number; cy: number; rx: number; ry: number } | null {
    let minY = height;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
        if (rowSpan(px, width, y).span > 0) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }

    if (maxY <= minY) {
        return null;
    }

    const startY = Math.floor(minY + (maxY - minY) * 0.45);
    let bestY = startY;
    let bestSpan = 0;
    let bestMinX = 0;
    let bestMaxX = 0;

    for (let y = startY; y <= maxY; y++) {
        const row = rowSpan(px, width, y);

        if (row.span > bestSpan) {
            bestSpan = row.span;
            bestY = y;
            bestMinX = row.minX;
            bestMaxX = row.maxX;
        }
    }

    if (bestSpan < 8) {
        return null;
    }

    const cx = (bestMinX + bestMaxX) / 2;
    const cy = bestY;
    const rx = Math.max(8, bestSpan / 2);
    const ry = Math.max(8, maxY - cy);
    return { cx, cy, rx, ry };
}

function rowSpan (
    px: Uint8ClampedArray,
    width: number,
    y: number
): { span: number; minX: number; maxX: number } {
    let minX = width;
    let maxX = 0;

    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = px[i + 3];
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];

        if (a < 24 || (r <= 12 && g <= 12 && b <= 12)) {
            continue;
        }

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
    }

    if (maxX < minX) {
        return { span: 0, minX: 0, maxX: 0 };
    }

    return { span: maxX - minX + 1, minX, maxX };
}

function isFlowerColor (r: number, g: number, b: number): boolean {
    return r > 130 && r > g + 35 && r > b + 20;
}

function isLeafColor (r: number, g: number, b: number): boolean {
    return g > r + 12 && g > b + 8;
}

function isThornWood (r: number, g: number, b: number): boolean {
    return r < 80 && g < 62 && b < 52 && r + g + b < 180;
}

/** Sandy earth, pebbles, and dry grass — not thorn wood, leaves, or roses. */
function isDirtColor (r: number, g: number, b: number): boolean {
    if (isFlowerColor(r, g, b) || isLeafColor(r, g, b) || isThornWood(r, g, b)) {
        return false;
    }

    const gray = Math.abs(r - g) < 28 && Math.abs(g - b) < 28;
    const pebble = gray && r > 70 && r < 190;
    const sand = r > 70 && g > 42 && b < 110 && r >= g - 8 && r - b > 12;
    const dryGrass = r > 90 && g > 68 && b < 90 && r + g > b * 3;
    return pebble || sand || dryGrass;
}
