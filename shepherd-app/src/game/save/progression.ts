import type { GameSave } from './gameSave';

/** Original four sheep in find order. Leo/Sarah do not advance foundCount. */
export const FLOCK_NAMES = ['Clover', 'Snowball', 'Milo', 'Biscuit'] as const;

export type FlockName = (typeof FLOCK_NAMES)[number];

export const PEACEABLE_JOINERS = ['Leo', 'Sarah'] as const;

export type PeaceableName = (typeof PEACEABLE_JOINERS)[number];

export function isFlockName (name: string): name is FlockName {
    return (FLOCK_NAMES as readonly string[]).includes(name);
}

/** Next flock sheep that may spawn for this foundCount, or undefined when flock is complete. */
export function expectedNextFlockName (foundCount: number): FlockName | undefined {
    return FLOCK_NAMES[foundCount];
}

/**
 * Spawn gate for story finds: only one active flock find, and only the next name
 * in order. Peaceable joiners (Leo/Sarah) skip the order gate.
 */
export function canSpawnFlockName (opts: {
    name: string;
    foundCount: number;
    hasActiveFlockFind: boolean;
}): boolean {
    if (!isFlockName(opts.name)) {
        return true;
    }

    if (opts.hasActiveFlockFind) {
        return false;
    }

    const expected = expectedNextFlockName(opts.foundCount);

    if (expected && opts.name !== expected) {
        return false;
    }

    return true;
}

/** Biscuit traps in the hole until Psalm 23:3a (restore soul). */
export function shouldTrapInHole (name: string, heardPsalm3: boolean): boolean {
    return name === 'Biscuit' && !heardPsalm3;
}

/** RestoreSave normalizes quiet-waters flag from older saves. */
export function normalizeHeardPsalm2b (save: Pick<GameSave, 'heardPsalm2b' | 'heardPsalm3'>): boolean {
    return save.heardPsalm2b === true || save.heardPsalm3;
}

/** Snowball after pastures, or Milo after quiet waters — spawn repair when queue remains. */
export function shouldHaveLostSheep (save: Pick<GameSave, 'heardPsalm2' | 'heardPsalm2b' | 'heardPsalm3' | 'foundCount' | 'nextNames'>): boolean {
    const heardPsalm2b = normalizeHeardPsalm2b(save);

    return (save.heardPsalm2 && save.foundCount < 2)
        || (heardPsalm2b && save.foundCount < 3 && save.nextNames.length > 0);
}

/**
 * After Milo is found, Biscuit should be awaiting rescue in the hole
 * (still listed in nextNames, not yet waitingName).
 */
export function shouldAwaitHoleSheep (save: Pick<GameSave, 'heardPsalm2b' | 'heardPsalm3' | 'foundCount' | 'nextNames' | 'waitingName'>): boolean {
    const heardPsalm2b = normalizeHeardPsalm2b(save);

    return heardPsalm2b
        && !save.heardPsalm3
        && save.foundCount >= 3
        && save.nextNames.includes('Biscuit')
        && !save.waitingName;
}

export function treasureHudUnlocked (foundCount: number): boolean {
    return foundCount >= 1;
}

export function abcHudUnlocked (foundCount: number): boolean {
    return foundCount >= 2;
}

export type RestoreFindPlan = {
    followers: string[];
    /** Sheep left on the map to find (waiting or hole), if any. */
    waitingName: string | null;
    trapWaitingInHole: boolean;
    /** Hurt-in-hole cheat: bandage without re-walking up. */
    markWaitingDiscovered: boolean;
    /** Taken from nextNames via spawnNextSheep (not waitingName). */
    spawnFromQueue: boolean;
    showMissingCue: boolean;
    /** Flock hungry toward pasture (after 23:1, before meal). */
    hungry: boolean;
    /** Flock thirsty toward water (after find #2, before quiet waters). */
    thirsty: boolean;
    treasureHud: boolean;
    abcHud: boolean;
    /** False when waitingName would be rejected by the spawn order gate. */
    waitingSpawnAllowed: boolean;
};

/**
 * Pure mirror of WorldScene.restoreSave flock decisions — who follows, who waits,
 * hole trap, hunger/thirst, HUD unlocks. Used by tests and to keep cheat saves honest.
 */
