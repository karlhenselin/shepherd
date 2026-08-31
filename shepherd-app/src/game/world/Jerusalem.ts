import { GameObjects, Scene } from 'phaser';

const TEXTURE_KEY = 'jerusalem';
const DISPLAY_W = 400;
const DISPLAY_H = 320;
const ENTER_RANGE = 170;
/** Stand south of the walls, just outside enter range. */
export const CITY_APPROACH_Y = 240;

export class Jerusalem {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureJerusalemTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_W, DISPLAY_H);
        this.sprite.setOrigin(0.5, 0.62);
        this.sprite.setDepth(2.2);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < ENTER_RANGE;
    }

    coversPoint (x: number, y: number, pad = 28): boolean {
        const bounds = this.sprite.getBounds();

        return x > bounds.x - pad
            && x < bounds.right + pad
            && y > bounds.y - pad
            && y < bounds.bottom + pad;
    }

    approachSpot (): { x: number; y: number } {
        return { x: this.x, y: this.y + CITY_APPROACH_Y };
    }

    destroy (): void {
        this.sprite.destroy();
    }
}

function ensureJerusalemTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0xc4b896, 1);
    g.fillRoundedRect(16, 28, 96, 64, 6);
    g.fillStyle(0xe8d9b0, 1);
    g.fillRect(40, 12, 48, 28);
    g.fillStyle(0x6b5344, 1);
    g.fillRect(52, 56, 22, 36);
    g.generateTexture(TEXTURE_KEY, 128, 96);
    g.destroy();
}
