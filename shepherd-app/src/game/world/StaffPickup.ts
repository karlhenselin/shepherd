import { GameObjects, Scene } from 'phaser';

const PICKUP_RANGE = 80;
const TEXTURE_KEY = 'staff-pickup';

export class StaffPickup {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureStaffTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDepth(4);
        this.sprite.setAngle(-38);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < PICKUP_RANGE;
    }

    destroy (): void {
        this.sprite.destroy();
    }
}

function ensureStaffTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x7a5c3e, 1);
    g.fillRect(18, 6, 5, 36);
    g.fillCircle(16, 8, 5);
    g.fillCircle(12, 7, 4.5);
    g.fillCircle(9, 11, 4);
    g.fillStyle(0xb08960, 1);
    g.fillRect(19, 10, 2, 24);
    g.generateTexture(TEXTURE_KEY, 28, 46);
    g.destroy();
}
