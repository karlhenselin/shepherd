import { Scene, Sound } from 'phaser';
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
const HEAR_NIGHT = 1680;
const HEAR_NIGHT_SCARED = 2200;
const HEAR_STRAY = 3200;
const HEAR_LAGGING = 1400;
const FOLD_COZY = 220;
const FOLD_FAR = 720;

type VolumeSound = Sound.BaseSound & {
    volume: number;
};

export type NightBaahContext = {
    elapsedMs: number;
    fold: { x: number; y: number } | null;
};

const nextBleatAt = new WeakMap<Sheep, number>();
let lastCalmBleatAt = 0;
let nextNightBaahAt = 0;
let nightAtmosphere = false;
let audioHeld = false;

export function loadSheepSounds (load: Phaser.Loader.LoaderPlugin): void {
    for (const clip of SHEEP_BLEAT_FILES) {
        load.audio(clip.key, encodeURI(clip.file));
    }
}

export function tickSheepSounds (scene: Scene, flock: Sheep[], listener: { x: number; y: number }, night = false): void {
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
        if (night && !sheep.hurt) {
            continue;
        }

        maybeBleat(scene, sheep, listener, now);
    }
}

export function tickNightBaahs (
    scene: Scene,
    flock: Sheep[],
    listener: { x: number; y: number },
    night: NightBaahContext | null
): void {
    const now = scene.time.now;

    if (!night) {
        if (nightAtmosphere) {
            postponeBleats(flock, now);
        }

        nightAtmosphere = false;
        nextNightBaahAt = 0;
        return;
    }

    nightAtmosphere = true;

    if (!canPlayBleats(scene)) {
        audioHeld = true;
        return;
    }

    if (audioHeld) {
        audioHeld = false;
        postponeBleats(flock, now);
        return;
    }

    if (nextNightBaahAt === 0) {
        nextNightBaahAt = now + firstNightDelay(night);
        return;
    }

    if (now < nextNightBaahAt) {
        return;
    }

    const sheep = pickNightSheep(flock);

    if (!sheep) {
        nextNightBaahAt = now + 5000 + Math.random() * 4000;
        return;
    }

    const scared = rollScaredBaah(sheep, night);

    if (!playNightBaah(scene, sheep, listener, scared)) {
        nextNightBaahAt = now + 1800;
        return;
    }

    lastCalmBleatAt = now;
    nextNightBaahAt = now + nextNightDelay(sheep, night, scared);
}

export function cueWaitingBleat (sheep: Sheep, now: number): void {
    lastCalmBleatAt = Math.min(lastCalmBleatAt, now - CALM_GAP_MS);
    nextBleatAt.set(sheep, now + 800 + Math.random() * 1600);
}

/**
 * Warning baah while a follower is falling behind (before teleport).
 * Higher pitch (cents) and volume so it reads as "getting farther."
 */
export function playLaggingBaah (scene: Scene, sheep: Sheep, listener: { x: number; y: number }): boolean {
    if (!canPlayBleats(scene)) {
        return false;
    }

    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const falloff = 1 - clamp(dist / HEAR_LAGGING, 0, 1);
    const settings: Phaser.Types.Sound.SoundConfig = {
        volume: lerp(0.42, 0.82, falloff) * (0.92 + Math.random() * 0.12),
        pan: clamp(stereoPan(scene, sheep.sprite.x) + rand(-0.06, 0.06), -1, 1),
        rate: rand(1.08, 1.18),
        detune: rand(220, 480)
    };

    if (!isSoundOn()) {
        return true;
    }

    const key = pickLoaded(scene, LOUD_KEYS);

    if (!key) {
        return false;
    }

    return scene.sound.play(key, settings);
}

/**
 * Loud scared baah at the moment a sheep wanders/teleports away.
 * Stereo-panned toward the teleport destination; volume fades out during the clip
 * so it sounds like the sheep is going farther away.
 */
export function playStrayBaah (scene: Scene, sheep: Sheep, listener: { x: number; y: number }): boolean {
    if (!canPlayBleats(scene)) {
        return false;
    }

    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const pan = clamp(Math.cos(angle) + rand(-0.05, 0.05), -1, 1);
    const falloff = 1 - clamp(dist / HEAR_STRAY, 0, 1);
    const startVolume = lerp(0.38, 0.88, falloff) * (0.92 + Math.random() * 0.12);
    const settings: Phaser.Types.Sound.SoundConfig = {
        volume: startVolume,
        pan,
        rate: rand(1.0, 1.12),
        detune: rand(80, 320)
    };

    if (!isSoundOn()) {
        return true;
    }

    const key = pickLoaded(scene, LOUD_KEYS);

    if (!key) {
        return false;
    }

    const sound = scene.sound.add(key, settings) as VolumeSound;

    if (!sound.play()) {
        sound.destroy();
        return false;
    }

    const durationMs = Math.max(280, (sound.duration || sound.totalDuration || 1.15) * 1000);
    const fadeMs = Math.max(220, durationMs * 0.88);
    let finished = false;

    const finish = (): void => {
        if (finished) {
            return;
        }

        finished = true;
        scene.tweens.killTweensOf(sound);

        if (sound.isPlaying) {
            sound.stop();
        }

        sound.destroy();
    };

    scene.tweens.add({
        targets: sound,
        volume: 0.01,
        duration: fadeMs,
        ease: 'Sine.easeIn',
        onComplete: finish
    });

    sound.once('complete', finish);

    return true;
}

