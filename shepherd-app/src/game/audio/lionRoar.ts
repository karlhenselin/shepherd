import { Scene } from 'phaser';
import { FlockBehavior } from '../entities/flockBehavior';
import { isDocumentAudioLive, isSoundOn } from './soundPref';

/** Friendly greeting roar. */
const ROAR_SECONDS = 1.9;

let noiseBuffer: AudioBuffer | null = null;

export function playFriendlyLionRoar (
    scene: Scene,
    sheep: FlockBehavior,
    listener: { x: number; y: number }
): boolean {
    if (!isDocumentAudioLive() || !scene.sys.isActive() || scene.sys.isPaused()) {
        return false;
    }

    if (scene.sound.locked || scene.sound.gameLostFocus) {
        return false;
    }

    if (!isSoundOn()) {
        return true;
    }

    const sound = scene.sound as { context?: AudioContext };
    const ctx = sound.context;

    if (!(ctx instanceof AudioContext)) {
        return false;
    }

    if (ctx.state !== 'running') {
        void ctx.resume();
        return false;
    }

    const now = ctx.currentTime;
    const dx = sheep.sprite.x - listener.x;
    const dy = sheep.sprite.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const falloff = 1 - clamp(dist / 420, 0, 1);
    const volume = (0.48 + 0.42 * falloff) * (0.92 + Math.random() * 0.12);
    const pitch = 1.12 + Math.random() * 0.1;

    const master = ctx.createGain();
    master.gain.value = volume;

    const pan = ctx.createStereoPanner();
    pan.pan.value = stereoPan(scene, sheep.sprite.x);

    master.connect(pan);
    pan.connect(ctx.destination);

    addRoarBody(ctx, master, now, pitch);
    addChuff(ctx, master, now, pitch);

    const linger = ROAR_SECONDS / pitch + 0.08;

    window.setTimeout(() => {
        try {
            master.disconnect();
            pan.disconnect();
        }
        catch {
            // already torn down
        }
    }, linger * 1000);

    return true;
}

function addRoarBody (ctx: AudioContext, dest: AudioNode, now: number, pitch: number): void {
    const duration = ROAR_SECONDS / pitch;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(980 * pitch, now);
    filter.frequency.exponentialRampToValueAtTime(240 * pitch, now + duration * 0.85);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.95, now + 0.07);
    gain.gain.linearRampToValueAtTime(0.78, now + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const startHz = 188 * pitch;
    const endHz = 78 * pitch;

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(startHz, now);
    saw.frequency.exponentialRampToValueAtTime(endHz, now + duration * 0.9);

    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.55;

    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(startHz, now);
    tri.frequency.exponentialRampToValueAtTime(endHz, now + duration * 0.9);

    const sine = ctx.createOscillator();
    sine.type = 'sine';
    sine.frequency.setValueAtTime(startHz * 0.5, now);
    sine.frequency.exponentialRampToValueAtTime(endHz * 0.5, now + duration * 0.9);

    const sineGain = ctx.createGain();
    sineGain.gain.value = 0.55;

    saw.connect(sawGain);
    sawGain.connect(filter);
    tri.connect(filter);
    sine.connect(sineGain);
    sineGain.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    saw.start(now);
    tri.start(now);
    sine.start(now);
    saw.stop(now + duration);
    tri.stop(now + duration);
    sine.stop(now + duration);
}

/** Soft breathy huff at the front so it reads as a pet, not a scare. */
function addChuff (ctx: AudioContext, dest: AudioNode, now: number, pitch: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoise(ctx);
    noise.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 720 * pitch;
    band.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.52, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    noise.connect(band);
    band.connect(gain);
    gain.connect(dest);

    noise.start(now);
    noise.stop(now + 0.18);
}

function getNoise (ctx: AudioContext): AudioBuffer {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
        return noiseBuffer;
    }

    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.4));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    noiseBuffer = buffer;
    return buffer;
}

function stereoPan (scene: Scene, x: number): number {
    const cam = scene.cameras.main;
    const mid = cam.worldView.centerX;
    const half = Math.max(cam.worldView.width / 2, 1);

    return clamp((x - mid) / half, -1, 1);
}

function clamp (n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}
