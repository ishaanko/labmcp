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

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT: Readonly<Record<string, string>> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };

/**
 * Species id to display formula: "SO4^2-" -> "SO₄²⁻", "Cu2+" -> "Cu²⁺", "NO3-" -> "NO₃⁻",
 * "Cu(OH)2(s)" -> "Cu(OH)₂(s)". A "^" marks an explicit charge magnitude; without one, a digit
 * before "+" is a cation's charge and a digit before "-" is an anion's subscript, which is how
 * `engine/species.ts` writes its ids.
 */
export function formatFormula(id: string): string {
  const split = /^(.*)\^(\d*)([+-])$/.exec(id) ?? /^(.*?)(\d*)(\+)$/.exec(id) ?? /^(.*)()(-)$/.exec(id);
  const body = split ? (split[1] ?? "") : id;
  const charge = split ? `${split[2] ?? ""}${split[3] ?? ""}` : "";
  const subscripted = body.replace(/(?<=[A-Za-z)])\d+/g, (digits) => [...digits].map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d).join(""));
  return subscripted + [...charge].map((c) => SUPERSCRIPT[c] ?? c).join("");
}
