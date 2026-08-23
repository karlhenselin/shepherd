import { GameObjects, Scene } from 'phaser';
import { GENESIS_1_1 } from '../data/scripture';
import { speakCue, stopSpeech } from '../ui/speech';
import { START_COL, START_ROW } from '../world/constants';
import { watercolorWorld } from '../world/watercolorWorld';

const WARM_WHITE = '#f4ead8';
const UMBER = '#3d2c1e';

export class IntroScene extends Scene {
    private leaving = false;
    private line!: GameObjects.Text;
    private citation!: GameObjects.Text;
    private wipe!: GameObjects.Rectangle;

    constructor () {
        super('IntroScene');
    }

    create (): void {
        this.cameras.main.setBackgroundColor(0x000000);

        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        this.line = this.add.text(cx, cy - 24, '', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '42px',
            color: WARM_WHITE,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0).setDepth(10);

        this.citation = this.add.text(cx, cy + 36, '', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '18px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0).setDepth(10);

        this.wipe = this.add.rectangle(cx, cy, width, 2, 0xffffff)
            .setScale(0, 1)
            .setDepth(5);

        this.input.on('pointerdown', () => {
            if (this.sound.locked) {
                return;
            }

            this.goToWorld();
        });

        void this.play();
    }

    private async play (): Promise<void> {
        await this.wait(900);
        if (!this.here()) {
            return;
        }

        this.line.setText('In the beginning');
        await this.fade(this.line, 1, 900);
        await this.speak('In the beginning');
        await this.wait(450);

        if (!this.here()) {
            return;
        }

        await this.fade(this.line, 0, 400);
        this.line.setText('God');
        this.line.setFontSize(72);
        await this.fade(this.line, 1, 700);
        await this.speak('God');
        await this.wait(280);

        if (!this.here()) {
            return;
        }

        await this.wipeToWhite();

        if (!this.here()) {
            return;
        }

        this.line.setColor(UMBER);
        this.line.setFontSize(36);
        this.line.setText('Created the heavens and the Earth');
        this.citation.setText(GENESIS_1_1.ref);

        this.playExhale();

        await Promise.all([
            this.fade(this.line, 1, 800),
            this.fade(this.citation, 0.85, 1100),
            this.speak('created the heavens and the earth'),
            this.appearWatercolors()
        ]);

        this.sound.stopByKey('exhale');
        await this.wait(1600);

        if (!this.here()) {
            return;
        }

        this.goToWorld();
    }

    private async wipeToWhite (): Promise<void> {
        await this.tween({
            targets: this.wipe,
            scaleX: 1,
            duration: 700,
            ease: 'Sine.easeOut'
        });

        if (!this.here()) {
            return;
        }

        const cover = this.scale.height / 2;

        await Promise.all([
            this.tween({
                targets: this.wipe,
                scaleY: cover,
                duration: 1600,
                ease: 'Sine.easeInOut'
            }),
            this.fade(this.line, 0, 900)
        ]);

        if (!this.here()) {
            return;
        }

        this.cameras.main.setBackgroundColor(0xf7f3ea);
        this.wipe.setVisible(false);
    }

    private async appearWatercolors (): Promise<void> {
        const { width, height } = this.scale;
        const ground = watercolorWorld();
        const region = ground.ensure(this, START_COL, START_ROW);

        if (!region) {
            return;
        }

        ground.placeImage(this, region, width / 2, height / 2, 1);

        while (!region.done && this.here()) {
            ground.step(region);
            await this.wait(110);
        }
    }

    private goToWorld (): void {
        if (this.leaving) {
            return;
        }

        this.leaving = true;
        stopSpeech();
        this.sound.stopByKey('exhale');
        this.tweens.killAll();

        this.cameras.main.fadeOut(800, 255, 255, 255);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('WorldScene', { fromIntro: true });
        });
    }

    private here (): boolean {
        return this.sys.isActive() && !this.leaving;
    }

    private playExhale (): void {
        const start = (): void => {
            if (!this.here() || this.sound.isPlaying('exhale')) {
                return;
            }

            this.sound.play('exhale', {
                volume: 0.7,
                rate: 0.2,
                loop: false,
                detune:370
            });
        };

        if (this.sound.locked) {
            this.sound.once('unlocked', start);
            this.sound.unlock();
            return;
        }

        start();
    }

    private wait (ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.time.delayedCall(ms, () => resolve());
        });
    }

    private fade (target: GameObjects.Text, alpha: number, duration: number): Promise<void> {
        return this.tween({ targets: target, alpha, duration, ease: 'Sine.easeInOut' });
    }

    private tween (config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
        return new Promise((resolve) => {
            this.tweens.add({
                ...config,
                onComplete: () => resolve()
            });
        });
    }

    private speak (text: string): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const done = (): void => {
                if (settled) {
                    return;
                }

                settled = true;
                resolve();
            };

            speakCue(text, done);
            this.time.delayedCall(Math.max(2200, text.length * 90), done);
        });
    }
}
