import { Game } from './core/Game';

/**
 * Entry point. Boots the game, drives the loading bar, then waits for the user
 * to start (required so audio + pointer-lock can engage on a gesture).
 */
async function boot(): Promise<void> {
  const container = document.getElementById('app')!;
  const loadingScreen = document.getElementById('loading-screen')!;
  const startScreen = document.getElementById('start-screen')!;
  const startButton = document.getElementById('start-button')!;
  const barFill = document.getElementById('loading-bar-fill')!;
  const status = document.getElementById('loading-status')!;

  const game = new Game(container);

  try {
    await game.init((ratio, label) => {
      barFill.style.width = `${Math.round(ratio * 100)}%`;
      status.textContent = label;
    });
  } catch (err) {
    status.textContent = 'Failed to load. See console.';
    console.error(err);
    return;
  }

  // Reveal the start screen over the rendered world.
  loadingScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');

  startButton.addEventListener(
    'click',
    () => {
      startScreen.classList.add('hidden');
      game.begin();
    },
    { once: true },
  );
}

boot();
