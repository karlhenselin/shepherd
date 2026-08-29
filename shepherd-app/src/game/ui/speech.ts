import { isSoundOn } from '../audio/soundPref';
import { forSpeech, voiceClipUrl } from '../audio/speechText';

export { forSpeech, voiceClipId, voiceClipUrl } from '../audio/speechText';

const PAUSE_AFTER_MS = 500;
const SAFETY_FALLBACK_MS = 20000;

let speakGeneration = 0;
let pendingEndedTimer: number | undefined;
let safetyTimer: number | undefined;
let currentClip: HTMLAudioElement | null = null;
let activeText = '';
let activeOnEnded: (() => void) | undefined;
let held: { text: string; onEnded?: () => void } | null = null;

export function speakCue (text: string, onEnded?: () => void): void {
    haltPlayback();
    const generation = ++speakGeneration;
    activeText = text;
    activeOnEnded = onEnded;

    const finish = (): void => {
        scheduleEnded(generation, () => {
            if (generation !== speakGeneration) {
                return;
            }

            if (activeOnEnded === onEnded) {
                activeText = '';
                activeOnEnded = undefined;
            }

            onEnded?.();
        });
    };

    if (text.length === 0) {
        activeText = '';
        activeOnEnded = undefined;
        onEnded?.();
        return;
    }

    if (!isSoundOn()) {
        if (onEnded) {
            window.setTimeout(() => {
                if (generation !== speakGeneration) {
                    return;
                }

                finish();
            }, Math.max(1100, Math.min(3000, text.length * 50)));
        }

        return;
    }

    const clip = new Audio(voiceClipUrl(text));
    currentClip = clip;
    clip.onended = () => {
        if (generation !== speakGeneration) {
            return;
        }

        if (currentClip === clip) {
            currentClip = null;
        }

        finish();
    };
    clip.onerror = () => {
        if (generation !== speakGeneration) {
            return;
        }

        if (currentClip === clip) {
            currentClip = null;
        }

        speakBrowser(text, finish);
    };

    armSafety(generation, finish, clip);

    void clip.play().catch(() => {
        if (generation !== speakGeneration) {
            return;
        }

        if (currentClip === clip) {
            currentClip = null;
        }

        speakBrowser(text, finish);
    });
}

/** Stop the current line but keep it so an overlay can play it again on resume. */
export function pauseSpeech (): void {
    if (!held && (activeText.length > 0 || activeOnEnded)) {
        held = { text: activeText, onEnded: activeOnEnded };
    }

    activeText = '';
    activeOnEnded = undefined;
    haltPlayback();
}

export function resumeSpeech (): void {
    const saved = held;
    held = null;

    if (!saved) {
        return;
    }

    if (saved.text.length > 0) {
        speakCue(saved.text, saved.onEnded);
        return;
    }

    saved.onEnded?.();
}

export function speechAwaitingFinish (): boolean {
    return held !== null
        || activeOnEnded !== undefined
        || currentClip !== null
        || pendingEndedTimer !== undefined;
}

export function stopSpeech (): void {
    activeText = '';
    activeOnEnded = undefined;
    haltPlayback();
}

export function clearAllSpeech (): void {
    held = null;
    stopSpeech();
}

function haltPlayback (): void {
    speakGeneration++;
    clearPendingEnded();
    clearSafety();
    stopClip();
    cancelBrowserSpeech();
}

function speakBrowser (text: string, finish: () => void): void {
    if (typeof speechSynthesis === 'undefined') {
        finish();
        return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(forSpeech(text));
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => finish();
    utterance.onerror = () => finish();
    speechSynthesis.speak(utterance);
}

function stopClip (): void {
    if (!currentClip) {
        return;
    }

    currentClip.onended = null;
    currentClip.onerror = null;
    currentClip.onloadedmetadata = null;
    currentClip.pause();
    currentClip.src = '';
    currentClip = null;
}

function cancelBrowserSpeech (): void {
    if (typeof speechSynthesis === 'undefined') {
        return;
    }

    speechSynthesis.cancel();
}

function armSafety (generation: number, finish: () => void, clip: HTMLAudioElement): void {
    const arm = (ms: number): void => {
        clearSafety();
        safetyTimer = window.setTimeout(() => {
            safetyTimer = undefined;

            if (generation !== speakGeneration) {
                return;
            }

            finish();
        }, ms);
    };

    arm(SAFETY_FALLBACK_MS);

    clip.onloadedmetadata = () => {
        if (generation !== speakGeneration) {
            return;
        }

        const seconds = Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : 12;
        arm(Math.max(4000, seconds * 1000 + 1500));
    };
}

function scheduleEnded (generation: number, onEnded?: () => void): void {
    if (!onEnded || generation !== speakGeneration) {
        return;
    }

    clearPendingEnded();
    pendingEndedTimer = window.setTimeout(() => {
        pendingEndedTimer = undefined;

        if (generation !== speakGeneration) {
            return;
        }

        onEnded();
    }, PAUSE_AFTER_MS);
}

function clearPendingEnded (): void {
    if (pendingEndedTimer === undefined) {
        return;
    }

    window.clearTimeout(pendingEndedTimer);
    pendingEndedTimer = undefined;
}

function clearSafety (): void {
    if (safetyTimer === undefined) {
        return;
    }

    window.clearTimeout(safetyTimer);
    safetyTimer = undefined;
}
