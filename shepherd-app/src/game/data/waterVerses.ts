import { scriptureLine } from './scripture';

/** Wayside drinks — not the Psalm 23:2b story beat. */
export const WATER_VERSES = [
    { id: 'john-4-14', ref: 'John 4:14', text: 'Whoever drinks the water I give him will never thirst.' },
    { id: 'deuteronomy-8-15', ref: 'Deuteronomy 8:15', text: 'He brought you water out of the flinty rock.' },
    { id: 'nehemiah-9-15a', ref: 'Nehemiah 9:15a', text: 'You gave them bread from heaven for their hunger, and brought them water from the rock for their thirst.' },
    { id: 'psalm-42-2', ref: 'Psalm 42:2', text: 'My soul thirsts for God, for the living God.' },
    { id: 'psalm-107-9', ref: 'Psalm 107:9', text: 'For He satisfies the thirsty and fills the hungry with good things.' },
    { id: 'psalm-107-33', ref: 'Psalm 107:33', text: 'He turns rivers into a desert, springs of water into thirsty ground.' },
    { id: 'isaiah-35-7', ref: 'Isaiah 35:7', text: 'The burning sand will become a pool, the thirsty ground bubbling springs.' },
    { id: 'isaiah-44-3', ref: 'Isaiah 44:3', text: 'For I will pour water on the thirsty land, and streams on the dry ground.' },
    { id: 'isaiah-48-21', ref: 'Isaiah 48:21', text: 'He made water flow for them from the rock; He split the rock, and water gushed out.' },
    { id: 'isaiah-49-10', ref: 'Isaiah 49:10', text: 'They will not hunger or thirst, nor will the scorching heat or sun strike them.' },
    { id: 'isaiah-55-1', ref: 'Isaiah 55:1', text: 'Come, all you who are thirsty, come to the waters.' },
    { id: 'jeremiah-31-25', ref: 'Jeremiah 31:25', text: 'For I will refresh the weary soul and replenish all who are weak.' },
    { id: 'matthew-5-6', ref: 'Matthew 5:6', text: 'Blessed are those who hunger and thirst for righteousness, for they will be filled.' },
    { id: 'john-4-13', ref: 'John 4:13', text: 'Everyone who drinks this water will be thirsty again.' },
    { id: 'john-6-35', ref: 'John 6:35', text: 'I am the bread of life. Whoever comes to Me will never hunger, and whoever believes in Me will never thirst.' },
    { id: 'john-7-37', ref: 'John 7:37', text: 'If anyone is thirsty, let him come to Me and drink.' },
    { id: 'revelation-7-16', ref: 'Revelation 7:16', text: 'Never again will they hunger, and never will they thirst.' },
    { id: 'revelation-21-6b', ref: 'Revelation 21:6b', text: 'To the thirsty I will give freely from the spring of the water of life.' },
    { id: 'revelation-22-1', ref: 'Revelation 22:1', text: 'Then the angel showed me a river of the water of life, as clear as crystal.' },
    { id: 'revelation-22-17', ref: 'Revelation 22:17', text: 'Let the one who is thirsty come, and the one who desires the water of life drink freely.' }
] as const;

export type WaterVerseId = typeof WATER_VERSES[number]['id'];

export function waterVerseLine (id: string): string {
    const verse = WATER_VERSES.find((item) => item.id === id);
    return verse ? scriptureLine(verse) : '';
}

export function nextWaterVerseId (found: string[]): string | null {
    const taken = new Set(found);
    return WATER_VERSES.find((item) => !taken.has(item.id))?.id ?? null;
}

export function foundWaterVerses (ids: string[]): { ref: string; text: string }[] {
    const taken = new Set(ids);
    return WATER_VERSES.filter((item) => taken.has(item.id)).map((item) => ({
        ref: item.ref,
        text: item.text
    }));
}
