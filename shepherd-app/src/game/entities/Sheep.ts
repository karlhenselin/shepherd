import { Scene, GameObjects, Physics } from 'phaser';
import { Shepherd } from './Shepherd';
import { GrassPatch, GRASS_APPROACH_RANGE, GRASS_EAT_ARRIVE } from '../world/GrassPatch';
import { characterDepth } from '../world/constants';

export const FOLLOW_SPEED = 150 * 0.95 * 0.95;
/** After 1 Corinthians 15:51, the sheep keep up a little better. */
const CHANGED_FOLLOW_SCALE = 1.18;
const NOTICE_DISTANCE = 110;
export const FOLLOW_DISTANCE = 70;
const NIGHT_FOLLOW_DISTANCE = 41;
/** Side-by-side spread along the trail (perpendicular to travel). */
const FOLLOW_LATERAL = 28;
const DRINK_MS = 2600;
const DRINK_ARRIVE = 16;
const EAT_MS = 2600;
const SNACK_COOLDOWN_MS = 9000;
/** After a meal, stay out of walk-into pet range while they rejoin the trail. */
const AFTER_EAT_PET_SUPPRESS_MS = 5000;
const SHEEP_SIZE = 48;
/** Biscuit is the lamb — smaller sprite; slower follow until the change. */
const BISCUIT_SIZE = 34 * 0.95;
const BEAST_SIZE = 48;
const SHADOW_OFFSET = 18;
const WADDLE_DEG = 7;
const PET_DISTANCE = 50;
export const PET_DANCE_MS = 2400;
const PET_COOLDOWN_MS = 13000;
const PET_APPROACH_ARRIVE = 12;
/** End post-pet scoot once shepherd–sheep separation reaches this (clear of PET_DISTANCE ~50). */
const PET_SCOOT_SEPARATION = 90;
const PET_SCOOT_MS = 750;
/** Past the keep-out rim so sheep don't freeze just inside the boundary. */
const KEEP_OUT_CLEARANCE = 14;
/** Soft radial nudge per frame while exiting a keep-out (avoids rim-slide stalls). */
const KEEP_OUT_NUDGE = 8;

const SHEEP_TINT: Record<string, number> = {
    Snowball: 0xf4f7ff,
    Clover: 0xe2f0c9,
    Biscuit: 0xf3d09a,
    Milo: 0xd5cce6
};

type SheepTraits = {
    followSpeed: number;
    trailScale: number;
    strayWeight: number;
    /** Walk-tilt amplitude in degrees. */
    waddleDeg: number;
    /** Larger = slower sway. */
    waddlePeriod: number;
    /** Phase so the flock does not rock in unison. */
    waddlePhase: number;
};

/** How each sheep follows — tint alone was not a personality. */
const SHEEP_TRAITS: Record<string, SheepTraits> = {
    Clover: { followSpeed: 1.06, trailScale: 0.82, strayWeight: 0.45, waddleDeg: 5, waddlePeriod: 78, waddlePhase: 0.6 },
    Snowball: { followSpeed: 1.02, trailScale: 1.28, strayWeight: 1.85, waddleDeg: 10, waddlePeriod: 112, waddlePhase: 2.4 },
    Biscuit: { followSpeed: 0.78, trailScale: 1.05, strayWeight: 0.85, waddleDeg: 6.5, waddlePeriod: 128, waddlePhase: 4.1 },
    Milo: { followSpeed: 1.0608, trailScale: 0.62, strayWeight: 0.40, waddleDeg: 8, waddlePeriod: 70, waddlePhase: 5.2 },
    Wolf: { followSpeed: 1.36, trailScale: 0.72, strayWeight: 0, waddleDeg: 4, waddlePeriod: 86, waddlePhase: 1.1 },
    Sarah: { followSpeed: 1.36, trailScale: 0.72, strayWeight: 0, waddleDeg: 4, waddlePeriod: 86, waddlePhase: 1.1 },
    Leo: { followSpeed: 1.36, trailScale: 0.72, strayWeight: 0, waddleDeg: 4.5, waddlePeriod: 94, waddlePhase: 3.3 }
};

