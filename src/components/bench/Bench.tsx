import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { useLabStore } from "@/store/labStore";
import type { Vec2 } from "@/engine";
import { makeBenchTileTexture, makeFloorHazeTexture, makeWallGradientTexture, resolveCssColor } from "@/scene/textures";

/**
 * One grid cell is one world unit (C3.2: "the tile grid IS the snap grid"). Engine positions are
 * grid coordinates; world conversion is a direct axis swap: grid x -> world x, grid y (depth on
 * the bench) -> world z.
 */
export const GRID_SCALE = 1;

// Sized to the usable grid (x -4.5..3.5, y -1.5..1.5) plus a small margin, not a game-floor slab
// stretching past the equipment (scene-composition review).
const BENCH_WIDTH = 10;
const BENCH_DEPTH = 5;
/** One physical tile is half a grid cell, so the surface reads as ceramic, not the snap grid itself. */
const TILE_SIZE = 0.5;
const WALL_Z = -BENCH_DEPTH / 2 - 0.05;
// Back strip beyond the usable grid (y < -1.5) where the haze overlay fades the tile toward `bg`.
const HAZE_DEPTH = 1.0;
const HAZE_CENTER_Z = -BENCH_DEPTH / 2 + HAZE_DEPTH / 2;

export function gridToWorld(pos: Vec2): readonly [number, number, number] {
  return [pos.x * GRID_SCALE, 0, pos.y * GRID_SCALE];
}

export function worldToGrid(x: number, z: number): Vec2 {
  return { x: x / GRID_SCALE, y: z / GRID_SCALE };
}

export const GRID_BOUNDS = { minX: -4.5, maxX: 3.5, minY: -1.5, maxY: 1.5 } as const;

interface BenchColors {
  readonly tile: string;
  readonly grout: string;
  readonly wall: string;
  readonly bg: string;
}

/**
 * Reads the bench palette from CSS variables; fallbacks match the C1.1 tokens for the given
 * theme. Dark mode's fallbacks are a matte near-black lab bench (tile darker than grout, low
 * contrast between them) rather than a derived shade of the light palette, so the surface reads
 * as ceramic at night instead of a muted grey game floor (C9, scene-composition review).
 */
function readBenchColors(theme: "light" | "dark"): BenchColors {
  const dark = theme === "dark";
  return {
    tile: resolveCssColor("--bench-tile", dark ? "#0c0c0e" : "#ECEAE4"),
    grout: resolveCssColor("--bench-grout", dark ? "#17171a" : "#DCD9D1"),
    wall: resolveCssColor("--bench-wall", dark ? "#050506" : "#E4E7EC"),
    bg: resolveCssColor("--bg", dark ? "#000000" : "#F8F7F4"),
  };
}

export function Bench() {
  const theme = useLabStore((s) => s.ui.theme);
  // Bench colors come from CSS custom properties, so they are re-read (and the fog/textures
  // regenerated) whenever the theme changes (C9: "dark mode 3D mismatch").
  const colors = useMemo(() => readBenchColors(theme), [theme]);

  const tileTexture = useMemo(() => {
    const texture = makeBenchTileTexture(colors.tile, colors.grout);
    // One texture repeat is one `TILE_SIZE` tile, so it repeats exactly across the plane.
    texture.repeat.set(BENCH_WIDTH / TILE_SIZE, BENCH_DEPTH / TILE_SIZE);
    return texture;
  }, [colors.tile, colors.grout]);
  const wallTexture = useMemo(() => makeWallGradientTexture(colors.wall, colors.bg), [colors.wall, colors.bg]);
  const hazeTexture = useMemo(() => makeFloorHazeTexture(colors.bg), [colors.bg]);

  useEffect(() => {
    return () => {
      tileTexture.dispose();
      wallTexture.dispose();
      hazeTexture.dispose();
    };
  }, [tileTexture, wallTexture, hazeTexture]);

  return (
    <group>
      <fog attach="fog" args={[colors.bg, 9, 12.5]} />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BENCH_WIDTH, BENCH_DEPTH]} />
        <meshStandardMaterial map={tileTexture} roughness={0.82} />
      </mesh>
      {/* Front edge/body (C9): a rounded box, not a hard slab, so the bench reads as a physical
          counter with a bevel catching the key light along its top edge. */}
      <RoundedBox args={[BENCH_WIDTH, 0.5, BENCH_DEPTH]} radius={0.05} smoothness={2} position={[0, -0.25, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={colors.tile} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 4, WALL_Z]}>
        <planeGeometry args={[30, 10]} />
        <meshBasicMaterial map={wallTexture} toneMapped={false} fog={false} />
      </mesh>
      {/* Distance haze (C3.2 "horizon soft, not a hard line"): fades the tile's back strip, past
          the usable grid, toward `bg` so it does not cut off abruptly against the wall plane. */}
      <mesh position={[0, 0.003, HAZE_CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[BENCH_WIDTH, HAZE_DEPTH]} />
        <meshBasicMaterial map={hazeTexture} transparent depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}
