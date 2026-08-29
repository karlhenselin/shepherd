/** Berean Standard Bible. */
export const GENESIS_1_1 = {
    ref: 'Genesis 1:1',
    text: 'In the beginning God created the heavens and the earth.'
} as const;

export const PSALM_23 = {
    1: {
        ref: 'Psalm 23:1',
        text: 'The LORD is my shepherd; I shall not want.',
        a: { ref: 'Psalm 23:1a', text: 'The LORD is my shepherd;' },
        b: { ref: 'Psalm 23:1b', text: 'I shall not want.' }
    },
    2: {
        ref: 'Psalm 23:2',
        text: 'He makes me lie down in green pastures; He leads me beside quiet waters.',
        a: { ref: 'Psalm 23:2a', text: 'He makes me lie down in green pastures;' },
        b: { ref: 'Psalm 23:2b', text: 'He leads me beside quiet waters.' }
    },
    3: {
        ref: 'Psalm 23:3',
        text: 'He restores my soul; He guides me in the paths of righteousness for the sake of His name.',
        a: { ref: 'Psalm 23:3a', text: 'He restores my soul;' },
        b: { ref: 'Psalm 23:3b', text: 'He guides me in the paths of righteousness for the sake of His name.' }
    },
    4: {
        ref: 'Psalm 23:4',
        text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me.',
        a: { ref: 'Psalm 23:4a', text: 'Even though I walk through the valley of the shadow of death,' },
        b: { ref: 'Psalm 23:4b', text: 'I will fear no evil, for You are with me;' },
        c: { ref: 'Psalm 23:4c', text: 'Your rod and Your staff, they comfort me.' }
    },
    5: {
        ref: 'Psalm 23:5',
        text: 'You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows.',
        a: { ref: 'Psalm 23:5a', text: 'You prepare a table before me' },
        b: { ref: 'Psalm 23:5b', text: 'in the presence of my enemies.' },
        c: { ref: 'Psalm 23:5c', text: 'You anoint my head with oil; my cup overflows.' },
        table: {
            ref: 'Psalm 23:5',
            text: 'You prepare a table before me in the presence of my enemies.'
        }
    },
    6: {
        ref: 'Psalm 23:6',
        text: 'Surely goodness and mercy will follow me all the days of my life, and I will dwell in the house of the LORD forever.',
        a: { ref: 'Psalm 23:6a', text: 'Surely goodness and mercy will follow me all the days of my life,' },
        b: { ref: 'Psalm 23:6b', text: 'and I will dwell in the house of the LORD forever.' }
    }
} as const;

export function psalm23Line (verse: 1 | 2 | 3 | 4): string {
    const line = PSALM_23[verse];
    return `${line.text} — ${line.ref}`;
}

export function psalm23Half (verse: 1 | 2 | 3 | 4, half: 'a' | 'b'): string {
    const line = PSALM_23[verse][half];
    return `${line.text} — ${line.ref}`;
}

export function psalm23FiveTable (): string {
    const line = PSALM_23[5].table;
    return `${line.text} — ${line.ref}`;
}

export function psalm23Six (part: 'a' | 'b'): string {
    const line = PSALM_23[6][part];
    return `${line.text} — ${line.ref}`;
}

export const ISAIAH_53_6 = {
    ref: 'Isaiah 53:6',
    text: 'We all like sheep have gone astray, each one has turned to his own way;'
} as const;

export function psalm23Comfort (): string {
    const line = PSALM_23[4].c;
    return `${line.text} — ${line.ref}`;
}

export function isaiah53Line (): string {
    return `${ISAIAH_53_6.text} — ${ISAIAH_53_6.ref}`;
}

export const JOHN_10 = {
    2: {
        ref: 'John 10:2',
        text: 'The one who enters by the gate is the shepherd of the sheep.'
    },
    9: {
        ref: 'John 10:9',
        text: 'I am the gate.'
    },
    11: {
        ref: 'John 10:11',
        text: 'I am the good shepherd. The good shepherd lays down His life for the sheep.'
    },
    14: {
        ref: 'John 10:14',
        text: 'I am the good shepherd. I know My sheep and My sheep know Me.'
    }
} as const;

export function john10Line (verse: 2 | 9 | 11): string {
    const line = JOHN_10[verse];
    return `${line.text} — ${line.ref}`;
}

