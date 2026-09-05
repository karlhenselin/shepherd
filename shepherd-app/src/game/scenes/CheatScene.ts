import { Scene, GameObjects } from 'phaser';
import { CHEAT_SPOTS, CheatSpot } from '../save/cheatSaves';
import { clearSave, writeSave } from '../save/gameSave';
import { createPaperScroll, DRAG_CLICK_SLOP, type PaperScroll } from '../ui/paperScroll';

const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';
const ROW = 48;

export class CheatScene extends Scene {
    private scroll!: PaperScroll;

    constructor () {
        super('CheatScene');
    }

    create (): void {
        this.scroll = createPaperScroll(this, {
            title: 'Cheat',
            subtitle: 'Jump to a save point. Temporary.',
            headerH: 96,
            footerH: 100,
            onBack: () => this.close()
        });

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
                if (this.scroll.dragDistance > DRAG_CLICK_SLOP || !this.scroll.inBand(pointer.y)) {
                    return;
                }

                this.jumpTo(spot);
            });
            this.scroll.root.add(button);
        });

        this.scroll.finish(CHEAT_SPOTS.length * ROW);
    }

    private tintOnHover (text: GameObjects.Text, rest: string, hover: string): void {
        text.on('pointerover', () => text.setColor(hover));
        text.on('pointerout', () => text.setColor(rest));
    }

    private jumpTo (spot: CheatSpot): void {
        if (spot.save) {
            writeSave({
                ...spot.save,
                achievementsDisabled: true,
                unlockedAchievements: []
            });
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
