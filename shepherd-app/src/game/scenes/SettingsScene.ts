import { Scene, GameObjects } from 'phaser';
import { showPlayAchievements, playGamesAvailable } from '../achievements/playGames';
import { clearSave } from '../save/gameSave';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
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

    constructor () {
        super('SettingsScene');
    }

    create (): void {
        this.resetArmed = false;
        this.resetArmedAt = 0;
        this.cameras.main.setBackgroundColor(PAPER);

        const { width, height } = this.scale;
        const cx = width / 2;

        this.add.text(cx, 64, 'Settings', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '42px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(cx, 128, 'Credits', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '24px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(cx, 172, 'Music from #Uppbeat (free for Creators!):', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '18px',
            color: MUTED,
            align: 'center'
        }).setOrigin(0.5);

        TRACKS.forEach((track, index) => {
            const y = 230 + index * 88;
            this.addLink(cx, y, `${track.title} — ${track.artist}`, track.url, '20px');
            this.addLink(cx, y + 28, track.url, track.url, '16px');
        });

        const footerY = height - 148;

        if (playGamesAvailable()) {
            const achievements = this.add.text(cx, footerY - 64, 'Achievements', {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '20px',
                color: UMBER,
                backgroundColor: '#f3ead8',
                padding: { x: 18, y: 10 },
                align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            this.tintOnHover(achievements, UMBER, '#5c4634');
            achievements.on('pointerdown', () => {
                void showPlayAchievements();
            });
        }

        const reset = this.add.text(cx, footerY, 'Reset my progress', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '20px',
            color: '#7a3d2e',
            backgroundColor: '#f3ead8',
            padding: { x: 18, y: 10 },
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.tintOnHover(reset, '#7a3d2e', '#5c2c20');
        reset.on('pointerdown', () => this.onReset(reset));

        const back = this.add.text(cx, height - 72, 'Back', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '22px',
            color: UMBER,
            backgroundColor: '#f3ead8',
            padding: { x: 22, y: 10 },
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.tintOnHover(back, UMBER, '#5c4634');
        back.on('pointerdown', () => this.close());

        this.input.keyboard?.on('keydown-ESC', () => this.close());
    }

    private addLink (x: number, y: number, label: string, url: string, fontSize: string): GameObjects.Text {
        const link = this.add.text(x, y, label, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize,
            color: LINK,
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.tintOnHover(link, LINK, LINK_HOVER);
        link.on('pointerdown', () => {
            window.open(url, '_blank', 'noopener,noreferrer');
        });

        return link;
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
