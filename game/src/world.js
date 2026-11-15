// The game's rules and state, with no drawing and no browser in it: Pepe's flight, the
// scrolling pipe gates, the coins in their gaps, collisions, score, coins, lives and level.
// step() advances one fixed step and returns what happened as bit flags, so the caller can
// react (and play sounds) without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns.

import { COIN, FIELD, LEVEL, LIVES, PEPE, PIPE, POOL_SIZE } from './config.js';

export const EVENT_COIN = 1;
export const EVENT_PASS = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;

function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

export function createWorld(random) {
  const pepe = {
    x: PEPE.x,
    y: FIELD.height / 2,
    vy: 0,
    invulnerable: 0,
    /** Flap animation timer: 1 right after a flap, fading to 0. */
    flap: 0,
  };
  const pipes = [];
  const coins = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    pipes.push({ active: false, x: 0, gapY: 0, gap: 0, passed: false, hasCoin: false });
    coins.push({ active: false, x: 0, y: 0, spin: 0 });
  }
  const state = {
    pepe,
    pipes,
    coins,
    score: 0,
    coinsCaught: 0,
    gatesPassed: 0,
    lives: LIVES,
    level: 1,
    elapsed: 0,
    distance: 0,
    nextPipeX: FIELD.width + 200,
    /** The previous gate's gap centre: the next one never jumps far from it, so the game stays fair. */
    lastGapY: null,
  };

  function reset() {
    pepe.y = FIELD.height / 2;
    pepe.vy = 0;
    pepe.invulnerable = 0;
    pepe.flap = 0;
    for (const pipe of pipes) pipe.active = false;
    for (const coin of coins) coin.active = false;
    state.score = 0;
    state.coinsCaught = 0;
    state.gatesPassed = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.distance = 0;
    state.nextPipeX = FIELD.width + 200;
    state.lastGapY = null;
  }

  function pipeSpeed() {
    return Math.min(PIPE.maxSpeed, PIPE.speed + PIPE.speedPerLevel * (state.level - 1));
  }

  function gapSize() {
    return Math.max(PIPE.minGap, PIPE.gap - PIPE.gapPerLevel * (state.level - 1));
  }

  function freePipe() {
    for (let index = 0; index < pipes.length; index += 1) if (!pipes[index].active) return pipes[index];
    return null;
  }

  function freeCoin() {
    for (let index = 0; index < coins.length; index += 1) if (!coins[index].active) return coins[index];
    return null;
  }

  function spawnPipe() {
    const pipe = freePipe();
    if (pipe === null) return;
    const gap = gapSize();
    const top = PIPE.topMargin;
    const bottom = FIELD.groundY - PIPE.bottomMargin;
    let gapY = top + random() * (bottom - top);
    if (state.lastGapY !== null) {
      const maxJump = 240;
      gapY = Math.max(top, Math.min(bottom, Math.max(state.lastGapY - maxJump, Math.min(state.lastGapY + maxJump, gapY))));
    }
    state.lastGapY = gapY;
    pipe.active = true;
    pipe.x = state.nextPipeX;
    pipe.gap = gap;
    pipe.gapY = gapY;
    pipe.passed = false;
    pipe.hasCoin = random() < COIN.chance;
    if (pipe.hasCoin) {
      const coin = freeCoin();
      if (coin !== null) {
        coin.active = true;
        coin.x = pipe.x + PIPE.width / 2;
        coin.y = pipe.gapY;
        coin.spin = random() * Math.PI * 2;
      }
    }
  }

  function loseLife(events) {
    state.lives -= 1;
    pepe.invulnerable = PEPE.invulnerable;
    pepe.vy = -320;
    events |= EVENT_HIT;
    if (state.lives === 0) events |= EVENT_OVER;
    return events;
  }

  /**
   * One fixed step. `flap` is true on the step Pepe flaps his arms. With `harmless` set
   * (the title screen's backdrop) Pepe bobs along and nothing can hurt him or score.
   */
  function step(dt, flap, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.gatesPassed / LEVEL.gatesPerLevel));
    const speed = pipeSpeed();

    if (flap && !harmless) {
      pepe.vy = PEPE.flapVelocity;
      pepe.flap = 1;
    }
    if (pepe.flap > 0) pepe.flap = Math.max(0, pepe.flap - dt * 5);

    // Pepe flies: gravity pulls, the ceiling stops him, the ground is a hit.
    pepe.vy = Math.min(PEPE.maxFall, pepe.vy + PEPE.gravity * dt);
    pepe.y += pepe.vy * dt;
    if (pepe.y < PEPE.radius) {
      pepe.y = PEPE.radius;
      pepe.vy = Math.max(0, pepe.vy);
    }
    if (pepe.invulnerable > 0) pepe.invulnerable = Math.max(0, pepe.invulnerable - dt);

    // The world scrolls: gates move left, a new one spawns at a fixed spacing.
    state.distance += speed * dt;
    state.nextPipeX -= speed * dt;
    if (state.nextPipeX <= FIELD.width + 120) {
      spawnPipe();
      state.nextPipeX += PIPE.spacing;
    }

    for (let index = 0; index < pipes.length; index += 1) {
      const pipe = pipes[index];
      if (!pipe.active) continue;
      pipe.x -= speed * dt;
      if (pipe.x + PIPE.width < 0) {
        pipe.active = false;
        continue;
      }
      if (!pipe.passed && pipe.x + PIPE.width < pepe.x - PEPE.radius) {
        pipe.passed = true;
        if (!harmless) {
          state.gatesPassed += 1;
          state.score += PIPE.passPoints;
          events |= EVENT_PASS;
        }
      }
      if (harmless || pepe.invulnerable > 0) continue;
      const halfGap = pipe.gap / 2;
      const topRect = { x: pipe.x, y: -40, width: PIPE.width, height: pipe.gapY - halfGap + 40 };
      const bottomRect = { x: pipe.x, y: pipe.gapY + halfGap, width: PIPE.width, height: FIELD.groundY - (pipe.gapY + halfGap) };
      if (circleHitsRect(pepe.x, pepe.y, PEPE.radius - 4, topRect) || circleHitsRect(pepe.x, pepe.y, PEPE.radius - 4, bottomRect)) {
        pipe.active = false;
        events = loseLife(events);
        if (events & EVENT_OVER) return events;
      }
    }

    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index];
      if (!coin.active) continue;
      coin.x -= speed * dt;
      coin.spin += dt * 5;
      if (coin.x + COIN.radius < 0) {
        coin.active = false;
        continue;
      }
      if (harmless) continue;
      const dx = pepe.x - coin.x;
      const dy = pepe.y - coin.y;
      if (dx * dx + dy * dy < (PEPE.radius + COIN.radius) * (PEPE.radius + COIN.radius)) {
        coin.active = false;
        state.coinsCaught += 1;
        state.score += COIN.points;
        events |= EVENT_COIN;
      }
    }

    if (!harmless && pepe.invulnerable === 0 && pepe.y + PEPE.radius >= FIELD.groundY) {
      pepe.y = FIELD.groundY - PEPE.radius;
      events = loseLife(events);
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
