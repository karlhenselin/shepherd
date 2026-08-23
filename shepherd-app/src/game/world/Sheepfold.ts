import { GameObjects, Scene } from 'phaser';
import { mulberry32, paintWash } from './watercolorPaint';

const ENTER_RANGE = 140;
const TEXTURE_KEY = 'sheepfold';
const WIDTH = 280;
const HEIGHT = 210;
const DISPLAY_WIDTH = 360;
const DISPLAY_HEIGHT = 240;

export class Sheepfold {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensureSheepfoldTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_WIDTH, DISPLAY_HEIGHT);
        this.sprite.setDepth(2);
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
    drawTent(ctx, 228, 78);
    drawCampfire(ctx, 232, 168);
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

function drawTent (ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const peak = { x: cx, y: cy - 46 };
    const left = { x: cx - 38, y: cy + 18 };
    const right = { x: cx + 40, y: cy + 22 };
    const front = { x: cx + 4, y: cy + 26 };

    ctx.fillStyle = 'rgba(58, 42, 24, 0.20)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 22, 42, 12, -0.18, 0, Math.PI * 2);
    ctx.fill();

    fillPoly(ctx, [peak, left, front], '#d8c4a0');
    fillPoly(ctx, [peak, front, right], '#a67c52');
    fillPoly(ctx, [peak, { x: cx - 10, y: cy - 8 }, front], '#c4a574');

    ctx.strokeStyle = '#7a5c3e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.y);
    ctx.lineTo(left.x - 4, left.y + 4);
    ctx.moveTo(peak.x, peak.y);
    ctx.lineTo(right.x + 4, right.y + 4);
    ctx.stroke();

    ctx.fillStyle = '#5c4634';
    ctx.beginPath();
    ctx.arc(peak.x, peak.y + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(61, 44, 30, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(left.x - 10, left.y + 8);
    ctx.moveTo(right.x, right.y);
    ctx.lineTo(right.x + 10, right.y + 6);
    ctx.stroke();

    ctx.fillStyle = '#3d2c1e';
    fillDot(ctx, left.x - 10, left.y + 8, 2);
    fillDot(ctx, right.x + 10, right.y + 6, 2);
}

function drawCampfire (ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.fillStyle = 'rgba(212, 120, 58, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const stones = [
        [-14, 4], [13, 5], [-8, 11], [7, 12], [-16, -2], [16, -1], [0, 13]
    ];

    for (const [dx, dy] of stones) {
        ctx.fillStyle = '#8a7a6a';
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + dy, 6, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c4b8a8';
        ctx.beginPath();
        ctx.ellipse(cx + dx - 1, cy + dy - 1, 3, 2, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = '#5c4634';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 2);
    ctx.lineTo(cx + 11, cy - 4);
    ctx.moveTo(cx + 10, cy + 4);
    ctx.lineTo(cx - 9, cy - 5);
    ctx.stroke();

    ctx.strokeStyle = '#7a5c3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy);
    ctx.lineTo(cx + 9, cy - 5);
    ctx.stroke();

    fillFlame(ctx, cx, cy - 8, 10, 22, '#d4783a');
    fillFlame(ctx, cx - 6, cy - 4, 7, 16, '#e07a3a');
    fillFlame(ctx, cx + 6, cy - 3, 6, 14, '#c45c2e');
    fillFlame(ctx, cx, cy - 12, 5, 14, '#f0d5a8');
    fillFlame(ctx, cx - 2, cy - 16, 3, 8, '#fff8ee');

    ctx.fillStyle = 'rgba(247, 240, 228, 0.55)';
    fillDot(ctx, cx + 8, cy - 26, 1.6);
    fillDot(ctx, cx - 4, cy - 30, 1.2);
    fillDot(ctx, cx + 3, cy - 34, 1.1);
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

function fillPoly (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();
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
