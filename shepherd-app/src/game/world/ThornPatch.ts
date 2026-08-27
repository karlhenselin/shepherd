import { GameObjects, Scene } from 'phaser';
import { PASTURE_COL, PASTURE_ROW, START_COL, START_ROW, WATER_COL, WATER_ROW, regionCenter } from './constants';

const TEXTURE_KEY = 'thorns';
const FALLBACK_KEY = 'thorns-drawn';
const SNAG_RANGE = 72;
const DISPLAY = 72;

export class ThornPatch {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        const key = ensureThornTexture(scene);
        this.sprite = scene.add.sprite(x, y, key);
        this.sprite.setDisplaySize(DISPLAY, DISPLAY);
        this.sprite.setDepth(3);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    ensnares (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < SNAG_RANGE;
    }
}

/** A few brambles off the main Psalm 23 path (start, pasture, water, map corners). */
const THORN_CELLS: Array<{ col: number; row: number; dx: number; dy: number }> = [
    { col: 2, row: 3, dx: 90, dy: -30 },
    { col: 3, row: 2, dx: -50, dy: 80 },
    { col: 4, row: 4, dx: -70, dy: 50 },
    { col: 1, row: 3, dx: -80, dy: 40 },
    { col: 4, row: 1, dx: 60, dy: -50 },
    { col: 6, row: 3, dx: -90, dy: -30 }
];

export function placeThorns (scene: Scene): ThornPatch[] {
    return THORN_CELLS
        .filter((cell) => !isReserved(cell.col, cell.row))
        .map((cell) => {
            const at = regionCenter(cell.col, cell.row);
            return new ThornPatch(scene, at.x + cell.dx, at.y + cell.dy);
        });
}

function isReserved (col: number, row: number): boolean {
    if (col === START_COL && row === START_ROW) {
        return true;
    }

    if (col === PASTURE_COL && row === PASTURE_ROW) {
        return true;
    }

    if (col === WATER_COL && row === WATER_ROW) {
        return true;
    }

    const edgeCol = col === 0 || col === 6;
    const edgeRow = row === 0 || row === 6;

    return edgeCol && edgeRow;
}

function ensureThornTexture (scene: Scene): string {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return TEXTURE_KEY;
    }

    if (scene.textures.exists(FALLBACK_KEY)) {
        return FALLBACK_KEY;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(24, 40, 28, 10);
    g.lineStyle(3, 0x5c4634, 1);
    g.strokeCircle(18, 22, 10);
    g.strokeCircle(30, 20, 9);
    g.fillStyle(0x6b8f4e, 1);
    g.fillCircle(16, 16, 3);
    g.fillCircle(28, 14, 3);
    g.fillStyle(0xc4a574, 1);
    g.fillTriangle(12, 18, 8, 10, 14, 16);
    g.fillTriangle(34, 22, 40, 14, 32, 20);
    g.generateTexture(FALLBACK_KEY, 48, 48);
    g.destroy();
    return FALLBACK_KEY;
}
