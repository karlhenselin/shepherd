import { Scene, GameObjects, Geom, Scenes } from 'phaser';
import { Shepherd } from '../entities/Shepherd';
import { Wolf, WOLF_ATTACK_RANGE } from '../entities/Wolf';
import { Lion } from '../entities/Lion';
import { FOLLOW_DISTANCE, FOLLOW_SPEED, PET_DANCE_MS, FlockBehavior } from '../entities/flockBehavior';
import { Sheep } from '../entities/Sheep';
import {
    findPointAwayFromAll,
    GOAL_WALK_MIN,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    farthestCornerFrom,
    startCenter
} from '../world/constants';
import { GrassPatch, placeGrass } from '../world/GrassPatch';
import { WaterSource, placeWaters } from '../world/WaterSource';
import { Sheepfold } from '../world/Sheepfold';
import { Jerusalem } from '../world/Jerusalem';
import { Picnic } from '../world/Picnic';
import { ShadeTree, placeShadeTrees } from '../world/ShadeTree';
import { Hole, HOLE_KEEP_OUT_RADIUS } from '../world/Hole';
import { Thorns, THORN_SNARE_RADIUS, placeThorns } from '../world/Thorns';
import { StaffPickup } from '../world/StaffPickup';
import { BibleGem, placeBibleGems, spawnBibleGemAway } from '../world/BibleGem';
import { watercolorWorld } from '../world/watercolorWorld';
import { clearGoldPavers, goldPaverSpotOpen, nearestGoldPaverDist, rainGoldPaver } from '../world/goldPaver';
import { speakCue, silenceSpeech, pauseSpeech, resumeSpeech, speechAwaitingFinish, clearAllSpeech, hushSpeech, unhushSpeech } from '../ui/speech';
import { playGemDing, tickWalkSound } from '../audio/cues';
import { startHowling, stopHowling, suspendHowling, syncHowling, unsuspendHowling } from '../audio/howl';
import { isSoundOn, setSoundOn } from '../audio/soundPref';
import { WANDERLUST_KEY, WONDERS_KEY, EARTH_IN_BLOOM_KEY, applySavedWorldMusic, clearWorldMusicProgress, clearWorldMusicSeek, fadeInWorldMusic, fadeOutWorldMusic, getActiveWorldMusicKey, getWorldMusicProgress, isWorldMusicKey, setWorldMusicTrack, startWorldMusic, stopWorldMusic } from '../audio/worldMusic';
import { cueWaitingBleat, holdSheepSounds, playHappyBaah, playLaggingBaah, playStrayBaah, stopSheepSounds, tickNightBaahs as tickNightFlockBaahs, tickSheepSounds } from '../audio/sheepSounds';
import { WELL_DONE_LINE } from '../audio/spokenLines';
import { corinthians15Line, isaiah11LionLine, isaiah11WolfLine, isaiah53Line, isaiah65LionLine, john10Line, john14Line, MATTHEW_25_23, psalm23Comfort, psalm23FiveTable, psalm23Half, revelation21CityLine } from '../data/scripture';
import { nextWaterVerseId, waterVerseLine } from '../data/waterVerses';
import { nextTreeVerseId, treeVerseLine } from '../data/treeVerses';
import { nextThornSnareVerseId, thornVerseLine, EZEKIEL_28_24 } from '../data/thornVerses';
import { BibleGemHint } from '../ui/BibleGemHint';
import { LostSheepHint, isHintTargetOnScreen } from '../ui/LostSheepHint';
import { spawnPetHeart } from '../ui/petHeart';
import { AnalogStick } from '../ui/AnalogStick';
import { BandageButton } from '../ui/BandageButton';
import { chromePad, cuePad, isPhoneChrome, makeHudInteractive } from '../ui/chromeInsets';
import { SETTINGS_GEAR_KEY, SETTINGS_GEAR_SIZE, ensureSettingsGear } from '../ui/settingsGear';
import { SOUND_ICON_SIZE, ensureSoundIcons, soundIconKey } from '../ui/soundIcon';
import { TREASURE_CHEST_KEY, TREASURE_CHEST_SIZE, ensureTreasureChest } from '../ui/treasureChest';
import { applyAchievements, syncAchievements } from '../achievements/achievements';
import { GameSave, StoryCheckpoint, loadSave, writeSave, clearSave } from '../save/gameSave';

const FLOCK_NAMES = ['Clover', 'Snowball', 'Milo', 'Biscuit'];
const PEACEABLE_JOINERS = ['Leo', 'Sarah'] as const;
const SHEPHERD_SPEED = 180;
const STRAY_AHEAD_DISTANCE = FOLLOW_DISTANCE + (SHEPHERD_SPEED - FOLLOW_SPEED) * 7;
/** Once lagging sheep crosses this fraction of stray distance, fire one warning baah. */
const STRAY_WARN_RATIO = 0.78;
/** Drop below this fraction to allow another warning if they fall behind again. */
const STRAY_WARN_RESET_RATIO = 0.55;
const STRAY_COOLDOWN_MS = 18000;
const STRAY_TELEPORT_MIN = 1300;
const STRAY_TELEPORT_GAP = 200;
/** Initial / next waiting sheep: at least one goal-walk from the shepherd. */
const WAITING_SPAWN_MIN = GOAL_WALK_MIN;
const WAITING_SPAWN_GAP = GOAL_WALK_MIN;
const BANDAGE_RANGE = 100;
/** Kneel duration while bandaging the trapped sheep. */
const BANDAGE_KNEEL_MS = 2000;
/** Apply heal / scripture a beat into the kneel. */
const BANDAGE_HEAL_AT_MS = 650;
/** After a rescue, thorns stay off until the shepherd walks this far. */
const THORN_REARM_WALK = 300;
/** After a shade sit, stay off until the shepherd walks this far from the tree (pets + revisit). */
const TREE_REST_COOLDOWN_PX = 300;
/** After a flock drink, stay off until the shepherd walks this far from the water. */
const WATER_DRINK_COOLDOWN_PX = 300;
/** Walk toward Jerusalem within this cone to rain gold stones. */
const CITY_AIM_DOT = 0.82;
/** Next stone: how much to follow last→city vs the walk heading. */
const GOLD_FROM_LAST = 0.8;
/** First stone: how much to lean toward the city vs the walk heading. */
const GOLD_CITY_BLEND = 0.7;
const GOLD_SPACING = 64;
const GOLD_AHEAD_MIN = 200;
/** Never rain a stone farther from the shepherd than this. */
const GOLD_MAX_FROM_PLAYER = 400;
/** Walk this far from every stone before starting a fresh path (reusing the same 24). */
const GOLD_ABANDON_PATH = 600;
/** Land this far along the walk heading so the shepherd cannot catch the stone mid-fall. */
const GOLD_MIN_IN_FRONT = 110;
const HOLE_ASIDE_DIST = 156;
const HOLE_ENTER_NUDGE = 16;
/** Pause stray teleport / lag warning and walk-into petting while shepherd is this close to the hole. */
const HOLE_PROXIMITY_PAUSE = 200;
/** After the flock is settled in the pen, wait this long before lying down. */
const PEN_SLEEP_DELAY_MS = 1000;
/** After Psalm 23:5, stand and walk to the gate before lying down. */
const TABLE_GATE_PAUSE_MS = 3000;
/** Slow walk from the picnic to the south opening. */
const TABLE_GATE_WALK_SPEED = 58;
/** Pause after the scare beat before speaking Psalm 23:4b. */
const FEAR_NO_EVIL_DELAY_MS = 3000;
/** Lion charge across the gate after the shepherd lies down. */
const LION_CHARGE_SPEED = 210;
/** Pack sprint once the lion closes in. */
const WOLF_CHASE_FLEE_SPEED = 176;
/** Start the east flee when the lion is this close to a wolf. */
const LION_FLUSH_RANGE = 240;
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

/** Biscuit is the lamb — softer, smaller words. */
const BABY_PET_LINES: Array<(name: string) => string> = [
    (name) => `Easy, ${name}.`,
    (name) => `Gentle now, ${name}.`,
    (name) => `Tiny ${name}.`,
    (name) => `Love you, ${name}.`,
    () => 'Easy, little one.',
    () => 'There, little lamb.',
    () => 'Sweet baby.',
    () => 'Good little lamb.',
    () => 'What a little lamb.',
    () => 'Come here, little one.'
];

/** Leo — big cat, still a pet. */
const LION_PET_LINES: Array<(name: string) => string> = [
    (name) => `Hey, ${name}.`,
    (name) => `Easy, ${name}.`,
    (name) => `Love you, ${name}.`,
    (name) => `There you are, ${name}.`,
    (name) => `Come here, ${name}.`,
    () => 'What a mane.',
    () => 'Good lion.',
    () => 'Easy, big guy.',
    () => 'Gentle now, king.',
    () => 'Such a good lion.'
];

/** Sarah — once a hunter, now one of the flock. */
const WOLF_PET_LINES: Array<(name: string) => string> = [
    (name) => `Hey, ${name}.`,
    (name) => `Easy, ${name}.`,
    (name) => `Love you, ${name}.`,
    (name) => `There you are, ${name}.`,
    (name) => `Come here, ${name}.`,
    (name) => `Sweet ${name}.`,
    () => 'Good girl.',
    () => 'Good wolf.',
    () => 'Not so scary now.',
    () => 'What a soft wolf.'
];

function petLinesFor (name: string): Array<(name: string) => string> {
    if (name === 'Biscuit') {
        return BABY_PET_LINES;
    }

    if (name === 'Leo') {
        return LION_PET_LINES;
    }

    if (name === 'Sarah') {
        return WOLF_PET_LINES;
    }

    return PET_LINES;
}

