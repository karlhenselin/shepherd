import { Scene } from 'phaser';

export const ABC_KEYBOARD_KEY = 'abc-keyboard';
export const ABC_KEYBOARD_SIZE = 40;
export const ABC_KEYBOARD_LIST_SIZE = 28;

export function ensureAbcKeyboardIcon (scene: Scene): void {
    if (scene.textures.exists(ABC_KEYBOARD_KEY)) {
        return;
    }

    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create ABC keyboard icon');
    }

    paintAbcChip(ctx, size);
    scene.textures.addCanvas(ABC_KEYBOARD_KEY, canvas);
}

function paintAbcChip (ctx: CanvasRenderingContext2D, size: number): void {
    const pad = 4;
    const radius = 14;

    ctx.fillStyle = 'rgba(243, 234, 216, 0.86)';
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();

    const labels = ['A', 'B', 'C'] as const;
    const keyW = 26;
    const keyH = 22;
    const startX = size / 2 - 18;
    const startY = size / 2 - 20;
    const stepX = 10;
    const stepY = 12;

    for (let i = 0; i < labels.length; i++) {
        const x = startX + i * stepX;
        const y = startY + i * stepY;
        paintKey(ctx, x, y, keyW, keyH, labels[i]);
    }
}

function paintKey (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string
): void {
    ctx.fillStyle = '#e8dcc8';
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();

    ctx.strokeStyle = '#3d2c1e';
    ctx.lineWidth = 2.5;
    roundRect(ctx, x, y, w, h, 5);
    ctx.stroke();

    ctx.fillStyle = '#3d2c1e';
    ctx.font = 'bold 14px Georgia, Palatino, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
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
