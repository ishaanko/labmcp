/** Display formatting shared by the feed, notebook, and tool summaries. */

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function fmtMl(x: number): string {
  return `${round2(x)} mL`;
}

export function fmtC(x: number): string {
  return `${round2(x)}°C`;
}

export function fmtPh(x: number): string {
  return `pH ${round2(x)}`;
}
