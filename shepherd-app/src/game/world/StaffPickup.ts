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
        scene.textures.remove(TEXTURE_KEY);
    }

    const g = scene.add.graphics();
    const thick = 2.5;
    const shaftX = 8;
    const top = 12;
    const length = 30;
    const hookR = 6.5;
    const mid = shaftX + thick / 2;
    const cx = mid + hookR;
    const cy = top;
    const start = Math.PI;
    const end = Math.PI * 2 + 0.95;
    const steps = 20;

    g.fillStyle(0x7a5c3e, 1);
    g.fillRect(shaftX, top, thick, length);

    for (let i = 0; i <= steps; i++) {
        const a = start + (end - start) * (i / steps);
        g.fillCircle(cx + Math.cos(a) * hookR, cy + Math.sin(a) * hookR, thick / 2);
    }

    g.fillStyle(0xb08960, 1);
    g.fillRect(shaftX + 1, top + 5, 1, length - 10);
    g.generateTexture(TEXTURE_KEY, 28, 46);
    g.destroy();
}
