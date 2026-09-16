import { GameObjects, Scene } from 'phaser';
import { ensureSheepTexture } from '../entities/Sheep';
import { playQuietBleat } from '../audio/sheepSounds';
import { playMinigameWordDone } from './minigameSfx';
import { tokenizeVerse, type TokenizedWord } from './verseScroller';

const UMBER = '#3d2c1e';
const FONT = 'Georgia, Palatino, serif';
const SHEEP_DISPLAY = 52;
const LABEL_OFFSET_Y = -36;
const WANDER_SPEED = 70;
/** After the reading ends, ease down to this fraction of wander speed. */
const SLOWDOWN_TARGET = 0.5;
const SLOWDOWN_MS = 30000;
/** Min center-to-center distance so bodies + word tags don't stack. */
const SEPARATION = 92;
const SEPARATION_PUSH = 140;

const SHEEP_TINTS = [0xf4f7ff, 0xe2f0c9, 0xf3d09a, 0xd5cce6];

type Bounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

type WordSheep = {
    token: TokenizedWord;
    sprite: GameObjects.Image;
    label: GameObjects.Text;
    x: number;
    y: number;
    vx: number;
    vy: number;
    claimed: boolean;
    shaking: boolean;
};

export type SheepVersePlayfield = {
    update: (deltaMs: number) => void;
    /** Start gradual wander slowdown (call when the reading finishes). */
    beginSlowdown: () => void;
    /** Claimed display words in order so far. */
    claimedDisplays: () => string[];
    isFinished: () => boolean;
    nextMatch: () => string | null;
    destroy: () => void;
};

