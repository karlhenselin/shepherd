import { BlendModes, GameObjects, Scene } from 'phaser';
import { mulberry32, paintWash } from './watercolorPaint';

const ENTER_RANGE = 140;
const TEXTURE_KEY = 'sheepfold';
const GLOW_TEXTURE_KEY = 'campfire-glow';
const WIDTH = 280;
const HEIGHT = 210;
const DISPLAY_WIDTH = 360;
const DISPLAY_HEIGHT = 240;

/**
 * Campfire keep-out (stones + flames), in world pixels from the fold sprite center.
 * Matches sheepfold.png fire pit; old gateSpot sat on this point.
 */
const FIRE_OFFSET_X = 135;
const FIRE_OFFSET_Y = 74;
/** Keep shepherd / sheep off the smaller fire ring. */
export const FIRE_KEEP_OUT_RADIUS = 36;
/** Sleep in the south fence opening (PNG gate between the rope-wrapped posts). */
const GATE_OFFSET_X = -40;
const GATE_OFFSET_Y = 64;
/**
 * Oval of sheepfold.png rails, in world pixels from sprite center.
 * Posts sit on this ellipse; the south gate is a gap in the ring.
 */
const FENCE_CX = -28;
const FENCE_CY = 6;
const FENCE_RX = 112;
const FENCE_RY = 72;
const FENCE_POST_RADIUS = 18;
const FENCE_POSTS = 18;
const FENCE_GATE_GAP = 52;

/** Above night veil (15), below hints / sleep / UI (18+). */
const GLOW_DEPTH = 16;
/** Matches WorldScene NIGHT_VEIL_ALPHA — used to scale day→night brightness. */
const NIGHT_VEIL_REF = 0.55;
const GLOW_OUTER_SIZE = 160;
const GLOW_CORE_SIZE = 70;

export class Sheepfold {
    readonly sprite: GameObjects.Sprite;
    private readonly glowOuter: GameObjects.Image;
    private readonly glowCore: GameObjects.Image;
    private readonly glowOuterBaseScale: number;
    private readonly glowCoreBaseScaleX: number;
    private readonly glowCoreBaseScaleY: number;

    constructor (scene: Scene, x: number, y: number) {
        ensureSheepfoldTexture(scene);
        ensureCampfireGlowTexture(scene);

        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_WIDTH, DISPLAY_HEIGHT);
        this.sprite.setDepth(2);

        const fire = this.fireSpot();
        this.glowOuter = scene.add.image(fire.x, fire.y, GLOW_TEXTURE_KEY);
        this.glowOuter.setDisplaySize(GLOW_OUTER_SIZE, GLOW_OUTER_SIZE);
        this.glowOuter.setBlendMode(BlendModes.ADD);
        this.glowOuter.setDepth(GLOW_DEPTH);
        this.glowOuter.setAlpha(0.20);

        this.glowCore = scene.add.image(fire.x, fire.y - 6, GLOW_TEXTURE_KEY);
        this.glowCore.setDisplaySize(GLOW_CORE_SIZE, GLOW_CORE_SIZE);
        this.glowCore.setBlendMode(BlendModes.ADD);
        this.glowCore.setDepth(GLOW_DEPTH + 0.01);
        this.glowCore.setAlpha(0.30);

        this.glowOuterBaseScale = this.glowOuter.scaleX;
        this.glowCoreBaseScaleX = this.glowCore.scaleX;
        this.glowCoreBaseScaleY = this.glowCore.scaleY;
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    /** Campfire pit center (stones + flames), not the pen / landmark center. */
    fireSpot (): { x: number; y: number } {
        return { x: this.x + FIRE_OFFSET_X, y: this.y + FIRE_OFFSET_Y };
    }

    isNear (x: number, y: number): boolean {
        return Math.hypot(this.x - x, this.y - y) < ENTER_RANGE;
    }

    restSpot (slot: number): { x: number; y: number } {
        // Four flock slots — `/3` stacked slot 0 with slot 3.
        // Bias west into the dirt oval (not the east fence / campfire).
        const angle = (slot / 4) * Math.PI * 2;
        return {
            x: this.x - 40 + Math.cos(angle) * 36,
            y: this.y + 4 + Math.sin(angle) * 22
        };
    }

