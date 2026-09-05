import { BIBLE_GEMS } from '../data/scripture';
import { TREE_VERSES } from '../data/treeVerses';
import { WATER_VERSES } from '../data/waterVerses';
import { defaultCitySpot, defaultPenSpot, PASTURE_COL, PASTURE_ROW, regionCenter, startCenter, WATER_COL, WATER_ROW } from '../world/constants';
import { CITY_APPROACH_Y } from '../world/Jerusalem';
import { GameSave, StoryCheckpoint } from './gameSave';

const FLOCK = ['Clover', 'Snowball', 'Milo', 'Biscuit'] as const;

export type CheatSpot = {
    label: string;
    /** `null` clears progress and starts over. */
    save: GameSave | null;
};

export const CHEAT_SPOTS: CheatSpot[] = [
    { label: 'Start', save: null },
    { label: 'Found first sheep', save: foundFirst() },
    { label: 'Psalm 23:1 — hungry', save: psalm231() },
    { label: 'Psalm 23:2 / Isaiah 53:6', save: psalm232() },
    { label: 'Found second sheep — thirsty', save: foundSecond() },
    { label: 'Psalm 23:2b — quiet waters', save: psalm232b() },
    { label: 'Found Milo — stay together', save: foundMilo() },
    { label: 'Hurt sheep in the hole', save: hurtSheep() },
    { label: 'Psalm 23:3 — restored', save: psalm233() },
    { label: 'Psalm 23:3b — paths of righteousness', save: psalm233b() },
    { label: 'Psalm 23:4a — night falls', save: psalm234a() },
    { label: 'Psalm 23:4b — fear no evil', save: psalm234b() },
    { label: 'Found staff', save: foundStaff() },
    { label: 'Psalm 23:4c — rod and staff', save: psalm234c() },
    { label: 'John 10:2 — at the pen', save: john102() },
    { label: 'John 10:9 — I am the gate', save: john109() },
    { label: '1 Corinthians 15:51 — changed', save: corinthians() },
    { label: 'Find the lion', save: findLion() },
    { label: 'Find the wolf', save: findWolf() },
    { label: 'Enter the city', save: enterCity() },
    { label: 'Found all Bible gems', save: foundAllGems() },
    { label: 'Found all water', save: foundAllWater() },
    { label: 'All but one tree passage', save: allButOneTree() }
];

function blank (checkpoint: StoryCheckpoint, extra: Partial<GameSave> = {}): GameSave {
    const start = startCenter();

    return {
        version: 1,
        checkpoint,
        foundCount: 0,
        foundNames: [],
        waitingName: null,
        nextNames: [...FLOCK],
        heardPsalm1: false,
        heardPsalm2: false,
        heardPsalm2b: false,
        heardPsalm3: false,
        heardPsalm3b: false,
        heardPsalm4a: false,
        heardPsalm4b: false,
        heardPsalm4c: false,
        heardJohn102: false,
        heardJohn109: false,
        heardCorinthians: false,
        heardCity: false,
        hasStaff: false,
        staff: null,
        player: start,
        pen: null,
        foundGems: [],
        ...extra
    };
}

function flockThrough (lastFound: number): Pick<GameSave, 'foundCount' | 'foundNames' | 'waitingName' | 'nextNames'> {
    const foundNames = FLOCK.slice(0, lastFound);
    return {
        foundCount: lastFound,
        foundNames: [...foundNames],
        waitingName: null,
        nextNames: FLOCK.slice(lastFound)
    };
}

function foundFirst (): GameSave {
    return blank('found-sheep', flockThrough(1));
}

function psalm231 (): GameSave {
    return blank('psalm-23-1', {
        ...flockThrough(1),
        heardPsalm1: true,
        player: regionCenter(PASTURE_COL, PASTURE_ROW)
    });
}

function psalm232 (): GameSave {
    return blank('isaiah-53-6', {
        ...flockThrough(1),
        heardPsalm1: true,
        heardPsalm2: true,
        player: regionCenter(PASTURE_COL, PASTURE_ROW)
    });
}

function foundSecond (): GameSave {
    return blank('found-sheep', {
        ...flockThrough(2),
        heardPsalm1: true,
        heardPsalm2: true,
        player: regionCenter(WATER_COL, WATER_ROW)
    });
}

function psalm232b (): GameSave {
    return blank('psalm-23-2', {
        ...flockThrough(2),
        heardPsalm1: true,
        heardPsalm2: true,
        heardPsalm2b: true,
        player: regionCenter(WATER_COL, WATER_ROW)
    });
}

function foundMilo (): GameSave {
    return blank('found-sheep', {
        ...flockThrough(3),
        heardPsalm1: true,
        heardPsalm2: true,
        heardPsalm2b: true,
        player: regionCenter(WATER_COL, WATER_ROW)
    });
}

