export const REGION_WIDTH = 1024;
export const REGION_HEIGHT = 768;
export const REGION_COLS = 7;
export const REGION_ROWS = 7;
export const START_COL = 3;
export const START_ROW = 3;

/** Green pasture: neighboring region NW of start (hungry, first in the Psalm 23 loop). */
export const PASTURE_COL = 2;
export const PASTURE_ROW = 2;
/** Quiet water: different section E-S of start (thirsty after pasture). Not a map corner (sheepfold). */
export const WATER_COL = 5;
export const WATER_ROW = 4;

export const WORLD_WIDTH = REGION_COLS * REGION_WIDTH;
export const WORLD_HEIGHT = REGION_ROWS * REGION_HEIGHT;

/** Minimum spacing between spawned goals (30% of map width). */
export const GOAL_WALK_MIN = Math.round(WORLD_WIDTH * 0.3);

/**
 * Y-sort band for sheep / shepherd: above world props (~0–4), below night veil / UI (~15+).
 * depth = CHAR_DEPTH_BASE + y * CHAR_DEPTH_PER_Y  → ~5..14 across the map.
 */
export const CHAR_DEPTH_BASE = 5;
export const CHAR_DEPTH_PER_Y = 9 / WORLD_HEIGHT;

export function characterDepth (y: number): number {
    return CHAR_DEPTH_BASE + y * CHAR_DEPTH_PER_Y;
}

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
    const pad = 100;

    for (let ring = 0; ring < 28; ring++) {
        const dist = minFromOrigin + ring * 140;

        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2 + ring * 0.35;
            const x = clamp(origin.x + Math.cos(angle) * dist, pad, WORLD_WIDTH - pad);
            const y = clamp(origin.y + Math.sin(angle) * dist, pad, WORLD_HEIGHT - pad);

            if (x <= pad + 1 || y <= pad + 1 || x >= WORLD_WIDTH - pad - 1 || y >= WORLD_HEIGHT - pad - 1) {
                continue;
            }
            const farFromAll = points.every((point) => Math.hypot(point.x - x, point.y - y) >= minFromOthers);

            if (farFromAll) {
                return { x, y };
            }
        }
    }

    // Prefer a mid-map point over an edge clamp that can land on a corner landmark.
    let best = { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.5 };
    let bestScore = -1;

    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const candidate = {
            x: clamp(origin.x + Math.cos(angle) * minFromOrigin, pad, WORLD_WIDTH - pad),
            y: clamp(origin.y + Math.sin(angle) * minFromOrigin, pad, WORLD_HEIGHT - pad)
        };
        const score = points.reduce(
            (sum, point) => sum + Math.hypot(point.x - candidate.x, point.y - candidate.y),
            0
        );

        if (score > bestScore) {
            bestScore = score;
            best = candidate;
        }
    }

    return best;
}

const LANDMARK_PAD_X = 320;
const LANDMARK_PAD_Y = 260;

/** Sheepfold: always the west (left) side of the map. */
export function defaultPenSpot (): { x: number; y: number } {
    return { x: LANDMARK_PAD_X, y: LANDMARK_PAD_Y };
}

/** New Jerusalem: always the east (right) side of the map. */
export function defaultCitySpot (): { x: number; y: number } {
    return { x: WORLD_WIDTH - LANDMARK_PAD_X, y: WORLD_HEIGHT - LANDMARK_PAD_Y };
}

/** True when a saved pen sits on the right half (legacy / overlap saves). */
export function penSpotOnLeft (point: { x: number; y: number }): boolean {
    return point.x < WORLD_WIDTH * 0.5;
}

export function farthestCornerFrom (point: { x: number; y: number }): { x: number; y: number } {
    const corners = [
        { x: LANDMARK_PAD_X, y: LANDMARK_PAD_Y },
        { x: WORLD_WIDTH - LANDMARK_PAD_X, y: LANDMARK_PAD_Y },
        { x: LANDMARK_PAD_X, y: WORLD_HEIGHT - LANDMARK_PAD_Y },
        { x: WORLD_WIDTH - LANDMARK_PAD_X, y: WORLD_HEIGHT - LANDMARK_PAD_Y }
    ];
    let best = corners[0];
    let bestDist = -1;

    for (const corner of corners) {
        const dist = Math.hypot(corner.x - point.x, corner.y - point.y);

        if (dist > bestDist) {
            bestDist = dist;
            best = corner;
        }
    }

    return best;
}

function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
