// Sound, synthesised with WebAudio: no audio files, so the game still plays with no
// network. The context is created on the first flap (a browser only lets sound start
// after a gesture), and M mutes everything.

export function createSound() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.25;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** One short note: a sine or square wave sliding from `from` Hz to `to` Hz. */
  function note(type, from, to, seconds, delay) {
    if (muted || !ensure() || context.state === 'suspended') return;
    const start = context.currentTime + (delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0.6, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  return {
    /** Pepe flaps his arms: a quick rising chirp. */
    flap() {
      note('square', 320, 640, 0.09, 0);
    },
    /** A gate is cleared: a soft two-note chirp. */
    score() {
      note('sine', 880, 880, 0.07, 0);
      note('sine', 1174, 1174, 0.09, 0.07);
    },
    /** A coin is caught: a bright ding-ding. */
    coin() {
      note('sine', 1318, 1318, 0.08, 0);
      note('sine', 1760, 1760, 0.14, 0.08);
    },
    /** Pepe bumps a pipe: a low thud. */
    hit() {
      note('triangle', 220, 60, 0.22, 0);
    },
    /** Game over: three notes sliding down. */
    over() {
      note('triangle', 523, 523, 0.16, 0);
      note('triangle', 392, 392, 0.16, 0.16);
      note('triangle', 262, 262, 0.3, 0.32);
    },
    /** Toggle mute; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
