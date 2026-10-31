import './fonts';
import './style.css';
import { Game } from './engine/Game';
import { storage } from './engine/Storage';
import { forge } from './meta/Forge';
import { settings } from './meta/Settings';
import { achievements } from './meta/Achievements';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  // Restore native saves (Android) before any manager reads them
  await storage.init();
  forge.load();
  settings.load();
  achievements.load();

  const game = new Game(canvas);
  (window as unknown as { __AETHER_GAME__: Game }).__AETHER_GAME__ = game;
});