function hurtSheep (): GameSave {
    return blank('hurt-sheep', {
        foundCount: 3,
        foundNames: ['Clover', 'Snowball', 'Milo'],
        waitingName: 'Biscuit',
        nextNames: [],
        heardPsalm1: true,
        heardPsalm2: true,
        heardPsalm2b: true
    });
}

function afterRescue (checkpoint: StoryCheckpoint, extra: Partial<GameSave> = {}): GameSave {
    return blank(checkpoint, {
        ...flockThrough(4),
        heardPsalm1: true,
        heardPsalm2: true,
        heardPsalm2b: true,
        heardPsalm3: true,
        ...extra
    });
}

function psalm233 (): GameSave {
    return afterRescue('psalm-23-3');
}

function psalm233b (): GameSave {
    return afterRescue('psalm-23-3b', { heardPsalm3b: true });
}

function atPen (checkpoint: StoryCheckpoint, extra: Partial<GameSave> = {}): GameSave {
    const pen = defaultPenSpot();

    return afterRescue(checkpoint, {
        heardPsalm3b: true,
        heardPsalm4a: true,
        player: { x: pen.x - 40, y: pen.y + 64 },
        pen,
        ...extra
    });
}

function psalm234a (): GameSave {
    return afterRescue('psalm-23-4a', {
        heardPsalm3b: true,
        heardPsalm4a: true
    });
}

function psalm234b (): GameSave {
    return afterRescue('psalm-23-4b', {
        heardPsalm3b: true,
        heardPsalm4a: true,
        heardPsalm4b: true
    });
}

function foundStaff (): GameSave {
    return afterRescue('found-staff', {
        heardPsalm3b: true,
        heardPsalm4a: true,
        heardPsalm4b: true,
        hasStaff: true
    });
}

function psalm234c (): GameSave {
    return afterRescue('psalm-23-4c', {
        heardPsalm3b: true,
        heardPsalm4a: true,
        heardPsalm4b: true,
        heardPsalm4c: true,
        hasStaff: true
    });
}

function john102 (): GameSave {
    return atPen('john-10-2', {
        heardPsalm4b: true,
        heardPsalm4c: true,
        hasStaff: true
    });
}

function john109 (): GameSave {
    return atPen('john-10-9', {
        heardPsalm4b: true,
        heardPsalm4c: true,
        heardJohn102: true,
        heardJohn109: true,
        hasStaff: true
    });
}

function afterChange (checkpoint: StoryCheckpoint, extra: Partial<GameSave> = {}): GameSave {
    return atPen(checkpoint, {
        heardPsalm4b: true,
        heardPsalm4c: true,
        heardJohn102: true,
        heardJohn109: true,
        heardCorinthians: true,
        hasStaff: true,
        whiteRobe: true,
        ...extra
    });
}

function corinthians (): GameSave {
    return afterChange('1-cor-15-51');
}

function findLion (): GameSave {
    return afterChange('found-sheep', {
        waitingName: 'Leo',
        nextNames: ['Sarah']
    });
}

function findWolf (): GameSave {
    return afterChange('found-sheep', {
        foundNames: [...FLOCK, 'Leo'],
        waitingName: 'Sarah',
        nextNames: []
    });
}

function enterCity (): GameSave {
    const city = defaultCitySpot();

    return afterChange('enter-city', {
        foundCount: 6,
        foundNames: [...FLOCK, 'Leo', 'Sarah'],
        waitingName: null,
        nextNames: [],
        player: { x: city.x, y: city.y + CITY_APPROACH_Y }
    });
}

function foundAllGems (): GameSave {
    return afterCity({
        foundGems: allGemIds()
    });
}

function foundAllWater (): GameSave {
    return afterCity({
        foundWaterVerses: allWaterIds()
    });
}

function allButOneTree (): GameSave {
    return afterCity({
        foundGems: allGemIds(),
        foundWaterVerses: allWaterIds(),
        foundTreeVerses: TREE_VERSES.slice(0, -1).map((verse) => verse.id)
    });
}

function allGemIds (): string[] {
    return BIBLE_GEMS.map((gem) => gem.id);
}

function allWaterIds (): string[] {
    return WATER_VERSES.map((verse) => verse.id);
}

function afterCity (extra: Partial<GameSave> = {}): GameSave {
    const city = defaultCitySpot();

    return afterChange('entered-city', {
        foundCount: 6,
        foundNames: [...FLOCK, 'Leo', 'Sarah'],
        waitingName: null,
        nextNames: [],
        heardCity: true,
        player: { x: city.x, y: city.y + CITY_APPROACH_Y },
        ...extra
    });
}