    /** Lie down in the south fence opening. */
    gateSpot (): { x: number; y: number } {
        return { x: this.x + GATE_OFFSET_X, y: this.y + GATE_OFFSET_Y };
    }

    /** Horizontal queue south of the gate — sheep line up here before filing in. */
    lineUpSpot (slot: number, count: number): { x: number; y: number } {
        const gate = this.gateSpot();
        const spread = (slot - (count - 1) / 2) * 34;
        return { x: gate.x + spread, y: gate.y + 72 };
    }

    /** A few pixels inside the south opening, slightly spread so they don't stack. */
    gateEnterSpot (slot: number, count: number): { x: number; y: number } {
        const gate = this.gateSpot();
        const spread = (slot - (count - 1) / 2) * 10;
        return { x: gate.x + spread, y: gate.y - 12 };
    }

    /**
     * Walk around the fold to the south lineup instead of cutting through the fence.
     * Empty if the sheep is already south of the gate.
     */
    southApproach (x: number, y: number, lineup: { x: number; y: number }): { x: number; y: number }[] {
        if (y >= lineup.y - 12) {
            return [];
        }

        const sideX = x > this.x + 80 ? this.x + 210 : this.x - 200;

        return [
            { x: sideX, y },
            { x: sideX, y: lineup.y }
        ];
    }

    /**
     * Shepherd dawn stand — south of the flock gather so they are not
     * sitting in walk-into pet range on wake.
     */
    wakeSpot (): { x: number; y: number } {
        const gather = this.exitSpot(1.5);
        return { x: gather.x, y: gather.y + 50 };
    }

    /**
     * Outside the fold, south of the pen — dawn gather clear of the lower-right
     * campfire and tent so trail-follow doesn't pull anyone back into the pen.
     */
    exitSpot (slot: number): { x: number; y: number } {
        // Bias slightly west of center so the line sits under the pen, not the fire.
        const spread = (slot - 1.5) * 38;
        return {
            x: this.x - 16 + spread,
            y: this.y + 148
        };
    }

    /** Lane south of the fence rails so a runner goes around the pen, not through it. */
    southLaneY (): number {
        return this.y + 168;
    }

    fireKeepOut (): { x: number; y: number; radius: number } {
        const fire = this.fireSpot();
        return {
            x: fire.x,
            y: fire.y,
            radius: FIRE_KEEP_OUT_RADIUS
        };
    }

    /** Overlapping post circles along the rail oval, with a gap at the south gate. */
    fenceKeepOuts (): { x: number; y: number; radius: number }[] {
        const cx = this.x + FENCE_CX;
        const cy = this.y + FENCE_CY;
        const gate = this.gateSpot();
        const zones: { x: number; y: number; radius: number }[] = [];

        for (let i = 0; i < FENCE_POSTS; i++) {
            const t = (i / FENCE_POSTS) * Math.PI * 2;
            const x = cx + Math.cos(t) * FENCE_RX;
            const y = cy + Math.sin(t) * FENCE_RY;

            if (Math.hypot(x - gate.x, y - gate.y) < FENCE_GATE_GAP) {
                continue;
            }

            zones.push({ x, y, radius: FENCE_POST_RADIUS });
        }

        return zones;
    }

    /**
     * Soft additive wash around the pit. Visible by day; brightens through
     * the night veil with a gentle flicker.
     */
    tickGlow (nightVeilAlpha: number, timeMs: number): void {
        const night = Math.min(1.2, Math.max(0, nightVeilAlpha / NIGHT_VEIL_REF));
        const flicker = 0.88
            + 0.07 * Math.sin(timeMs * 0.011)
            + 0.05 * Math.sin(timeMs * 0.027 + 1.7)
            + 0.04 * Math.sin(timeMs * 0.053 + 0.4);

        this.glowOuter.setAlpha((0.20 + night * 0.28) * flicker);
        this.glowCore.setAlpha((0.30 + night * 0.38) * flicker);

        const breathe = 0.97 + 0.05 * flicker;
        const coreStretch = 0.94 + 0.08 * flicker;
        this.glowOuter.setScale(this.glowOuterBaseScale * breathe);
        this.glowCore.setScale(this.glowCoreBaseScaleX * breathe, this.glowCoreBaseScaleY * coreStretch);
    }
}

function ensureSheepfoldTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create sheepfold sprite');
    }

    paintSheepfold(ctx);
    scene.textures.addCanvas(TEXTURE_KEY, canvas);
}

function ensureCampfireGlowTexture (scene: Scene): void {
    if (scene.textures.exists(GLOW_TEXTURE_KEY)) {
        return;
    }

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create campfire glow');
    }

    const cx = size / 2;
    const cy = size / 2;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    gradient.addColorStop(0, 'rgba(255, 236, 200, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 190, 110, 0.75)');
    gradient.addColorStop(0.42, 'rgba(232, 120, 48, 0.38)');
    gradient.addColorStop(0.7, 'rgba(180, 70, 28, 0.12)');
    gradient.addColorStop(1, 'rgba(80, 24, 8, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    scene.textures.addCanvas(GLOW_TEXTURE_KEY, canvas);
}

function paintSheepfold (ctx: CanvasRenderingContext2D): void {
    const rng = mulberry32(0x5e1d);

    paintWash(ctx, { x: 0.42, y: 0.58, rx: 0.46, ry: 0.40, color: '#8fbc7a', sides: 8 }, rng, 0.22, 6);
    paintWash(ctx, { x: 0.72, y: 0.36, rx: 0.28, ry: 0.24, color: '#7eab6a', sides: 7 }, rng, 0.20, 5);
    paintWash(ctx, { x: 0.78, y: 0.78, rx: 0.22, ry: 0.18, color: '#6b8f4e', sides: 7 }, rng, 0.18, 4);
    paintWash(ctx, { x: 0.42, y: 0.54, rx: 0.34, ry: 0.28, color: '#c4a574', sides: 8 }, rng, 0.30, 7);
    paintWash(ctx, { x: 0.40, y: 0.52, rx: 0.26, ry: 0.20, color: '#d8c4a0', sides: 7 }, rng, 0.26, 5);
    paintWash(ctx, { x: 0.44, y: 0.56, rx: 0.14, ry: 0.10, color: '#a67c52', sides: 6 }, rng, 0.16, 4);
    paintWash(ctx, { x: 0.82, y: 0.82, rx: 0.14, ry: 0.12, color: '#e8c992', sides: 6 }, rng, 0.22, 5);
    paintWash(ctx, { x: 0.82, y: 0.80, rx: 0.08, ry: 0.07, color: '#d4783a', sides: 6 }, rng, 0.18, 4);

    const fold = { x: 118, y: 112, rx: 86, ry: 58 };
    drawStraw(ctx, fold, rng);
    drawFence(ctx, fold, rng);
    drawCampfire(ctx, 245, 172, 0.55);
}

function drawStraw (
    ctx: CanvasRenderingContext2D,
    fold: { x: number; y: number; rx: number; ry: number },
    rng: () => number
): void {
    ctx.strokeStyle = 'rgba(232, 201, 146, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';

    for (let i = 0; i < 14; i++) {
        const px = fold.x + (rng() - 0.5) * fold.rx * 1.2;
        const py = fold.y + (rng() - 0.5) * fold.ry * 1.1;
        const a = rng() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * 8, py + Math.sin(a) * 4);
        ctx.stroke();
    }
}

