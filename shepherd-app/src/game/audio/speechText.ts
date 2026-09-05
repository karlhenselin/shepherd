/** Shared spoken-form helpers for playback and offline TTS generation. */

export function forSpeech (text: string): string {
    return text
        .replace(/\b1\s+(?=[A-Z])/g, 'First ')
        .replace(/\b2\s+(?=[A-Z])/g, 'Second ')
        .replace(/(\d+):(\d+[a-z]?)/gi, '$1 verse $2');
}

/**
 * Homograph hints for synthesizers. Does not change clip ids or on-screen text.
 * Isaiah 7:24 "bow" is the weapon (beau = long O), not bow-the-gesture / bough (ow).
 * "Job" the book is Jobe (long O), not job-the-work (short o).
 */
export function forPronunciation (spoken: string): string {
    return spoken
        .replace(/\bbow and arrow\b/gi, 'beau and arrow')
        .replace(/\bJob (\d)/g, 'Jobe $1');
}

/** Stable 8-char id from the spoken form of a cue. */
export function voiceClipId (text: string): string {
    const spoken = forSpeech(text);
    let hash = 5381;

    for (let i = 0; i < spoken.length; i++) {
        hash = Math.imul(hash, 33) ^ spoken.charCodeAt(i);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function voiceClipUrl (text: string): string {
    return `assets/voice/${voiceClipId(text)}.mp3`;
}
