import { JOHN_10, JOHN_14_6, PSALM_23 } from './scripture';

export type MinigamePassage = {
    ref: string;
    text: string;
};

/** Short curated lines for HUD random play. */
export const MINIGAME_VERSE_POOL: MinigamePassage[] = [
    { ref: PSALM_23[1].a.ref, text: PSALM_23[1].a.text },
    { ref: PSALM_23[1].b.ref, text: PSALM_23[1].b.text },
    { ref: PSALM_23[2].a.ref, text: PSALM_23[2].a.text },
    { ref: PSALM_23[2].b.ref, text: PSALM_23[2].b.text },
    { ref: PSALM_23[3].a.ref, text: PSALM_23[3].a.text },
    { ref: PSALM_23[4].b.ref, text: PSALM_23[4].b.text },
    { ref: PSALM_23[4].c.ref, text: PSALM_23[4].c.text },
    { ref: JOHN_10[9].ref, text: JOHN_10[9].text },
    { ref: JOHN_14_6.ref, text: JOHN_14_6.text },
    // Use the recorded picnic line (not 5a alone — no voice clip for that half).
    { ref: PSALM_23[5].table.ref, text: PSALM_23[5].table.text }
];

export function pickMinigameVerse (excludeRef?: string): MinigamePassage {
    const pool = excludeRef
        ? MINIGAME_VERSE_POOL.filter((p) => p.ref !== excludeRef)
        : MINIGAME_VERSE_POOL;
    const list = pool.length > 0 ? pool : MINIGAME_VERSE_POOL;
    const index = Math.floor(Math.random() * list.length);
    return { ...list[index] };
}

const PRACTICE_REPEATS = 3;

function samePassage (a: MinigamePassage, b: MinigamePassage): boolean {
    return a.ref === b.ref && a.text === b.text;
}

/**
 * Treasures ABC: chosen verse × 3, then the rest of the unlocked list in order.
 */
export function buildTreasurePracticeQueue (
    chosen: MinigamePassage,
    unlockedInOrder: MinigamePassage[]
): MinigamePassage[] {
    const startIdx = unlockedInOrder.findIndex((p) => samePassage(p, chosen));
    const anchor = startIdx >= 0 ? unlockedInOrder[startIdx] : chosen;
    const queue: MinigamePassage[] = [];

    for (let i = 0; i < PRACTICE_REPEATS; i++) {
        queue.push({ ...anchor });
    }

    if (startIdx >= 0) {
        for (let i = startIdx + 1; i < unlockedInOrder.length; i++) {
            queue.push({ ...unlockedInOrder[i] });
        }
    }

    return queue;
}
