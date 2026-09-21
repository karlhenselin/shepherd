import { Scene } from 'phaser';

export const EAR_ICON_KEY = 'ear-listen';
export const EAR_ICON_SIZE = 40;

/** Paper chip with a bold ear + waves — replay passage audio. */
export function ensureEarIcon (scene: Scene): void {
    if (scene.textures.exists(EAR_ICON_KEY)) {
        return;
    }

    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create ear icon');
    }

    const pad = 4;
    const radius = 14;
    ctx.fillStyle = 'rgba(243, 234, 216, 0.86)';
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();

    paintEar(ctx, size / 2, size / 2);
    scene.textures.addCanvas(EAR_ICON_KEY, canvas);
}

function paintEar (ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const color = '#3d2c1e';
    const paper = 'rgba(243, 234, 216, 0.95)';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Profile ear (opening faces left, toward sound).
    // Shifted right so waves have room on the left.
    const ex = cx + 6;
    ctx.beginPath();
    ctx.moveTo(ex - 2, cy - 20);
    ctx.bezierCurveTo(ex + 16, cy - 22, ex + 22, cy - 6, ex + 18, cy + 6);
    ctx.bezierCurveTo(ex + 16, cy + 16, ex + 8, cy + 22, ex - 2, cy + 20);
    ctx.bezierCurveTo(ex - 8, cy + 18, ex - 10, cy + 10, ex - 6, cy + 4);
    ctx.bezierCurveTo(ex - 12, cy + 2, ex - 12, cy - 8, ex - 4, cy - 12);
    ctx.bezierCurveTo(ex - 8, cy - 16, ex - 6, cy - 20, ex - 2, cy - 20);
    ctx.closePath();
    ctx.fill();

    // Inner canal (paper cut so it reads as an opening).
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.moveTo(ex - 1, cy - 8);
    ctx.bezierCurveTo(ex + 8, cy - 8, ex + 10, cy + 2, ex + 4, cy + 8);
    ctx.bezierCurveTo(ex + 1, cy + 10, ex - 2, cy + 6, ex - 1, cy + 2);
    ctx.bezierCurveTo(ex - 4, cy + 0, ex - 4, cy - 6, ex - 1, cy - 8);
    ctx.closePath();
    ctx.fill();

    // Sound waves entering the ear (listen).
    ctx.beginPath();
    ctx.arc(ex - 10, cy, 9, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex - 10, cy, 16, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();
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