export const JOHN_14_6 = {
    ref: 'John 14:6',
    text: 'I am the way and the truth and the life.'
} as const;

export function john14Line (): string {
    return `${JOHN_14_6.text} — ${JOHN_14_6.ref}`;
}

export function scriptureLine (passage: { ref: string; text: string }): string {
    return `${passage.text} — ${passage.ref}`;
}

export const CORINTHIANS_15_51 = {
    ref: '1 Corinthians 15:51',
    text: 'Listen, I tell you a mystery: We will not all sleep, but we will all be changed.'
} as const;

export function corinthians15Line (): string {
    return `${CORINTHIANS_15_51.text}\n— ${CORINTHIANS_15_51.ref}`;
}

export const ISAIAH_11_6 = {
    ref: 'Isaiah 11:6',
    text: 'The wolf will live with the lamb, and the leopard will lie down with the goat; the calf and young lion and fattened ox will be together, and a little child will lead them.',
    wolf: {
        ref: 'Isaiah 11:6',
        text: 'The wolf will live with the lamb.'
    },
    lion: {
        ref: 'Isaiah 11:6',
        text: 'The calf and the young lion will lie down together, and a little child will lead them.'
    }
} as const;

export function isaiah11WolfLine (): string {
    return `${ISAIAH_11_6.wolf.text} — ${ISAIAH_11_6.wolf.ref}`;
}

export function isaiah11LionLine (): string {
    return `${ISAIAH_11_6.lion.text} — ${ISAIAH_11_6.lion.ref}`;
}

export const ISAIAH_26_2 = {
    ref: 'Isaiah 26:2',
    text: 'Open the gates that the righteous nation may enter, the nation that keeps faith.'
} as const;

export function isaiah26Line (): string {
    return `${ISAIAH_26_2.text} — ${ISAIAH_26_2.ref}`;
}

export const REVELATION_21_2 = {
    ref: 'Revelation 21:2',
    text: 'I saw the Holy City, the new Jerusalem, coming down out of heaven from God.'
} as const;

export function revelation21CityLine (): string {
    return `${REVELATION_21_2.text} — ${REVELATION_21_2.ref}`;
}

