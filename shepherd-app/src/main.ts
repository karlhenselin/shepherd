import { bootAchievements } from './game/achievements/achievements';
import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {
    void bootAchievements();
    StartGame('game-container');
});
