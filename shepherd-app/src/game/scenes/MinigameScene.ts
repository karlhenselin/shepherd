import { Scene, Scenes } from 'phaser';
import { pickMinigameVerse, type MinigamePassage } from '../data/minigameVerses';
import { playLionRoar } from '../audio/lionRoar';
import { isSoundOn } from '../audio/soundPref';
import { startWorldMusic } from '../audio/worldMusic';
import { createOnScreenKeyboard, type OnScreenKeyboard } from '../minigame/onScreenKeyboard';
import { playMinigameKey, playMinigameWordDone } from '../minigame/minigameSfx';
import { adaptMinigameSpeed } from '../minigame/scrollSpeed';
import { createVerseScroller, type VerseScroller } from '../minigame/verseScroller';
import { createWordEatLion, type WordEatLion } from '../minigame/wordEatLion';
import { chromePad } from '../ui/chromeInsets';
import { UMBER } from '../ui/paperScroll';
import { scriptureLine } from '../data/scripture';
import { speakCue, stopSpeech } from '../ui/speech';
import { markMinigameTried } from '../save/gameSave';

const PAPER = 0xf3ead8;
const MUTED = '#6b5344';

export type MinigameSceneData = {
    /** Single passage (legacy); prefer `queue` from Treasures. */
    passage?: MinigamePassage;
    /** Practice queue: chosen×3 then unlocked verses in order. */
    queue?: MinigamePassage[];
    returnTo?: 'TreasureScene' | 'WorldScene';
};

export class MinigameScene extends Scene {
    private returnTo: 'TreasureScene' | 'WorldScene' = 'WorldScene';
    /** Treasure practice list; null = HUD random pool. */
    private queue: MinigamePassage[] | null = null;
    private queueIndex = 0;
    private currentPassage!: MinigamePassage;
    private scroller: VerseScroller | null = null;
    private keyboard: OnScreenKeyboard | null = null;
    private lion: WordEatLion | null = null;
    private refText: Phaser.GameObjects.Text | null = null;
    private statusText: Phaser.GameObjects.Text | null = null;
    private statsText: Phaser.GameObjects.Text | null = null;
    private closing = false;
    private verseDone = false;

    private correctKeys = 0;
    private wrongKeys = 0;
    private typingStartedAt = 0;
    /** When set, WPM clock is frozen (between passages). */
    private wpmPausedAt = 0;

    constructor () {
        super('MinigameScene');
    }

    create (data?: MinigameSceneData): void {
        this.closing = false;
        this.returnTo = data?.returnTo ?? 'WorldScene';
        this.queue = null;
        this.queueIndex = 0;
        this.correctKeys = 0;
        this.wrongKeys = 0;
        this.typingStartedAt = 0;
        this.wpmPausedAt = 0;

        this.sound.mute = !isSoundOn();
        markMinigameTried();
        // Same BGM as the world (resume mid-track if it was stopped for Treasures).
        // Defer one tick so status is RUNNING even if a caller checks isActive().
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

        this.statusText = this.add.text(width / 2, pad.top + 64, 'Type the passage', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '16px',
            color: MUTED,
            align: 'center'
        }).setOrigin(0.5).setDepth(5);

