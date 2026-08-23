import { Scene, GameObjects, Physics, Input, Math as PMath } from 'phaser';

const SPEED = 180;
const ARRIVE_DISTANCE = 8;
const SHEPHERD_W = 48;
const SHEPHERD_H = 48;
const SHADOW_OFFSET = 20;

export class Shepherd {
    readonly sprite: GameObjects.Sprite;
    private readonly body: Physics.Arcade.Body;
    private readonly shadow: GameObjects.Image;
    private readonly keys: { W?: Input.Keyboard.Key; A?: Input.Keyboard.Key; S?: Input.Keyboard.Key; D?: Input.Keyboard.Key };
    private target: PMath.Vector2 | null = null;
    private staffEquipped = false;

    constructor (scene: Scene, x: number, y: number) {
        ensureShepherdTextures(scene);
        ensureShepherdShadow(scene);

        this.shadow = scene.add.image(x, y + SHADOW_OFFSET, 'shepherd-shadow');
        this.shadow.setDepth(5);

        this.sprite = scene.physics.add.sprite(x, y, 'shepherd');
        this.sprite.setDepth(6);
        this.body = this.sprite.body as Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setCircle(14, 8, 10);

        const keyboard = scene.input.keyboard;
        this.keys = keyboard
            ? keyboard.addKeys('W,A,S,D') as { W: Input.Keyboard.Key; A: Input.Keyboard.Key; S: Input.Keyboard.Key; D: Input.Keyboard.Key }
            : {};

        scene.input.on('pointerdown', (pointer: Input.Pointer) => {
            this.target = new PMath.Vector2(pointer.worldX, pointer.worldY);
        });
    }

    get hasStaff (): boolean {
        return this.staffEquipped;
    }

    equipStaff (equipped = true): void {
        this.staffEquipped = equipped;
        this.sprite.setTexture(equipped ? 'shepherd-staff' : 'shepherd');
    }

    update (): void {
        const left = this.keys.A?.isDown ? -1 : 0;
        const right = this.keys.D?.isDown ? 1 : 0;
        const up = this.keys.W?.isDown ? -1 : 0;
        const down = this.keys.S?.isDown ? 1 : 0;
        const vx = left + right;
        const vy = up + down;

        if (vx !== 0 || vy !== 0) {
            this.target = null;
            this.body.setVelocity(vx * SPEED, vy * SPEED);
            this.body.velocity.normalize().scale(SPEED);
            this.faceVelocity();
            this.placeShadow();
            return;
        }

        if (this.target) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;

            if (Math.hypot(dx, dy) < ARRIVE_DISTANCE) {
                this.target = null;
                this.body.setVelocity(0, 0);
                this.placeShadow();
                return;
            }

            this.body.setVelocity(dx, dy);
            this.body.velocity.normalize().scale(SPEED);
            this.faceVelocity();
            this.placeShadow();
            return;
        }

        this.body.setVelocity(0, 0);
        this.placeShadow();
    }

    private faceVelocity (): void {
        if (Math.abs(this.body.velocity.x) > 8) {
            this.sprite.setFlipX(this.body.velocity.x < 0);
        }
    }

    private placeShadow (): void {
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }
}

function ensureShepherdTextures (scene: Scene): void {
    if (scene.textures.exists('shepherd') && scene.textures.exists('shepherd-staff')) {
        return;
    }

    if (scene.textures.exists('shepherd')) {
        scene.textures.remove('shepherd');
    }

    if (scene.textures.exists('shepherd-staff')) {
        scene.textures.remove('shepherd-staff');
    }

    const g = scene.add.graphics();
    drawShepherd(g, false);
    g.generateTexture('shepherd', SHEPHERD_W, SHEPHERD_H);
    g.clear();
    drawShepherd(g, true);
    g.generateTexture('shepherd-staff', SHEPHERD_W, SHEPHERD_H);
    g.destroy();
}

function drawShepherd (g: GameObjects.Graphics, withStaff: boolean): void {
    if (withStaff) {
        g.fillStyle(0x7a5c3e, 1);
        g.fillRect(31, 14, 3, 30);
        g.fillCircle(30, 13, 3.5);
        g.fillCircle(26, 11, 3.5);
        g.fillCircle(23, 14, 3);
        g.fillStyle(0xb08960, 1);
        g.fillRect(32, 18, 1, 18);
    }

    g.fillStyle(0x4a3728, 1);
    g.fillEllipse(22, 34, 24, 18);
    g.fillCircle(22, 28, 13);

    g.fillStyle(0x5c4634, 1);
    g.fillCircle(19, 27, 6);

    g.fillStyle(0x3d2c1e, 1);
    g.fillCircle(22, 15, 9);

    g.fillStyle(0xc4a574, 1);
    g.fillCircle(22, 18, 7);

    g.fillStyle(0x3d2c1e, 1);
    g.fillCircle(18, 13, 3.5);
    g.fillCircle(26, 13, 3.5);
    g.fillCircle(22, 11, 4);
}

function ensureShepherdShadow (scene: Scene): void {
    if (scene.textures.exists('shepherd-shadow')) {
        return;
    }

    const g = scene.add.graphics();
    g.fillStyle(0x3a2a18, 0.22);
    g.fillEllipse(22, 8, 28, 12);
    g.generateTexture('shepherd-shadow', 44, 16);
    g.destroy();
}
