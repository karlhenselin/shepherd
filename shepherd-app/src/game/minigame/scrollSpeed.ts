/** Silent adaptive pacing for the typing minigame (no UI).
 *  Early/late are based on how quickly each word is finished.
 */

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

let speedScale = 1;

export function getMinigameSpeedScale (): number {
    return speedScale;
}

export type PassagePacing = {
    /** Words finished quickly after becoming active. */
    earlyClaims: number;
    /** Words that sat active a long time before finish. */
    lateHits: number;
    wordCount: number;
};

/**
 * After a passage: quick finishes → +5% next; slow finishes → −10% next.
 * Late wins if both show up in meaningful numbers.
 */
export function adaptMinigameSpeed (pacing: PassagePacing): void {
    if (pacing.wordCount <= 0) {
        return;
    }

    if (pacing.lateHits > 0 && pacing.lateHits >= pacing.earlyClaims) {
        speedScale = clamp(speedScale * 0.9);
        return;
    }

    if (pacing.earlyClaims > 0 && pacing.earlyClaims >= Math.ceil(pacing.wordCount * 0.5)) {
        speedScale = clamp(speedScale * 1.05);
    }
}

function clamp (n: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
}