/** Findable Bible gems from `Bible gems.md`. */
export const BIBLE_GEMS = [
    { id: 'john-3-16', ref: 'John 3:16', text: 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.' },
    { id: 'ephesians-2-8-9', ref: 'Ephesians 2:8-9', text: 'For by grace you have been saved through faith…' },
    { id: 'romans-3-23', ref: 'Romans 3:23', text: 'For all have sinned and fall short of the glory of God.' },
    { id: 'romans-6-23', ref: 'Romans 6:23', text: 'For the wages of sin is death, but the gift of God is eternal life…' },
    { id: 'romans-10-9', ref: 'Romans 10:9', text: 'If you confess with your mouth, "Jesus is Lord," and believe in your heart that God raised Him from the dead, you will be saved.' },
    { id: 'acts-4-12', ref: 'Acts 4:12', text: 'There is salvation in no one else, for there is no other name under heaven given to men by which we must be saved.' },
    { id: 'john-14-6', ref: 'John 14:6', text: 'I am the way, and the truth, and the life…' },
    { id: '2-corinthians-5-17', ref: '2 Corinthians 5:17', text: 'If anyone is in Christ, he is a new creation…' },
    { id: '1-john-4-8', ref: '1 John 4:8', text: 'God is love.' },
    { id: '1-john-4-19', ref: '1 John 4:19', text: 'We love because he first loved us.' },
    { id: 'romans-5-8', ref: 'Romans 5:8', text: 'God shows his love for us in that while we were still sinners, Christ died for us.' },
    { id: 'psalm-23-1', ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' },
    { id: 'psalm-46-10', ref: 'Psalm 46:10', text: 'Be still, and know that I am God.' },
    { id: 'numbers-6-24-26', ref: 'Numbers 6:24-26', text: 'The LORD bless you and keep you…' },
    { id: 'jeremiah-29-11', ref: 'Jeremiah 29:11', text: 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, to give you a future and a hope.' },
    { id: 'psalm-103-12', ref: 'Psalm 103:12', text: 'As far as the east is from the west, so far does he remove our transgressions…' },
    { id: 'philippians-4-6-7', ref: 'Philippians 4:6-7', text: 'Do not be anxious about anything…' },
    { id: 'matthew-11-28', ref: 'Matthew 11:28', text: 'Come to me, all who labor and are heavy laden…' },
    { id: 'isaiah-41-10', ref: 'Isaiah 41:10', text: 'Fear not, for I am with you…' },
    { id: 'joshua-1-9', ref: 'Joshua 1:9', text: 'Be strong and courageous. Do not be frightened…' },
    { id: 'psalm-34-18', ref: 'Psalm 34:18', text: 'The LORD is near to the brokenhearted…' },
    { id: '1-peter-5-7', ref: '1 Peter 5:7', text: 'Cast all your anxieties on him, because he cares for you.' },
    { id: 'psalm-55-22', ref: 'Psalm 55:22', text: 'Cast your burden on the LORD, and he will sustain you.' },
    { id: 'psalm-91-1-2', ref: 'Psalm 91:1-2', text: 'He who dwells in the shelter of the Most High will abide in the shadow of the Almighty. I will say to the LORD, "You are my refuge and my fortress, my God, in whom I trust."' },
    { id: 'philippians-4-13', ref: 'Philippians 4:13', text: 'I can do all things through him who strengthens me.' },
    { id: 'isaiah-40-31', ref: 'Isaiah 40:31', text: 'They who wait for the LORD shall renew their strength…' },
    { id: 'proverbs-3-5-6', ref: 'Proverbs 3:5-6', text: 'Trust in the LORD with all your heart…' },
    { id: 'romans-8-28', ref: 'Romans 8:28', text: 'For those who love God all things work together for good…' },
    { id: 'romans-8-31', ref: 'Romans 8:31', text: 'If God is for us, who can be against us?' },
    { id: 'psalm-27-1', ref: 'Psalm 27:1', text: 'The LORD is my light and my salvation; whom shall I fear?' },
    { id: '2-timothy-1-7', ref: '2 Timothy 1:7', text: 'God gave us a spirit not of fear but of power and love and self-control.' },
    { id: 'galatians-6-9', ref: 'Galatians 6:9', text: 'Let us not grow weary of doing good…' },
    { id: 'micah-6-8', ref: 'Micah 6:8', text: 'Do justice, love kindness, and walk humbly with your God.' },
    { id: 'matthew-22-37-39', ref: 'Matthew 22:37-39', text: 'You shall love the Lord your God… You shall love your neighbor as yourself.' },
    { id: 'matthew-5-14', ref: 'Matthew 5:14', text: 'You are the light of the world.' },
    { id: 'matthew-6-33', ref: 'Matthew 6:33', text: 'Seek first the kingdom of God and his righteousness…' },
    { id: 'colossians-3-23', ref: 'Colossians 3:23', text: 'Whatever you do, work heartily, as for the Lord…' },
    { id: 'proverbs-16-3', ref: 'Proverbs 16:3', text: 'Commit your work to the LORD, and your plans will be established.' },
    { id: 'psalm-119-105', ref: 'Psalm 119:105', text: 'Your word is a lamp to my feet and a light to my path.' },
    { id: 'james-1-5', ref: 'James 1:5', text: 'If any of you lacks wisdom, let him ask God…' },
    { id: 'john-11-25-26', ref: 'John 11:25-26', text: 'I am the resurrection and the life…' },
    { id: 'romans-8-38-39', ref: 'Romans 8:38-39', text: 'Nothing… will be able to separate us from the love of God…' },
    { id: 'revelation-21-4', ref: 'Revelation 21:4', text: 'He will wipe away every tear from their eyes…' },
    { id: 'philippians-1-6', ref: 'Philippians 1:6', text: 'He who began a good work in you will bring it to completion…' },
    { id: 'psalm-30-5', ref: 'Psalm 30:5', text: 'Weeping may tarry for the night, but joy comes with the morning.' },
    { id: 'matthew-28-19-20', ref: 'Matthew 28:19-20', text: 'Go therefore and make disciples of all nations…' },
    { id: 'luke-9-23', ref: 'Luke 9:23', text: 'If anyone would come after me, let him deny himself and take up his cross daily and follow me.' },
    { id: 'galatians-2-20', ref: 'Galatians 2:20', text: 'It is no longer I who live, but Christ who lives in me…' },
    { id: 'philippians-4-4', ref: 'Philippians 4:4', text: 'Rejoice in the Lord always; again I will say, rejoice.' },
    { id: 'psalm-37-4', ref: 'Psalm 37:4', text: 'Delight yourself in the LORD, and he will give you the desires of your heart.' }
] as const;

export type BibleGemId = typeof BIBLE_GEMS[number]['id'];

export function bibleGemLine (id: BibleGemId): string {
    const gem = BIBLE_GEMS.find((item) => item.id === id);

    if (!gem) {
        return '';
    }

    return `${gem.text} — ${gem.ref}`;
}

/** Story scripture spoken in play (not findable Bible gems). */
export const STORY_PASSAGES = [
    GENESIS_1_1,
    PSALM_23[1].a,
    PSALM_23[1].b,
    PSALM_23[2].a,
    ISAIAH_53_6,
    PSALM_23[2].b,
    PSALM_23[3].a,
    PSALM_23[3].b,
    PSALM_23[4].a,
    PSALM_23[4].b,
    PSALM_23[4].c,
    PSALM_23[5].table,
    PSALM_23[6].a,
    PSALM_23[6].b,
    JOHN_10[2],
    JOHN_14_6,
    JOHN_10[9],
    CORINTHIANS_15_51,
    ISAIAH_26_2,
    REVELATION_21_2
] as const;

export type StoryPassageFlags = {
    heardPsalm1?: boolean;
    heardPsalm2?: boolean;
    heardPsalm2b?: boolean;
    heardPsalm3?: boolean;
    heardPsalm3b?: boolean;
    heardPsalm4a?: boolean;
    heardPsalm4b?: boolean;
    heardPsalm4c?: boolean;
    heardPsalm5?: boolean;
    heardPsalm6?: boolean;
    heardJohn102?: boolean;
    heardJohn109?: boolean;
    heardCorinthians?: boolean;
    heardCity?: boolean;
    foundNames?: string[];
};

export function unlockedStoryPassages (flags: StoryPassageFlags): { ref: string; text: string }[] {
    const unlocked: { ref: string; text: string }[] = [GENESIS_1_1];

    if (flags.heardPsalm1) {
        unlocked.push(PSALM_23[1].a, PSALM_23[1].b);
    }

    if (flags.heardPsalm2) {
        unlocked.push(PSALM_23[2].a, ISAIAH_53_6);
    }

    if (flags.heardPsalm2b) {
        unlocked.push(PSALM_23[2].b);
    }

    if (flags.heardPsalm3) {
        unlocked.push(PSALM_23[3].a);
    }

    if (flags.heardPsalm3b) {
        unlocked.push(PSALM_23[3].b);
    }

    if (flags.heardPsalm4a) {
        unlocked.push(PSALM_23[4].a);
    }

    if (flags.heardPsalm4b) {
        unlocked.push(PSALM_23[4].b);
    }

    if (flags.heardPsalm4c) {
        unlocked.push(PSALM_23[4].c);
    }

    if (flags.heardPsalm5) {
        unlocked.push(PSALM_23[5].table);
    }

    if (flags.heardPsalm6) {
        unlocked.push(PSALM_23[6].a, PSALM_23[6].b);
    }

    if (flags.heardJohn102) {
        unlocked.push(JOHN_10[2], JOHN_14_6);
    }

    if (flags.heardJohn109) {
        unlocked.push(JOHN_10[9]);
    }

    if (flags.heardCorinthians) {
        unlocked.push(CORINTHIANS_15_51);
    }

    if (flags.heardCity) {
        unlocked.push(ISAIAH_26_2, REVELATION_21_2);
    }

    if (flags.foundNames?.some((name) => name === 'Wolf' || name === 'Sarah' || name === 'Leo' || name === 'Lion')) {
        unlocked.push(ISAIAH_11_6);
    }

    return unlocked;
}

export function foundBibleGems (ids: string[]): { ref: string; text: string }[] {
    const taken = new Set(ids);
    return BIBLE_GEMS.filter((gem) => taken.has(gem.id)).map((gem) => ({
        ref: gem.ref,
        text: gem.text
    }));
}
