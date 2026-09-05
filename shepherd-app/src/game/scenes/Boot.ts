import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        // Only what IntroScene needs so "In the beginning" can start immediately.
        this.load.audio('exhale', 'assets/audio/exhale.mp3');
    }

    create ()
    {
        this.scene.start('IntroScene');
    }
}
