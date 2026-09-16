import { Scene } from 'phaser';

export const SHEEP_VERSE_KEY = 'sheep-verse';
export const SHEEP_VERSE_SIZE = 40;
export const SHEEP_VERSE_LIST_SIZE = 28;

/** Paper chip: tiny sheep with a word tag — matches ABC HUD style. */
export function ensureSheepVerseIcon (scene: Scene): void {
    if (scene.textures.exists(SHEEP_VERSE_KEY)) {
        return;
    }

    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create sheep verse icon');
    }

    paintSheepVerseChip(ctx, size);
    scene.textures.addCanvas(SHEEP_VERSE_KEY, canvas);
}

function paintSheepVerseChip (ctx: CanvasRenderingContext2D, size: number): void {
    const pad = 4;
    const radius = 14;

    ctx.fillStyle = 'rgba(243, 234, 216, 0.86)';
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();

    // Word tag above the sheep
    const tagW = 36;
    const tagH = 16;
    const tagX = (size - tagW) / 2;
    const tagY = 12;
    ctx.fillStyle = '#e8dcc8';
    roundRect(ctx, tagX, tagY, tagW, tagH, 5);
    ctx.fill();
    ctx.strokeStyle = '#3d2c1e';
    ctx.lineWidth = 2;
    roundRect(ctx, tagX, tagY, tagW, tagH, 5);
    ctx.stroke();

    ctx.fillStyle = '#3d2c1e';
    ctx.font = 'bold 11px Georgia, Palatino, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('word', size / 2, tagY + tagH / 2 + 0.5);

    // Sheep body (matches procedural sheep silhouette)
    const cx = size / 2;
    const cy = 52;
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4a574';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
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
