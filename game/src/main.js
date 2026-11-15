// LUMEN KEEP - boot, fixed-step loop, screens and screenshot scenes.
//
// One job: own the single game state, run it at a fixed 60 Hz step kept
// apart from rendering, switch between title / playing / paused / end,
// and set up the four deterministic screenshot scenes from ?shot=
// (start, play, boss, end) with a fixed seed so every render is a real
// frame of this game's own code.

import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { mulberry32 } from './random.js';
import { createWorld, updateFx } from './world.js';
import { createPlayer, updatePlayer, updateBolts, nearestEnemy } from './player.js';
import { spawnEnemy, updateEnemies } from './enemies.js';
import { startWave, updateWaves } from './waves.js';
import { render } from './hud.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');
const input = createInput(canvas);
const audio = createAudio();
const statusEl = document.getElementById('status');

function newState() {
  const rng = mulberry32(seed);
  const world = createWorld(rng);
  return {
    seed,
    rng,
    mode: 'title',
    time: 0,
    wave: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    player: createPlayer(),
    beacon: world.beacon,
    runes: world.runes,
    enemies: [],
    bolts: [],
    parts: [],
    shards: [],
    floats: [],
    feed: [],
    telegraphs: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveState: 'idle',
    breather: 0,
    banner: '',
    bannerSub: '',
    bannerT: 0,
    bannerDur: 0,
    shake: 0,
    alarmT: 0,
    endReason: '',
    endScore: 0,
    stats: { shots: 0, hits: 0 },
  };
}

let state = newState();

// One fixed tick of simulation. Rendering never runs here.
function step(s, inp, dt) {
  s.time += dt;
  s.bannerT += dt;
  s.shake = Math.max(0, s.shake - 30 * dt);
  s.beacon.flash = Math.max(0, s.beacon.flash - dt);
  if (s.comboTimer > 0) {
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) s.combo = 0;
  }
  for (const f of s.feed) f.t += dt;

  // Low beacon alarm while playing.
  if (s.mode === 'playing' && s.beacon.hp < 30) {
    s.alarmT -= dt;
    if (s.alarmT <= 0) {
      s.alarmT = 2;
      if (audio) audio.alarm();
    }
  }

  if (s.mode === 'title') {
    // The swarm drifts behind the title screen: a living backdrop.
    updateEnemies(s, dt, null);
    updateFx(s, dt, null);
  } else if (s.mode === 'playing') {
    updatePlayer(s, inp, dt, audio);
    updateBolts(s, dt);
    updateEnemies(s, dt, audio);
    updateWaves(s, dt, audio);
    updateFx(s, dt, audio);
  } else if (s.mode === 'over' || s.mode === 'win') {
    updateFx(s, dt, null);
  }
  inp.endTick();
}

function startGame() {
  state = newState();
  state.mode = 'playing';
  startWave(state, audio);
  announce('Wave 1. Defend the beacon.');
}

