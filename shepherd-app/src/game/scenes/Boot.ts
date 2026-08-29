import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        // Boot only loads what IntroScene needs before the Preloader runs.
        this.load.audio('exhale', 'assets/audio/exhale.mp3');
    }

    create ()
    {
        this.scene.start('Preloader');
    }
}
