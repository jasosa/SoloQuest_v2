/**
 * Seeded random numbers (mulberry32). The state is one plain number that lives inside GameState,
 * so replaying the same events gives the same results. Never use Math.random in the engine.
 */
export type Rng = number;

export function createRng(seed: number): Rng {
  return seed >>> 0;
}

/** Next value in [0, 1) and the new rng state. */
export function next(rng: Rng): [value: number, rng: Rng] {
  const state = (rng + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, state];
}

/** Integer in [0, n). */
export function nextInt(rng: Rng, n: number): [value: number, rng: Rng] {
  const [v, r] = next(rng);
  return [Math.floor(v * n), r];
}
