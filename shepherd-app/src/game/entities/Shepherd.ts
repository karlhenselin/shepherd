import { Scene, GameObjects, Physics, Input, Math as PMath } from 'phaser';

const SPEED = 180;
const ARRIVE_DISTANCE = 8;
const SHEPHERD_W = 48;
const SHEPHERD_H = 48;
const SHEPHERD_DISPLAY = 56;
const SHADOW_OFFSET = 22;
const PET_MS = 1800;
const PET_KNEEL_ANGLE = 22;
const PET_SCALE_Y = 0.82;

export class Shepherd {
    readonly sprite: GameObjects.Sprite;
    private readonly body: Physics.Arcade.Body;
    private readonly shadow: GameObjects.Image;
    private readonly keys: { W?: Input.Keyboard.Key; A?: Input.Keyboard.Key; S?: Input.Keyboard.Key; D?: Input.Keyboard.Key };
    private target: PMath.Vector2 | null = null;
    private staffEquipped = false;
    private lyingDown = false;
    private whiteRobe = false;
    private pettingUntil = 0;
    /** Scripted walk / rescue — blocks player steer until clearGuidance(). */
    private guided = false;
    private arriveCallback: (() => void) | null = null;
    /** Unit vector of last non-zero velocity (flock trails opposite this). */
    private moveDirX = 1;
    private moveDirY = 0;

    constructor (scene: Scene, x: number, y: number) {
        ensureShepherdTextures(scene);
        ensureShepherdShadow(scene);

        this.shadow = scene.add.image(x, y + SHADOW_OFFSET, 'shepherd-shadow');
        this.shadow.setDepth(5);

        this.sprite = scene.physics.add.sprite(x, y, 'shepherd');
        this.sprite.setDepth(6);
        this.sprite.setDisplaySize(SHEPHERD_DISPLAY, SHEPHERD_DISPLAY);
        this.body = this.sprite.body as Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setCircle(14, 8, 10);

        const keyboard = scene.input.keyboard;
        this.keys = keyboard
            ? keyboard.addKeys('W,A,S,D') as { W: Input.Keyboard.Key; A: Input.Keyboard.Key; S: Input.Keyboard.Key; D: Input.Keyboard.Key }
            : {};

        scene.input.on('pointerdown', (pointer: Input.Pointer, currentlyOver: GameObjects.GameObject[]) => {
            if (currentlyOver?.some((obj) => obj.getData('ui'))) {
                return;
            }

            if (this.isPetting || this.lyingDown || this.guided) {
                return;
            }

            this.target = new PMath.Vector2(pointer.worldX, pointer.worldY);
        });
    }

    get hasStaff (): boolean {
        return this.staffEquipped;
    }

    get wearsWhite (): boolean {
        return this.whiteRobe;
    }

    get isPetting (): boolean {
        return this.sprite.scene.time.now < this.pettingUntil;
    }

    get isLyingDown (): boolean {
        return this.lyingDown;
    }

    get isGuided (): boolean {
        return this.guided;
    }

    get isMoving (): boolean {
        if (this.lyingDown || this.isPetting) {
            return false;
        }

        return Math.hypot(this.body.velocity.x, this.body.velocity.y) > 24;
    }

    /** Last travel direction as a unit vector (stable while standing still). */
    get moveHeading (): { x: number; y: number } {
        return { x: this.moveDirX, y: this.moveDirY };
    }

    equipStaff (equipped = true): void {
        this.staffEquipped = equipped;
        this.applyTexture();
    }

    wearWhite (): void {
        this.whiteRobe = true;
        this.applyTexture();
    }

    placeAt (x: number, y: number): void {
        this.sprite.setPosition(x, y);
        this.placeShadow();
    }

    /**
     * Walk to a point under script control (e.g. hole rescue).
     * Player input stays locked until clearGuidance().
     */
    guideTo (x: number, y: number, onArrive: () => void): void {
        if (this.lyingDown) {
            return;
        }

        this.guided = true;
        this.arriveCallback = onArrive;
        this.target = new PMath.Vector2(x, y);
        this.body.setVelocity(0, 0);
    }

    clearGuidance (): void {
        this.guided = false;
        this.arriveCallback = null;
        this.target = null;
        this.body.setVelocity(0, 0);
    }

    /** Kneel toward a sheep for a short cozy pet. */
    beginPetting (sheepX: number, _sheepY: number, durationMs = PET_MS): void {
        if (this.lyingDown) {
            return;
        }

        this.pettingUntil = this.sprite.scene.time.now + durationMs;
        this.target = null;
        this.arriveCallback = null;
        this.body.setVelocity(0, 0);
        this.sprite.setFlipX(sheepX < this.sprite.x);
        this.sprite.setAngle(this.sprite.flipX ? -PET_KNEEL_ANGLE : PET_KNEEL_ANGLE);
        this.sprite.setScale(1.04, PET_SCALE_Y);
        this.placeShadow();
    }