export class WorldScene extends Scene {
    private shepherd!: Shepherd;
    private flock: FlockBehavior[] = [];
    private grass: GrassPatch[] = [];
    private water: WaterSource[] = [];
    private trees: ShadeTree[] = [];
    private picnic: Picnic | null = null;
    private tableWolves: Wolf[] = [];
    private departingWolves: Wolf[] = [];
    private chaseLion: Lion | null = null;
    private lionChaseDone = false;
    private gateVerseDone = false;
    private wolvesFlushed = false;
    private sheepfold: Sheepfold | null = null;
    private city: Jerusalem | null = null;
    private hole: Hole | null = null;
    private thorns: Thorns[] = [];
    private thornsArmed = true;
    /** Set after a thorn rescue; snares stay off until the shepherd walks `THORN_REARM_WALK`. */
    private thornsRearmFrom: { x: number; y: number } | null = null;
    private wolf: Wolf | null = null;
    /** Earliest `time.now` the night wolf may strike again. */
    private wolfAttackReadyAt = 0;
    private staffPickup: StaffPickup | null = null;
    private gems: BibleGem[] = [];
    private foundGems: string[] = [];
    private foundWaterVerses: string[] = [];
    private foundTreeVerses: string[] = [];
    private foundThornVerses: string[] = [];
    private penTableStarted = false;
    /** Walk into the south opening without fence keep-outs, then lie down as the gate. */
    private walkingToGate = false;
    /** Pond the flock just drank at; locked until the shepherd walks `WATER_DRINK_COOLDOWN_PX` away. */
    private waterHold: WaterSource | null = null;
    private drinkCuePlayed = false;
    private drinkGatherAt = 0;
    private treeVisit: ShadeTree | null = null;
    /** After a shade sit, locked until the shepherd walks `TREE_REST_COOLDOWN_PX` from the tree. */
    private treePetFrom: { x: number; y: number } | null = null;
    private lastCheckpoint: StoryCheckpoint | null = null;
    private nightVeil!: GameObjects.Rectangle;
    private cueText!: GameObjects.Text;
    private soundToggle!: GameObjects.Image;
    private hudSettings!: GameObjects.Image;
    private hudChest!: GameObjects.Image;
    private hudCheat!: GameObjects.Text;
    private analogStick!: AnalogStick;
    private bandageButton!: BandageButton;
    private bandageRescuing = false;
    private lastCue = '';
    private scriptId = 0;
    private scriptPlaying = false;
    private wellDoneStarted = false;
    private sawWellDone = false;
    private returningToIntro = false;
    /** Gem verses waiting until the current spoken script finishes. */
    private gemVerseQueue: string[] = [];
    /** Story lines waiting until the current spoken script finishes (do not cancel it). */
    private scriptQueue: { lines: string[]; onDone?: () => void }[] = [];
    /** Tree verse waiting until current speech finishes (sit happens immediately). */
    private pendingTreeVerseId: string | null = null;
    /** Verse to speak once the shepherd finishes walking into the shade. */
    private shadeVerseId: string | null = null;
    /** Kneeling under a shade tree until its verse finishes. */
    private treeResting = false;
    /** Finish the current shade sit before darkening the world. */
    private nightAfterTree = false;
    private strayReadyAt = 0;
    private lagWarned = new WeakSet<FlockBehavior>();
    private lostHint!: LostSheepHint;
    private gemHint!: BibleGemHint;
    private lastGoldStone: { x: number; y: number } | null = null;
    private nextNames = FLOCK_NAMES.slice(1);
    private foundCount = 0;
    private heardPsalm1 = false;
    private heardPsalm1b = false;
    private heardPsalm2 = false;
    private heardPsalm2b = false;
    private heardPsalm3 = false;
    private heardPsalm3b = false;
    private heardPsalm4a = false;
    private heardPsalm4b = false;
    private heardPsalm4c = false;
    private heardPsalm5 = false;
    private heardPsalm6 = false;
    private heardJohn102 = false;
    private heardJohn109 = false;
    private heardCorinthians = false;
    private heardCity = false;
    private heardIsaiah6525 = false;
    /** When `time.now` reaches this, the shepherd may lie down (0 = flock not settled). */
    private penSleepAt = 0;
    private nightStarted = false;
    private nightDarkAt = 0;
    private nightFadeInMs = 0;
    private sleepVeil!: GameObjects.Rectangle;
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
        this.input.addPointer(3);

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

        this.water = save?.water && save.water.length >= 5
            ? save.water.map((point, i) => new WaterSource(this, point.x, point.y, i === 0 ? 1 : 0.5))
            : placeWaters(this);
        this.trees = placeShadeTrees(this);

        if (save?.grass?.length) {
            this.grass = save.grass.map((point) => new GrassPatch(this, point.x, point.y));
        }
        else {
            this.grass = placeGrass(this);
        }

        this.thorns = placeThorns(this, this.water);

        if (save?.pen) {
            this.ensurePen(save.pen);
        }

        this.ensureCity(save?.pen);

