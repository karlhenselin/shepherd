import {
    BIBLE_GEMS,
    CORINTHIANS_15_51,
    ISAIAH_11_6,
    ISAIAH_26_2,
    ISAIAH_53_6,
    JOHN_10,
    JOHN_14_6,
    PSALM_23,
    REVELATION_21_2,
    bibleGemLine,
    corinthians15Line,
    isaiah11LionLine,
    isaiah11WolfLine,
    isaiah26Line,
    isaiah53Line,
    john10Line,
    john14Line,
    psalm23Comfort,
    psalm23FiveTable,
    psalm23Half,
    revelation21CityLine,
    scriptureLine
} from '../data/scripture';
import { TREE_VERSES, treeVerseLine } from '../data/treeVerses';
import { WATER_VERSES, waterVerseLine } from '../data/waterVerses';

const SHEEP_NAMES = ['Clover', 'Snowball', 'Milo', 'Biscuit', 'Sarah', 'Leo'] as const;

const STATIC_LINES = [
    'In the beginning',
    'God',
    'created the heavens and the earth',
    'Find your sheep.',
    'Another sheep is missing.',
    'A sheep is missing.',
    'Get closer.',
    'The sheep are thirsty.',
    'The sheep are hungry.',
    'Enlarge the flock.',
    'Enter the city.',
    'The flock is home.',
    'I need my staff.',
    'Guide the flock to the pen.',
    'You reached the pen.',
    'Night is falling.',
    'You found a Bible gem.',
    'Hey bud.',
    'Good little sheepy.',
    'What a soft little sheep.',
    'Easy now.',
    'Sweet sheep.',
    'Such a good sheep.',
    'Easy, little one.',
    'There, little lamb.',
    'Sweet baby.',
    'Good little lamb.',
    'What a little lamb.',
    'Come here, little one.',
    'Easy, Biscuit.',
    'Gentle now, Biscuit.',
    'Tiny Biscuit.',
    'I\'ll call you Leo.',
    'I\'ll name you Sarah!',
    'What a mane.',
    'Good lion.',
    'Easy, big guy.',
    'Gentle now, king.',
    'Such a good lion.',
    'Hey, Leo.',
    'Easy, Leo.',
    'Come here, Leo.',
    'Good girl.',
    'Good wolf.',
    'Not so scary now.',
    'What a soft wolf.',
    'Hey, Sarah.',
    'Easy, Sarah.',
    'Come here, Sarah.',
    'Sweet Sarah.'
] as const;

const NAMED_TEMPLATES: Array<(name: string) => string> = [
    (name) => `${name}! I found you!`,
    (name) => `${name} is hurt.`,
    (name) => `${name} is nervous. Stay together.`,
    (name) => `${name} is eating.`,
    (name) => `${name} is drinking.`,
    (name) => `${name} is hungry.`,
    (name) => `Help ${name}!`,
    (name) => `You free ${name} from the thorns.`,
    (name) => `You bandage ${name}.`,
    (name) => `Bandage ${name}.`,
    (name) => `${name} wandered off.`,
    (name) => `Got you, ${name}!`,
    (name) => `Hey ${name}.`,
    (name) => `Hey ${name}!`,
    (name) => `There you are, ${name}.`,
    (name) => `Good ${name}.`,
    (name) => `Love you, ${name}.`
];

/** Every string `speakCue` may receive, including four-name expansions. */
export function allSpokenLines (): string[] {
    const lines = new Set<string>(STATIC_LINES);

    for (const name of SHEEP_NAMES) {
        for (const template of NAMED_TEMPLATES) {
            lines.add(template(name));
        }
    }

    lines.add(psalm23Half(1, 'a'));
    lines.add(psalm23Half(1, 'b'));
    lines.add(psalm23Half(2, 'a'));
    lines.add(psalm23Half(2, 'b'));
    lines.add(psalm23Half(3, 'a'));
    lines.add(psalm23Half(3, 'b'));
    lines.add(psalm23Half(4, 'a'));
    lines.add(psalm23Half(4, 'b'));
    lines.add(psalm23Comfort());
    lines.add(psalm23FiveTable());
    lines.add(isaiah53Line());
    lines.add(isaiah11WolfLine());
    lines.add(isaiah11LionLine());
    lines.add(isaiah26Line());
    lines.add(revelation21CityLine());
    lines.add(scriptureLine(ISAIAH_11_6));
    lines.add(scriptureLine(ISAIAH_26_2));
    lines.add(scriptureLine(REVELATION_21_2));
    lines.add(john10Line(2));
    lines.add(john10Line(9));
    lines.add(john14Line());
    lines.add(corinthians15Line());
    lines.add(scriptureLine(PSALM_23[5].table));
    lines.add(scriptureLine(JOHN_10[2]));
    lines.add(scriptureLine(JOHN_10[9]));
    lines.add(scriptureLine(JOHN_14_6));
    lines.add(scriptureLine(CORINTHIANS_15_51));
    lines.add(scriptureLine(ISAIAH_53_6));

    for (const gem of BIBLE_GEMS) {
        lines.add(bibleGemLine(gem.id));
        lines.add(scriptureLine(gem));
    }

    for (const verse of WATER_VERSES) {
        lines.add(waterVerseLine(verse.id));
        lines.add(scriptureLine(verse));
    }

    for (const verse of TREE_VERSES) {
        lines.add(treeVerseLine(verse.id));
        lines.add(scriptureLine(verse));
    }

    return [...lines].filter((line) => line.length > 0);
}