        this.statsText = this.add.text(width - pad.right - 52, pad.top + 8, '— WPM    —%', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '16px',
            color: MUTED,
            align: 'right'
        }).setOrigin(1, 0).setDepth(40);

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

        this.lion = createWordEatLion(this);
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
        this.scroller?.update(delta);
        this.lion?.update(delta);
        this.refreshStats();

        if (
            this.scroller?.isFinished()
            && !this.closing
            && !this.verseDone
        ) {
            this.onVerseComplete();
        }
    }

    private startVerse (passage: MinigamePassage): void {
        this.teardownPlay(false);
        this.verseDone = false;
        this.currentPassage = passage;
        this.refText?.setText(passage.ref);
        this.statusText?.setText('Type the passage');

        const pad = chromePad();
        const { width, height } = this.scale;
        const centerY = height * 0.36;
        const maxWidth = width * 0.7;
        const keyboardBottom = pad.bottom + 12;

        this.scroller = createVerseScroller(this, passage, centerY, maxWidth);
        this.keyboard = createOnScreenKeyboard(this, (ch) => this.handleLetter(ch), keyboardBottom);
        this.lion = this.lion ?? createWordEatLion(this);
        this.lion.bind(this.scroller.getLineTargets());
        speakCue(scriptureLine(passage));
    }

    private handleLetter (ch: string): void {
        if (!this.scroller || this.closing) {
            return;
        }

        const result = this.scroller.onLetter(ch);
        if (result === 'noop') {
            return;
        }

        if (result === 'wrong') {
            this.noteKey(false);
            return;
        }

        if (result === 'skip-progress' || result === 'skip-complete') {
            // One miss for the skipped letter, one hit for the key they meant.
            this.noteKey(false);
            this.noteKey(true);
            playMinigameKey(this);
            if (result === 'skip-progress') {
                return;
            }
        }
        else {
            this.noteKey(true);
            playMinigameKey(this);
            if (result === 'progress') {
                return;
            }
        }

        playMinigameWordDone(this);

        const claimed = this.scroller.takeMeal();
        if (this.scroller.isTypingDone()) {
            this.pauseWpmClock();
            this.refreshStats();
        }

        if (!claimed) {
            return;
        }
        // Line lions pick up claimed words in order (L→R per line).
    }

    private noteKey (correct: boolean): void {
        if (this.typingStartedAt === 0) {
            this.typingStartedAt = this.time.now;
        }

        this.resumeWpmClock();

        if (correct) {
            this.correctKeys += 1;
        }
        else {
            this.wrongKeys += 1;
        }

        this.refreshStats();
    }

    private pauseWpmClock (): void {
        if (this.typingStartedAt === 0 || this.wpmPausedAt !== 0) {
            return;
        }

        this.wpmPausedAt = this.time.now;
    }

    private resumeWpmClock (): void {
        if (this.wpmPausedAt === 0) {
            return;
        }

        // Shift the start forward so the pause does not count against WPM.
        this.typingStartedAt += this.time.now - this.wpmPausedAt;
        this.wpmPausedAt = 0;
    }

    private refreshStats (): void {
        if (!this.statsText) {
            return;
        }

        const total = this.correctKeys + this.wrongKeys;
        if (total === 0 || this.typingStartedAt === 0) {
            this.statsText.setText('— WPM    —%');
            return;
        }

        const now = this.wpmPausedAt || this.time.now;
        const minutes = Math.max((now - this.typingStartedAt) / 60000, 1 / 60);
        // Standard: five characters ≈ one word.
        const wpm = Math.round((this.correctKeys / 5) / minutes);
        const accuracy = Math.round((this.correctKeys / total) * 100);
        this.statsText.setText(`${wpm} WPM    ${accuracy}%`);
    }

    private onVerseComplete (): void {
        if (this.closing || this.verseDone) {
            return;
        }

        this.verseDone = true;
        this.pauseWpmClock();
        this.refreshStats();
        this.statusText?.setText('Well done!');

        if (this.scroller) {
            adaptMinigameSpeed(this.scroller.getPacing());
        }

        const next = this.nextPassage();
        this.lion?.gallopOff();

        playLionRoar(this, 0.85, () => {
            if (this.closing) {
                return;
            }

            this.lion?.destroy();
            this.lion = null;

            if (!next) {
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

    private teardownPlay (destroyLion = true): void {
        this.scroller?.destroy();
        this.scroller = null;
        this.keyboard?.destroy();
        this.keyboard = null;
        if (destroyLion) {
            this.lion?.destroy();
            this.lion = null;
        }
    }

    private close (): void {
        this.closing = true;
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
