import { scriptureLine } from './scripture';

/** Spoken when a sheep is snared in a bramble. */
export const THORN_SNARE_VERSES = [
    { id: 'genesis-3-18', ref: 'Genesis 3:18', text: 'Both thorns and thistles it will yield for you, and you will eat the plants of the field.' },
    { id: 'isaiah-7-24', ref: 'Isaiah 7:24', text: 'Men will go there with bow and arrow, for the land will be covered with briers and thorns.' },
    { id: 'hosea-2-6', ref: 'Hosea 2:6', text: 'Therefore, behold, I will hedge up her path with thorns; I will enclose her with a wall, so she cannot find her way.' },
    { id: 'matthew-13-7', ref: 'Matthew 13:7', text: 'Other seed fell among thorns, which grew up and choked the seedlings.' },
    { id: 'matthew-27-29', ref: 'Matthew 27:29', text: 'And they twisted together a crown of thorns and set it on His head. They put a staff in His right hand, knelt down before Him, and mocked Him, saying, “Hail, King of the Jews!”' },
    { id: 'mark-4-18', ref: 'Mark 4:18', text: 'Others are like the seeds sown among the thorns. They hear the word,' },
    { id: 'luke-8-14', ref: 'Luke 8:14', text: 'The seeds that fell among the thorns are those who hear, but as they go on their way, they are choked by the worries, riches, and pleasures of this life, and their fruit does not mature.' }
] as const;

/** After the change, spoken once when walking by bloomed thorns. */
export const EZEKIEL_28_24 = {
    id: 'ezekiel-28-24',
    ref: 'Ezekiel 28:24',
    text: 'For the people of Israel will no longer face a pricking brier or a painful thorn from all around them who treat them with contempt. Then they will know that I am the Lord GOD.'
} as const;

export const THORN_VERSES = [...THORN_SNARE_VERSES, EZEKIEL_28_24] as const;

export type ThornVerseId = typeof THORN_VERSES[number]['id'];

export function thornVerseLine (id: string): string {
    const verse = THORN_VERSES.find((item) => item.id === id);
    return verse ? scriptureLine(verse) : '';
}

export function nextThornSnareVerseId (found: string[]): string | null {
    const taken = new Set(found);
    return THORN_SNARE_VERSES.find((item) => !taken.has(item.id))?.id ?? null;
}

export function foundThornVerses (ids: string[]): { ref: string; text: string }[] {
    const taken = new Set(ids);
    return THORN_VERSES.filter((item) => taken.has(item.id)).map((item) => ({
        ref: item.ref,
        text: item.text
    }));
}
