import { Scene, GameObjects, Scenes } from 'phaser';
import { Shepherd } from '../entities/Shepherd';
import { FOLLOW_DISTANCE, FOLLOW_SPEED, Sheep } from '../entities/Sheep';
import {
    findPointAwayFromAll,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    farthestCornerFrom,
    PASTURE_COL,
    PASTURE_ROW,
    regionCenter,
    startCenter,
    WATER_COL,
    WATER_ROW
} from '../world/constants';
import { GrassPatch, placePasture } from '../world/GrassPatch';
import { WaterSource } from '../world/WaterSource';
import { Sheepfold } from '../world/Sheepfold';
import { Hole, HOLE_KEEP_OUT_RADIUS } from '../world/Hole';
import { StaffPickup } from '../world/StaffPickup';
import { BibleGem, placeBibleGems, spawnBibleGemAway } from '../world/BibleGem';
import { watercolorWorld } from '../world/watercolorWorld';
import { speakCue, stopSpeech } from '../ui/speech';
import { startHowling, stopHowling, suspendHowling, syncHowling, unsuspendHowling } from '../audio/howl';
import { isSoundOn, setSoundOn } from '../audio/soundPref';
import { WANDERLUST_KEY, WONDERS_KEY, fadeInWorldMusic, fadeOutWorldMusic, setWorldMusicTrack, startWorldMusic, stopWorldMusic } from '../audio/worldMusic';
import { cueWaitingBleat, holdSheepSounds, playHappyBaah, playLaggingBaah, playStrayBaah, stopSheepSounds, tickNightBaahs as tickNightFlockBaahs, tickSheepSounds } from '../audio/sheepSounds';
import { corinthians15Line, isaiah53Line, john10Line, psalm23Comfort, psalm23Half } from '../data/scripture';
import { LostSheepHint } from '../ui/LostSheepHint';
import { spawnPetHeart } from '../ui/petHeart';
import { BandageButton } from '../ui/BandageButton';
import { SETTINGS_GEAR_KEY, SETTINGS_GEAR_SIZE, ensureSettingsGear } from '../ui/settingsGear';
import { SOUND_ICON_SIZE, ensureSoundIcons, soundIconKey } from '../ui/soundIcon';
import { TREASURE_CHEST_KEY, TREASURE_CHEST_SIZE, ensureTreasureChest } from '../ui/treasureChest';
import { GameSave, StoryCheckpoint, loadSave, writeSave } from '../save/gameSave';

const FLOCK_NAMES = ['Clover', 'Snowball', 'Biscuit', 'Milo'];
const SHEPHERD_SPEED = 180;
const STRAY_AHEAD_DISTANCE = FOLLOW_DISTANCE + (SHEPHERD_SPEED - FOLLOW_SPEED) * 7;
/** Once lagging sheep crosses this fraction of stray distance, fire one warning baah. */
const STRAY_WARN_RATIO = 0.78;
/** Drop below this fraction to allow another warning if they fall behind again. */
const STRAY_WARN_RESET_RATIO = 0.55;
const STRAY_COOLDOWN_MS = 18000;
const STRAY_TELEPORT_MIN = 1300;
const STRAY_TELEPORT_GAP = 200;
/** Initial / next waiting sheep: farther than before so unfound sheep feel a region away. */
const WAITING_SPAWN_MIN = 2100;
const WAITING_SPAWN_GAP = 1800;
const BANDAGE_RANGE = 100;
/** Kneel duration while bandaging the trapped sheep. */
const BANDAGE_KNEEL_MS = 2000;
/** Apply heal / scripture a beat into the kneel. */
const BANDAGE_HEAL_AT_MS = 650;
const HOLE_ASIDE_DIST = 118;
const HOLE_ENTER_NUDGE = 16;
/** Pause stray teleport / lag warning and walk-into petting while shepherd is this close to the hole. */
const HOLE_PROXIMITY_PAUSE = 200;
const WALK_A_BIT = 420;
const NIGHT_VEIL_ALPHA = 0.55;
const NIGHT_VEIL_DEEPEN = 1.10;
const NIGHT_DEEPEN_MS = 60_000;
const NIGHT_FADE_IN_MS = 2800;
/**
 * Restored following sheep ring radius. Must stay well beyond FOLLOW_DISTANCE (56) +
 * PET_DISTANCE (~50) so sheep do not sit in walk-into pet range on load.
 */
