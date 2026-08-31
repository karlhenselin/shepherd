import { Math as PMath, Scene, GameObjects } from 'phaser';
import { CHEAT_SPOTS, CheatSpot } from '../save/cheatSaves';
import { clearSave, writeSave } from '../save/gameSave';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';
const ROW = 28;
const DRAG_CLICK_SLOP = 8;

export class CheatScene extends Scene {
    private dragY = 0;
    private dragDistance = 0;
    private dragging = false;
    private scrollMax = 0;

    constructor () {
        super('CheatScene');
    }

    create (): void {
        this.cameras.main.setBackgroundColor(PAPER);

        const { width, height } = this.scale;
        const cx = width / 2;

        this.add.text(cx, 40, 'Cheat', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '36px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(cx, 78, 'Jump to a save point. Temporary.', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '16px',
            color: MUTED,
            align: 'center'
        }).setOrigin(0.5);

        CHEAT_SPOTS.forEach((spot, index) => {
            const y = 112 + index * ROW;
            const button = this.add.text(cx, y, spot.label, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '20px',
                color: LINK,
                align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            this.tintOnHover(button, LINK, LINK_HOVER);
            button.on('pointerup', () => {
                if (this.dragDistance < DRAG_CLICK_SLOP) {
                    this.jumpTo(spot);
                }
            });
        });

        const lastY = 112 + (CHEAT_SPOTS.length - 1) * ROW;
        const backY = Math.max(height - 36, lastY + 48);
        const back = this.add.text(cx, backY, 'Back', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '22px',
            color: UMBER,
            backgroundColor: '#f3ead8',
            padding: { x: 22, y: 8 },
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.tintOnHover(back, UMBER, '#5c4634');
        back.on('pointerup', () => {
            if (this.dragDistance < DRAG_CLICK_SLOP) {
                this.close();
            }
        });

        const contentH = backY + 40;
        this.scrollMax = Math.max(0, contentH - height);

        if (this.scrollMax > 0) {
            this.cameras.main.setBounds(0, 0, width, contentH);
            this.input.on('wheel', (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
                this.nudgeScroll(dy * 0.45);
            });
            this.input.on('pointerdown', (pointer: { y: number }) => {
                this.dragging = true;
                this.dragDistance = 0;
                this.dragY = pointer.y;
            });
            this.input.on('pointermove', (pointer: { y: number; isDown: boolean }) => {
                if (!this.dragging || !pointer.isDown) {
                    return;
                }

                const delta = pointer.y - this.dragY;
                this.dragDistance += Math.abs(delta);
                this.dragY = pointer.y;
                this.nudgeScroll(-delta);
            });
            this.input.on('pointerup', () => {
                this.dragging = false;
            });
        }

        this.input.keyboard?.on('keydown-ESC', () => this.close());
    }

    private nudgeScroll (delta: number): void {
        this.cameras.main.scrollY = PMath.Clamp(
            this.cameras.main.scrollY + delta,
            0,
            this.scrollMax
        );
    }

    private tintOnHover (text: GameObjects.Text, rest: string, hover: string): void {
        text.on('pointerover', () => text.setColor(hover));
        text.on('pointerout', () => text.setColor(rest));
    }

    private jumpTo (spot: CheatSpot): void {
        if (spot.save) {
            writeSave(spot.save);
        }
        else {
            clearSave();
        }

        this.scene.stop('WorldScene');
        this.scene.start('WorldScene');
    }

    private close (): void {
        this.scene.stop();
        this.scene.resume('WorldScene');
    }
}
