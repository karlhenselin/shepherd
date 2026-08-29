import { GameObjects, Scene } from 'phaser';

const TEXTURE_KEY = 'picnic';
const DISPLAY_W = 110;
const DISPLAY_H = 86;

export class Picnic {
    readonly sprite: GameObjects.Sprite;

    constructor (scene: Scene, x: number, y: number) {
        ensurePicnicTexture(scene);
        this.sprite = scene.add.sprite(x, y, TEXTURE_KEY);
        this.sprite.setDisplaySize(DISPLAY_W, DISPLAY_H);
        this.sprite.setDepth(2.4);
        this.sprite.setAlpha(0);
        scene.tweens.add({
            targets: this.sprite,
            alpha: 1,
            duration: 700,
            ease: 'Sine.easeOut'
        });
    }

    get x (): number {
        return this.sprite.x;
    }

    get y (): number {
        return this.sprite.y;
    }

    sitSpot (): { x: number; y: number } {
        return { x: this.x, y: this.y - 18 };
    }

    fadeOut (onDone?: () => void): void {
        const scene = this.sprite.scene;
        scene.tweens.killTweensOf(this.sprite);
        scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            duration: 900,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.sprite.destroy();
                onDone?.();
            }
        });
    }

    destroy (): void {
        this.sprite.destroy();
    }
}

function ensurePicnicTexture (scene: Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0xe8d5b0, 1);
    g.fillRoundedRect(6, 18, 52, 36, 4);
    g.fillStyle(0xc45c3a, 1);
    g.fillCircle(32, 34, 8);
    g.generateTexture(TEXTURE_KEY, 64, 56);
    g.destroy();
}
