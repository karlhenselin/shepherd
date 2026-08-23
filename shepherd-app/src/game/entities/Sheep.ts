import { Scene, GameObjects, Physics } from 'phaser';
import { Shepherd } from './Shepherd';
import { GrassPatch } from '../world/GrassPatch';
import { WaterSource } from '../world/WaterSource';

const FOLLOW_SPEED = 150;
const NOTICE_DISTANCE = 110;
const FOLLOW_DISTANCE = 56;
const DRINK_MS = 2600;
const EAT_MS = 2600;
const SHEEP_SIZE = 48;
const SHADOW_OFFSET = 18;
const WADDLE_DEG = 7;

const SHEEP_TINT: Record<string, number> = {
    Snowball: 0xf4f7ff,
    Clover: 0xe2f0c9,
    Biscuit: 0xf3d09a,
    Milo: 0xd5cce6
};

export type SheepMood = 'waiting' | 'following' | 'drinking' | 'eating' | 'hurt' | 'penned';
export type SheepEvent = 'found' | 'ate' | 'drank' | null;

export class Sheep {
    readonly name: string;
    readonly sprite: GameObjects.Sprite;
    thirsty = false;
    hungry = false;
    hurt = false;
    discovered = false;
    mood: SheepMood = 'waiting';
    private readonly body: Physics.Arcade.Body;
    private readonly scene: Scene;
    private readonly followSlot: number;
    private readonly shadow: GameObjects.Image;
    private drinkUntil = 0;
    private eatUntil = 0;
    private penTarget: { x: number; y: number } | null = null;

    constructor (scene: Scene, x: number, y: number, name: string, followSlot: number) {
        this.scene = scene;
        this.name = name;
        this.followSlot = followSlot;
        ensureSheepTexture(scene);
        ensureSheepShadow(scene);

        this.shadow = scene.add.image(x, y + SHADOW_OFFSET, 'sheep-shadow');
        this.shadow.setDepth(4);

        this.sprite = scene.physics.add.sprite(x, y, 'sheep');
        this.sprite.setDepth(5);
        this.sprite.setDisplaySize(SHEEP_SIZE, SHEEP_SIZE);
        this.sprite.setTint(SHEEP_TINT[name] ?? 0xffffff);

        this.body = this.sprite.body as Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setCircle(Math.round(14 * this.sprite.width / SHEEP_SIZE));
        this.body.setVelocity(0, 0);
        this.body.setImmovable(true);
    }

    get isBusy (): boolean {
        return this.mood === 'drinking' || this.mood === 'eating';
    }

