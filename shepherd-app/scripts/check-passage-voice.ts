import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIBLE_GEMS, unlockedStoryPassages, scriptureLine } from '../src/game/data/scripture.ts';
import { WATER_VERSES } from '../src/game/data/waterVerses.ts';
import { TREE_VERSES } from '../src/game/data/treeVerses.ts';
import { THORN_VERSES } from '../src/game/data/thornVerses.ts';
import { MINIGAME_VERSE_POOL } from '../src/game/data/minigameVerses.ts';
import { voiceClipId } from '../src/game/audio/speechText.ts';
import { allSpokenLines } from '../src/game/audio/spokenLines.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const voiceDir = join(root, 'public', 'assets', 'voice');

function check (passage: { ref: string; text: string }) {
    const line = scriptureLine(passage);
    const id = voiceClipId(line);

    return { ref: passage.ref, id, line, ok: existsSync(join(voiceDir, `${id}.mp3`)) };
}

const story = unlockedStoryPassages({
    heardPsalm1: true,
    heardPsalm2: true,
    heardPsalm2b: true,
    heardPsalm3: true,
    heardPsalm3b: true,
    heardPsalm4a: true,
    heardPsalm4b: true,
    heardPsalm4c: true,
    heardPsalm5: true,
    heardPsalm6: true,
    heardJohn102: true,
    heardJohn109: true,
    heardCorinthians: true,
    heardCity: true,
    heardIsaiah6525: true,
    foundNames: ['Sarah', 'Leo']
});

const all: Array<{ ref: string; text: string; src: string }> = [
    ...MINIGAME_VERSE_POOL.map((p) => ({ ...p, src: 'hud' })),
    ...story.map((p) => ({ ...p, src: 'story' })),
    ...BIBLE_GEMS.map((p) => ({ ref: p.ref, text: p.text, src: 'gem' })),
    ...WATER_VERSES.map((p) => ({ ref: p.ref, text: p.text, src: 'water' })),
    ...TREE_VERSES.map((p) => ({ ref: p.ref, text: p.text, src: 'tree' })),
    ...THORN_VERSES.map((p) => ({ ref: p.ref, text: p.text, src: 'thorn' }))
];

const seen = new Set<string>();
const missing: Array<{ src: string; ref: string; id: string; line: string }> = [];
let withVoice = 0;

for (const p of all) {
    const key = scriptureLine(p);

    if (seen.has(key)) {
        continue;
    }

    seen.add(key);
    const r = check(p);

    if (r.ok) {
        withVoice += 1;
    }
    else {
        missing.push({ src: p.src, ref: r.ref, id: r.id, line: r.line });
    }
}

const spoken = new Set(allSpokenLines());
const notInCatalog = [...seen].filter((line) => !spoken.has(line));

const report = {
    unique: seen.size,
    withVoice,
    missing,
    notInCatalog
};

writeFileSync(join(root, 'voice-check-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