function restartGame() {
  startGame();
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

// Frame keys: start, pause, restart, mute. Checked once per frame,
// before the fixed steps run.
function handleFrameKeys() {
  if (input.justPressed('KeyM')) {
    audio.ensure();
    const muted = audio.toggleMute();
    announce(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (state.mode === 'title') {
    if (input.justPressed('Enter') || input.justPressed('Mouse0') || input.justPressed('Space')) {
      audio.ensure();
      startGame();
    }
  } else if (state.mode === 'playing') {
    if (input.justPressed('KeyP')) {
      state.mode = 'paused';
      announce('Paused.');
    } else if (input.justPressed('KeyR')) {
      restartGame();
    }
  } else if (state.mode === 'paused') {
    if (input.justPressed('KeyP') || input.justPressed('Escape')) {
      state.mode = 'playing';
      announce('Resumed.');
    } else if (input.justPressed('KeyR')) {
      restartGame();
    }
  } else if (state.mode === 'over' || state.mode === 'win') {
    if (input.justPressed('KeyR') || input.justPressed('Enter') || input.justPressed('Mouse0')) {
      audio.ensure();
      restartGame();
    }
  }
}

// --- deterministic screenshot scenes ---------------------------------
//
// Each ?shot= scene is built from the seeded stream and pre-rolled a
// fixed number of ticks with a scripted input, so the render is a real
// frame of the game with no user input at all.

function scriptedInput(fire) {
  return {
    mouseX: 640,
    mouseY: 120,
    mouseDown: fire,
    mouseSeen: true,
    moveVector: () => ({ x: 0, y: 0 }),
    firing: () => fire,
    dashPressed: () => false,
    justPressed: () => false,
    held: () => false,
    endTick: () => {},
  };
}

function aimAtNearest(s, inp) {
  let best = null;
  let bestD = Infinity;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - s.player.x, e.y - s.player.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) {
    inp.mouseX = best.x;
    inp.mouseY = best.y;
  }
}

function preroll(s, ticks, fire) {
  const inp = scriptedInput(fire);
  for (let i = 0; i < ticks; i++) {
    if (fire) aimAtNearest(s, inp);
    step(s, inp, STEP);
    if (s.mode !== 'playing' && s.mode !== 'title') break;
  }
}

function setupShot(kind) {
  if (kind === 'start') {
    state.mode = 'title';
    for (let i = 0; i < 6; i++) {
      spawnEnemy(state, 'wisp', 170 + i * 180, 120 + (i % 2) * 190);
    }
    preroll(state, 90, false);
  } else if (kind === 'play') {
    state.mode = 'playing';
    state.wave = 3;
    state.waveState = 'fighting';
    state.player.x = 640;
    state.player.y = 380;
    spawnEnemy(state, 'wisp', 300, 130);
    spawnEnemy(state, 'wisp', 480, 110);
    spawnEnemy(state, 'wisp', 820, 130);
    spawnEnemy(state, 'wisp', 980, 150);
    spawnEnemy(state, 'wisp', 240, 300);
    spawnEnemy(state, 'wisp', 1040, 300);
    spawnEnemy(state, 'mite', 200, 120);
    spawnEnemy(state, 'mite', 1080, 120);
    spawnEnemy(state, 'mite', 180, 380);
    spawnEnemy(state, 'brute', 640, 100);
    spawnEnemy(state, 'brute', 950, 320);
    spawnEnemy(state, 'brute', 320, 200);
    state.shards.push({ x: 420, y: 300, t: 1 });
    state.shards.push({ x: 860, y: 340, t: 3 });
    state.banner = 'WAVE 3';
    state.bannerSub = 'Wave 3: brutes + mites + wisps';
    state.bannerT = -3.5;
    state.bannerDur = 2.2;
    state.score = 2450;
    state.combo = 3;
    state.comboTimer = 2.5;
    state.kills = 17;
    preroll(state, 70, true);
  } else if (kind === 'boss') {
    state.mode = 'playing';
    state.wave = 5;
    state.waveState = 'fighting';
    state.beacon.hp = 35;
    state.player.x = 500;
    state.player.y = 360;
    spawnEnemy(state, 'herald', 880, 130);
    spawnEnemy(state, 'wisp', 760, 110);
    spawnEnemy(state, 'wisp', 1010, 160);
    spawnEnemy(state, 'wisp', 880, 260);
    spawnEnemy(state, 'mite', 150, 90);
    spawnEnemy(state, 'mite', 1150, 90);
    state.banner = 'WAVE 5';
    state.bannerSub = 'THE DUSK HERALD COMES';
    state.bannerT = -3.5;
    state.bannerDur = 2.2;
    state.score = 6800;
    state.combo = 4;
    state.comboTimer = 2.2;
    state.kills = 41;
    state.shards.push({ x: 420, y: 300, t: 1 });
    state.shards.push({ x: 760, y: 330, t: 3 });
    preroll(state, 120, true);
  } else if (kind === 'end') {
    state.mode = 'over';
    state.endReason = 'beacon';
    state.score = 12400;
    state.endScore = 12400;
    state.wave = 7;
    state.kills = 63;
    state.beacon.hp = 0;
    state.player.hearts = 0;
    spawnEnemy(state, 'wisp', 300, 140);
    spawnEnemy(state, 'wisp', 980, 160);
    spawnEnemy(state, 'brute', 900, 320);
    spawnEnemy(state, 'mite', 220, 330);
    preroll(state, 30, false);
  }
}

if (shot === 'start' || shot === 'play' || shot === 'boss' || shot === 'end') {
  setupShot(shot);
}

// The render loop: fixed steps, then one frame.
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  handleFrameKeys();
  // Shot autopilot: in the staged play/boss scenes the Keeper keeps
  // fighting on its own (aims at the nearest enemy, fires, steps away
  // and dashes when something gets close), so bolts stay visible in
  // the screenshot whenever it is taken. Plain play is untouched.
  if ((shot === 'play' || shot === 'boss') && state.mode === 'playing') {
    const near = nearestEnemy(state);
    if (near) {
      input.mouseX = near.x;
      input.mouseY = near.y;
      input.mouseDown = true;
      input.mouseSeen = true;
      const d = Math.hypot(near.x - state.player.x, near.y - state.player.y);
      input.down.delete('KeyW');
      input.down.delete('KeyA');
      input.down.delete('KeyS');
      input.down.delete('KeyD');
      if (d < 130) {
        if (near.x > state.player.x) input.down.add('KeyA');
        else input.down.add('KeyD');
        if (near.y > state.player.y) input.down.add('KeyW');
        else input.down.add('KeyS');
        if (state.player.dashCd <= 0) input.hit.add('Space');
      }
    }
  }
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    step(state, input, STEP);
    acc -= STEP;
    n += 1;
  }
  if (n === 5) acc = 0;
  render(ctx, state);
}
requestAnimationFrame(frame);
window.LUMEN_READY = true;

// Test hook for headless play-testing: read-only state plus start.
window.LUMEN = {
  get state() {
    return state;
  },
  start: () => startGame(),
  version: 1,
};
