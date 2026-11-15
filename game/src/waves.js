// Waves, scoring and the banners of LUMEN KEEP.
//
// One job: decide what each wave throws at the Keeper, spawn it in
// squads from the edges, call the wave clear (bonus, a heart back, a
// breather with the next wave previewed), and declare the victory at
// wave 10. Survive wave 10 and the dawn holds.

import { telegraphSpawn } from './enemies.js';
import { addFeed, addFloat, burst } from './world.js';

export const FINAL_WAVE = 10;
export const BREATHER = 6;

// What wave N is made of. Wisps from wave 1, mites from wave 2,
// brutes from wave 3, and a Dusk Herald boss on every 5th wave.
export function waveComposition(wave) {
  const list = [];
  const wisps = 4 + wave;
  const mites = wave >= 2 ? 1 + wave : 0;
  const brutes = wave >= 3 ? Math.floor(wave / 2) : 0;
  for (let i = 0; i < wisps; i++) list.push('wisp');
  for (let i = 0; i < mites; i++) list.push('mite');
  for (let i = 0; i < brutes; i++) list.push('brute');
  if (wave % 5 === 0) list.push('herald');
  return list;
}

export function wavePreview(wave) {
  const parts = [];
  if (wave % 5 === 0) parts.push('DUSK HERALD');
  if (wave >= 3) parts.push('brutes');
  if (wave >= 2) parts.push('mites');
  parts.push('wisps');
  return 'Wave ' + wave + ': ' + parts.join(' + ');
}

export function startWave(state, audio) {
  state.wave += 1;
  const comp = waveComposition(state.wave);
  // Shuffle the queue with the seeded stream so the order is fixed per seed.
  for (let i = comp.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng() * (i + 1));
    const tmp = comp[i];
    comp[i] = comp[j];
    comp[j] = tmp;
  }
  state.spawnQueue = comp;
  state.spawnTimer = 0.4;
  state.waveState = 'spawning';
  state.banner = 'WAVE ' + state.wave;
  state.bannerSub = state.wave % 5 === 0 ? 'THE DUSK HERALD COMES' : wavePreview(state.wave);
  state.bannerT = 0;
  state.bannerDur = 2.2;
  if (audio) audio.horn();
}

export function updateWaves(state, dt, audio) {
  if (state.mode !== 'playing') return;

  if (state.waveState === 'breather') {
    state.breather -= dt;
    if (state.breather <= 0) startWave(state, audio);
    return;
  }

  if (state.waveState === 'spawning') {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      // Spawn in small squads of 1-3 so the field fills steadily.
      const squad = Math.min(state.spawnQueue.length, 1 + Math.floor(state.rng() * 3));
      for (let i = 0; i < squad; i++) {
        telegraphSpawn(state, state.spawnQueue.shift());
      }
      state.spawnTimer = 0.85;
      if (state.spawnQueue.length === 0) state.waveState = 'fighting';
    }
  }

  // Wave clear: queue empty, telegraphs gone, field empty.
  if (
    state.waveState === 'fighting' &&
    state.spawnQueue.length === 0 &&
    state.telegraphs.length === 0 &&
    state.enemies.length === 0
  ) {
    const bonus = 250 * state.wave;
    state.score += bonus;
    state.player.hearts = Math.min(state.player.maxHearts, state.player.hearts + 1);
    addFloat(state, 640, 200, 'WAVE BONUS +' + bonus, '#ffd166');
    addFeed(state, 'Wave ' + state.wave + ' cleared  +' + bonus);
    burst(state, 640, 240, '#ffd166', 30, 320);
    if (audio) audio.horn();

    if (state.wave >= FINAL_WAVE) {
      state.mode = 'win';
      state.endScore = state.score;
      if (audio) audio.win();
      return;
    }
    state.waveState = 'breather';
    state.breather = BREATHER;
    state.banner = 'WAVE CLEARED';
    state.bannerSub = '+' + bonus + '  -  heart restored  -  next: ' + wavePreview(state.wave + 1);
    state.bannerT = 0;
    state.bannerDur = 3.0;
  }
}
