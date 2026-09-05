import { Scene, GameObjects } from 'phaser';
import { clearSave } from '../save/gameSave';
import { createPaperScroll, DRAG_CLICK_SLOP, UMBER, type PaperScroll } from '../ui/paperScroll';

const MUTED = '#6b5344';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';

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
    private scroll!: PaperScroll;

    constructor () {
        super('SettingsScene');
    }

    create (): void {
        this.resetArmed = false;
        this.resetArmedAt = 0;

        this.scroll = createPaperScroll(this, {
            title: 'Settings',
            headerH: 64,
            footerH: 88,
            onBack: () => this.close()
        });

        const wrap = Math.min(
            720,
            this.scroll.width - this.scroll.pad.left - this.scroll.pad.right - this.scroll.scrollGutter - 24
        );
        const contentHeight = this.addCredits(wrap);

        this.addAction(contentHeight + 8, 'Achievements', UMBER, '#5c4634', () => {
            this.openAchievements();
        });

        const resetY = contentHeight + 64;
        const reset = this.addAction(resetY, 'Reset my progress', '#7a3d2e', '#5c2c20', () => {
            this.onReset(reset);
        });

        this.scroll.finish(resetY + 56);
    }

    private addCredits (wrap: number): number {
        let y = 0;

        this.scroll.root.add(this.add.text(0, y, 'Credits', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '24px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5, 0));
        y += 40;

        this.scroll.root.add(this.add.text(0, y, 'Music from #Uppbeat (free for Creators!):', {
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
            if (this.scroll.dragDistance > DRAG_CLICK_SLOP || !this.scroll.inBand(pointer.y)) {
                return;
            }

            onPress();
        });
        this.scroll.root.add(button);
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
            if (this.scroll.dragDistance > DRAG_CLICK_SLOP || !this.scroll.inBand(pointer.y)) {
                return;
            }

            window.open(url, '_blank', 'noopener,noreferrer');
        });
        this.scroll.root.add(link);
        return link;
    }

    private tintOnHover (text: GameObjects.Text, rest: string, hover: string): void {
        text.on('pointerover', () => text.setColor(hover));
        text.on('pointerout', () => text.setColor(rest));
    }

    private openAchievements (): void {
        this.scene.stop();
        this.scene.launch('AchievementsScene');
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
