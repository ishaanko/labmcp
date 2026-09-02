import * as THREE from "three";
import type { Rgba } from "@/engine";
import type { Rgba01 } from "./visualStore";

/** Converts the engine's 0-255 `Rgba` into the 0-1 `Rgba01` visualStore expects. */
export function rgbaToRgba01(c: Rgba): Rgba01 {
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

function toHexChannel(x: number): string {
  return Math.round(Math.min(255, Math.max(0, x)))
    .toString(16)
    .padStart(2, "0");
}

export function rgbaToHex(c: Rgba): string {
  return `#${toHexChannel(c.r)}${toHexChannel(c.g)}${toHexChannel(c.b)}`;
}

/**
 * Resolves a CSS custom property (hex or `oklch()`) to a `#rrggbb` string. The browser may report
 * the computed value as `lab()` or `oklch()`, which `THREE.Color` cannot parse, so the color is
 * painted into a 1x1 canvas and read back as bytes (C9: "dark mode 3D mismatch").
 */
export function resolveCssColor(varName: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const probe = document.createElement("div");
  probe.style.color = `var(${varName})`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved ? (cssColorToHex(resolved) ?? fallback) : fallback;
}

function cssColorToHex(css: string): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  if (r === undefined || g === undefined || b === undefined) return null;
  return rgbaToHex({ r, g, b, a: 1 });
}

function hexChannels(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Mixes `hex` toward white (`amount > 0`) or black (`amount < 0`), `amount` in [-1, 1]. Done on
 * the sRGB channels, not through THREE.Color (which lerps in linear space, so an 18% step toward
 * white on a near-black tile came back as a bright grey line).
 */
export function shadeHex(hex: string, amount: number): string {
  const t = Math.min(1, Math.abs(amount));
  const toward = amount >= 0 ? 255 : 0;
  const mixed = hexChannels(hex).map((v) => Math.round(v + (toward - v) * t));
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Perceived lightness of an sRGB hex, 0..1. */
function lightness(hex: string): number {
  const [r, g, b] = hexChannels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

const TILE_TEXTURE_SIZE = 256;

/**
 * Bench top tile texture (C3.2): one tile per texture (`texture.repeat` set by the caller to the
 * plane's world size, so one texture repeat is exactly one world unit and lines up with the snap
 * grid, whatever the plane's dimensions). A thicker grout line and a light/dark bevel stroke on
 * each tile's top-left/bottom-right edge read as ceramic rather than a flat grid. Regenerate on
 * theme change since the colors come from CSS.
 */
export function makeBenchTileTexture(tileColor: string, groutColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_TEXTURE_SIZE;
  canvas.height = TILE_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const grout = 10;
  ctx.fillStyle = shadeHex(groutColor, lightness(groutColor) < 0.25 ? -0.25 : -0.1);
  ctx.fillRect(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
  const inset = TILE_TEXTURE_SIZE - grout * 2;
  ctx.fillStyle = tileColor;
  ctx.fillRect(grout, grout, inset, inset);
  // Bevel contrast scales with the tile: a night bench gets a whisper of a highlight, not a rim.
  const dark = lightness(tileColor) < 0.25;
  ctx.strokeStyle = shadeHex(tileColor, dark ? 0.06 : 0.18);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(grout + 1.5, grout + inset);
  ctx.lineTo(grout + 1.5, grout + 1.5);
  ctx.lineTo(grout + inset, grout + 1.5);
  ctx.stroke();
  ctx.strokeStyle = shadeHex(tileColor, dark ? -0.3 : -0.14);
  ctx.beginPath();
  ctx.moveTo(grout + inset - 1.5, grout + 1.5);
  ctx.lineTo(grout + inset - 1.5, grout + inset - 1.5);
  ctx.lineTo(grout + 1.5, grout + inset - 1.5);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Vertical gradient for the back wall (C3.2), top to bottom. */
export function makeWallGradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  // Reach `bottom` (the bg color) before the bench line, so the wall meets the haze without a seam.
  gradient.addColorStop(0.8, bottom);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Radial soft dot for the steam sprites (C3.7). */
export function makeSteamSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Distance-haze overlay for the back strip of the bench floor (C3.2 "the horizon is soft, not a
 * hard line"): fully transparent at one edge, fading to solid `bg` at the other. Scene fog alone
 * barely shows on this locked, close-in camera (the tile's far edge and the equipment sit at
 * similar depth), so this bakes the same fade directly into an overlay plane instead.
 */
export function makeFloorHazeTexture(bg: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  // Raw sRGB channels: THREE.Color would hand back linear values here, which paints the wrong bg.
  const rgb = hexChannels(bg).join(",");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  // Fully opaque at the far edge, so the strip meets the wall (also painted bg) without a seam.
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(0.2, `rgba(${rgb},0.92)`);
  gradient.addColorStop(0.55, `rgba(${rgb},0.4)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

let contactShadowTexture: THREE.CanvasTexture | null = null;

/**
 * Shared radial-gradient sprite (C3.4: "a faint contact shadow disc under each vessel"), one
 * instance for the whole scene since every vessel just scales the same disc to its footprint.
 */
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTexture) return contactShadowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return (contactShadowTexture = new THREE.CanvasTexture(canvas));
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.34)");
  gradient.addColorStop(0.7, "rgba(0,0,0,0.16)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  contactShadowTexture = new THREE.CanvasTexture(canvas);
  return contactShadowTexture;
}

/** Alpha map for burette/cylinder graduation marks, drawn as thin horizontal ticks. */
export function makeGraduationTexture(divisions: number): THREE.CanvasTexture {
  const width = 64;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  for (let i = 0; i <= divisions; i++) {
    const y = height - (i / divisions) * height;
    const long = i % 5 === 0;
    ctx.globalAlpha = long ? 0.8 : 0.4;
    ctx.beginPath();
    ctx.moveTo(long ? width * 0.35 : width * 0.55, y);
    ctx.lineTo(width * 0.9, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
