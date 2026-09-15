import { Scene } from 'phaser';
import { Lion } from '../entities/Lion';
import type { LineWordTarget } from './verseScroller';

const RUN_SPEED = 260;
const EXIT_SPEED = 320;
const ARRIVE = 16;
/** Stand this far left while waiting on an untyped word. */
const WAIT_LEFT = 110;
/** How close to the word before eating. */
const EAT_LEFT = 36;

export type WordEatLion = {
    bind: (targets: LineWordTarget[]) => void;
    update: (deltaMs: number) => void;
    /** Start every line lion galloping off to the right (no destroy yet). */
    gallopOff: () => void;
    activeCount: () => number;
    destroy: () => void;
};

type Phase = 'toWord' | 'wait' | 'holding' | 'exit' | 'done';

type LineCrew = {
    line: number;
    words: LineWordTarget[];
    cursor: number;
    lion: Lion | null;
    phase: Phase;
};

export function createWordEatLion (scene: Scene): WordEatLion {
    const crews: LineCrew[] = [];

    function bind (targets: LineWordTarget[]): void {
        destroy();
        const byLine = new Map<number, LineWordTarget[]>();

        for (const target of targets) {
            const list = byLine.get(target.line) ?? [];
            list.push(target);
            byLine.set(target.line, list);
        }

        const lines = [...byLine.keys()].sort((a, b) => a - b);
        for (const line of lines) {
            const words = (byLine.get(line) ?? []).sort((a, b) => a.indexOnLine - b.indexOnLine);
            crews.push({
                line,
                words,
                cursor: 0,
                lion: null,
                phase: 'toWord'
            });
        }
    }

    function spawnLeftOf (pos: { x: number; y: number }): Lion {
        const lion = new Lion(scene, pos.x - WAIT_LEFT, pos.y);
        lion.sprite.setFlipX(false);
        return lion;
    }

    function beginExit (crew: LineCrew): void {
        if (!crew.lion || crew.phase === 'exit' || crew.phase === 'done') {
            return;
        }

        crew.phase = 'exit';
        const lion = crew.lion;
        lion.sprite.setFlipX(false);
        // Keep running further right if the roar outlasts the first exit.
        const runOff = (x: number): void => {
            lion.walkTo(x, lion.sprite.y, EXIT_SPEED, () => {
                if (crew.phase === 'exit' && crew.lion === lion) {
                    runOff(x + 280);
                }
            });
        };
        runOff(scene.scale.width + 120);
    }

    function gallopOff (): void {
        for (const crew of crews) {
            if (crew.lion && crew.phase !== 'exit' && crew.phase !== 'done') {
                beginExit(crew);
            }
        }
    }

    function tickCrew (crew: LineCrew): void {
        if (crew.phase === 'done' || crew.phase === 'exit') {
            return;
        }

        while (crew.cursor < crew.words.length && crew.words[crew.cursor].isGone()) {
            crew.cursor += 1;
        }

        if (crew.cursor >= crew.words.length) {
            // Hold past the last word until the scene starts the celebration gallop.
            crew.phase = 'holding';
            return;
        }

        const target = crew.words[crew.cursor];
        const pos = target.getPos();
        const firstPos = crew.words[0]?.getPos() ?? pos;

        if (!crew.lion) {
            if (!firstPos) {
                return;
            }
            crew.lion = spawnLeftOf(firstPos);
            crew.phase = target.isReady() ? 'toWord' : 'wait';
        }

        const lion = crew.lion;
        if (!pos) {
            crew.cursor += 1;
            return;
        }

        const waitX = pos.x - WAIT_LEFT;
        const eatX = pos.x - EAT_LEFT;
        const aimY = pos.y;

        if (!target.isReady()) {
            crew.phase = 'wait';
            if (lion.sprite.x < waitX - ARRIVE) {
                lion.sprite.setFlipX(false);
                lion.walkTo(waitX, aimY, RUN_SPEED);
            }
            else {
                // Already beside/past the wait spot — stand still facing right.
                lion.walkTo(lion.sprite.x, aimY, RUN_SPEED);
                lion.sprite.setFlipX(false);
            }
            return;
        }

        // Ready — run in closer, then eat.
        crew.phase = 'toWord';
        if (lion.sprite.x >= eatX - ARRIVE) {
            target.chomp();
            crew.cursor += 1;
            crew.phase = 'toWord';
            lion.sprite.setFlipX(false);
            return;
        }

        lion.sprite.setFlipX(false);
        lion.walkTo(eatX, aimY, RUN_SPEED);
    }

    function update (deltaMs: number): void {
        for (const crew of crews) {
            tickCrew(crew);
            if (crew.lion && crew.phase !== 'exit') {
                // Keep facing right while clearing the line.
                crew.lion.sprite.setFlipX(false);
            }
            crew.lion?.update(deltaMs);
            if (crew.lion && crew.phase !== 'exit') {
                crew.lion.sprite.setFlipX(false);
            }
        }
    }

    function activeCount (): number {
        let n = 0;
        for (const crew of crews) {
            if (crew.phase === 'done') {
                continue;
            }
            if (crew.lion || crew.words.some((w) => w.isReady())) {
                n += 1;
            }
        }
        return n;
    }

    function destroy (): void {
        for (const crew of crews) {
            crew.lion?.destroy();
            crew.lion = null;
        }
        crews.length = 0;
    }

    return { bind, update, gallopOff, activeCount, destroy };
}
