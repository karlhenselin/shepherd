import { GameObjects, Scene, Geom } from 'phaser';
import { characterDepth, WORLD_HEIGHT, WORLD_WIDTH } from '../world/constants';
import { Shepherd } from './Shepherd';
import { FlockAppearance, FlockBehavior } from './flockBehavior';

const TEXTURE_KEY = 'wolf';
const SHADOW_KEY = 'wolf-shadow';
const SIZE = 48;
const SHADOW_OFFSET = 18;
/** Orbit radius around the flock — nearer the sheep than the old shepherd ring. */
const SHEEP_ORBIT_DIST = 230;
const STAFF_SHEEP_ORBIT_DIST = 290;
/** Aggressive stalker closes in this far when hunting. */
const HUNT_ORBIT_DIST = 150;
const APPROACH_DIST = 340;
const STAFF_APPROACH_DIST = 400;
const RETREAT_SAFE_DIST = 380;
const STAFF_RETREAT_SAFE_DIST = 460;
const ORBIT_SPEED = 78;
const HUNT_SPEED = 118;
const FLEE_SPEED = 150;
const EXIT_SPEED = 92;
const ORBIT_RAD_PER_MS = 0.00022;
const RETREAT_MS = 1400;
/** Shepherd velocity dot toward wolf (normalized) above this counts as walking in. */
const APPROACH_DOT = 0.28;
export const WOLF_ATTACK_RANGE = 40;
const PAD = 80;
const WALK_PHASE_SPEED = 0.012;
const MOVE_THRESHOLD = 0.35;
const WALK_BOB_DEG = 5;
const FLOCK_SIZE = 48;
const FLOCK_SHADOW_OFFSET = 4;

type WolfMode = 'orbit' | 'retreat' | 'hunt';

function wolfFlockAppearance (): FlockAppearance {
    return {
        textureKey: TEXTURE_KEY,
        restTextureKey: 'wolf-lying',
        shadowKey: SHADOW_KEY,
        displayHeight: FLOCK_SIZE,
        restDisplayHeight: 34,
        fitAspect: true,
        originY: 0.72,
        restOriginY: 0.88,
        shadowOffset: FLOCK_SHADOW_OFFSET,
        shadowDisplaySize: { width: 60, height: 24 },
        shadowTiltDeg: 7,
        traits: {
            followSpeed: 1.36,
            trailScale: 0.72,
            strayWeight: 0,
            waddleDeg: 4,
            waddlePeriod: 86,
            waddlePhase: 1.1
        }
    };
}

/**
 * Night glimpse — heard, not fought. Circles the flock at a distance and
 * slips away if the shepherd walks toward it, then arcs back nearer the sheep.
 * The night stalker can hunt aggressively; table wolves only script in/out.
 */
export class Wolf {
    readonly sprite: GameObjects.Sprite;
    private readonly shadow: GameObjects.Image;
    private angle: number;
    private mode: WolfMode = 'orbit';
    private retreatUntil = 0;
    private scriptGoal: { x: number; y: number } | null = null;
    private scriptSpeed = ORBIT_SPEED;
    private scriptArrive: (() => void) | null = null;
    private holding = false;
    private exiting = false;
    private aggressive = false;
    private originX = 0;
    private originY = 0;
    private walkPhase = 0;
    private lastX = 0;
    private lastY = 0;

    /** Peaceable Sarah — same wolf art, flock physics and follow AI. */
    static joinFlock (scene: Scene, x: number, y: number, slot: number): FlockBehavior {
        ensureWolfTexture(scene);
        ensureWolfShadow(scene);
        return new FlockBehavior(scene, x, y, 'Sarah', slot, wolfFlockAppearance(), true);
    }

    constructor (scene: Scene, aroundX: number, aroundY: number) {
        ensureWolfTexture(scene);
        ensureWolfShadow(scene);

        this.angle = Math.random() * Math.PI * 2;
        const spawn = ringPoint(aroundX, aroundY, SHEEP_ORBIT_DIST * 5, this.angle);
        this.originX = spawn.x;
        this.originY = spawn.y;
        this.shadow = scene.add.image(spawn.x, spawn.y + SHADOW_OFFSET, SHADOW_KEY);
        this.shadow.setDisplaySize(32, 11);
        this.sprite = scene.add.sprite(spawn.x, spawn.y, TEXTURE_KEY);
        const src = this.sprite.texture.getSourceImage() as { width: number; height: number };
        this.sprite.setDisplaySize(SIZE * (src.width / Math.max(src.height, 1)), SIZE);
        this.sprite.setOrigin(0.5, 0.72);
        this.lastX = spawn.x;
        this.lastY = spawn.y;
        this.placeShadow();
    }

    get isAggressive (): boolean {
        return this.aggressive;
    }

    get isExiting (): boolean {
        return this.exiting;
    }

    setAggressive (aggressive = true): void {
        this.aggressive = aggressive;
    }

    setOrigin (x: number, y: number): void {
        this.originX = x;
        this.originY = y;
    }

