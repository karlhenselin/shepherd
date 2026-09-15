import { Scene } from 'phaser';

const UMBER = '#3d2c1e';
const KEY_FILL = 0xf3ead8;
const KEY_HOVER = 0xc4a882;
const ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
] as const;

export type OnScreenKeyboard = {
    destroy: () => void;
};

export function createOnScreenKeyboard (
    scene: Scene,
    onLetter: (char: string) => void,
    bottomPad: number
): OnScreenKeyboard {
    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0).setDepth(20).setScrollFactor(0);

    const keyH = Math.max(44, Math.min(56, height * 0.07));
    const gap = 6;
    const maxRowKeys = ROWS[0].length;
    const usable = width - 24;
    const keyW = Math.min(56, (usable - gap * (maxRowKeys - 1)) / maxRowKeys);
    const totalH = keyH * 3 + gap * 2;
    const startY = height - bottomPad - totalH;

    for (let r = 0; r < ROWS.length; r++) {
        const row = ROWS[r];
        const rowWidth = row.length * keyW + (row.length - 1) * gap;
        const startX = (width - rowWidth) / 2;
        const y = startY + r * (keyH + gap);

        for (let c = 0; c < row.length; c++) {
            const letter = row[c];
            const x = startX + c * (keyW + gap) + keyW / 2;
            const cy = y + keyH / 2;

            const bg = scene.add.rectangle(x, cy, keyW, keyH, KEY_FILL, 0.94)
                .setStrokeStyle(2, 0x3d2c1e, 0.55)
                .setInteractive({ useHandCursor: true });
            bg.setData('ui', true);

            const label = scene.add.text(x, cy, letter, {
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: `${Math.floor(keyH * 0.42)}px`,
                color: UMBER
            }).setOrigin(0.5);

            bg.on('pointerover', () => bg.setFillStyle(KEY_HOVER, 0.94));
            bg.on('pointerout', () => bg.setFillStyle(KEY_FILL, 0.94));
            bg.on('pointerdown', (
                _pointer: unknown,
                _lx: number,
                _ly: number,
                event: Phaser.Types.Input.EventData
            ) => {
                event.stopPropagation();
                onLetter(letter);
            });

            root.add(bg);
            root.add(label);
        }
    }

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        const ch = event.key;
        if (ch.length === 1 && /[a-zA-Z]/.test(ch)) {
            event.preventDefault();
            onLetter(ch);
        }
    };

    scene.input.keyboard?.on('keydown', onKeyDown);

    return {
        destroy: () => {
            scene.input.keyboard?.off('keydown', onKeyDown);
            root.destroy(true);
        }
    };
}
