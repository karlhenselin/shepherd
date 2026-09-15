import { GameObjects, Scene } from 'phaser';
import type { MinigamePassage } from '../data/minigameVerses';
import type { PassagePacing } from './scrollSpeed';

const UMBER = '#3d2c1e';
const TYPED = '#a89880';
const MISSED = '#b54a3c';
const FONT = 'Georgia, Palatino, serif';
const FONT_SIZE = '32px';
const WORD_GAP = 14;
const LINE_HEIGHT = 44;
const EARLY_MS = 1600;
const LATE_MS = 5000;

export type TokenizedWord = {
    display: string;
    match: string;
};

/** One word slot for a line-clearing lion. */
export type LineWordTarget = {
    line: number;
    indexOnLine: number;
    getPos: () => { x: number; y: number } | null;
    isReady: () => boolean;
    isGone: () => boolean;
    chomp: () => void;
};

type WordVisual = {
    token: TokenizedWord;
    letters: GameObjects.Text[];
    matchLetters: GameObjects.Text[];
    container: GameObjects.Container;
    typedCount: number;
    skipped: Set<number>;
    claimed: boolean;
    eaten: boolean;
    hitLate: boolean;
    activeAt: number;
    claimMs: number;
    line: number;
    indexOnLine: number;
};

export type LetterResult =
    | 'noop'
    | 'wrong'
    | 'progress'
    | 'complete'
    | 'skip-progress'
    | 'skip-complete';

export type VerseScroller = {
    update: (deltaMs: number) => void;
    onLetter: (char: string) => LetterResult;
    /** Mark the just-finished word claimed so its line lion can eat it. */
    takeMeal: () => boolean;
    getLineTargets: () => LineWordTarget[];
    isFinished: () => boolean;
    isTypingDone: () => boolean;
    getPacing: () => PassagePacing;
    destroy: () => void;
};

