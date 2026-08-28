import { Scene, GameObjects, Scenes } from 'phaser';
import { Shepherd } from '../entities/Shepherd';
import { Wolf } from '../entities/Wolf';
import { FOLLOW_DISTANCE, FOLLOW_SPEED, PET_DANCE_MS, Sheep } from '../entities/Sheep';
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
import { Thorns, THORN_SNARE_RADIUS, placeThorns } from '../world/Thorns';
import { StaffPickup } from '../world/StaffPickup';
import { BibleGem, placeBibleGems, spawnBibleGemAway } from '../world/BibleGem';
import { watercolorWorld } from '../world/watercolorWorld';
import { speakCue, stopSpeech } from '../ui/speech';
import { playGemDing, tickWalkSound } from '../audio/cues';
import { startHowling, stopHowling, suspendHowling, syncHowling, unsuspendHowling } from '../audio/howl';
import { isSoundOn, setSoundOn } from '../audio/soundPref';
import { WANDERLUST_KEY, WONDERS_KEY, applySavedWorldMusic, clearWorldMusicProgress, clearWorldMusicSeek, fadeInWorldMusic, fadeOutWorldMusic, getWorldMusicProgress, isWorldMusicKey, setWorldMusicTrack, startWorldMusic, stopWorldMusic } from '../audio/worldMusic';
import { cueWaitingBleat, holdSheepSounds, playHappyBaah, playLaggingBaah, playStrayBaah, stopSheepSounds, tickNightBaahs as tickNightFlockBaahs, tickSheepSounds } from '../audio/sheepSounds';
import { corinthians15Line, isaiah53Line, john10Line, psalm23Comfort, psalm23Half } from '../data/scripture';
import { BibleGemHint } from '../ui/BibleGemHint';
import { LostSheepHint } from '../ui/LostSheepHint';
import { spawnPetHeart } from '../ui/petHeart';
import { BandageButton } from '../ui/BandageButton';
import { SETTINGS_GEAR_KEY, SETTINGS_GEAR_SIZE, ensureSettingsGear } from '../ui/settingsGear';
import { SOUND_ICON_SIZE, ensureSoundIcons, soundIconKey } from '../ui/soundIcon';
import { TREASURE_CHEST_KEY, TREASURE_CHEST_SIZE, ensureTreasureChest } from '../ui/treasureChest';
import { applyAchievements, syncAchievements } from '../achievements/achievements';
import { GameSave, StoryCheckpoint, loadSave, writeSave } from '../save/gameSave';

