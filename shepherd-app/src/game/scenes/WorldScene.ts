import { Scene, GameObjects, Scenes } from 'phaser';
import { Shepherd } from '../entities/Shepherd';
import { Sheep } from '../entities/Sheep';
import { findPointAwayFromAll, START_COL, START_ROW, WORLD_HEIGHT, WORLD_WIDTH, startCenter } from '../world/constants';
import { GrassPatch, placePasture } from '../world/GrassPatch';
import { WaterSource } from '../world/WaterSource';
import { watercolorWorld } from '../world/watercolorWorld';
import { speakCue, stopSpeech } from '../ui/speech';
import { psalm23Line } from '../data/scripture';
import { LostSheepHint } from '../ui/LostSheepHint';
import { GameSave, StoryCheckpoint, loadSave, writeSave } from '../save/gameSave';

const FLOCK_NAMES = ['Clover', 'Snowball', 'Biscuit', 'Milo'];

export class WorldScene extends Scene {
    private shepherd!: Shepherd;
    private flock: Sheep[] = [];
    private grass: GrassPatch[] = [];
    private water: WaterSource[] = [];
    private cueText!: GameObjects.Text;
    private lastCue = '';
    private scriptId = 0;
    private scriptPlaying = false;
    private lostHint!: LostSheepHint;
    private nextNames = FLOCK_NAMES.slice(1);
    private foundCount = 0;
    private heardPsalm1 = false;
    private heardPsalm2 = false;
    private heardPsalm3 = false;

    constructor () {
        super('WorldScene');
    }

    create (data?: { fromIntro?: boolean }): void {
        this.cameras.main.setBackgroundColor(0xf7f3ea);

        if (data?.fromIntro) {
            this.cameras.main.fadeIn(1200, 255, 255, 255);
        }

        const ground = watercolorWorld();
        const start = startCenter();
        ground.ensure(this, START_COL, START_ROW);
        ground.attachToWorld(this);

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        this.shepherd = new Shepherd(this, start.x, start.y);
        this.shepherd.sprite.setDepth(6);
        this.cameras.main.centerOn(start.x, start.y);
        this.cameras.main.startFollow(this.shepherd.sprite, true, 0.12, 0.12);

        const waterAt = { x: start.x + 270, y: start.y + 210 };
        this.water = [new WaterSource(this, waterAt.x, waterAt.y)];

        const pasture = findPointAwayFromAll(
            [start, waterAt],
            700,
            400
        );
        this.grass = placePasture(this, pasture);

        const save = loadSave();

        if (save) {
            this.restoreSave(save);
        }
        else {
            this.spawnSheep(FLOCK_NAMES[0], 0);
        }

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.scriptId += 1;
            stopSpeech();
        });

        this.input.once('pointerdown', () => {
            if (this.lastCue.length > 0 && !this.scriptPlaying) {
                speakCue(this.lastCue);
            }
        });

        this.cueText = this.add.text(16, 16, 'Find your sheep.', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#3d2c1e',
            backgroundColor: '#f3ead8cc',
            padding: { x: 10, y: 6 },
            wordWrap: { width: 720 }
        }).setScrollFactor(0).setDepth(20);

        this.lostHint = new LostSheepHint(this);
        this.showCue('Find your sheep.');
    }

    update (): void {
        this.shepherd.update();
        watercolorWorld().paintTrail(this.shepherd.sprite.x, this.shepherd.sprite.y);
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
    }

    private onFoundSheep (sheep: Sheep): void {
        this.foundCount += 1;

        if (this.foundCount === 1) {
            this.playLines([
                `You found ${sheep.name}.`,
                psalm23Line(1),
                `${sheep.name} is following you.`
            ], () => {
                sheep.hungry = true;
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
            psalm23Line(2)
        ], () => {
            this.spawnNextSheep();
        });
    }

    private onDrank (sheep: Sheep): void {
        if (this.heardPsalm3) {
            return;
        }

        this.heardPsalm3 = true;
        this.playLines([
            `${sheep.name} is drinking.`,
            psalm23Line(3)
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
            this.showCue(this.flockCue());
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

        if (this.flock.some((sheep) => sheep.mood === 'waiting')) {
            return 'Find your sheep.';
        }

        return 'The flock is with you.';
    }

    private hintTarget (): { x: number; y: number } | null {
        const lost = this.flock.filter((sheep) => sheep.mood === 'waiting');

        if (lost.length > 0) {
            return this.closestToShepherd(lost.map((sheep) => sheep.sprite));
        }

        if (this.flock.some((sheep) => sheep.hungry) && this.grass.length > 0) {
            return this.closestToShepherd(this.grass);
        }

        if (this.flock.some((sheep) => sheep.thirsty) && this.water.length > 0) {
            return this.closestToShepherd(this.water);
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
    }

    private saveProgress (checkpoint: StoryCheckpoint): void {
        const foundNames = this.flock
            .filter((sheep) => sheep.mood !== 'waiting')
            .map((sheep) => sheep.name);
        const waiting = this.flock.find((sheep) => sheep.mood === 'waiting');

        writeSave({
            version: 1,
            checkpoint,
            foundCount: this.foundCount,
            foundNames,
            waitingName: waiting?.name ?? null,
            nextNames: [...this.nextNames],
            heardPsalm1: this.heardPsalm1,
            heardPsalm2: this.heardPsalm2,
            heardPsalm3: this.heardPsalm3
        });
    }

    private restoreSave (save: GameSave): void {
        this.foundCount = save.foundCount;
        this.nextNames = [...save.nextNames];
        this.heardPsalm1 = save.heardPsalm1;
        this.heardPsalm2 = save.heardPsalm2;
        this.heardPsalm3 = save.heardPsalm3;

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
            sheep.thirsty = save.foundCount >= 2 && !save.heardPsalm3;
            this.flock.push(sheep);
        });

        if (save.waitingName) {
            this.spawnSheep(save.waitingName, this.flock.length);
        }
        else if (this.shouldHaveLostSheep(save)) {
            this.spawnNextSheep();
        }
    }

    private shouldHaveLostSheep (save: GameSave): boolean {
        return (save.heardPsalm2 && save.foundCount < 2)
            || (save.heardPsalm3 && save.nextNames.length > 0);
    }

    private spawnSheep (name: string, slot: number): void {
        const placed = [
            { x: this.shepherd.sprite.x, y: this.shepherd.sprite.y },
            ...this.flock.map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y })),
            ...this.grass,
            ...this.water
        ];
        const spawn = findPointAwayFromAll(placed, 1400, 1200);
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

    if (line.includes('Psalm 23:3')) {
        return 'psalm-23-3';
    }

    return null;
}
