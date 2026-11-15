// Seeded random numbers for LUMEN KEEP.
//
// Every random choice in the game comes from a function in this file, so
// a fixed seed always replays the same arena, the same wave spawns and
// the same screenshot scenes. Gameplay never calls Math.random.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A number in [min, max) from the seeded stream.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// A whole number in [min, max] from the seeded stream.
export function rangeInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One entry of a list, chosen by the seeded stream.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// True with probability p (0..1) from the seeded stream.
export function chance(rng, p) {
  return rng() < p;
}
