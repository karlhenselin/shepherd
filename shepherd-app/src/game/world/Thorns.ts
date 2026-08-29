import { GameObjects, Scene } from 'phaser';
import { characterDepth, regionCenter } from './constants';
import { WaterSource } from './WaterSource';

const TEXTURE_KEY = 'thorns-bramble';
const TEXTURE_SIZE = 192;
const DISPLAY_SIZE = 180;
export const THORN_SNARE_RADIUS = 95;
const THORN_MIN_GAP = 200;
const WATER_EDGE_MARGIN = 16;

type StalkSpec = {
    x: number;
    y: number;
    lean: number;
    height: number;
    width: number;
};

/** Individual stems scattered across the patch — not one dense clump. */
const STALKS: StalkSpec[] = [
    { x: 28, y: 168, lean: -12, height: 108, width: 3 },
    { x: 52, y: 176, lean: 6, height: 96, width: 3 },
    { x: 78, y: 162, lean: -4, height: 118, width: 3.5 },
    { x: 104, y: 170, lean: 10, height: 102, width: 3 },
    { x: 128, y: 158, lean: -8, height: 112, width: 3 },
    { x: 152, y: 166, lean: 5, height: 100, width: 3 },
    { x: 36, y: 148, lean: 14, height: 88, width: 2.5 },
    { x: 64, y: 154, lean: -16, height: 92, width: 2.5 },
    { x: 92, y: 142, lean: 8, height: 104, width: 3 },
    { x: 118, y: 150, lean: -10, height: 94, width: 2.5 },
    { x: 144, y: 138, lean: 12, height: 110, width: 3 },
    { x: 168, y: 152, lean: -6, height: 86, width: 2.5 },
    { x: 44, y: 132, lean: -20, height: 78, width: 2.5 },
    { x: 110, y: 128, lean: 18, height: 82, width: 2.5 },
    { x: 156, y: 124, lean: -14, height: 76, width: 2.5 }
];

export class Thorns {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureThornsTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
        this.sprite.setOrigin(0.5, 0.92);
        this.sprite.setDepth(characterDepth(y));
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

function ensureThornsTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0);
    g.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    for (const stalk of STALKS) {
        drawStalk(g, stalk);
    }

    g.generateTexture(TEXTURE_KEY, TEXTURE_SIZE, TEXTURE_SIZE);
    g.destroy();
}

function drawStalk (g: GameObjects.Graphics, stalk: StalkSpec): void {
    const rad = (stalk.lean * Math.PI) / 180;
    const topX = stalk.x + Math.sin(rad) * stalk.height;
    const topY = stalk.y - Math.cos(rad) * stalk.height;

    g.lineStyle(stalk.width, 0x4a3528, 1);
    g.lineBetween(stalk.x, stalk.y, topX, topY);
    g.lineStyle(Math.max(1.5, stalk.width - 0.5), 0x3d2c1e, 1);
    g.lineBetween(stalk.x + 0.5, stalk.y, topX + 0.5, topY);

    const thornCount = Math.max(4, Math.floor(stalk.height / 18));

    for (let i = 1; i <= thornCount; i++) {
        const t = i / (thornCount + 1);
        const px = stalk.x + Math.sin(rad) * stalk.height * t;
        const py = stalk.y - Math.cos(rad) * stalk.height * t;
        const flip = i % 2 === 0 ? 1 : -1;
        const thornLean = rad + flip * (Math.PI / 2 + 0.35);
        const thornLen = 10 + (i % 3) * 2;

        g.lineStyle(2, 0x2a1c12, 1);
        g.lineBetween(
            px,
            py,
            px + Math.cos(thornLean) * thornLen,
            py + Math.sin(thornLean) * thornLen
        );
        g.fillStyle(0x5c4634, 1);
        g.fillTriangle(
            px,
            py,
            px + Math.cos(thornLean) * thornLen,
            py + Math.sin(thornLean) * thornLen,
            px + Math.cos(thornLean + flip * 0.25) * (thornLen * 0.55),
            py + Math.sin(thornLean + flip * 0.25) * (thornLen * 0.55)
        );
    }

    g.fillStyle(0x6b5340, 1);
    g.fillCircle(topX, topY, 2.5);
}
