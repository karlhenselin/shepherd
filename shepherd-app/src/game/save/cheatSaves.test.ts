import { beforeEach, describe, expect, it } from 'vitest';
import { CHEAT_SPOTS } from './cheatSaves';
import { clearSave, loadSave, writeSave, type GameSave } from './gameSave';
import {
    applyCheatSave,
    assertFlockQueuePartition,
    FLOCK_NAMES,
    planRestoreFind,
    type RestoreFindPlan
} from './progression';
import { unlockedStoryPassages } from '../data/scripture';
import { BIBLE_GEMS } from '../data/scripture';
import { WATER_VERSES } from '../data/waterVerses';
import { TREE_VERSES } from '../data/treeVerses';

function spot (label: string): GameSave {
    const entry = CHEAT_SPOTS.find((item) => item.label === label);

    if (!entry?.save) {
        throw new Error(`Missing cheat save: ${label}`);
    }

    return entry.save;
}

describe('CHEAT_SPOTS catalog', () => {
    it('starts with a clear-save Start entry', () => {
        expect(CHEAT_SPOTS[0]).toEqual({ label: 'Start', save: null });
    });

    it('has unique labels', () => {
        const labels = CHEAT_SPOTS.map((item) => item.label);
        expect(new Set(labels).size).toBe(labels.length);
    });

    it('every non-Start save is version 1 with a checkpoint', () => {
        for (const entry of CHEAT_SPOTS) {
            if (!entry.save) {
                continue;
            }

            expect(entry.save.version).toBe(1);
            expect(entry.save.checkpoint).toBeTruthy();
            expect(entry.save.sheepSpawns).toBeTruthy();

            for (const name of FLOCK_NAMES) {
                expect(entry.save.sheepSpawns?.[name]).toMatchObject({
                    x: expect.any(Number),
                    y: expect.any(Number)
                });
            }
        }
    });
});

describe('cheat save flock partitions', () => {
    const flockChapterLabels = [
        'Found first sheep',
        'Psalm 23:1 — hungry',
        'Psalm 23:2 / Isaiah 53:6',
        'Found second sheep — thirsty',
        'Psalm 23:2b — quiet waters',
        'Found Milo — stay together',
        'Hurt sheep in the hole',
        'Psalm 23:3 — restored',
        'Psalm 23:3b — paths of righteousness',
        'Psalm 23:4a — night falls',
        'Psalm 23:4b — fear no evil',
        'Found staff',
        'Psalm 23:4c — rod and staff',
        'John 10:2 — at the pen',
        'John 10:9 — I am the gate',
        '1 Corinthians 15:51 — changed'
    ];

    it.each(flockChapterLabels)('%s partitions the four flock names', (label) => {
        const save = spot(label);
        const result = assertFlockQueuePartition(save);
        expect(result, result.reason).toEqual({ ok: true });
    });
});