    placeAt (x: number, y: number): void {
        this.sprite.setPosition(x, y);
        this.lastX = x;
        this.lastY = y;
        this.placeShadow();
    }

    /** Walk in a straight line (table-sequence wolves), then fire onArrive. */
    walkTo (x: number, y: number, speed: number, onArrive?: () => void): void {
        this.exiting = false;
        this.holding = false;
        this.scriptGoal = { x, y };
        this.scriptSpeed = speed;
        this.scriptArrive = onArrive ?? null;
    }

    /** Stay put (firelight rim) instead of falling back to night-stalk orbit. */
    hold (): void {
        this.scriptGoal = null;
        this.scriptArrive = null;
        this.holding = true;
        this.resetWalkPose();
        this.placeShadow();
    }

    /** Walk back the way it came; removed once off-screen. */
    walkAway (awayFromX?: number, awayFromY?: number): void {
        let dx = this.sprite.x - this.originX;
        let dy = this.sprite.y - this.originY;

        if (Math.hypot(dx, dy) < 12 && awayFromX !== undefined && awayFromY !== undefined) {
            dx = this.sprite.x - awayFromX;
            dy = this.sprite.y - awayFromY;
        }

        const len = Math.hypot(dx, dy) || 1;
        this.beginExit(dx / len, dy / len);
    }

    /** Flee east when the lion charges in from the west. */
    walkAwayEast (speed = FLEE_SPEED, driftY = 0): void {
        this.beginExit(1, driftY, speed);
    }

    private beginExit (dirX: number, dirY: number, speed = EXIT_SPEED): void {
        this.exiting = true;
        this.holding = false;
        this.aggressive = false;
        this.mode = 'orbit';
        this.scriptArrive = null;

        const len = Math.hypot(dirX, dirY) || 1;
        const far = 1400;
        this.scriptGoal = {
            x: this.sprite.x + (dirX / len) * far,
            y: this.sprite.y + (dirY / len) * far
        };
        this.scriptSpeed = speed;

        if (Math.abs(dirX) > 0.08) {
            this.sprite.setFlipX(dirX < 0);
        }
    }

    isOffScreen (view: Geom.Rectangle, margin = 72): boolean {
        const { x, y } = this.sprite;

        return (
            x < view.left - margin
            || x > view.right + margin
            || y < view.top - margin
            || y > view.bottom + margin
        );
    }

    update (shepherd: Shepherd, deltaMs: number, sheep: { x: number; y: number }[] = []): void {
        if (!this.sprite.active) {
            return;
        }

        if (this.exiting) {
            this.tickScript(deltaMs);
            this.tickWalkAnim(deltaMs);
            return;
        }

        if (this.scriptGoal) {
            this.tickScript(deltaMs);
            this.tickWalkAnim(deltaMs);
            return;
        }

        if (this.holding) {
            this.resetWalkPose();
            this.placeShadow();
            return;
        }

        const sx = shepherd.sprite.x;
        const sy = shepherd.sprite.y;
        const wx = this.sprite.x;
        const wy = this.sprite.y;
        const toWolfX = wx - sx;
        const toWolfY = wy - sy;
        const dist = Math.hypot(toWolfX, toWolfY) || 1;
        const hasStaff = shepherd.hasStaff;
        const approachDist = hasStaff ? STAFF_APPROACH_DIST : APPROACH_DIST;
        const safeDist = hasStaff ? STAFF_RETREAT_SAFE_DIST : RETREAT_SAFE_DIST;
        const orbitDist = hasStaff ? STAFF_SHEEP_ORBIT_DIST : SHEEP_ORBIT_DIST;
        const focus = flockFocus(sheep, sx, sy);
        const now = this.sprite.scene.time.now;
        const body = shepherd.sprite.body as Phaser.Physics.Arcade.Body | null;
        const speed = Math.hypot(body?.velocity.x ?? 0, body?.velocity.y ?? 0);
        const approachDot = speed > 12 && body
            ? (body.velocity.x * toWolfX + body.velocity.y * toWolfY) / (speed * dist)
            : 0;

        if (this.mode === 'retreat') {
            this.tickRetreat(sx, sy, safeDist, now, deltaMs);
        }
        else if (approachDot > APPROACH_DOT && dist < approachDist) {
            this.beginRetreat(focus, sx, sy, now);
            this.tickRetreat(sx, sy, safeDist, now, deltaMs);
        }
        else if (this.aggressive && sheep.length > 0) {
            this.mode = 'hunt';
            this.tickHunt(sheep, deltaMs);
        }
        else {
            this.mode = 'orbit';
            this.tickOrbit(focus, orbitDist, deltaMs);
        }

        if (Math.abs(sx - wx) > 8) {
            this.sprite.setFlipX(sx < wx);
        }

        this.tickWalkAnim(deltaMs);
    }

    destroy (): void {
        this.sprite.destroy();
        this.shadow.destroy();
    }

