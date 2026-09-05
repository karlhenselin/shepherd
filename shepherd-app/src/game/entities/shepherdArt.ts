import { Scene } from 'phaser';

/** Standing textures that get a walk cycle (kneel stays single-frame). */
export const SHEPHERD_STAND_KEYS = [
    'shepherd',
    'shepherd-staff',
    'shepherd-white',
    'shepherd-staff-white'
] as const;

export const SHEPHERD_ALL_KEYS = [
    ...SHEPHERD_STAND_KEYS,
    'shepherd-kneel',
    'shepherd-kneel-staff',
    'shepherd-kneel-white',
    'shepherd-kneel-staff-white'
] as const;

export const SHEPHERD_WALK_FRAMES = 4;
/** Working texture size — 1024→80 is harsh on frayed cloak; 256→80 softens edges. */
const SHEPHERD_TEX_SIZE = 256;

export function walkAnimKey (standKey: string): string {
    return `${standKey}-walk`;
}

export function walkFrameKey (standKey: string, frame: number): string {
    return `${standKey}-walk-${frame}`;
}

/**
 * Downsample + soft alpha so frayed cloak edges don't stair-step at game size.
 * Safe to call once after Preloader load.
 */
export function prepareShepherdArt (scene: Scene): void {
    for (const key of SHEPHERD_ALL_KEYS) {
        softenShepherdTexture(scene, key);
    }

    for (const key of SHEPHERD_STAND_KEYS) {
        buildShepherdWalkFrames(scene, key);
    }
}

function softenShepherdTexture (scene: Scene, key: string): void {
    if (!scene.textures.exists(key)) {
        return;
    }

    const texture = scene.textures.get(key);
    const src = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const size = SHEPHERD_TEX_SIZE;

    const sharp = document.createElement('canvas');
    sharp.width = size;
    sharp.height = size;
    const sharpCtx = sharp.getContext('2d', { willReadFrequently: true });

    if (!sharpCtx) {
        return;
    }

    sharpCtx.imageSmoothingEnabled = true;
    sharpCtx.imageSmoothingQuality = 'high';
    sharpCtx.clearRect(0, 0, size, size);
    sharpCtx.drawImage(src, 0, 0, size, size);

    const soft = document.createElement('canvas');
    soft.width = size;
    soft.height = size;
    const softCtx = soft.getContext('2d', { willReadFrequently: true });

    if (!softCtx) {
        return;
    }

    softCtx.imageSmoothingEnabled = true;
    softCtx.filter = 'blur(1.1px)';
    softCtx.drawImage(sharp, 0, 0);
    softCtx.filter = 'none';

    const sharpData = sharpCtx.getImageData(0, 0, size, size);
    const softData = softCtx.getImageData(0, 0, size, size);
    const out = sharpData.data;
    const blur = softData.data;

    for (let i = 0; i < out.length; i += 4) {
        const hardA = out[i + 3];
        const softA = blur[i + 3];
        // Keep fill solid; only feather the fringe where blur ate alpha.
        out[i + 3] = hardA === 0 ? 0 : Math.min(hardA, Math.max(softA, Math.round(hardA * 0.35)));
    }

    sharpCtx.putImageData(sharpData, 0, 0);
    scene.textures.remove(key);
    scene.textures.addCanvas(key, sharp);
}

function buildShepherdWalkFrames (scene: Scene, standKey: string): void {
    if (!scene.textures.exists(standKey)) {
        return;
    }

    for (let frame = 0; frame < SHEPHERD_WALK_FRAMES; frame++) {
        const key = walkFrameKey(standKey, frame);

        if (scene.textures.exists(key)) {
            scene.textures.remove(key);
        }

        const phase = (frame / SHEPHERD_WALK_FRAMES) * Math.PI * 2;
        const canvas = warpWalkFrame(scene, standKey, phase);
        scene.textures.addCanvas(key, canvas);
    }

    const animKey = walkAnimKey(standKey);

    if (scene.anims.exists(animKey)) {
        scene.anims.remove(animKey);
    }

    scene.anims.create({
        key: animKey,
        frames: Array.from({ length: SHEPHERD_WALK_FRAMES }, (_, frame) => ({
            key: walkFrameKey(standKey, frame)
        })),
        frameRate: 8,
        repeat: -1
    });
}

/** Shift the lower cloak/legs and add a little stride bounce. */
function warpWalkFrame (scene: Scene, standKey: string, phase: number): HTMLCanvasElement {
    const texture = scene.textures.get(standKey);
    const src = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = src.width;
    const height = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        return canvas;
    }

    const read = document.createElement('canvas');
    read.width = width;
    read.height = height;
    const readCtx = read.getContext('2d', { willReadFrequently: true });

    if (!readCtx) {
        return canvas;
    }

    readCtx.drawImage(src, 0, 0);
    const srcData = readCtx.getImageData(0, 0, width, height);
    const dst = ctx.createImageData(width, height);
    const sp = srcData.data;
    const dp = dst.data;

    const waist = height * 0.40;
    const stride = Math.sin(phase) * width * 0.018;
    const cloak = Math.sin(phase * 2 + 0.55) * width * 0.028;
    const bounce = Math.sin(phase) * height * 0.008;

    for (let y = 0; y < height; y++) {
        const below = y > waist ? (y - waist) / (height - waist) : 0;
        const cloakFalloff = below > 0 ? Math.sin(Math.min(1, below) * Math.PI) : 0;
        const legShift = stride * below * below;
        const cloakShift = cloak * cloakFalloff;
        const dx = legShift + cloakShift;
        const dy = bounce * (0.25 + below * 0.75);

        for (let x = 0; x < width; x++) {
            const sx = x - dx;
            const sy = y - dy;
            const sample = sampleBilinear(sp, width, height, sx, sy);
            const di = (y * width + x) * 4;
            dp[di] = sample[0];
            dp[di + 1] = sample[1];
            dp[di + 2] = sample[2];
            dp[di + 3] = sample[3];
        }
    }

    ctx.putImageData(dst, 0, 0);
    return canvas;
}

function sampleBilinear (
    px: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number
): [number, number, number, number] {
    if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
        const ix = Math.max(0, Math.min(width - 1, Math.round(x)));
        const iy = Math.max(0, Math.min(height - 1, Math.round(y)));
        const i = (iy * width + ix) * 4;
        return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const i00 = (y0 * width + x0) * 4;
    const i10 = (y0 * width + x1) * 4;
    const i01 = (y1 * width + x0) * 4;
    const i11 = (y1 * width + x1) * 4;

    const out: [number, number, number, number] = [0, 0, 0, 0];

    for (let c = 0; c < 4; c++) {
        const top = px[i00 + c] * (1 - fx) + px[i10 + c] * fx;
        const bot = px[i01 + c] * (1 - fx) + px[i11 + c] * fx;
        out[c] = Math.round(top * (1 - fy) + bot * fy);
    }

    return out;
}
