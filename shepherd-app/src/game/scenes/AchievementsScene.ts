import { GameObjects, Scene } from 'phaser';
import { ACHIEVEMENTS, earnedAchievements } from '../achievements/catalog';
import { showPlayAchievements, playGamesAvailable } from '../achievements/playGames';
import { loadSave } from '../save/gameSave';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
const MUTED = '#6b5344';

export class AchievementsScene extends Scene {
    constructor () {
        super('AchievementsScene');
    }

    create (): void {
        this.cameras.main.setBackgroundColor(PAPER);

        const { width, height } = this.scale;
        const cx = width / 2;
        const save = loadSave();
        const earned = new Set(save ? earnedAchievements(save) : []);

        this.add.text(cx, 48, 'Achievements', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '40px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5);

        ACHIEVEMENTS.forEach((item, index) => {
            const got = earned.has(item.id);
            this.add.text(cx, 108 + index * 28, got ? item.title : `—  ${item.title}`, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '20px',
                color: got ? UMBER : MUTED,
                align: 'center'
            }).setOrigin(0.5).setAlpha(got ? 1 : 0.55);
        });

        const footerY = height - 72;

        if (playGamesAvailable()) {
            const play = this.add.text(cx, footerY - 52, 'Play Games', {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '20px',
                color: UMBER,
                backgroundColor: '#f3ead8',
                padding: { x: 18, y: 8 },
                align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            this.tintOnHover(play, UMBER, '#5c4634');
            play.on('pointerdown', () => {
                void showPlayAchievements();
            });
        }

        const back = this.add.text(cx, footerY, 'Back', {
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

    private tintOnHover (text: GameObjects.Text, rest: string, hover: string): void {
        text.on('pointerover', () => text.setColor(hover));
        text.on('pointerout', () => text.setColor(rest));
    }

    private close (): void {
        this.scene.stop();
        this.scene.resume('WorldScene');
    }
}
