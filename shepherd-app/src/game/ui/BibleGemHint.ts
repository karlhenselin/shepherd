import { GameObjects, Scene } from 'phaser';
import { Shepherd } from '../entities/Shepherd';

/** Closer to the shepherd than the lost-sheep hint so both can show at once. */
const OFFSET = 88;
const HIDE_PADDING = 90;

export class BibleGemHint {
    private readonly arrow: GameObjects.Image;

    constructor (scene: Scene) {
        ensureHintTexture(scene);
        this.arrow = scene.add.image(0, 0, 'bible-gem-hint');
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

/** Smaller, sharper tip than lost-sheep-hint; gem-like blue-green. */
function ensureHintTexture (scene: Scene): void {
    if (scene.textures.exists('bible-gem-hint')) {
        return;
    }

    const g = scene.add.graphics();
    // Deep teal outline, elongated tip
    g.fillStyle(0x1a4568, 0.94);
    g.fillTriangle(20, 7, 2, 1, 2, 13);
    // Soft cyan-blue fill
    g.fillStyle(0x6ec0dc, 0.96);
    g.fillTriangle(17, 7, 4, 3, 4, 11);
    g.generateTexture('bible-gem-hint', 22, 14);
    g.destroy();
}
