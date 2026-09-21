import { Scene, GameObjects } from 'phaser';
import { CHEAT_SPOTS, CheatSpot } from '../save/cheatSaves';
import { isSuperSpeed, toggleSuperSpeed } from '../save/cheatSpeed';
import { clearSave, writeSave } from '../save/gameSave';
import { applyCheatSave } from '../save/progression';
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
            onBack: () => this.close()
        });

        let y = ROW / 2;
        this.addToggleRow(y, () => isSuperSpeed() ? 'Superspeed: on' : 'Superspeed: off', () => {
            toggleSuperSpeed();
        });
        y += ROW;

        CHEAT_SPOTS.forEach((spot) => {
            this.addJumpRow(y, spot);
            y += ROW;
        });

        this.scroll.finish(ROW + CHEAT_SPOTS.length * ROW);
    }

    private addToggleRow (y: number, label: () => string, onToggle: () => void): void {
        const button = this.add.text(0, y, label(), {
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

            onToggle();
            button.setText(label());
        });
        this.scroll.root.add(button);
    }

    private addJumpRow (y: number, spot: CheatSpot): void {
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
    }

    private tintOnHover (text: GameObjects.Text, rest: string, hover: string): void {
        text.on('pointerover', () => text.setColor(hover));
        text.on('pointerout', () => text.setColor(rest));
    }

    private jumpTo (spot: CheatSpot): void {
        if (spot.save) {
            writeSave(applyCheatSave(spot.save));
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
