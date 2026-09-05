import { GameObjects, Geom } from 'phaser';

const EDGE = 16;
/** Typical status-bar / cutout height when `env(safe-area-*)` is 0 (Android WebView). */
const TOUCH_STATUS = 44;
const HIT_PAD = 20;

export type ChromeInsets = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export function isPhoneChrome (): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function readSafeEnv (): ChromeInsets {
    if (typeof document === 'undefined') {
        return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    const probe = document.createElement('div');
    probe.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)',
        'visibility:hidden',
        'pointer-events:none'
    ].join(';');
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const insets = {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0
    };
    probe.remove();
    return insets;
}

/** Extra inset so HUD sits below status / cutout / gesture bars. */
export function chromeInsets (): ChromeInsets {
    const env = readSafeEnv();
    const coarse = isPhoneChrome();

    return {
        top: env.top > 0 ? env.top : (coarse ? TOUCH_STATUS : 0),
        right: env.right,
        bottom: env.bottom > 0 ? env.bottom : (coarse ? 20 : 0),
        left: env.left
    };
}

export function chromePad (): ChromeInsets {
    const inset = chromeInsets();

    return {
        top: EDGE + inset.top,
        right: EDGE + inset.right,
        bottom: EDGE + inset.bottom,
        left: EDGE + inset.left
    };
}

/** Expand the tap target past the 40×40 icon so a finger can actually hit it. */
export function makeHudInteractive (obj: GameObjects.Image | GameObjects.Text): void {
    const scaleX = obj.scaleX || 1;
    const scaleY = obj.scaleY || 1;
    const localW = obj.displayWidth / scaleX;
    const localH = obj.displayHeight / scaleY;
    const padX = HIT_PAD / scaleX;
    const padY = HIT_PAD / scaleY;

    obj.setInteractive({
        hitArea: new Geom.Rectangle(-padX, -padY, localW + padX * 2, localH + padY * 2),
        hitAreaCallback: Geom.Rectangle.Contains,
        useHandCursor: true
    });
}
