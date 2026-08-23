import { GameObjects, Scene } from 'phaser';
import { Shepherd } from '../entities/Shepherd';

const OFFSET = 48;
const HIDE_PADDING = 90;

export class LostSheepHint {
    private readonly arrow: GameObjects.Image;

    constructor (scene: Scene) {
        ensureHintTexture(scene);
        this.arrow = scene.add.image(0, 0, 'lost-sheep-hint');
        this.arrow.setDepth(18);
        this.arrow.setVisible(false);
    }

    update (scene: Scene, shepherd: Shepherd, target: { x: number; y: number } | null): void {
        if (!target) {
            this.arrow.setVisible(false);
            return;
        }

        if (isOnScreen(scene, target.x, target.y)) {
            this.arrow.setVisible(false);
            return;
        }

        const angle = Math.atan2(target.y - shepherd.sprite.y, target.x - shepherd.sprite.x);

        this.arrow.setVisible(true);
        this.arrow.setPosition(
            shepherd.sprite.x + Math.cos(angle) * OFFSET,
            shepherd.sprite.y + Math.sin(angle) * OFFSET
        );
        this.arrow.setRotation(angle);
    }
}

function isOnScreen (scene: Scene, x: number, y: number): boolean {
    const view = scene.cameras.main.worldView;

    return x > view.x + HIDE_PADDING
        && x < view.right - HIDE_PADDING
        && y > view.y + HIDE_PADDING
        && y < view.bottom - HIDE_PADDING;
}

function ensureHintTexture (scene: Scene): void {
    if (scene.textures.exists('lost-sheep-hint')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3d2c1e, 0.92);
    g.fillTriangle(26, 10, 4, 2, 4, 18);
    g.fillStyle(0xf3ead8, 0.95);
    g.fillTriangle(22, 10, 7, 5, 7, 15);
    g.generateTexture('lost-sheep-hint', 28, 20);
    g.destroy();
}
