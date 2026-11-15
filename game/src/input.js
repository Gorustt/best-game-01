// Keyboard + mouse input for LUMEN KEEP.
//
// One job: remember which keys are held, which were just pressed, and
// where the mouse is (in playfield pixels, 1280x480). The game reads this
// once per fixed tick and then calls endTick() to clear the edge flags.
//
// Keyboard-only play: if the mouse has never moved, Space fires toward
// the nearest enemy and Shift dashes; once the mouse moves, Space dashes
// and the mouse aims. That way the game is fully playable with no mouse
// at all, which is how headless testing drives it.

export function createInput(canvas) {
  const input = {
    down: new Set(),
    hit: new Set(),
    mouseX: 640,
    mouseY: 110,
    mouseDown: false,
    mouseSeen: false,
    preventKeys: new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']),
  };

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1280,
      y: ((clientY - rect.top) / rect.height) * 480,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (input.preventKeys.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      input.down.add(event.code);
      input.hit.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    input.down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.down.clear();
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const p = toField(event.clientX, event.clientY);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.mouseSeen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toField(event.clientX, event.clientY);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.mouseSeen = true;
    input.mouseDown = true;
    if (event.button === 0) input.hit.add('Mouse0');
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  input.held = function held(code) {
    return input.down.has(code);
  };

  // True once, on the tick the key (or click) went down.
  input.justPressed = function justPressed(code) {
    return input.hit.has(code);
  };

  // Movement axes: WASD or arrows. Returns a unit-ish vector.
  input.moveVector = function moveVector() {
    let x = 0;
    let y = 0;
    if (input.down.has('KeyA') || input.down.has('ArrowLeft')) x -= 1;
    if (input.down.has('KeyD') || input.down.has('ArrowRight')) x += 1;
    if (input.down.has('KeyW') || input.down.has('ArrowUp')) y -= 1;
    if (input.down.has('KeyS') || input.down.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  };

  // Space dashes when the mouse aims; with no mouse it fires instead.
  input.dashPressed = function dashPressed() {
    if (input.mouseSeen) return input.justPressed('Space');
    return input.justPressed('ShiftLeft') || input.justPressed('ShiftRight');
  };

  // Hold-to-fire: mouse button, or Space when no mouse has been seen.
  input.firing = function firing() {
    if (input.mouseDown) return true;
    if (!input.mouseSeen && input.down.has('Space')) return true;
    return false;
  };

  input.endTick = function endTick() {
    input.hit.clear();
  };

  return input;
}
