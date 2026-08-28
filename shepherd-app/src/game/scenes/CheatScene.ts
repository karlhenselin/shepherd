import { Scene, GameObjects } from 'phaser';
import { CHEAT_SPOTS, CheatSpot } from '../save/cheatSaves';
import { clearSave, writeSave } from '../save/gameSave';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';

export class CheatScene extends Scene {
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
            const y = 112 + index * 28;
            const button = this.add.text(cx, y, spot.label, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '20px',
                color: LINK,
                align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            this.tintOnHover(button, LINK, LINK_HOVER);
            button.on('pointerdown', () => this.jumpTo(spot));
        });

        const back = this.add.text(cx, height - 36, 'Back', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '22px',
            color: UMBER,
            backgroundColor: '#f3ead8',
            padding: { x: 22, y: 8 },
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
