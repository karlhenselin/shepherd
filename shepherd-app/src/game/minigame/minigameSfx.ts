import { Scene } from 'phaser';
import { isDocumentAudioLive, isSoundOn } from '../audio/soundPref';

/** Soft click for a correct key. */
export function playMinigameKey (scene: Scene): void {
    playBlip(scene, {
        freq: 920 + Math.random() * 80,
        endFreq: 640,
        duration: 0.045,
        volume: 0.14,
        type: 'triangle'
    });
}

/** Short bright chime when a word is finished. */
export function playMinigameWordDone (scene: Scene): void {
    const sound = scene.sound as { context?: AudioContext };
    const ctx = sound.context;
    if (!canPlay(scene, ctx)) {
        return;
    }

    const now = ctx!.currentTime;
    const master = ctx!.createGain();
    master.gain.value = 0.28;
    master.connect(ctx!.destination);

    // Two-note sparkle
    pluck(ctx!, master, now, 660, 0.12, 0.55);
    pluck(ctx!, master, now + 0.05, 990, 0.16, 0.7);
    pluck(ctx!, master, now + 0.1, 1320, 0.18, 0.45);

    window.setTimeout(() => {
        try {
            master.disconnect();
        }
        catch {
            // torn down
        }
    }, 320);
}

function playBlip (
    scene: Scene,
    opts: {
        freq: number;
        endFreq: number;
        duration: number;
        volume: number;
        type: OscillatorType;
    }
): void {
    const sound = scene.sound as { context?: AudioContext };
    const ctx = sound.context;
    if (!canPlay(scene, ctx)) {
        return;
    }

    const now = ctx!.currentTime;
    const osc = ctx!.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, now);
    osc.frequency.exponentialRampToValueAtTime(opts.endFreq, now + opts.duration);

    const gain = ctx!.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(opts.volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

    osc.connect(gain);
    gain.connect(ctx!.destination);
    osc.start(now);
    osc.stop(now + opts.duration + 0.02);
}

function pluck (
    ctx: AudioContext,
    dest: AudioNode,
    when: number,
    freq: number,
    duration: number,
    volume: number
): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + duration + 0.02);
}

function canPlay (scene: Scene, ctx: AudioContext | undefined): ctx is AudioContext {
    if (!isDocumentAudioLive() || !scene.sys.isActive() || scene.sys.isPaused()) {
        return false;
    }

    if (scene.sound.locked || scene.sound.gameLostFocus) {
        return false;
    }

    if (!isSoundOn()) {
        return false;
    }

    if (!(ctx instanceof AudioContext)) {
        return false;
    }

    if (ctx.state !== 'running') {
        void ctx.resume();
        return false;
    }

    return true;
}
