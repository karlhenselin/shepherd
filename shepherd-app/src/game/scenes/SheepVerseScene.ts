import { Scene, Scenes } from 'phaser';
import { pickMinigameVerse, type MinigamePassage } from '../data/minigameVerses';
import { isSoundOn } from '../audio/soundPref';
import { startWorldMusic } from '../audio/worldMusic';
import { createSheepVersePlayfield, type SheepVersePlayfield } from '../minigame/sheepVersePlayfield';
import { chromePad } from '../ui/chromeInsets';
import { UMBER } from '../ui/paperScroll';
import { scriptureLine } from '../data/scripture';
import { speakCue, stopSpeech } from '../ui/speech';
import { markSheepMinigameTried } from '../save/gameSave';

const PAPER = 0xf3ead8;
const MUTED = '#6b5344';

export type SheepVerseSceneData = {
    passage?: MinigamePassage;
    queue?: MinigamePassage[];
    returnTo?: 'TreasureScene' | 'WorldScene';
};

export class SheepVerseScene extends Scene {
    private returnTo: 'TreasureScene' | 'WorldScene' = 'WorldScene';
    private queue: MinigamePassage[] | null = null;
    private queueIndex = 0;
    private currentPassage!: MinigamePassage;
    private playfield: SheepVersePlayfield | null = null;
    private refText: Phaser.GameObjects.Text | null = null;
    private verseText: Phaser.GameObjects.Text | null = null;
    private statusText: Phaser.GameObjects.Text | null = null;
    private closing = false;
    private verseDone = false;
    private speakGen = 0;

    constructor () {
        super('SheepVerseScene');
    }

    create (data?: SheepVerseSceneData): void {
        this.closing = false;
        this.returnTo = data?.returnTo ?? 'WorldScene';
        this.queue = null;
        this.queueIndex = 0;
        this.speakGen = 0;

        this.sound.mute = !isSoundOn();
        markSheepMinigameTried();
        this.time.delayedCall(0, () => {
            if (this.sys.isActive()) {
                startWorldMusic(this);
            }
        });
        startWorldMusic(this);

        if (data?.queue && data.queue.length > 0) {
            this.queue = data.queue.map((p) => ({ ...p }));
            this.currentPassage = { ...this.queue[0] };
        }
        else if (data?.passage) {
            this.queue = [{ ...data.passage }];
            this.currentPassage = { ...data.passage };
        }
        else {
            this.currentPassage = pickMinigameVerse();
        }

        this.cameras.main.setBackgroundColor(PAPER);
        const pad = chromePad();
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, PAPER, 1).setOrigin(0).setDepth(0);

        this.refText = this.add.text(width / 2, pad.top + 28, this.currentPassage.ref, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '28px',
            color: UMBER,
            align: 'center'
        }).setOrigin(0.5).setDepth(5);

        this.verseText = this.add.text(width / 2, pad.top + 64, '', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '20px',
            color: UMBER,
            align: 'center',
            wordWrap: { width: width * 0.78 }
        }).setOrigin(0.5, 0).setDepth(5);

        this.statusText = this.add.text(width / 2, pad.top + 108, 'Tap the sheep in order', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '16px',
            color: MUTED,
            align: 'center'
        }).setOrigin(0.5).setDepth(5);

        const close = this.add.text(width - pad.right, pad.top + 4, '×', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '32px',
            color: UMBER,
            backgroundColor: '#e8dcc8',
            padding: { x: 12, y: 2 },
            align: 'center'
        }).setOrigin(1, 0).setDepth(40).setInteractive({ useHandCursor: true });

        close.on('pointerover', () => close.setColor('#5c4634'));
        close.on('pointerout', () => close.setColor(UMBER));
        close.on('pointerdown', (
            _p: unknown,
            _x: number,
            _y: number,
            event: Phaser.Types.Input.EventData
        ) => {
            event.stopPropagation();
            this.close();
        });

        this.startVerse(this.currentPassage);

        const onEsc = () => this.close();
        this.input.keyboard?.on('keydown-ESC', onEsc);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off('keydown-ESC', onEsc);
            stopSpeech();
            this.teardownPlay();
        });
    }

    update (_time: number, delta: number): void {
        this.playfield?.update(delta);

        if (
            this.playfield?.isFinished()
            && !this.closing
            && !this.verseDone
        ) {
            this.onVerseComplete();
        }
    }

    private startVerse (passage: MinigamePassage): void {
        this.teardownPlay();
        this.verseDone = false;
        this.currentPassage = passage;
        this.refText?.setText(passage.ref);
        this.verseText?.setText('');
        this.statusText?.setText('Tap the sheep in order');
        this.layoutStatus();

        const pad = chromePad();
        const { width, height } = this.scale;
        const verseBottom = (this.verseText?.y ?? pad.top + 64)
            + (this.verseText?.height ?? 0)
            + 8;
        const statusY = Math.max(pad.top + 108, verseBottom);
        this.statusText?.setY(statusY);

        const playTop = statusY + 28;
        const playBottom = height - pad.bottom - 16;

        this.playfield = createSheepVersePlayfield(
            this,
            passage.text,
            {
                left: pad.left + 8,
                right: width - pad.right - 8,
                top: playTop,
                bottom: Math.max(playTop + 120, playBottom)
            },
            (display) => this.onWordClaimed(display),
            () => undefined
        );

        const gen = ++this.speakGen;
        speakCue(scriptureLine(passage), () => {
            if (this.closing || gen !== this.speakGen || this.verseDone) {
                return;
            }

            this.playfield?.beginSlowdown();
        });
    }

    private onWordClaimed (display: string): void {
        if (!this.verseText) {
            return;
        }

        const prev = this.verseText.text.trim();
        this.verseText.setText(prev.length > 0 ? `${prev} ${display}` : display);
        this.layoutStatus();
    }

    private layoutStatus (): void {
        if (!this.statusText || !this.verseText) {
            return;
        }

        const pad = chromePad();
        const verseBottom = this.verseText.y + this.verseText.height + 8;
        this.statusText.setY(Math.max(pad.top + 108, verseBottom));
    }

    private onVerseComplete (): void {
        if (this.closing || this.verseDone) {
            return;
        }

        this.verseDone = true;
        this.speakGen += 1;
        this.statusText?.setText('Well done!');

        const next = this.nextPassage();
        this.time.delayedCall(900, () => {
            if (this.closing || !next) {
                return;
            }

            this.startVerse(next);
        });
    }

    private nextPassage (): MinigamePassage | null {
        if (this.queue) {
            this.queueIndex += 1;
            if (this.queueIndex >= this.queue.length) {
                this.queueIndex = 0;
            }
            return this.queue[this.queueIndex];
        }

        return pickMinigameVerse(this.currentPassage.ref);
    }

    private teardownPlay (): void {
        this.playfield?.destroy();
        this.playfield = null;
    }

    private close (): void {
        this.closing = true;
        this.speakGen += 1;
        stopSpeech();
        this.teardownPlay();
        this.queue = null;
        this.queueIndex = 0;
        this.scene.stop();

        if (this.returnTo === 'TreasureScene') {
            this.scene.launch('TreasureScene');
            return;
        }

        this.scene.resume('WorldScene');
    }
}
