import { Scene } from 'phaser';
import { FlockAppearance, FlockBehavior, FlockTraits } from './flockBehavior';

const SHEEP_SIZE = 48;
/** Biscuit is the lamb — smaller sprite; slower follow until the change. */
const BISCUIT_SIZE = 34 * 0.95;
const SHADOW_OFFSET = 18;
const WADDLE_DEG = 7;

const SHEEP_TINT: Record<string, number> = {
    Snowball: 0xf4f7ff,
    Clover: 0xe2f0c9,
    Biscuit: 0xf3d09a,
    Milo: 0xd5cce6
};

/** How each sheep follows — tint alone was not a personality. */
const SHEEP_TRAITS: Record<string, FlockTraits> = {
    Clover: { followSpeed: 1.06, trailScale: 0.82, strayWeight: 0.45, waddleDeg: 5, waddlePeriod: 78, waddlePhase: 0.6 },
    Snowball: { followSpeed: 1.02, trailScale: 1.28, strayWeight: 1.85, waddleDeg: 10, waddlePeriod: 112, waddlePhase: 2.4 },
    Biscuit: { followSpeed: 0.78, trailScale: 1.05, strayWeight: 0.85, waddleDeg: 6.5, waddlePeriod: 128, waddlePhase: 4.1 },
    Milo: { followSpeed: 1.0608, trailScale: 0.62, strayWeight: 0.40, waddleDeg: 8, waddlePeriod: 70, waddlePhase: 5.2 }
};

/** Clover / Snowball / Milo — Biscuit matches this after the change. */
SHEEP_TRAITS.Biscuit.grownFollowSpeed = (
    SHEEP_TRAITS.Clover.followSpeed
    + SHEEP_TRAITS.Snowball.followSpeed
    + SHEEP_TRAITS.Milo.followSpeed
) / 3;

function traitsFor (name: string): FlockTraits {
    return SHEEP_TRAITS[name] ?? {
        followSpeed: 1,
        trailScale: 1,
        strayWeight: 1,
        waddleDeg: WADDLE_DEG,
        waddlePeriod: 90,
        waddlePhase: 0
    };
}

function sheepAppearance (name: string): FlockAppearance {
    const lamb = name === 'Biscuit';

    return {
        textureKey: 'sheep',
        shadowKey: 'sheep-shadow',
        displayHeight: lamb ? BISCUIT_SIZE : SHEEP_SIZE,
        fitAspect: false,
        originY: 0.5,
        shadowOffset: lamb ? 13 : SHADOW_OFFSET,
        shadowDisplaySize: lamb ? { width: 27, height: 11 } : undefined,
        tint: SHEEP_TINT[name] ?? 0xffffff,
        traits: traitsFor(name),
        bodyRadius: lamb ? 10 : undefined
    };
}

function prepareSheepAppearance (scene: Scene, name: string): FlockAppearance {
    ensureSheepTexture(scene);
    ensureSheepShadow(scene);
    return sheepAppearance(name);
}

export class Sheep extends FlockBehavior {
    constructor (scene: Scene, x: number, y: number, name: string, followSlot: number) {
        super(scene, x, y, name, followSlot, prepareSheepAppearance(scene, name), false);
    }
}

function ensureSheepTexture (scene: Scene): void {
    if (scene.textures.exists('sheep')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0xf4f0e6, 1);
    g.fillCircle(16, 18, 13);
    g.fillCircle(10, 14, 8);
    g.fillCircle(22, 14, 8);
    g.fillStyle(0xc4a574, 1);
    g.fillCircle(16, 16, 3);
    g.generateTexture('sheep', 32, 32);
    g.destroy();
}

function ensureSheepShadow (scene: Scene): void {
    if (scene.textures.exists('sheep-shadow')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(20, 8, 32, 12);
    g.generateTexture('sheep-shadow', 40, 16);
    g.destroy();
}
