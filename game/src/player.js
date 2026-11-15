// The Keeper (player) of LUMEN KEEP.
//
// One job: movement, aiming, firing light bolts, dashing, hearts and
// energy. The Keeper stands between the swarm and the beacon: WASD to
// move, mouse to aim, hold click to fire, Space to dash.

import { ARENA, clampToArena, burst } from './world.js';

export const PLAYER_R = 15;
const MOVE_SPEED = 265;
const DASH_SPEED = 760;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 2.0;
const BOLT_SPEED = 640;
const BOLT_COST = 6;
const FIRE_INTERVAL = 0.14;
const ENERGY_MAX = 100;
const ENERGY_REGEN = 24;

export function createPlayer() {
  return {
    x: ARENA.cx,
    y: ARENA.cy + 130,
    angle: -Math.PI / 2,
    hearts: 3,
    maxHearts: 3,
    energy: ENERGY_MAX,
    dashCd: 0,
    dashTime: 0,
    dashX: 0,
    dashY: 0,
    fireCd: 0,
    invuln: 0,
    trail: [],
  };
}

export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  if (p.hearts <= 0) return;

  p.fireCd = Math.max(0, p.fireCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.energy = Math.min(ENERGY_MAX, p.energy + ENERGY_REGEN * dt);

  // Aim: at the mouse, or at the nearest enemy when playing keyboard-only.
  let aimX = input.mouseX;
  let aimY = input.mouseY;
  if (!input.mouseSeen) {
    const near = nearestEnemy(state);
    if (near) {
      aimX = near.x;
      aimY = near.y;
    } else {
      aimX = p.x;
      aimY = p.y - 100;
    }
  }
  p.angle = Math.atan2(aimY - p.y, aimX - p.x);

  // Dash: a short burst with brief invulnerability and a light trail.
  if (input.dashPressed() && p.dashCd <= 0 && p.dashTime <= 0) {
    const mv = input.moveVector();
    let dx = mv.x;
    let dy = mv.y;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const len = Math.hypot(dx, dy) || 1;
    p.dashX = dx / len;
    p.dashY = dy / len;
    p.dashTime = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    p.invuln = Math.max(p.invuln, DASH_TIME + 0.18);
    if (audio) audio.dash();
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x += p.dashX * DASH_SPEED * dt;
    p.y += p.dashY * DASH_SPEED * dt;
    p.trail.push({ x: p.x, y: p.y, t: 0 });
    if (p.trail.length > 14) p.trail.shift();
  } else {
    const mv = input.moveVector();
    p.x += mv.x * MOVE_SPEED * dt;
    p.y += mv.y * MOVE_SPEED * dt;
  }
  for (let i = p.trail.length - 1; i >= 0; i--) {
    p.trail[i].t += dt;
    if (p.trail[i].t > 0.3) p.trail.splice(i, 1);
  }

  const clamped = clampToArena(p.x, p.y, PLAYER_R);
  p.x = clamped.x;
  p.y = clamped.y;

  // Fire: hold to loose light bolts. Each bolt costs energy.
  if (input.firing() && p.fireCd <= 0 && p.energy >= BOLT_COST) {
    p.energy -= BOLT_COST;
    p.fireCd = FIRE_INTERVAL;
    const mx = Math.cos(p.angle) * 4;
    const my = Math.sin(p.angle) * 4;
    state.bolts.push({
      x: p.x + Math.cos(p.angle) * 22,
      y: p.y + Math.sin(p.angle) * 22,
      vx: Math.cos(p.angle) * BOLT_SPEED,
      vy: Math.sin(p.angle) * BOLT_SPEED,
      px: p.x + Math.cos(p.angle) * 22 - mx,
      py: p.y + Math.sin(p.angle) * 22 - my,
      t: 0,
      life: 1.1,
    });
    state.stats.shots += 1;
    burst(state, p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, '#bfefff', 3, 90);
    if (audio) audio.shot();
  }
}

// Bolts fly straight, fade after their life, and are removed by the
// enemy module when they hit (see damageEnemy in enemies.js).
export function updateBolts(state, dt) {
  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const b = state.bolts[i];
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.t += dt;
    if (b.t >= b.life || b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) {
      state.bolts.splice(i, 1);
    }
  }
}

// The player takes a hit: lose a heart, get knocked back, gain brief
// invulnerability. At zero hearts the light falls.
export function hurtPlayer(state, fromX, fromY, audio) {
  const p = state.player;
  if (p.invuln > 0 || p.dashTime > 0 || p.hearts <= 0) return;
  p.hearts -= 1;
  p.invuln = 1.2;
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  p.x += (dx / d) * 46;
  p.y += (dy / d) * 46;
  const clamped = clampToArena(p.x, p.y, PLAYER_R);
  p.x = clamped.x;
  p.y = clamped.y;
  state.shake = Math.max(state.shake, 7);
  burst(state, p.x, p.y, '#ff5d73', 14, 200);
  if (audio) audio.hurt();
  if (p.hearts <= 0) {
    state.mode = 'over';
    state.endReason = 'keeper';
    state.endScore = state.score;
    if (audio) audio.lose();
  }
}

export function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
