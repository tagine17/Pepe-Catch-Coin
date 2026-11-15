// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (flap when
// Pepe sinks below the next gate's gap), so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { FIELD, PEPE, PIPE, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;

/**
 * How far below the gap's centre Pepe may sink before the autopilot flaps: the play scene's
 * pilot is sharp and survives; the end scene's pilot gets lazier the longer it flies, so it
 * is caught out once the gates speed up, as a hurried player is.
 */
const SLACK_PLAY = 6;
const SLACK_END = 78;
const SLACK_END_GROWTH_PER_SECOND = 8;
const SLACK_END_MAX = 220;
const TIRE_AFTER_SECONDS = 25;

/** The next gate Pepe has not passed yet: the closest active pipe still ahead of him. */
function nextGate(state) {
  let nearest = null;
  for (let index = 0; index < state.pipes.length; index += 1) {
    const pipe = state.pipes[index];
    if (!pipe.active || pipe.x + PIPE.width <= state.pepe.x - PEPE.radius) continue;
    if (nearest === null || pipe.x < nearest.x) nearest = pipe;
  }
  return nearest;
}

/** Flap when Pepe is at or below the next gap's centre (plus the pilot's slack) and falling. */
function autopilot(state, slack) {
  const pepe = state.pepe;
  if (pepe.y + PEPE.radius > FIELD.groundY - 30) return true;
  const gate = nextGate(state);
  if (gate === null) return pepe.y > FIELD.height / 2 + 40 && pepe.vy > 0;
  if (pepe.y > gate.gapY + 60 + slack) return true;
  return pepe.y > gate.gapY - 10 + slack && pepe.vy > -50;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let step = 0; step < limit / STEP; step += 1) {
    const elapsed = step * STEP;
    let slack = SLACK_PLAY;
    if (name === 'end' && elapsed > TIRE_AFTER_SECONDS) {
      slack = Math.min(SLACK_END_MAX, SLACK_END + (elapsed - TIRE_AFTER_SECONDS) * SLACK_END_GROWTH_PER_SECOND);
    }
    if (world.step(STEP, autopilot(world.state, slack), false) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
