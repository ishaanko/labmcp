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

const TILE_PX_PER_UNIT = 128;
const TILE_TEXTURE_SIZE = 1024;

/**
 * Bench top tile texture (C3.2): a grout grid at `TILE_PX_PER_UNIT` px per world unit, so one
 * tile is one snap cell. Regenerate on theme change since the colors come from CSS.
 */
export function makeBenchTileTexture(tileColor: string, groutColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_TEXTURE_SIZE;
  canvas.height = TILE_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = groutColor;
  ctx.fillRect(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
  ctx.fillStyle = tileColor;
  const grout = 3;
  for (let y = 0; y < TILE_TEXTURE_SIZE; y += TILE_PX_PER_UNIT) {
    for (let x = 0; x < TILE_TEXTURE_SIZE; x += TILE_PX_PER_UNIT) {
      ctx.fillRect(x + grout, y + grout, TILE_PX_PER_UNIT - grout * 2, TILE_PX_PER_UNIT - grout * 2);
    }
  }
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
