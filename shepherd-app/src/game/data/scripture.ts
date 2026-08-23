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
    }
} as const;

export function john10Line (verse: 2 | 9): string {
    const line = JOHN_10[verse];
    return `${line.text} — ${line.ref}`;
}

export const CORINTHIANS_15_51 = {
    ref: '1 Corinthians 15:51',
    text: 'Listen, I tell you a mystery: We will not all sleep, but we will all be changed.'
} as const;

export function corinthians15Line (): string {
    return `${CORINTHIANS_15_51.text} — ${CORINTHIANS_15_51.ref}`;
}
