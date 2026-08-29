import { isSoundOn } from '../audio/soundPref';
import { forSpeech, voiceClipUrl } from '../audio/speechText';

export { forSpeech, voiceClipId, voiceClipUrl } from '../audio/speechText';

const PAUSE_AFTER_MS = 500;

let speakGeneration = 0;
let pendingEndedTimer: number | undefined;
let currentClip: HTMLAudioElement | null = null;

export function speakCue (text: string, onEnded?: () => void): void {
    clearPendingEnded();
    stopClip();
    cancelBrowserSpeech();
    const generation = ++speakGeneration;

    const finish = (): void => {
        scheduleEnded(generation, onEnded);
    };

    if (text.length === 0) {
        onEnded?.();
        return;
    }

    if (!isSoundOn()) {
        if (onEnded) {
            const delay = Math.max(1100, Math.min(3000, text.length * 50));
            window.setTimeout(() => {
                if (generation !== speakGeneration) {
                    return;
                }

                finish();
            }, delay);
            return;
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

export function stopSpeech (): void {
    speakGeneration++;
    clearPendingEnded();
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
