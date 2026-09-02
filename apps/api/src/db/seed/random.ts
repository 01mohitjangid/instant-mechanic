/**
 * Deterministic randomness for seeding.
 *
 * A fixed seed means `npm run db:seed` produces the *same* dataset every time,
 * so screenshots, demos and bug reports stay reproducible. Change SEED to get a
 * different-but-still-repeatable dataset.
 */

const SEED = 20260901;

/** mulberry32 — tiny, fast, good enough for fake data. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(SEED);

/** Random float in [min, max). */
export function randFloat(min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Random integer in [min, max] — both ends included. */
export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}

/** True with the given probability (0–1). */
export function chance(probability: number): boolean {
  return rng() < probability;
}

/** Pick one element. The array must not be empty. */
export function pick<T>(items: readonly T[]): T {
  const item = items[randInt(0, items.length - 1)];
  if (item === undefined) {
    throw new Error('pick() called with an empty array');
  }
  return item;
}

/** Pick one element using relative weights, e.g. [['a', 3], ['b', 1]]. */
export function pickWeighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = randFloat(0, total);
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  const last = entries[entries.length - 1];
  if (!last) throw new Error('pickWeighted() called with no entries');
  return last[0];
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Shift a date by a number of milliseconds. */
export function shift(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/** Round to 2 decimal places, returned as a string for NUMERIC columns. */
export function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
