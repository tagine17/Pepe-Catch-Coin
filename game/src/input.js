// Keyboard and pointer input. A flap is a one-shot press (Space, ArrowUp, W, or a click
// or tap), queued as a flag and taken once by the loop, so a press between two frames is
// never lost and never counted twice. P pauses, M mutes.

export const ACTION_FLAP = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const FLAP = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (FLAP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_FLAP;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  });
  // A key released while the tab is hidden never sends keyup; nothing here is held, so
  // there is nothing to let go of on blur.
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    actions |= ACTION_FLAP;
  });

  return {
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
