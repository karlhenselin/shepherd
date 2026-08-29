import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { allSpokenLines } from '../src/game/audio/spokenLines.ts';
import { forSpeech, voiceClipId } from '../src/game/audio/speechText.ts';

const VOICE = 'en-US-AndrewNeural';
const RATE = '-8%';
const CONCURRENCY = 6;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'assets', 'voice');

type Job = { id: string; spoken: string; path: string };

async function main (): Promise<void> {
    await mkdir(outDir, { recursive: true });

    const jobs: Job[] = [];
    const seen = new Set<string>();

    for (const line of allSpokenLines()) {
        const id = voiceClipId(line);
        const spoken = forSpeech(line);

        if (seen.has(id)) {
            continue;
        }

        seen.add(id);
        jobs.push({ id, spoken, path: join(outDir, `${id}.mp3`) });
    }

    const pending = jobs.filter((job) => !existsSync(job.path));

    console.log(`${jobs.length} lines, ${pending.length} to generate, ${jobs.length - pending.length} already on disk.`);

    let done = 0;
    let failed = 0;
    const queue = [...pending];

    async function worker (): Promise<void> {
        while (queue.length > 0) {
            const job = queue.shift();

            if (!job) {
                return;
            }

            try {
                await synthesize(job.spoken, job.path);
                done += 1;
                console.log(`[${done}/${pending.length}] ${job.id}`);
            }
            catch (error) {
                failed += 1;
                console.error(`Failed ${job.id}:`, error);
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const manifest = Object.fromEntries(jobs.map((job) => [job.id, job.spoken]));
    await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`Done. Generated ${done}, failed ${failed}, total clips ${jobs.length}.`);
}

function synthesize (text: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            'python',
            ['-m', 'edge_tts', '-v', VOICE, '--rate', RATE, '-t', text, '--write-media', dest],
            { stdio: ['ignore', 'ignore', 'pipe'] }
        );
        let err = '';
        child.stderr.on('data', (chunk) => {
            err += String(chunk);
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0 && existsSync(dest)) {
                resolve();
                return;
            }

            reject(new Error(err.trim() || `edge-tts exited ${code}`));
        });
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
