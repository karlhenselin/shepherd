import { GameObjects, Physics, Scene } from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../world/constants';

const TEXTURE_KEY = 'wolf';
const FALLBACK_KEY = 'wolf-drawn';
const DISPLAY = 52;
const WANDER_SPEED = 55;
const FLEE_SPEED = 140;
const TOO_CLOSE = 240;
const KEEP_NEAR = 780;
const SHADOW_OFFSET = 18;

export class Wolf {
    readonly sprite: GameObjects.Sprite;
    private readonly body: Physics.Arcade.Body;
    private readonly shadow: GameObjects.Image;
    private readonly orbitR: number;
    private readonly orbitSpeed: number;
    private orbitA: number;
    private homeX: number;
    private homeY: number;

    constructor (scene: Scene, x: number, y: number) {
        const key = ensureWolfTexture(scene);
        ensureWolfShadow(scene);

        this.homeX = x;
        this.homeY = y;
        this.orbitR = 90 + Math.random() * 70;
        this.orbitSpeed = (Math.random() < 0.5 ? -1 : 1) * (0.00035 + Math.random() * 0.00025);
        this.orbitA = Math.random() * Math.PI * 2;

        this.shadow = scene.add.image(x, y + SHADOW_OFFSET, 'wolf-shadow');
        this.shadow.setDepth(4);

        this.sprite = scene.physics.add.sprite(x, y, key);
        this.sprite.setDepth(5);
        this.sprite.setDisplaySize(DISPLAY, DISPLAY);
        this.body = this.sprite.body as Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setCircle(16, 10, 12);
        this.body.setImmovable(true);
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    update (shepherd: { x: number; y: number }, now: number): void {
        const dx = this.sprite.x - shepherd.x;
        const dy = this.sprite.y - shepherd.y;
        const dist = Math.hypot(dx, dy);

        if (dist < TOO_CLOSE && dist > 1) {
            this.moveToward(
                this.sprite.x + (dx / dist) * 180,
                this.sprite.y + (dy / dist) * 180,
                FLEE_SPEED
            );
        }
        else if (dist > KEEP_NEAR) {
            this.homeX = shepherd.x + (dx / (dist || 1)) * 520;
            this.homeY = shepherd.y + (dy / (dist || 1)) * 520;
            this.moveToward(this.homeX, this.homeY, WANDER_SPEED);
        }
        else {
            this.orbitA += this.orbitSpeed * 16;
            const tx = this.homeX + Math.cos(this.orbitA) * this.orbitR;
            const ty = this.homeY + Math.sin(this.orbitA) * this.orbitR * 0.72;
            this.moveToward(
                clamp(tx, 40, WORLD_WIDTH - 40),
                clamp(ty, 40, WORLD_HEIGHT - 40),
                WANDER_SPEED
            );
        }

        if (Math.abs(this.body.velocity.x) > 6) {
            this.sprite.setFlipX(this.body.velocity.x < 0);
        }

        this.sprite.setAngle(Math.sin(now / 140) * 4);
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }

    destroy (): void {
        this.sprite.destroy();
        this.shadow.destroy();
    }

    private moveToward (x: number, y: number, speed: number): void {
        const dx = x - this.sprite.x;
        const dy = y - this.sprite.y;

        if (Math.hypot(dx, dy) < 6) {
            this.body.setVelocity(0, 0);
            return;
        }

        this.body.setVelocity(dx, dy);
        this.body.velocity.normalize().scale(speed);
    }
}

function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function ensureWolfTexture (scene: Scene): string {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return TEXTURE_KEY;
    }

    if (scene.textures.exists(FALLBACK_KEY)) {
        return FALLBACK_KEY;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x7a7368, 1);
    g.fillEllipse(22, 28, 28, 18);
    g.fillCircle(30, 18, 11);
    g.fillStyle(0xe8dcc8, 1);
    g.fillCircle(33, 20, 5);
    g.fillStyle(0x3d2c1e, 1);
    g.fillCircle(34, 17, 2);
    g.fillTriangle(22, 10, 18, 2, 26, 8);
    g.fillTriangle(34, 8, 38, 1, 30, 8);
    g.fillEllipse(10, 30, 10, 6);
    g.generateTexture(FALLBACK_KEY, 48, 48);
    g.destroy();
    return FALLBACK_KEY;
}

function ensureWolfShadow (scene: Scene): void {
    if (scene.textures.exists('wolf-shadow')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(20, 8, 32, 12);
    g.generateTexture('wolf-shadow', 40, 16);
    g.destroy();
}