/** Soft happy baah when the shepherd pets a sheep. */
export function playHappyBaah (scene: Scene, sheep: Sheep, listener: { x: number; y: number }): boolean {
    if (!canPlayBleats(scene)) {
        return false;
    }

    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const falloff = 1 - clamp(dist / 420, 0, 1);
    const settings: Phaser.Types.Sound.SoundConfig = {
        volume: lerp(0.08, 0.32, falloff) * (0.85 + Math.random() * 0.25),
        pan: clamp(stereoPan(scene, sheep.sprite.x) + rand(-0.06, 0.06), -1, 1),
        rate: rand(1.05, 1.14),
        detune: rand(40, 180)
    };

    if (!isSoundOn()) {
        return true;
    }

    const key = pickLoaded(scene, QUIET_KEYS);

    if (!key) {
        return false;
    }

    lastCalmBleatAt = scene.time.now;
    nextBleatAt.set(sheep, scene.time.now + 5000 + Math.random() * 4000);
    return scene.sound.play(key, settings);
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
    nextNightBaahAt = 0;
    nightAtmosphere = false;
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
    nextNightBaahAt = now + 3500 + Math.random() * 4500;

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
    if (sheep.hurt || sheep.mood === 'stuck') {
        return 2200 + Math.random() * 2300;
    }

    if (sheep.mood === 'waiting') {
        return (sheep.nervous ? 7000 : 10000) + Math.random() * (sheep.nervous ? 6000 : 9000);
    }

    if (sheep.nervous) {
        return 14000 + Math.random() * 10000;
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

    const key = pickLoaded(scene, sheep.hurt || sheep.mood === 'stuck' ? LOUD_KEYS : QUIET_KEYS);

    if (!key) {
        return false;
    }

    return scene.sound.play(key, settings);
}

function pickNightSheep (flock: Sheep[]): Sheep | null {
    const eligible = flock.filter((sheep) => !sheep.hurt && !sheep.isBusy);

    if (eligible.length === 0) {
        return null;
    }

    const wandering = eligible.filter((sheep) => sheep.mood !== 'penned');
    const pool = wandering.length > 0 ? wandering : eligible;

    return pool[Math.floor(Math.random() * pool.length)];
}

function rollScaredBaah (sheep: Sheep, night: NightBaahContext): boolean {
    const dusk = 1 - clamp(night.elapsedMs / 120000, 0, 1);
    let chance = lerp(0.24, 0.58, dusk);

    if (sheep.nervous) {
        chance = Math.min(0.82, chance + 0.18);
    }

    if (sheep.mood === 'penned') {
        chance *= 0.18;
    }

    const foldDist = night.fold
        ? Math.hypot(sheep.sprite.x - night.fold.x, sheep.sprite.y - night.fold.y)
        : FOLD_FAR;

    if (foldDist < FOLD_COZY) {
        chance *= 0.28;
    }
    else if (foldDist > FOLD_FAR) {
        chance = Math.min(0.76, chance + 0.16);
    }

    return Math.random() < chance;
}

function firstNightDelay (night: NightBaahContext): number {
    return night.elapsedMs < 8000 ? 3200 + Math.random() * 4200 : 6000 + Math.random() * 8000;
}

function nextNightDelay (sheep: Sheep, night: NightBaahContext, scared: boolean): number {
    const nearFold = night.fold
        ? Math.hypot(sheep.sprite.x - night.fold.x, sheep.sprite.y - night.fold.y) < FOLD_COZY
        : false;
    const early = night.elapsedMs < 90000;

    if (sheep.mood === 'penned' || nearFold) {
        return 16000 + Math.random() * 12000;
    }

    if (early && scared) {
        return 8000 + Math.random() * 7000;
    }

    if (early) {
        return 10000 + Math.random() * 8000;
    }

    return 12000 + Math.random() * 10000;
}

function playNightBaah (
    scene: Scene,
    sheep: Sheep,
    listener: { x: number; y: number },
    scared: boolean
): boolean {
    const settings = nightBaahSettings(scene, sheep, listener, scared);

    if ((settings.volume ?? 0) < 0.012) {
        return false;
    }

    if (!isSoundOn()) {
        return true;
    }

    const key = pickLoaded(scene, scared ? LOUD_KEYS : QUIET_KEYS);

    if (!key) {
        return false;
    }

    return scene.sound.play(key, settings);
}

function nightBaahSettings (
    scene: Scene,
    sheep: Sheep,
    listener: { x: number; y: number },
    scared: boolean
): Phaser.Types.Sound.SoundConfig {
    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const pan = clamp(stereoPan(scene, sheep.sprite.x) + rand(-0.08, 0.08), -1, 1);

    if (scared) {
        const falloff = 1 - clamp(dist / HEAR_NIGHT_SCARED, 0, 1);
        const high = Math.random() < 0.6;

        return {
            volume: lerp(0.05, 0.34, falloff) * (0.85 + Math.random() * 0.25),
            pan,
            rate: high ? rand(1.04, 1.14) : rand(0.88, 0.98),
            detune: high ? rand(80, 280) : rand(-320, -40)
        };
    }

    const falloff = 1 - clamp(dist / HEAR_NIGHT, 0, 1);
    const cozy = sheep.mood === 'penned' ? 0.72 : 1;

    return {
        volume: lerp(0.014, 0.11, falloff) * cozy * (0.75 + Math.random() * 0.3),
        pan,
        rate: rand(0.96, 1.04),
        detune: rand(-50, 50)
    };
}

function bleatSettings (scene: Scene, sheep: Sheep, listener: { x: number; y: number }): Phaser.Types.Sound.SoundConfig {
    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const pan = stereoPan(scene, sheep.sprite.x);

    if (sheep.hurt || sheep.mood === 'stuck') {
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
