import { GameObjects, Math as PMath, Scene, Scenes } from 'phaser';
import { foundBibleGems, scriptureLine, unlockedStoryPassages } from '../data/scripture';
import { foundTreeVerses } from '../data/treeVerses';
import { foundWaterVerses } from '../data/waterVerses';
import { loadSave } from '../save/gameSave';
import { speakCue, stopSpeech } from '../ui/speech';

const PAPER = 0xf7f3ea;
const UMBER = '#3d2c1e';
const MUTED = '#6b5344';
const LINE = '#4a3728';
const LINK = '#2c4a5e';
const LINK_HOVER = '#1a3344';
const DRAG_CLICK_SLOP = 8;
const HEADER_H = 88;
const FOOTER_H = 100;

export class TreasureScene extends Scene {
    private scrollRoot!: GameObjects.Container;
    private scrollTop = 0;
    private scrollBottom = 0;
    private scrollMin = 0;
    private viewHeight = 0;
    private contentHeight = 0;
    private scrollTrack: GameObjects.Rectangle | null = null;
    private scrollThumb: GameObjects.Rectangle | null = null;
    private dragY = 0;
    private dragDistance = 0;
    private dragging = false;

    constructor () {
        super('TreasureScene');
    }

    create (data?: {
        foundGems?: string[];
        foundWaterVerses?: string[];
        foundTreeVerses?: string[];
        heard?: Parameters<typeof unlockedStoryPassages>[0];
    }): void {
        this.cameras.main.setBackgroundColor(PAPER);

        const save = loadSave();
        const foundIds = data?.foundGems ?? save?.foundGems ?? [];
        const waterIds = data?.foundWaterVerses ?? save?.foundWaterVerses ?? [];
        const treeIds = data?.foundTreeVerses ?? save?.foundTreeVerses ?? [];
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
            heardCorinthians: save?.heardCorinthians,
            heardCity: save?.heardCity,
            foundNames: save?.foundNames
        };

        const { width, height } = this.scale;
        const cx = width / 2;
        const wrap = Math.min(720, width - 80);

        this.scrollTop = HEADER_H;
        this.scrollBottom = height - FOOTER_H;
        this.viewHeight = this.scrollBottom - this.scrollTop;

        this.scrollRoot = this.add.container(cx, this.scrollTop).setDepth(1);
        let y = 0;

        y = this.addSection(y, 'Bible gems', foundBibleGems(foundIds), wrap, true);
        y = this.addSection(y, 'Water and thirst', foundWaterVerses(waterIds), wrap, true);
        y = this.addSection(y, 'Shade of the trees', foundTreeVerses(treeIds), wrap, true);
        y = this.addSection(y, 'Along the way', unlockedStoryPassages(heard), wrap, true);

        this.contentHeight = y;
        this.scrollMin = Math.min(0, this.viewHeight - this.contentHeight);

        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(0, this.scrollTop, width, this.viewHeight);
        this.scrollRoot.setMask(maskShape.createGeometryMask());

        this.addScrollbar(width);

        // Opaque chrome so list never shows through title / back
        this.add.rectangle(0, 0, width, HEADER_H, PAPER, 1).setOrigin(0).setDepth(10);
        this.add.rectangle(0, this.scrollBottom, width, FOOTER_H, PAPER, 1).setOrigin(0).setDepth(10);

        this.add.text(cx, HEADER_H / 2, 'Bible Treasures', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '40px',
            color: UMBER,
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

        back.on('pointerover', () => back.setColor('#5c4634'));
        back.on('pointerout', () => back.setColor(UMBER));
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
            this.nudgeScroll(delta);
            this.dragY = pointer.y;
        });

        this.input.on('pointerup', () => {
            this.dragging = false;
        });

        this.input.keyboard?.on('keydown-ESC', () => this.close());
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

        this.scrollRoot.add(this.add.text(0, y, title, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '26px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5, 0));
        y += 42;

        if (passages.length === 0) {
            this.scrollRoot.add(this.add.text(0, y, 'None yet — keep exploring.', {
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
            this.scrollRoot.add(ref);
            y += 26;

            const body = this.add.text(0, y, passage.text, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '17px',
                color: bodyColor,
                align: 'center',
                wordWrap: { width: wrap }
            }).setOrigin(0.5, 0);
            this.scrollRoot.add(body);
            y += body.height + 22;

            if (speakable) {
                this.makeSpeakable(ref, body, line);
            }
        }

        return y + 18;
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
                if (this.dragDistance > DRAG_CLICK_SLOP || !this.inScrollBand(pointer.y)) {
                    return;
                }

                speakCue(line);
            });
        }
    }

    private addScrollbar (width: number): void {
        if (this.scrollMin >= 0) {
            return;
        }

        const x = width - 18;
        const trackPad = 10;

        this.scrollTrack = this.add.rectangle(
            x,
            this.scrollTop + trackPad,
            6,
            this.viewHeight - trackPad * 2,
            0xd8cbb4,
            0.9
        ).setOrigin(0.5, 0).setDepth(9);

        const thumbH = Math.max(
            36,
            (this.viewHeight / this.contentHeight) * this.scrollTrack.height
        );

        this.scrollThumb = this.add.rectangle(
            x,
            this.scrollTrack.y,
            8,
            thumbH,
            0x6b5344,
            0.95
        ).setOrigin(0.5, 0).setDepth(9);

        this.updateScrollbar();
    }

    private updateScrollbar (): void {
        if (!this.scrollTrack || !this.scrollThumb || this.scrollMin >= 0) {
            return;
        }

        const travel = this.scrollTrack.height - this.scrollThumb.height;
        const progress = (this.scrollTop - this.scrollRoot.y) / -this.scrollMin;
        this.scrollThumb.setY(this.scrollTrack.y + travel * PMath.Clamp(progress, 0, 1));
    }

    private inScrollBand (y: number): boolean {
        return y >= this.scrollTop && y <= this.scrollBottom;
    }

    private nudgeScroll (delta: number): void {
        const next = PMath.Clamp(
            this.scrollRoot.y + delta,
            this.scrollTop + this.scrollMin,
            this.scrollTop
        );
        this.scrollRoot.setY(next);
        this.updateScrollbar();
    }

    private close (): void {
        stopSpeech();
        this.scene.stop();
        this.scene.resume('WorldScene');
    }
}
