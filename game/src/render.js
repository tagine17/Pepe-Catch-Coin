// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Pepe himself is drawn from shapes (an original frog: green body, eye bumps, wide
// smile, little feet), never an image file. Text that holds a number is rebuilt only when
// the number changes, so a frame allocates nothing.
import { COIN, FIELD, FONT, LIVES, PALETTE, PEPE, PIPE } from './config.js';
import { COIN_ICONS } from './coinIcons.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 78 };
const HEART_SIZE = 22;
const HEART_GAP = 8;

/** Clouds drift across the title and play screens; their places come from the seed-free clock. */
const CLOUDS = [
  { x: 120, y: 90, scale: 1.0, speed: 12 },
  { x: 520, y: 150, scale: 0.7, speed: 18 },
  { x: 900, y: 70, scale: 1.2, speed: 9 },
  { x: 1150, y: 190, scale: 0.8, speed: 15 },
];

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('');
  const coinsLabel = cachedLabel('Coins ');
  const levelLabel = cachedLabel('Level ');
  const finalLabel = cachedLabel('Score ');
  const coinsFinalLabel = cachedLabel('Coins ');
  const bestLabel = cachedLabel('Best ');
  const medalLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, outline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.textAlign = align;
    if (outline) {
      context.lineWidth = 6;
      context.lineJoin = 'round';
      context.strokeStyle = 'rgba(10, 30, 46, 0.85)';
      context.strokeText(value, x, y);
    }
    context.fillStyle = color;
    context.fillText(value, x, y);
  }

  function drawSky(elapsed) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.groundY);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);

    // Sun, top right.
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(1120, 100, 46, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 217, 77, 0.35)';
    context.beginPath();
    context.arc(1120, 100, 62, 0, Math.PI * 2);
    context.fill();

    // Clouds, drifting left and wrapping around.
    context.fillStyle = PALETTE.cloud;
    for (const cloud of CLOUDS) {
      const cx = (((cloud.x - elapsed * cloud.speed) % (FIELD.width + 240)) + FIELD.width + 240) % (FIELD.width + 240) - 120;
      const cy = cloud.y;
      const s = cloud.scale;
      context.beginPath();
      context.arc(cx, cy, 26 * s, 0, Math.PI * 2);
      context.arc(cx + 28 * s, cy - 10 * s, 30 * s, 0, Math.PI * 2);
      context.arc(cx + 58 * s, cy, 24 * s, 0, Math.PI * 2);
      context.fill();
    }

    // Two hill ridges behind the pipes.
    context.fillStyle = PALETTE.hillFar;
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    context.quadraticCurveTo(320, 520, 640, FIELD.groundY);
    context.quadraticCurveTo(960, 540, 1280, FIELD.groundY);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.hillNear;
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    context.quadraticCurveTo(220, 600, 480, FIELD.groundY);
    context.quadraticCurveTo(820, 590, 1280, FIELD.groundY);
    context.closePath();
    context.fill();
  }

  function drawGround() {
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, FIELD.groundY, FIELD.width, 14);
    context.fillStyle = PALETTE.grassLight;
    context.fillRect(0, FIELD.groundY, FIELD.width, 5);
  }

  function drawPipe(x, y, height, isTop) {
    if (height <= 0) return;
    const cap = 18;
    const lip = 8;
    context.fillStyle = PALETTE.pipe;
    context.fillRect(x, y, PIPE.width, height);
    context.fillStyle = PALETTE.pipeLight;
    context.fillRect(x + 10, y, 12, height);
    context.fillStyle = PALETTE.pipeDark;
    context.fillRect(x + PIPE.width - 16, y, 10, height);
    context.strokeStyle = PALETTE.pipeEdge;
    context.lineWidth = 3;
    context.strokeRect(x + 1.5, y, PIPE.width - 3, height);
    // The lip at the open end.
    const lipY = isTop ? y + height - cap : y;
    context.fillStyle = PALETTE.pipe;
    context.fillRect(x - lip, lipY, PIPE.width + lip * 2, cap);
    context.fillStyle = PALETTE.pipeLight;
    context.fillRect(x - lip + 8, lipY, 12, cap);
    context.strokeStyle = PALETTE.pipeEdge;
    context.strokeRect(x - lip + 1.5, lipY, PIPE.width + lip * 2 - 3, cap);
  }

  /** A coin spins like a flipping coin (its width squishes with the spin) and shows one
   * of the four crypto icons; until its image has decoded it is the old gold circle. */
  function drawCoin(coin) {
    const squish = Math.max(0.05, Math.abs(Math.cos(coin.spin)));
    const icon = COIN_ICONS[coin.kind] ?? null;
    const size = COIN.radius * 2 + 4;
    context.save();
    context.translate(coin.x, coin.y);
    context.scale(squish, 1);
    if (icon !== null && icon.image.complete && icon.image.naturalWidth > 0) {
      context.drawImage(icon.image, -size / 2, -size / 2, size, size);
    } else {
      context.fillStyle = PALETTE.coinDark;
      context.beginPath();
      context.arc(0, 0, COIN.radius + 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.coin;
      context.beginPath();
      context.arc(0, 0, COIN.radius, 0, Math.PI * 2);
      context.fill();
      if (squish > 0.4) {
        context.fillStyle = PALETTE.coinDark;
        context.font = `bold ${Math.round(COIN.radius)}px ${FONT}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('$', 0, 1);
      }
    }
    context.restore();
  }

  /** Pepe: a round green frog with eye bumps, a wide smile and kicking feet, tilted by his flight. */
  function drawPepe(state) {
    const pepe = state.pepe;
    // Blink while invulnerable after a hit: hidden on every other tenth of a second.
    if (pepe.invulnerable > 0 && Math.floor(pepe.invulnerable * 10) % 2 === 0) return;
    const tilt = Math.max(-0.45, Math.min(0.55, pepe.vy / 1400));
    const squash = 1 - pepe.flap * 0.12;
    context.save();
    context.translate(pepe.x, pepe.y);
    context.rotate(tilt);
    context.scale(1 / squash, squash);

    // Feet, kicking behind him.
    const kick = Math.sin(state.elapsed * 14) * 4;
    context.fillStyle = PALETTE.pepeDark;
    context.beginPath();
    context.ellipse(-PEPE.radius + 2, 16 + kick, 12, 7, -0.4, 0, Math.PI * 2);
    context.ellipse(-PEPE.radius + 2, -14 - kick, 12, 7, 0.4, 0, Math.PI * 2);
    context.fill();

    // Body.
    context.fillStyle = PALETTE.pepe;
    context.beginPath();
    context.ellipse(0, 0, PEPE.radius, PEPE.radius - 2, 0, 0, Math.PI * 2);
    context.fill();
    // Belly.
    context.fillStyle = PALETTE.pepeBelly;
    context.beginPath();
    context.ellipse(6, 10, 16, 11, 0, 0, Math.PI * 2);
    context.fill();

    // Eye bumps on top.
    context.fillStyle = PALETTE.pepe;
    context.beginPath();
    context.arc(-6, -PEPE.radius + 2, 11, 0, Math.PI * 2);
    context.arc(12, -PEPE.radius + 2, 11, 0, Math.PI * 2);
    context.fill();
    // Eyes: white, pupils looking forward.
    context.fillStyle = PALETTE.eyeWhite;
    context.beginPath();
    context.arc(-6, -PEPE.radius + 2, 8, 0, Math.PI * 2);
    context.arc(12, -PEPE.radius + 2, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.pupil;
    context.beginPath();
    context.arc(-3, -PEPE.radius + 2, 4, 0, Math.PI * 2);
    context.arc(15, -PEPE.radius + 2, 4, 0, Math.PI * 2);
    context.fill();

    // Wide smile.
    context.strokeStyle = PALETTE.pepeDark;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(8, 2, 13, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();

    // Little flapping arms.
    const wave = pepe.flap > 0 ? -14 * pepe.flap : Math.sin(state.elapsed * 10) * 3;
    context.strokeStyle = PALETTE.pepeDark;
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-4, -6);
    context.lineTo(-22, -16 + wave);
    context.moveTo(-4, 8);
    context.lineTo(-20, 18 - wave);
    context.stroke();
    context.restore();
  }

  function drawField(state) {
    drawSky(state.elapsed);
    for (const pipe of state.pipes) {
      if (!pipe.active) continue;
      const halfGap = pipe.gap / 2;
      drawPipe(pipe.x, 0, pipe.gapY - halfGap, true);
      drawPipe(pipe.x, pipe.gapY + halfGap, FIELD.groundY - (pipe.gapY + halfGap), false);
    }
    for (const coin of state.coins) {
      if (coin.active) drawCoin(coin);
    }
    drawGround();
    drawPepe(state);
  }

  function drawHeart(x, y, filled) {
    context.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
    context.beginPath();
    context.moveTo(x + HEART_SIZE / 2, y + HEART_SIZE * 0.85);
    context.bezierCurveTo(x, y + HEART_SIZE * 0.45, x + HEART_SIZE * 0.12, y, x + HEART_SIZE * 0.32, y);
    context.bezierCurveTo(x + HEART_SIZE * 0.42, y, x + HEART_SIZE / 2, y + HEART_SIZE * 0.14, x + HEART_SIZE / 2, y + HEART_SIZE * 0.14);
    context.bezierCurveTo(x + HEART_SIZE / 2, y + HEART_SIZE * 0.14, x + HEART_SIZE * 0.58, y, x + HEART_SIZE * 0.68, y);
    context.bezierCurveTo(x + HEART_SIZE * 0.88, y, x + HEART_SIZE, y + HEART_SIZE * 0.45, x + HEART_SIZE / 2, y + HEART_SIZE * 0.85);
    context.fill();
  }

  function drawHud(state, muted) {
    context.textBaseline = 'top';
    text(coinsLabel(state.coinsCaught), 24, 18, 26, PALETTE.text, 'left');
    text(levelLabel(state.level), 24, 52, 22, PALETTE.muted, 'left');
    text(scoreLabel(state.score), FIELD.width / 2, 12, 56, PALETTE.text, 'center', true);
    const firstHeart = FIELD.width - 24 - LIVES * (HEART_SIZE + HEART_GAP) + HEART_GAP;
    text('Lives', firstHeart - 12, 18, 26, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      drawHeart(firstHeart + life * (HEART_SIZE + HEART_GAP), 22, life < state.lives);
    }
    if (muted) text('Muted (M)', FIELD.width - 24, 56, 20, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 30, 46, 0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x + 1.5, y + 1.5, PANEL.width - 3, height - 3);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.gold, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.coin, 'center');
  }

  const TITLE_LINES = [
    'Flap Pepe through the pipe gates. Catch BTC, ETH, BNB and SOL.',
    'Space, ↑, W or click to flap.  P to pause.  M to mute.',
    'One point per gate, five per coin. Three lives. Good luck!',
    '',
  ];
  const PAUSED_LINES = ['The pipes will wait for you.'];
  const OVER_LINES = ['', '', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, medal, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = bestLabel(best);
      drawPanel('PEPE CATCH COIN', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = coinsFinalLabel(state.coinsCaught);
      OVER_LINES[2] = bestLabel(best);
      OVER_LINES[3] = medal ? medalLabel(medal) : '';
      drawPanel('Game over', OVER_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
