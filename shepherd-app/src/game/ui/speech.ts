import { isSoundOn } from '../audio/soundPref';

const PAUSE_AFTER_MS = 500;

let speakGeneration = 0;
let pendingEndedTimer: number | undefined;

export function speakCue (text: string, onEnded?: () => void): void {
    clearPendingEnded();
    const generation = ++speakGeneration;

    const finish = (): void => {
        scheduleEnded(generation, onEnded);
    };

    if (typeof speechSynthesis === 'undefined' || text.length === 0 || !isSoundOn()) {
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.cancel();
        }

        if (!isSoundOn() && text.length > 0 && onEnded) {
            const delay = Math.max(1100, Math.min(3000, text.length * 50));
            window.setTimeout(() => {
                if (generation !== speakGeneration) {
                    return;
                }

                finish();
            }, delay);
            return;
        }

        onEnded?.();
        return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(forSpeech(text));
    utterance.rate = 0.95;
    utterance.pitch = 1;

    if (onEnded) {
        utterance.onend = () => finish();
        utterance.onerror = () => finish();
    }

    speechSynthesis.speak(utterance);
}

export function stopSpeech (): void {
    speakGeneration++;
    clearPendingEnded();

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

function forSpeech (text: string): string {
    return text
        .replace(/\b1\s+(?=[A-Z])/g, 'First ')
        .replace(/\b2\s+(?=[A-Z])/g, 'Second ')
        .replace(/(\d+):(\d+)/g, '$1 verse $2');
}