        const cue = cuePad();
        this.cueText = this.add.text(cue.x, cue.y, 'Find your sheep.', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#3d2c1e',
            backgroundColor: '#f3ead8cc',
            padding: { x: 10, y: 6 },
            wordWrap: { width: Math.max(200, this.scale.width - 220) }
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
        this.analogStick = new AnalogStick(this, (x, y) => this.shepherd.setMoveStick(x, y));
        this.layoutChrome();
        this.scale.on('resize', this.layoutChrome, this);

        if (save) {
            this.foundGems = save.foundGems ?? [];
            this.foundWaterVerses = save.foundWaterVerses ?? [];
            this.foundTreeVerses = save.foundTreeVerses ?? [];
            this.foundThornVerses = save.foundThornVerses ?? [];
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

        this.events.on(Scenes.Events.RESUME, this.onWorldResume, this);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.scriptId += 1;
            this.events.off(Scenes.Events.RESUME, this.onWorldResume, this);
            this.game.events.off('blur', this.holdWorldAudio, this);
            this.game.events.off('hidden', this.holdWorldAudio, this);
            this.game.events.off('focus', this.releaseWorldAudio, this);
            this.game.events.off('visible', this.releaseWorldAudio, this);
            this.scale.off('resize', this.layoutChrome, this);
            this.analogStick?.destroy();
            clearAllSpeech();
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
        if (this.wellDoneStarted) {
            return;
        }

        const keepOuts = this.worldKeepOuts();
        this.shepherd.update(this.shepherdKeepOuts(keepOuts));
        this.analogStick?.fadeVisible(this.stickChromeVisible());
        tickWalkSound(this, this.shepherd.isMoving && !this.shepherd.isLyingDown);
        watercolorWorld().rainIntoView(this);
        this.maybeRainGoldRoad();
        watercolorWorld().tick(this, this.time.now);

        this.tryUnlockLoadPetting();

        const flockKeepOuts = this.flockKeepOuts(keepOuts);

        for (const sheep of this.flock.slice()) {
            // Hold followers at spawn until the shepherd moves (restore ring / dawn gather).
            if (this.loadPetsLocked && sheep.mood === 'following') {
                continue;
            }

            const event = sheep.update(
                this.shepherd,
                this.grass,
                this.nightStarted,
                flockKeepOuts
            );

            if (event === 'found') {
                if (sheep.peaceable) {
                    this.onFoundPeaceable(sheep);
                }
                else {
                    this.onFoundSheep(sheep);
                }
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

        if (this.heardCorinthians) {
            const now = this.time.now;

            for (const patch of this.grass) {
                patch.maybeGrowBack(now);
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
        this.tickTableWolves(delta);
        this.tickLionChase(delta);
        this.tickDepartingWolves(delta);
        this.maybeFinishLionChase();
        this.tickThorns();
        this.sheepfold?.tickGlow(this.nightVeil.alpha, this.time.now);
        tickSheepSounds(this, this.flock, this.shepherd.sprite, this.nightStarted);
        this.lostHint.update(this, this.shepherd, this.hintTarget(), Boolean(this.staffPickup));
        this.gemHint.update(this, this.shepherd, this.gemHintTarget());
        this.maybeBeginWellDone();
        this.updateBandageButton();
        this.tickPetting();
        this.maybePickupStaff();
        this.maybeCollectGem();
        this.maybeFlockDrink();
        this.maybeStartFlockSip();
        this.maybeShadeTree();
        this.tickShadeTreeWalk();
        this.maybeReachPen();
        this.tickPenTableWalk();
        this.maybeEnterCity();
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

        if (this.treePetFrom && this.treeRestOnCooldown()) {
            return;
        }

        if (
            this.time.now < this.pettingReadyAt
            || this.nightStarted
            || this.scriptPlaying
            || this.bandageRescuing
            || this.isNearHole()
            || this.shepherd.isLyingDown
            || this.shepherd.isSitting
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

    private startPetting (sheep: FlockBehavior): void {
        // No kneel / pet / dance at night (walk-into or find celebration).
        if (this.nightStarted) {
            return;
        }

        this.shepherd.beginPetting(sheep.sprite.x, sheep.sprite.y);
        playHappyBaah(this, sheep, this.shepherd.sprite);
        const hand = this.shepherd.petHandPosition();
        sheep.approachForPet(hand.x, hand.y, () => {
            this.shepherd.extendPettingFor(PET_DANCE_MS);
            sheep.beginHappyDance();
            spawnPetHeart(this, sheep.sprite.x, sheep.sprite.y);
        });

        // Walk-into pets only: skip while playLines/scripture is speaking (find cue is enough).
        if (!this.scriptPlaying) {
            const lines = petLinesFor(sheep.name);
            const line = lines[Math.floor(Math.random() * lines.length)](sheep.name);
            speakCue(line);
        }
    }

    /**
     * Find / stray-rejoin celebration: same kneel + baah + dance as walk-into petting.
     * Bypasses pet cooldown and scriptPlaying (speech can run alongside).
     */
    private celebrateFinding (sheep: FlockBehavior): void {
        if (
            this.shepherd.isLyingDown
            || this.shepherd.isSitting
            || this.shepherd.isGuided
            || this.treeResting
            || sheep.hurt
            || sheep.isBusy
            || this.isNearHole()
        ) {
            return;
        }

        this.startPetting(sheep);
    }

    private onFoundSheep (sheep: FlockBehavior): void {
        this.foundCount += 1;
        this.saveProgress(sheep.hurt ? 'hurt-sheep' : 'found-sheep');
        this.celebrateFinding(sheep);

        if (this.foundCount === 1) {
            this.playLines([
                `${sheep.name}! I found you!`,
                psalm23Half(1, 'a')
            ], () => {
                this.makeFlockHungry();
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
                this.spawnNextSheep();
                this.showCue('A sheep is missing.');
            });
            return;
        }

        this.playLines([
            `${sheep.name}! I found you!`
        ], () => {
            this.spawnNextSheep();
        });
    }

    private onFoundPeaceable (sheep: FlockBehavior): void {
        this.saveProgress('found-sheep');
        this.celebrateFinding(sheep);
        sheep.snack = true;

        const lines = sheep.name === 'Leo'
            ? [isaiah11LionLine()]
            : sheep.name === 'Sarah'
                ? ['I\'ll name you Sarah!', isaiah11WolfLine()]
                : [`${sheep.name}! I found you!`, isaiah11WolfLine()];
        this.playLines(lines, () => {
            this.spawnNextSheep();
            const next = this.flock.find((member) => member.peaceable && member.mood === 'waiting' && !member.discovered);

            if (next) {
                this.showCue('Enlarge the flock.');
            }
        });
    }

    private onAte (sheep: FlockBehavior): void {
        if (this.maybeLionGrassVerse(sheep)) {
            return;
        }

        if (this.heardPsalm2) {
            return;
        }

        this.heardPsalm2 = true;
        this.continueLines([
            psalm23Half(2, 'a'),
            isaiah53Line()
        ], () => {
            this.spawnNextSheep();
        });
    }

    /** After the change: Isaiah 65:25 the first time Leo eats grass. */
    private maybeLionGrassVerse (sheep: FlockBehavior): boolean {
        if (this.heardIsaiah6525 || (sheep.name !== 'Leo' && sheep.name !== 'Lion')) {
            return false;
        }

        this.heardIsaiah6525 = true;
        this.saveProgress(this.lastCheckpoint ?? '1-cor-15-51');
        this.continueLines([isaiah65LionLine()]);
        return true;
    }

    private onDrank (_sheep: FlockBehavior): void {
        if (this.drinkCuePlayed) {
            return;
        }

        this.drinkCuePlayed = true;

        if (!this.heardPsalm2b) {
            this.heardPsalm2b = true;
            this.playLines([
                psalm23Half(2, 'b')
            ], () => {
                this.spawnNextSheep();
            });
            return;
        }

        const verseId = nextWaterVerseId(this.foundWaterVerses);

        if (!verseId || this.scriptPlaying) {
            return;
        }

        this.foundWaterVerses.push(verseId);
        this.saveProgress(this.lastCheckpoint ?? 'found-gem');
        this.playLines([
            'The flock is drinking.',
            waterVerseLine(verseId)
        ]);
    }

    private playLines (lines: string[], onDone?: () => void): void {
        const id = ++this.scriptId;
        this.scriptPlaying = true;
        this.speakLines(id, lines, onDone);
    }

    /** Play now, or after the current script, without cancelling that script's onDone. */
    private continueLines (lines: string[], onDone?: () => void): void {
        if (this.scriptPlaying) {
            this.scriptQueue.push({ lines, onDone });
            return;
        }

        this.playLines(lines, onDone);
    }

    private flushScriptQueue (): boolean {
        const next = this.scriptQueue.shift();

        if (!next) {
            return false;
        }

        this.playLines(next.lines, next.onDone);
        return true;
    }

    private speakLines (id: number, lines: string[], onDone?: () => void): void {
        if (id !== this.scriptId) {
            return;
        }

        if (lines.length === 0) {
            if (this.gemVerseQueue.length > 0) {
                const queued = this.gemVerseQueue.splice(0);
                this.speakLines(id, queued, onDone);
                return;
            }

            this.scriptPlaying = false;
            onDone?.();

            if (this.scriptPlaying) {
                return;
            }

            if (this.flushPendingTreeVerse()) {
                return;
            }

            if (this.flushScriptQueue()) {
                return;
            }

            // Restore direction text on screen only — do not re-speak after scripture/gem lines.
            this.showCue(this.flockCue(), false);

            return;
        }

        const [line, ...rest] = lines;
        this.showCue(line, false);

        if (line.includes('Psalm 23:1b')) {
            this.heardPsalm1b = true;
        }

        const checkpoint = checkpointForLine(line);

        if (checkpoint) {
            this.markScripture(checkpoint);
            this.saveProgress(checkpoint);
        }

        speakCue(line, () => this.speakLines(id, rest, onDone));
    }

    private makeFlockHungry (): void {
        for (const sheep of this.flock) {
            if (sheep.mood === 'waiting') {
                continue;
            }

            sheep.hungry = true;
        }

        const lines = [this.hungryCue()];

        if (!this.heardPsalm1b) {
            lines.push(psalm23Half(1, 'b'));
        }

        this.playLines(lines);
    }

    private makeFlockThirsty (): void {
        if (this.hasSheepToFind()) {
            return;
        }

        for (const sheep of this.flock) {
            if (sheep.mood === 'waiting') {
                continue;
            }

            sheep.thirsty = true;
        }
    }

    private hungryCue (): string {
        const hungry = this.flock.filter((sheep) => sheep.hungry && sheep.mood !== 'waiting');

        if (hungry.length === 1) {
            return `${hungry[0].name} is hungry.`;
        }

        return 'The sheep are hungry.';
    }

    private flockCue (): string {
        const hurt = this.hurtNeedingBandage();

        if (hurt?.hurtByWolf || hurt?.snaredInThorns) {
            return `Help ${hurt.name}!`;
        }

        if (hurt) {
            return `Bandage ${hurt.name}.`;
        }

        const drinking = this.flock.some((sheep) => sheep.mood === 'drinking');

        if (drinking) {
            return 'The flock is drinking.';
        }

        const wandered = this.flock.find((sheep) => sheep.mood === 'waiting' && sheep.discovered);

        if (wandered) {
            return `${wandered.name} wandered off.`;
        }

        if (this.hasSheepToFind()) {
            const seek = this.flock.find((sheep) =>
                sheep.peaceable && (sheep.mood === 'waiting' || sheep.hurt) && !sheep.discovered
            );

            if (seek) {
                return 'Enlarge the flock.';
            }

            return this.foundCount === 1 ? 'Another sheep is missing.' : 'Find your sheep.';
        }

        if (this.cityObjectiveOpen()) {
            return 'Enter the city.';
        }

        if (this.flock.some((sheep) => sheep.hungry) && !this.heardCorinthians) {
            return this.hungryCue();
        }

        if (this.flock.some((sheep) => sheep.thirsty) && !this.heardCorinthians) {
            return 'The sheep are thirsty.';
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

            return 'You reached the pen.';
        }

        return '';
    }

    /** Undiscovered waiting / hole sheep still ahead in find order. */
    private hasSheepToFind (): boolean {
        return this.flock.some((sheep) =>
            sheep.mood === 'waiting' || (sheep.hurt && !sheep.discovered)
        );
    }

    private hintTarget (): { x: number; y: number } | null {
        const hurt = this.hurtNeedingBandage();

        if (hurt) {
            return { x: hurt.sprite.x, y: hurt.sprite.y };
        }

        const lost = this.flock.filter((sheep) => sheep.mood === 'waiting' || (sheep.hurt && !sheep.discovered));
        const seek = lost.filter((sheep) => !sheep.discovered);

        if (seek.length > 0) {
            return this.closestToShepherd(seek.map((sheep) => sheep.sprite));
        }

        if (lost.length > 0) {
            return this.closestToShepherd(lost.map((sheep) => sheep.sprite));
        }

        if (!this.heardCorinthians && this.flock.some((sheep) => sheep.hungry)) {
            const fresh = this.grass.filter((patch) => patch.available);

            if (fresh.length > 0) {
                return this.closestToShepherd(fresh);
            }
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

    /** Nearest Bible gem, or trees/water that still have unread passages once gems are gone. */
    private gemHintTarget (): { x: number; y: number } | null {
        if (this.gems.length > 0) {
            return this.closestToShepherd(this.gems);
        }

        const spots: { x: number; y: number }[] = [];

        if (!this.nightStarted && !this.nightAfterTree
            && nextTreeVerseId(this.foundTreeVerses, this.shepherd.wearsWhite)) {
            spots.push(...this.trees);
        }

        if (nextWaterVerseId(this.foundWaterVerses)) {
            spots.push(...this.water);
        }

        if (spots.length === 0) {
            return null;
        }

        return this.closestToShepherd(spots);
    }

    /** When the gem hint has nothing left to point at, fade out and return to the intro. */
    private maybeBeginWellDone (): void {
        if (this.wellDoneStarted || this.overlayOpen() || this.scriptPlaying) {
            return;
        }

        if (this.gemHintTarget()) {
            return;
        }

        if (this.foundGems.length === 0 && this.gems.length === 0) {
            return;
        }

        this.beginWellDone();
    }

    private beginWellDone (): void {
        this.wellDoneStarted = true;
        this.sawWellDone = true;
        this.scriptId += 1;
        this.scriptPlaying = true;
        this.saveProgress(this.lastCheckpoint ?? 'found-gem');
        fadeOutWorldMusic(this, 1600);
        holdSheepSounds(this);
        stopHowling();
        this.sleepVeil.setDepth(23);
        this.sleepVeil.setInteractive();

        this.tweens.add({
            targets: this.sleepVeil,
            alpha: 1,
            duration: 1800,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (!this.sys.isActive() || this.returningToIntro) {
                    return;
                }

                this.showWellDoneMenu();
            }
        });
    }

    private showWellDoneMenu (): void {
        const { width, height } = this.scale;
        const cx = width / 2;

        this.add.text(cx, height / 2 - 132, MATTHEW_25_23.text, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '36px',
            color: '#f4ead8',
            align: 'center',
            wordWrap: { width: width - 80 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(25);

        this.add.text(cx, height / 2 - 78, `— ${MATTHEW_25_23.ref}`, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '18px',
            color: '#f4ead8',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(25).setAlpha(0.85);

        speakCue(WELL_DONE_LINE);

        this.analogStick?.setVisible(false);

        this.addWellDoneChest(cx, height / 2 + 16);
        this.addWellDoneButton(cx, height / 2 + 80, 'Achievements', () => this.openAchievements());
        this.addWellDoneButton(cx, height / 2 + 144, 'Restart', () => this.returnToIntro());
    }

    private addWellDoneChest (x: number, y: number): void {
        ensureTreasureChest(this);

        const iconSize = 28;
        const gap = 8;
        const padX = 22;
        const padY = 10;
        const umber = '#3d2c1e';
        const hover = '#5c4634';

        const label = this.add.text(0, 0, 'Treasure chest', {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '22px',
            color: umber
        }).setOrigin(0, 0.5);

        const icon = this.add.image(0, 0, TREASURE_CHEST_KEY)
            .setDisplaySize(iconSize, iconSize)
            .setOrigin(0, 0.5);

        const innerW = iconSize + gap + label.width;
        const innerH = Math.max(iconSize, label.height);
        const boxW = innerW + padX * 2;
        const boxH = innerH + padY * 2;
        const bg = this.add.rectangle(0, 0, boxW, boxH, 0xf3ead8).setOrigin(0.5);

        icon.setPosition(-innerW / 2, 0);
        label.setPosition(-innerW / 2 + iconSize + gap, 0);

        const box = this.add.container(x, y, [bg, icon, label])
            .setScrollFactor(0)
            .setDepth(26)
            .setInteractive({
                hitArea: new Geom.Rectangle(-boxW / 2, -boxH / 2, boxW, boxH),
                hitAreaCallback: Geom.Rectangle.Contains,
                useHandCursor: true
            });

        box.setData('ui', true);
        box.on('pointerover', () => {
            label.setColor(hover);
            icon.setTint(0xc4a882);
        });
        box.on('pointerout', () => {
            label.setColor(umber);
            icon.clearTint();
        });
        box.on('pointerdown', (_pointer: unknown, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openTreasure();
        });
    }

    private addWellDoneButton (x: number, y: number, label: string, onClick: () => void): void {
        const button = this.add.text(x, y, label, {
            fontFamily: 'Georgia, Palatino, serif',
            fontSize: '22px',
            color: '#3d2c1e',
            backgroundColor: '#f3ead8',
            padding: { x: 22, y: 10 },
            align: 'center'
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(26)
            .setInteractive({ useHandCursor: true });

        button.setData('ui', true);
        button.on('pointerover', () => button.setColor('#5c4634'));
        button.on('pointerout', () => button.setColor('#3d2c1e'));
        button.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            onClick();
        });
    }

    private openAchievements (): void {
        if (this.overlayOpen()) {
            return;
        }

        pauseSpeech();
        this.scene.pause();
        this.scene.launch('AchievementsScene');
    }

    private returnToIntro (): void {
        if (this.returningToIntro || !this.sys.isActive()) {
            return;
        }

        this.returningToIntro = true;
        clearSave();
        clearAllSpeech();
        this.scene.start('IntroScene');
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

    private hasLostSheep (): boolean {
        return this.flock.some((sheep) =>
            (sheep.mood === 'waiting' || sheep.hurt) && !sheep.discovered
        );
    }

    private spawnNextSheep (): void {
        if (this.hasLostSheep()) {
            return;
        }

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

        if (checkpoint === 'psalm-23-5') {
            this.heardPsalm5 = true;
        }

        if (checkpoint === 'psalm-23-6') {
            this.heardPsalm6 = true;
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

        if (checkpoint === 'entered-city') {
            this.heardCity = true;
        }
    }

    private saveProgress (checkpoint: StoryCheckpoint): void {
        this.lastCheckpoint = checkpoint;
        // Keep discovered hurt followers in foundNames (thorns / wolf). Only
        // undiscovered waiting/hurt sheep are "still to find".
        const foundNames = this.flock
            .filter((sheep) => {
                if (sheep.mood === 'waiting') {
                    return false;
                }

                if (sheep.mood === 'hurt' && !sheep.discovered) {
                    return false;
                }

                return true;
            })
            .map((sheep) => sheep.name);
        const waiting = this.flock.find((sheep) =>
            (sheep.mood === 'waiting' || (sheep.mood === 'hurt' && !sheep.discovered)) && !sheep.discovered
        ) ?? this.flock.find((sheep) => sheep.mood === 'waiting' && sheep.discovered);
        const snaredName = this.flock.find((sheep) => sheep.snaredInThorns)?.name ?? null;
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
            heardPsalm1b: this.heardPsalm1b,
            heardPsalm2: this.heardPsalm2,
            heardPsalm2b: this.heardPsalm2b,
            heardPsalm3: this.heardPsalm3,
            heardPsalm3b: this.heardPsalm3b,
            heardPsalm4a: this.heardPsalm4a,
            heardPsalm4b: this.heardPsalm4b,
            heardPsalm4c: this.heardPsalm4c,
            heardPsalm5: this.heardPsalm5,
            heardPsalm6: this.heardPsalm6,
            heardJohn102: this.heardJohn102,
            heardJohn109: this.heardJohn109,
            heardCorinthians: this.heardCorinthians,
            heardCity: this.heardCity,
            heardIsaiah6525: this.heardIsaiah6525,
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
            foundWaterVerses: [...this.foundWaterVerses],
            foundTreeVerses: [...this.foundTreeVerses],
            foundThornVerses: [...this.foundThornVerses],
            snaredName,
            unlockedAchievements: previous?.unlockedAchievements ?? [],
            sawWellDone: this.sawWellDone,
            musicKey: music.key,
            musicSeek: music.seek
        }));
    }

    private restoreSave (save: GameSave): void {
        this.foundCount = save.foundCount;
        this.nextNames = [...save.nextNames];
        this.heardPsalm1 = save.heardPsalm1;
        this.heardPsalm1b = save.heardPsalm1b === true;
        this.heardPsalm2 = save.heardPsalm2;
        this.heardPsalm2b = save.heardPsalm2b === true || save.heardPsalm3;
        this.heardPsalm3 = save.heardPsalm3;
        this.heardPsalm3b = save.heardPsalm3b === true;
        this.heardPsalm4a = save.heardPsalm4a === true;
        this.heardPsalm4b = save.heardPsalm4b === true;
        this.heardPsalm4c = save.heardPsalm4c === true;
        this.heardPsalm5 = save.heardPsalm5 === true;
        this.heardPsalm6 = save.heardPsalm6 === true;
        this.heardJohn102 = save.heardJohn102 === true;
        this.heardJohn109 = save.heardJohn109 === true;
        this.heardCorinthians = save.heardCorinthians === true;
        this.heardCity = save.heardCity === true;
        this.heardIsaiah6525 = save.heardIsaiah6525 === true;
        this.sawWellDone = save.sawWellDone === true;
        this.foundGems = save.foundGems ?? this.foundGems;
        this.foundWaterVerses = save.foundWaterVerses ?? this.foundWaterVerses;
        this.foundTreeVerses = save.foundTreeVerses ?? this.foundTreeVerses;
        this.foundThornVerses = save.foundThornVerses ?? this.foundThornVerses;

        if (save.foundNames.length > 0) {
            this.loadPetsLocked = true;
            this.petUnlockOrigin = {
                x: this.shepherd.sprite.x,
                y: this.shepherd.sprite.y
            };
        }

        save.foundNames.forEach((name, slot) => {
            const angle = (slot / Math.max(save.foundNames.length, 1)) * Math.PI * 2;
            const sheep = this.createFlockMember(
                this.shepherd.sprite.x + Math.cos(angle) * RESTORE_FOLLOW_RING,
                this.shepherd.sprite.y + Math.sin(angle) * RESTORE_FOLLOW_RING,
                name,
                slot
            );

            if (save.snaredName === name && this.thorns.length > 0) {
                const patch = this.nearestThorn(this.shepherd.sprite.x, this.shepherd.sprite.y)
                    ?? this.thorns[0];
                const spot = patch.snareSpot();
                sheep.snareInThorns(spot.x, spot.y);
                patch.revealSnare();
                this.thornsArmed = false;
                this.thornsRearmFrom = null;
            }
            else {
                sheep.beginFollowing();
                // Treat as recently petted so walk-into cannot fire the instant follow resumes.
                sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
            }

            sheep.hungry = !this.heardCorinthians && save.heardPsalm1 && !save.heardPsalm2;
            sheep.snack = this.heardCorinthians;
            sheep.changed = this.heardCorinthians;
            // Hold thirst until every sheep due to be found is present — not while one is missing.
            sheep.thirsty = save.foundCount >= 2
                && !this.heardPsalm2b
                && !save.waitingName;
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
            this.spawnNextSheep();
            this.showCue('A sheep is missing.');
        }

        if (save.heardPsalm1 && !save.heardPsalm1b && !save.heardPsalm2) {
            this.playLines([psalm23Half(1, 'b')]);
        }

        if (this.heardPsalm4a && !this.heardCorinthians) {
            this.applyNight(false);
        }
        else if (this.heardPsalm3b && !this.heardCorinthians) {
            this.beginNight();
        }
        else if (this.heardPsalm3 && !this.heardPsalm3b) {
            this.playLines([psalm23Half(3, 'b')], () => this.beginNight());
        }

        if (this.heardPsalm4a && !this.heardPsalm4b && !this.heardCorinthians) {
            this.beginStaffBeat();
        }

        if (this.heardPsalm4b && !this.heardCorinthians) {
            this.ensureWolf();
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

            if (
                save.player
                && (save.checkpoint === 'enter-city' || save.checkpoint === 'entered-city')
            ) {
                this.placePartyAt(save.player.x, save.player.y);
            }
        }
        else if (this.heardJohn109) {
            this.settleFold();
            this.beginMystery();
        }

        if (this.heardCorinthians) {
            this.applyPeaceableKingdom();
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
        this.trees = [];
        this.picnic?.destroy();
        this.picnic = null;
        this.destroyAllWolves();
        this.lionChaseDone = false;
        this.gateVerseDone = false;
        this.wolvesFlushed = false;
        this.foundWaterVerses = [];
        this.foundTreeVerses = [];
        this.penTableStarted = false;
        this.walkingToGate = false;
        this.waterHold = null;
        this.drinkCuePlayed = false;
        this.drinkGatherAt = 0;
        this.treeVisit = null;
        this.treeResting = false;
        this.nightAfterTree = false;
        this.shadeVerseId = null;
        this.lastGoldStone = null;
        clearGoldPavers(this);
        this.lastCue = '';
        this.scriptPlaying = false;
        this.wellDoneStarted = false;
        this.sawWellDone = false;
        this.returningToIntro = false;
        this.gemVerseQueue = [];
        this.scriptQueue = [];
        this.pendingTreeVerseId = null;
        this.nextNames = FLOCK_NAMES.slice(1);
        this.foundCount = 0;
        this.heardPsalm1 = false;
        this.heardPsalm1b = false;
        this.heardPsalm2 = false;
        this.heardPsalm2b = false;
        this.heardPsalm3 = false;
        this.heardPsalm3b = false;
        this.heardPsalm4a = false;
        this.heardPsalm4b = false;
        this.heardPsalm4c = false;
        this.heardPsalm5 = false;
        this.heardPsalm6 = false;
        this.heardJohn102 = false;
        this.heardJohn109 = false;
        this.heardCorinthians = false;
        this.heardCity = false;
        this.heardIsaiah6525 = false;
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        clearWorldMusicProgress();
        setWorldMusicTrack(this, WANDERLUST_KEY);
        this.sheepfold = null;
        this.city = null;
        this.hole = null;
        this.thorns = [];
        this.thornsArmed = true;
        this.thornsRearmFrom = null;
        this.wolfAttackReadyAt = 0;
        this.staffPickup = null;
        this.gems = [];
        this.foundGems = [];
        this.lastCheckpoint = null;
        this.strayReadyAt = 0;
        this.penSleepAt = 0;
        this.pettingReadyAt = 0;
        this.loadPetsLocked = false;
        this.petUnlockOrigin = { x: 0, y: 0 };
        this.treePetFrom = null;
    }

    private addSettingsButton (): void {
        ensureSettingsGear(this);
        ensureSoundIcons(this);
        ensureTreasureChest(this);

        const settings = this.add.image(0, 0, SETTINGS_GEAR_KEY)
            .setDisplaySize(SETTINGS_GEAR_SIZE, SETTINGS_GEAR_SIZE)
            .setScrollFactor(0)
            .setDepth(23);

        makeHudInteractive(settings);
        settings.setData('ui', true);
        settings.on('pointerover', () => settings.setTint(0xc4a882));
        settings.on('pointerout', () => settings.clearTint());
        settings.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openSettings();
        });

        this.soundToggle = this.add.image(0, 0, soundIconKey(isSoundOn()))
            .setDisplaySize(SOUND_ICON_SIZE, SOUND_ICON_SIZE)
            .setScrollFactor(0)
            .setDepth(23);

        makeHudInteractive(this.soundToggle);
        this.soundToggle.setData('ui', true);
        this.soundToggle.on('pointerover', () => this.soundToggle.setTint(0xc4a882));
        this.soundToggle.on('pointerout', () => this.soundToggle.clearTint());
        this.soundToggle.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.toggleSound();
        });

        const chest = this.add.image(0, 0, TREASURE_CHEST_KEY)
            .setDisplaySize(TREASURE_CHEST_SIZE, TREASURE_CHEST_SIZE)
            .setScrollFactor(0)
            .setDepth(23);

        makeHudInteractive(chest);
        chest.setData('ui', true);
        chest.on('pointerover', () => chest.setTint(0xc4a882));
        chest.on('pointerout', () => chest.clearTint());
        chest.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openTreasure();
        });

        const cheat = this.add.text(0, 0, 'cheat', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#6b5344'
        })
            .setScrollFactor(0)
            .setDepth(23);

        makeHudInteractive(cheat);
        cheat.setData('ui', true);
        cheat.on('pointerover', () => cheat.setColor('#3d2c1e'));
        cheat.on('pointerout', () => cheat.setColor('#6b5344'));
        cheat.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openCheat();
        });

        this.hudSettings = settings;
        this.hudChest = chest;
        this.hudCheat = cheat;
        this.placeHudButtons();
    }

    private placeHudButtons (): void {
        if (!this.hudSettings || !this.soundToggle || !this.hudChest || !this.hudCheat) {
            return;
        }

        const { width, height } = this.scale;
        const pad = chromePad();
        const phone = isPhoneChrome();
        const originY = phone ? 1 : 0;
        const x = width - pad.right;
        const y = phone ? height - pad.bottom : pad.top;
        const cheatY = phone ? y - 6 : y + 6;

        this.hudSettings.setOrigin(1, originY).setPosition(x, y);
        this.soundToggle.setOrigin(1, originY).setPosition(
            this.hudSettings.x - this.hudSettings.displayWidth - 12,
            y
        );
        this.hudChest.setOrigin(1, originY).setPosition(
            this.soundToggle.x - this.soundToggle.displayWidth - 12,
            y
        );
        this.hudCheat.setOrigin(1, originY).setPosition(
            this.hudChest.x - this.hudChest.displayWidth - 12,
            cheatY
        );
    }

    private layoutChrome (): void {
        const { width, height } = this.scale;
        const pad = chromePad();
        this.nightVeil?.setSize(width, height);
        this.sleepVeil?.setSize(width, height);
        this.placeHudButtons();

        if (this.cueText && this.cueText.originX === 0 && this.cueText.originY === 0) {
            const cue = cuePad();
            this.cueText.setPosition(cue.x, cue.y);
            this.cueText.setStyle({ wordWrap: { width: this.cueWrapWidth() } });
        }

        this.bandageButton?.layout();
        this.analogStick?.layout();
        this.analogStick?.setVisible(this.stickChromeVisible());
    }

    private stickChromeVisible (): boolean {
        return !this.wellDoneStarted
            && !this.shepherd?.isLyingDown
            && !this.shepherd?.isPetting
            && !this.shepherd?.isSitting
            && !this.shepherd?.isGuided
            && !this.treeResting;
    }

    private cueWrapWidth (): number {
        const reserved = isPhoneChrome() ? 40 : 220;
        return Math.max(200, this.scale.width - reserved - chromePad().right);
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
            // Keep onEnded so shade kneel / scripted lines can finish while muted.
            silenceSpeech();
        }

        syncHowling();
    }

    private addBandageButton (): void {
        this.bandageButton = new BandageButton(this, () => this.tryBandage());
    }

    private updateBandageButton (): void {
        const hurt = this.hurtNeedingBandage();

        if (!hurt || this.bandageRescuing || this.scriptBlocksBandage(hurt)) {
            this.bandageButton.setVisible(false);
            return;
        }

        const dist = this.bandageDistance(hurt);
        this.bandageButton.setVisible(dist <= this.bandageRange(hurt));
    }

    private tickThorns (): void {
        if (this.heardCorinthians) {
            this.bloomThorns();
            this.maybeBloomThornVerse();
            return;
        }

        this.maybeRearmThorns();

        // Snare immediately even while a verse is speaking; speech / bandage cue queue after.
        if (!this.thornsArmed || this.bandageRescuing || this.shepherd.isLyingDown) {
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

            sheep.snareInThorns(patch.snareSpot().x, patch.snareSpot().y);
            patch.revealSnare();
            this.thornsArmed = false;
            this.thornsRearmFrom = null;
            this.speakThornSnareVerse(sheep.name);
            return;
        }
    }

    private speakThornSnareVerse (name: string): void {
        const verseId = nextThornSnareVerseId(this.foundThornVerses);

        if (!verseId) {
            this.continueLines([`Help ${name}!`]);
            return;
        }

        this.foundThornVerses.push(verseId);
        this.saveProgress(this.lastCheckpoint ?? 'hurt-sheep');
        this.continueLines([thornVerseLine(verseId)]);
    }

    /** After the change: Ezekiel 28:24 the first time the shepherd walks by bloomed thorns. */
    private maybeBloomThornVerse (): void {
        if (this.foundThornVerses.includes(EZEKIEL_28_24.id)) {
            return;
        }

        if (
            this.scriptPlaying
            || this.bandageRescuing
            || this.shepherd.isLyingDown
            || this.shepherd.isSitting
            || this.shepherd.isGuided
        ) {
            return;
        }

        const sx = this.shepherd.sprite.x;
        const sy = this.shepherd.sprite.y;
        const near = this.thorns.some((thorn) => thorn.isNear(sx, sy));

        if (!near) {
            return;
        }

        this.foundThornVerses.push(EZEKIEL_28_24.id);
        this.saveProgress(this.lastCheckpoint ?? '1-cor-15-51');
        this.playLines([thornVerseLine(EZEKIEL_28_24.id)]);
    }

    /** Wolf or thorn rescue can start while a verse is still speaking. */
    private scriptBlocksBandage (hurt: FlockBehavior): boolean {
        return this.scriptPlaying && !hurt.hurtByWolf && !hurt.snaredInThorns;
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

    private rescueFromWolf (hurt: FlockBehavior): void {
        this.bandageRescuing = true;
        this.bandageButton.setVisible(false);
        this.stageFlockAside(hurt.sprite.x, hurt.sprite.y, hurt);
        this.shepherd.beginPetting(hurt.sprite.x, hurt.sprite.y, BANDAGE_KNEEL_MS);

        this.time.delayedCall(BANDAGE_HEAL_AT_MS, () => {
            if (!this.sys.isActive() || !this.bandageRescuing || !hurt.hurt) {
                return;
            }

            hurt.heal();
            this.shepherd.clearGuidance();

            for (const sheep of this.flock) {
                sheep.endRescueWait();

                if (sheep.mood === 'following' && !sheep.hurt) {
                    sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
                }
            }

            this.playLines([
                `You bandage ${hurt.name}.`,
                psalm23Half(3, 'a')
            ], () => {
                this.finishBandageRescue();
            });
        });
    }

    private rescueFromThorns (hurt: FlockBehavior): void {
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

        for (const thorn of this.thorns) {
            thorn.hideSnare();
        }

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
    private thornRescueStand (hurt: FlockBehavior): { x: number; y: number } {
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

    /** Reach check for bandage — thorn snares use the bush, not the nestled sheep. */
    private bandageDistance (hurt: FlockBehavior): number {
        if (hurt.snaredInThorns) {
            const patch = this.nearestThorn(hurt.sprite.x, hurt.sprite.y);

            if (patch) {
                return Math.hypot(this.shepherd.sprite.x - patch.x, this.shepherd.sprite.y - patch.y);
            }
        }

        return Math.hypot(this.shepherd.sprite.x - hurt.sprite.x, this.shepherd.sprite.y - hurt.sprite.y);
    }

    private bandageRange (hurt: FlockBehavior): number {
        return hurt.snaredInThorns ? THORN_SNARE_RADIUS + 40 : BANDAGE_RANGE;
    }

    private tryBandage (): void {
        const hurt = this.hurtNeedingBandage();

        if (!hurt || this.bandageRescuing || this.scriptBlocksBandage(hurt)) {
            return;
        }

        if (this.shepherd.isLyingDown || this.shepherd.isPetting) {
            return;
        }

        if (this.nightStarted && !hurt.snaredInThorns && !hurt.hurtByWolf) {
            return;
        }

        const dist = this.bandageDistance(hurt);

        if (dist > this.bandageRange(hurt)) {
            this.showCue('Get closer.');
            return;
        }

        if (hurt.hurtByWolf) {
            this.rescueFromWolf(hurt);
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
                this.parkHealedByFlock(hurt, holeX, holeY);
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
    private stageFlockAside (holeX: number, holeY: number, hurt: FlockBehavior): void {
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

    /** After the pit bandage, sit with the waiting flock instead of trail-following into the keep-out. */
    private parkHealedByFlock (healed: FlockBehavior, holeX: number, holeY: number): void {
        const aside = this.shepherd.sprite.x < holeX ? -1 : 1;
        const waiting = this.flock.filter((sheep) => sheep !== healed && sheep.isRescueWaiting);
        const spread = waiting.length === 0
            ? 0
            : (waiting.length - (waiting.length - 1) / 2) * 44;

        healed.beginRescueWait(holeX + aside * HOLE_ASIDE_DIST, holeY + spread - 18);
    }

    private worldKeepOuts (): { x: number; y: number; radius: number }[] {
        const zones: { x: number; y: number; radius: number }[] = [];

        if (this.sheepfold) {
            zones.push(this.sheepfold.fireKeepOut());
        }

        return zones;
    }

    /** Following sheep stay out of the pit; the shepherd must be able to walk up and bandage. */
    private flockKeepOuts (
        keepOuts: { x: number; y: number; radius: number }[]
    ): { x: number; y: number; radius: number }[] {
        if (!this.hole) {
            return keepOuts;
        }

        return keepOuts.concat({ x: this.hole.x, y: this.hole.y, radius: HOLE_KEEP_OUT_RADIUS });
    }

    /** Fence rails block the shepherd until they lie down in the gate. */
    private shepherdKeepOuts (
        keepOuts: { x: number; y: number; radius: number }[]
    ): { x: number; y: number; radius: number }[] {
        if (
            !this.sheepfold
            || this.shepherd.isLyingDown
            || this.heardJohn109
            || this.walkingToGate
            || this.penTableStarted
            || this.flockHasWolfVictim()
        ) {
            return keepOuts;
        }

        return keepOuts.concat(this.sheepfold.fenceKeepOuts());
    }

    /** Hurt sheep the bandage button targets — wolf victims first. */
    private hurtNeedingBandage (): FlockBehavior | undefined {
        const hurt = this.flock.filter((sheep) => sheep.hurt && sheep.discovered);

        if (hurt.length === 0) {
            return undefined;
        }

        return hurt.find((sheep) => sheep.hurtByWolf) ?? hurt[0];
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

            // Flock (including the healed sheep) was sitting aside — skip walk-into pets.
            if (sheep.mood === 'following' && !sheep.hurt) {
                sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
            }
        }

        this.dismissHole();
        this.bandageRescuing = false;

        if (this.heardPsalm3b || !this.heardPsalm3 || this.scriptPlaying) {
            return;
        }

        this.playLines([psalm23Half(3, 'b')], () => {
            this.beginNight();
        });
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
        stopWorldMusic(this);
        hushSpeech();
    }

    private releaseWorldAudio (): void {
        if (!this.sys.isActive() || this.sys.isPaused()) {
            return;
        }

        unhushSpeech();
        this.playWorldMusic();
        unsuspendHowling();
    }

    private overlayOpen (): boolean {
        return this.scene.isActive('SettingsScene')
            || this.scene.isActive('TreasureScene')
            || this.scene.isActive('AchievementsScene')
            || this.scene.isActive('CheatScene');
    }

    private onWorldResume (): void {
        if (!this.sys.isActive()) {
            return;
        }

        resumeSpeech();

        if (this.wellDoneStarted) {
            return;
        }

        this.recoverInterruptedStory();
        this.releaseWorldAudio();
    }

    /** Overlay used to abort speakCue, leaving picnic / 1 Cor 15:51 with no onDone. */
    private recoverInterruptedStory (): void {
        if (speechAwaitingFinish()) {
            return;
        }

        if (this.heardPsalm2 && this.foundCount < 2) {
            this.spawnNextSheep();
        }

        if (this.scriptPlaying) {
            this.scriptPlaying = false;

            if (this.flushPendingTreeVerse()) {
                return;
            }

            if (this.flushScriptQueue()) {
                return;
            }

            this.showCue(this.flockCue(), false);
        }

        // Shade sit waits on speakCue onEnded; if speech died mid-verse, stand up.
        if (this.treeResting || (this.shepherd.isSitting && this.treeVisit)) {
            this.endShadeTreeRest();
            return;
        }

        if (this.heardCorinthians && this.nightStarted && this.sleepVeil.alpha >= 0.75) {
            this.scriptPlaying = false;
            this.beginDawn();
            return;
        }

        if (this.penTableStarted && this.picnic && !this.walkingToGate && !this.shepherd.isLyingDown) {
            this.pauseThenSleepAtGate();
        }
    }

    private openSettings (): void {
        if (this.overlayOpen()) {
            return;
        }

        pauseSpeech();
        this.scene.pause();
        this.scene.launch('SettingsScene');
    }

    private openCheat (): void {
        if (this.overlayOpen()) {
            return;
        }

        pauseSpeech();
        this.scene.pause();
        this.scene.launch('CheatScene');
    }

    private openTreasure (): void {
        if (this.overlayOpen()) {
            return;
        }

        pauseSpeech();
        this.scene.pause();
        this.scene.launch('TreasureScene', {
            foundGems: [...this.foundGems],
            foundWaterVerses: [...this.foundWaterVerses],
            foundTreeVerses: [...this.foundTreeVerses],
            foundThornVerses: [...this.foundThornVerses],
            heard: {
                heardPsalm1: this.heardPsalm1,
                heardPsalm1b: this.heardPsalm1b,
                heardPsalm2: this.heardPsalm2,
                heardPsalm2b: this.heardPsalm2b,
                heardPsalm3: this.heardPsalm3,
                heardPsalm3b: this.heardPsalm3b,
                heardPsalm4a: this.heardPsalm4a,
                heardPsalm4b: this.heardPsalm4b,
                heardPsalm4c: this.heardPsalm4c,
                heardPsalm5: this.heardPsalm5,
                heardPsalm6: this.heardPsalm6,
                heardJohn102: this.heardJohn102,
                heardJohn109: this.heardJohn109,
                heardCorinthians: this.heardCorinthians,
                heardCity: this.heardCity,
                heardIsaiah6525: this.heardIsaiah6525,
                foundNames: this.flock
                    .filter((sheep) => sheep.mood !== 'waiting' && sheep.mood !== 'hurt')
                    .map((sheep) => sheep.name)
            }
        });
    }

    private beginNight (): void {
        if (this.nightStarted) {
            return;
        }

        if (this.deferNightForTree()) {
            return;
        }

        this.nightAfterTree = false;
        this.applyNight(true);
        this.playLines([
            'Night is falling.',
            psalm23Half(4, 'a')
        ], () => {
            this.beginStaffBeat();
        });
    }

    /** If the shepherd is in a shade sit (or can start one), finish that before night. */
    private deferNightForTree (): boolean {
        if (this.treeResting || this.pendingTreeVerseId) {
            this.nightAfterTree = true;

            if (this.pendingTreeVerseId && !this.scriptPlaying) {
                this.flushPendingTreeVerse();
            }

            return true;
        }

        const tree = this.trees.find((item) =>
            item.inShade(this.shepherd.sprite.x, this.shepherd.sprite.y)
        );
        const verseId = tree
            ? nextTreeVerseId(this.foundTreeVerses, this.shepherd.wearsWhite)
            : null;

        if (!tree || !verseId || this.treeRestOnCooldown()) {
            return false;
        }

        this.nightAfterTree = true;

        if (!this.foundTreeVerses.includes(verseId)) {
            this.foundTreeVerses.push(verseId);
            this.saveProgress(this.lastCheckpoint ?? 'found-gem');
        }

        this.startShadeTreeRest(tree, verseId);
        return true;
    }

    private beginStaffBeat (): void {
        if (this.heardPsalm4b) {
            return;
        }

        this.placeStaff();
        this.playLines([
            'I need my staff.'
        ], () => {
            this.time.delayedCall(FEAR_NO_EVIL_DELAY_MS, () => {
                if (!this.sys.isActive() || this.heardPsalm4b) {
                    return;
                }

                this.playLines([psalm23Half(4, 'b')], () => {
                    stopHowling();
                    this.ensureWolf();
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
        this.ensureCity(spot);
        return this.sheepfold;
    }

    private ensureCity (pen?: { x: number; y: number } | null): Jerusalem {
        if (this.city) {
            return this.city;
        }

        const fold = this.sheepfold ?? pen ?? farthestCornerFrom(startCenter());
        const spot = farthestCornerFrom({ x: fold.x, y: fold.y });
        this.city = new Jerusalem(this, spot.x, spot.y);
        return this.city;
    }

    /** After the change, once Leo and Sarah have joined: walk to New Jerusalem. */
    private cityObjectiveOpen (): boolean {
        return this.heardCorinthians
            && !this.heardCity
            && PEACEABLE_JOINERS.every((name) =>
                this.flock.some((sheep) => sheep.name === name && sheep.discovered)
            );
    }

    private maybeEnterCity (): void {
        if (!this.city || this.heardCity || !this.cityObjectiveOpen() || this.scriptPlaying) {
            return;
        }

        if (!this.city.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
            return;
        }

        this.heardCity = true;
        setWorldMusicTrack(this, EARTH_IN_BLOOM_KEY);
        fadeInWorldMusic(this, 800);
        this.playLines([revelation21CityLine()]);
    }

    private maybeRainGoldRoad (): void {
        if (!this.city || !this.cityObjectiveOpen()) {
            return;
        }

        if (!this.shepherd.isMoving || this.shepherd.isLyingDown) {
            return;
        }

        const sx = this.shepherd.sprite.x;
        const sy = this.shepherd.sprite.y;
        const dx = this.city.x - sx;
        const dy = this.city.y - sy;
        const dist = Math.hypot(dx, dy);

        if (dist < 8) {
            return;
        }

        const toCityX = dx / dist;
        const toCityY = dy / dist;
        const heading = this.shepherd.moveHeading;
        const dot = heading.x * toCityX + heading.y * toCityY;

        if (dot < CITY_AIM_DOT) {
            return;
        }

        if (isHintTargetOnScreen(this, this.city.x, this.city.y)) {
            return;
        }

        if (nearestGoldPaverDist(sx, sy) >= GOLD_ABANDON_PATH) {
            this.lastGoldStone = null;
        }

        if (this.lastGoldStone) {
            const lastDx = this.lastGoldStone.x - sx;
            const lastDy = this.lastGoldStone.y - sy;

            if (Math.hypot(lastDx, lastDy) >= GOLD_MAX_FROM_PLAYER
                && lastDx * heading.x + lastDy * heading.y > 0) {
                return;
            }
        }

        let originX = sx;
        let originY = sy;
        let dirX = heading.x * (1 - GOLD_CITY_BLEND) + toCityX * GOLD_CITY_BLEND;
        let dirY = heading.y * (1 - GOLD_CITY_BLEND) + toCityY * GOLD_CITY_BLEND;
        let stepFrom = GOLD_AHEAD_MIN;
        let stepTo = GOLD_AHEAD_MIN;

        if (this.lastGoldStone) {
            const lx = this.lastGoldStone.x;
            const ly = this.lastGoldStone.y;
            const fromLastX = this.city.x - lx;
            const fromLastY = this.city.y - ly;
            const fromLastLen = Math.hypot(fromLastX, fromLastY) || 1;

            originX = lx;
            originY = ly;
            dirX = (fromLastX / fromLastLen) * GOLD_FROM_LAST + heading.x * (1 - GOLD_FROM_LAST);
            dirY = (fromLastY / fromLastLen) * GOLD_FROM_LAST + heading.y * (1 - GOLD_FROM_LAST);
            stepFrom = GOLD_SPACING;
            stepTo = Math.hypot(sx - lx, sy - ly) + GOLD_MAX_FROM_PLAYER;
        }

        const dirLen = Math.hypot(dirX, dirY) || 1;
        dirX /= dirLen;
        dirY /= dirLen;
        const along = Math.atan2(dirY, dirX);

        for (let alongDist = stepFrom; alongDist <= stepTo; alongDist += GOLD_SPACING) {
            const x = originX + dirX * alongDist;
            const y = originY + dirY * alongDist;

            if (Math.hypot(x - sx, y - sy) > GOLD_MAX_FROM_PLAYER) {
                continue;
            }

            if ((x - sx) * heading.x + (y - sy) * heading.y < GOLD_MIN_IN_FRONT) {
                continue;
            }

            if (this.city.coversPoint(x, y) || !goldPaverSpotOpen(x, y)) {
                continue;
            }

            rainGoldPaver(this, x, y, along);
            this.lastGoldStone = { x, y };
            return;
        }
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
        if (!this.staffPickup) {
            return;
        }

        if (!this.staffPickup.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
            return;
        }

        this.staffPickup.destroy();
        this.staffPickup = null;
        this.shepherd.equipStaff(true);
        this.saveProgress('found-staff');

        const lines = [psalm23Comfort()];

        if (this.scriptPlaying) {
            this.gemVerseQueue.push(...lines);
            return;
        }

        this.playLines(lines);
    }

    private maybeCollectGem (): void {
        if (this.gems.length === 0) {
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

        const lines = firstBibleGem
            ? ['You found a Bible gem.', gem.line()]
            : [gem.line()];

        if (this.scriptPlaying) {
            this.gemVerseQueue.push(...lines);
            return;
        }

        this.playLines(lines);
    }

    private maybeReachPen (): void {
        if (this.heardJohn109 || this.heardCorinthians || !this.nightStarted || !this.shepherd.hasStaff) {
            return;
        }

        if (!this.sheepfold) {
            return;
        }

        // Arrival: John 10:2, then the flock files in during John 14:6.
        if (!this.heardJohn102) {
            if (this.scriptPlaying || !this.sheepfold.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
                return;
            }

            stopHowling();
            this.calmNightWolfAtPen();
            this.playLines([john10Line(2)], () => {
                this.beginPenning();
                this.playLines([john14Line()]);
            });
            return;
        }

        // After John 10:2: pen the flock, wait a beat, then sleep.
        // Does not depend on the speech onDone (heardJohn102 is set when the line starts).
        if (this.scriptPlaying || this.shepherd.isLyingDown) {
            return;
        }

        this.beginPenning();

        if (!this.flockSafeInPen()) {
            this.penSleepAt = 0;
            return;
        }

        if (this.penSleepAt === 0) {
            this.penSleepAt = this.time.now + PEN_SLEEP_DELAY_MS;
        }

        if (this.time.now < this.penSleepAt) {
            return;
        }

        // Picnic/wolf beat is in progress — Psalm 23:5 already sets heardPsalm5, so that
        // flag must not skip ahead to sleep while the pack is still on screen.
        if (this.penTableStarted) {
            return;
        }

        if (this.heardPsalm5 && !this.heardJohn109) {
            this.sleepAtGate();
            return;
        }

        this.penTableStarted = true;
        this.beginTableSequence();
    }

    /** Line up south of the gate, file through the opening, then rest inside. */
    private beginPenning (): void {
        this.calmNightWolfAtPen();
        const fold = this.ensurePen();
        const count = this.flock.length;

        this.flock.forEach((sheep, slot) => {
            if (sheep.isPenned || sheep.hurt) {
                return;
            }

            const line = fold.lineUpSpot(slot, count);
            const gate = fold.gateEnterSpot(slot, count);
            const rest = fold.restSpot(slot);
            const around = fold.southApproach(sheep.sprite.x, sheep.sprite.y, line);
            sheep.enterPen([...around, line, gate, rest]);
        });
    }

    private flockSafeInPen (): boolean {
        return this.flock.length > 0 && this.flock.every((sheep) => sheep.hurt || sheep.isSettledInPen);
    }

    /** Picnic and Psalm 23:5, a short pause, then lie down as the gate. */
    private beginTableSequence (): void {
        const fold = this.ensurePen();
        const fire = fold.fireSpot();
        this.calmNightWolfAtPen();
        this.picnic = new Picnic(this, fire.x - 78, fire.y + 32);
        const sit = this.picnic.sitSpot();
        const arrive = (): void => this.finishPenTableArrive(fire);

        if (Math.hypot(sit.x - this.shepherd.sprite.x, sit.y - this.shepherd.sprite.y) <= 8) {
            arrive();
            return;
        }

        this.shepherd.guideTo(sit.x, sit.y, arrive);
    }

    /** Sit at the picnic, draw the pack in, and speak Psalm 23:5. */
    private finishPenTableArrive (fire: { x: number; y: number }): void {
        if (this.shepherd.isSitting || this.walkingToGate || this.shepherd.isLyingDown) {
            return;
        }

        this.shepherd.sit();
        this.tableEnemiesApproach(fire);
        this.playLines([psalm23FiveTable()], () => this.pauseThenSleepAtGate());
    }

    /**
     * If the picnic walk target was wiped, kneel in place so the table beat can continue.
     */
    private tickPenTableWalk (): void {
        if (
            !this.penTableStarted
            || !this.picnic
            || this.walkingToGate
            || this.shepherd.isLyingDown
            || this.shepherd.isSitting
        ) {
            return;
        }

        if (this.shepherd.isGuided && this.shepherd.hasGuideTarget) {
            return;
        }

        this.finishPenTableArrive(this.ensurePen().fireSpot());
    }

    /** Stop the night stalker from hunting while the flock is home at the pen. */
    private calmNightWolfAtPen (): void {
        if (!this.wolf) {
            return;
        }

        this.wolf.setAggressive(false);
        this.wolf.hold();
    }

    private tableEnemiesApproach (fire: { x: number; y: number }): void {
        startHowling(this);
        const rim = 190;
        const angles = [-0.55, -0.22, 0.12];

        if (this.wolf) {
            const nightWolf = this.wolf;
            this.wolf = null;
            nightWolf.setAggressive(false);
            const angle = angles.shift()!;
            nightWolf.setOrigin(nightWolf.sprite.x, nightWolf.sprite.y);
            this.tableWolves.push(nightWolf);
            nightWolf.walkTo(
                fire.x + Math.cos(angle) * rim,
                fire.y + Math.sin(angle) * rim,
                96,
                () => nightWolf.hold()
            );
        }

        for (const angle of angles) {
            const spawn = this.offCameraAlong(fire.x, fire.y, angle);
            const wolf = new Wolf(this, spawn.x, spawn.y);
            wolf.placeAt(spawn.x, spawn.y);
            wolf.setOrigin(spawn.x, spawn.y);
            this.tableWolves.push(wolf);
            wolf.walkTo(
                fire.x + Math.cos(angle) * rim,
                fire.y + Math.sin(angle) * rim,
                96,
                () => wolf.hold()
            );
        }
    }

    /** First point past the camera edge along a ray, so wolves walk in instead of popping on-screen. */
    private offCameraAlong (fromX: number, fromY: number, angle: number): { x: number; y: number } {
        const view = this.cameras.main.worldView;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const margin = 72;
        const hits: number[] = [];

        if (dx > 0.001) {
            hits.push((view.right + margin - fromX) / dx);
        }

        if (dx < -0.001) {
            hits.push((view.left - margin - fromX) / dx);
        }

        if (dy > 0.001) {
            hits.push((view.bottom + margin - fromY) / dy);
        }

        if (dy < -0.001) {
            hits.push((view.top - margin - fromY) / dy);
        }

        const t = hits.filter((dist) => dist > 0).reduce((a, b) => Math.min(a, b), Infinity);
        const dist = Number.isFinite(t) ? t : 640;

        return { x: fromX + dx * dist, y: fromY + dy * dist };
    }

    private pauseThenSleepAtGate (): void {
        this.scriptPlaying = true;
        this.picnic?.fadeOut();
        this.picnic = null;
        this.shepherd.standUp();
        this.walkingToGate = true;
        const gate = this.ensurePen().gateSpot();
        const lieAt = this.time.now + TABLE_GATE_PAUSE_MS;
        this.shepherd.guideTo(gate.x, gate.y, () => {
            const wait = Math.max(0, lieAt - this.time.now);
            this.time.delayedCall(wait, () => {
                if (this.sys.isActive()) {
                    this.sleepAtGate();
                }
            });
        }, TABLE_GATE_WALK_SPEED);
    }

    /** Park the night wolf with the table pack so the lion can flush them together. */
    private gatherWolvesForChase (): void {
        if (this.wolf) {
            this.wolf.setAggressive(false);
            this.wolf.hold();
            this.tableWolves.push(this.wolf);
            this.wolf = null;
        }
    }

    /** Send the pack sprinting east, staggered so they don't clone-step. */
    private releaseWolvesEast (): void {
        const pack = this.tableWolves;
        this.tableWolves = [];
        const mid = (pack.length - 1) / 2;

        pack.forEach((wolf, index) => {
            const drift = (index - mid) * 0.18;
            this.time.delayedCall(index * 70, () => {
                if (!this.sys.isActive() || !wolf.sprite.active) {
                    return;
                }

                wolf.walkAwayEast(WOLF_CHASE_FLEE_SPEED, drift);
            });
            this.departingWolves.push(wolf);
        });
    }

    /** Lion from off-screen west, south of the pen; wolves hold until it closes, then bolt right. */
    private beginLionChase (): void {
        this.gatherWolvesForChase();
        this.wolvesFlushed = this.tableWolves.length === 0;
        this.lionChaseDone = false;

        const view = this.cameras.main.worldView;
        const chaseY = this.fold().southLaneY();
        const spawnX = view.left - 36;
        const exitX = Math.max(view.right + 320, spawnX + 1600);
        this.chaseLion = new Lion(this, spawnX, chaseY);
        this.chaseLion.walkTo(exitX, chaseY, LION_CHARGE_SPEED);
    }

    private lionShouldFlushWolves (): boolean {
        if (!this.chaseLion || this.tableWolves.length === 0) {
            return this.tableWolves.length === 0;
        }

        const lx = this.chaseLion.sprite.x;
        const ly = this.chaseLion.sprite.y;

        for (const wolf of this.tableWolves) {
            const dist = Math.hypot(wolf.sprite.x - lx, wolf.sprite.y - ly);

            if (dist <= LION_FLUSH_RANGE || lx >= wolf.sprite.x - 48) {
                return true;
            }
        }

        return false;
    }

    private tickLionChase (delta: number): void {
        this.chaseLion?.update(delta);

        if (!this.chaseLion || this.wolvesFlushed) {
            return;
        }

        if (this.lionShouldFlushWolves()) {
            this.wolvesFlushed = true;
            this.releaseWolvesEast();
        }
    }

    private maybeFinishLionChase (): void {
        if (!this.chaseLion || this.lionChaseDone || !this.wolvesFlushed) {
            return;
        }

        if (this.departingWolves.length > 0) {
            return;
        }

        const view = this.cameras.main.worldView;

        // Must leave off the right — spawn is already off-screen west.
        if (this.chaseLion.sprite.x < view.right + 72) {
            return;
        }

        this.chaseLion.destroy();
        this.chaseLion = null;
        this.lionChaseDone = true;
        this.maybeBeginMysteryAfterChase();
    }

    private maybeBeginMysteryAfterChase (): void {
        if (!this.lionChaseDone || !this.gateVerseDone || !this.sys.isActive()) {
            return;
        }

        if (this.sleepVeil.alpha > 0 || this.heardCorinthians) {
            return;
        }

        this.beginMystery();
    }

    /** Hard cleanup for run reset / cheat loads. */
    private destroyAllWolves (): void {
        this.wolf?.destroy();
        this.wolf = null;
        this.chaseLion?.destroy();
        this.chaseLion = null;

        for (const wolf of this.tableWolves) {
            wolf.destroy();
        }

        this.tableWolves = [];

        for (const wolf of this.departingWolves) {
            wolf.destroy();
        }

        this.departingWolves = [];
    }

    private tickTableWolves (delta: number): void {
        const flock = this.wolfFlockPoints();

        for (const wolf of this.tableWolves) {
            wolf.update(this.shepherd, delta, flock);
        }
    }

    private tickDepartingWolves (delta: number): void {
        if (this.departingWolves.length === 0) {
            return;
        }

        const view = this.cameras.main.worldView;
        const remaining: Wolf[] = [];

        for (const wolf of this.departingWolves) {
            wolf.update(this.shepherd, delta);
            if (wolf.isOffScreen(view)) {
                wolf.destroy();
            }
            else {
                remaining.push(wolf);
            }
        }

        this.departingWolves = remaining;
    }

    private maybeFlockDrink (): void {
        if (this.nightStarted || this.bandageRescuing || this.penTableStarted) {
            return;
        }

        // Finish find / rescue beats before the quiet-waters quest.
        if (this.hasSheepToFind() || this.hurtNeedingBandage()) {
            return;
        }

        if (this.waterHold) {
            const away = Math.hypot(
                this.shepherd.sprite.x - this.waterHold.x,
                this.shepherd.sprite.y - this.waterHold.y
            );
            const stillBusy = this.flock.some((sheep) => sheep.mood === 'drinking' || sheep.thirsty);

            if (away >= WATER_DRINK_COOLDOWN_PX && !stillBusy) {
                this.waterHold = null;
            }

            if (this.waterHold) {
                return;
            }
        }

        const pond = this.water.find((source) =>
            source.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)
        );

        if (!pond) {
            return;
        }

        this.beginFlockDrink(pond);
    }

    private beginFlockDrink (pond: WaterSource): void {
        const drinkers = this.flock.filter((sheep) =>
            sheep.mood === 'following' && !sheep.hurt && !sheep.isDancing && !sheep.isScooting
        );

        if (drinkers.length === 0) {
            return;
        }

        this.waterHold = pond;
        this.drinkCuePlayed = false;
        this.drinkGatherAt = this.time.now;

        drinkers.forEach((sheep, slot) => {
            const spot = pond.drinkSpot(slot, drinkers.length);
            sheep.walkToDrink(spot.x, spot.y, pond.x);
        });
    }

    private maybeStartFlockSip (): void {
        const gathering = this.flock.filter((sheep) =>
            sheep.thirsty && sheep.mood !== 'drinking' && !sheep.hurt
        );

        if (gathering.length === 0) {
            return;
        }

        const allHere = gathering.every((sheep) => sheep.atDrinkSpot);
        const timedOut = this.drinkGatherAt > 0 && this.time.now - this.drinkGatherAt > 4500;

        if (!allHere && !timedOut) {
            return;
        }

        const sippers = timedOut ? gathering.filter((sheep) => sheep.atDrinkSpot) : gathering;

        if (sippers.length === 0) {
            return;
        }

        const now = this.time.now;
        let announced = false;

        for (const sheep of sippers) {
            if (sheep.beginSip(now) && !announced) {
                this.onDrank(sheep);
                announced = true;
            }
        }
    }

    private maybeShadeTree (): void {
        const tree = this.trees.find((item) => item.inShade(this.shepherd.sprite.x, this.shepherd.sprite.y));

        if (!tree) {
            this.treeVisit = null;
            return;
        }

        if (this.treeRestOnCooldown()) {
            this.treeVisit = tree;
            return;
        }

        if (
            this.nightStarted
            || this.bandageRescuing
            || this.treeResting
            || this.shepherd.isLyingDown
            || this.shepherd.isSitting
            || this.shepherd.isPetting
            || this.shepherd.isGuided
            || this.pendingTreeVerseId
        ) {
            return;
        }

        if (this.treeVisit === tree) {
            return;
        }

        const verseId = nextTreeVerseId(this.foundTreeVerses, this.shepherd.wearsWhite);

        if (!verseId) {
            this.treeVisit = tree;
            return;
        }

        this.foundTreeVerses.push(verseId);
        this.saveProgress(this.lastCheckpoint ?? 'found-gem');
        this.startShadeTreeRest(tree, verseId);
    }

    private startShadeTreeRest (tree: ShadeTree, verseId: string): void {
        this.treeVisit = tree;
        this.treePetFrom = { x: tree.x, y: tree.y };
        this.treeResting = true;
        this.shadeVerseId = verseId;
        this.flock.forEach((sheep, slot) => {
            if (sheep.mood === 'following' && !sheep.hurt) {
                const gather = tree.gatherSpot(slot, this.flock.length);
                sheep.beginRescueWait(gather.x, gather.y);
            }
        });
        const rest = tree.restSpot();
        const dist = Math.hypot(rest.x - this.shepherd.sprite.x, rest.y - this.shepherd.sprite.y);

        if (dist <= 8) {
            this.finishShadeTreeWalk();
            return;
        }

        this.shepherd.guideTo(rest.x, rest.y, () => this.finishShadeTreeWalk());
    }

    /** Kneel and start the verse after walking into the shade (or if already there). */
    private finishShadeTreeWalk (): void {
        if (this.shepherd.isSitting) {
            return;
        }

        const verseId = this.shadeVerseId;
        this.shadeVerseId = null;
        this.shepherd.sit();

        if (!verseId) {
            this.endShadeTreeRest();
            return;
        }

        this.beginTreeVerse(verseId);
    }

    /**
     * If petting or another interrupt wiped the shade walk target, kneel in place
     * so the player is not left guided with no destination.
     */
    private tickShadeTreeWalk (): void {
        if (!this.treeResting || this.shepherd.isSitting) {
            return;
        }

        if (this.shepherd.isGuided && this.shepherd.hasGuideTarget) {
            return;
        }

        this.finishShadeTreeWalk();
    }

    private endShadeTreeRest (): void {
        this.treeResting = false;
        this.pendingTreeVerseId = null;
        this.shadeVerseId = null;
        this.shepherd.standUp();
        this.shepherd.clearGuidance();

        for (const sheep of this.flock) {
            sheep.endRescueWait();
        }

        if (this.nightAfterTree && !this.nightStarted) {
            this.nightAfterTree = false;
            this.beginNight();
        }
    }

    private beginTreeVerse (verseId: string): void {
        if (this.scriptPlaying) {
            this.pendingTreeVerseId = verseId;
            return;
        }

        this.speakTreeVerse(verseId);
    }

    private flushPendingTreeVerse (): boolean {
        const verseId = this.pendingTreeVerseId;

        if (!verseId) {
            return false;
        }

        this.speakTreeVerse(verseId);
        return true;
    }

    private speakTreeVerse (verseId: string): void {
        this.pendingTreeVerseId = null;
        this.treeResting = true;
        this.playLines([treeVerseLine(verseId)], () => {
            if (!this.sys.isActive()) {
                return;
            }

            this.endShadeTreeRest();
        });
    }

    /** True while the shepherd still needs to walk farther from the last shade tree. */
    private treeRestOnCooldown (): boolean {
        if (!this.treePetFrom) {
            return false;
        }

        const dist = Math.hypot(
            this.shepherd.sprite.x - this.treePetFrom.x,
            this.shepherd.sprite.y - this.treePetFrom.y
        );

        if (dist >= TREE_REST_COOLDOWN_PX) {
            this.treePetFrom = null;
            this.treeVisit = null;
            return false;
        }

        return true;
    }

    /** Lie down in the gate (John 10:9); lion drives the pack east, then fade to black. */
    private sleepAtGate (): void {
        const fold = this.ensurePen();
        const gate = fold.gateSpot();
        stopHowling();
        this.walkingToGate = false;
        this.gateVerseDone = false;
        this.shepherd.lieDown(gate.x, gate.y);
        this.analogStick?.fadeVisible(false);
        this.beginLionChase();
        this.playLines([john10Line(9)], () => {
            this.gateVerseDone = true;
            this.maybeBeginMysteryAfterChase();
        });
    }

    private settleFold (): void {
        this.flock.forEach((sheep, slot) => {
            if (sheep.hurt) {
                return;
            }

            const rest = this.fold().restSpot(slot);
            sheep.settleInPen(rest.x, rest.y);
        });
        this.shepherd.lieDown(this.fold().gateSpot().x, this.fold().gateSpot().y);
        this.analogStick?.setVisible(false);
    }

    private placeAtFoldAwake (): void {
        const fold = this.fold();
        this.releaseFlockFromPen(fold);
        this.shepherd.wake();
        this.analogStick?.fadeVisible(true);
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        this.nightVeil.setAlpha(0);
        this.sleepVeil.setAlpha(0);
        this.penTableStarted = false;
        this.setTreeShadesVisible(true);
        this.styleCueForDay();
        stopHowling();
        this.destroyAllWolves();
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
        let exitSlot = 0;
        this.flock.forEach((sheep) => {
            if (this.isUndiscoveredWaiter(sheep)) {
                return;
            }

            const exit = fold.exitSpot(exitSlot++);
            sheep.leavePen(exit.x, exit.y);
            sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
        });
        this.loadPetsLocked = true;
        this.petUnlockOrigin = { x: wake.x, y: wake.y };
    }

    private placePartyAt (x: number, y: number): void {
        this.shepherd.placeAt(x, y);
        this.shepherd.faceToward(x, y - 80);
        this.cameras.main.centerOn(x, y);
        const party = this.flock.filter((sheep) => !this.isUndiscoveredWaiter(sheep));
        party.forEach((sheep, slot) => {
            const angle = (slot / Math.max(party.length, 1)) * Math.PI * 2;
            sheep.leavePen(
                x + Math.cos(angle) * RESTORE_FOLLOW_RING,
                y + Math.sin(angle) * RESTORE_FOLLOW_RING
            );
            sheep.deferWalkIntoPetting(PETTING_SUPPRESS_MS);
        });
        this.loadPetsLocked = true;
        this.petUnlockOrigin = { x, y };
    }

    /** Lost / peaceable hunt targets still out in the world — dawn must not recruit them. */
    private isUndiscoveredWaiter (sheep: FlockBehavior): boolean {
        return (sheep.mood === 'waiting' || sheep.mood === 'hurt') && !sheep.discovered;
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
        this.scriptPlaying = false;
        this.nightStarted = false;
        this.nightDarkAt = 0;
        this.nightFadeInMs = 0;
        this.setTreeShadesVisible(true);
        // Restore HUD cue layout before speakLines shows the flock cue again.
        this.styleCueForDay();
        this.shepherd.wake();
        this.analogStick?.fadeVisible(true);
        this.applyPeaceableKingdom();
        this.releaseFlockFromPen(this.fold());
        this.penTableStarted = false;
        stopHowling();
        this.destroyAllWolves();
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
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (!this.sys.isActive()) {
                    return;
                }

                const seek = this.flock.find((sheep) =>
                    sheep.peaceable && sheep.mood === 'waiting' && !sheep.discovered
                );

                if (seek) {
                    this.playLines(['Enlarge the flock.']);
                }
            }
        });
    }

    /** After 1 Corinthians 15:51: hunter gone, roses on the thorns, wolf then lion wait to be found. */
    private applyPeaceableKingdom (): void {
        this.destroyAllWolves();
        this.bloomThorns();
        this.ensurePeaceableHunt();

        for (const sheep of this.flock) {
            if (sheep.hurt) {
                sheep.heal();
            }

            sheep.hungry = false;
            sheep.snack = true;
            sheep.changed = true;
        }
        
    }

    private bloomThorns (): void {
        this.thornsArmed = false;
        this.thornsRearmFrom = null;

        for (const thorn of this.thorns) {
            thorn.bloom();
        }
    }

    private ensurePeaceableHunt (): void {
        const present = new Set(this.flock.map((sheep) => sheep.name));
        const remaining = PEACEABLE_JOINERS.filter((name) => !present.has(name));

        if (remaining.length === 0) {
            return;
        }

        if (this.flock.some((sheep) => sheep.peaceable && (sheep.mood === 'waiting' || sheep.mood === 'hurt'))) {
            return;
        }

        if (this.nextNames.some((name) => FLOCK_NAMES.includes(name))) {
            return;
        }

        this.nextNames = [...remaining];
        this.spawnNextSheep();
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
                wordWrap: { width: Math.min(640, this.scale.width - 80) }
            })
            .setPosition(width / 2, height / 2 - 24)
            .setOrigin(0.5);
    }

    private styleCueForDay (): void {
        const cue = cuePad();
        this.cueText
            .setStyle({
                fontFamily: 'Georgia, serif',
                fontSize: '18px',
                color: '#3d2c1e',
                backgroundColor: '#f3ead8cc',
                align: 'left',
                padding: { x: 10, y: 6 },
                wordWrap: { width: this.cueWrapWidth() }
            })
            .setPosition(cue.x, cue.y)
            .setOrigin(0, 0);
    }

    private tickWolf (delta: number): void {
        if (!this.wolf || this.shepherd.isLyingDown || this.sleepVeil.alpha > 0.2) {
            return;
        }

        const huntTargets = this.wolfHuntTargets();
        this.wolf.update(this.shepherd, delta, huntTargets);

        if (!this.wolf.isAggressive || this.flockHasWolfVictim()) {
            return;
        }

        if (this.time.now < this.wolfAttackReadyAt) {
            return;
        }

        for (const sheep of this.flock) {
            if (sheep.hurt || sheep.mood !== 'following') {
                continue;
            }

            const dist = Math.hypot(
                sheep.sprite.x - this.wolf.sprite.x,
                sheep.sprite.y - this.wolf.sprite.y
            );

            if (dist <= WOLF_ATTACK_RANGE) {
                sheep.struckByWolf();
                this.wolf.walkAway(sheep.sprite.x, sheep.sprite.y);
                this.showCue(`Help ${sheep.name}!`);
                this.saveProgress('hurt-sheep');
                return;
            }
        }
    }

    /** Following sheep the night wolf may chase (one wolf victim at a time). */
    private wolfHuntTargets (): { x: number; y: number }[] {
        if (this.flockHasWolfVictim()) {
            return [];
        }

        return this.flock
            .filter((sheep) => sheep.mood === 'following' && !sheep.hurt)
            .map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y }));
    }

    private flockHasWolfVictim (): boolean {
        return this.flock.some((sheep) => sheep.hurtByWolf);
    }

    /** Sheep the night wolf should stalk — following flock and penned fold. */
    private wolfFlockPoints (): { x: number; y: number }[] {
        return this.flock
            .filter((sheep) => sheep.mood === 'following' || sheep.mood === 'penned')
            .map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y }));
    }

    private ensureWolf (): void {
        if (this.wolf || this.heardCorinthians) {
            return;
        }

        this.wolf = new Wolf(this, this.shepherd.sprite.x, this.shepherd.sprite.y);

        if (this.sheepfold?.isNear(this.shepherd.sprite.x, this.shepherd.sprite.y)) {
            const fire = this.sheepfold.fireSpot();
            const x = fire.x + 300;
            const y = fire.y + 36;
            this.wolf.placeAt(x, y);
            this.wolf.setOrigin(x, y);
            this.wolf.hold();
            return;
        }

        this.wolf.setAggressive(true);
    }

    private setTreeShadesVisible (visible: boolean): void {
        for (const tree of this.trees) {
            tree.setShadeVisible(visible);
        }
    }

    private applyNight (animate: boolean): void {
        this.nightStarted = true;
        this.nightDarkAt = this.time.now;
        this.nightFadeInMs = animate ? NIGHT_FADE_IN_MS : 0;
        this.ensurePen();
        this.setTreeShadesVisible(false);
        // Day seek must not survive night — morning (and night saves) start at 0.
        fadeOutWorldMusic(this, animate ? NIGHT_FADE_IN_MS : 0, true);

        // Howls through the valley scare; stop after Psalm 23:4b (and stay silent on restore).
        if (!this.heardJohn102 && !this.heardPsalm4b) {
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

        if (getActiveWorldMusicKey() === EARTH_IN_BLOOM_KEY) {
            startWorldMusic(this);
            return;
        }

        setWorldMusicTrack(this, this.heardCorinthians ? WONDERS_KEY : WANDERLUST_KEY);
        // Day: seek from applySavedWorldMusic / lastSeek. After night: seek was cleared to 0.
        startWorldMusic(this);
    }

    private createFlockMember (x: number, y: number, name: string, slot: number): FlockBehavior {
        if (name === 'Leo' || name === 'Lion') {
            return Lion.joinFlock(this, x, y, slot);
        }

        if (name === 'Sarah' || name === 'Wolf') {
            return Wolf.joinFlock(this, x, y, slot);
        }

        return new Sheep(this, x, y, name, slot);
    }

    private spawnSheep (name: string, slot: number): void {
        const placed = [
            { x: this.shepherd.sprite.x, y: this.shepherd.sprite.y },
            ...this.flock.map((sheep) => ({ x: sheep.sprite.x, y: sheep.sprite.y })),
            ...this.grass,
            ...this.water,
            ...this.gems,
            ...(this.sheepfold ? [this.sheepfold] : []),
            ...(this.city ? [this.city] : [])
        ];
        const spawn = findPointAwayFromAll(placed, WAITING_SPAWN_MIN, WAITING_SPAWN_GAP);

        if (name === 'Biscuit' && !this.heardPsalm3) {
            this.hole = new Hole(this, spawn.x, spawn.y);
            const trapped = this.createFlockMember(spawn.x, spawn.y + 10, name, slot);
            trapped.trapInHole();
            trapped.changed = this.heardCorinthians;
            this.flock.push(trapped);
            return;
        }

        const sheep = this.createFlockMember(spawn.x, spawn.y, name, slot);
        sheep.changed = this.heardCorinthians;
        this.flock.push(sheep);
    }

    private maybeStrayFlock (): void {
        if (this.heardCorinthians) {
            return;
        }

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

        const followers = this.flock.filter((sheep) => sheep.mood === 'following' && !sheep.peaceable);

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
            ...(this.sheepfold ? [this.sheepfold] : []),
            ...(this.city ? [this.city] : [])
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

    if (line.includes('Psalm 23:6')) {
        return 'psalm-23-6';
    }

    if (line.includes('Psalm 23:5')) {
        return 'psalm-23-5';
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

    if (line.includes('Revelation 21:2')) {
        return 'entered-city';
    }

    return null;
}
