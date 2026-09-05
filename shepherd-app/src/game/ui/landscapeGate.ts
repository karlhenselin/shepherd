import type { Game } from 'phaser';

/** True when the viewport is taller than wide (portrait play surface). */
export function isPortraitViewport (): boolean {
    return window.innerHeight > window.innerWidth;
}

/**
 * On API 36+ tablets Android may ignore landscape locks. Keep the canvas
 * filling the window and show a rotate prompt until landscape.
 */
export function installLandscapeGate (game: Game): void {
    const gate = ensureGate();

    const sync = () => {
        const portrait = isPortraitViewport();
        gate.hidden = !portrait;
        game.scale.refresh();
    };

    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(sync, 50);
        window.setTimeout(sync, 250);
    });
    window.addEventListener('shepherd-viewport', sync);

    game.events.once('destroy', () => {
        window.removeEventListener('resize', sync);
        window.removeEventListener('shepherd-viewport', sync);
        gate.remove();
    });
}

function ensureGate (): HTMLElement {
    let gate = document.getElementById('rotate-gate');

    if (gate) {
        return gate;
    }

    gate = document.createElement('div');
    gate.id = 'rotate-gate';
    gate.setAttribute('aria-live', 'polite');
    gate.innerHTML = '<p>Rotate your device to play</p>';
    document.body.appendChild(gate);
    return gate;
}