const FLOCK_NAMES = ['Clover', 'Snowball', 'Milo', 'Biscuit'];
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
/** After a rescue, thorns stay off until the shepherd walks this far. */
const THORN_REARM_WALK = 300;
const HOLE_ASIDE_DIST = 118;
const HOLE_ENTER_NUDGE = 16;
/** Pause stray teleport / lag warning and walk-into petting while shepherd is this close to the hole. */
const HOLE_PROXIMITY_PAUSE = 200;
const WALK_A_BIT = 420;
/** Pause after the scare beat before speaking Psalm 23:4b. */
const FEAR_NO_EVIL_DELAY_MS = 3000;
const NIGHT_VEIL_ALPHA = 0.55;
const NIGHT_VEIL_DEEPEN = 1.10;
const NIGHT_DEEPEN_MS = 60_000;
const NIGHT_FADE_IN_MS = 2800;
/**
 * Restored following sheep ring radius. Must stay well beyond FOLLOW_DISTANCE (64) +
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
    private thorns: Thorns[] = [];
    private thornsArmed = true;
    /** Set after a thorn rescue; snares stay off until the shepherd walks `THORN_REARM_WALK`. */
    private thornsRearmFrom: { x: number; y: number } | null = null;
    private wolf: Wolf | null = null;
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
    private gemHint!: BibleGemHint;
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
    /** After finding Milo, walk a bit before Biscuit appears in the hole. */
    private holeWalkFrom: { x: number; y: number } | null = null;
    /** Walk-into petting allowed once `time.now` reaches this (set on create). */
    private pettingReadyAt = 0;
    /**
     * After restore or dawn wake: walk-into pets stay locked until the
     * shepherd moves `PET_UNLOCK_MOVE_PX` from this origin.
     */
    private loadPetsLocked = false;
    private petUnlockOrigin = { x: 0, y: 0 };
    /** Seek (seconds) applied once when world music first starts after load. */

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

        this.thorns = placeThorns(this);

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
        this.gemHint = new BibleGemHint(this);
        this.addBandageButton();

        if (save) {
            this.foundGems = save.foundGems ?? [];
            this.lastCheckpoint = save.checkpoint;

            // Seed before restoreSave — restore may start/stop BGM (dawn wake / night).
            // Day saves keep seek; night / post-night quiet arc always starts at 0.
            if (isWorldMusicKey(save.musicKey)) {
                const nightQuiet = !save.heardCorinthians && (
                    save.heardPsalm3b === true
                    || save.heardPsalm4a === true
                    || save.heardJohn109 === true
                );
                const seek = !nightQuiet
                    && typeof save.musicSeek === 'number'
                    && Number.isFinite(save.musicSeek)
                    && save.musicSeek > 0
                    ? save.musicSeek
                    : 0;

                applySavedWorldMusic(save.musicKey, seek);
            }

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

    update (_time: number, delta: number): void {
        const keepOuts = this.worldKeepOuts();
        this.shepherd.update(keepOuts);
        tickWalkSound(this, this.shepherd.isMoving && !this.shepherd.isLyingDown);
        watercolorWorld().rainIntoView(this);
        watercolorWorld().tick(this, this.time.now);

        this.tryUnlockLoadPetting();

        for (const sheep of this.flock) {
            // Hold followers at spawn until the shepherd moves (restore ring / dawn gather).
            if (this.loadPetsLocked && sheep.mood === 'following') {
                continue;
            }

            const event = sheep.update(this.shepherd, this.water, this.grass, this.nightStarted, keepOuts);

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
        this.tickWolf(delta);
        this.tickThorns();
        this.sheepfold?.tickGlow(this.nightVeil.alpha, this.time.now);
        tickSheepSounds(this, this.flock, this.shepherd.sprite, this.nightStarted);
        this.lostHint.update(this, this.shepherd, this.hintTarget(), Boolean(this.staffPickup));
        this.gemHint.update(this, this.shepherd, this.gemHintTarget());
        this.updateBandageButton();
        this.tickPetting();
        this.maybeSpeakRighteousness();
        this.maybeSpawnHoleSheep();
        this.maybeHowl();
        this.maybePickupStaff();
        this.maybeCollectGem();
        this.maybeReachPen();
    }

    /** Clear pet/follow lock once the shepherd has left spawn or the dawn wake spot. */
    private tryUnlockLoadPetting (): void {
        if (!this.loadPetsLocked) {
            return;
        }

        const dx = this.shepherd.sprite.x - this.petUnlockOrigin.x;
        const dy = this.shepherd.sprite.y - this.petUnlockOrigin.y;

        if (Math.hypot(dx, dy) >= PET_UNLOCK_MOVE_PX) {
            this.loadPetsLocked = false;
        }
    }

    /** Shepherd kneels to pet a nearby following sheep; sheep baahs and dances. */
    private tickPetting (): void {
        if (this.loadPetsLocked) {
            const moved = Math.hypot(
                this.shepherd.sprite.x - this.petUnlockOrigin.x,
                this.shepherd.sprite.y - this.petUnlockOrigin.y
            );

            if (moved < PET_UNLOCK_MOVE_PX) {
                return;
            }

            this.loadPetsLocked = false;
        }

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
        const hand = this.shepherd.petHandPosition();
        sheep.approachForPet(hand.x, hand.y, () => {
            this.shepherd.extendPettingFor(PET_DANCE_MS);
            sheep.beginHappyDance();
            playHappyBaah(this, sheep, this.shepherd.sprite);
            spawnPetHeart(this, sheep.sprite.x, sheep.sprite.y);
        });

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

        if (sheep.name === 'Milo') {
            this.playLines([
                `${sheep.name}! I found you!`,
                `${sheep.name} is nervous. Stay together.`
            ], () => {
                this.beginHoleWatch();
            });
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

            // Restore direction text on screen only — do not re-speak after scripture/gem lines.
            if (!this.scriptPlaying) {
                this.showCue(this.flockCue(), false);
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
        const snared = this.flock.find((sheep) => sheep.hurt && sheep.snaredInThorns);

        if (snared) {
            return `Help ${snared.name}!`;
        }

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
            return 'I need my staff.';
        }

        if (this.nightStarted) {
            if (!this.heardJohn102) {
                return 'Guide the flock to the pen.';
            }

            if (!this.heardJohn109 && this.flock.some((sheep) => !sheep.isSettledInPen)) {
                return 'The flock is coming home.';
            }

            return 'You reached the pen.';
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

        return null;
    }

    /** Always points at the nearest uncollected Bible gem while any remain. */
    private gemHintTarget (): { x: number; y: number } | null {
        if (this.gems.length === 0) {
            return null;
        }

        return this.closestToShepherd(this.gems);
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
        const music = getWorldMusicProgress(this);
        const previous = loadSave();

        writeSave(applyAchievements({
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
            foundGems: [...this.foundGems],
            unlockedAchievements: previous?.unlockedAchievements ?? [],
            musicKey: music.key,
            musicSeek: music.seek
        }));
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

        if (save.foundNames.length > 0) {
            this.loadPetsLocked = true;
            this.petUnlockOrigin = {
                x: this.shepherd.sprite.x,
                y: this.shepherd.sprite.y
            };
        }

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
            // Treat as recently petted so walk-into cannot fire the instant follow resumes.
            sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
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
        else if (this.shouldAwaitHoleSheep(save)) {
            this.beginHoleWatch();
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

        syncAchievements(save);
    }

    private shouldHaveLostSheep (save: GameSave): boolean {
        return (save.heardPsalm2 && save.foundCount < 2)
            || (this.heardPsalm2b && save.foundCount < 3 && save.nextNames.length > 0);
    }

    private shouldAwaitHoleSheep (save: GameSave): boolean {
        return this.heardPsalm2b
            && !this.heardPsalm3
            && save.foundCount >= 3
            && save.nextNames.includes('Biscuit')
            && !save.waitingName;
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
        clearWorldMusicProgress();
        setWorldMusicTrack(this, WANDERLUST_KEY);
        this.sheepfold = null;
        this.hole = null;
        this.thorns = [];
        this.thornsArmed = true;
        this.thornsRearmFrom = null;
        this.dismissWolf();
        this.staffPickup = null;
        this.gems = [];
        this.foundGems = [];
        this.lastCheckpoint = null;
        this.walkFrom = null;
        this.holeWalkFrom = null;
        this.strayReadyAt = 0;
        this.pettingReadyAt = 0;
        this.loadPetsLocked = false;
        this.petUnlockOrigin = { x: 0, y: 0 };
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

        const cheat = this.add.text(
            chest.x - chest.displayWidth - 12,
            22,
            'cheat',
            {
                fontFamily: 'Georgia, serif',
                fontSize: '18px',
                color: '#6b5344'
            }
        )
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });

        cheat.setData('ui', true);
        cheat.on('pointerover', () => cheat.setColor('#3d2c1e'));
        cheat.on('pointerout', () => cheat.setColor('#6b5344'));
        cheat.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openCheat();
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

    private tickThorns (): void {
        this.maybeRearmThorns();

        if (!this.thornsArmed || this.scriptPlaying || this.bandageRescuing || this.shepherd.isLyingDown) {
            return;
        }

        const sx = this.shepherd.sprite.x;
        const sy = this.shepherd.sprite.y;

        for (const sheep of this.flock) {
            if (sheep.mood !== 'following' || sheep.hurt || sheep.isBusy || sheep.isRescueWaiting) {
                continue;
            }

            const patch = this.thorns.find((thorn) => thorn.contains(sheep.sprite.x, sheep.sprite.y));

            // Shepherd can walk the flock through; only snare sheep left in a bush.
            if (!patch || patch.contains(sx, sy)) {
                continue;
            }

            sheep.snareInThorns();
            this.thornsArmed = false;
            this.thornsRearmFrom = null;
            this.showCue(`Help ${sheep.name}!`);
            return;
        }
    }

    /** After a rescue, turn snares back on once the shepherd has walked far enough. */
    private maybeRearmThorns (): void {
        if (this.thornsArmed || !this.thornsRearmFrom) {
            return;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - this.thornsRearmFrom.x,
            this.shepherd.sprite.y - this.thornsRearmFrom.y
        );

        if (dist >= THORN_REARM_WALK) {
            this.thornsArmed = true;
            this.thornsRearmFrom = null;
        }
    }

    private rescueFromThorns (hurt: Sheep): void {
        this.bandageRescuing = true;
        this.bandageButton.setVisible(false);
        this.stageFlockAside(hurt.sprite.x, hurt.sprite.y, hurt);

        const stand = this.thornRescueStand(hurt);
        this.shepherd.guideTo(stand.x, stand.y, () => {
            this.shepherd.beginPetting(hurt.sprite.x, hurt.sprite.y, BANDAGE_KNEEL_MS);

            this.time.delayedCall(BANDAGE_HEAL_AT_MS, () => {
                if (!this.sys.isActive() || !this.bandageRescuing || !hurt.hurt) {
                    return;
                }

                hurt.heal();
                this.shepherd.clearGuidance();
                this.playLines([`You free ${hurt.name} from the thorns.`], () => {
                    this.finishThornRescue();
                });
            });
        });
    }

    private finishThornRescue (): void {
        this.shepherd.clearGuidance();

        for (const sheep of this.flock) {
            sheep.endRescueWait();

            if (sheep.mood === 'following' && !sheep.hurt) {
                sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
            }
        }

        this.bandageRescuing = false;
        this.thornsRearmFrom = {
            x: this.shepherd.sprite.x,
            y: this.shepherd.sprite.y
        };
    }

    /** Stand just outside the bramble so the shepherd never has to enter it. */
    private thornRescueStand (hurt: Sheep): { x: number; y: number } {
        const patch = this.nearestThorn(hurt.sprite.x, hurt.sprite.y);
        const fromX = this.shepherd.sprite.x;
        const fromY = this.shepherd.sprite.y;

        if (!patch) {
            return { x: hurt.sprite.x, y: hurt.sprite.y };
        }

        const dx = fromX - patch.x;
        const dy = fromY - patch.y;
        const dist = Math.hypot(dx, dy) || 1;
        const radius = THORN_SNARE_RADIUS + 18;

        return {
            x: patch.x + (dx / dist) * radius,
            y: patch.y + (dy / dist) * radius
        };
    }

    private nearestThorn (x: number, y: number): Thorns | null {
        let nearest: Thorns | null = null;
        let best = Infinity;

        for (const thorn of this.thorns) {
            const dist = Math.hypot(x - thorn.x, y - thorn.y);

            if (dist < best) {
                best = dist;
                nearest = thorn;
            }
        }

        return nearest;
    }

    private tryBandage (): void {
        const hurt = this.flock.find((sheep) => sheep.hurt && sheep.discovered);

        if (!hurt || this.scriptPlaying || this.bandageRescuing) {
            return;
        }

        if (this.shepherd.isLyingDown || this.shepherd.isPetting) {
            return;
        }

        if (this.nightStarted && !hurt.snaredInThorns) {
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

        if (hurt.snaredInThorns) {
            this.rescueFromThorns(hurt);
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

    private worldKeepOuts (): { x: number; y: number; radius: number }[] {
        const zones: { x: number; y: number; radius: number }[] = [];

        if (this.hole) {
            zones.push({ x: this.hole.x, y: this.hole.y, radius: HOLE_KEEP_OUT_RADIUS });
        }

        if (this.sheepfold) {
            zones.push(this.sheepfold.fireKeepOut());
        }

        return zones;
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

            // Healed sheep sits in pet range of the kneeling shepherd — suppress
            // walk-into dance so the flock resumes trail follow immediately.
            if (sheep.mood === 'following' && !sheep.hurt) {
                sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
            }
        }

        this.dismissHole();
        this.bandageRescuing = false;
        this.beginWalkWatch();
    }

    /** Clear keep-out immediately, then shrink the pit sprite away. */
    private dismissHole (): void {
        if (!this.hole) {
            return;
        }

        const hole = this.hole;
        this.hole = null;
        hole.shrinkAway();
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

    private overlayOpen (): boolean {
        return this.scene.isActive('SettingsScene')
            || this.scene.isActive('TreasureScene')
            || this.scene.isActive('CheatScene');
    }

    private openSettings (): void {
        if (this.overlayOpen()) {
            return;
        }

        stopSpeech();
        this.scene.pause();
        this.scene.launch('SettingsScene');
    }

    private openCheat (): void {
        if (this.overlayOpen()) {
            return;
        }

        stopSpeech();
        this.scene.pause();
        this.scene.launch('CheatScene');
    }

    private openTreasure (): void {
        if (this.overlayOpen()) {
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

    private beginHoleWatch (): void {
        this.holeWalkFrom = {
            x: this.shepherd.sprite.x,
            y: this.shepherd.sprite.y
        };
    }

    private maybeSpawnHoleSheep (): void {
        if (
            this.scriptPlaying
            || this.hole
            || !this.holeWalkFrom
            || this.heardPsalm3
            || this.nextNames[0] !== 'Biscuit'
        ) {
            return;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - this.holeWalkFrom.x,
            this.shepherd.sprite.y - this.holeWalkFrom.y
        );

        if (dist < WALK_A_BIT) {
            return;
        }

        this.holeWalkFrom = null;
        this.spawnNextSheep();
        this.showCue('A sheep is missing.');
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
        // Scare first (howling is already looping from night); comfort line after a beat.
        this.placeStaff();
        this.playLines([
            'I need my staff.'
        ], () => {
            this.scriptPlaying = true;
            this.time.delayedCall(FEAR_NO_EVIL_DELAY_MS, () => {
                if (!this.sys.isActive()) {
                    return;
                }

                this.playLines([psalm23Half(4, 'b')], () => {
                    stopHowling();
                });
            });
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

        playGemDing(this);

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

        // Persist foundGems + shepherd position (and music seek) at the pickup spot.
        // Prefer the story checkpoint; early pickups before any scripture use found-gem.
        this.saveProgress(this.lastCheckpoint ?? 'found-gem');

        this.playLines(
            firstBibleGem
                ? ['You found a Bible gem.', gem.line()]
                : [gem.line()]
        );
    }

    private maybeReachPen (): void {
        if (this.heardJohn109 || this.heardCorinthians || !this.nightStarted || !this.shepherd.hasStaff) {
            return;
        }

        if (!this.sheepfold) {
            return;
        }

        // Arrival: John 10:2 when the shepherd reaches the pen.
        if (!this.heardJohn102) {
            if (this.scriptPlaying || !this.sheepfold.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
                return;
            }

            stopHowling();
            this.playLines([john10Line(2)], () => {
                this.beginPenning();
            });
            return;
        }

        // After John 10:2: pen the flock, then sleep as soon as they are settled.
        // Does not depend on the speech onDone (heardJohn102 is set when the line starts).
        if (this.scriptPlaying || this.shepherd.isLyingDown) {
            return;
        }

        this.beginPenning();

        if (!this.flockSafeInPen()) {
            return;
        }

        this.sleepAtGate();
    }

    /** Send any unpenned sheep walking to fold rest spots. */
    private beginPenning (): void {
        const fold = this.ensurePen();
        this.flock.forEach((sheep, slot) => {
            if (sheep.isSettledInPen) {
                return;
            }

            if (sheep.isPenned) {
                return;
            }

            const rest = fold.restSpot(slot);

            // Already at the fold (e.g. followed the shepherd in) — settle now so sleep can start.
            if (fold.isNear(sheep.sprite.x, sheep.sprite.y)) {
                sheep.settleInPen(rest.x, rest.y);
                return;
            }

            sheep.enterPen(rest.x, rest.y);
        });
    }

    private flockSafeInPen (): boolean {
        return this.flock.length > 0 && this.flock.every((sheep) => sheep.isSettledInPen);
    }

    /** Lie down in the gate (John 10:9) and fade into the mystery sleep beat. */
    private sleepAtGate (): void {
        const fold = this.ensurePen();
        const gate = fold.gateSpot();
        this.dismissWolf();
        this.shepherd.lieDown(gate.x, gate.y);
        this.playLines([john10Line(9)], () => {
            this.time.delayedCall(1000, () => {
                if (this.sys.isActive()) {
                    this.beginMystery();
                }
            });
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
        const fold = this.fold();
        this.releaseFlockFromPen(fold);
        this.shepherd.wake();
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        this.nightVeil.setAlpha(0);
        this.sleepVeil.setAlpha(0);
        this.styleCueForDay();
        stopHowling();
        this.dismissWolf();
        this.playWorldMusic();
    }

    /**
     * After sleep: stand shepherd + flock south of the pen (clear of campfire)
     * and face outward so trail-follow doesn't pull them back into the fold.
     */
    private releaseFlockFromPen (fold: Sheepfold): void {
        const wake = fold.wakeSpot();
        this.shepherd.placeAt(wake.x, wake.y);
        this.shepherd.faceToward(wake.x, wake.y + 80);
        this.flock.forEach((sheep, slot) => {
            const exit = fold.exitSpot(slot);
            sheep.leavePen(exit.x, exit.y);
            sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
        });
        this.loadPetsLocked = true;
        this.petUnlockOrigin = { x: wake.x, y: wake.y };
    }

    private beginMystery (): void {
        if (this.heardCorinthians) {
            return;
        }

        this.scriptPlaying = true;
        this.styleCueForMystery();
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
        // Restore HUD cue layout before speakLines shows the flock cue again.
        this.styleCueForDay();
        this.shepherd.wake();
        this.releaseFlockFromPen(this.fold());
        this.dismissWolf();
        // Crossing night resets seek; morning track always starts at 0.
        clearWorldMusicSeek();
        setWorldMusicTrack(this, WONDERS_KEY);
        fadeInWorldMusic(this, 1800);
        // Corinthians checkpoint saves while wanderlust is still active; persist wonders + seek 0.
        this.saveProgress(this.lastCheckpoint ?? '1-cor-15-51');
        this.tweens.add({
            targets: [this.sleepVeil, this.nightVeil],
            alpha: 0,
            duration: 1800,
            ease: 'Sine.easeInOut'
        });
    }

    /** Match IntroScene "In the beginning" line for the Corinthians sleep beat. */
    private styleCueForMystery (): void {
        const { width, height } = this.scale;
        this.cueText
            .setStyle({
                fontFamily: 'Georgia, Palatino, serif',
                fontSize: '42px',
                color: '#f4ead8',
                backgroundColor: '#00000000',
                align: 'center',
                padding: { x: 0, y: 0 },
                wordWrap: { width: Math.min(640, width - 80) }
            })
            .setPosition(width / 2, height / 2 - 24)
            .setOrigin(0.5);
    }

    private styleCueForDay (): void {
        this.cueText
            .setStyle({
                fontFamily: 'Georgia, serif',
                fontSize: '18px',
                color: '#3d2c1e',
                backgroundColor: '#f3ead8cc',
                align: 'left',
                padding: { x: 10, y: 6 },
                wordWrap: { width: 720 }
            })
            .setPosition(16, 16)
            .setOrigin(0, 0);
    }

    private tickWolf (delta: number): void {
        if (!this.wolf || this.shepherd.isLyingDown || this.sleepVeil.alpha > 0.2) {
            return;
        }

        this.wolf.update(this.shepherd, delta);
    }

    private ensureWolf (): void {
        if (this.wolf || this.heardCorinthians) {
            return;
        }

        this.wolf = new Wolf(this, this.shepherd.sprite.x, this.shepherd.sprite.y);
    }

    private dismissWolf (): void {
        this.wolf?.destroy();
        this.wolf = null;
    }

    private applyNight (animate: boolean): void {
        this.nightStarted = true;
        this.nightDarkAt = this.time.now;
        this.nightFadeInMs = animate ? NIGHT_FADE_IN_MS : 0;
        this.ensurePen();
        // Day seek must not survive night — morning (and night saves) start at 0.
        fadeOutWorldMusic(this, animate ? NIGHT_FADE_IN_MS : 0, true);

        // Howls through the valley scare; stop after Psalm 23:4b (and stay silent on restore).
        if (!this.heardJohn102 && !this.heardPsalm4b) {
            startHowling(this);
        }

        this.ensureWolf();

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
        // Day: seek from applySavedWorldMusic / lastSeek. After night: seek was cleared to 0.
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

        if (name === 'Biscuit' && !this.heardPsalm3) {
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
        let farthestScore = -1;

        for (const sheep of followers) {
            const dist = Math.hypot(sheep.sprite.x - sx, sheep.sprite.y - sy);

            if (dist < STRAY_AHEAD_DISTANCE * STRAY_WARN_RESET_RATIO) {
                this.lagWarned.delete(sheep);
            }

            const score = dist * sheep.strayWeight;

            if (score > farthestScore) {
                farthestScore = score;
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
