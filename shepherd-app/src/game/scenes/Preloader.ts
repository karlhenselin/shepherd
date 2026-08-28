import { Scene } from 'phaser';
import { loadHowlSounds } from '../audio/howl';
import { loadCueSounds } from '../audio/cues';
import { loadSheepSounds } from '../audio/sheepSounds';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        this.cameras.main.setBackgroundColor(0x000000);
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('logo', 'logo.png');
        this.load.image('sheep', 'sheep.png');
        this.load.image('sheepfold', 'sheepfold.png');
        this.load.image('wolf', 'wolf.png');
        this.load.image('shepherd', 'shepherd.png');
        this.load.image('shepherd-staff', 'shepherd-staff.png');
        this.load.image('shepherd-white', 'shepherd-white.png');
        this.load.image('shepherd-staff-white', 'shepherd-staff-white.png');
        this.load.image('shepherd-kneel', 'shepherd-kneel.png');
        this.load.image('shepherd-kneel-staff', 'shepherd-kneel-staff.png');
        this.load.image('shepherd-kneel-white', 'shepherd-kneel-white.png');
        this.load.image('shepherd-kneel-staff-white', 'shepherd-kneel-staff-white.png');
        this.load.image('water-source', 'water.png');
        this.load.image('thorns', 'thorns.png');
        this.load.image('grass-tuft', 'grass-tuft.png');
        this.load.image('grass-eaten', 'grass-eaten.png');
        this.load.audio('exhale', 'audio/exhale.mp3');
        this.load.audio('wanderlust', 'music/wanderlust-justin-lee-main-version-29117-01-40.mp3');
        this.load.audio('wonders-of-nature', 'music/wonders-of-nature-roger-gabalda-main-version-01-31-11044.mp3');
        loadSheepSounds(this.load);
        loadHowlSounds(this.load);
        loadCueSounds(this.load);
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        this.scene.start('IntroScene');
    }
}