    private beginRetreat (focus: { x: number; y: number }, shepherdX: number, shepherdY: number, now: number): void {
        this.mode = 'retreat';
        this.retreatUntil = now + RETREAT_MS;
        this.angle = Math.atan2(focus.y - shepherdY, focus.x - shepherdX);
    }

    private tickRetreat (
        shepherdX: number,
        shepherdY: number,
        safeDist: number,
        now: number,
        deltaMs: number
    ): void {
        const awayX = this.sprite.x - shepherdX;
        const awayY = this.sprite.y - shepherdY;
        const awayLen = Math.hypot(awayX, awayY) || 1;
        const step = FLEE_SPEED * (deltaMs / 1000);
        const nx = clamp(this.sprite.x + (awayX / awayLen) * step, PAD, WORLD_WIDTH - PAD);
        const ny = clamp(this.sprite.y + (awayY / awayLen) * step, PAD, WORLD_HEIGHT - PAD);
        this.sprite.setPosition(nx, ny);

        const newDist = Math.hypot(nx - shepherdX, ny - shepherdY);

        if (now >= this.retreatUntil && newDist >= safeDist) {
            this.mode = this.aggressive ? 'hunt' : 'orbit';
        }
    }

    private tickHunt (sheep: { x: number; y: number }[], deltaMs: number): void {
        let nearest = sheep[0];
        let best = Infinity;

        for (const point of sheep) {
            const d = Math.hypot(point.x - this.sprite.x, point.y - this.sprite.y);

            if (d < best) {
                best = d;
                nearest = point;
            }
        }

        const tx = nearest.x - this.sprite.x;
        const ty = nearest.y - this.sprite.y;
        const gap = Math.hypot(tx, ty);

        if (gap > HUNT_ORBIT_DIST) {
            const step = Math.min(gap - HUNT_ORBIT_DIST, HUNT_SPEED * (deltaMs / 1000));
            this.sprite.x += (tx / gap) * step;
            this.sprite.y += (ty / gap) * step;
        }
        else if (gap > 4) {
            const step = Math.min(gap, HUNT_SPEED * 0.65 * (deltaMs / 1000));
            this.sprite.x += (tx / gap) * step;
            this.sprite.y += (ty / gap) * step;
        }

        if (Math.abs(tx) > 8) {
            this.sprite.setFlipX(tx < 0);
        }
    }

    private tickOrbit (focus: { x: number; y: number }, orbitDist: number, deltaMs: number): void {
        this.angle += ORBIT_RAD_PER_MS * deltaMs;
        const target = ringPoint(focus.x, focus.y, orbitDist, this.angle);
        const tx = target.x - this.sprite.x;
        const ty = target.y - this.sprite.y;
        const gap = Math.hypot(tx, ty);

        if (gap > 4) {
            const step = Math.min(gap, ORBIT_SPEED * (deltaMs / 1000));
            this.sprite.x += (tx / gap) * step;
            this.sprite.y += (ty / gap) * step;
        }
    }

    private tickScript (deltaMs: number): void {
        const goal = this.scriptGoal;

        if (!goal) {
            return;
        }

        const dx = goal.x - this.sprite.x;
        const dy = goal.y - this.sprite.y;
        const gap = Math.hypot(dx, dy);

        if (gap <= 6) {
            this.scriptGoal = null;
            const arrived = this.scriptArrive;
            this.scriptArrive = null;
            arrived?.();
            this.resetWalkPose();
            this.placeShadow();
            return;
        }

        const step = Math.min(gap, this.scriptSpeed * (deltaMs / 1000));
        this.sprite.x += (dx / gap) * step;
        this.sprite.y += (dy / gap) * step;

        if (Math.abs(dx) > 8) {
            this.sprite.setFlipX(dx < 0);
        }

        this.placeShadow();
    }

    /** Gentle lope — angle only; never touch scale after setDisplaySize (1024px PNG). */
    private tickWalkAnim (deltaMs: number): void {
        const x = this.sprite.x;
        const y = this.sprite.y;
        const moved = Math.hypot(x - this.lastX, y - this.lastY);
        this.lastX = x;
        this.lastY = y;

        if (moved < MOVE_THRESHOLD) {
            this.resetWalkPose();
            return;
        }

        this.walkPhase += deltaMs * WALK_PHASE_SPEED;
        this.sprite.setAngle(Math.sin(this.walkPhase) * WALK_BOB_DEG);
        this.placeShadow();
    }

    private resetWalkPose (): void {
        this.sprite.setAngle(0);
    }

    private placeShadow (): void {
        const depth = characterDepth(this.sprite.y);
        this.sprite.setDepth(depth);
        this.shadow.setDepth(depth - 0.01);
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }
}

function flockFocus (sheep: { x: number; y: number }[], fallbackX: number, fallbackY: number): { x: number; y: number } {
    if (sheep.length === 0) {
        return { x: fallbackX, y: fallbackY };
    }

    let sx = 0;
    let sy = 0;

    for (const point of sheep) {
        sx += point.x;
        sy += point.y;
    }

    return { x: sx / sheep.length, y: sy / sheep.length };
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
