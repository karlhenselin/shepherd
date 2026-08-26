const SAVE_KEY = 'shepherd-save';

export type StoryCheckpoint = 'psalm-23-1' | 'psalm-23-2' | 'isaiah-53-6' | 'psalm-23-3' | 'psalm-23-3b' | 'psalm-23-4a' | 'psalm-23-4b' | 'psalm-23-4c' | 'found-staff' | 'john-10-2' | 'john-10-9' | '1-cor-15-51' | 'hurt-sheep' | 'found-sheep';

export type SavedPoint = { x: number; y: number };

export type GameSave = {
    version: 1;
    checkpoint: StoryCheckpoint;
    foundCount: number;
    foundNames: string[];
    waitingName: string | null;
    nextNames: string[];
    heardPsalm1: boolean;
    heardPsalm2: boolean;
    heardPsalm2b?: boolean;
    heardPsalm3: boolean;
    heardPsalm3b?: boolean;
    heardPsalm4a?: boolean;
    heardPsalm4b?: boolean;
    heardPsalm4c?: boolean;
    heardJohn102?: boolean;
    heardJohn109?: boolean;
    heardCorinthians?: boolean;
    whiteRobe?: boolean;
    hasStaff?: boolean;
    staff?: SavedPoint | null;
    player?: SavedPoint;
    pen?: SavedPoint | null;
    water?: SavedPoint[];
    grass?: SavedPoint[];
    foundGems?: string[];
};

export function loadSave (): GameSave | null {
    try {
        const raw = localStorage.getItem(SAVE_KEY);

        if (!raw) {
            return null;
        }

        const data = JSON.parse(raw) as GameSave;

        if (data.version !== 1 || !data.checkpoint) {
            return null;
        }

        return data;
    }
    catch {
        return null;
    }
}

export function writeSave (save: GameSave): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function clearSave (): void {
    localStorage.removeItem(SAVE_KEY);
}
