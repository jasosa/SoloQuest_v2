/** Pure sub-seeds for Zargon's orders. Never touches `state.rng`. */
import { createRng, next, type Rng } from '../game/rng';

/** 32-bit FNV-1a over the parts, then a murmur finalizer so close inputs spread out. */
export function hashParts(...parts: readonly (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function rngFor(...parts: readonly (string | number)[]): Rng {
  return createRng(hashParts(...parts));
}

/** Seeded Fisher-Yates. Returns a new array. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [v, n] = next(r);
    r = n;
    const j = Math.floor(v * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
