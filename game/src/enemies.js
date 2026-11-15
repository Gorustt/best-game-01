// The Dusk Swarm: every enemy type, its shape in the world and its AI.
//
// One job: spawn, move, chew the beacon, chase the Keeper, take bolt
// damage and die loudly. Four original kinds, each with its own look,
// speed, health and behaviour:
//   Ember Wisp  - fast, weak, wobbles toward the beacon.
//   Skitter Mite - zigzags quickly and hunts the player.
//   Gloom Brute - slow, big, heavy beacon damage.
//   Dusk Herald - the boss: huge, spawns wisps, charges in bursts.

import { ARENA, BEACON_R, addScore, addFeed, addFloat, burst } from './world.js';
import { chance, range } from './random.js';
import { hurtPlayer, PLAYER_R } from './player.js';

export const ENEMY_TYPES = {
  wisp: {
    name: 'Ember Wisp', label: 'Wisp', hp: 1, speed: 58, r: 11,
    color: '#ff5da2', glow: '#ff8ac2', beaconDps: 6, score: 100,
  },
  mite: {
    name: 'Skitter Mite', label: 'Mite', hp: 2, speed: 112, r: 10,
    color: '#a4e635', glow: '#d9f99d', beaconDps: 5, score: 100,
  },
  brute: {
    name: 'Gloom Brute', label: 'Brute', hp: 8, speed: 33, r: 22,
    color: '#fb923c', glow: '#fdba74', beaconDps: 14, score: 100,
  },
  herald: {
    name: 'Dusk Herald', label: 'Herald', hp: 60, speed: 27, r: 34,
    color: '#c084fc', glow: '#e9d5ff', beaconDps: 18, score: 100,
  },
};

export function spawnEnemy(state, type, x, y) {
  const def = ENEMY_TYPES[type];
  const e = {
    type,
    name: def.name,
    label: def.label,
    x, y,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * (1 + (state.wave - 1) * 0.03),
    r: def.r,
    color: def.color,
    glow: def.glow,
    beaconDps: def.beaconDps,
    phase: state.rng() * Math.PI * 2,
    wobble: 0,
    flash: 0,
    chewT: 0,
    spawnT: 0,
    chargeT: 0,
    chargeCd: 4,
  };
  state.enemies.push(e);
  return e;
}

// Telegraph first: a glow marker shows where an enemy will appear 0.6 s
// before it does, so spawns never feel unfair.
export function telegraphSpawn(state, type) {
  const p = state.player;
  const spot = { x: 0, y: 0 };
  for (let tries = 0; tries < 12; tries++) {
    const side = Math.floor(state.rng() * 4);
    if (side === 0) { spot.x = range(state.rng, 20, ARENA.w - 20); spot.y = 18; }
    else if (side === 1) { spot.x = range(state.rng, 20, ARENA.w - 20); spot.y = ARENA.h - 18; }
    else if (side === 2) { spot.x = 18; spot.y = range(state.rng, 20, ARENA.h - 20); }
    else { spot.x = ARENA.w - 18; spot.y = range(state.rng, 20, ARENA.h - 20); }
    const db = Math.hypot(spot.x - ARENA.cx, spot.y - ARENA.cy);
    const dp = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (db > 190 && dp > 130) break;
  }
  state.telegraphs.push({ x: spot.x, y: spot.y, type, t: 0, dur: 0.6 });
}

