import { scriptureLine } from './scripture';

/** Held until the white robe, then read first at shade trees. */
export const TREE_ROBE_VERSE_IDS = ['revelation-2-7b', 'revelation-22-14'] as const;

export const TREE_VERSES = [
    { id: 'genesis-2-16', ref: 'Genesis 2:16', text: 'And the LORD God commanded him, “You may eat freely from every tree of the garden.”' },
    { id: 'genesis-18-4', ref: 'Genesis 18:4', text: 'Let a little water be brought, that you may wash your feet and rest under the tree.' },
    { id: 'leviticus-26-4', ref: 'Leviticus 26:4', text: 'I will send you rain in its season, and the ground will yield its produce and the trees of the field their fruit.' },
    { id: 'job-7-2', ref: 'Job 7:2', text: 'Like a slave he longs for shade; like a hired man he waits for his wages.' },
    { id: 'job-40-22', ref: 'Job 40:22', text: 'The lotus plants conceal him in their shade; the willows of the brook surround him.' },
    { id: '1-kings-19-5', ref: '1 Kings 19:5', text: 'Then he lay down and slept under the broom tree.' },
    { id: '1-chronicles-16-33', ref: '1 Chronicles 16:33', text: 'Then the trees of the forest will shout for joy before the LORD, for He is coming to judge the earth.' },
    { id: 'nehemiah-10-35', ref: 'Nehemiah 10:35', text: 'We will bring the firstfruits of our land and of every fruit tree to the house of the LORD year by year.' },
    { id: 'jeremiah-17-8', ref: 'Jeremiah 17:8', text: 'He will be like a tree planted by the waters that sends out its roots toward the stream.' },
    { id: 'psalm-1-3', ref: 'Psalm 1:3', text: 'He is like a tree planted by streams of water, yielding its fruit in season.' },
    { id: 'isaiah-4-6', ref: 'Isaiah 4:6', text: 'It will be a shelter and shade from the heat of the day, and a refuge and hiding place from storm and rain.' },
    { id: 'isaiah-16-3b', ref: 'Isaiah 16:3b', text: 'Shelter us at noonday with shade that is as dark as night.' },
    { id: 'isaiah-25-4a', ref: 'Isaiah 25:4a', text: 'You have been a stronghold for the poor, a stronghold for the needy person in his distress, a refuge from the rain, a shade from the heat.' },
    { id: 'isaiah-32-2', ref: 'Isaiah 32:2', text: 'Each will be like a shelter from the wind and a refuge from the storm, like streams of water in a dry land, like the shade of a great rock in a thirsty land.' },
    { id: 'hosea-14-7a', ref: 'Hosea 14:7a', text: 'The people will return and live beneath his shade.' },
    { id: 'jonah-4-6a', ref: 'Jonah 4:6a', text: 'Then the LORD God appointed a plant, and it grew up to provide shade over Jonah’s head to ease his discomfort.' },
    { id: 'mark-4-32', ref: 'Mark 4:32', text: 'And when sown, it comes up and grows taller than all the vegetables, and produces large branches, so that the birds of the sky can nest in its shade.' },
    { id: '1-peter-2-24', ref: '1 Peter 2:24', text: 'He Himself bore our sins in His body on the tree, so that we might die to sin and live to righteousness.' },
    { id: 'revelation-2-7b', ref: 'Revelation 2:7b', text: 'I will give the victor the right to eat from the tree of life, which is in God’s paradise.' },
    { id: 'revelation-22-14', ref: 'Revelation 22:14', text: 'Blessed are those who wash their robes, so that they may have the right to the tree of life.' }
] as const;

export type TreeVerseId = typeof TREE_VERSES[number]['id'];

export function treeVerseLine (id: string): string {
    const verse = TREE_VERSES.find((item) => item.id === id);
    return verse ? scriptureLine(verse) : '';
}

export function nextTreeVerseId (found: string[], whiteRobe: boolean): string | null {
    const taken = new Set(found);
    const robeFirst = TREE_ROBE_VERSE_IDS.filter((id) => !taken.has(id));
    const rest = TREE_VERSES.filter((item) => {
        return !taken.has(item.id) && !(TREE_ROBE_VERSE_IDS as readonly string[]).includes(item.id);
    });

    if (whiteRobe && robeFirst.length > 0) {
        return robeFirst[0];
    }

    if (rest.length > 0) {
        return rest[0].id;
    }

    return null;
}

export function foundTreeVerses (ids: string[]): { ref: string; text: string }[] {
    const taken = new Set(ids);
    return TREE_VERSES.filter((item) => taken.has(item.id)).map((item) => ({
        ref: item.ref,
        text: item.text
    }));
}
