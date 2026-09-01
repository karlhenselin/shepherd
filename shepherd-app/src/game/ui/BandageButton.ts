import { GameObjects, Geom, Scene, Tweens } from 'phaser';
import { addPaperGrain, mulberry32, paintWash } from '../world/watercolorPaint';

const TEXTURE_KEY = 'bandage-button';
const SIZE = 320;
const DISPLAY = 240;

export class BandageButton {
    private readonly scene: Scene;
    private readonly icon: GameObjects.Image;
    private readonly pulse: Tweens.Tween;
    private readonly baseScale: number;
    private shown: boolean | null = null;

    constructor (scene: Scene, onPress: () => void) {
        ensureTexture(scene);
        this.scene = scene;

        this.icon = scene.add.image(scene.scale.width / 2, scene.scale.height / 2 + 8, TEXTURE_KEY);
        this.icon.setDisplaySize(DISPLAY, DISPLAY);
        this.icon.setScrollFactor(0);
        this.icon.setDepth(22);
        this.icon.setInteractive({
            hitArea: new Geom.Circle(SIZE / 2, SIZE / 2, 150),
            hitAreaCallback: Geom.Circle.Contains,
            useHandCursor: true
        });
        this.icon.setData('ui', true);

        this.baseScale = this.icon.scaleX;

        const press = (
            _pointer: unknown,
            _x: number,
            _y: number,
            event: { stopPropagation: () => void }
        ) => {
            event.stopPropagation();
            onPress();
        };

        this.icon.on('pointerdown', press);
        this.icon.on('pointerover', () => this.icon.setTint(0xffe4d4));
        this.icon.on('pointerout', () => this.icon.clearTint());

        this.pulse = scene.tweens.add({
            targets: this.icon,
            scaleX: this.baseScale * 1.08,
            scaleY: this.baseScale * 1.08,
            duration: 850,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            paused: true
        });

        this.setVisible(false);
    }

    setVisible (visible: boolean): void {
        if (this.shown === visible) {
            return;
        }

        this.shown = visible;
        this.icon.setVisible(visible);

        if (visible) {
            this.pulse.resume();
            return;
        }

        this.pulse.pause();
        this.icon.setScale(this.baseScale);
        this.icon.clearTint();
    }

    layout (): void {
        this.icon.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2 + 8);
    }
}

function ensureTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        throw new Error('Could not create bandage button');
    }

    paintBandageButton(ctx);
    scene.textures.addCanvas(TEXTURE_KEY, canvas);
}

function paintBandageButton (ctx: CanvasRenderingContext2D): void {
    const rng = mulberry32(0xb4d6);
    const cx = 160;
    const cy = 148;

    paintWash(ctx, { x: 0.52, y: 0.58, rx: 0.42, ry: 0.38, color: '#3d2c1e', sides: 8 }, rng, 0.10, 4);
    paintWash(ctx, { x: 0.50, y: 0.47, rx: 0.44, ry: 0.44, color: '#6b4634', sides: 10 }, rng, 0.22, 5);
    paintWash(ctx, { x: 0.50, y: 0.46, rx: 0.38, ry: 0.38, color: '#f7f3ea', sides: 10 }, rng, 0.55, 7);
    paintWash(ctx, { x: 0.47, y: 0.44, rx: 0.30, ry: 0.30, color: '#f3ead8', sides: 8 }, rng, 0.38, 5);
    paintWash(ctx, { x: 0.50, y: 0.46, rx: 0.18, ry: 0.18, color: '#c45c4a', sides: 7 }, rng, 0.18, 4);

    ctx.fillStyle = 'rgba(61, 44, 30, 0.18)';
    fillEllipse(ctx, cx + 6, cy + 10, 126, 126);

    ctx.fillStyle = '#3d2c1e';
    fillCircle(ctx, cx, cy, 124);
    ctx.fillStyle = '#f7f3ea';
    fillCircle(ctx, cx, cy, 114);
    ctx.fillStyle = 'rgba(243, 234, 216, 0.7)';
    fillCircle(ctx, cx, cy, 104);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 104, 0, Math.PI * 2);
    ctx.clip();

    paintWash(ctx, { x: 0.50, y: 0.46, rx: 0.12, ry: 0.28, color: '#c24a42', sides: 6 }, rng, 0.28, 3);
    paintWash(ctx, { x: 0.50, y: 0.46, rx: 0.28, ry: 0.12, color: '#c24a42', sides: 6 }, rng, 0.28, 3);

    fillRoundedRect(ctx, cx - 20, cy - 64, 40, 128, 12, '#c24a42');
    fillRoundedRect(ctx, cx - 64, cy - 20, 128, 40, 12, '#c24a42');
    fillRoundedRect(ctx, cx - 14, cy - 58, 28, 116, 10, '#d96a5c');
    fillRoundedRect(ctx, cx - 58, cy - 14, 116, 28, 10, '#d96a5c');

    ctx.fillStyle = 'rgba(255, 248, 240, 0.35)';
    fillRoundedRect(ctx, cx - 8, cy - 54, 10, 40, 5, 'rgba(255, 248, 240, 0.4)');
    ctx.restore();

    ctx.strokeStyle = '#3d2c1e';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx + 46, cy + 52);
    ctx.rotate(-0.52);
    drawBandageRoll(ctx, 0, 0, 54, 22, 58);
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 252, 247, 0.45)';
    fillEllipse(ctx, cx - 36, cy - 42, 28, 16);

    addPaperGrain(ctx, rng);
}

function drawBandageRoll (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    length: number
): void {
    ctx.fillStyle = 'rgba(61, 44, 30, 0.22)';
    fillEllipse(ctx, cx + 4, cy + length + 6, rx + 2, 10);

    ctx.fillStyle = '#d4c4a8';
    fillEllipse(ctx, cx, cy + length, rx, ry);

    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(cx - rx, cy, rx * 2, length);

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - rx, cy, rx * 2, length);
    ctx.clip();
    ctx.strokeStyle = '#d8c8b0';
    ctx.lineWidth = 3;

    for (let i = 0; i < 8; i++) {
        const y = cy + 4 + i * 8;
        ctx.beginPath();
        ctx.moveTo(cx - rx, y);
        ctx.quadraticCurveTo(cx, y + 5, cx + rx, y);
        ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = '#e8dcc8';
    fillEllipse(ctx, cx, cy + length, rx, ry);

    ctx.fillStyle = '#fffaf3';
    fillEllipse(ctx, cx, cy, rx, ry);
    ctx.strokeStyle = '#c4b49a';
    ctx.lineWidth = 2.5;
    strokeEllipse(ctx, cx, cy, rx, ry);

    ctx.strokeStyle = '#d4c6ae';
    ctx.lineWidth = 2;
    strokeEllipse(ctx, cx + 2, cy, rx * 0.68, ry * 0.68);
    strokeEllipse(ctx, cx + 3, cy, rx * 0.40, ry * 0.40);
    ctx.fillStyle = '#e6d8c4';
    fillEllipse(ctx, cx + 5, cy + 1, 8, 3.5);

    fillRoundedRect(ctx, cx - 14, cy + 18, 28, 28, 6, '#c24a42');
    fillRoundedRect(ctx, cx - 5, cy + 21, 10, 22, 3, '#f7f3ea');
    fillRoundedRect(ctx, cx - 11, cy + 27, 22, 10, 3, '#f7f3ea');
}

function fillCircle (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function fillEllipse (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

function strokeEllipse (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function fillRoundedRect (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string
): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
}
