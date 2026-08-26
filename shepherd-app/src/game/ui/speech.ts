import { isSoundOn } from '../audio/soundPref';

export function speakCue (text: string, onEnded?: () => void): void {
    if (typeof speechSynthesis === 'undefined' || text.length === 0 || !isSoundOn()) {
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.cancel();
        }

        if (!isSoundOn() && text.length > 0 && onEnded) {
            const delay = Math.max(1100, Math.min(3000, text.length * 50));
            window.setTimeout(() => onEnded(), delay);
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
        utterance.onend = () => onEnded();
        utterance.onerror = () => onEnded();
    }

    speechSynthesis.speak(utterance);
}

export function stopSpeech (): void {
    if (typeof speechSynthesis === 'undefined') {
        return;
    }

    speechSynthesis.cancel();
}

function forSpeech (text: string): string {
    return text
        .replace(/\b1\s+(?=[A-Z])/g, 'First ')
        .replace(/\b2\s+(?=[A-Z])/g, 'Second ')
        .replace(/(\d+):(\d+)/g, '$1 verse $2');
}
