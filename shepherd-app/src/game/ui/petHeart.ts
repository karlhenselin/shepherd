import { Scene } from 'phaser';

const TEXTURE_KEY = 'pet-heart';
const SIZE = 28;
/** Soft expand + fade duration (ms). */
const DURATION_MS = 1000;

/**
 * Spawns a soft rose heart that expands and fades out above a pet.
 * Call from startPetting so walk-into and find celebrations both get it.
 */
export function spawnPetHeart (scene: Scene, x: number, y: number): void {
    ensurePetHeartTexture(scene);

    const heart = scene.add.image(x, y - 30, TEXTURE_KEY);
    heart.setDepth(8);
    heart.setScale(0.4);
    heart.setAlpha(0.95);

    scene.tweens.add({
        targets: heart,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0,
        y: heart.y - 16,
        duration: DURATION_MS,
        ease: 'Cubic.easeOut',
        onComplete: () => {
            heart.destroy();
        }
    });
}

function ensurePetHeartTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    const cx = SIZE / 2;

    // Soft rose body (two lobes + point).
    g.fillStyle(0xe8a0b0, 0.95);
    g.fillCircle(cx - 5.5, 10, 6.5);
    g.fillCircle(cx + 5.5, 10, 6.5);
    g.fillTriangle(cx - 11.5, 12, cx + 11.5, 12, cx, 24);

    // Warm highlight on the left lobe.
    g.fillStyle(0xf5c4ce, 0.75);
    g.fillCircle(cx - 6, 8.5, 3.2);

    g.generateTexture(TEXTURE_KEY, SIZE, SIZE);
    g.destroy();
}
