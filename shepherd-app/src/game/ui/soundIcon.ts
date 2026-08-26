import { Scene } from 'phaser';

export const SOUND_ON_KEY = 'sound-on';
export const SOUND_OFF_KEY = 'sound-off';
export const SOUND_ICON_SIZE = 40;

export function ensureSoundIcons (scene: Scene): void {
    if (!scene.textures.exists(SOUND_ON_KEY)) {
        scene.textures.addCanvas(SOUND_ON_KEY, paintSoundChip(true));
    }

    if (!scene.textures.exists(SOUND_OFF_KEY)) {
        scene.textures.addCanvas(SOUND_OFF_KEY, paintSoundChip(false));
    }
}

export function soundIconKey (on: boolean): string {
    return on ? SOUND_ON_KEY : SOUND_OFF_KEY;
}

function paintSoundChip (on: boolean): HTMLCanvasElement {
    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create sound icon');
    }

    const pad = 4;
    const radius = 14;

    ctx.fillStyle = 'rgba(243, 234, 216, 0.86)';
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();

    paintSpeaker(ctx, size / 2, size / 2, on);
    return canvas;
}

function paintSpeaker (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    on: boolean
): void {
    const color = '#3d2c1e';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Cone + body
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 8);
    ctx.lineTo(cx - 4, cy - 8);
    ctx.lineTo(cx + 8, cy - 16);
    ctx.lineTo(cx + 8, cy + 16);
    ctx.lineTo(cx - 4, cy + 8);
    ctx.lineTo(cx - 14, cy + 8);
    ctx.closePath();
    ctx.fill();

    if (on) {
        // Sound waves
        ctx.beginPath();
        ctx.arc(cx + 10, cy, 8, -0.7, 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 10, cy, 15, -0.7, 0.7);
        ctx.stroke();
        return;
    }

    // Muted slash
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 16);
    ctx.lineTo(cx + 18, cy - 16);
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
