/**
 * Deterministic scene randomness. Every particle system (precipitate, bubbles) seeds its layout
 * from the container id through `hashId`, then draws from `makeRng`, so a vessel's particles hold
 * their positions across re-renders instead of reshuffling every mount.
 */

/** mulberry32 PRNG, seeded once, called for a stream of floats in [0, 1). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small string hash (djb2-ish), for turning an object id into a `makeRng` seed. */
export function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}
