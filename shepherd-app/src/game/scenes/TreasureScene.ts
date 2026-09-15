import { GameObjects, Scene, Scenes } from 'phaser';
import { foundBibleGems, scriptureLine, unlockedStoryPassages } from '../data/scripture';
import { foundTreeVerses } from '../data/treeVerses';
import { foundWaterVerses } from '../data/waterVerses';
import { foundThornVerses } from '../data/thornVerses';
import { buildTreasurePracticeQueue, type MinigamePassage } from '../data/minigameVerses';
import { loadSave } from '../save/gameSave';
import { createPaperScroll, DRAG_CLICK_SLOP, type PaperScroll } from '../ui/paperScroll';
import {
    ABC_KEYBOARD_KEY,
    ABC_KEYBOARD_LIST_SIZE,
    ensureAbcKeyboardIcon
} from '../ui/abcKeyboardIcon';
import { speakCue, stopSpeech } from '../ui/speech';

const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const LINE = '#4a3728';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';

export class TreasureScene extends Scene {
    private scroll!: PaperScroll;
    private unlockedPassages: MinigamePassage[] = [];

    constructor () {
        super('TreasureScene');
    }

    create (data?: {
        foundGems?: string[];
        foundWaterVerses?: string[];
        foundTreeVerses?: string[];
        foundThornVerses?: string[];
        heard?: Parameters<typeof unlockedStoryPassages>[0];
    }): void {
        ensureAbcKeyboardIcon(this);

        const save = loadSave();
        const foundIds = data?.foundGems ?? save?.foundGems ?? [];
        const waterIds = data?.foundWaterVerses ?? save?.foundWaterVerses ?? [];
        const treeIds = data?.foundTreeVerses ?? save?.foundTreeVerses ?? [];
        const thornIds = data?.foundThornVerses ?? save?.foundThornVerses ?? [];
        const heard = data?.heard ?? {
            heardPsalm1: save?.heardPsalm1,
            heardPsalm2: save?.heardPsalm2,
            heardPsalm2b: save?.heardPsalm2b,
            heardPsalm3: save?.heardPsalm3,
            heardPsalm3b: save?.heardPsalm3b,
            heardPsalm4a: save?.heardPsalm4a,
            heardPsalm4b: save?.heardPsalm4b,
            heardPsalm4c: save?.heardPsalm4c,
            heardPsalm5: save?.heardPsalm5,
            heardPsalm6: save?.heardPsalm6,
            heardJohn102: save?.heardJohn102,
            heardJohn109: save?.heardJohn109,
            heardJohn1011: save?.heardJohn1011,
            heardCorinthians: save?.heardCorinthians,
            heardCity: save?.heardCity,
            heardIsaiah6525: save?.heardIsaiah6525,
            foundNames: save?.foundNames
        };

        const gems = foundBibleGems(foundIds);
        const water = foundWaterVerses(waterIds);
        const trees = foundTreeVerses(treeIds);
        const thorns = foundThornVerses(thornIds);
        const story = unlockedStoryPassages(heard);
        this.unlockedPassages = [...gems, ...water, ...trees, ...thorns, ...story];

        this.scroll = createPaperScroll(this, {
            title: 'Bible Treasures',
            titleSize: '40px',
            headerH: 88,
            onBack: () => this.close()
        });

        const wrap = Math.min(
            720,
            this.scroll.width - this.scroll.pad.left - this.scroll.pad.right - this.scroll.scrollGutter - 24
        );

        let y = 0;
        y = this.addSection(y, 'Bible gems', gems, wrap, true);
        y = this.addSection(y, 'Water and thirst', water, wrap, true);
        y = this.addSection(y, 'Shade of the trees', trees, wrap, true);
        y = this.addSection(y, 'Thorns', thorns, wrap, true);
        y = this.addSection(y, 'Along the way', story, wrap, true);
        this.scroll.finish(y);

        this.events.once(Scenes.Events.SHUTDOWN, () => stopSpeech());
    }

    private addSection (
        startY: number,
        title: string,
        passages: { ref: string; text: string }[],
        wrap: number,
        speakable: boolean
    ): number {
        let y = startY;

        this.scroll.root.add(this.add.text(0, y, title, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '26px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5, 0));
        y += 42;

        if (passages.length === 0) {
            this.scroll.root.add(this.add.text(0, y, 'None yet — keep exploring.', {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '18px',
                color: MUTED,
                align: 'center',
                wordWrap: { width: wrap }
            }).setOrigin(0.5, 0));
            return y + 56;
        }

        for (const passage of passages) {
            const refColor = speakable ? LINK : UMBER;
            const bodyColor = speakable ? LINK : LINE;
            const line = scriptureLine(passage);

            const ref = this.add.text(0, y, passage.ref, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '18px',
                color: refColor,
                align: 'center'
            }).setOrigin(0.5, 0);
            this.scroll.root.add(ref);

            const abc = this.add.image(
                ref.displayWidth / 2 + 18,
                y + ref.height / 2,
                ABC_KEYBOARD_KEY
            )
                .setDisplaySize(ABC_KEYBOARD_LIST_SIZE, ABC_KEYBOARD_LIST_SIZE)
                .setOrigin(0, 0.5);
            this.scroll.root.add(abc);
            this.makeAbcButton(abc, passage);

            y += 26;

            const body = this.add.text(0, y, passage.text, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '17px',
                color: bodyColor,
                align: 'center',
                wordWrap: { width: wrap }
            }).setOrigin(0.5, 0);
            this.scroll.root.add(body);
            y += body.height + 22;

            if (speakable) {
                this.makeSpeakable(ref, body, line);
            }
        }

        return y + 18;
    }

    private makeAbcButton (abc: GameObjects.Image, passage: { ref: string; text: string }): void {
        abc.setInteractive({ useHandCursor: true });
        abc.on('pointerover', () => abc.setTint(0xc4a882));
        abc.on('pointerout', () => abc.clearTint());
        abc.on('pointerup', (pointer: { y: number }) => {
            if (this.scroll.dragDistance > DRAG_CLICK_SLOP || !this.scroll.inBand(pointer.y)) {
                return;
            }

            this.openMinigame(passage);
        });
    }

    private openMinigame (passage: { ref: string; text: string }): void {
        stopSpeech();
        const queue = buildTreasurePracticeQueue(passage, this.unlockedPassages);
        this.scene.launch('MinigameScene', {
            queue,
            returnTo: 'TreasureScene'
        });
        this.scene.stop();
    }

    private makeSpeakable (ref: GameObjects.Text, body: GameObjects.Text, line: string): void {
        for (const text of [ref, body]) {
            text.setInteractive({ useHandCursor: true });
            text.on('pointerover', () => {
                ref.setColor(LINK_HOVER);
                body.setColor(LINK_HOVER);
            });
            text.on('pointerout', () => {
                ref.setColor(LINK);
                body.setColor(LINK);
            });
            text.on('pointerup', (pointer: { y: number }) => {
                if (this.scroll.dragDistance > DRAG_CLICK_SLOP || !this.scroll.inBand(pointer.y)) {
                    return;
                }

                speakCue(line);
            });
        }
    }

    private close (): void {
        stopSpeech();
        this.scene.stop();
        this.scene.resume('WorldScene');
    }
}
