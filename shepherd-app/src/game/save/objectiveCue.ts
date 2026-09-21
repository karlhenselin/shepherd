/** Minimal flock member fields for the main-quest cue. */
export type CueSheep = {
    name: string;
    mood: string;
    hurt: boolean;
    discovered: boolean;
    hungry: boolean;
    thirsty: boolean;
    peaceable?: boolean;
    hurtByWolf?: boolean;
    snaredInThorns?: boolean;
};

export type ObjectiveCueState = {
    flock: ReadonlyArray<CueSheep>;
    foundCount: number;
    nightStarted: boolean;
    hasStaff: boolean;
    /** Staff pickup exists in the world. */
    staffOnGround: boolean;
    heardCorinthians: boolean;
    heardJohn102: boolean;
    heardJohn109: boolean;
    cityOpen: boolean;
    gemsRemaining: boolean;
    waterVerseAvailable: boolean;
};

/** Undiscovered story / hole find still out (not a discovered wanderer). */
export function hasUndiscoveredFind (flock: ReadonlyArray<Pick<CueSheep, 'mood' | 'hurt' | 'discovered'>>): boolean {
    return flock.some((sheep) =>
        !sheep.discovered && (sheep.mood === 'waiting' || sheep.hurt)
    );
}

function hungryCue (flock: ReadonlyArray<CueSheep>): string {
    const hungry = flock.filter((sheep) => sheep.hungry && sheep.mood !== 'waiting');

    if (hungry.length === 1) {
        return `${hungry[0].name}'s hungry.`;
    }

    return 'My sheep are hungry.';
}

/**
 * Main-quest banner text. Pure so night / flock / staff states can be unit-tested
 * without booting Phaser.
 */
export function objectiveCue (state: ObjectiveCueState): string {
    const hurt = state.flock.find((sheep) => sheep.hurt && sheep.discovered);
    const priorityHurt = hurt
        ? (state.flock.find((sheep) => sheep.hurt && sheep.discovered && sheep.hurtByWolf) ?? hurt)
        : undefined;

    if (priorityHurt?.hurtByWolf || priorityHurt?.snaredInThorns) {
        return `Help ${priorityHurt.name}!`;
    }

    if (priorityHurt) {
        return `I need to bandage ${priorityHurt.name}.`;
    }

    if (state.flock.some((sheep) => sheep.mood === 'drinking')) {
        return 'My flock is drinking.';
    }

    const wandered = state.flock.find((sheep) => sheep.mood === 'waiting' && sheep.discovered);

    if (wandered) {
        return `${wandered.name} wandered off—I need to find them.`;
    }

    if (hasUndiscoveredFind(state.flock)) {
        const seek = state.flock.find((sheep) =>
            sheep.peaceable && (sheep.mood === 'waiting' || sheep.hurt) && !sheep.discovered
        );

        if (seek) {
            return 'Enlarge the flock.';
        }

        const holeFind = state.flock.find((sheep) =>
            sheep.hurt && !sheep.discovered
        );

        if (holeFind) {
            return `I should find ${holeFind.name}.`;
        }

        return state.foundCount === 1 ? 'Another of my sheep is missing.' : 'I need to find my sheep.';
    }

    if (state.cityOpen) {
        return 'Enter the city.';
    }

    // Night home run: staff / pen before leftover hunger / thirst.
    if (state.staffOnGround && !state.hasStaff) {
        return 'I need my staff.';
    }

    if (state.nightStarted) {
        if (!state.heardJohn102) {
            return 'I need to guide my flock to the pen.';
        }

        if (!state.heardJohn109 && !state.heardCorinthians) {
            return 'I made it to the pen.';
        }
    }

    if (state.flock.some((sheep) => sheep.hungry) && !state.heardCorinthians) {
        return hungryCue(state.flock);
    }

    if (state.flock.some((sheep) => sheep.thirsty) && !state.heardCorinthians) {
        return 'My sheep are thirsty.';
    }

    if (state.heardJohn109 && !state.heardCorinthians) {
        return 'My flock is home.';
    }

    if (state.gemsRemaining) {
        return 'Discover more Bible Gems';
    }

    if (state.waterVerseAvailable) {
        return 'Drink from the water of Life';
    }

    return 'Enjoy the shade';
}

/** Following flock of the original four — typical post-rescue / night state. */
export function followingFlock (names: string[] = ['Clover', 'Snowball', 'Milo', 'Biscuit']): CueSheep[] {
    return names.map((name) => ({
        name,
        mood: 'following',
        hurt: false,
        discovered: true,
        hungry: false,
        thirsty: false
    }));
}
