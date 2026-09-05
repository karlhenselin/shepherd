import { GameObjects, Scene } from 'phaser';
import { characterDepth, regionCenter } from './constants';

const TEXTURE_KEY = 'shade-tree';
const DISPLAY_W = 231;
const DISPLAY_H = 308;
const SHADE_RX = 132;
const SHADE_RY = 72;
const SHADE_COLOR = 0x0d120a;
const SHADE_ALPHA = 0.33;
const SHADE_Y_OFFSET = 40;
const TRUNK_Y_OFFSET = 44;

export class ShadeTree {
    readonly sprite: GameObjects.Sprite;
    private readonly shade: GameObjects.Ellipse;

    constructor (scene: Scene, x: number, y: number) {
        ensureTreeTexture(scene);
        this.shade = scene.add.ellipse(x, y + SHADE_Y_OFFSET, SHADE_RX * 2, SHADE_RY * 2, SHADE_COLOR, SHADE_ALPHA);
        this.shade.setDepth(1.6);
        this.sprite = scene.add.sprite(x, y - TRUNK_Y_OFFSET, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_W, DISPLAY_H);
        this.sprite.setDepth(characterDepth(y));
    }

    /** Ground shade oval — hide at night when there is no sun to cast it. */
    setShadeVisible (visible: boolean): void {
        this.shade.setVisible(visible);
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

    /** Center of the shade oval — shepherd kneels here after walking in. */
    restSpot (): { x: number; y: number } {
        return { x: this.x, y: this.y + 10 };
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
        { col: 0, row: 4, dx: 90, dy: 10 },
        { col: 3, row: 1, dx: -40, dy: 50 },
        { col: 4, row: 2, dx: 55, dy: -25 },
        { col: 0, row: 1, dx: 75, dy: 35 },
        { col: 3, row: 5, dx: -45, dy: 25 },
        { col: 6, row: 4, dx: -65, dy: -35 },
        { col: 2, row: 0, dx: 30, dy: 60 },
        { col: 1, row: 6, dx: 50, dy: -45 }
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
