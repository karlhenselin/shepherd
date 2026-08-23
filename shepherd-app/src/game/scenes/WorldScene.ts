import { Scene, GameObjects, Scenes } from 'phaser';
import { Shepherd } from '../entities/Shepherd';
import { Sheep } from '../entities/Sheep';
import { findPointAwayFromAll, WORLD_HEIGHT, WORLD_WIDTH, startCenter } from '../world/constants';
import { GrassPatch, placePasture } from '../world/GrassPatch';
import { WaterSource } from '../world/WaterSource';
import { Sheepfold } from '../world/Sheepfold';
import { Hole } from '../world/Hole';
import { StaffPickup } from '../world/StaffPickup';
import { watercolorWorld } from '../world/watercolorWorld';
import { speakCue, stopSpeech } from '../ui/speech';
import { startHowling, stopHowling } from '../audio/howl';
import { isaiah53Line, john10Line, psalm23Comfort, psalm23Half } from '../data/scripture';
import { LostSheepHint } from '../ui/LostSheepHint';
import { GameSave, StoryCheckpoint, loadSave, writeSave } from '../save/gameSave';

const FLOCK_NAMES = ['Clover', 'Snowball', 'Biscuit', 'Milo'];
const BANDAGE_RANGE = 100;
const WALK_A_BIT = 420;

export class WorldScene extends Scene {
    private shepherd!: Shepherd;
    private flock: Sheep[] = [];
    private grass: GrassPatch[] = [];
    private water: WaterSource[] = [];
    private sheepfold!: Sheepfold;
    private staffPickup: StaffPickup | null = null;
    private nightVeil!: GameObjects.Rectangle;
    private cueText!: GameObjects.Text;
    private bandageButton!: GameObjects.Text;
    private lastCue = '';
    private scriptId = 0;
    private scriptPlaying = false;
    private lostHint!: LostSheepHint;
    private nextNames = FLOCK_NAMES.slice(1);
    private foundCount = 0;
    private heardPsalm1 = false;
    private heardPsalm2 = false;
    private heardPsalm2b = false;
    private heardPsalm3 = false;
    private heardPsalm3b = false;
    private heardPsalm4a = false;
    private heardPsalm4b = false;
    private heardPsalm4c = false;
    private heardJohn102 = false;
    private heardJohn109 = false;
    private nightStarted = false;
    private walkFrom: { x: number; y: number } | null = null;

    constructor () {
        super('WorldScene');
    }

    create (data?: { fromIntro?: boolean }): void {
        this.resetRun();
        this.cameras.main.setBackgroundColor(0xf7f3ea);

        if (data?.fromIntro) {
            this.cameras.main.fadeIn(1200, 255, 255, 255);
        }

        this.playWanderlust();

        const ground = watercolorWorld();
        const start = startCenter();
        ground.beginCreation();
        ground.attachToWorld(this);

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        this.shepherd = new Shepherd(this, start.x, start.y);
        this.shepherd.sprite.setDepth(6);
        this.cameras.main.centerOn(start.x, start.y);
        this.cameras.main.startFollow(this.shepherd.sprite, true, 0.12, 0.12);

        const waterAt = { x: start.x + 270, y: start.y + 210 };
        this.water = [new WaterSource(this, waterAt.x, waterAt.y)];

        const foldAt = { x: WORLD_WIDTH - 320, y: WORLD_HEIGHT - 260 };
        this.sheepfold = new Sheepfold(this, foldAt.x, foldAt.y);

        const pasture = findPointAwayFromAll(
            [start, waterAt, foldAt],
            700,
            400
        );
        this.grass = placePasture(this, pasture);

        this.cueText = this.add.text(16, 16, 'Find your sheep.', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#3d2c1e',
            backgroundColor: '#f3ead8cc',
            padding: { x: 10, y: 6 },
            wordWrap: { width: 720 }
        }).setScrollFactor(0).setDepth(20);

        this.addSettingsButton();