const RESTORE_FOLLOW_RING = 200;
/** Timed belt-and-suspenders block on walk-into pets after create (find celebration bypasses). */
const PETTING_SUPPRESS_MS = 3500;
/** Shepherd must leave spawn by this much before walk-into pets unlock after a restore. */
const PET_UNLOCK_MOVE_PX = 40;

/** Short cozy lines for walk-into pets (skipped while a scripture script is playing). */
const PET_LINES: Array<(name: string) => string> = [
    (name) => `Got you, ${name}!`,
    (name) => `Hey ${name}.`,
    (name) => `Hey ${name}!`,
    (name) => `There you are, ${name}.`,
    (name) => `Good ${name}.`,
    () => 'Hey bud.',
    () => 'Good little sheepy.',
    () => 'What a soft little sheep.',
    () => 'Easy now.',
    (name) => `Love you, ${name}.`,
    () => 'Sweet sheep.',
    () => 'Such a good sheep.'
];

export class WorldScene extends Scene {
    private shepherd!: Shepherd;
    private flock: Sheep[] = [];
    private grass: GrassPatch[] = [];
    private water: WaterSource[] = [];
    private sheepfold: Sheepfold | null = null;
    private hole: Hole | null = null;
    private staffPickup: StaffPickup | null = null;
    private gems: BibleGem[] = [];
    private foundGems: string[] = [];
    private lastCheckpoint: StoryCheckpoint | null = null;
    private nightVeil!: GameObjects.Rectangle;
    private cueText!: GameObjects.Text;
    private soundToggle!: GameObjects.Image;
    private bandageButton!: BandageButton;
    private bandageRescuing = false;
    private lastCue = '';
    private scriptId = 0;
    private scriptPlaying = false;
    private strayReadyAt = 0;
    private lagWarned = new WeakSet<Sheep>();
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
    private heardCorinthians = false;
    private nightStarted = false;
    private nightDarkAt = 0;
    private nightFadeInMs = 0;
    private sleepVeil!: GameObjects.Rectangle;
    private walkFrom: { x: number; y: number } | null = null;
    /** Walk-into petting allowed once `time.now` reaches this (set on create). */
    private pettingReadyAt = 0;
    /**
     * After restore: walk-into pets stay locked until the shepherd moves
     * `PET_UNLOCK_MOVE_PX` from this origin (find celebration still allowed).
     */
    private loadPetsLocked = false;
    private petUnlockOrigin = { x: 0, y: 0 };

    constructor () {
        super('WorldScene');
    }

    create (data?: { fromIntro?: boolean }): void {
        this.resetRun();
        this.cameras.main.setBackgroundColor(0xf7f3ea);

        if (data?.fromIntro) {
            this.cameras.main.fadeIn(1200, 255, 255, 255);
        }

        this.events.on(Scenes.Events.PAUSE, () => this.holdWorldAudio());
        this.events.on(Scenes.Events.RESUME, () => this.releaseWorldAudio());
        this.game.events.on('blur', this.holdWorldAudio, this);
        this.game.events.on('hidden', this.holdWorldAudio, this);
        this.game.events.on('focus', this.releaseWorldAudio, this);
        this.game.events.on('visible', this.releaseWorldAudio, this);
        this.sound.mute = !isSoundOn();

        const ground = watercolorWorld();
        const start = startCenter();
        ground.beginCreation();
        ground.attachToWorld(this);

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        this.shepherd = new Shepherd(this, start.x, start.y);
        this.shepherd.sprite.setDepth(6);

        const save = loadSave();

        if (save?.player) {
            this.shepherd.placeAt(save.player.x, save.player.y);
        }

        this.cameras.main.centerOn(this.shepherd.sprite.x, this.shepherd.sprite.y);
        this.cameras.main.startFollow(this.shepherd.sprite, true, 0.12, 0.12);

        const waterAt = regionCenter(WATER_COL, WATER_ROW);
        this.water = save?.water?.length
            ? save.water.map((point) => new WaterSource(this, point.x, point.y))
            : [new WaterSource(this, waterAt.x, waterAt.y)];

        if (save?.grass?.length) {
            this.grass = save.grass.map((point) => new GrassPatch(this, point.x, point.y));
        }
        else {
            this.grass = placePasture(this, regionCenter(PASTURE_COL, PASTURE_ROW));
        }

        if (save?.pen) {
            this.ensurePen(save.pen);
        }

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

        this.sleepVeil = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 1)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(19)
            .setAlpha(0);

