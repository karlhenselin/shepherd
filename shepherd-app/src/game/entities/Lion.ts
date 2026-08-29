import { GameObjects, Scene, Geom } from 'phaser';
import { characterDepth } from '../world/constants';

const TEXTURE_KEY = 'lion';
const SHADOW_KEY = 'wolf-shadow';
const SIZE = 56;
const SHADOW_OFFSET = 18;
const WALK_PHASE_SPEED = 0.012;
const MOVE_THRESHOLD = 0.35;
const WALK_BOB_DEG = 5;

/**
 * Gate-sleep cinematic: charges in from off-screen west and drives the
 * night pack off the right edge. Scripted walk only — no hunt or orbit.
 */
export class Lion {
    readonly sprite: GameObjects.Sprite;
    private readonly shadow: GameObjects.Image;
    private scriptGoal: { x: number; y: number } | null = null;
    private scriptSpeed = 200;
    private scriptArrive: (() => void) | null = null;
    private walkPhase = 0;
    private lastX = 0;
    private lastY = 0;

    constructor (scene: Scene, x: number, y: number) {
        ensureLionTexture(scene);
        ensureLionShadow(scene);

        this.shadow = scene.add.image(x, y + SHADOW_OFFSET, SHADOW_KEY);
        this.shadow.setDisplaySize(36, 12);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        const src = this.sprite.texture.getSourceImage() as { width: number; height: number };
        this.sprite.setDisplaySize(SIZE * (src.width / Math.max(src.height, 1)), SIZE);
        this.sprite.setOrigin(0.5, 0.72);
        this.sprite.setFlipX(false);
        this.lastX = x;
        this.lastY = y;
        this.placeShadow();
    }

    walkTo (x: number, y: number, speed: number, onArrive?: () => void): void {
        this.scriptGoal = { x, y };
        this.scriptSpeed = speed;
        this.scriptArrive = onArrive ?? null;
    }

    isOffScreen (view: Geom.Rectangle, margin = 72): boolean {
        const { x, y } = this.sprite;

        return (
            x < view.left - margin
            || x > view.right + margin
            || y < view.top - margin
            || y > view.bottom + margin
        );
    }

    update (deltaMs: number): void {
        if (!this.sprite.active) {
            return;
        }

        this.tickScript(deltaMs);
        this.tickWalkAnim(deltaMs);
    }

    destroy (): void {
        this.sprite.destroy();
        this.shadow.destroy();
    }

    private tickScript (deltaMs: number): void {
        const goal = this.scriptGoal;

        if (!goal) {
            return;
        }

        const dx = goal.x - this.sprite.x;
        const dy = goal.y - this.sprite.y;
        const gap = Math.hypot(dx, dy);

        if (gap <= 6) {
            this.scriptGoal = null;
            const arrived = this.scriptArrive;
            this.scriptArrive = null;
            arrived?.();
            this.sprite.setAngle(0);
            this.placeShadow();
            return;
        }

        const step = Math.min(gap, this.scriptSpeed * (deltaMs / 1000));
        this.sprite.x += (dx / gap) * step;
        this.sprite.y += (dy / gap) * step;

        if (Math.abs(dx) > 8) {
            this.sprite.setFlipX(dx < 0);
        }

        this.placeShadow();
    }

    private tickWalkAnim (deltaMs: number): void {
        const x = this.sprite.x;
        const y = this.sprite.y;
        const moved = Math.hypot(x - this.lastX, y - this.lastY);
        this.lastX = x;
        this.lastY = y;

        if (moved < MOVE_THRESHOLD) {
            this.sprite.setAngle(0);
            this.placeShadow();
            return;
        }

        this.walkPhase += deltaMs * WALK_PHASE_SPEED;
        this.sprite.setAngle(Math.sin(this.walkPhase) * WALK_BOB_DEG);
        this.placeShadow();
    }

    private placeShadow (): void {
        const depth = characterDepth(this.sprite.y);
        this.sprite.setDepth(depth);
        this.shadow.setDepth(depth - 0.01);
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }
}

function ensureLionTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0xc4a05a, 1);
    g.fillEllipse(30, 32, 40, 20);
    g.fillStyle(0x6b3e1a, 1);
    g.fillCircle(44, 24, 14);
    g.fillStyle(0xc4a05a, 1);
    g.fillCircle(48, 26, 8);
    g.generateTexture(TEXTURE_KEY, 64, 52);
    g.destroy();
}

function ensureLionShadow (scene: Scene): void {
    if (scene.textures.exists(SHADOW_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(22, 8, 36, 12);
    g.generateTexture(SHADOW_KEY, 44, 16);
    g.destroy();
}
