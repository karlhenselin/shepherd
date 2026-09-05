import { GameSave, loadSave, writeSave } from '../save/gameSave';
import {
    ANDROID_ACHIEVEMENT_IDS,
    AchievementId,
    earnedAchievements
} from './catalog';
import { initPlayGames, unlockPlayAchievement } from './playGames';

function uniqueIds (ids: AchievementId[]): AchievementId[] {
    return [...new Set(ids)];
}

/** Merge newly earned logical achievements into the save and unlock on Play Games. */
export function applyAchievements (save: GameSave): GameSave {
    if (save.achievementsDisabled) {
        return save;
    }

    const earned = earnedAchievements(save);
    const previous = (save.unlockedAchievements ?? []) as AchievementId[];
    const unlocked = uniqueIds([...previous, ...earned]);
    const next: GameSave = {
        ...save,
        unlockedAchievements: unlocked
    };

    const fresh = unlocked.filter((id) => !previous.includes(id));

    for (const id of fresh) {
        void unlockPlayAchievement(ANDROID_ACHIEVEMENT_IDS[id]);
    }

    return next;
}

/** Evaluate + persist achievements for the current save (catch-up safe). */
export function syncAchievements (save?: GameSave | null): GameSave | null {
    const current = save ?? loadSave();

    if (!current) {
        return null;
    }

    const next = applyAchievements(current);
    const before = current.unlockedAchievements ?? [];
    const after = next.unlockedAchievements ?? [];

    if (before.length !== after.length || before.some((id, i) => id !== after[i])) {
        writeSave(next);
    }

    return next;
}

/** Flush every locally unlocked achievement to Play Games (after sign-in). */
export async function flushAchievementsToPlayGames (save?: GameSave | null): Promise<void> {
    const current = save ?? loadSave();

    if (!current?.unlockedAchievements?.length || current.achievementsDisabled) {
        return;
    }

    for (const id of current.unlockedAchievements as AchievementId[]) {
        const platformId = ANDROID_ACHIEVEMENT_IDS[id];

        if (platformId) {
            await unlockPlayAchievement(platformId);
        }
    }
}

/** Boot: silent Play Games sign-in, catch-up evaluate, flush queue. */
export async function bootAchievements (): Promise<void> {
    const save = syncAchievements(loadSave());
    await initPlayGames();
    await flushAchievementsToPlayGames(save);
}