export function createSheepVersePlayfield (
    scene: Scene,
    text: string,
    bounds: Bounds,
    onClaim: (display: string) => void,
    onWrong: () => void
): SheepVersePlayfield {
    ensureSheepTexture(scene);

    const tokens = tokenizeVerse(text);
    const sheep: WordSheep[] = [];
    let nextIndex = 0;
    /** 1 = full wander; eases toward SLOWDOWN_TARGET after beginSlowdown(). */
    let speedScale = 1;
    let slowdownElapsed = -1;

    const padX = 48;
    const padY = 56;
    const spawnLeft = bounds.left + padX;
    const spawnRight = bounds.right - padX;
    const spawnTop = bounds.top + padY;
    const spawnBottom = bounds.bottom - padY;

    const spots = placeSpawns(tokens.length, spawnLeft, spawnRight, spawnTop, spawnBottom);

    tokens.forEach((token, i) => {
        const spot = spots[i] ?? {
            x: spawnLeft + Math.random() * Math.max(20, spawnRight - spawnLeft),
            y: spawnTop + Math.random() * Math.max(20, spawnBottom - spawnTop)
        };
        const angle = Math.random() * Math.PI * 2;
        const speed = WANDER_SPEED * (0.75 + Math.random() * 0.5);

        const sprite = scene.add.image(spot.x, spot.y, 'sheep')
            .setDisplaySize(SHEEP_DISPLAY, SHEEP_DISPLAY)
            .setTint(SHEEP_TINTS[i % SHEEP_TINTS.length])
            .setDepth(20)
            .setInteractive({ useHandCursor: true });

        const label = scene.add.text(spot.x, spot.y + LABEL_OFFSET_Y, token.display, {
            fontFamily: FONT,
            fontSize: '23px',
            color: UMBER,
            align: 'center'
        })
            .setOrigin(0.5)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });

        const unit: WordSheep = {
            token,
            sprite,
            label,
            x: spot.x,
            y: spot.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            claimed: false,
            shaking: false
        };

        const onDown = (
            _p: unknown,
            _x: number,
            _y: number,
            event: Phaser.Types.Input.EventData
        ) => {
            event.stopPropagation();
            handleTap(unit);
        };

        sprite.on('pointerdown', onDown);
        label.on('pointerdown', onDown);

        sheep.push(unit);
    });

    function syncVisuals (unit: WordSheep): void {
        unit.sprite.setPosition(unit.x, unit.y);
        unit.label.setPosition(unit.x, unit.y + LABEL_OFFSET_Y);
    }

    function disableHits (unit: WordSheep): void {
        unit.sprite.disableInteractive();
        unit.label.disableInteractive();
    }

    function handleTap (unit: WordSheep): void {
        if (unit.claimed || unit.shaking) {
            return;
        }

        const expected = tokens[nextIndex];

        if (!expected || unit.token.match !== expected.match) {
            shakeWrong(unit);
            playQuietBleat(scene, 0.28);
            onWrong();
            return;
        }

        unit.claimed = true;
        const claimedDisplay = expected.display;
        nextIndex += 1;
        playMinigameWordDone(scene);
        onClaim(claimedDisplay);
        disableHits(unit);

        scene.tweens.add({
            targets: [unit.sprite, unit.label],
            alpha: 0,
            scaleX: 0.6,
            scaleY: 0.6,
            duration: 280,
            ease: 'Cubic.easeIn',
            onUpdate: () => {
                // Keep label above sheep while both fade/shrink.
                unit.label.y = unit.sprite.y + LABEL_OFFSET_Y * unit.sprite.scaleY;
            },
            onComplete: () => {
                unit.sprite.setVisible(false);
                unit.label.setVisible(false);
            }
        });

        scene.tweens.add({
            targets: unit,
            y: unit.y - 24,
            duration: 280,
            ease: 'Cubic.easeIn',
            onUpdate: () => syncVisuals(unit)
        });
    }

    function shakeWrong (unit: WordSheep): void {
        unit.shaking = true;
        const baseX = unit.x;
        scene.tweens.add({
            targets: unit,
            x: baseX + 8,
            duration: 45,
            yoyo: true,
            repeat: 3,
            onUpdate: () => syncVisuals(unit),
            onComplete: () => {
                unit.x = baseX;
                syncVisuals(unit);
                unit.shaking = false;
            }
        });
    }

    function clampInBounds (unit: WordSheep): void {
        if (unit.x < bounds.left + padX) {
            unit.x = bounds.left + padX;
            unit.vx = Math.abs(unit.vx);
        }
        else if (unit.x > bounds.right - padX) {
            unit.x = bounds.right - padX;
            unit.vx = -Math.abs(unit.vx);
        }

        if (unit.y < bounds.top + padY) {
            unit.y = bounds.top + padY;
            unit.vy = Math.abs(unit.vy);
        }
        else if (unit.y > bounds.bottom - padY) {
            unit.y = bounds.bottom - padY;
            unit.vy = -Math.abs(unit.vy);
        }
    }

    function separateSheep (): void {
        for (let i = 0; i < sheep.length; i++) {
            const a = sheep[i];

            if (a.claimed || a.shaking) {
                continue;
            }

            for (let j = i + 1; j < sheep.length; j++) {
                const b = sheep[j];

                if (b.claimed || b.shaking) {
                    continue;
                }

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy) || 0.001;

                if (dist >= SEPARATION) {
                    continue;
                }

                const overlap = SEPARATION - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const push = overlap * 0.5;

                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;

                a.vx -= nx * SEPARATION_PUSH * 0.02;
                a.vy -= ny * SEPARATION_PUSH * 0.02;
                b.vx += nx * SEPARATION_PUSH * 0.02;
                b.vy += ny * SEPARATION_PUSH * 0.02;

                clampInBounds(a);
                clampInBounds(b);
                syncVisuals(a);
                syncVisuals(b);
            }
        }
    }

    function update (deltaMs: number): void {
        const dt = deltaMs / 1000;

        if (slowdownElapsed >= 0 && speedScale > SLOWDOWN_TARGET) {
            slowdownElapsed += deltaMs;
            const t = Math.min(1, slowdownElapsed / SLOWDOWN_MS);
            speedScale = 1 - t * (1 - SLOWDOWN_TARGET);
        }

        const speed = WANDER_SPEED * speedScale;

        for (const unit of sheep) {
            if (unit.claimed) {
                continue;
            }

            const mag = Math.hypot(unit.vx, unit.vy) || 1;
            const target = speed * (0.85 + Math.random() * 0.3);
            unit.vx = (unit.vx / mag) * target;
            unit.vy = (unit.vy / mag) * target;

            const turn = (Math.random() - 0.5) * 1.8 * dt;
            const cos = Math.cos(turn);
            const sin = Math.sin(turn);
            const nx = unit.vx * cos - unit.vy * sin;
            const ny = unit.vx * sin + unit.vy * cos;
            unit.vx = nx;
            unit.vy = ny;

            if (!unit.shaking) {
                unit.x += unit.vx * dt;
                unit.y += unit.vy * dt;
            }

            clampInBounds(unit);
            syncVisuals(unit);
            unit.sprite.setAngle(Math.sin(scene.time.now / 180 + unit.x * 0.02) * 8);
        }

        separateSheep();
    }

    return {
        update,
        beginSlowdown () {
            if (slowdownElapsed < 0) {
                slowdownElapsed = 0;
            }
        },
        claimedDisplays () {
            return tokens.slice(0, nextIndex).map((t) => t.display);
        },
        isFinished () {
            return nextIndex >= tokens.length;
        },
        nextMatch () {
            return tokens[nextIndex]?.match ?? null;
        },
        destroy () {
            for (const unit of sheep) {
                unit.sprite.destroy();
                unit.label.destroy();
            }
            sheep.length = 0;
        }
    };
}

/** Spread sheep at spawn so they don't start stacked. */
function placeSpawns (
    count: number,
    left: number,
    right: number,
    top: number,
    bottom: number
): { x: number; y: number }[] {
    const spots: { x: number; y: number }[] = [];
    const width = Math.max(20, right - left);
    const height = Math.max(20, bottom - top);
    const maxAttempts = 40;

    for (let i = 0; i < count; i++) {
        let placed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = left + Math.random() * width;
            const y = top + Math.random() * height;
            const ok = spots.every((s) => Math.hypot(s.x - x, s.y - y) >= SEPARATION * 0.92);

            if (ok) {
                spots.push({ x, y });
                placed = true;
                break;
            }
        }

        if (!placed) {
            const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
            const rows = Math.max(1, Math.ceil(count / cols));
            const col = i % cols;
            const row = Math.floor(i / cols);
            spots.push({
                x: left + (col + 0.5) * (width / cols),
                y: top + (row + 0.5) * (height / rows)
            });
        }
    }

    return spots;
}