export function isPeaceableFlockName (name: string): boolean {
    return name === 'Wolf' || name === 'Sarah' || name === 'Leo' || name === 'Lion';
}

function flockTextureKey (name: string): string {
    if (name === 'Wolf' || name === 'Sarah') {
        return 'wolf';
    }

    if (name === 'Leo' || name === 'Lion') {
        return 'lion';
    }

    return 'sheep';
}

function traitsFor (name: string): SheepTraits {
    return SHEEP_TRAITS[name] ?? {
        followSpeed: 1,
        trailScale: 1,
        strayWeight: 1,
        waddleDeg: WADDLE_DEG,
        waddlePeriod: 90,
        waddlePhase: 0
    };
}

/** Clover / Snowball / Milo — Biscuit matches this after the change. */
function adultFollowSpeed (): number {
    return (
        SHEEP_TRAITS.Clover.followSpeed
        + SHEEP_TRAITS.Snowball.followSpeed
        + SHEEP_TRAITS.Milo.followSpeed
    ) / 3;
}

export type SheepMood = 'waiting' | 'following' | 'drinking' | 'eating' | 'hurt' | 'penned';
export type SheepEvent = 'found' | 'ate' | 'drank' | 'rejoined' | null;

/** Optional zone followers must not enter (e.g. the sheep hole). */
export type KeepOutZone = { x: number; y: number; radius: number };

export class Sheep {
    readonly name: string;
    readonly sprite: GameObjects.Sprite;
    thirsty = false;
    hungry = false;
    /** After the change: nibble nearby grass for fun, not as a hunger need. */
    snack = false;
    /** After the change: follow a little faster so the flock keeps up. */
    changed = false;
    hurt = false;
    /** Stuck in a bramble (uses hurt/bandage flow, not the hole). */
    snaredInThorns = false;
    /** Night wolf got them — bandage to free them. */
    hurtByWolf = false;
    discovered = false;
    mood: SheepMood = 'waiting';
    private readonly body: Physics.Arcade.Body;
    private readonly scene: Scene;
    private readonly followSlot: number;
    private readonly shadow: GameObjects.Image;
    private drinkUntil = 0;
    private eatUntil = 0;
    private nextSnackAt = 0;
    private danceUntil = 0;
    private nextPetAt = 0;
    private danceHomeX = 0;
    private danceHomeY = 0;
    private petApproach: { x: number; y: number } | null = null;
    private petApproachArrive: (() => void) | null = null;
    private scootUntil = 0;
    private penTarget: { x: number; y: number } | null = null;
    private penPath: { x: number; y: number }[] = [];
    /** Sit aside during hole rescue (not in the pit). */
    private rescueWait: { x: number; y: number } | null = null;
    /** Shore spot to walk to before sipping. */
    private drinkSpot: { x: number; y: number } | null = null;
    /** Face the lake while drinking. */
    private drinkFaceX = 0;
    /** Tuft this sheep is walking toward or chewing. */
    private eatPatch: GrassPatch | null = null;
    /** Wolf or lion that joined the flock after 1 Corinthians 15:51. */
    readonly peaceable: boolean;
    private readonly shadowOffset: number;

