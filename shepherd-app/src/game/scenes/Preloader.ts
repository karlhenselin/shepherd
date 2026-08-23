import { Scene } from 'phaser';

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
        this.load.image('water-source', 'water.png');
        this.load.audio('exhale', 'audio/exhale.mp3');
        this.load.audio('wanderlust', 'music/wanderlust-justin-lee-main-version-29117-01-40.mp3');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        this.scene.start('IntroScene');
    }
}
