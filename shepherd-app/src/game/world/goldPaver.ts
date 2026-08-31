import { GameObjects, Scene } from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from './constants';

const TEXTURE_KEYS = ['gold-paver-0', 'gold-paver-1', 'gold-paver-2'] as const;
const DEPTH = 2.45;
const FALL_PX = 210;
const DISPLAY_W = 44;
const DISPLAY_H = 30;
const MAX_PAVERS = 24;
/** Center-to-center so flagstones cannot stack (max stone ~51px wide). */
const PAVER_GAP = 56;

const live: GameObjects.Image[] = [];

/** A flagstone that falls in like terrain rain, then stays on the ground. */
export function rainGoldPaver (scene: Scene, x: number, y: number, alongAngle: number): void {
    ensurePaverTextures(scene);

    const landX = clamp(x, 24, WORLD_WIDTH - 24);
    const landY = clamp(y, 24, WORLD_HEIGHT - 24);
    const key = TEXTURE_KEYS[Math.floor(Math.random() * TEXTURE_KEYS.length)];
    const paver = takePaver(scene, key);

    dropPaver(scene, paver, landX, landY, alongAngle);
}

/** True when a new stone can land here without overlapping one already down. */
export function goldPaverSpotOpen (x: number, y: number): boolean {
    const skip = live.length >= MAX_PAVERS ? live[0] : null;

    for (const paver of live) {
        if (paver === skip || !paver.scene) {
            continue;
        }

        const landX = Number(paver.getData('landX'));
        const landY = Number(paver.getData('landY'));

        if (Math.hypot(x - landX, y - landY) < PAVER_GAP) {
            return false;
        }
    }

    return true;
}

export function nearestGoldPaverDist (x: number, y: number): number {
    let best = Infinity;

    for (const paver of live) {
        if (!paver.scene) {
            continue;
        }

        const landX = Number(paver.getData('landX'));
        const landY = Number(paver.getData('landY'));
        const dist = Math.hypot(x - landX, y - landY);

        if (dist < best) {
            best = dist;
        }
    }

    return best;
}

export function clearGoldPavers (scene: Scene): void {
    for (const paver of live) {
        if (!paver.scene) {
            continue;
        }

        scene.tweens.killTweensOf(paver);
        paver.destroy();
    }

    live.length = 0;
}

function takePaver (scene: Scene, key: string): GameObjects.Image {
    while (live.length >= MAX_PAVERS) {
        const oldest = live.shift();

        if (!oldest?.scene) {
            continue;
        }

        scene.tweens.killTweensOf(oldest);
        oldest.setTexture(key);
        live.push(oldest);
        return oldest;
    }

    const paver = scene.add.image(0, 0, key);
    live.push(paver);
    return paver;
}

function dropPaver (
    scene: Scene,
    paver: GameObjects.Image,
    landX: number,
    landY: number,
    alongAngle: number
): void {
    const scale = 0.88 + Math.random() * 0.28;

    paver.setDepth(DEPTH);
    paver.setData('landX', landX);
    paver.setData('landY', landY);
    paver.setPosition(landX, landY - (FALL_PX + Math.random() * 70));
    paver.setDisplaySize(DISPLAY_W * scale, DISPLAY_H * scale);
    paver.setRotation(alongAngle + (Math.random() - 0.5) * 0.22);
    const landScaleX = paver.scaleX;
    const landScaleY = paver.scaleY;
    paver.setAlpha(0.2);
    paver.setScale(landScaleX * 0.72, landScaleY * 0.72);

    scene.tweens.add({
        targets: paver,
        x: landX,
        y: landY,
        alpha: 1,
        scaleX: landScaleX,
        scaleY: landScaleY,
        duration: 500 + Math.random() * 260,
        ease: 'Cubic.easeIn'
    });
}

function ensurePaverTextures (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEYS[0])) {
        return;
    }

    paintPaver(scene, TEXTURE_KEYS[0], [
        [6, 10], [22, 4], [42, 9], [46, 20], [38, 30], [12, 31], [3, 21]
    ]);
    paintPaver(scene, TEXTURE_KEYS[1], [
        [8, 8], [26, 3], [44, 8], [47, 18], [40, 28], [18, 32], [4, 22]
    ]);
    paintPaver(scene, TEXTURE_KEYS[2], [
        [5, 12], [20, 5], [40, 6], [48, 16], [42, 28], [16, 33], [4, 24]
    ]);
}

function paintPaver (scene: Scene, key: string, points: number[][]): void {
    const g = scene.add.graphics();

    g.fillStyle(0x8a6a18, 1);
    g.fillPoints(toPoints(points, 1, 1), true);
    g.fillStyle(0xc9a227, 1);
    g.fillPoints(toPoints(points), true);
    g.fillStyle(0xe6c04a, 1);
    g.fillEllipse(24, 14, 22, 10);
    g.fillStyle(0xf3d36a, 0.55);
    g.fillEllipse(20, 11, 14, 6);
    g.lineStyle(1.4, 0x6b5310, 0.85);
    g.strokePoints(toPoints(points), true);
    g.generateTexture(key, 52, 36);
    g.destroy();
}

function toPoints (points: number[][], dx = 0, dy = 0): { x: number; y: number }[] {
    return points.map(([x, y]) => ({ x: x + dx, y: y + dy }));
}

function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