describe('cheat → restore find plans', () => {
    const cases: Array<{
        label: string;
        expect: Partial<RestoreFindPlan> & { waitingName: string | null };
    }> = [
        {
            label: 'Found first sheep',
            expect: {
                waitingName: null,
                hungry: true,
                thirsty: false,
                treasureHud: true,
                abcHud: false
            }
        },
        {
            label: 'Psalm 23:1 — hungry',
            expect: {
                waitingName: null,
                hungry: true,
                thirsty: false,
                treasureHud: true
            }
        },
        {
            label: 'Psalm 23:2 / Isaiah 53:6',
            expect: {
                waitingName: 'Snowball',
                spawnFromQueue: true,
                trapWaitingInHole: false,
                hungry: false,
                abcHud: false
            }
        },
        {
            label: 'Found second sheep — thirsty',
            expect: {
                waitingName: null,
                thirsty: true,
                abcHud: true,
                treasureHud: true
            }
        },
        {
            label: 'Psalm 23:2b — quiet waters',
            expect: {
                waitingName: 'Milo',
                spawnFromQueue: true,
                trapWaitingInHole: false,
                thirsty: false,
                abcHud: true
            }
        },
        {
            label: 'Found Milo — stay together',
            expect: {
                waitingName: 'Biscuit',
                spawnFromQueue: true,
                trapWaitingInHole: true,
                showMissingCue: true,
                markWaitingDiscovered: false
            }
        },
        {
            label: 'Hurt sheep in the hole',
            expect: {
                waitingName: 'Biscuit',
                trapWaitingInHole: true,
                markWaitingDiscovered: true,
                spawnFromQueue: false,
                showMissingCue: false
            }
        },
        {
            label: 'Psalm 23:3 — restored',
            expect: {
                waitingName: null,
                trapWaitingInHole: false
            }
        },
        {
            label: 'Find the lion',
            expect: {
                waitingName: 'Leo',
                trapWaitingInHole: false,
                waitingSpawnAllowed: true
            }
        },
        {
            label: 'Find the wolf',
            expect: {
                waitingName: 'Sarah',
                followers: [...FLOCK_NAMES, 'Leo'],
                trapWaitingInHole: false
            }
        },
        {
            label: 'Enter the city',
            expect: {
                waitingName: null,
                followers: [...FLOCK_NAMES, 'Leo', 'Sarah']
            }
        }
    ];

    it.each(cases)('$label restores the expected find / quest state', ({ label, expect: expected }) => {
        const plan = planRestoreFind(spot(label));
        expect(plan.waitingSpawnAllowed).toBe(true);

        for (const [key, value] of Object.entries(expected)) {
            expect(plan[key as keyof RestoreFindPlan], key).toEqual(value);
        }
    });
});

describe('cheat scripture unlock flags', () => {
    it('unlocks story passages consistent with heard flags', () => {
        const save = spot('Psalm 23:2 / Isaiah 53:6');
        const refs = unlockedStoryPassages(save).map((passage) => passage.ref);

        expect(refs).toContain('Psalm 23:1a');
        expect(refs).toContain('Psalm 23:2a');
        expect(refs).toContain('Isaiah 53:6');
        expect(refs).not.toContain('Psalm 23:2b');
    });

    it('unlocks Isaiah 11:6 after finding Leo or Sarah', () => {
        const lion = unlockedStoryPassages(spot('Find the wolf'));
        expect(lion.some((passage) => passage.ref === 'Isaiah 11:6')).toBe(true);
    });

    it('collectible cheats fill gem / water / tree ids', () => {
        expect(spot('Found all Bible gems').foundGems).toEqual(BIBLE_GEMS.map((gem) => gem.id));
        expect(spot('Found all water').foundWaterVerses).toEqual(WATER_VERSES.map((verse) => verse.id));
        expect(spot('All but one tree passage').foundTreeVerses).toHaveLength(TREE_VERSES.length - 1);
    });
});

describe('cheat writeSave round-trip', () => {
    beforeEach(() => {
        clearSave();
    });

    it('persists each cheat save the way CheatScene applies it', () => {
        for (const entry of CHEAT_SPOTS) {
            if (!entry.save) {
                clearSave();
                expect(loadSave()).toBeNull();
                continue;
            }

            writeSave(applyCheatSave(entry.save));
            const loaded = loadSave();
            expect(loaded, entry.label).not.toBeNull();
            expect(loaded?.achievementsDisabled).toBe(true);
            expect(loaded?.unlockedAchievements).toEqual([]);
            expect(loaded?.checkpoint).toBe(entry.save.checkpoint);
            expect(loaded?.foundCount).toBe(entry.save.foundCount);
            expect(loaded?.foundNames).toEqual(entry.save.foundNames);
            expect(loaded?.waitingName).toBe(entry.save.waitingName);
            expect(loaded?.nextNames).toEqual(entry.save.nextNames);
            expect(planRestoreFind(loaded!).waitingSpawnAllowed).toBe(true);
        }
    });

    it('rejects corrupt saves', () => {
        localStorage.setItem('shepherd-save', JSON.stringify({ version: 2, checkpoint: 'found-sheep' }));
        expect(loadSave()).toBeNull();

        localStorage.setItem('shepherd-save', '{not-json');
        expect(loadSave()).toBeNull();
    });
});
