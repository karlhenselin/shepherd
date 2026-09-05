import { GameObjects, Geom, Math as PMath, Scene, Scenes } from 'phaser';
import { chromePad, type ChromeInsets } from './chromeInsets';

export const PAPER = 0xf7f3ea;
export const UMBER = '#3d2c1e';
/** Finger jitter on Android WebView is often > 8px. */
export const DRAG_CLICK_SLOP = 28;

const SCROLLBAR_INSET = 28;
const SCROLLBAR_HIT = 36;

export type PaperScrollOptions = {
    title: string;
    subtitle?: string;
    headerH?: number;
    footerH?: number;
    titleSize?: string;
    /** Show a drag-friendly scrollbar inset from the phone edge. */
    scrollbar?: boolean;
    onBack: () => void;
};

export type PaperScroll = {
    root: GameObjects.Container;
    scrollTop: number;
    scrollBottom: number;
    viewHeight: number;
    width: number;
    height: number;
    cx: number;
    pad: ChromeInsets;
    /** Room for the scrollbar so wrapped text clears it. */
    scrollGutter: number;
    get dragDistance (): number;
    finish (contentHeight: number): void;
    inBand (y: number): boolean;
    nudge (delta: number): void;
};

export function createPaperScroll (scene: Scene, opts: PaperScrollOptions): PaperScroll {
    const headerH = opts.headerH ?? 64;
    const footerH = opts.footerH ?? 88;
    const titleSize = opts.titleSize ?? '36px';
    const pad = chromePad();
    const { width, height } = scene.scale;
    const cx = width / 2;
    const scrollGutter = opts.scrollbar ? SCROLLBAR_INSET + 10 : 0;

    scene.cameras.main.setBackgroundColor(PAPER);

    const scrollTop = pad.top + headerH;
    const scrollBottom = height - pad.bottom - footerH;
    const viewHeight = Math.max(72, scrollBottom - scrollTop);

    const root = scene.add.container(cx, scrollTop).setDepth(1);

    const maskShape = scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, scrollTop, width, viewHeight);
    root.setMask(maskShape.createGeometryMask());

    scene.add.rectangle(0, 0, width, scrollTop, PAPER, 1).setOrigin(0).setDepth(10);
    scene.add.rectangle(0, scrollBottom, width, height - scrollBottom, PAPER, 1)
        .setOrigin(0)
        .setDepth(10);

    const titleY = opts.subtitle
        ? pad.top + 28
        : pad.top + headerH / 2;

    scene.add.text(cx, titleY, opts.title, {
        fontFamily: 'Georgia, Palatino, serif',
        fontSize: titleSize,
        color: UMBER,
        align: 'center'
    }).setOrigin(0.5).setDepth(11);

    if (opts.subtitle) {
        scene.add.text(cx, pad.top + 64, opts.subtitle, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '16px',
            color: '#6b5344',
            align: 'center'
        }).setOrigin(0.5).setDepth(11);
    }

    const back = scene.add.text(cx, height - pad.bottom - footerH / 2, 'Back', {
        fontFamily: 'Georgia, Palatino, serif',
        fontSize: '22px',
        color: UMBER,
        backgroundColor: '#f3ead8',
        padding: { x: 22, y: 10 },
        align: 'center'
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

    back.on('pointerover', () => back.setColor('#5c4634'));
    back.on('pointerout', () => back.setColor(UMBER));
    back.on('pointerdown', () => opts.onBack());

    let scrollMin = 0;
    let contentHeight = 0;
    let dragY = 0;
    let dragDistance = 0;
    let dragging = false;
    let thumbDragging = false;
    let scrollTrack: GameObjects.Rectangle | null = null;
    let scrollThumb: GameObjects.Rectangle | null = null;

    const inBand = (y: number) => y >= scrollTop && y <= scrollBottom;

    const updateScrollbar = () => {
        if (!scrollTrack || !scrollThumb || scrollMin >= 0) {
            return;
        }

        const travel = scrollTrack.height - scrollThumb.height;
        const progress = (scrollTop - root.y) / -scrollMin;
        scrollThumb.setY(scrollTrack.y + travel * PMath.Clamp(progress, 0, 1));
    };

    const nudge = (delta: number) => {
        root.setY(PMath.Clamp(
            root.y + delta,
            scrollTop + scrollMin,
            scrollTop
        ));
        updateScrollbar();
    };

    const setScrollFromThumbY = (pointerY: number) => {
        if (!scrollTrack || !scrollThumb || scrollMin >= 0) {
            return;
        }

        const travel = scrollTrack.height - scrollThumb.height;
        if (travel <= 0) {
            return;
        }

        const local = PMath.Clamp(pointerY - scrollTrack.y - scrollThumb.height / 2, 0, travel);
        const progress = local / travel;
        root.setY(scrollTop + scrollMin * progress);
        updateScrollbar();
    };

    const finish = (heightPx: number) => {
        contentHeight = heightPx;
        scrollMin = Math.min(0, viewHeight - contentHeight);

        if (!opts.scrollbar || scrollMin >= 0) {
            return;
        }

        const x = width - pad.right - SCROLLBAR_INSET;
        const trackPad = 10;

        scrollTrack = scene.add.rectangle(
            x,
            scrollTop + trackPad,
            8,
            viewHeight - trackPad * 2,
            0xd8cbb4,
            0.9
        ).setOrigin(0.5, 0).setDepth(9);

        const thumbH = Math.max(40, (viewHeight / contentHeight) * scrollTrack.height);

        scrollThumb = scene.add.rectangle(
            x,
            scrollTrack.y,
            12,
            thumbH,
            0x6b5344,
            0.95
        ).setOrigin(0.5, 0).setDepth(9);

        scrollThumb.setInteractive({
            hitArea: new Geom.Rectangle(-SCROLLBAR_HIT / 2, 0, SCROLLBAR_HIT, thumbH),
            hitAreaCallback: Geom.Rectangle.Contains,
            useHandCursor: true
        });

        scrollTrack.setInteractive({
            hitArea: new Geom.Rectangle(-SCROLLBAR_HIT / 2, 0, SCROLLBAR_HIT, scrollTrack.height),
            hitAreaCallback: Geom.Rectangle.Contains,
            useHandCursor: true
        });

        scrollThumb.on('pointerdown', (pointer: { y: number }) => {
            thumbDragging = true;
            dragging = false;
            setScrollFromThumbY(pointer.y);
        });

        scrollTrack.on('pointerdown', (pointer: { y: number }) => {
            thumbDragging = true;
            dragging = false;
            setScrollFromThumbY(pointer.y);
        });

        updateScrollbar();
    };

    const onWheel = (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
        nudge(-dy * 0.45);
    };

    const onDown = (pointer: { x: number; y: number }) => {
        if (thumbDragging) {
            return;
        }

        if (!inBand(pointer.y)) {
            return;
        }

        // Leave scrollbar hit strip to thumb/track handlers.
        if (opts.scrollbar && pointer.x >= width - pad.right - SCROLLBAR_INSET - SCROLLBAR_HIT / 2) {
            return;
        }

        dragging = true;
        dragDistance = 0;
        dragY = pointer.y;
    };

    const onMove = (pointer: { y: number; isDown: boolean }) => {
        if (thumbDragging && pointer.isDown) {
            setScrollFromThumbY(pointer.y);
            return;
        }

        if (!dragging || !pointer.isDown) {
            return;
        }

        const delta = pointer.y - dragY;
        dragDistance += Math.abs(delta);
        dragY = pointer.y;

        if (dragDistance > DRAG_CLICK_SLOP) {
            nudge(delta);
        }
    };

    const onUp = () => {
        dragging = false;
        thumbDragging = false;
    };

    scene.input.on('wheel', onWheel);
    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.keyboard?.on('keydown-ESC', opts.onBack);

    scene.events.once(Scenes.Events.SHUTDOWN, () => {
        scene.input.off('wheel', onWheel);
        scene.input.off('pointerdown', onDown);
        scene.input.off('pointermove', onMove);
        scene.input.off('pointerup', onUp);
        scene.input.keyboard?.off('keydown-ESC', opts.onBack);
    });

    return {
        root,
        scrollTop,
        scrollBottom,
        viewHeight,
        width,
        height,
        cx,
        pad,
        scrollGutter,
        get dragDistance () {
            return dragDistance;
        },
        finish,
        inBand,
        nudge
    };
}