export function updateEnemies(state, dt, audio) {
  const p = state.player;
  const b = state.beacon;

  // Spawn telegraphs tick down, then the enemy appears.
  for (let i = state.telegraphs.length - 1; i >= 0; i--) {
    const tg = state.telegraphs[i];
    tg.t += dt;
    if (tg.t >= tg.dur) {
      state.telegraphs.splice(i, 1);
      spawnEnemy(state, tg.type, tg.x, tg.y);
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.wobble += dt;
    e.spawnT += dt;

    // On the title screen the swarm only drifts, for a living backdrop.
    if (state.mode === 'title') {
      const dx = ARENA.cx - e.x;
      const dy = ARENA.cy - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const drift = 14;
      e.x += (dx / d) * drift * dt + Math.cos(e.wobble * 1.7 + e.phase) * 12 * dt;
      e.y += (dy / d) * drift * dt + Math.sin(e.wobble * 1.3 + e.phase) * 12 * dt;
      continue;
    }
    if (state.mode !== 'playing') continue;

    // Pick a target: mites hunt the Keeper, the rest march on the beacon.
    let tx = ARENA.cx;
    let ty = ARENA.cy;
    if (e.type === 'mite') {
      tx = p.x;
      ty = p.y;
    }
    let dx = tx - e.x;
    let dy = ty - e.y;
    let d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;

    // Wobble and zigzag so paths read as alive, not straight lines.
    const wob = Math.sin(e.wobble * 3.1 + e.phase);
    let mx = dx;
    let my = dy;
    if (e.type === 'wisp') {
      mx = dx - dy * wob * 0.55;
      my = dy + dx * wob * 0.55;
    } else if (e.type === 'mite') {
      mx = dx - dy * wob * 0.9;
      my = dy + dx * wob * 0.9;
    }

    // The Herald charges the beacon in bursts and spawns wisps.
    let speed = e.speed;
    if (e.type === 'herald') {
      e.chargeCd -= dt;
      if (e.chargeCd <= 0 && e.chargeT <= 0) {
        e.chargeT = 1.0;
        e.chargeCd = 5;
      }
      if (e.chargeT > 0) {
        e.chargeT -= dt;
        speed *= 3.1;
      }
      e.spawnT += dt;
      if (e.spawnT > 4) {
        e.spawnT = 0;
        const minions = state.enemies.filter((o) => o.type === 'wisp').length;
        if (minions < 6) {
          spawnEnemy(state, 'wisp', e.x + 40, e.y - 30);
          spawnEnemy(state, 'wisp', e.x - 40, e.y + 30);
        }
      }
    }

    e.x += mx * speed * dt;
    e.y += my * speed * dt;

    // Chew the beacon on contact: the beacon flares, shakes and alarms.
    const db = Math.hypot(e.x - ARENA.cx, e.y - ARENA.cy);
    if (db < BEACON_R + e.r) {
      const push = (BEACON_R + e.r - db) || 1;
      e.x -= (dx / d) * push;
      e.y -= (dy / d) * push;
      b.hp -= e.beaconDps * dt;
      b.flash = 0.25;
      e.chewT += dt;
      if (e.chewT > 0.5) {
        e.chewT = 0;
        state.shake = Math.max(state.shake, 4);
        if (audio) audio.beaconHit();
      }
      if (b.hp <= 0) {
        b.hp = 0;
        state.mode = 'over';
        state.endReason = 'beacon';
        state.endScore = state.score;
        if (audio) audio.lose();
        return;
      }
    }

    // Touching the Keeper costs a heart (miters and brutes included).
    if (p.hearts > 0) {
      const dp = Math.hypot(e.x - p.x, e.y - p.y);
      if (dp < e.r + PLAYER_R) {
        hurtPlayer(state, e.x, e.y, audio);
        // Shove the enemy back so one touch is one hit, not a drain.
        e.x += ((e.x - p.x) / (dp || 1)) * 30;
        e.y += ((e.y - p.y) / (dp || 1)) * 30;
      }
    }
  }

  // Bolt hits: a bolt dies on the first enemy it touches.
  for (let bi = state.bolts.length - 1; bi >= 0; bi--) {
    const bolt = state.bolts[bi];
    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      const d = Math.hypot(bolt.x - e.x, bolt.y - e.y);
      if (d < e.r + 5) {
        state.bolts.splice(bi, 1);
        damageEnemy(state, e, 1, audio);
        break;
      }
    }
  }
}

export function damageEnemy(state, e, dmg, audio) {
  e.hp -= dmg;
  e.flash = 0.12;
  state.stats.hits += 1;
  addFloat(state, e.x, e.y - e.r - 6, '-' + dmg, '#ffffff');
  burst(state, e.x, e.y, e.color, 4, 120);
  if (audio) audio.hit();
  if (e.hp <= 0) killEnemy(state, e, audio);
}

export function killEnemy(state, e, audio) {
  const idx = state.enemies.indexOf(e);
  if (idx !== -1) state.enemies.splice(idx, 1);
  state.kills += 1;

  // Combo: kills within 3 s of each other stack, up to a x5 multiplier.
  if (state.comboTimer > 0) state.combo += 1;
  else state.combo = 1;
  state.comboTimer = 3;
  const mult = Math.min(state.combo, 5);
  const points = 100 * mult;
  addScore(state, points, e.x, e.y - e.r - 16);
  addFeed(state, e.label + ' shattered +' + points + (mult > 1 ? '  x' + mult : ''));
  burst(state, e.x, e.y, e.color, 16, 260);
  burst(state, e.x, e.y, '#ffffff', 6, 160);
  if (audio) audio.shatter();

  // Light shards sometimes drop: collecting one repairs the beacon.
  if (chance(state.rng, 0.45)) {
    state.shards.push({ x: e.x, y: e.y, t: state.rng() * 6 });
  }
}
