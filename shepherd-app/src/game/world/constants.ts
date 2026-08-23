export const REGION_WIDTH = 1024;
export const REGION_HEIGHT = 768;
export const REGION_COLS = 7;
export const REGION_ROWS = 7;
export const START_COL = 3;
export const START_ROW = 3;

export const WORLD_WIDTH = REGION_COLS * REGION_WIDTH;
export const WORLD_HEIGHT = REGION_ROWS * REGION_HEIGHT;

export function startCenter (): { x: number; y: number } {
    return regionCenter(START_COL, START_ROW);
}

export function regionCenter (col: number, row: number): { x: number; y: number } {
    return {
        x: (col + 0.5) * REGION_WIDTH,
        y: (row + 0.5) * REGION_HEIGHT
    };
}

export function worldToRegion (x: number, y: number): { col: number; row: number } {
    return {
        col: Math.floor(x / REGION_WIDTH),
        row: Math.floor(y / REGION_HEIGHT)
    };
}

export function findPointAwayFromAll (
    points: { x: number; y: number }[],
    minFromOrigin: number,
    minFromOthers: number
): { x: number; y: number } {
    const origin = points[0] ?? startCenter();
    const pad = 80;

    for (let ring = 0; ring < 20; ring++) {
        const dist = minFromOrigin + ring * 140;

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 + ring * 0.35;
            const x = clamp(origin.x + Math.cos(angle) * dist, pad, WORLD_WIDTH - pad);
            const y = clamp(origin.y + Math.sin(angle) * dist, pad, WORLD_HEIGHT - pad);
            const farFromAll = points.every((point) => Math.hypot(point.x - x, point.y - y) >= minFromOthers);

            if (farFromAll) {
                return { x, y };
            }
        }
    }

    return { x: origin.x + minFromOrigin, y: origin.y };
}

function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
