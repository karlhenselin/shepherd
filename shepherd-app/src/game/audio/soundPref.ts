const STORAGE_KEY = 'shepherd-sound';

export function isSoundOn (): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'off';
    }
    catch {
        return true;
    }
}

export function isDocumentAudioLive (): boolean {
    if (!isSoundOn()) {
        return false;
    }

    if (typeof document === 'undefined') {
        return true;
    }

    if (document.hidden) {
        return false;
    }

    if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        return false;
    }

    return true;
}

export function setSoundOn (on: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    }
    catch {
        // private mode or blocked storage
    }
}