    lieDown (x: number, y: number): void {
        this.lyingDown = true;
        this.guided = false;
        this.arriveCallback = null;
        this.pettingUntil = 0;
        this.target = null;
        this.sprite.setPosition(x, y);
        this.sprite.setAngle(90);
        this.sprite.setScale(1, 1);
        this.body.setVelocity(0, 0);
        this.body.setImmovable(true);
        this.placeShadow();
    }

    wake (): void {
        this.lyingDown = false;
        this.guided = false;
        this.arriveCallback = null;
        this.pettingUntil = 0;
        this.target = null;
        this.sprite.setAngle(0);
        this.sprite.setScale(1, 1);
        this.body.setImmovable(false);
        this.body.setVelocity(0, 0);
        this.placeShadow();
    }

    private applyTexture (): void {
        const key = this.whiteRobe
            ? (this.staffEquipped ? 'shepherd-staff-white' : 'shepherd-white')
            : (this.staffEquipped ? 'shepherd-staff' : 'shepherd');
        this.sprite.setTexture(key);
        this.sprite.setDisplaySize(SHEPHERD_DISPLAY, SHEPHERD_DISPLAY);
    }

    update (): void {
        if (this.lyingDown) {
            this.body.setVelocity(0, 0);
            this.placeShadow();
            return;
        }

        if (this.isPetting) {
            this.body.setVelocity(0, 0);
            this.placeShadow();
            return;
        }

        if (this.pettingUntil > 0) {
            this.endPetting();
        }

        if (!this.guided) {
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
        }

        if (this.target) {
            const dx = this.target.x - this.sprite.x;
            const dy = this.target.y - this.sprite.y;

            if (Math.hypot(dx, dy) < ARRIVE_DISTANCE) {
                this.target = null;
                this.body.setVelocity(0, 0);
                this.placeShadow();
                const arrived = this.arriveCallback;
                this.arriveCallback = null;
                arrived?.();
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

    private endPetting (): void {
        this.pettingUntil = 0;
        this.sprite.setAngle(0);
        this.sprite.setScale(1, 1);
        this.placeShadow();
    }

    private faceVelocity (): void {
        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;
        const speed = Math.hypot(vx, vy);

        if (speed > 8) {
            this.moveDirX = vx / speed;
            this.moveDirY = vy / speed;
        }

        if (Math.abs(vx) > 8) {
            this.sprite.setFlipX(vx < 0);
        }
    }

    private placeShadow (): void {
        this.shadow.setPosition(this.sprite.x, this.sprite.y + SHADOW_OFFSET);
        this.shadow.setFlipX(this.sprite.flipX);
    }
}

function ensureShepherdTextures (scene: Scene): void {
    const keys = ['shepherd', 'shepherd-staff', 'shepherd-white', 'shepherd-staff-white'];
    const missing = keys.filter((key) => !scene.textures.exists(key));

    if (missing.length === 0) {
        return;
    }

    const g = scene.add.graphics();
    drawShepherd(g, false, false);
    g.generateTexture('shepherd', SHEPHERD_W, SHEPHERD_H);
    g.clear();
    drawShepherd(g, true, false);
    g.generateTexture('shepherd-staff', SHEPHERD_W, SHEPHERD_H);
    g.clear();
    drawShepherd(g, false, true);
    g.generateTexture('shepherd-white', SHEPHERD_W, SHEPHERD_H);
    g.clear();
    drawShepherd(g, true, true);
    g.generateTexture('shepherd-staff-white', SHEPHERD_W, SHEPHERD_H);
    g.destroy();
}

function drawShepherd (g: GameObjects.Graphics, withStaff: boolean, white: boolean): void {
    if (withStaff) {
        drawCrook(g, 31, 13, 30, white ? 0xd8c4a0 : 0x7a5c3e, white ? 0xf4ead8 : 0xb08960);
    }

    g.fillStyle(white ? 0xe8e4dc : 0x4a3728, 1);
    g.fillEllipse(22, 34, 24, 18);
    g.fillCircle(22, 28, 13);

    g.fillStyle(white ? 0xf7f3ea : 0x5c4634, 1);
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

function drawCrook (
    g: GameObjects.Graphics,
    shaftX: number,
    top: number,
    length: number,
    wood: number,
    light: number
): void {
    const thick = 2.5;
    const hookR = 6.5;
    const mid = shaftX + thick / 2;
    const cx = mid + hookR;
    const cy = top;
    const start = Math.PI;
    const end = Math.PI * 2 + 0.95;
    const steps = 20;

    g.fillStyle(wood, 1);
    g.fillRect(shaftX, top, thick, length);

    for (let i = 0; i <= steps; i++) {
        const a = start + (end - start) * (i / steps);
        g.fillCircle(cx + Math.cos(a) * hookR, cy + Math.sin(a) * hookR, thick / 2);
    }

    g.fillStyle(light, 1);
    g.fillRect(shaftX + 1, top + 5, 1, length - 10);
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
