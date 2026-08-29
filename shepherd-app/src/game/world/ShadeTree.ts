import { GameObjects, Scene } from 'phaser';
import { characterDepth, regionCenter } from './constants';

const TEXTURE_KEY = 'shade-tree';
const DISPLAY_W = 210;
const DISPLAY_H = 280;
const SHADE_RX = 88;
const SHADE_RY = 48;

export class ShadeTree {
    readonly sprite: GameObjects.Sprite;
    private readonly shade: GameObjects.Ellipse;

    constructor (scene: Scene, x: number, y: number) {
        ensureTreeTexture(scene);
        this.shade = scene.add.ellipse(x, y + 36, SHADE_RX * 2, SHADE_RY * 2, 0x1a2412, 0.22);
        this.shade.setDepth(1.6);
        this.sprite = scene.add.sprite(x, y - 40, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_W, DISPLAY_H);
        this.sprite.setDepth(characterDepth(y));
    }

    get x (): number {
        return this.shade.x;
    }

    get y (): number {
        return this.shade.y;
    }

    inShade (x: number, y: number): boolean {
        const dx = (x - this.x) / SHADE_RX;
        const dy = (y - this.y) / SHADE_RY;
        return dx * dx + dy * dy <= 1;
    }

    gatherSpot (slot: number, count: number): { x: number; y: number } {
        const spread = (slot - (count - 1) / 2) * 36;
        return { x: this.x + spread, y: this.y + 10 };
    }
}

export function placeShadeTrees (scene: Scene): ShadeTree[] {
    const spots = [
        { col: 1, row: 1, dx: 40, dy: 20 },
        { col: 6, row: 2, dx: -50, dy: 60 },
        { col: 2, row: 5, dx: 70, dy: -40 },
        { col: 5, row: 6, dx: -30, dy: -20 },
        { col: 0, row: 4, dx: 90, dy: 10 }
    ];

    return spots.map((spot) => {
        const center = regionCenter(spot.col, spot.row);
        return new ShadeTree(scene, center.x + spot.dx, center.y + spot.dy);
    });
}

function ensureTreeTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3d2c1e, 1);
    g.fillRect(28, 40, 8, 28);
    g.fillStyle(0x3a6b32, 1);
    g.fillCircle(32, 28, 22);
    g.fillStyle(0x4f8a3e, 1);
    g.fillCircle(24, 24, 12);
    g.fillCircle(40, 22, 11);
    g.generateTexture(TEXTURE_KEY, 64, 72);
    g.destroy();
}
