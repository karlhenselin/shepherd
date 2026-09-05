import { GameObjects, Input, Scene } from 'phaser';
import { chromeInsets } from './chromeInsets';

const BASE_R = 70;
const KNOB_R = 30;
const THROW = 42;
const PAD = 24;
const DEPTH = 22;
const DEAD = 0.14;
const HIT_ALPHA = 0.001;
const BASE_ALPHA = 0.32;
const KNOB_ALPHA = 0.92;
const FADE_MS = 550;

export class AnalogStick {
    private readonly hit: GameObjects.Arc;
    private readonly base: GameObjects.Arc;
    private readonly knob: GameObjects.Arc;
    private pointerId: number | null = null;
    private originX = 0;
    private originY = 0;
    private shown = true;
    private readonly fade = { t: 1 };

    constructor (
        private readonly scene: Scene,
        private readonly onChange: (x: number, y: number) => void
    ) {
        this.hit = scene.add.circle(0, 0, BASE_R + 28, 0x000000, HIT_ALPHA)
            .setScrollFactor(0)
            .setDepth(DEPTH)
            .setInteractive({ useHandCursor: true });
        this.hit.setData('ui', true);

        this.base = scene.add.circle(0, 0, BASE_R, 0x3d2c1e, BASE_ALPHA)
            .setScrollFactor(0)
            .setDepth(DEPTH + 0.1)
            .setStrokeStyle(3, 0xf4ead8, 0.55);
        this.base.setData('ui', true);

        this.knob = scene.add.circle(0, 0, KNOB_R, 0xf3ead8, KNOB_ALPHA)
            .setScrollFactor(0)
            .setDepth(DEPTH + 0.2)
            .setStrokeStyle(3, 0x3d2c1e, 0.6);
        this.knob.setData('ui', true);

        this.base.setInteractive({ useHandCursor: true });
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
        const inset = chromeInsets();
        this.originX = PAD + BASE_R + 10 + inset.left;
        this.originY = height - PAD - BASE_R - 10 - inset.bottom;
        this.hit.setPosition(this.originX, this.originY);
        this.base.setPosition(this.originX, this.originY);

        if (this.pointerId === null) {
            this.knob.setPosition(this.originX, this.originY);
        }
    }

    setVisible (visible: boolean): void {
        this.fadeVisible(visible, 0);
    }

    /** Soft show/hide while the shepherd cannot be steered (gate sleep / the change). */
    fadeVisible (visible: boolean, durationMs = FADE_MS): void {
        // WorldScene polls this every frame. If we already target `visible`, do not
        // restart the tween — easeInOut restarts stall near the start alpha.
        if (this.shown === visible) {
            if (durationMs > 0) {
                return;
            }

            if (visible ? this.fade.t >= 1 : this.fade.t <= 0) {
                return;
            }
        }

        this.shown = visible;
        this.scene.tweens.killTweensOf(this.fade);

        if (!visible) {
            this.release();
            this.setInputEnabled(false);
        }

        if (visible) {
            this.hit.setVisible(true);
            this.base.setVisible(true);
            this.knob.setVisible(true);
        }

        if (durationMs <= 0) {
            this.fade.t = visible ? 1 : 0;
            this.applyFade();

            if (visible) {
                this.setInputEnabled(true);
            }
            else {
                this.hit.setVisible(false);
                this.base.setVisible(false);
                this.knob.setVisible(false);
            }

            return;
        }

        this.scene.tweens.add({
            targets: this.fade,
            t: visible ? 1 : 0,
            duration: durationMs,
            ease: 'Sine.easeInOut',
            onUpdate: () => this.applyFade(),
            onComplete: () => {
                this.applyFade();

                if (visible) {
                    this.setInputEnabled(true);
                    return;
                }

                this.hit.setVisible(false);
                this.base.setVisible(false);
                this.knob.setVisible(false);
            }
        });
    }

    destroy (): void {
        this.scene.tweens.killTweensOf(this.fade);
        this.scene.input.off('pointermove', this.onMove, this);
        this.scene.input.off('pointerup', this.onUp, this);
        this.scene.input.off('pointerupoutside', this.onUp, this);
        this.hit.destroy();
        this.base.destroy();
        this.knob.destroy();
    }

    private applyFade (): void {
        const t = this.fade.t;
        this.hit.setAlpha(HIT_ALPHA * t);
        this.base.setAlpha(BASE_ALPHA * t);
        this.knob.setAlpha(KNOB_ALPHA * t);
        this.base.setStrokeStyle(3, 0xf4ead8, 0.55 * t);
        this.knob.setStrokeStyle(3, 0x3d2c1e, 0.6 * t);
    }

    private setInputEnabled (enabled: boolean): void {
        if (enabled) {
            this.hit.setInteractive({ useHandCursor: true });
            this.base.setInteractive({ useHandCursor: true });
            this.knob.setInteractive({ useHandCursor: true });
            return;
        }

        this.hit.disableInteractive();
        this.base.disableInteractive();
        this.knob.disableInteractive();
    }

    private onDown (pointer: Input.Pointer): void {
        if (!this.shown) {
            return;
        }

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
