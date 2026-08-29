import { GameObjects, Scene } from 'phaser';
import { PASTURE_COL, PASTURE_ROW, regionCenter } from './constants';

const DISPLAY_SIZE = 56;
/** Hungry sheep peel off the trail to walk to a tuft once this close. */
export const GRASS_APPROACH_RANGE = 180;
/** Stand this close to the plant before chewing. */
export const GRASS_EAT_ARRIVE = 16;
/** After the change, eaten tufts grow back this long after a nibble. */
export const GRASS_GROW_BACK_MS = 15_000;

export class GrassPatch {
    readonly sprite: GameObjects.Sprite;
    private claimed = false;
    eaten = false;
    private eatenAt = 0;

    constructor (scene: Scene, x: number, y: number) {
        ensureGrassTexture(scene);
        ensureEatenGrassTexture(scene);
        this.sprite = scene.add.sprite(x, y, 'grass-tuft');
        this.sprite.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
        this.sprite.setDepth(3);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    get available (): boolean {
        return !this.claimed && !this.eaten;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < GRASS_APPROACH_RANGE;
    }

    /** Reserve this tuft so a second sheep walks to a different plant. */
    claim (): void {
        this.claimed = true;
    }

    markEaten (now: number): void {
        this.claimed = true;
        this.eaten = true;
        this.eatenAt = now;
        this.sprite.setTexture('grass-eaten');
        this.sprite.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
    }

    /** After 1 Corinthians 15:51, restore the tuft once the delay has passed. */
    maybeGrowBack (now: number): void {
        if (!this.eaten || now - this.eatenAt < GRASS_GROW_BACK_MS) {
            return;
        }

        this.claimed = false;
        this.eaten = false;
        this.eatenAt = 0;
        this.sprite.setTexture('grass-tuft');
        this.sprite.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
    }
}

export function placePasture (scene: Scene, center: { x: number; y: number }): GrassPatch[] {
    const patches: GrassPatch[] = [];
    const offsets = [
        [0, 0],
        [36, -18],
        [-32, 22],
        [48, 28],
        [-44, -26],
        [12, 44],
        [-18, -48],
        [72, 0],
        [-68, 8],
        [24, -58],
        [-56, 38],
        [60, 52],
        [-24, 62],
        [88, -32],
        [-80, -36],
        [0, 72],
        [-36, 54],
        [42, -42]
    ];

    for (const [dx, dy] of offsets) {
        patches.push(new GrassPatch(scene, center.x + dx, center.y + dy));
    }

    return patches;
}

/** Smaller grazing spots away from the story pasture. */
function placeGrassExtras (scene: Scene): GrassPatch[] {
    const clusters = [
        { col: 4, row: 3, spots: [[0, 0], [34, 16], [-26, 20], [18, -28], [-32, -14], [42, 8]] },
        { col: 1, row: 5, spots: [[0, 0], [30, -14], [-24, 18], [22, 22], [-28, -12], [8, -32]] },
        { col: 5, row: 1, spots: [[0, 0], [-32, 22], [20, -18], [28, 18], [-18, -24], [8, 32]] },
        { col: 3, row: 4, spots: [[0, 0], [28, 24], [-30, -16], [32, -14], [-22, 22], [6, -34]] }
    ];
    const patches: GrassPatch[] = [];

    for (const cluster of clusters) {
        const center = regionCenter(cluster.col, cluster.row);

        for (const [dx, dy] of cluster.spots) {
            patches.push(new GrassPatch(scene, center.x + dx, center.y + dy));
        }
    }

    return patches;
}

/** Main hungry-beat pasture plus wayside tufts around the map. */
export function placeGrass (scene: Scene): GrassPatch[] {
    return [
        ...placePasture(scene, regionCenter(PASTURE_COL, PASTURE_ROW)),
        ...placeGrassExtras(scene)
    ];
}

function ensureGrassTexture (scene: Scene): void {
    if (scene.textures.exists('grass-tuft')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x5f8a3a, 1);
    g.fillTriangle(16, 4, 10, 28, 18, 28);
    g.fillTriangle(8, 8, 4, 28, 12, 28);
    g.fillTriangle(24, 6, 20, 28, 28, 28);
    g.fillStyle(0x8fbc6a, 1);
    g.fillTriangle(14, 8, 11, 26, 17, 26);
    g.fillTriangle(22, 10, 19, 26, 25, 26);
    g.generateTexture('grass-tuft', 32, 32);
    g.destroy();
}

function ensureEatenGrassTexture (scene: Scene): void {
    if (scene.textures.exists('grass-eaten')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x8a6a42, 1);
    g.fillEllipse(16, 26, 22, 10);
    g.fillStyle(0x6b7a3a, 1);
    g.fillTriangle(12, 18, 10, 26, 14, 26);
    g.fillTriangle(16, 16, 14, 26, 18, 26);
    g.fillTriangle(21, 19, 19, 26, 23, 26);
    g.fillStyle(0x9aaa58, 1);
    g.fillTriangle(14, 20, 13, 26, 16, 26);
    g.generateTexture('grass-eaten', 32, 32);
    g.destroy();
}