function drawFence (
    ctx: CanvasRenderingContext2D,
    fold: { x: number; y: number; rx: number; ry: number },
    rng: () => number
): void {
    const posts = 16;
    const points: { x: number; y: number; gate: boolean }[] = [];

    for (let i = 0; i < posts; i++) {
        const t = (i / posts) * Math.PI * 2 + 0.18;
        const gate = t > 1.05 && t < 2.05;
        points.push({
            x: fold.x + Math.cos(t) * fold.rx,
            y: fold.y + Math.sin(t) * fold.ry,
            gate
        });
    }

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];

        if (a.gate || b.gate) {
            continue;
        }

        drawRail(ctx, a.x, a.y - 6, b.x, b.y - 6, '#7a5c3e');
        drawRail(ctx, a.x, a.y - 13, b.x, b.y - 13, '#5c4634');
    }

    for (const post of points) {
        if (post.gate) {
            continue;
        }

        drawPost(ctx, post.x, post.y, 7, 16 + rng() * 3);
    }

    const gatePosts: { x: number; y: number }[] = [];

    for (let i = 0; i < points.length; i++) {
        const post = points[i];
        const prev = points[(i + posts - 1) % posts];
        const next = points[(i + 1) % posts];

        if (!post.gate && (prev.gate || next.gate)) {
            gatePosts.push(post);
        }
    }

    for (const post of gatePosts) {
        drawPost(ctx, post.x, post.y, 8, 22);
    }

    if (gatePosts.length >= 2) {
        const hinge = gatePosts[0].x < gatePosts[1].x ? gatePosts[0] : gatePosts[1];
        drawRail(ctx, hinge.x, hinge.y - 6, hinge.x + 22, hinge.y + 16, '#7a5c3e');
        drawRail(ctx, hinge.x, hinge.y - 13, hinge.x + 20, hinge.y + 9, '#5c4634');
    }
}

function drawPost (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = 'rgba(58, 42, 24, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 3, w * 0.7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c4634';
    roundRect(ctx, x - w / 2, y - h, w, h, 2);
    ctx.fill();

    ctx.fillStyle = '#7a5c3e';
    roundRect(ctx, x - w / 2 + 1, y - h, w * 0.4, h, 2);
    ctx.fill();

    ctx.fillStyle = '#3d2c1e';
    roundRect(ctx, x - w / 2, y - h, w, 4, 2);
    ctx.fill();
}

function drawRail (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string
): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawCampfire (ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1): void {
    const s = scale;
    ctx.fillStyle = 'rgba(212, 120, 58, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const stones = [
        [-14, 4], [13, 5], [-8, 11], [7, 12], [-16, -2], [16, -1], [0, 13]
    ];

    for (const [dx, dy] of stones) {
        ctx.fillStyle = '#8a7a6a';
        ctx.beginPath();
        ctx.ellipse(cx + dx * s, cy + dy * s, 6 * s, 4 * s, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c4b8a8';
        ctx.beginPath();
        ctx.ellipse(cx + (dx - 1) * s, cy + (dy - 1) * s, 3 * s, 2 * s, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = '#5c4634';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, cy + 2 * s);
    ctx.lineTo(cx + 11 * s, cy - 4 * s);
    ctx.moveTo(cx + 10 * s, cy + 4 * s);
    ctx.lineTo(cx - 9 * s, cy - 5 * s);
    ctx.stroke();

    ctx.strokeStyle = '#7a5c3e';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 11 * s, cy);
    ctx.lineTo(cx + 9 * s, cy - 5 * s);
    ctx.stroke();

    fillFlame(ctx, cx, cy - 8 * s, 10 * s, 22 * s, '#d4783a');
    fillFlame(ctx, cx - 6 * s, cy - 4 * s, 7 * s, 16 * s, '#e07a3a');
    fillFlame(ctx, cx + 6 * s, cy - 3 * s, 6 * s, 14 * s, '#c45c2e');
    fillFlame(ctx, cx, cy - 12 * s, 5 * s, 14 * s, '#f0d5a8');
    fillFlame(ctx, cx - 2 * s, cy - 16 * s, 3 * s, 8 * s, '#fff8ee');

    ctx.fillStyle = 'rgba(247, 240, 228, 0.55)';
    fillDot(ctx, cx + 8 * s, cy - 26 * s, 1.6 * s);
    fillDot(ctx, cx - 4 * s, cy - 30 * s, 1.2 * s);
    fillDot(ctx, cx + 3 * s, cy - 34 * s, 1.1 * s);
}

function fillDot (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function fillFlame (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + w, y - h * 0.35, x + w * 0.35, y + 4);
    ctx.quadraticCurveTo(x, y + 8, x - w * 0.35, y + 4);
    ctx.quadraticCurveTo(x - w, y - h * 0.35, x, y - h);
    ctx.fill();
}

function roundRect (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}
