import { Scene } from 'phaser';
import { Sheep } from '../entities/Sheep';
import { isDocumentAudioLive, isSoundOn } from './soundPref';

export const SHEEP_BLEAT_FILES: ReadonlyArray<{ key: string; file: string }> = [
    { key: 'sheep-bleat-1', file: 'audio/sheep/210511__yuval__sheep-bleat-outdoors.mp3' },
    { key: 'sheep-bleat-2', file: 'audio/sheep/sheep2.mp3' },
    { key: 'sheep-bleat-3', file: 'audio/sheep/sheep3.mp3' },
    { key: 'sheep-bleat-4', file: 'audio/sheep/sheep5.mp3' },
    { key: 'sheep-baa-loud-1', file: 'audio/sheep/loud baah.mp3' },
    { key: 'sheep-baa-loud-2', file: 'audio/sheep/loud-sheep-bah.mp3' }
];

const QUIET_KEYS = ['sheep-bleat-1', 'sheep-bleat-2', 'sheep-bleat-3', 'sheep-bleat-4'];
const LOUD_KEYS = ['sheep-baa-loud-1', 'sheep-baa-loud-2'];
const CALM_GAP_MS = 9000;
const HEAR_HURT = 2600;
const HEAR_LOST = 1600;
const HEAR_CALM = 980;

const nextBleatAt = new WeakMap<Sheep, number>();
let lastCalmBleatAt = 0;
let audioHeld = false;

export function loadSheepSounds (load: Phaser.Loader.LoaderPlugin): void {
    for (const clip of SHEEP_BLEAT_FILES) {
        load.audio(clip.key, encodeURI(clip.file));
    }
}

export function tickSheepSounds (scene: Scene, flock: Sheep[], listener: { x: number; y: number }): void {
    const now = scene.time.now;

    if (!canPlayBleats(scene)) {
        audioHeld = true;
        return;
    }

    if (audioHeld) {
        audioHeld = false;
        postponeBleats(flock, now);
        return;
    }

    for (const sheep of flock) {
        maybeBleat(scene, sheep, listener, now);
    }
}

export function holdSheepSounds (scene: Scene): void {
    audioHeld = true;

    for (const clip of SHEEP_BLEAT_FILES) {
        scene.sound.stopByKey(clip.key);
    }
}

export function stopSheepSounds (scene: Scene): void {
    holdSheepSounds(scene);
    lastCalmBleatAt = 0;
}

function canPlayBleats (scene: Scene): boolean {
    if (!isDocumentAudioLive() || !scene.sys.isActive() || scene.sys.isPaused()) {
        return false;
    }

    if (scene.sound.locked || scene.sound.gameLostFocus) {
        return false;
    }

    const sound = scene.sound as { context?: AudioContext };

    if (sound.context instanceof AudioContext && sound.context.state !== 'running') {
        return false;
    }

    return true;
}

function postponeBleats (flock: Sheep[], now: number): void {
    lastCalmBleatAt = now;

    for (const sheep of flock) {
        nextBleatAt.set(sheep, now + delayFor(sheep));
    }
}

function maybeBleat (scene: Scene, sheep: Sheep, listener: { x: number; y: number }, now: number): void {
    if (!shouldBleat(sheep)) {
        nextBleatAt.set(sheep, now + delayFor(sheep));
        return;
    }

    const due = nextBleatAt.get(sheep);

    if (due === undefined) {
        nextBleatAt.set(sheep, now + firstDelayFor(sheep));
        return;
    }

    if (now < due) {
        return;
    }

    if (!sheep.hurt && now - lastCalmBleatAt < CALM_GAP_MS) {
        nextBleatAt.set(sheep, now + 1400 + Math.random() * 2200);
        return;
    }

    if (!playBleat(scene, sheep, listener)) {
        nextBleatAt.set(sheep, now + 800);
        return;
    }

    if (!sheep.hurt) {
        lastCalmBleatAt = now;
    }

    nextBleatAt.set(sheep, now + delayFor(sheep));
}

function shouldBleat (sheep: Sheep): boolean {
    return sheep.mood !== 'penned' && sheep.mood !== 'eating' && sheep.mood !== 'drinking';
}

function firstDelayFor (sheep: Sheep): number {
    if (sheep.hurt) {
        return 280 + Math.random() * 720;
    }

    if (sheep.mood === 'waiting') {
        return 3500 + Math.random() * 5500;
    }

    return 8000 + Math.random() * 14000;
}

function delayFor (sheep: Sheep): number {
    if (sheep.hurt) {
        return 2200 + Math.random() * 2300;
    }

    if (sheep.mood === 'waiting') {
        return 10000 + Math.random() * 9000;
    }

    return 22000 + Math.random() * 18000;
}

function playBleat (scene: Scene, sheep: Sheep, listener: { x: number; y: number }): boolean {
    const settings = bleatSettings(scene, sheep, listener);

    if ((settings.volume ?? 0) < 0.012) {
        return false;
    }

    if (!isSoundOn()) {
        return true;
    }

    const key = pickLoaded(scene, sheep.hurt ? LOUD_KEYS : QUIET_KEYS);

    if (!key) {
        return false;
    }

    return scene.sound.play(key, settings);
}

function bleatSettings (scene: Scene, sheep: Sheep, listener: { x: number; y: number }): Phaser.Types.Sound.SoundConfig {
    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const pan = stereoPan(scene, sheep.sprite.x);

    if (sheep.hurt) {
        const falloff = 1 - clamp(dist / HEAR_HURT, 0, 1);
        const high = Math.random() < 0.55;

        return {
            volume: lerp(0.22, 0.78, falloff) * (0.9 + Math.random() * 0.2),
            pan,
            rate: high ? rand(1.03, 1.16) : rand(0.86, 0.97),
            detune: high ? rand(140, 420) : rand(-460, -90)
        };
    }

    const lost = sheep.mood === 'waiting';
    const hear = lost ? HEAR_LOST : HEAR_CALM;
    const falloff = 1 - clamp(dist / hear, 0, 1);
    const near = lost ? 0.07 : 0.05;
    const far = lost ? 0.012 : 0.008;

    return {
        volume: lerp(far, near, falloff) * (0.75 + Math.random() * 0.35),
        pan: clamp(pan + rand(-0.08, 0.08), -1, 1),
        rate: rand(0.96, 1.04),
        detune: rand(-40, 40)
    };
}

function stereoPan (scene: Scene, x: number): number {
    const cam = scene.cameras.main;
    const mid = cam.worldView.centerX;
    const half = Math.max(cam.worldView.width / 2, 1);

    return clamp((x - mid) / half, -1, 1);
}

function pickLoaded (scene: Scene, keys: string[]): string | null {
    const ready = keys.filter((key) => scene.cache.audio.exists(key));

    if (ready.length === 0) {
        return null;
    }

    return ready[Math.floor(Math.random() * ready.length)];
}

function rand (min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function lerp (a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function clamp (n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}
