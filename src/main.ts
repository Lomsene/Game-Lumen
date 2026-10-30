import './fonts';
import './style.css';
import { Game } from './engine/Game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  const game = new Game(canvas);
  (window as unknown as { __AETHER_GAME__: Game }).__AETHER_GAME__ = game;
});
