// The arena, the beacon, and the small shared helpers of LUMEN KEEP.
//
// One job: describe the fixed 1280x480 field, hold its decoration and its
// loose objects (light shards, particles, floating text), and offer the
// tiny helpers the other modules share: scoring, the kill feed, bursts.

import { range, pick } from './random.js';

export const ARENA = { w: 1280, h: 480, cx: 640, cy: 240 };
export const BEACON_R = 26;

// Build the arena decoration from the seeded stream: glowing runes
// scattered on the field (never within 90 px of the beacon) and the
// beacon itself at the centre.
export function createWorld(rng) {
  const runes = [];
  for (let i = 0; i < 46; i++) {
    const x = range(rng, 30, ARENA.w - 30);
    const y = range(rng, 60, ARENA.h - 30);
    const dx = x - ARENA.cx;
    const dy = y - ARENA.cy;
    if (Math.sqrt(dx * dx + dy * dy) < 110) continue;
    runes.push({ x, y, r: range(rng, 2, 5), phase: range(rng, 0, Math.PI * 2), hue: pick(rng, ['#2fd6c8', '#ffd166', '#7ee081']) });
  }
  return {
    beacon: { x: ARENA.cx, y: ARENA.cy, hp: 100, max: 100, flash: 0 },
    runes,
  };
}

// A spawn point on a random arena edge, away from the beacon and the
// player so nothing appears on top of either.
export function edgeSpawn(rng, player) {
  for (let tries = 0; tries < 12; tries++) {
    const side = Math.floor(rng() * 4);
    let x = 0;
    let y = 0;
    if (side === 0) { x = range(rng, 20, ARENA.w - 20); y = 18; }
    else if (side === 1) { x = range(rng, 20, ARENA.w - 20); y = ARENA.h - 18; }
    else if (side === 2) { x = 18; y = range(rng, 20, ARENA.h - 20); }
    else { x = ARENA.w - 18; y = range(rng, 20, ARENA.h - 20); }
    const db = Math.hypot(x - ARENA.cx, y - ARENA.cy);
    const dp = player ? Math.hypot(x - player.x, y - player.y) : 999;
    if (db > 190 && dp > 130) return { x, y };
  }
  return { x: 40, y: 40 };
}

export function clampToArena(x, y, r) {
  return {
    x: Math.max(r + 6, Math.min(ARENA.w - r - 6, x)),
    y: Math.max(r + 50, Math.min(ARENA.h - r - 6, y)),
  };
}

// --- shared scoring / feedback helpers (state lives in main.js) ---

export function addScore(state, points, x, y) {
  state.score += points;
  if (x !== undefined) addFloat(state, x, y, '+' + points, '#ffd166');
}

export function addFloat(state, x, y, text, color) {
  state.floats.push({ x, y, text, color: color || '#ffffff', t: 0, life: 0.9 });
  if (state.floats.length > 40) state.floats.shift();
}

export function addFeed(state, text) {
  state.feed.unshift({ text, t: 0 });
  if (state.feed.length > 3) state.feed.length = 3;
}

export function burst(state, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    const s = range(state.rng, speed * 0.3, speed);
    state.parts.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: range(state.rng, 0.3, 0.7),
      color, size: range(state.rng, 2, 5),
    });
  }
  if (state.parts.length > 320) state.parts.splice(0, state.parts.length - 320);
}

// Particles and floating text age out; shards drift toward the player
// when close and are collected on touch (beacon +2 HP, +50 score).
export function updateFx(state, dt, audio) {
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const p = state.parts[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.t >= p.life) state.parts.splice(i, 1);
  }
  for (let i = state.floats.length - 1; i >= 0; i--) {
    const f = state.floats[i];
    f.t += dt;
    f.y -= 34 * dt;
    if (f.t >= f.life) state.floats.splice(i, 1);
  }
  const p = state.player;
  for (let i = state.shards.length - 1; i >= 0; i--) {
    const s = state.shards[i];
    s.t += dt;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 110 && d > 1) {
      s.x += (dx / d) * 190 * dt;
      s.y += (dy / d) * 190 * dt;
    }
    if (d < 26) {
      state.shards.splice(i, 1);
      state.beacon.hp = Math.min(state.beacon.max, state.beacon.hp + 2);
      addScore(state, 50, s.x, s.y - 10);
      addFloat(state, s.x, s.y - 24, '+2 BEACON', '#7ee081');
      if (audio) audio.pickup();
    }
  }
}
