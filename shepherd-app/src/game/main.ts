import { Boot } from './scenes/Boot';
import { AUTO, Game, Scale } from 'phaser';
import { IntroScene } from './scenes/IntroScene';
import { Preloader } from './scenes/Preloader';
import { CheatScene } from './scenes/CheatScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TreasureScene } from './scenes/TreasureScene';
import { AchievementsScene } from './scenes/AchievementsScene';
import { WorldScene } from './scenes/WorldScene';
import { installAudioFocus } from './audio/audioFocus';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH
    },
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
        TreasureScene,
        AchievementsScene,
        CheatScene
    ]
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    installAudioFocus(game);
    return game;
}

export default StartGame;
