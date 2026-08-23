export function speakCue (text: string, onEnded?: () => void): void {
    if (typeof speechSynthesis === 'undefined' || text.length === 0) {
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
    return text.replace(/(\d+):(\d+)/g, '$1 verse $2');
}
