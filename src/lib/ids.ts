/** Monotonic id generator for feed entries. Store-local, not persisted, resets on reload. */
let counter = 0;

export function feedId(): string {
  counter += 1;
  return `f_${counter}`;
}
