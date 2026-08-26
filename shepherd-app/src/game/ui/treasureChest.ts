import { Scene } from 'phaser';

export const TREASURE_CHEST_KEY = 'treasure-chest';
export const TREASURE_CHEST_SIZE = 40;

export function ensureTreasureChest (scene: Scene): void {
    if (scene.textures.exists(TREASURE_CHEST_KEY)) {
        return;
    }

    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create treasure chest');
    }

    paintChestChip(ctx, size);
    scene.textures.addCanvas(TREASURE_CHEST_KEY, canvas);
}

function paintChestChip (ctx: CanvasRenderingContext2D, size: number): void {
    const pad = 4;
    const radius = 14;

    ctx.fillStyle = 'rgba(243, 234, 216, 0.86)';
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();

    const cx = size / 2;
    const cy = size / 2 + 2;
    paintChest(ctx, cx, cy);
}

function paintChest (ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Body
    ctx.fillStyle = '#8a5a32';
    roundRect(ctx, cx - 18, cy - 4, 36, 22, 3);
    ctx.fill();

    ctx.fillStyle = '#a06a3c';
    roundRect(ctx, cx - 18, cy - 4, 36, 10, 2);
    ctx.fill();

    // Lid
    ctx.fillStyle = '#6e4528';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 4);
    ctx.quadraticCurveTo(cx, cy - 22, cx + 20, cy - 4);
    ctx.lineTo(cx + 18, cy - 4);
    ctx.quadraticCurveTo(cx, cy - 18, cx - 18, cy - 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c4a574';
    roundRect(ctx, cx - 3, cy - 2, 6, 10, 1.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Bands
    ctx.fillStyle = '#c4a574';
    ctx.fillRect(cx - 18, cy + 4, 36, 3);
    ctx.fillRect(cx - 18, cy + 14, 36, 2.5);
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
