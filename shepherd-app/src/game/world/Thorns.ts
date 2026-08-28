import { GameObjects, Scene } from 'phaser';
import { regionCenter } from './constants';

const TEXTURE_KEY = 'thorns';
const DISPLAY_SIZE = 72;
export const THORN_SNARE_RADIUS = 38;

export class Thorns {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureThornsTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE);
        this.sprite.setDepth(2);
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

/** A few brambles around the map, clear of pasture / water / start. */
export function placeThorns (scene: Scene): Thorns[] {
    const spots = [
        { col: 1, row: 3, dx: 80, dy: -40 },
        { col: 4, row: 1, dx: -60, dy: 90 },
        { col: 6, row: 3, dx: -40, dy: 50 },
        { col: 2, row: 5, dx: 70, dy: -70 },
        { col: 5, row: 5, dx: -90, dy: 20 }
    ];

    return spots.map((spot) => {
        const center = regionCenter(spot.col, spot.row);
        return new Thorns(scene, center.x + spot.dx, center.y + spot.dy);
    });
}

function ensureThornsTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3d2c1e, 1);
    g.fillCircle(24, 28, 16);
    g.fillStyle(0x5c4634, 1);
    g.fillCircle(18, 22, 8);
    g.fillCircle(30, 20, 7);
    g.lineStyle(2, 0x2a1c12, 1);
    g.lineBetween(24, 16, 12, 6);
    g.lineBetween(24, 16, 36, 8);
    g.lineBetween(24, 18, 8, 20);
    g.generateTexture(TEXTURE_KEY, 48, 48);
    g.destroy();
}
