import { Scene } from 'phaser';
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