export function tokenizeVerse (text: string): TokenizedWord[] {
    return text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .map((display) => ({
            display,
            match: display.replace(/[^A-Za-z']/g, '').toLowerCase()
        }))
        .filter((t) => t.match.length > 0);
}

export function createVerseScroller (
    scene: Scene,
    passage: MinigamePassage,
    centerY: number,
    maxWidth: number
): VerseScroller {
    const tokens = tokenizeVerse(passage.text);
    const words: WordVisual[] = [];
    const root = scene.add.container(0, 0).setDepth(10);
    const { width } = scene.scale;
    const cx = width / 2;

    for (const token of tokens) {
        const letters: GameObjects.Text[] = [];
        const matchLetters: GameObjects.Text[] = [];
        const wordContainer = scene.add.container(0, 0);
        let letterX = 0;

        for (const ch of token.display) {
            const letter = scene.add.text(letterX, 0, ch, {
                fontFamily: FONT,
                fontSize: FONT_SIZE,
                color: UMBER
            }).setOrigin(0, 0.5);
            letter.setData('glyph', ch);
            letters.push(letter);
            if (/[A-Za-z']/.test(ch)) {
                matchLetters.push(letter);
            }
            wordContainer.add(letter);
            letterX += letter.width;
        }

        words.push({
            token,
            letters,
            matchLetters,
            container: wordContainer,
            typedCount: 0,
            skipped: new Set(),
            claimed: false,
            eaten: false,
            hitLate: false,
            activeAt: 0,
            claimMs: -1,
            line: 0,
            indexOnLine: 0
        });
        root.add(wordContainer);
    }

    layoutWrapped(words, maxWidth);
    const blockHeight = words.length > 0
        ? Math.max(...words.map((w) => w.container.y)) + LINE_HEIGHT * 0.5
        : 0;
    root.setPosition(cx, centerY - blockHeight / 2);

    let activeIndex = 0;
    let finished = false;
    let lastCompleted: WordVisual | null = null;
    markActiveStart();

    function wordWidth (word: WordVisual): number {
        let w = 0;
        for (const letter of word.letters) {
            w += letter.width;
        }
        return w;
    }

    function layoutWrapped (list: WordVisual[], wrapW: number): void {
        let lineX = 0;
        let lineY = 0;
        let lineStart = 0;
        let lineIndex = 0;
        let indexOnLine = 0;

        const centerLine = (from: number, to: number, lineWidth: number) => {
            const offset = -lineWidth / 2;
            for (let i = from; i < to; i++) {
                list[i].container.x += offset;
            }
        };

        for (let i = 0; i < list.length; i++) {
            const word = list[i];
            const w = wordWidth(word);

            if (lineX > 0 && lineX + w > wrapW) {
                centerLine(lineStart, i, lineX - WORD_GAP);
                lineX = 0;
                lineY += LINE_HEIGHT;
                lineStart = i;
                lineIndex += 1;
                indexOnLine = 0;
            }

            word.line = lineIndex;
            word.indexOnLine = indexOnLine;
            word.container.setPosition(lineX, lineY);
            lineX += w + WORD_GAP;
            indexOnLine += 1;
        }

        if (lineStart < list.length) {
            centerLine(lineStart, list.length, lineX > 0 ? lineX - WORD_GAP : 0);
        }
    }

    function activeWord (): WordVisual | null {
        while (
            activeIndex < words.length
            && (words[activeIndex].eaten || words[activeIndex].claimed)
        ) {
            activeIndex += 1;
        }
        if (activeIndex >= words.length) {
            return null;
        }
        return words[activeIndex];
    }

    function markActiveStart (): void {
        const word = activeWord();
        if (word && word.activeAt === 0) {
            word.activeAt = scene.time.now;
        }
    }

    function refreshLetterColors (word: WordVisual): void {
        let matchIdx = 0;
        for (const letter of word.letters) {
            const glyph = String(letter.getData('glyph') ?? letter.text);
            if (/[A-Za-z']/.test(glyph)) {
                letter.setText(glyph);
                if (word.skipped.has(matchIdx)) {
                    letter.setColor(MISSED);
                }
                else {
                    letter.setColor(matchIdx < word.typedCount ? TYPED : UMBER);
                }
                matchIdx += 1;
            }
            else {
                letter.setColor(
                    matchIdx > 0 && matchIdx <= word.typedCount ? TYPED : UMBER
                );
            }
        }
    }

    function applyCorrect (word: WordVisual): 'progress' | 'complete' {
        word.typedCount += 1;
        refreshLetterColors(word);

        if (word.typedCount >= word.token.match.length) {
            lastCompleted = word;
            return 'complete';
        }

        return 'progress';
    }

    function onLetter (char: string): LetterResult {
        if (finished) {
            return 'noop';
        }

        const word = activeWord();
        if (!word) {
            return 'noop';
        }

        if (word.activeAt === 0) {
            word.activeAt = scene.time.now;
        }

        const keyed = char.toLowerCase();
        const at = word.typedCount;
        const next = word.token.match[at];

        if (next && keyed === next) {
            return applyCorrect(word);
        }

        const after = word.token.match[at + 1];
        if (after && keyed === after) {
            word.skipped.add(at);
            word.typedCount = at + 1;
            refreshLetterColors(word);
            const result = applyCorrect(word);
            return result === 'complete' ? 'skip-complete' : 'skip-progress';
        }

        return 'wrong';
    }

    function allEaten (): boolean {
        return words.every((w) => w.eaten);
    }

    function worldPos (word: WordVisual): { x: number; y: number } | null {
        if (!word.container.active) {
            return null;
        }
        return {
            x: root.x + word.container.x + wordWidth(word) / 2,
            y: root.y + word.container.y
        };
    }

    function chompWord (word: WordVisual): void {
        if (word.eaten) {
            return;
        }

        const targets = word.letters;
        if (targets.length === 0) {
            word.eaten = true;
            word.container.destroy(true);
            if (allEaten()) {
                finished = true;
            }
            return;
        }

        let remaining = targets.length;
        for (const letter of targets) {
            scene.tweens.add({
                targets: letter,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 90,
                yoyo: true,
                onComplete: () => {
                    scene.tweens.add({
                        targets: letter,
                        scaleX: 0,
                        scaleY: 0,
                        alpha: 0,
                        duration: 110,
                        onComplete: () => {
                            remaining -= 1;
                            if (remaining <= 0) {
                                word.eaten = true;
                                word.container.destroy(true);
                                if (allEaten()) {
                                    finished = true;
                                }
                            }
                        }
                    });
                }
            });
        }
    }

    function update (_deltaMs: number): void {
        if (finished) {
            return;
        }

        if (allEaten()) {
            finished = true;
            return;
        }

        const word = activeWord();
        if (word && word.activeAt > 0 && scene.time.now - word.activeAt >= LATE_MS) {
            word.hitLate = true;
        }
    }

    function takeMeal (): boolean {
        const word = lastCompleted;
        lastCompleted = null;
        if (!word || word.claimed || word.eaten) {
            return false;
        }

        const elapsed = word.activeAt > 0 ? scene.time.now - word.activeAt : 0;
        word.claimMs = elapsed;
        if (elapsed >= LATE_MS) {
            word.hitLate = true;
        }

        word.claimed = true;
        markActiveStart();
        return true;
    }

    function getLineTargets (): LineWordTarget[] {
        return words.map((word) => ({
            line: word.line,
            indexOnLine: word.indexOnLine,
            getPos: () => (word.eaten ? null : worldPos(word)),
            isReady: () => word.claimed && !word.eaten,
            isGone: () => word.eaten,
            chomp: () => chompWord(word)
        }));
    }

    function isFinished (): boolean {
        return finished;
    }

    function isTypingDone (): boolean {
        return words.every((w) => w.claimed || w.eaten);
    }

    function getPacing (): PassagePacing {
        let earlyClaims = 0;
        let lateHits = 0;

        for (const word of words) {
            if (word.hitLate) {
                lateHits += 1;
            }
            else if (word.claimMs >= 0 && word.claimMs < EARLY_MS) {
                earlyClaims += 1;
            }
        }

        return {
            earlyClaims,
            lateHits,
            wordCount: words.length
        };
    }

    function destroy (): void {
        root.destroy(true);
    }

    return {
        update,
        onLetter,
        takeMeal,
        getLineTargets,
        isFinished,
        isTypingDone,
        getPacing,
        destroy
    };
}
