import { Scene } from 'phaser';
import { ACHIEVEMENTS, earnedAchievements } from '../achievements/catalog';
import { loadSave } from '../save/gameSave';
import { createPaperScroll, type PaperScroll } from '../ui/paperScroll';

const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const ROW = 32;

export class AchievementsScene extends Scene {
    private scroll!: PaperScroll;

    constructor () {
        super('AchievementsScene');
    }

    create (): void {
        const save = loadSave();
        const earned = new Set(save ? earnedAchievements(save) : []);

        this.scroll = createPaperScroll(this, {
            title: 'Achievements',
            onBack: () => this.close()
        });

        ACHIEVEMENTS.forEach((item, index) => {
            const got = earned.has(item.id);
            const y = index * ROW + ROW / 2;
            const line = this.add.text(0, y, got ? item.title : `—  ${item.title}`, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '20px',
                color: got ? UMBER : MUTED,
                align: 'center'
            }).setOrigin(0.5).setAlpha(got ? 1 : 0.55);

            this.scroll.root.add(line);
        });

        this.scroll.finish(ACHIEVEMENTS.length * ROW);
    }

    private close (): void {
        this.scene.stop();
        this.scene.resume('WorldScene');
    }
}
