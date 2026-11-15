// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// Pepe is a green frog who flaps through pipe gates and catches crypto coins: one point per
// gate passed, five per coin, three lives, and a medal at the end for a good run.

export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Pepe's flight: gravity pulls him down, a flap throws him up, and he never falls faster than this. */
export const PEPE = {
  x: 300,
  radius: 26,
  gravity: 2300,
  flapVelocity: -600,
  maxFall: 900,
  /** Seconds of flashing safety after a hit. */
  invulnerable: 1.5,
};

export const LIVES = 3;

/** The pipe gates: how fast they scroll, how wide the gap is, and how the gap shrinks as you level up. */
export const PIPE = {
  width: 96,
  /** Horizontal distance between one gate and the next. */
  spacing: 420,
  speed: 195,
  speedPerLevel: 10,
  maxSpeed: 300,
  gap: 220,
  gapPerLevel: 4,
  minGap: 180,
  /** How far from the top and the ground a gap's centre may sit. */
  topMargin: 170,
  bottomMargin: 120,
  passPoints: 1,
};

/** The crypto coins that float in the gaps: Bitcoin, Ethereum, BNB and Solana, worth five points each. */
export const COIN = {
  radius: 15,
  points: 5,
  /** How many coin kinds there are (see coinIcons.js). */
  kinds: 4,
  /** Chance a gate carries a coin in its gap. */
  chance: 0.6,
};

/** One level every six gates passed; speeds and gaps stop growing at the last level. */
export const LEVEL = { gatesPerLevel: 6, max: 10 };

/** How many pipes and coins can exist at once; the pools are allocated once, at boot. */
export const POOL_SIZE = 32;

/** Medals for the game-over screen, by final score. */
export const MEDALS = [
  { score: 40, name: 'Platinum Pepe' },
  { score: 30, name: 'Gold Pepe' },
  { score: 20, name: 'Silver Pepe' },
  { score: 10, name: 'Bronze Pepe' },
];

export const PALETTE = {
  backdrop: '#0e2a3f',
  skyTop: '#79c7f2',
  skyBottom: '#dff3fd',
  sun: '#ffd94d',
  cloud: '#ffffff',
  hillFar: '#8fc97e',
  hillNear: '#5da85a',
  ground: '#8a5a2b',
  grass: '#4caf50',
  grassLight: '#7ed957',
  pipe: '#3fae4a',
  pipeDark: '#2b7d33',
  pipeLight: '#7ed957',
  pipeEdge: '#1d5c25',
  coin: '#f2c94c',
  coinDark: '#c9930a',
  pepe: '#58b368',
  pepeDark: '#3d8b4f',
  pepeBelly: '#cdeeb0',
  eyeWhite: '#ffffff',
  pupil: '#1a1a1a',
  panel: '#12324a',
  panelEdge: '#2b6a8f',
  text: '#ffffff',
  muted: '#bfe3f2',
  gold: '#ffd94d',
  heart: '#ff5a6e',
  heartEmpty: '#3a5a6e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'pepe-catch-coin.best';