        this.lostHint = new LostSheepHint(this);
        this.addBandageButton();

        if (save) {
            this.foundGems = save.foundGems ?? [];
            this.lastCheckpoint = save.checkpoint;
            this.restoreSave(save);

            if (!this.scriptPlaying) {
                this.showCue(this.flockCue());
            }
        }
        else {
            this.spawnSheep(FLOCK_NAMES[0], 0);
            this.showCue('Find your sheep.');
        }

        this.gems = placeBibleGems(this, this.foundGems, {
            x: this.shepherd.sprite.x,
            y: this.shepherd.sprite.y
        });

        this.playWorldMusic();
        this.pettingReadyAt = this.time.now + PETTING_SUPPRESS_MS;

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.scriptId += 1;
            this.game.events.off('blur', this.holdWorldAudio, this);
            this.game.events.off('hidden', this.holdWorldAudio, this);
            this.game.events.off('focus', this.releaseWorldAudio, this);
            this.game.events.off('visible', this.releaseWorldAudio, this);
            stopSpeech();
            stopHowling();
            stopWorldMusic(this);
            stopSheepSounds(this);
        });

        this.input.on('pointerdown', () => {
            this.playWorldMusic();
            unsuspendHowling();
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

        const holeKeepOut = this.holeKeepOut();

        for (const sheep of this.flock) {
            const event = sheep.update(this.shepherd, this.water, this.grass, this.nightStarted, holeKeepOut);

            if (event === 'found') {
                this.onFoundSheep(sheep);
            }
            else if (event === 'rejoined') {
                this.strayReadyAt = this.time.now + STRAY_COOLDOWN_MS;
                this.celebrateFinding(sheep);
            }
            else if (event === 'ate') {
                this.onAte(sheep);
            }
            else if (event === 'drank') {
                this.onDrank(sheep);
            }
        }

        this.maybeStrayFlock();

        if (!this.scriptPlaying) {
            const cue = this.flockCue();

            if (cue !== this.lastCue) {
                this.showCue(cue);
            }
        }

        this.tickNightDarkness();
        this.tickNightBaahs();
        tickSheepSounds(this, this.flock, this.shepherd.sprite, this.nightStarted);
        this.lostHint.update(this, this.shepherd, this.hintTarget(), Boolean(this.staffPickup));
        this.updateBandageButton();
        this.tickPetting();
        this.maybeSpeakRighteousness();
        this.maybeHowl();
        this.maybePickupStaff();
        this.maybeCollectGem();
        this.maybeReachPen();
    }

    /** Shepherd kneels to pet a nearby following sheep; sheep baahs and dances. */
    private tickPetting (): void {
        if (
            this.time.now < this.pettingReadyAt
            || this.nightStarted
            || this.scriptPlaying
            || this.bandageRescuing
            || this.isNearHole()
            || this.shepherd.isLyingDown
            || this.shepherd.isPetting
            || this.shepherd.isGuided
        ) {
            return;
        }

        const sx = this.shepherd.sprite.x;
        const sy = this.shepherd.sprite.y;

        for (const sheep of this.flock) {
            if (!sheep.canBePetted() || !sheep.isCloseEnoughToPet(sx, sy)) {
                continue;
            }

            this.startPetting(sheep);
            return;
        }
    }

    private startPetting (sheep: Sheep): void {
        // No kneel / pet / dance at night (walk-into or find celebration).
        if (this.nightStarted) {
            return;
        }

        this.shepherd.beginPetting(sheep.sprite.x, sheep.sprite.y);
        sheep.beginHappyDance();
        playHappyBaah(this, sheep, this.shepherd.sprite);
        spawnPetHeart(this, sheep.sprite.x, sheep.sprite.y);

        // Walk-into pets only: skip while playLines/scripture is speaking (find cue is enough).
        if (!this.scriptPlaying) {
            const line = PET_LINES[Math.floor(Math.random() * PET_LINES.length)](sheep.name);
            speakCue(line);
        }
    }

    /**
     * Find / stray-rejoin celebration: same kneel + baah + dance as walk-into petting.
     * Bypasses pet cooldown and scriptPlaying (speech can run alongside).
     */
    private celebrateFinding (sheep: Sheep): void {
        if (this.shepherd.isLyingDown || sheep.hurt || sheep.isBusy || this.isNearHole()) {
            return;
        }

        this.startPetting(sheep);
    }

    private onFoundSheep (sheep: Sheep): void {
        this.foundCount += 1;
        this.saveProgress(sheep.hurt ? 'hurt-sheep' : 'found-sheep');
        this.celebrateFinding(sheep);

        if (this.foundCount === 1) {
            this.playLines([
                `${sheep.name}! I found you!`,
                psalm23Half(1, 'a')
            ], () => {
                this.beginHunger(sheep);
            });
            return;
        }

        if (this.foundCount === 2) {
            this.playLines([
                `${sheep.name}! I found you!`
            ], () => {
                this.makeFlockThirsty();
            });
            return;
        }

        if (sheep.hurt) {
            this.playLines([
                `${sheep.name}! I found you!`,
                `${sheep.name} is hurt.`
            ]);
            return;
        }

        this.playLines([
            `${sheep.name}! I found you!`
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

        if (this.flock.some((sheep) => sheep.mood === 'waiting' || (sheep.hurt && !sheep.discovered))) {
            return this.foundCount === 1 ? 'Another sheep is missing.' : 'Find your sheep.';
        }

        const hungry = this.flock.find((sheep) => sheep.hungry);

        if (hungry) {
            return `${hungry.name} is hungry.`;
        }

        if (this.flock.some((sheep) => sheep.thirsty)) {
            return 'The sheep are thirsty.';
        }

        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);

        if (hurt) {
            return `Bandage ${hurt.name}.`;
        }

        if (this.heardJohn109 && !this.heardCorinthians) {
            return 'The flock is home.';
        }

        if (this.staffPickup && !this.shepherd.hasStaff) {
            return "I'm scared. I need my staff.";
        }

        if (this.nightStarted) {
            return this.heardJohn102 ? 'You reached the pen.' : 'Guide the flock to the pen.';
        }

        return '';
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

        if (this.staffPickup && !this.shepherd.hasStaff) {
            return this.staffPickup;
        }

        if (this.nightStarted && this.shepherd.hasStaff && !this.heardJohn102 && this.sheepfold) {
            return this.sheepfold;
        }

        if (this.gems.length > 0) {
            return this.closestToShepherd(this.gems);
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

        if (text.length > 0 && text !== this.lastCue && speak) {
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

        if (checkpoint === '1-cor-15-51') {
            this.heardCorinthians = true;
        }
    }

    private saveProgress (checkpoint: StoryCheckpoint): void {
        this.lastCheckpoint = checkpoint;
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
            heardCorinthians: this.heardCorinthians,
            whiteRobe: this.shepherd.wearsWhite,
            hasStaff: this.shepherd.hasStaff,
            staff: this.shepherd.hasStaff || !this.staffPickup
                ? null
                : { x: this.staffPickup.x, y: this.staffPickup.y },
            player: { x: this.shepherd.sprite.x, y: this.shepherd.sprite.y },
            pen: this.sheepfold ? { x: this.sheepfold.x, y: this.sheepfold.y } : null,
            water: this.water.map((source) => ({ x: source.x, y: source.y })),
            grass: this.grass.map((patch) => ({ x: patch.x, y: patch.y })),
            foundGems: [...this.foundGems]
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
        this.heardCorinthians = save.heardCorinthians === true;

        save.foundNames.forEach((name, slot) => {
            const angle = (slot / Math.max(save.foundNames.length, 1)) * Math.PI * 2;
            const sheep = new Sheep(
                this,
                this.shepherd.sprite.x + Math.cos(angle) * RESTORE_FOLLOW_RING,
                this.shepherd.sprite.y + Math.sin(angle) * RESTORE_FOLLOW_RING,
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

        if (this.heardPsalm4a && !this.heardCorinthians) {
            this.applyNight(false);
        }
        else if (this.heardPsalm3b && !this.heardCorinthians) {
            this.beginNight();
        }
        else if (this.heardPsalm3 && !this.heardPsalm3b) {
            this.beginWalkWatch();
        }

        if (this.heardPsalm4a && !this.heardPsalm4b && !this.heardCorinthians) {
            this.beginWalkWatch();
        }

        if (save.hasStaff || save.checkpoint === 'found-staff') {
            this.shepherd.equipStaff(true);
        }
        else if (save.staff) {
            this.staffPickup = new StaffPickup(this, save.staff.x, save.staff.y);
        }
        else if ((this.heardPsalm4b || this.heardPsalm4c) && !this.heardCorinthians) {
            this.placeStaff();
        }

        if (save.whiteRobe || this.heardCorinthians) {
            this.shepherd.wearWhite();
        }

        if (this.heardJohn109 && this.heardCorinthians) {
            this.placeAtFoldAwake();
        }
        else if (this.heardJohn109) {
            this.settleFold();
            this.beginMystery();
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
        this.heardCorinthians = false;
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        setWorldMusicTrack(this, WANDERLUST_KEY);
        this.sheepfold = null;
        this.hole = null;
        this.staffPickup = null;
        this.gems = [];
        this.foundGems = [];
        this.lastCheckpoint = null;
        this.walkFrom = null;
        this.strayReadyAt = 0;
        this.pettingReadyAt = 0;
    }

    private addSettingsButton (): void {
        ensureSettingsGear(this);
        ensureSoundIcons(this);
        ensureTreasureChest(this);

        const settings = this.add.image(this.scale.width - 16, 16, SETTINGS_GEAR_KEY)
            .setOrigin(1, 0)
            .setDisplaySize(SETTINGS_GEAR_SIZE, SETTINGS_GEAR_SIZE)
            .setScrollFactor(0)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });

        settings.setData('ui', true);
        settings.on('pointerover', () => settings.setTint(0xc4a882));
        settings.on('pointerout', () => settings.clearTint());
        settings.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openSettings();
        });

        this.soundToggle = this.add.image(
            settings.x - settings.displayWidth - 12,
            16,
            soundIconKey(isSoundOn())
        )
            .setOrigin(1, 0)
            .setDisplaySize(SOUND_ICON_SIZE, SOUND_ICON_SIZE)
            .setScrollFactor(0)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });

        this.soundToggle.setData('ui', true);
        this.soundToggle.on('pointerover', () => this.soundToggle.setTint(0xc4a882));
        this.soundToggle.on('pointerout', () => this.soundToggle.clearTint());
        this.soundToggle.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.toggleSound();
        });

        const chest = this.add.image(
            this.soundToggle.x - this.soundToggle.displayWidth - 12,
            16,
            TREASURE_CHEST_KEY
        )
            .setOrigin(1, 0)
            .setDisplaySize(TREASURE_CHEST_SIZE, TREASURE_CHEST_SIZE)
            .setScrollFactor(0)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });

        chest.setData('ui', true);
        chest.on('pointerover', () => chest.setTint(0xc4a882));
        chest.on('pointerout', () => chest.clearTint());
        chest.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openTreasure();
        });
    }

    private toggleSound (): void {
        setSoundOn(!isSoundOn());
        this.sound.mute = !isSoundOn();
        this.soundToggle.setTexture(soundIconKey(isSoundOn()));
        this.soundToggle.clearTint();

        if (isSoundOn()) {
            this.playWorldMusic();
        }
        else {
            stopSpeech();
        }

        syncHowling();
    }

    private addBandageButton (): void {
        this.bandageButton = new BandageButton(this, () => this.tryBandage());
    }

    private updateBandageButton (): void {
        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);

        if (!hurt || this.scriptPlaying || this.bandageRescuing) {
            this.bandageButton.setVisible(false);
            return;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - hurt.sprite.x,
            this.shepherd.sprite.y - hurt.sprite.y
        );
        this.bandageButton.setVisible(dist <= BANDAGE_RANGE);
    }

    private tryBandage (): void {
        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);

        if (!hurt || this.scriptPlaying || this.bandageRescuing) {
            return;
        }

        if (this.shepherd.isLyingDown || this.shepherd.isPetting || this.nightStarted) {
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

        this.bandageRescuing = true;
        this.bandageButton.setVisible(false);

        // Hole sprite is centered ~10px above the trapped sheep.
        const holeX = hurt.sprite.x;
        const holeY = hurt.sprite.y - 10;
        this.stageFlockAside(holeX, holeY, hurt);

        const enterFromLeft = this.shepherd.sprite.x < holeX;
        const enterX = holeX + (enterFromLeft ? -HOLE_ENTER_NUDGE : HOLE_ENTER_NUDGE);
        const enterY = holeY + 8;

        this.shepherd.guideTo(enterX, enterY, () => {
            this.shepherd.beginPetting(hurt.sprite.x, hurt.sprite.y, BANDAGE_KNEEL_MS);

            this.time.delayedCall(BANDAGE_HEAL_AT_MS, () => {
                if (!this.sys.isActive() || !this.bandageRescuing || !hurt.hurt) {
                    return;
                }

                hurt.heal();
                this.playLines([
                    `You bandage ${hurt.name}.`,
                    psalm23Half(3, 'a')
                ], () => {
                    this.finishBandageRescue();
                });
            });
        });
    }

    /** Following sheep sit off to the side of the hole while the shepherd helps. */
    private stageFlockAside (holeX: number, holeY: number, hurt: Sheep): void {
        const followers = this.flock.filter(
            (sheep) => sheep !== hurt && sheep.mood === 'following' && !sheep.hurt
        );

        if (followers.length === 0) {
            return;
        }

        // Wait on the side the shepherd came from — out of the pit.
        const aside = this.shepherd.sprite.x < holeX ? -1 : 1;

        followers.forEach((sheep, i) => {
            const spread = (i - (followers.length - 1) / 2) * 44;
            sheep.beginRescueWait(holeX + aside * HOLE_ASIDE_DIST, holeY + spread - 18);
        });
    }

    private holeKeepOut (): { x: number; y: number; radius: number } | null {
        if (!this.hole) {
            return null;
        }

        return { x: this.hole.x, y: this.hole.y, radius: HOLE_KEEP_OUT_RADIUS };
    }

    /** True while the shepherd is within HOLE_PROXIMITY_PAUSE of the hole center. */
    private isNearHole (): boolean {
        if (!this.hole) {
            return false;
        }

        return Math.hypot(
            this.shepherd.sprite.x - this.hole.x,
            this.shepherd.sprite.y - this.hole.y
        ) <= HOLE_PROXIMITY_PAUSE;
    }

    private finishBandageRescue (): void {
        this.shepherd.clearGuidance();

        for (const sheep of this.flock) {
            sheep.endRescueWait();
        }

        this.bandageRescuing = false;
        this.beginWalkWatch();
    }

    private holdWorldAudio (): void {
        suspendHowling();
        holdSheepSounds(this);
    }

    private releaseWorldAudio (): void {
        if (!this.sys.isActive() || this.sys.isPaused()) {
            return;
        }

        this.playWorldMusic();
        unsuspendHowling();
    }

    private openSettings (): void {
        if (this.scene.isActive('SettingsScene') || this.scene.isActive('TreasureScene')) {
            return;
        }

        stopSpeech();
        this.scene.pause();
        this.scene.launch('SettingsScene');
    }

    private openTreasure (): void {
        if (this.scene.isActive('TreasureScene') || this.scene.isActive('SettingsScene')) {
            return;
        }

        stopSpeech();
        this.scene.pause();
        this.scene.launch('TreasureScene', {
            foundGems: [...this.foundGems],
            heard: {
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
                heardCorinthians: this.heardCorinthians
            }
        });
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
        this.playLines([psalm23Half(4, 'b')], () => {
            this.placeStaff();
            this.playLines([
                "I'm scared.",
                'I need my staff.'
            ]);
        });
    }

    private ensurePen (at?: { x: number; y: number } | null): Sheepfold {
        if (this.sheepfold) {
            return this.sheepfold;
        }

        const spot = at ?? farthestCornerFrom({
            x: this.shepherd.sprite.x,
            y: this.shepherd.sprite.y
        });
        this.sheepfold = new Sheepfold(this, spot.x, spot.y);
        return this.sheepfold;
    }

    private fold (): Sheepfold {
        return this.ensurePen();
    }

    private placeStaff (): void {
        if (this.staffPickup || this.shepherd.hasStaff) {
            return;
        }

        const from = this.shepherd.sprite;
        const to = this.ensurePen();

        this.staffPickup = new StaffPickup(this, (from.x + to.x) / 2, (from.y + to.y) / 2);
        this.saveProgress(this.lastCheckpoint ?? 'psalm-23-4b');
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
        this.saveProgress('found-staff');
        this.playLines([psalm23Comfort()]);
    }

    private maybeCollectGem (): void {
        if (this.scriptPlaying || this.gems.length === 0) {
            return;
        }

        const gem = this.gems.find((item) => item.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y));

        if (!gem) {
            return;
        }

        const firstBibleGem = this.foundGems.length === 0;
        this.foundGems.push(gem.id);
        this.gems = this.gems.filter((item) => item !== gem);
        gem.destroy();

        const next = spawnBibleGemAway(
            this,
            this.foundGems,
            this.gems,
            { x: this.shepherd.sprite.x, y: this.shepherd.sprite.y }
        );

        if (next) {
            this.gems.push(next);
        }

        if (this.lastCheckpoint) {
            this.saveProgress(this.lastCheckpoint);
        }

        this.playLines(
            firstBibleGem
                ? ['You found a Bible gem.', gem.line()]
                : [gem.line()]
        );
    }

    private maybeReachPen (): void {
        if (this.heardJohn102 || this.heardJohn109 || !this.nightStarted || this.scriptPlaying || !this.shepherd.hasStaff) {
            return;
        }

        if (!this.sheepfold || !this.sheepfold.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
            return;
        }

        stopHowling();
        this.playLines([john10Line(2)], () => {
            this.closeFold();
        });
    }

    private closeFold (): void {
        const fold = this.ensurePen();
        this.flock.forEach((sheep, slot) => {
            const rest = fold.restSpot(slot);
            sheep.enterPen(rest.x, rest.y);
        });
        this.shepherd.lieDown(fold.gateSpot().x, fold.gateSpot().y);
        this.playLines([john10Line(9)], () => {
            this.beginMystery();
        });
    }

    private settleFold (): void {
        this.flock.forEach((sheep, slot) => {
            const rest = this.fold().restSpot(slot);
            sheep.settleInPen(rest.x, rest.y);
        });
        this.shepherd.lieDown(this.fold().gateSpot().x, this.fold().gateSpot().y);
    }

    private placeAtFoldAwake (): void {
        const gate = this.fold().gateSpot();
        this.shepherd.placeAt(gate.x, gate.y);
        this.shepherd.wake();
        this.flock.forEach((sheep, slot) => {
            const rest = this.fold().restSpot(slot);
            sheep.sprite.setPosition(rest.x, rest.y);
            sheep.leavePen();
        });
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        this.nightVeil.setAlpha(0);
        this.sleepVeil.setAlpha(0);
        this.styleCueForDay();
        stopHowling();
        this.playWorldMusic();
    }

    private beginMystery (): void {
        if (this.heardCorinthians) {
            return;
        }

        this.scriptPlaying = true;
        this.styleCueForDark();
        this.cueText.setText('');
        this.lastCue = '';
        this.tweens.add({
            targets: this.sleepVeil,
            alpha: 1,
            duration: 1800,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (!this.sys.isActive()) {
                    return;
                }

                this.shepherd.wearWhite();
                this.playLines([corinthians15Line()], () => {
                    this.beginDawn();
                });
            }
        });
    }

    private beginDawn (): void {
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        this.shepherd.wake();
        this.flock.forEach((sheep) => sheep.leavePen());
        setWorldMusicTrack(this, WONDERS_KEY);
        fadeInWorldMusic(this, 1800);
        this.tweens.add({
            targets: [this.sleepVeil, this.nightVeil],
            alpha: 0,
            duration: 1800,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (this.sys.isActive()) {
                    this.styleCueForDay();
                }
            }
        });
    }

    private styleCueForDark (): void {
        this.cueText.setColor('#f4ead8');
        this.cueText.setBackgroundColor('#000000cc');
    }

    private styleCueForDay (): void {
        this.cueText.setColor('#3d2c1e');
        this.cueText.setBackgroundColor('#f3ead8cc');
    }

    private applyNight (animate: boolean): void {
        this.nightStarted = true;
        this.nightDarkAt = this.time.now;
        this.nightFadeInMs = animate ? NIGHT_FADE_IN_MS : 0;
        this.ensurePen();
        fadeOutWorldMusic(this, animate ? NIGHT_FADE_IN_MS : 0);

        if (!this.heardJohn102) {
            startHowling(this);
        }

        if (animate) {
            this.tweens.add({
                targets: this.nightVeil,
                alpha: NIGHT_VEIL_ALPHA,
                duration: NIGHT_FADE_IN_MS,
                ease: 'Sine.easeInOut'
            });
            return;
        }

        this.nightVeil.setAlpha(NIGHT_VEIL_ALPHA);
    }

    private tickNightDarkness (): void {
        if (!this.nightStarted) {
            return;
        }

        const elapsed = this.time.now - this.nightDarkAt;

        if (elapsed < this.nightFadeInMs) {
            return;
        }

        const t = Math.min(1, Math.max(0, elapsed / NIGHT_DEEPEN_MS));
        const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);
        this.nightVeil.setAlpha(NIGHT_VEIL_ALPHA * (1 + (NIGHT_VEIL_DEEPEN - 1) * eased));
    }

    private tickNightBaahs (): void {
        const night = this.nightStarted && this.sleepVeil.alpha < 0.2
            ? { elapsedMs: this.time.now - this.nightDarkAt, fold: this.sheepfold }
            : null;

        tickNightFlockBaahs(this, this.flock, this.shepherd.sprite, night);
    }

    private playWorldMusic (): void {
        if (this.nightStarted) {
            return;
        }

        setWorldMusicTrack(this, this.heardCorinthians ? WONDERS_KEY : WANDERLUST_KEY);
        startWorldMusic(this);
    }

    private spawnSheep (name: string, slot: number): void {
        const placed = [
            { x: this.shepherd.sprite.x, y: this.shepherd.sprite.y },
            ...this.flock.map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y })),
            ...this.grass,
            ...this.water,
            ...this.gems,
            ...(this.sheepfold ? [this.sheepfold] : [])
        ];
        const spawn = findPointAwayFromAll(placed, WAITING_SPAWN_MIN, WAITING_SPAWN_GAP);

        if (slot === 2 && !this.heardPsalm3) {
            this.hole = new Hole(this, spawn.x, spawn.y);
            const trapped = new Sheep(this, spawn.x, spawn.y + 10, name, slot);
            trapped.trapInHole();
            this.flock.push(trapped);
            return;
        }

        this.flock.push(new Sheep(this, spawn.x, spawn.y, name, slot));
    }

    private maybeStrayFlock (): void {
        if (
            this.scriptPlaying
            || this.bandageRescuing
            || this.isNearHole()
            || this.time.now < this.strayReadyAt
        ) {
            return;
        }

        // Only block while a previously found sheep is already astray.
        // Undiscovered story sheep also use mood 'waiting' and must not suppress strays.
        if (this.flock.some((sheep) => sheep.mood === 'waiting' && sheep.discovered)) {
            return;
        }

        const followers = this.flock.filter((sheep) => sheep.mood === 'following');

        if (followers.length === 0) {
            return;
        }

        const sx = this.shepherd.sprite.x;
        const sy = this.shepherd.sprite.y;
        let farthest = followers[0];
        let farthestDist = 0;

        for (const sheep of followers) {
            const dist = Math.hypot(sheep.sprite.x - sx, sheep.sprite.y - sy);

            if (dist < STRAY_AHEAD_DISTANCE * STRAY_WARN_RESET_RATIO) {
                this.lagWarned.delete(sheep);
            }

            if (dist > farthestDist) {
                farthestDist = dist;
                farthest = sheep;
            }
        }

        // One clear warning baah as they fall behind — not every frame, and not at teleport.
        if (
            farthestDist >= STRAY_AHEAD_DISTANCE * STRAY_WARN_RATIO
            && farthestDist < STRAY_AHEAD_DISTANCE
            && !this.lagWarned.has(farthest)
        ) {
            this.lagWarned.add(farthest);
            playLaggingBaah(this, farthest, this.shepherd.sprite);
        }

        // Trigger when the lagging follower falls behind — works with a single sheep
        // and does not require the whole flock to clear the threshold at once.
        if (farthestDist < STRAY_AHEAD_DISTANCE) {
            return;
        }

        const placed = [
            { x: sx, y: sy },
            ...this.flock.map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y })),
            ...this.grass,
            ...this.water,
            ...this.gems,
            ...(this.sheepfold ? [this.sheepfold] : [])
        ];
        const away = findPointAwayFromAll(placed, STRAY_TELEPORT_MIN, STRAY_TELEPORT_GAP);
        this.lagWarned.delete(farthest);
        farthest.becomeLost(away.x, away.y);
        playStrayBaah(this, farthest, this.shepherd.sprite);
        cueWaitingBleat(farthest, this.time.now);
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

    if (line.includes('1 Corinthians 15:51')) {
        return '1-cor-15-51';
    }

    return null;
}