    constructor (scene: Scene, x: number, y: number, name: string, followSlot: number) {
        this.scene = scene;
        this.name = name === 'Lion' ? 'Leo' : name === 'Wolf' ? 'Sarah' : name;
        this.followSlot = followSlot;
        this.peaceable = isPeaceableFlockName(this.name);
        ensureSheepTexture(scene);
        ensureSheepShadow(scene);

        const lamb = this.name === 'Biscuit';
        this.shadowOffset = lamb ? 13 : SHADOW_OFFSET;
        this.shadow = scene.add.image(x, y + this.shadowOffset, 'sheep-shadow');

        if (lamb) {
            this.shadow.setDisplaySize(27, 11);
        }else if(this.name === 'Leo' || this.name === 'Sarah'){
            this.shadow.setDisplaySize(60, 24);
            this.shadowOffset = 4;
        }

        const texture = flockTextureKey(this.name);
        this.sprite = scene.physics.add.sprite(x, y, texture);

        if (this.peaceable) {
            fitBeastSprite(this.sprite);
        }
        else {
            const size = lamb ? BISCUIT_SIZE : SHEEP_SIZE;
            this.sprite.setDisplaySize(size, size);
            this.sprite.setTint(SHEEP_TINT[name] ?? 0xffffff);
        }

        this.placeShadow();

        this.body = this.sprite.body as Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        const bodyRadius = lamb ? Math.round(10) : Math.round(14 * this.sprite.width / SHEEP_SIZE);
        this.body.setCircle(bodyRadius);
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

    get isApproachingForPet (): boolean {
        return this.petApproach !== null;
    }

    get isRescueWaiting (): boolean {
        return this.rescueWait !== null;
    }

    /** Following sheep that aren't hurt / penned / mid-meal. */
    canBePetted (): boolean {
        if (this.mood !== 'following' || this.hurt || this.isBusy || this.isDancing || this.isScooting || this.isRescueWaiting || this.isApproachingForPet) {
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

    /** Walk to the kneeling shepherd's hand, then run onArrive (usually beginHappyDance). */
    approachForPet (handX: number, handY: number, onArrive: () => void): void {
        this.clearHappyDance();
        this.petApproach = { x: handX, y: handY };
        this.petApproachArrive = onArrive;
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    /** Block walk-into pets for a while (find celebration bypasses `canBePetted`). */
    deferWalkIntoPetting (durationMs: number): void {
        this.nextPetAt = Math.max(this.nextPetAt, this.scene.time.now + durationMs);
    }

    beginFollowing (): void {
        this.discovered = true;
        this.mood = 'following';
        this.rescueWait = null;
        this.eatPatch = null;
        this.drinkSpot = null;
        this.penPath = [];
        this.penTarget = null;
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    becomeLost (x: number, y: number): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.drinkSpot = null;
        this.mood = 'waiting';
        this.penTarget = null;
        this.penPath = [];
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
        this.snaredInThorns = false;
        this.hurtByWolf = false;
        this.mood = 'hurt';
        this.sprite.setAngle(32);
        this.sprite.setTint(0xe8a898);
        this.shadow.setAlpha(0.25);
        this.body.setImmovable(true);
        this.body.setVelocity(0, 0);
    }

    /** Following sheep caught in brambles — bandage to free them. */
    snareInThorns (): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.hurt = true;
        this.snaredInThorns = true;
        this.hurtByWolf = false;
        this.discovered = true;
        this.mood = 'hurt';
        this.sprite.setAngle(18);
        this.sprite.setTint(0xc4d4a0);
        this.body.setImmovable(true);
        this.body.setVelocity(0, 0);
        this.placeShadow();
    }

    /** Night wolf touched this following sheep — stop and wait for a bandage. */
    struckByWolf (): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.penTarget = null;
        this.penPath = [];
        this.hurt = true;
        this.hurtByWolf = true;
        this.snaredInThorns = false;
        this.discovered = true;
        this.mood = 'hurt';
        this.sprite.setAngle(10);
        this.sprite.setTint(0xd8c0b0);
        this.body.setImmovable(true);
        this.body.setVelocity(0, 0);
        this.placeShadow();
    }

    heal (): void {
        this.hurt = false;
        this.snaredInThorns = false;
        this.hurtByWolf = false;
        this.sprite.setAngle(0);
        this.applyFlockTint();
        this.shadow.setAlpha(1);
        this.rescueWait = null;
        this.beginFollowing();
        this.deferWalkIntoPetting(8000);
        this.placeShadow();
    }

    /** Amble to a spot beside the hole and sit until endRescueWait(). */
    beginRescueWait (x: number, y: number): void {
        if (this.hurt || this.mood === 'hurt' || this.mood === 'penned') {
            return;
        }

        this.clearHappyDance();
        this.rescueWait = { x, y };
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    /** Leave hole-aside sit and resume trail follow when mood allows. */
    endRescueWait (): void {
        if (!this.rescueWait) {
            return;
        }

        this.rescueWait = null;
        this.sprite.setAngle(0);
        this.body.setVelocity(0, 0);

        // Sit used immovable=true; unlock so trail follow can move again.
        if (this.mood === 'following') {
            this.body.setImmovable(false);
        }

        this.placeShadow();
    }

    markDiscovered (): void {
        this.discovered = true;
    }

    private applyFlockTint (): void {
        if (this.peaceable) {
            this.sprite.clearTint();
            return;
        }

        this.sprite.setTint(SHEEP_TINT[this.name] ?? 0xffffff);
    }

    /** Snowball strays; Clover and Milo cling. Used when picking who falls behind. */
    get strayWeight (): number {
        return traitsFor(this.name).strayWeight;
    }

    /** Walking into or resting in the fold. */
    get isPenned (): boolean {
        return this.mood === 'penned';
    }

    /** Penned and finished walking to the rest spot. */
    get isSettledInPen (): boolean {
        return this.mood === 'penned' && this.penTarget === null && this.penPath.length === 0;
    }

    enterPen (path: { x: number; y: number }[]): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.mood = 'penned';
        this.penPath = path.slice();
        this.penTarget = this.penPath.shift() ?? null;
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
    }

    settleInPen (x: number, y: number): void {
        this.clearHappyDance();
        this.rescueWait = null;
        this.mood = 'penned';
        this.penPath = [];
        this.penTarget = null;
        this.sprite.setPosition(x, y);
        this.sprite.setAngle(0);
        this.body.setVelocity(0, 0);
        this.body.setImmovable(true);
        this.placeShadow();
    }

    /** Leave penned mood; optional world position (e.g. outside the fold after dawn). */
    leavePen (x?: number, y?: number): void {
        this.beginFollowing();
        this.penTarget = null;

        if (x !== undefined && y !== undefined) {
            this.sprite.setPosition(x, y);
            this.body.setVelocity(0, 0);
            this.placeShadow();
        }
    }

    update (
        shepherd: Shepherd,
        grass: GrassPatch[],
        huddle = false,
        keepOuts: KeepOutZone[] = []
    ): SheepEvent {
        const now = this.scene.time.now;
        const dist = Math.hypot(shepherd.sprite.x - this.sprite.x, shepherd.sprite.y - this.sprite.y);

        if (this.isDancing) {
            this.playHappyDance(now);
            return null;
        }

        if (this.petApproach) {
            this.tickPetApproach(now);
            return null;
        }

        if (this.danceUntil > 0 && now >= this.danceUntil) {
            this.finishHappyDance();
            this.beginScootAway(shepherd.sprite.x, shepherd.sprite.y);
        }

        if (this.isScooting) {
            this.tickScoot(now, shepherd, keepOuts);
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
                this.drinkSpot = null;
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
                this.nextSnackAt = now + SNACK_COOLDOWN_MS;
                this.deferWalkIntoPetting(AFTER_EAT_PET_SUPPRESS_MS);
                this.eatPatch?.markEaten(now);
                this.eatPatch = null;
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
                    this.sprite.setAngle(this.waddleAngle(now));
                    this.faceVelocity();
                }
                else {
                    this.penTarget = this.penPath.shift() ?? null;
                    this.body.setVelocity(0, 0);

                    if (!this.penTarget) {
                        this.body.setImmovable(true);
                        this.sprite.setAngle(0);
                    }
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

        if (this.thirsty) {
            const thirst = this.tickThirst(now);

            if (thirst === 'walking') {
                return null;
            }
        }

        if (this.hungry || this.snack) {
            const hunger = this.tickHunger(grass, now);

            if (hunger === 'ate') {
                return 'ate';
            }

            if (hunger === 'walking') {
                return null;
            }
        }

        let { targetX, targetY } = this.trailTarget(shepherd, huddle);

        if (keepOuts.length > 0) {
            // Inside or on the rim: scoot radially out — do not trail-follow into a trap.
            if (isInsideOrOnKeepOut(this.sprite.x, this.sprite.y, keepOuts)) {
                this.scootOutOfKeepOuts(keepOuts, now);
                return null;
            }

            const pushed = pushOutsideKeepOuts(targetX, targetY, keepOuts, KEEP_OUT_CLEARANCE);
            targetX = pushed.x;
            targetY = pushed.y;
        }

        const followDist = Math.hypot(targetX - this.sprite.x, targetY - this.sprite.y);

        if (followDist > 18) {
            this.moveToward(targetX, targetY, this.trailSpeed());
            this.sprite.setAngle(this.waddleAngle(now));
        }
        else {
            this.body.setVelocity(0, 0);
            this.sprite.setAngle(0);
        }

        this.faceVelocity();
        this.placeShadow();
        return null;
    }

    private tickPetApproach (now: number): void {
        const target = this.petApproach!;

        if (Math.hypot(target.x - this.sprite.x, target.y - this.sprite.y) > PET_APPROACH_ARRIVE) {
            this.moveToward(target.x, target.y, FOLLOW_SPEED * 1.08);
            this.sprite.setAngle(this.waddleAngle(now));
            this.faceVelocity();
            this.placeShadow();
            return;
        }

        this.petApproach = null;
        const arrive = this.petApproachArrive;
        this.petApproachArrive = null;
        this.body.setVelocity(0, 0);
        this.sprite.setAngle(0);
        this.placeShadow();
        arrive?.();
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

    private tickScoot (now: number, shepherd: Shepherd, keepOuts: KeepOutZone[] = []): void {
        if (keepOuts.length > 0 && isInsideOrOnKeepOut(this.sprite.x, this.sprite.y, keepOuts)) {
            this.scootOutOfKeepOuts(keepOuts, now);
            return;
        }

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

        if (keepOuts.length > 0) {
            const pushed = pushOutsideKeepOuts(targetX, targetY, keepOuts, KEEP_OUT_CLEARANCE);
            targetX = pushed.x;
            targetY = pushed.y;
        }

        this.moveToward(targetX, targetY, FOLLOW_SPEED);
        this.sprite.setAngle(this.waddleAngle(now));
        this.faceVelocity();
        this.placeShadow();
    }

    /**
     * Leave a keep-out radially each frame until clear of the rim.
     * Nudge + velocity so sheep don't stall on the boundary with a follow stop.
     */
    private scootOutOfKeepOuts (keepOuts: KeepOutZone[], now: number): void {
        const exit = pushOutsideKeepOuts(
            this.sprite.x,
            this.sprite.y,
            keepOuts,
            KEEP_OUT_CLEARANCE
        );
        const dx = exit.x - this.sprite.x;
        const dy = exit.y - this.sprite.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.5) {
            const nudge = Math.min(dist, KEEP_OUT_NUDGE);
            this.sprite.setPosition(
                this.sprite.x + (dx / dist) * nudge,
                this.sprite.y + (dy / dist) * nudge
            );
        }

        this.moveToward(exit.x, exit.y, FOLLOW_SPEED);
        this.sprite.setAngle(this.waddleAngle(now));
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
            this.sprite.setAngle(this.waddleAngle(now));
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

    private clearPetApproach (): void {
        this.petApproach = null;
        this.petApproachArrive = null;
    }

    private clearHappyDance (): void {
        this.clearPetApproach();
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
    private trailTarget (shepherd: Shepherd, huddle: boolean): { targetX: number; targetY: number } {
        const spacing = (huddle && !this.changed ? NIGHT_FOLLOW_DISTANCE : this.changed? FOLLOW_DISTANCE + 15 : FOLLOW_DISTANCE) * traitsFor(this.name).trailScale;
        const { x: hx, y: hy } = shepherd.moveHeading;
        const behindX = -hx;
        const behindY = -hy;
        const perpX = -hy;
        const perpY = hx;
        const lateral = trailLateralOffset(this.followSlot);

        return {
            targetX: shepherd.sprite.x + behindX * spacing + perpX * lateral,
            targetY: shepherd.sprite.y + behindY * spacing + perpY * lateral
        };
    }

    private followSpeedScale (): number {
        if (this.changed && this.name === 'Biscuit') {
            return adultFollowSpeed();
        }

        return traitsFor(this.name).followSpeed;
    }

    private trailSpeed (): number {
        const boost = this.changed && !this.peaceable ? CHANGED_FOLLOW_SCALE : 1;
        return FOLLOW_SPEED * this.followSpeedScale() * boost;
    }

    private waddleAngle (now: number): number {
        const traits = traitsFor(this.name);
        return Math.sin(now / traits.waddlePeriod + traits.waddlePhase) * traits.waddleDeg;
    }

    private faceVelocity (): void {
        if (Math.abs(this.body.velocity.x) > 8) {
            this.sprite.setFlipX(this.body.velocity.x < 0);
        }
    }

    private placeShadow (): void {
        const depth = characterDepth(this.sprite.y);
        this.sprite.setDepth(depth);
        this.shadow.setDepth(depth - 0.01);
        this.shadow.setPosition(this.sprite.x, this.sprite.y + this.shadowOffset);
        this.shadow.setFlipX(this.sprite.flipX);
        if(this.name === 'Leo' || this.name === 'Sarah'){
            if(this.sprite.flipX){
                this.shadow.setAngle(-7);
            }else{
                this.shadow.setAngle(7);
            }
        }
    }

    /** Walk up to an uneaten tuft, then chew. */
    private tickHunger (grass: GrassPatch[], now: number): 'ate' | 'walking' | null {
        if (this.snack && !this.hungry && now < this.nextSnackAt) {
            return null;
        }

        const patch = this.pickEatPatch(grass);

        if (!patch) {
            this.eatPatch = null;
            return null;
        }

        const dist = Math.hypot(patch.x - this.sprite.x, patch.y - this.sprite.y);

        if (dist > GRASS_APPROACH_RANGE) {
            this.eatPatch = null;
            return null;
        }

        this.eatPatch = patch;

        if (dist > GRASS_EAT_ARRIVE) {
            this.moveToward(patch.x, patch.y, FOLLOW_SPEED * this.followSpeedScale());
            this.sprite.setAngle(this.waddleAngle(now));
            this.faceVelocity();
            this.placeShadow();
            return 'walking';
        }

        patch.claim();
        this.mood = 'eating';
        this.eatUntil = now + EAT_MS;
        this.body.setVelocity(0, 0);
        this.sprite.setAngle(-10);
        this.placeShadow();
        return 'ate';
    }

    /** True once this sheep has reached its shore spot and is waiting to sip. */
    get atDrinkSpot (): boolean {
        if (!this.drinkSpot || this.hurt) {
            return false;
        }

        return Math.hypot(this.drinkSpot.x - this.sprite.x, this.drinkSpot.y - this.sprite.y) <= DRINK_ARRIVE;
    }

    /** Walk to a shore spot, then sip facing the lake. */
    walkToDrink (x: number, y: number, faceX: number): void {
        if (this.hurt || this.mood === 'penned' || this.mood === 'waiting') {
            return;
        }

        this.thirsty = true;
        this.drinkSpot = { x, y };
        this.drinkFaceX = faceX;
        this.eatPatch = null;

        if (this.mood === 'eating' || this.mood === 'drinking') {
            this.mood = 'following';
            this.sprite.setAngle(0);
        }

        this.body.setImmovable(false);
    }

    private tickThirst (now: number): 'walking' | null {
        if (!this.drinkSpot) {
            return null;
        }

        const dist = Math.hypot(this.drinkSpot.x - this.sprite.x, this.drinkSpot.y - this.sprite.y);

        if (dist > DRINK_ARRIVE) {
            this.moveToward(this.drinkSpot.x, this.drinkSpot.y, this.trailSpeed());
            this.sprite.setAngle(this.waddleAngle(now));
            this.faceVelocity();
            this.placeShadow();
            return 'walking';
        }

        this.body.setVelocity(0, 0);
        this.sprite.setAngle(0);
        this.sprite.setFlipX(this.drinkFaceX < this.sprite.x);
        this.placeShadow();
        return 'walking';
    }

    beginSip (now: number): boolean {
        if (this.mood === 'drinking') {
            return false;
        }

        this.mood = 'drinking';
        this.drinkUntil = now + DRINK_MS;
        this.body.setVelocity(0, 0);
        this.sprite.setAngle(12);
        this.sprite.setFlipX(this.drinkFaceX < this.sprite.x);
        this.placeShadow();
        return true;
    }

    private pickEatPatch (grass: GrassPatch[]): GrassPatch | null {
        if (this.eatPatch?.available) {
            return this.eatPatch;
        }

        let nearest: GrassPatch | null = null;
        let best = Infinity;

        for (const tuft of grass) {
            if (!tuft.available) {
                continue;
            }

            const dist = Math.hypot(tuft.x - this.sprite.x, tuft.y - this.sprite.y);

            if (dist < best) {
                best = dist;
                nearest = tuft;
            }
        }

        return nearest;
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

function isInsideOrOnKeepOut (x: number, y: number, zones: KeepOutZone[]): boolean {
    return zones.some((zone) => Math.hypot(x - zone.x, y - zone.y) <= zone.radius);
}

/**
 * Push a point outside any keep-out circle.
 * @param margin Extra pixels past the rim (sheep follow targets / exit aims).
 */
export function pushOutsideKeepOuts (
    x: number,
    y: number,
    zones: KeepOutZone[],
    margin = 0
): { x: number; y: number } {
    let point = { x, y };

    for (const zone of zones) {
        point = pushOutsideKeepOut(point.x, point.y, zone, margin);
    }

    return point;
}

/** Push a point outside the keep-out circle (optionally past the rim). */
function pushOutsideKeepOut (
    x: number,
    y: number,
    zone: KeepOutZone,
    margin = 0
): { x: number; y: number } {
    const outer = zone.radius + margin;
    const dx = x - zone.x;
    const dy = y - zone.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= outer) {
        return { x, y };
    }

    if (dist < 1) {
        return { x: zone.x + outer, y: zone.y };
    }

    const scale = outer / dist;
    return { x: zone.x + dx * scale, y: zone.y + dy * scale };
}

/** Fan left/right of the trail: 0 center, then +L, −L, +2L, −2L, … */
function trailLateralOffset (slot: number): number {
    if (slot <= 0) {
        return 0;
    }

    const pair = Math.ceil(slot / 2);
    return (slot % 2 === 1 ? 1 : -1) * pair * FOLLOW_LATERAL;
}

/** Trimmed wolf/lion textures keep aspect; origin sits the paws on the shadow. */
function fitBeastSprite (sprite: GameObjects.Sprite): void {
    const src = sprite.texture.getSourceImage() as { width: number; height: number };
    const height = BEAST_SIZE;
    const width = height * (src.width / Math.max(src.height, 1));
    sprite.setDisplaySize(width, height);
    sprite.setOrigin(0.5, 0.72);
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
