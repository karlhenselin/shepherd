import { Boot } from './scenes/Boot';
import { AUTO, Game } from 'phaser';
import { IntroScene } from './scenes/IntroScene';
import { Preloader } from './scenes/Preloader';
import { SettingsScene } from './scenes/SettingsScene';
import { TreasureScene } from './scenes/TreasureScene';
import { WorldScene } from './scenes/WorldScene';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        IntroScene,
        WorldScene,
        SettingsScene,
        TreasureScene
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
