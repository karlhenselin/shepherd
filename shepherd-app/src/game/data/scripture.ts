/** Berean Standard Bible. */
export const GENESIS_1_1 = {
    ref: 'Genesis 1:1',
    text: 'In the beginning God created the heavens and the earth.'
} as const;

export const PSALM_23 = {
    1: {
        ref: 'Psalm 23:1',
        text: 'The LORD is my shepherd; I shall not want.'
    },
    2: {
        ref: 'Psalm 23:2',
        text: 'He makes me lie down in green pastures; He leads me beside quiet waters.'
    },
    3: {
        ref: 'Psalm 23:3',
        text: 'He restores my soul; He guides me in the paths of righteousness for the sake of His name.'
    }
} as const;

export function psalm23Line (verse: 1 | 2 | 3): string {
    const line = PSALM_23[verse];
    return `${line.text} — ${line.ref}`;
}
