import { Math as PMath, Scene, GameObjects } from 'phaser';
import { showPlayAchievements, playGamesAvailable } from '../achievements/playGames';
import { clearSave } from '../save/gameSave';
import { chromePad } from '../ui/chromeInsets';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';
const DRAG_CLICK_SLOP = 28;
const HEADER_H = 64;
const FOOTER_H = 88;

const TRACKS = [
    {
        title: 'Wanderlust',
        artist: 'Justin Lee',
        url: 'https://uppbeat.io/t/justin-lee/wanderlust'
    },
    {
        title: 'Wonders of Nature',
        artist: 'Roger Gabalda',
        url: 'https://uppbeat.io/t/roger-gabalda/wonders-of-nature'
    },
    {
        title: 'Earth in Bloom',
        artist: 'Richard Bodgers',
        url: 'https://uppbeat.io/t/richard-bodgers/earth-in-bloom'
    }
];

export class SettingsScene extends Scene {
    private resetArmed = false;
    private resetArmedAt = 0;
    private scrollRoot!: GameObjects.Container;
    private scrollTop = 0;
    private scrollBottom = 0;
    private scrollMin = 0;
    private viewHeight = 0;
    private dragY = 0;
    private dragDistance = 0;
    private dragging = false;

    constructor () {
        super('SettingsScene');
    }

    create (): void {
        this.resetArmed = false;
        this.resetArmedAt = 0;
        this.cameras.main.setBackgroundColor(PAPER);

        const { width, height } = this.scale;
        const pad = chromePad();
        const cx = width / 2;
        const wrap = Math.min(720, width - 56);

        this.scrollTop = pad.top + HEADER_H;
        this.scrollBottom = height - pad.bottom - FOOTER_H;
        this.viewHeight = Math.max(72, this.scrollBottom - this.scrollTop);

        this.scrollRoot = this.add.container(cx, this.scrollTop).setDepth(1);
        const contentHeight = this.addCredits(wrap);

        if (playGamesAvailable()) {
            this.addAction(contentHeight + 8, 'Achievements', UMBER, '#5c4634', () => {
                void showPlayAchievements();
            });
        }

        const resetY = contentHeight + (playGamesAvailable() ? 64 : 8);
        const reset = this.addAction(resetY, 'Reset my progress', '#7a3d2e', '#5c2c20', () => {
            this.onReset(reset);
        });

        this.scrollMin = Math.min(0, this.viewHeight - (resetY + 56));

        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(0, this.scrollTop, width, this.viewHeight);
        this.scrollRoot.setMask(maskShape.createGeometryMask());

        this.add.rectangle(0, 0, width, this.scrollTop, PAPER, 1).setOrigin(0).setDepth(10);
        this.add.rectangle(0, this.scrollBottom, width, height - this.scrollBottom, PAPER, 1)
            .setOrigin(0)
            .setDepth(10);

        this.add.text(cx, pad.top + HEADER_H / 2, 'Settings', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '36px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5).setDepth(11);

        const back = this.add.text(cx, height - pad.bottom - FOOTER_H / 2, 'Back', {
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

    private addCredits (wrap: number): number {
        let y = 0;

        this.scrollRoot.add(this.add.text(0, y, 'Credits', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '24px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5, 0));
        y += 40;

        this.scrollRoot.add(this.add.text(0, y, 'Music from #Uppbeat (free for Creators!):', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '18px',
            color: MUTED,
            align: 'center',
            wordWrap: { width: wrap }
        }).setOrigin(0.5, 0));
        y += 48;

        for (const track of TRACKS) {
            this.addLink(y, `${track.title} — ${track.artist}`, track.url, '20px', wrap);
            y += 30;
            const url = this.addLink(y, track.url, track.url, '16px', wrap);
            y += url.height + 22;
        }

        return y;
    }

    private addAction (
        y: number,
        label: string,
        rest: string,
        hover: string,
        onPress: () => void
    ): GameObjects.Text {
        const button = this.add.text(0, y, label, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '20px',
            color: rest,
            backgroundColor: '#f3ead8',
            padding: { x: 18, y: 10 },
            align: 'center'
        }).setOrigin(0.5, 0);

        button.setInteractive({ useHandCursor: true });
        this.tintOnHover(button, rest, hover);
        button.on('pointerup', (pointer: { y: number }) => {
            if (this.dragDistance > DRAG_CLICK_SLOP || !this.inScrollBand(pointer.y)) {
                return;
            }

            onPress();
        });
        this.scrollRoot.add(button);
        return button;
    }

    private addLink (
        y: number,
        label: string,
        url: string,
        fontSize: string,
        wrap: number
    ): GameObjects.Text {
        const link = this.add.text(0, y, label, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize,
            color: LINK,
            align: 'center',
            wordWrap: { width: wrap }
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

        this.tintOnHover(link, LINK, LINK_HOVER);
        link.on('pointerup', (pointer: { y: number }) => {
            if (this.dragDistance > DRAG_CLICK_SLOP || !this.inScrollBand(pointer.y)) {
                return;
            }

            window.open(url, '_blank', 'noopener,noreferrer');
        });
        this.scrollRoot.add(link);
        return link;
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

    private onReset (button: GameObjects.Text): void {
        if (!this.resetArmed) {
            this.resetArmed = true;
            this.resetArmedAt = this.time.now;
            button.setText('Tap again to confirm');
            return;
        }

        if (this.time.now - this.resetArmedAt < 300) {
            return;
        }

        clearSave();
        this.scene.stop('WorldScene');
        this.scene.start('WorldScene');
    }

    private close (): void {
        this.scene.stop();
        this.scene.resume('WorldScene');
    }
}
