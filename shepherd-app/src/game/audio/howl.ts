import { Scene, Sound } from 'phaser';
import { isDocumentAudioLive, isSoundOn } from './soundPref';

const HOWL_KEY = 'wolf-howl';
const HOWL_FILE = 'audio/wolves/398430__naturestemper__wolf-howl.mp3';

let sceneRef: Scene | null = null;
let looping = false;
let suspended = false;
let nextTimer: ReturnType<typeof setTimeout> | null = null;
let echoTimer: ReturnType<typeof setTimeout> | null = null;

export function loadHowlSounds (load: Phaser.Loader.LoaderPlugin): void {
    load.audio(HOWL_KEY, encodeURI(HOWL_FILE));
}

export function startHowling (scene: Scene): void {
    sceneRef = scene;

    if (looping) {
        if (!suspended && nextTimer === null) {
            howlSoon(500);
        }

        return;
    }

    looping = true;

    if (suspended) {
        return;
    }

    howlSoon(2500);
}

export function stopHowling (): void {
    looping = false;
    suspended = false;
    clearHowlTimer();
    silenceHowls();
}

export function suspendHowling (): void {
    suspended = true;
    clearHowlTimer();
    silenceHowls();
}

export function unsuspendHowling (): void {
    if (!suspended) {
        return;
    }

    suspended = false;

    if (looping && nextTimer === null) {
        howlSoon(200);
    }
}

export function syncHowling (): void {
    if (!isSoundOn()) {
        silenceHowls();
        return;
    }

    if (looping && !suspended) {
        cry();
    }
}

function silenceHowls (): void {
    sceneRef?.sound.stopByKey(HOWL_KEY);
}

function clearHowlTimer (): void {
    if (nextTimer !== null) {
        clearTimeout(nextTimer);
        nextTimer = null;
    }

    if (echoTimer !== null) {
        clearTimeout(echoTimer);
        echoTimer = null;
    }
}

function howlSoon (delay: number): void {
    if (!looping || suspended) {
        return;
    }

    nextTimer = setTimeout(() => {
        nextTimer = null;

        if (!looping || suspended) {
            return;
        }

        if (!isDocumentAudioLive()) {
            howlSoon(8000);
            return;
        }

        cry();

        howlSoon(6000 + Math.random() * 5000);
    }, delay);
}

function cry (): void {
    if (!sceneRef || !isDocumentAudioLive() || !isSoundOn()) {
        return;
    }

    if (!sceneRef.cache.audio.exists(HOWL_KEY) || sceneRef.sound.locked) {
        return;
    }

    const sound = sceneRef.sound as { context?: AudioContext };

    if (sound.context instanceof AudioContext && sound.context.state !== 'running') {
        void sound.context.resume();
        return;
    }

    sceneRef.sound.play(HOWL_KEY, {
        volume: 0.6 + Math.random() * 0.4,
        pan: (Math.random() * 2 - 1) * 0.92,
        rate: 1,
        detune: -16 + Math.random() * 32
    });
}

type VolumeSound = Sound.BaseSound & {
    volume: number;
    duration: number;
    totalDuration: number;
};

/** Greeting howl when the shepherd pets Sarah — first half of the clip only. */
export function playFriendlyHowl (
    scene: Scene,
    x: number,
    y: number,
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

    if (!scene.cache.audio.exists(HOWL_KEY)) {
        return false;
    }

    const ctx = scene.sound as { context?: AudioContext };

    if (ctx.context instanceof AudioContext && ctx.context.state !== 'running') {
        void ctx.context.resume();
        return false;
    }

    const dist = Math.hypot(x - listener.x, y - listener.y);
    const falloff = 1 - Math.min(1, Math.max(0, dist / 420));
    const cam = scene.cameras.main;
    const mid = cam.worldView.centerX;
    const half = Math.max(cam.worldView.width / 2, 1);
    const pan = Math.min(1, Math.max(-1, (x - mid) / half));
    const rate = 1.12 + Math.random() * 0.1;
    const startVolume = (0.48 + 0.32 * falloff) * (0.9 + Math.random() * 0.14);

    const howl = scene.sound.add(HOWL_KEY, {
        volume: startVolume,
        pan,
        rate,
        detune: 20 + Math.random() * 80
    }) as VolumeSound;

    if (!howl.play()) {
        howl.destroy();
        return false;
    }

    const sourceSeconds = Math.max(0.4, howl.duration || howl.totalDuration || 2);
    const playMs = (sourceSeconds / 2 / rate) * 1000;
    const fadeMs = Math.min(160, playMs * 0.18);
    let finished = false;

    const finish = (): void => {
        if (finished) {
            return;
        }

        finished = true;
        scene.tweens.killTweensOf(howl);

        if (howl.isPlaying) {
            howl.stop();
        }

        howl.destroy();
    };

    scene.time.delayedCall(Math.max(40, playMs - fadeMs), () => {
        if (finished || !howl.isPlaying) {
            finish();
            return;
        }

        scene.tweens.add({
            targets: howl,
            volume: 0.01,
            duration: fadeMs,
            ease: 'Sine.easeIn',
            onComplete: finish
        });
    });

    howl.once('complete', finish);

    return true;
}