    beginFollowing (): void {
        this.mood = 'following';
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    trapInHole (): void {
        this.hurt = true;
        this.mood = 'hurt';
        this.sprite.setAngle(32);
        this.sprite.setTint(0xe8a898);
        this.shadow.setAlpha(0.25);
        this.body.setImmovable(true);
        this.body.setVelocity(0, 0);
    }

    heal (): void {
        this.hurt = false;
        this.sprite.setAngle(0);
        this.sprite.setTint(SHEEP_TINT[this.name] ?? 0xffffff);
        this.shadow.setAlpha(1);
        this.beginFollowing();
        this.placeShadow();
    }

    markDiscovered (): void {
        this.discovered = true;
    }

    enterPen (x: number, y: number): void {
        this.mood = 'penned';
        this.penTarget = { x, y };
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    settleInPen (x: number, y: number): void {
        this.mood = 'penned';
        this.penTarget = null;
        this.sprite.setPosition(x, y);
        this.sprite.setAngle(0);
        this.body.setVelocity(0, 0);
        this.body.setImmovable(true);
        this.placeShadow();
    }

    leavePen (): void {
        this.beginFollowing();
        this.penTarget = null;
    }

    update (shepherd: Shepherd, water: WaterSource[], grass: GrassPatch[]): SheepEvent {
        const now = this.scene.time.now;
        const dist = Math.hypot(shepherd.sprite.x - this.sprite.x, shepherd.sprite.y - this.sprite.y);

        if (this.mood === 'drinking') {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(12);
            this.placeShadow();

            if (now >= this.drinkUntil) {
                this.sprite.setAngle(0);
                this.mood = 'following';
                this.thirsty = false;
            }

            return null;
        }

        if (this.mood === 'eating') {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(-10);
            this.placeShadow();

            if (now >= this.eatUntil) {
                this.sprite.setAngle(0);
                this.mood = 'following';
                this.hungry = false;
            }

            return null;
        }

        if (this.mood === 'hurt') {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(32);
            this.placeShadow();

            if (!this.discovered && dist < NOTICE_DISTANCE) {
                this.discovered = true;
                return 'found';
            }

            return null;
        }

        if (this.mood === 'penned') {
            if (this.penTarget) {
                const dist = Math.hypot(this.penTarget.x - this.sprite.x, this.penTarget.y - this.sprite.y);

                if (dist > 12) {
                    this.moveToward(this.penTarget.x, this.penTarget.y, FOLLOW_SPEED);
                    this.sprite.setAngle(Math.sin(now / 90) * WADDLE_DEG);
                    this.faceVelocity();
                }
                else {
                    this.penTarget = null;
                    this.body.setVelocity(0, 0);
                    this.body.setImmovable(true);
                    this.sprite.setAngle(0);
                }
            }
            else {
                this.body.setVelocity(0, 0);
            }

            this.placeShadow();
            return null;
        }

        if (this.mood === 'waiting') {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(0);
            this.placeShadow();

            if (dist < NOTICE_DISTANCE) {
                this.body.setImmovable(false);
                this.mood = 'following';
                return 'found';
            }

            return null;
        }

        if (this.hungry && this.tryEat(grass, now)) {
            return 'ate';
        }

        if (this.thirsty && this.tryDrink(water, now)) {
            return 'drank';
        }

        const angle = (this.followSlot / 4) * Math.PI * 2;
        const targetX = shepherd.sprite.x + Math.cos(angle) * FOLLOW_DISTANCE;
        const targetY = shepherd.sprite.y + Math.sin(angle) * FOLLOW_DISTANCE;
        const followDist = Math.hypot(targetX - this.sprite.x, targetY - this.sprite.y);

        if (followDist > 18) {
            this.moveToward(targetX, targetY, FOLLOW_SPEED);
            this.sprite.setAngle(Math.sin(now / 90) * WADDLE_DEG);
        }
        else {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(0);
        }

        this.faceVelocity();
        this.placeShadow();
        return null;
    }

    private faceVelocity (): void {
        if (Math.abs(this.body.velocity.x) > 8) {
            this.sprite.setFlipX(this.body.velocity.x < 0);
        }
    }

    private placeShadow (): void {
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }

    private tryEat (grass: GrassPatch[], now: number): boolean {
        const patch = grass.find((tuft) => tuft.isNear(this.sprite.x, this.sprite.y));

        if (!patch) {
            return false;
        }

        this.mood = 'eating';
        this.eatUntil = now + EAT_MS;
        this.body.setVelocity(0, 0);
        this.sprite.setAngle(-10);
        this.placeShadow();
        return true;
    }

    private tryDrink (water: WaterSource[], now: number): boolean {
        if (!water.some((source) => source.isNear(this.sprite.x, this.sprite.y))) {
            return false;
        }

        this.mood = 'drinking';
        this.drinkUntil = now + DRINK_MS;
        this.body.setVelocity(0, 0);
        this.sprite.setAngle(12);
        this.placeShadow();
        return true;
    }

    private moveToward (x: number, y: number, speed: number): void {
        const dx = x - this.sprite.x;
        const dy = y - this.sprite.y;

        if (Math.hypot(dx, dy) < 4) {
            this.body.setVelocity(0, 0);
            return;
        }

        this.body.setVelocity(dx, dy);
        this.body.velocity.normalize().scale(speed);
    }
}

function ensureSheepTexture (scene: Scene): void {
    if (scene.textures.exists('sheep')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0xf4f0e6, 1);
    g.fillCircle(16, 18, 13);
    g.fillCircle(10, 14, 8);
    g.fillCircle(22, 14, 8);
    g.fillStyle(0xc4a574, 1);
    g.fillCircle(16, 16, 3);
    g.generateTexture('sheep', 32, 32);
    g.destroy();
}

function ensureSheepShadow (scene: Scene): void {
    if (scene.textures.exists('sheep-shadow')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(20, 8, 32, 12);
    g.generateTexture('sheep-shadow', 40, 16);
    g.destroy();
}
