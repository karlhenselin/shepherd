import { describe, expect, it } from 'vitest';
import {
    abcHudUnlocked,
    applyCheatSave,
    assertFlockQueuePartition,
    canSpawnFlockName,
    expectedNextFlockName,
    FLOCK_NAMES,
    planRestoreFind,
    shouldAwaitHoleSheep,
    shouldHaveLostSheep,
    shouldTrapInHole,
    treasureHudUnlocked
} from './progression';
import type { GameSave } from './gameSave';

function baseSave (extra: Partial<GameSave> = {}): GameSave {
    return {
        version: 1,
        checkpoint: 'found-sheep',
        foundCount: 0,
        foundNames: [],
        waitingName: null,
        nextNames: [...FLOCK_NAMES],
        heardPsalm1: false,
        heardPsalm2: false,
        heardPsalm3: false,
        ...extra
    };
}

describe('flock spawn order', () => {
    it('expects Clover → Snowball → Milo → Biscuit', () => {
        expect(expectedNextFlockName(0)).toBe('Clover');
        expect(expectedNextFlockName(1)).toBe('Snowball');
        expect(expectedNextFlockName(2)).toBe('Milo');
        expect(expectedNextFlockName(3)).toBe('Biscuit');
        expect(expectedNextFlockName(4)).toBeUndefined();
    });

    it('rejects out-of-order flock spawns', () => {
        expect(canSpawnFlockName({ name: 'Milo', foundCount: 1, hasActiveFlockFind: false })).toBe(false);
        expect(canSpawnFlockName({ name: 'Snowball', foundCount: 1, hasActiveFlockFind: false })).toBe(true);
        expect(canSpawnFlockName({ name: 'Snowball', foundCount: 1, hasActiveFlockFind: true })).toBe(false);
    });

    it('allows Leo/Sarah without flock order', () => {
        expect(canSpawnFlockName({ name: 'Leo', foundCount: 4, hasActiveFlockFind: false })).toBe(true);
        expect(canSpawnFlockName({ name: 'Sarah', foundCount: 4, hasActiveFlockFind: true })).toBe(true);
    });

    it('traps Biscuit in the hole until Psalm 23:3', () => {
        expect(shouldTrapInHole('Biscuit', false)).toBe(true);
        expect(shouldTrapInHole('Biscuit', true)).toBe(false);
        expect(shouldTrapInHole('Milo', false)).toBe(false);
    });
});

describe('HUD unlock progression', () => {
    it('unlocks treasure after first sheep and ABC after second', () => {
        expect(treasureHudUnlocked(0)).toBe(false);
        expect(treasureHudUnlocked(1)).toBe(true);
        expect(abcHudUnlocked(1)).toBe(false);
        expect(abcHudUnlocked(2)).toBe(true);
    });
});

describe('lost-sheep / hole repair gates', () => {
    it('spawns Snowball after pastures when only Clover is found', () => {
        expect(shouldHaveLostSheep(baseSave({
            heardPsalm2: true,
            foundCount: 1,
            foundNames: ['Clover'],
            nextNames: ['Snowball', 'Milo', 'Biscuit']
        }))).toBe(true);
    });

    it('spawns Milo after quiet waters when two are found', () => {
        expect(shouldHaveLostSheep(baseSave({
            heardPsalm2: true,
            heardPsalm2b: true,
            foundCount: 2,
            foundNames: ['Clover', 'Snowball'],
            nextNames: ['Milo', 'Biscuit']
        }))).toBe(true);
    });

    it('awaits Biscuit in the hole after Milo is found', () => {
        const save = baseSave({
            heardPsalm2: true,
            heardPsalm2b: true,
            foundCount: 3,
            foundNames: ['Clover', 'Snowball', 'Milo'],
            nextNames: ['Biscuit']
        });

        expect(shouldHaveLostSheep(save)).toBe(false);
        expect(shouldAwaitHoleSheep(save)).toBe(true);
    });

    it('does not await hole sheep when waitingName already holds Biscuit', () => {
        expect(shouldAwaitHoleSheep(baseSave({
            heardPsalm2b: true,
            foundCount: 3,
            foundNames: ['Clover', 'Snowball', 'Milo'],
            waitingName: 'Biscuit',
            nextNames: []
        }))).toBe(false);
    });

    it('treats heardPsalm3 as implying quiet waters', () => {
        expect(shouldHaveLostSheep(baseSave({
            heardPsalm2: true,
            heardPsalm3: true,
            foundCount: 2,
            nextNames: ['Milo', 'Biscuit']
        }))).toBe(true);
    });
});

