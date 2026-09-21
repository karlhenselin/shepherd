/** Session-only run speed for the cheat menu. Survives WorldScene restarts. */
let superSpeed = false;

const SUPER_SCALE = 3;

export function isSuperSpeed (): boolean {
    return superSpeed;
}

export function toggleSuperSpeed (): boolean {
    superSpeed = !superSpeed;
    return superSpeed;
}

export function speedScale (): number {
    return superSpeed ? SUPER_SCALE : 1;
}
