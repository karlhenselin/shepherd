import { GameObjects, Scene } from 'phaser';

const DISPLAY_SIZE = 56;
/** Hungry sheep peel off the trail to walk to a tuft once this close. */
export const GRASS_APPROACH_RANGE = 180;
/** Stand this close to the plant before chewing. */
export const GRASS_EAT_ARRIVE = 16;

export class GrassPatch {
    readonly sprite: GameObjects.Sprite;
    private claimed = false;
    eaten = false;

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

    markEaten (): void {
        this.claimed = true;
        this.eaten = true;
        this.sprite.setTexture('grass-eaten');
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
        [-18, -48]
    ];

    for (const [dx, dy] of offsets) {
        patches.push(new GrassPatch(scene, center.x + dx, center.y + dy));
    }

    return patches;
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
