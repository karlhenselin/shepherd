import { GameObjects, Scene } from 'phaser';
import { characterDepth, WORLD_HEIGHT, WORLD_WIDTH } from '../world/constants';
import { Shepherd } from './Shepherd';

const TEXTURE_KEY = 'wolf';
const SHADOW_KEY = 'wolf-shadow';
const SIZE = 56;
const SHADOW_OFFSET = 18;
const STALK_DIST = 420;
const STAFF_STALK_DIST = 520;
const TOO_CLOSE = 240;
const SPEED = 78;
const FLEE_SPEED = 150;
const ORBIT_RAD_PER_MS = 0.00022;
const PAD = 80;

/**
 * Night glimpse — heard, not fought. Orbits the shepherd at a distance and
 * slips farther away if approached (more so once the staff is in hand).
 */
export class Wolf {
    readonly sprite: GameObjects.Sprite;
    private readonly shadow: GameObjects.Image;
    private angle: number;

    constructor (scene: Scene, aroundX: number, aroundY: number) {
        ensureWolfTexture(scene);
        ensureWolfShadow(scene);

        this.angle = Math.random() * Math.PI * 2;
        const spawn = ringPoint(aroundX, aroundY, STALK_DIST, this.angle);
        this.shadow = scene.add.image(spawn.x, spawn.y + SHADOW_OFFSET, SHADOW_KEY);
        this.sprite = scene.add.sprite(spawn.x, spawn.y, TEXTURE_KEY);
        this.sprite.setDisplaySize(SIZE, SIZE);
        this.placeShadow();
    }

    update (shepherd: Shepherd, deltaMs: number): void {
        if (!this.sprite.active) {
            return;
        }

        const sx = shepherd.sprite.x;
        const sy = shepherd.sprite.y;
        const dx = this.sprite.x - sx;
        const dy = this.sprite.y - sy;
        const dist = Math.hypot(dx, dy) || 1;
        const desired = shepherd.hasStaff ? STAFF_STALK_DIST : STALK_DIST;
        const close = dist < TOO_CLOSE;

        this.angle += ORBIT_RAD_PER_MS * deltaMs;
        const target = ringPoint(sx, sy, desired, this.angle);
        const tx = target.x - this.sprite.x;
        const ty = target.y - this.sprite.y;
        const gap = Math.hypot(tx, ty);

        if (gap > 4) {
            const speed = close ? FLEE_SPEED : SPEED;
            const step = Math.min(gap, speed * (deltaMs / 1000));
            this.sprite.x += (tx / gap) * step;
            this.sprite.y += (ty / gap) * step;
        }

        if (Math.abs(sx - this.sprite.x) > 8) {
            this.sprite.setFlipX(sx < this.sprite.x);
        }

        this.placeShadow();
    }

    destroy (): void {
        this.sprite.destroy();
        this.shadow.destroy();
    }

    private placeShadow (): void {
        const depth = characterDepth(this.sprite.y);
        this.sprite.setDepth(depth);
        this.shadow.setDepth(depth - 0.01);
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }
}

function ringPoint (cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
    return {
        x: clamp(cx + Math.cos(angle) * radius, PAD, WORLD_WIDTH - PAD),
        y: clamp(cy + Math.sin(angle) * radius, PAD, WORLD_HEIGHT - PAD)
    };
}

function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function ensureWolfTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x5a534c, 1);
    g.fillEllipse(28, 30, 36, 18);
    g.fillCircle(42, 26, 9);
    g.fillStyle(0x3d3832, 1);
    g.fillTriangle(38, 16, 42, 8, 46, 16);
    g.fillTriangle(46, 16, 50, 8, 52, 18);
    g.fillStyle(0xc4b8a8, 1);
    g.fillCircle(48, 28, 3);
    g.fillStyle(0x4a453e, 1);
    g.fillEllipse(12, 32, 16, 8);
    g.generateTexture(TEXTURE_KEY, 56, 48);
    g.destroy();
}

function ensureWolfShadow (scene: Scene): void {
    if (scene.textures.exists(SHADOW_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(22, 8, 36, 12);
    g.generateTexture(SHADOW_KEY, 44, 16);
    g.destroy();
}