export function planRestoreFind (save: GameSave): RestoreFindPlan {
    const heardPsalm2b = normalizeHeardPsalm2b(save);
    const followers = [...save.foundNames];
    let waitingName: string | null = null;
    let trapWaitingInHole = false;
    let markWaitingDiscovered = false;
    let spawnFromQueue = false;
    let showMissingCue = false;

    if (save.waitingName) {
        waitingName = save.waitingName;
        trapWaitingInHole = shouldTrapInHole(save.waitingName, save.heardPsalm3);
        markWaitingDiscovered = save.foundCount >= 3 && trapWaitingInHole;
    }
    else if (shouldHaveLostSheep(save)) {
        waitingName = save.nextNames[0] ?? null;
        spawnFromQueue = waitingName !== null;
        trapWaitingInHole = waitingName !== null && shouldTrapInHole(waitingName, save.heardPsalm3);
    }
    else if (shouldAwaitHoleSheep(save)) {
        waitingName = 'Biscuit';
        spawnFromQueue = true;
        trapWaitingInHole = true;
        showMissingCue = true;
    }

    const waitingSpawnAllowed = waitingName === null
        || canSpawnFlockName({
            name: waitingName,
            foundCount: save.foundCount,
            hasActiveFlockFind: false
        });

    if (!waitingSpawnAllowed) {
        return {
            followers,
            waitingName: null,
            trapWaitingInHole: false,
            markWaitingDiscovered: false,
            spawnFromQueue: false,
            showMissingCue: false,
            hungry: !save.heardCorinthians && save.heardPsalm1 && !save.heardPsalm2,
            thirsty: save.foundCount >= 2 && !heardPsalm2b && !save.waitingName,
            treasureHud: treasureHudUnlocked(save.foundCount),
            abcHud: abcHudUnlocked(save.foundCount),
            waitingSpawnAllowed: false
        };
    }

    return {
        followers,
        waitingName,
        trapWaitingInHole,
        markWaitingDiscovered,
        spawnFromQueue,
        showMissingCue,
        hungry: !save.heardCorinthians && save.heardPsalm1 && !save.heardPsalm2,
        thirsty: save.foundCount >= 2 && !heardPsalm2b && !save.waitingName,
        treasureHud: treasureHudUnlocked(save.foundCount),
        abcHud: abcHudUnlocked(save.foundCount),
        waitingSpawnAllowed: true
    };
}

/** Flock names must partition into found / waiting / next without gaps or dupes. */
export function assertFlockQueuePartition (save: Pick<GameSave, 'foundNames' | 'waitingName' | 'nextNames' | 'foundCount'>): {
    ok: boolean;
    reason?: string;
} {
    const flockFound = save.foundNames.filter(isFlockName);
    const waiting = save.waitingName && isFlockName(save.waitingName) ? [save.waitingName] : [];
    const next = save.nextNames.filter(isFlockName);
    const combined = [...flockFound, ...waiting, ...next];

    if (combined.length !== FLOCK_NAMES.length) {
        return { ok: false, reason: `expected ${FLOCK_NAMES.length} flock slots, got ${combined.length}` };
    }

    if (new Set(combined).size !== combined.length) {
        return { ok: false, reason: 'duplicate flock name in found/waiting/next' };
    }

    for (let i = 0; i < FLOCK_NAMES.length; i++) {
        if (!combined.includes(FLOCK_NAMES[i])) {
            return { ok: false, reason: `missing ${FLOCK_NAMES[i]}` };
        }
    }

    // While still in the flock chapter, foundCount must match flock names found.
    if (save.foundCount <= FLOCK_NAMES.length && flockFound.length !== save.foundCount) {
        return {
            ok: false,
            reason: `foundCount ${save.foundCount} vs flock foundNames ${flockFound.length}`
        };
    }

    for (let i = 0; i < flockFound.length; i++) {
        if (flockFound[i] !== FLOCK_NAMES[i]) {
            return { ok: false, reason: `foundNames out of order at ${flockFound[i]}` };
        }
    }

    return { ok: true };
}

/** Apply a cheat spot the same way CheatScene.jumpTo does. */
export function applyCheatSave (save: GameSave): GameSave {
    return {
        ...save,
        achievementsDisabled: true,
        unlockedAchievements: []
    };
}