        this.nightVeil = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x120e1c, 1)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(15)
            .setAlpha(0);

        this.lostHint = new LostSheepHint(this);
        this.addBandageButton();

        const save = loadSave();

        if (save) {
            this.restoreSave(save);

            if (!this.scriptPlaying) {
                this.showCue(this.flockCue());
            }
        }
        else {
            this.spawnSheep(FLOCK_NAMES[0], 0);
            this.showCue('Find your sheep.');
        }

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.scriptId += 1;
            stopSpeech();
            stopHowling();
            this.sound.stopByKey('wanderlust');
        });

        this.input.once('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: GameObjects.GameObject[]) => {
            if (currentlyOver?.some((obj) => obj.getData('ui'))) {
                return;
            }

            if (this.lastCue.length > 0 && !this.scriptPlaying) {
                speakCue(this.lastCue);
            }
        });
    }

    update (): void {
        this.shepherd.update();
        watercolorWorld().rainIntoView(this);
        watercolorWorld().tick(this, this.time.now);

        for (const sheep of this.flock) {
            const event = sheep.update(this.shepherd, this.water, this.grass);

            if (event === 'found') {
                this.onFoundSheep(sheep);
            }
            else if (event === 'ate') {
                this.onAte(sheep);
            }
            else if (event === 'drank') {
                this.onDrank(sheep);
            }
        }

        if (!this.scriptPlaying) {
            const cue = this.flockCue();

            if (cue !== this.lastCue) {
                this.showCue(cue);
            }
        }

        this.lostHint.update(this, this.shepherd, this.hintTarget());
        this.updateBandageButton();
        this.maybeSpeakRighteousness();
        this.maybeHowl();
        this.maybePickupStaff();
        this.maybeReachPen();
    }

    private onFoundSheep (sheep: Sheep): void {
        this.foundCount += 1;

        if (this.foundCount === 1) {
            this.playLines([
                `You found ${sheep.name}.`,
                psalm23Half(1, 'a'),
                `${sheep.name} is following you.`
            ], () => {
                this.beginHunger(sheep);
            });
            return;
        }

        if (this.foundCount === 2) {
            this.playLines([
                `You found ${sheep.name}.`,
                `${sheep.name} is following you.`
            ], () => {
                this.makeFlockThirsty();
            });
            return;
        }

        if (sheep.hurt) {
            this.saveProgress('hurt-sheep');
            this.playLines([
                `You found ${sheep.name}.`,
                `${sheep.name} is hurt.`
            ]);
            return;
        }

        this.playLines([
            `You found ${sheep.name}.`,
            `${sheep.name} is following you.`
        ], () => {
            this.spawnNextSheep();
        });
    }

    private onAte (sheep: Sheep): void {
        if (this.heardPsalm2) {
            return;
        }

        this.heardPsalm2 = true;
        this.playLines([
            `${sheep.name} is eating.`,
            psalm23Half(2, 'a'),
            isaiah53Line()
        ], () => {
            this.spawnNextSheep();
        });
    }

    private onDrank (sheep: Sheep): void {
        if (this.heardPsalm2b) {
            return;
        }

        this.heardPsalm2b = true;
        this.playLines([
            `${sheep.name} is drinking.`,
            psalm23Half(2, 'b')
        ], () => {
            this.spawnNextSheep();
        });
    }

    private playLines (lines: string[], onDone?: () => void): void {
        const id = ++this.scriptId;
        this.scriptPlaying = true;
        this.speakLines(id, lines, onDone);
    }

    private speakLines (id: number, lines: string[], onDone?: () => void): void {
        if (id !== this.scriptId) {
            return;
        }

        if (lines.length === 0) {
            this.scriptPlaying = false;
            onDone?.();

            if (!this.scriptPlaying) {
                this.showCue(this.flockCue());
            }

            return;
        }

        const [line, ...rest] = lines;
        this.showCue(line, false);

        const checkpoint = checkpointForLine(line);

        if (checkpoint) {
            this.markScripture(checkpoint);
            this.saveProgress(checkpoint);
        }

        speakCue(line, () => this.speakLines(id, rest, onDone));
    }

    private beginHunger (sheep: Sheep): void {
        sheep.hungry = true;
        this.playLines([
            `${sheep.name} is hungry.`,
            psalm23Half(1, 'b')
        ]);
    }

    private makeFlockThirsty (): void {
        for (const sheep of this.flock) {
            if (sheep.mood === 'waiting') {
                continue;
            }

            sheep.thirsty = true;
        }
    }

    private flockCue (): string {
        const eating = this.flock.find((sheep) => sheep.mood === 'eating');

        if (eating) {
            return `${eating.name} is eating.`;
        }

        const drinking = this.flock.find((sheep) => sheep.mood === 'drinking');

        if (drinking) {
            return `${drinking.name} is drinking.`;
        }

        const hungry = this.flock.find((sheep) => sheep.hungry);

        if (hungry) {
            return `${hungry.name} is hungry.`;
        }

        const thirsty = this.flock.find((sheep) => sheep.thirsty);

        if (thirsty) {
            return `${thirsty.name} is thirsty.`;
        }

        if (this.flock.some((sheep) => sheep.mood === 'waiting' || (sheep.hurt && !sheep.discovered))) {
            return this.foundCount === 1 ? 'Another sheep is missing.' : 'Find your sheep.';
        }

        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);

        if (hurt) {
            return `Bandage ${hurt.name}.`;
        }

        if (this.heardJohn109) {
            return 'The flock is home.';
        }

        if (this.nightStarted) {
            return this.heardJohn102 ? 'You reached the pen.' : 'Guide the flock to the pen.';
        }

        return 'The flock is with you.';
    }

    private hintTarget (): { x: number; y: number } | null {
        const lost = this.flock.filter((sheep) => sheep.mood === 'waiting' || (sheep.hurt && !sheep.discovered));

        if (lost.length > 0) {
            return this.closestToShepherd(lost.map((sheep) => sheep.sprite));
        }

        const toBandage = this.flock.filter((sheep) => sheep.hurt && sheep.discovered);

        if (toBandage.length > 0) {
            return this.closestToShepherd(toBandage.map((sheep) => sheep.sprite));
        }

        if (this.flock.some((sheep) => sheep.hungry) && this.grass.length > 0) {
            return this.closestToShepherd(this.grass);
        }

        if (this.flock.some((sheep) => sheep.thirsty) && this.water.length > 0) {
            return this.closestToShepherd(this.water);
        }

        if (this.nightStarted && !this.heardJohn102) {
            return this.sheepfold;
        }

        return null;
    }

    private closestToShepherd (points: { x: number; y: number }[]): { x: number; y: number } {
        let closest = points[0];
        let best = Number.POSITIVE_INFINITY;

        for (const point of points) {
            const dist = Math.hypot(point.x - this.shepherd.sprite.x, point.y - this.shepherd.sprite.y);

            if (dist < best) {
                best = dist;
                closest = point;
            }
        }

        return closest;
    }

    private playWanderlust (): void {
        const start = (): void => {
            if (!this.sys.isActive() || this.sound.isPlaying('wanderlust')) {
                return;
            }

            this.sound.play('wanderlust', {
                loop: true,
                volume: 0.4
            });
        };

        start();

        if (this.sound.locked) {
            this.sound.once('unlocked', start);
        }
    }

    private showCue (text: string, speak = true): void {
        this.cueText.setText(text);

        if (text !== this.lastCue && speak) {
            speakCue(text);
        }

        this.lastCue = text;
    }

    private spawnNextSheep (): void {
        const name = this.nextNames.shift();

        if (!name) {
            return;
        }

        this.spawnSheep(name, this.flock.length);
    }

    private markScripture (checkpoint: StoryCheckpoint): void {
        if (checkpoint === 'psalm-23-1') {
            this.heardPsalm1 = true;
        }

        if (checkpoint === 'psalm-23-2') {
            this.heardPsalm2 = true;
        }

        if (checkpoint === 'psalm-23-3') {
            this.heardPsalm3 = true;
        }

        if (checkpoint === 'psalm-23-3b') {
            this.heardPsalm3b = true;
        }

        if (checkpoint === 'psalm-23-4a') {
            this.heardPsalm4a = true;
        }

        if (checkpoint === 'psalm-23-4b') {
            this.heardPsalm4b = true;
        }

        if (checkpoint === 'psalm-23-4c') {
            this.heardPsalm4c = true;
        }

        if (checkpoint === 'john-10-2') {
            this.heardJohn102 = true;
        }

        if (checkpoint === 'john-10-9') {
            this.heardJohn109 = true;
        }
    }

    private saveProgress (checkpoint: StoryCheckpoint): void {
        const foundNames = this.flock
            .filter((sheep) => sheep.mood !== 'waiting' && sheep.mood !== 'hurt')
            .map((sheep) => sheep.name);
        const waiting = this.flock.find((sheep) => sheep.mood === 'waiting' || sheep.mood === 'hurt');

        writeSave({
            version: 1,
            checkpoint,
            foundCount: this.foundCount,
            foundNames,
            waitingName: waiting?.name ?? null,
            nextNames: [...this.nextNames],
            heardPsalm1: this.heardPsalm1,
            heardPsalm2: this.heardPsalm2,
            heardPsalm2b: this.heardPsalm2b,
            heardPsalm3: this.heardPsalm3,
            heardPsalm3b: this.heardPsalm3b,
            heardPsalm4a: this.heardPsalm4a,
            heardPsalm4b: this.heardPsalm4b,
            heardPsalm4c: this.heardPsalm4c,
            heardJohn102: this.heardJohn102,
            heardJohn109: this.heardJohn109,
            hasStaff: this.shepherd.hasStaff
        });
    }

    private restoreSave (save: GameSave): void {
        this.foundCount = save.foundCount;
        this.nextNames = [...save.nextNames];
        this.heardPsalm1 = save.heardPsalm1;
        this.heardPsalm2 = save.heardPsalm2;
        this.heardPsalm2b = save.heardPsalm2b === true || save.heardPsalm3;
        this.heardPsalm3 = save.heardPsalm3;
        this.heardPsalm3b = save.heardPsalm3b === true;
        this.heardPsalm4a = save.heardPsalm4a === true;
        this.heardPsalm4b = save.heardPsalm4b === true;
        this.heardPsalm4c = save.heardPsalm4c === true;
        this.heardJohn102 = save.heardJohn102 === true;
        this.heardJohn109 = save.heardJohn109 === true;

        save.foundNames.forEach((name, slot) => {
            const angle = (slot / Math.max(save.foundNames.length, 1)) * Math.PI * 2;
            const sheep = new Sheep(
                this,
                this.shepherd.sprite.x + Math.cos(angle) * 56,
                this.shepherd.sprite.y + Math.sin(angle) * 56,
                name,
                slot
            );
            sheep.beginFollowing();
            sheep.hungry = save.heardPsalm1 && !save.heardPsalm2;
            sheep.thirsty = save.foundCount >= 2 && !this.heardPsalm2b;
            this.flock.push(sheep);
        });

        if (save.waitingName) {
            this.spawnSheep(save.waitingName, this.flock.length);
            const trapped = this.flock[this.flock.length - 1];

            if (save.foundCount >= 3 && trapped.hurt) {
                trapped.markDiscovered();
            }
        }
        else if (this.shouldHaveLostSheep(save)) {
            this.spawnNextSheep();
        }

        if (this.heardPsalm4a) {
            this.applyNight(false);
        }
        else if (this.heardPsalm3b) {
            this.beginNight();
        }
        else if (this.heardPsalm3 && !this.heardPsalm3b) {
            this.beginWalkWatch();
        }

        if (this.heardPsalm4a && !this.heardPsalm4b) {
            this.beginWalkWatch();
        }

        if (save.hasStaff) {
            this.shepherd.equipStaff(true);
        }
        else if (this.heardPsalm4c) {
            this.placeStaff(false);
        }

        if (this.heardJohn109) {
            this.settleFold();
        }
    }

    private shouldHaveLostSheep (save: GameSave): boolean {
        return (save.heardPsalm2 && save.foundCount < 2)
            || (this.heardPsalm2b && save.foundCount < 3 && save.nextNames.length > 0);
    }

    private resetRun (): void {
        this.flock = [];
        this.grass = [];
        this.water = [];
        this.lastCue = '';
        this.scriptPlaying = false;
        this.nextNames = FLOCK_NAMES.slice(1);
        this.foundCount = 0;
        this.heardPsalm1 = false;
        this.heardPsalm2 = false;
        this.heardPsalm2b = false;
        this.heardPsalm3 = false;
        this.heardPsalm3b = false;
        this.heardPsalm4a = false;
        this.heardPsalm4b = false;
        this.heardPsalm4c = false;
        this.heardJohn102 = false;
        this.heardJohn109 = false;
        this.nightStarted = false;
        this.staffPickup = null;
        this.walkFrom = null;
    }

    private addSettingsButton (): void {
        const button = this.add.text(this.scale.width - 16, 16, 'Settings', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#3d2c1e',
            backgroundColor: '#f3ead8cc',
            padding: { x: 10, y: 6 }
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(21).setInteractive({ useHandCursor: true });

        button.setData('ui', true);
        button.on('pointerover', () => button.setColor('#5c4634'));
        button.on('pointerout', () => button.setColor('#3d2c1e'));
        button.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openSettings();
        });
    }

    private addBandageButton (): void {
        this.bandageButton = this.add.text(16, 56, 'Bandage', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#3d2c1e',
            backgroundColor: '#f3ead8cc',
            padding: { x: 10, y: 6 }
        }).setScrollFactor(0).setDepth(21).setInteractive({ useHandCursor: true }).setVisible(false);

        this.bandageButton.setData('ui', true);
        this.bandageButton.on('pointerover', () => this.bandageButton.setColor('#5c4634'));
        this.bandageButton.on('pointerout', () => this.bandageButton.setColor('#3d2c1e'));
        this.bandageButton.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.tryBandage();
        });
    }

    private updateBandageButton (): void {
        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);
        this.bandageButton.setVisible(Boolean(hurt) && !this.scriptPlaying);
    }

    private tryBandage (): void {
        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);

        if (!hurt || this.scriptPlaying) {
            return;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - hurt.sprite.x,
            this.shepherd.sprite.y - hurt.sprite.y
        );

        if (dist > BANDAGE_RANGE) {
            this.showCue('Get closer.');
            return;
        }

        hurt.heal();
        this.bandageButton.setVisible(false);
        this.playLines([
            `You bandage ${hurt.name}.`,
            psalm23Half(3, 'a'),
            `${hurt.name} is following you.`
        ], () => {
            this.beginWalkWatch();
        });
    }

    private openSettings (): void {
        if (this.scene.isActive('SettingsScene')) {
            return;
        }

        stopSpeech();
        this.scene.pause();
        this.scene.launch('SettingsScene');
    }

    private beginWalkWatch (): void {
        this.walkFrom = {
            x: this.shepherd.sprite.x,
            y: this.shepherd.sprite.y
        };
    }

    private maybeSpeakRighteousness (): void {
        if (this.heardPsalm3b || !this.heardPsalm3 || this.scriptPlaying || !this.walkFrom) {
            return;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - this.walkFrom.x,
            this.shepherd.sprite.y - this.walkFrom.y
        );

        if (dist < WALK_A_BIT) {
            return;
        }

        this.walkFrom = null;
        this.playLines([psalm23Half(3, 'b')], () => {
            this.beginNight();
        });
    }

    private beginNight (): void {
        if (this.nightStarted) {
            return;
        }

        this.applyNight(true);
        this.playLines([
            'Night is falling.',
            psalm23Half(4, 'a')
        ], () => {
            this.beginWalkWatch();
        });
    }

    private maybeHowl (): void {
        if (this.heardPsalm4b || !this.heardPsalm4a || this.scriptPlaying || !this.walkFrom) {
            return;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - this.walkFrom.x,
            this.shepherd.sprite.y - this.walkFrom.y
        );

        if (dist < WALK_A_BIT) {
            return;
        }

        this.walkFrom = null;
        startHowling();
        this.playLines([psalm23Half(4, 'b')], () => {
            stopHowling();
            this.placeStaff(true);
        });
    }

    private placeStaff (announce: boolean): void {
        if (this.staffPickup || this.shepherd.hasStaff) {
            return;
        }

        const from = this.shepherd.sprite;
        const to = this.sheepfold;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const step = Math.min(240, len * 0.4);

        this.staffPickup = new StaffPickup(this, from.x + (dx / len) * step, from.y + (dy / len) * step);

        if (announce) {
            this.playLines([psalm23Comfort()]);
        }
    }

    private maybePickupStaff (): void {
        if (!this.staffPickup || this.scriptPlaying) {
            return;
        }

        if (!this.staffPickup.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
            return;
        }

        this.staffPickup.destroy();
        this.staffPickup = null;
        this.shepherd.equipStaff(true);
        this.saveProgress('psalm-23-4c');
    }

    private maybeReachPen (): void {
        if (this.heardJohn102 || this.heardJohn109 || !this.nightStarted || this.scriptPlaying) {
            return;
        }

        if (!this.sheepfold.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
            return;
        }

        this.playLines([john10Line(2)], () => {
            this.closeFold();
        });
    }

    private closeFold (): void {
        this.flock.forEach((sheep, slot) => {
            const rest = this.sheepfold.restSpot(slot);
            sheep.enterPen(rest.x, rest.y);
        });
        this.shepherd.lieDown(this.sheepfold.gateSpot().x, this.sheepfold.gateSpot().y);
        this.playLines([john10Line(9)]);
    }

    private settleFold (): void {
        this.flock.forEach((sheep, slot) => {
            const rest = this.sheepfold.restSpot(slot);
            sheep.settleInPen(rest.x, rest.y);
        });
        this.shepherd.lieDown(this.sheepfold.gateSpot().x, this.sheepfold.gateSpot().y);
    }

    private applyNight (animate: boolean): void {
        this.nightStarted = true;

        if (animate) {
            this.tweens.add({
                targets: this.nightVeil,
                alpha: 0.55,
                duration: 2800,
                ease: 'Sine.easeInOut'
            });
            return;
        }

        this.nightVeil.setAlpha(0.55);
    }

    private spawnSheep (name: string, slot: number): void {
        const placed = [
            { x: this.shepherd.sprite.x, y: this.shepherd.sprite.y },
            ...this.flock.map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y })),
            ...this.grass,
            ...this.water,
            this.sheepfold
        ];
        const spawn = findPointAwayFromAll(placed, 1400, 1200);

        if (slot === 2 && !this.heardPsalm3) {
            new Hole(this, spawn.x, spawn.y);
            const trapped = new Sheep(this, spawn.x, spawn.y + 10, name, slot);
            trapped.trapInHole();
            this.flock.push(trapped);
            return;
        }

        this.flock.push(new Sheep(this, spawn.x, spawn.y, name, slot));
    }
}

function checkpointForLine (line: string): StoryCheckpoint | null {
    if (line.includes('Psalm 23:1')) {
        return 'psalm-23-1';
    }

    if (line.includes('Psalm 23:2')) {
        return 'psalm-23-2';
    }

    if (line.includes('Isaiah 53:6')) {
        return 'isaiah-53-6';
    }

    if (line.includes('Psalm 23:3b')) {
        return 'psalm-23-3b';
    }

    if (line.includes('Psalm 23:3')) {
        return 'psalm-23-3';
    }

    if (line.includes('Psalm 23:4c')) {
        return 'psalm-23-4c';
    }

    if (line.includes('Psalm 23:4b')) {
        return 'psalm-23-4b';
    }

    if (line.includes('Psalm 23:4')) {
        return 'psalm-23-4a';
    }

    if (line.includes('John 10:2')) {
        return 'john-10-2';
    }

    if (line.includes('John 10:9')) {
        return 'john-10-9';
    }

    return null;
}
