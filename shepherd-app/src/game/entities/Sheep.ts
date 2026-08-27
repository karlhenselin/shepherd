import { Scene, GameObjects, Physics } from 'phaser';
import { Shepherd } from './Shepherd';
import { GrassPatch } from '../world/GrassPatch';
import { WaterSource } from '../world/WaterSource';

export const FOLLOW_SPEED = 150 * 0.95 * 0.95;
const NOTICE_DISTANCE = 110;
export const FOLLOW_DISTANCE = 56;
const NIGHT_FOLLOW_DISTANCE = 36;
/** Side-by-side spread along the trail (perpendicular to travel). */
const FOLLOW_LATERAL = 28;
const DRINK_MS = 2600;
const EAT_MS = 2600;
const SNACK_MS = 1400;
const SNACK_COOLDOWN_MS = 16000;
const SHEEP_SIZE = 48;
const SHADOW_OFFSET = 18;
const WADDLE_DEG = 7;
const PET_DISTANCE = 50;
const PET_DANCE_MS = 2400;
const PET_COOLDOWN_MS = 13000;
/** End post-pet scoot once shepherd–sheep separation reaches this (clear of PET_DISTANCE ~50). */
const PET_SCOOT_SEPARATION = 90;
const PET_SCOOT_MS = 750;

const SHEEP_TINT: Record<string, number> = {
    Snowball: 0xf4f7ff,
    Clover: 0xe2f0c9,
    Biscuit: 0xf3d09a,
    Milo: 0xd5cce6
};

export type SheepMood = 'waiting' | 'following' | 'drinking' | 'eating' | 'hurt' | 'stuck' | 'penned';
export type SheepEvent = 'found' | 'ate' | 'drank' | 'rejoined' | 'snagged' | null;

type SheepPersonality = {
    followSpeed: number;
    trailExtra: number;
    lateralScale: number;
    strayWeight: number;
    wander: number;
    snackSeek: boolean;
    huddleWithFlock: boolean;
    nervous: boolean;
};

const PERSONALITY: Record<string, SheepPersonality> = {
    Clover: {
        followSpeed: FOLLOW_SPEED * 1.04,
        trailExtra: -10,
        lateralScale: 0.7,
        strayWeight: 0.35,
        wander: 3,
        snackSeek: false,
        huddleWithFlock: true,
        nervous: false
    },
    Snowball: {
        followSpeed: FOLLOW_SPEED * 1.06,
        trailExtra: 22,
        lateralScale: 1.15,
        strayWeight: 1.85,
        wander: 26,
        snackSeek: false,
        huddleWithFlock: false,
        nervous: false
    },
    Biscuit: {
        followSpeed: FOLLOW_SPEED * 0.78,
        trailExtra: 14,
        lateralScale: 1,
        strayWeight: 1.15,
        wander: 6,
        snackSeek: true,
        huddleWithFlock: false,
        nervous: false
    },
    Milo: {
        followSpeed: FOLLOW_SPEED * 0.96,
        trailExtra: -6,
        lateralScale: 0.55,
        strayWeight: 0.42,
        wander: 8,
        snackSeek: false,
        huddleWithFlock: true,
        nervous: true
    }
};

const DEFAULT_PERSONALITY: SheepPersonality = PERSONALITY.Clover;

