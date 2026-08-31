import { Math as PMath, Scene, GameObjects } from 'phaser';
import { CHEAT_SPOTS, CheatSpot } from '../save/cheatSaves';
import { clearSave, writeSave } from '../save/gameSave';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';
const ROW = 48;
const HEADER_H = 96;
const FOOTER_H = 100;
/** Finger jitter on Android WebView is often > 8px. */
const DRAG_CLICK_SLOP = 28;

export class CheatScene extends Scene {
    private scrollRoot!: GameObjects.Container;
    private scrollTop = 0;
    private scrollBottom = 0;
    private scrollMin = 0;
    private viewHeight = 0;
    private contentHeight = 0;
    private dragY = 0;
    private dragDistance = 0;
    private dragging = false;

    constructor () {
        super('CheatScene');
    }

    create (): void {
        this.cameras.main.setBackgroundColor(PAPER);

        const { width, height } = this.scale;
        const cx = width / 2;

        this.scrollTop = HEADER_H;
        this.scrollBottom = height - FOOTER_H;
        this.viewHeight = this.scrollBottom - this.scrollTop;

        this.scrollRoot = this.add.container(cx, this.scrollTop).setDepth(1);

        CHEAT_SPOTS.forEach((spot, index) => {
            const y = index * ROW + ROW / 2;
            const button = this.add.text(0, y, spot.label, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '22px',
                color: LINK,
                align: 'center',
                padding: { x: 18, y: 10 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            button.setData('ui', true);
            this.tintOnHover(button, LINK, LINK_HOVER);
            button.on('pointerup', (pointer: { y: number }) => {
                if (this.dragDistance > DRAG_CLICK_SLOP || !this.inScrollBand(pointer.y)) {
                    return;
                }

                this.jumpTo(spot);
            });
            this.scrollRoot.add(button);
        });

        this.contentHeight = CHEAT_SPOTS.length * ROW;
        this.scrollMin = Math.min(0, this.viewHeight - this.contentHeight);

        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(0, this.scrollTop, width, this.viewHeight);
        this.scrollRoot.setMask(maskShape.createGeometryMask());

        this.add.rectangle(0, 0, width, HEADER_H, PAPER, 1).setOrigin(0).setDepth(10);
        this.add.rectangle(0, this.scrollBottom, width, FOOTER_H, PAPER, 1).setOrigin(0).setDepth(10);

        this.add.text(cx, 36, 'Cheat', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '36px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5).setDepth(11);

        this.add.text(cx, 72, 'Jump to a save point. Temporary.', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '16px',
            color: MUTED,
            align: 'center'
        }).setOrigin(0.5).setDepth(11);

        const back = this.add.text(cx, height - FOOTER_H / 2, 'Back', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '22px',
            color: UMBER,
            backgroundColor: '#f3ead8',
            padding: { x: 22, y: 10 },
            align: 'center'
        }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

        this.tintOnHover(back, UMBER, '#5c4634');
        back.on('pointerdown', () => this.close());

        this.input.on('wheel', (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
            this.nudgeScroll(-dy * 0.45);
        });

        this.input.on('pointerdown', (pointer: { y: number }) => {
            if (!this.inScrollBand(pointer.y)) {
                return;
            }

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

            if (this.dragDistance > DRAG_CLICK_SLOP) {
                this.nudgeScroll(delta);
            }
        });

        this.input.on('pointerup', () => {
            this.dragging = false;
        });

        this.input.keyboard?.on('keydown-ESC', () => this.close());
    }

    private inScrollBand (y: number): boolean {
        return y >= this.scrollTop && y <= this.scrollBottom;
    }

    private nudgeScroll (delta: number): void {
        this.scrollRoot.y = PMath.Clamp(
            this.scrollRoot.y + delta,
            this.scrollTop + this.scrollMin,
            this.scrollTop
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
