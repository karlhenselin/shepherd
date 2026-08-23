const SAVE_KEY = 'shepherd-save';

export type StoryCheckpoint = 'psalm-23-1' | 'psalm-23-2' | 'psalm-23-3';

export type GameSave = {
    version: 1;
    checkpoint: StoryCheckpoint;
    foundCount: number;
    foundNames: string[];
    waitingName: string | null;
    nextNames: string[];
    heardPsalm1: boolean;
    heardPsalm2: boolean;
    heardPsalm3: boolean;
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