/** Optional zone followers must not enter (e.g. the sheep hole). */
export type KeepOutZone = { x: number; y: number; radius: number };

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
    private readonly personality: SheepPersonality;
    private drinkUntil = 0;
    private eatUntil = 0;
    private nextSnackAt = 0;
    private danceUntil = 0;
    private nextPetAt = 0;
    private danceHomeX = 0;
    private danceHomeY = 0;
    private scootUntil = 0;
    private penTarget: { x: number; y: number } | null = null;
    /** Sit aside during hole rescue (not in the pit). */
    private rescueWait: { x: number; y: number } | null = null;

    constructor (scene: Scene, x: number, y: number, name: string, followSlot: number) {
        this.scene = scene;
        this.name = name;
        this.followSlot = followSlot;
        this.personality = PERSONALITY[name] ?? DEFAULT_PERSONALITY;
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

    get isDancing (): boolean {
        return this.scene.time.now < this.danceUntil;
    }

    get isScooting (): boolean {
        return this.scene.time.now < this.scootUntil;
    }

    get isRescueWaiting (): boolean {
        return this.rescueWait !== null;
    }

    get strayWeight (): number {
        return this.personality.strayWeight;
    }

    get nervous (): boolean {
        return this.personality.nervous;
    }

    get followSpeed (): number {
        return this.personality.followSpeed;
    }

    /** Following sheep that aren't hurt / penned / mid-meal. */
    canBePetted (): boolean {
        if (this.mood !== 'following' || this.hurt || this.isBusy || this.isDancing || this.isScooting || this.isRescueWaiting) {
            return false;
        }

        return this.scene.time.now >= this.nextPetAt;
    }

    isCloseEnoughToPet (x: number, y: number): boolean {
        return Math.hypot(x - this.sprite.x, y - this.sprite.y) < PET_DISTANCE;
    }

    beginHappyDance (durationMs = PET_DANCE_MS): void {
        const now = this.scene.time.now;
        this.danceUntil = now + durationMs;
        this.nextPetAt = now + PET_COOLDOWN_MS;
        this.danceHomeX = this.sprite.x;
        this.danceHomeY = this.sprite.y;
        this.body.setVelocity(0, 0);
        this.body.setImmovable(true);
    }

    beginFollowing (): void {
        this.discovered = true;
        this.mood = 'following';
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    becomeLost (x: number, y: number): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.mood = 'waiting';
        this.penTarget = null;
        this.sprite.setPosition(x, y);
        this.sprite.setAngle(0);
        this.body.setVelocity(0, 0);
        this.body.setImmovable(true);
        this.placeShadow();
    }

    trapInHole (): void {
        this.clearHappyDance();
        this.rescueWait = null;
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

    snagInThorns (): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.mood = 'stuck';
        this.sprite.setAngle(18);
        this.sprite.setTint(0xd8c4a0);
        this.body.setImmovable(true);
        this.body.setVelocity(0, 0);
        this.placeShadow();
    }

    freeFromThorns (): void {
        this.sprite.setAngle(0);
        this.sprite.setTint(SHEEP_TINT[this.name] ?? 0xffffff);
        this.beginFollowing();
        this.placeShadow();
    }

    /** Amble to a spot beside the hole and sit until endRescueWait(). */
    beginRescueWait (x: number, y: number): void {
        if (this.hurt || this.mood === 'hurt' || this.mood === 'penned' || this.mood === 'stuck') {
            return;
        }

        this.clearHappyDance();
        this.rescueWait = { x, y };
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    endRescueWait (): void {
        if (!this.rescueWait) {
            return;
        }

        this.rescueWait = null;
        this.sprite.setAngle(0);

        if (this.mood === 'following') {
            this.body.setImmovable(false);
        }

        this.placeShadow();
    }

    markDiscovered (): void {
        this.discovered = true;
    }

    enterPen (x: number, y: number): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.mood = 'penned';
        this.penTarget = { x, y };
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    settleInPen (x: number, y: number): void {
        this.clearHappyDance();
        this.rescueWait = null;
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

    update (
        shepherd: Shepherd,
        water: WaterSource[],
        grass: GrassPatch[],
        huddle = false,
        keepOut: KeepOutZone | null = null,
        thorns: Array<{ ensnares: (x: number, y: number) => boolean }> = [],
        companions: Sheep[] = []
    ): SheepEvent {
        const now = this.scene.time.now;
        const dist = Math.hypot(shepherd.sprite.x - this.sprite.x, shepherd.sprite.y - this.sprite.y);

        if (this.isDancing) {
            this.playHappyDance(now);
            return null;
        }

        if (this.danceUntil > 0 && now >= this.danceUntil) {
            this.finishHappyDance();
            this.beginScootAway(shepherd.sprite.x, shepherd.sprite.y);
        }

        if (this.isScooting) {
            this.tickScoot(now, shepherd, keepOut);
            return null;
        }

        if (this.rescueWait) {
            this.tickRescueWait(now);
            return null;
        }

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

        if (this.mood === 'stuck') {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(18 + Math.sin(now / 220) * 4);
            this.placeShadow();
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
                const firstFind = !this.discovered;
                this.beginFollowing();
                return firstFind ? 'found' : 'rejoined';
            }

            return null;
        }

        if (this.hungry && this.tryEat(grass, now)) {
            return 'ate';
        }

        if (!this.hungry && this.trySnack(grass, now)) {
            return null;
        }

        if (this.thirsty && this.tryDrink(water, now)) {
            return 'drank';
        }

        if (this.mood === 'following' && !this.hurt) {
            const snagged = thorns.find((thorn) => thorn.ensnares(this.sprite.x, this.sprite.y));

            if (snagged) {
                this.snagInThorns();
                return 'snagged';
            }
        }

        let { targetX, targetY } = this.trailTarget(shepherd, huddle, companions);

        if (keepOut) {
            const pushed = pushOutsideKeepOut(targetX, targetY, keepOut);
            targetX = pushed.x;
            targetY = pushed.y;
        }

        const followDist = Math.hypot(targetX - this.sprite.x, targetY - this.sprite.y);

        if (followDist > 18) {
            this.moveToward(targetX, targetY, this.personality.followSpeed);
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

    private playHappyDance (now: number): void {
        this.body.setVelocity(0, 0);
        const t = now / 90;
        const hop = Math.abs(Math.sin(now / 110)) * 7;
        const orbit = 3.5;
        this.sprite.setPosition(
            this.danceHomeX + Math.cos(t) * orbit,
            this.danceHomeY - hop + Math.sin(t * 0.7) * 1.5
        );
        this.sprite.setAngle(Math.sin(now / 70) * 16);
        this.sprite.setFlipX(Math.sin(now / 140) > 0);
        this.placeShadow();
    }

    private finishHappyDance (): void {
        this.danceUntil = 0;
        this.sprite.setPosition(this.danceHomeX, this.danceHomeY);
        this.sprite.setAngle(0);
        this.body.setVelocity(0, 0);

        if (this.mood === 'following') {
            this.body.setImmovable(false);
        }

        this.placeShadow();
    }

    /** Brief walk opposite the shepherd until separation clears pet overlap (~50px). */
    private beginScootAway (shepherdX: number, shepherdY: number): void {
        this.scootUntil = this.scene.time.now + PET_SCOOT_MS;
        this.body.setImmovable(false);

        // Player may already be clear after the dance — skip the flee.
        if (Math.hypot(this.sprite.x - shepherdX, this.sprite.y - shepherdY) >= PET_SCOOT_SEPARATION) {
            this.clearScoot();
        }
    }

    private tickScoot (now: number, shepherd: Shepherd, keepOut: KeepOutZone | null = null): void {
        const shepherdX = shepherd.sprite.x;
        const shepherdY = shepherd.sprite.y;
        let dx = this.sprite.x - shepherdX;
        let dy = this.sprite.y - shepherdY;
        const separation = Math.hypot(dx, dy);

        if (separation >= PET_SCOOT_SEPARATION) {
            this.clearScoot();
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(0);
            this.placeShadow();
            return;
        }

        if (separation < 1) {
            const { x: hx, y: hy } = shepherd.moveHeading;
            dx = -hx;
            dy = -hy;
        }

        // Aim past the gap so moveToward keeps fleeing while still too close.
        const len = Math.hypot(dx, dy) || 1;
        let targetX = shepherdX + (dx / len) * (PET_SCOOT_SEPARATION + 20);
        let targetY = shepherdY + (dy / len) * (PET_SCOOT_SEPARATION + 20);

        if (keepOut) {
            const pushed = pushOutsideKeepOut(targetX, targetY, keepOut);
            targetX = pushed.x;
            targetY = pushed.y;
        }

        this.moveToward(targetX, targetY, FOLLOW_SPEED);
        this.sprite.setAngle(Math.sin(now / 90) * WADDLE_DEG);
        this.faceVelocity();
        this.placeShadow();
    }

    private clearScoot (): void {
        this.scootUntil = 0;
    }

    private tickRescueWait (now: number): void {
        if (!this.rescueWait) {
            return;
        }

        const dist = Math.hypot(this.rescueWait.x - this.sprite.x, this.rescueWait.y - this.sprite.y);

        if (dist > 14) {
            this.moveToward(this.rescueWait.x, this.rescueWait.y, FOLLOW_SPEED);
            this.sprite.setAngle(Math.sin(now / 90) * WADDLE_DEG);
            this.faceVelocity();
        }
        else {
            this.body.setVelocity(0, 0);
            this.body.setImmovable(true);
            // Soft sit while the shepherd tends the hole.
            this.sprite.setAngle(10);
        }

        this.placeShadow();
    }

    private clearHappyDance (): void {
        this.clearScoot();

        if (this.danceUntil <= 0) {
            return;
        }

        this.danceUntil = 0;
        this.sprite.setPosition(this.danceHomeX, this.danceHomeY);
    }

    /**
     * Follow point behind the shepherd's travel direction, with lateral fan so
     * sheep don't stack on one trail spot (slot 0 dead-center behind).
     */
    private trailTarget (
        shepherd: Shepherd,
        huddle: boolean,
        companions: Sheep[]
    ): { targetX: number; targetY: number } {
        const spacing = (huddle ? NIGHT_FOLLOW_DISTANCE : FOLLOW_DISTANCE) + this.personality.trailExtra;
        const { x: hx, y: hy } = shepherd.moveHeading;
        const behindX = -hx;
        const behindY = -hy;
        const perpX = -hy;
        const perpY = hx;
        const lateral = trailLateralOffset(this.followSlot) * this.personality.lateralScale;
        const now = this.scene.time.now;
        const wander = this.personality.wander;
        const jitterX = wander > 0 ? Math.sin(now / 420 + this.followSlot) * wander : 0;
        const jitterY = wander > 0 ? Math.cos(now / 380 + this.followSlot * 1.7) * wander * 0.6 : 0;

        if (this.personality.huddleWithFlock) {
            const buddy = nearestCompanion(this, companions);

            if (buddy) {
                return {
                    targetX: buddy.sprite.x + behindX * 28 + perpX * lateral * 0.4 + jitterX * 0.4,
                    targetY: buddy.sprite.y + behindY * 28 + perpY * lateral * 0.4 + jitterY * 0.4
                };
            }
        }

        return {
            targetX: shepherd.sprite.x + behindX * spacing + perpX * lateral + jitterX,
            targetY: shepherd.sprite.y + behindY * spacing + perpY * lateral + jitterY
        };
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

    private trySnack (grass: GrassPatch[], now: number): boolean {
        if (!this.personality.snackSeek || now < this.nextSnackAt) {
            return false;
        }

        const patch = grass.find((tuft) => tuft.isNear(this.sprite.x, this.sprite.y));

        if (!patch) {
            return false;
        }

        this.mood = 'eating';
        this.eatUntil = now + SNACK_MS;
        this.nextSnackAt = now + SNACK_COOLDOWN_MS;
        this.body.setVelocity(0, 0);
        this.sprite.setAngle(-8);
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

/** Push a point to the rim if it falls inside the keep-out circle. */
function pushOutsideKeepOut (x: number, y: number, zone: KeepOutZone): { x: number; y: number } {
    const dx = x - zone.x;
    const dy = y - zone.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= zone.radius) {
        return { x, y };
    }

    if (dist < 1) {
        return { x: zone.x + zone.radius, y: zone.y };
    }

    const scale = zone.radius / dist;
    return { x: zone.x + dx * scale, y: zone.y + dy * scale };
}

function nearestCompanion (self: Sheep, companions: Sheep[]): Sheep | null {
    let closest: Sheep | null = null;
    let best = Number.POSITIVE_INFINITY;

    for (const other of companions) {
        if (other === self || other.mood !== 'following') {
            continue;
        }

        const dist = Math.hypot(other.sprite.x - self.sprite.x, other.sprite.y - self.sprite.y);

        if (dist < best) {
            best = dist;
            closest = other;
        }
    }

    return closest;
}

/** Fan left/right of the trail: 0 center, then +L, −L, +2L, −2L, … */
function trailLateralOffset (slot: number): number {
    if (slot <= 0) {
        return 0;
    }

    const pair = Math.ceil(slot / 2);
    return (slot % 2 === 1 ? 1 : -1) * pair * FOLLOW_LATERAL;
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
