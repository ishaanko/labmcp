import type { RngState } from "./types";

/** mulberry32. Every call returns the next state; callers thread it through. */
export function seedRng(seed: number): RngState {
  return { seed, s: seed >>> 0 };
}

export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  const t = (rng.s + 0x6d2b79f5) >>> 0;
  let x = Math.imul(t ^ (t >>> 15), 1 | t);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  const value = ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { seed: rng.seed, s: t } };
}

export function nextInt(rng: RngState, n: number): { value: number; rng: RngState } {
  const r = nextFloat(rng);
  return { value: Math.floor(r.value * n), rng: r.rng };
}

export function shuffle<T>(rng: RngState, items: ReadonlyArray<T>): { value: T[]; rng: RngState } {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextInt(state, i + 1);
    state = r.rng;
    const j = r.value;
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return { value: out, rng: state };
}