describe('planRestoreFind', () => {
    it('makes the flock hungry after 23:1 and before the meal', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 1,
            foundNames: ['Clover'],
            nextNames: ['Snowball', 'Milo', 'Biscuit'],
            heardPsalm1: true
        }));

        expect(plan.hungry).toBe(true);
        expect(plan.thirsty).toBe(false);
        expect(plan.treasureHud).toBe(true);
        expect(plan.abcHud).toBe(false);
        expect(plan.waitingName).toBeNull();
    });

    it('makes the flock thirsty after find #2 until quiet waters', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 2,
            foundNames: ['Clover', 'Snowball'],
            nextNames: ['Milo', 'Biscuit'],
            heardPsalm1: true,
            heardPsalm2: true
        }));

        expect(plan.thirsty).toBe(true);
        expect(plan.hungry).toBe(false);
        expect(plan.abcHud).toBe(true);
        expect(plan.waitingName).toBeNull();
    });

    it('spawns Snowball after pastures', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 1,
            foundNames: ['Clover'],
            nextNames: ['Snowball', 'Milo', 'Biscuit'],
            heardPsalm1: true,
            heardPsalm2: true
        }));

        expect(plan.waitingName).toBe('Snowball');
        expect(plan.spawnFromQueue).toBe(true);
        expect(plan.trapWaitingInHole).toBe(false);
        expect(plan.waitingSpawnAllowed).toBe(true);
    });

    it('spawns Milo after quiet waters', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 2,
            foundNames: ['Clover', 'Snowball'],
            nextNames: ['Milo', 'Biscuit'],
            heardPsalm1: true,
            heardPsalm2: true,
            heardPsalm2b: true
        }));

        expect(plan.waitingName).toBe('Milo');
        expect(plan.spawnFromQueue).toBe(true);
        expect(plan.thirsty).toBe(false);
    });

    it('puts Biscuit in the hole after Milo (queue form)', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 3,
            foundNames: ['Clover', 'Snowball', 'Milo'],
            nextNames: ['Biscuit'],
            heardPsalm1: true,
            heardPsalm2: true,
            heardPsalm2b: true
        }));

        expect(plan.waitingName).toBe('Biscuit');
        expect(plan.trapWaitingInHole).toBe(true);
        expect(plan.showMissingCue).toBe(true);
        expect(plan.markWaitingDiscovered).toBe(false);
        expect(plan.spawnFromQueue).toBe(true);
    });

    it('marks hurt-hole Biscuit discovered when waitingName is set', () => {
        const plan = planRestoreFind(baseSave({
            checkpoint: 'hurt-sheep',
            foundCount: 3,
            foundNames: ['Clover', 'Snowball', 'Milo'],
            waitingName: 'Biscuit',
            nextNames: [],
            heardPsalm1: true,
            heardPsalm2: true,
            heardPsalm2b: true
        }));

        expect(plan.waitingName).toBe('Biscuit');
        expect(plan.trapWaitingInHole).toBe(true);
        expect(plan.markWaitingDiscovered).toBe(true);
        expect(plan.spawnFromQueue).toBe(false);
        expect(plan.showMissingCue).toBe(false);
    });

    it('blocks a wrong waiting sheep for the current foundCount', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 1,
            foundNames: ['Clover'],
            waitingName: 'Biscuit',
            nextNames: ['Snowball', 'Milo'],
            heardPsalm1: true,
            heardPsalm2: true
        }));

        expect(plan.waitingSpawnAllowed).toBe(false);
        expect(plan.waitingName).toBeNull();
    });

    it('plans Leo as the peaceable find after the change', () => {
        const plan = planRestoreFind(baseSave({
            foundCount: 4,
            foundNames: [...FLOCK_NAMES],
            waitingName: 'Leo',
            nextNames: ['Sarah'],
            heardPsalm1: true,
            heardPsalm2: true,
            heardPsalm2b: true,
            heardPsalm3: true,
            heardCorinthians: true,
            whiteRobe: true
        }));

        expect(plan.waitingName).toBe('Leo');
        expect(plan.trapWaitingInHole).toBe(false);
        expect(plan.hungry).toBe(false);
        expect(plan.waitingSpawnAllowed).toBe(true);
    });
});

describe('assertFlockQueuePartition', () => {
    it('accepts a valid mid-flock partition', () => {
        expect(assertFlockQueuePartition({
            foundCount: 2,
            foundNames: ['Clover', 'Snowball'],
            waitingName: 'Milo',
            nextNames: ['Biscuit']
        }).ok).toBe(true);
    });

    it('rejects duplicates and gaps', () => {
        expect(assertFlockQueuePartition({
            foundCount: 2,
            foundNames: ['Clover', 'Snowball'],
            waitingName: 'Snowball',
            nextNames: ['Biscuit']
        }).ok).toBe(false);

        expect(assertFlockQueuePartition({
            foundCount: 1,
            foundNames: ['Clover'],
            waitingName: null,
            nextNames: ['Milo', 'Biscuit']
        }).ok).toBe(false);
    });
});

describe('applyCheatSave', () => {
    it('disables achievements the way CheatScene does', () => {
        const applied = applyCheatSave(baseSave({ unlockedAchievements: ['first_sheep'] }));
        expect(applied.achievementsDisabled).toBe(true);
        expect(applied.unlockedAchievements).toEqual([]);
    });
});
