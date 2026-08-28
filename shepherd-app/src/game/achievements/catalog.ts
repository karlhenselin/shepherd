import { BIBLE_GEMS } from '../data/scripture';
import type { GameSave } from '../save/gameSave';

/** Logical achievement ids (not Play Console ids). */
export const ACHIEVEMENT_IDS = [
    'first_sheep',
    'full_flock',
    'green_pastures',
    'quiet_waters',
    'restores_soul',
    'paths_righteousness',
    'valley_of_shadow',
    'fear_no_evil',
    'comfort_of_staff',
    'the_gate',
    'we_shall_be_changed',
    'first_bible_gem',
    'gem_collector',
    'bible_treasure_hunter'
] as const;

export type AchievementId = typeof ACHIEVEMENT_IDS[number];

export type AchievementDef = {
    id: AchievementId;
    title: string;
    earned: (save: GameSave) => boolean;
};

export const ACHIEVEMENTS: AchievementDef[] = [
    {
        id: 'first_sheep',
        title: 'First of the Flock',
        earned: (save) => save.foundCount >= 1
    },
    {
        id: 'full_flock',
        title: 'Full Flock',
        earned: (save) => save.foundCount >= 4
    },
    {
        id: 'green_pastures',
        title: 'Green Pastures',
        earned: (save) => save.heardPsalm2
    },
    {
        id: 'quiet_waters',
        title: 'Quiet Waters',
        earned: (save) => save.heardPsalm2b === true || save.heardPsalm3
    },
    {
        id: 'restores_soul',
        title: 'He Restores My Soul',
        earned: (save) => save.heardPsalm3
    },
    {
        id: 'paths_righteousness',
        title: 'Paths of Righteousness',
        earned: (save) => save.heardPsalm3b === true
    },
    {
        id: 'valley_of_shadow',
        title: 'Valley of the Shadow',
        earned: (save) => save.heardPsalm4a === true
    },
    {
        id: 'fear_no_evil',
        title: 'Fear No Evil',
        earned: (save) => save.heardPsalm4b === true
    },
    {
        id: 'comfort_of_staff',
        title: 'Comfort of the Staff',
        earned: (save) => save.hasStaff === true || save.checkpoint === 'found-staff' || save.heardPsalm4c === true
    },
    {
        id: 'the_gate',
        title: 'The Gate',
        earned: (save) => save.heardJohn109 === true
    },
    {
        id: 'we_shall_be_changed',
        title: 'We Shall All Be Changed',
        earned: (save) => save.heardCorinthians === true || save.whiteRobe === true
    },
    {
        id: 'first_bible_gem',
        title: 'First Bible Gem',
        earned: (save) => (save.foundGems?.length ?? 0) >= 1
    },
    {
        id: 'gem_collector',
        title: 'Gem Collector',
        earned: (save) => (save.foundGems?.length ?? 0) >= 25
    },
    {
        id: 'bible_treasure_hunter',
        title: 'Bible Treasure Hunter',
        earned: (save) => (save.foundGems?.length ?? 0) >= BIBLE_GEMS.length
    }
];

/**
 * Play Console achievement ids. Leave empty until created in Play Console;
 * unlocks are skipped when the mapped id is blank.
 */
export const ANDROID_ACHIEVEMENT_IDS: Record<AchievementId, string> = {
    first_sheep: '',
    full_flock: '',
    green_pastures: '',
    quiet_waters: '',
    restores_soul: '',
    paths_righteousness: '',
    valley_of_shadow: '',
    fear_no_evil: '',
    comfort_of_staff: '',
    the_gate: '',
    we_shall_be_changed: '',
    first_bible_gem: '',
    gem_collector: '',
    bible_treasure_hunter: ''
};

export function earnedAchievements (save: GameSave): AchievementId[] {
    return ACHIEVEMENTS.filter((item) => item.earned(save)).map((item) => item.id);
}
