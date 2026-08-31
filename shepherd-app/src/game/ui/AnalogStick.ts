import { GameObjects, Input, Scene } from 'phaser';

const BASE_R = 70;
const KNOB_R = 30;
const THROW = 42;
const PAD = 24;
const DEPTH = 22;
const DEAD = 0.14;

export class AnalogStick {
    private readonly hit: GameObjects.Arc;
    private readonly base: GameObjects.Arc;
    private readonly knob: GameObjects.Arc;
    private pointerId: number | null = null;
    private originX = 0;
    private originY = 0;

    constructor (
        private readonly scene: Scene,
        private readonly onChange: (x: number, y: number) => void
    ) {
        this.hit = scene.add.circle(0, 0, BASE_R + 28, 0x000000, 0.001)
            .setScrollFactor(0)
            .setDepth(DEPTH)
            .setInteractive({ useHandCursor: true });
        this.hit.setData('ui', true);

        this.base = scene.add.circle(0, 0, BASE_R, 0x3d2c1e, 0.32)
            .setScrollFactor(0)
            .setDepth(DEPTH + 0.1)
            .setStrokeStyle(3, 0xf4ead8, 0.55);
        this.base.setData('ui', true);

        this.knob = scene.add.circle(0, 0, KNOB_R, 0xf3ead8, 0.92)
            .setScrollFactor(0)
            .setDepth(DEPTH + 0.2)
            .setStrokeStyle(3, 0x3d2c1e, 0.6);
        this.knob.setData('ui', true);

        this.base.setData('ui', true);
        this.base.setInteractive({ useHandCursor: true });
        this.knob.setData('ui', true);
        this.knob.setInteractive({ useHandCursor: true });

        this.hit.on('pointerdown', this.onDown, this);
        this.base.on('pointerdown', this.onDown, this);
        this.knob.on('pointerdown', this.onDown, this);
        scene.input.on('pointermove', this.onMove, this);
        scene.input.on('pointerup', this.onUp, this);
        scene.input.on('pointerupoutside', this.onUp, this);

        this.layout();
    }

    layout (): void {
        const { height } = this.scene.scale;
        this.originX = PAD + BASE_R + 10;
        this.originY = height - PAD - BASE_R - 10;
        this.hit.setPosition(this.originX, this.originY);
        this.base.setPosition(this.originX, this.originY);

        if (this.pointerId === null) {
            this.knob.setPosition(this.originX, this.originY);
        }
    }

    setVisible (visible: boolean): void {
        this.hit.setVisible(visible);
        this.base.setVisible(visible);
        this.knob.setVisible(visible);

        if (!visible) {
            this.release();
        }
    }

    destroy (): void {
        this.scene.input.off('pointermove', this.onMove, this);
        this.scene.input.off('pointerup', this.onUp, this);
        this.scene.input.off('pointerupoutside', this.onUp, this);
        this.hit.destroy();
        this.base.destroy();
        this.knob.destroy();
    }

    private onDown (pointer: Input.Pointer): void {
        this.pointerId = pointer.id;
        this.steer(pointer.x, pointer.y);
    }

    private onMove (pointer: Input.Pointer): void {
        if (this.pointerId !== pointer.id) {
            return;
        }

        this.steer(pointer.x, pointer.y);
    }

    private onUp (pointer: Input.Pointer): void {
        if (this.pointerId !== pointer.id) {
            return;
        }

        this.release();
    }

    private steer (x: number, y: number): void {
        const dx = x - this.originX;
        const dy = y - this.originY;
        const dist = Math.hypot(dx, dy);
        const limited = dist > THROW ? THROW / dist : 1;
        this.knob.setPosition(this.originX + dx * limited, this.originY + dy * limited);

        const nx = dist < 1 ? 0 : (dx / dist) * Math.min(1, dist / THROW);
        const ny = dist < 1 ? 0 : (dy / dist) * Math.min(1, dist / THROW);

        if (Math.hypot(nx, ny) < DEAD) {
            this.onChange(0, 0);
            return;
        }

        this.onChange(nx, ny);
    }

    private release (): void {
        this.pointerId = null;
        this.knob.setPosition(this.originX, this.originY);
        this.onChange(0, 0);
    }
}
