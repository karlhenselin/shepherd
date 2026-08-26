import { Scene } from 'phaser';

export const SETTINGS_GEAR_KEY = 'settings-gear';
export const SETTINGS_GEAR_SIZE = 40;

export function ensureSettingsGear (scene: Scene): void {
    if (scene.textures.exists(SETTINGS_GEAR_KEY)) {
        return;
    }

    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create settings gear');
    }

    paintGearChip(ctx, size);
    scene.textures.addCanvas(SETTINGS_GEAR_KEY, canvas);
}

function paintGearChip (ctx: CanvasRenderingContext2D, size: number): void {
    const pad = 4;
    const radius = 14;

    ctx.fillStyle = 'rgba(243, 234, 216, 0.86)';
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();

    const cx = size / 2;
    const cy = size / 2;
    paintGear(ctx, cx, cy, 22, 15.5, 7, 8);
}

function paintGear (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    hole: number,
    teeth: number
): void {
    ctx.fillStyle = '#3d2c1e';
    ctx.beginPath();

    for (let i = 0; i < teeth; i++) {
        const step = (Math.PI * 2) / teeth;
        const a0 = i * step - step / 2;
        const mid = a0 + step / 2;
        const tooth = step * 0.34;

        const x0 = cx + Math.cos(a0) * inner;
        const y0 = cy + Math.sin(a0) * inner;

        if (i === 0) {
            ctx.moveTo(x0, y0);
        }
        else {
            ctx.lineTo(x0, y0);
        }

        ctx.lineTo(cx + Math.cos(mid - tooth) * outer, cy + Math.sin(mid - tooth) * outer);
        ctx.lineTo(cx + Math.cos(mid + tooth) * outer, cy + Math.sin(mid + tooth) * outer);
        ctx.lineTo(cx + Math.cos(a0 + step) * inner, cy + Math.sin(a0 + step) * inner);
    }

    ctx.closePath();
    ctx.moveTo(cx + hole, cy);
    ctx.arc(cx, cy, hole, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
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
