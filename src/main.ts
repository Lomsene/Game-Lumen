import './style.css';
import { Game } from './engine/Game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  // Initialize LUMEN game
  const game = new Game(canvas);
  (window as unknown as { __LUMEN_GAME__: Game }).__LUMEN_GAME__ = game;
});
