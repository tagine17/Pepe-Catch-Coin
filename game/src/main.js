// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the gate pattern. ?shot=start|play|end (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, MEDALS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_COIN, EVENT_HIT, EVENT_OVER, EVENT_PASS } from './world.js';
import { ACTION_FLAP, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { coinIconsReady } from './coinIcons.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function medalFor(score) {
  for (const medal of MEDALS) {
    if (score >= medal.score) return medal.name;
  }
  return '';
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, medalFor(world.state.score), false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  // The coin icons decode asynchronously; wait for them so the shot shows the
  // real icons instead of the gold-circle fallback.
  coinIconsReady().then(() => requestAnimationFrame(paint));
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let medal = '';
  let accumulator = 0;
  let last = performance.now();
  /**
   * A flap waits here for the next world step instead of being read once per frame: on a
   * fast display (120 Hz) half the frames run no step, and a flap read there would be thrown
   * away unapplied, so taps would silently vanish and Pepe would plunge.
   */
  let pendingFlap = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    medal = '';
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Flap with Space or click. Three lives.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    medal = medalFor(world.state.score);
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    sound.over();
    announce(`Game over. Score ${world.state.score}. Best ${best}.${medal ? ` Medal: ${medal}.` : ''}`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_FLAP && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_FLAP) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(flap) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, false, true);
      return;
    }
    const events = world.step(STEP, flap, false);
    if (events & EVENT_COIN) {
      sound.coin();
      announce(`Coin! Score ${world.state.score}.`);
    } else if (events & EVENT_PASS) {
      sound.score();
    }
    if (events & EVENT_HIT) {
      sound.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    const newFlap = (actions & ACTION_FLAP) !== 0;
    if (newFlap) pendingFlap = true;
    if (newFlap && screen === SCREEN_PLAY) sound.flap();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(screen === SCREEN_PLAY && pendingFlap);
        pendingFlap = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      pendingFlap = false;
    }
    renderer.draw(world.state, screen, best, medal, sound.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting gates scroll unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Pepe Catch Coin. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
