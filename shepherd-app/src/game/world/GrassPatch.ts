import { GameObjects, Scene } from 'phaser';

const EAT_RANGE = 70;

export class GrassPatch {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureGrassTexture(scene);
        this.sprite = scene.add.sprite(x, y, 'grass-tuft');
        this.sprite.setDisplaySize(56, 56);
        this.sprite.setDepth(3);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < EAT_RANGE;
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
