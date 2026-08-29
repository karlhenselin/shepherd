import { GameObjects, Scene } from 'phaser';
import { regionCenter, WATER_COL, WATER_ROW } from './constants';

const DRINK_RANGE = 120;
const TEXTURE_KEY = 'water-source';
const LAKE_WIDTH = 260;
const LAKE_HEIGHT = 173;

export class WaterSource {
    readonly sprite: GameObjects.Sprite;
    private readonly range: number;

    constructor (scene: Scene, x: number, y: number, scale = 1) {
        if (!scene.textures.exists(TEXTURE_KEY)) {
            throw new Error('Water source texture was not loaded');
        }

        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(LAKE_WIDTH * scale, LAKE_HEIGHT * scale);
        this.sprite.setDepth(2);
        this.range = DRINK_RANGE * Math.max(0.72, scale);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < this.range;
    }
}

/** Story lake plus a few extra watering holes around the map. */
export function placeWaters (scene: Scene): WaterSource[] {
    const main = regionCenter(WATER_COL, WATER_ROW);
    const extras = [
        { col: 1, row: 4, dx: 40, dy: -30, scale: 0.52 },
        { col: 4, row: 1, dx: -70, dy: 50, scale: 0.48 },
        { col: 6, row: 5, dx: 20, dy: -40, scale: 0.55 },
        { col: 3, row: 6, dx: -40, dy: 20, scale: 0.50 }
    ];

    return [
        new WaterSource(scene, main.x, main.y, 1),
        ...extras.map((spot) => {
            const center = regionCenter(spot.col, spot.row);
            return new WaterSource(scene, center.x + spot.dx, center.y + spot.dy, spot.scale);
        })
    ];
}
