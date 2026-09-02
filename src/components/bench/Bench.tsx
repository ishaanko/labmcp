import { useEffect, useMemo } from "react";
import { useLabStore } from "@/store/labStore";
import type { Vec2 } from "@/engine";
import { makeBenchTileTexture, makeWallGradientTexture, resolveCssColor } from "@/scene/textures";

/**
 * The bench top IS the snap grid (C3.2): one world unit = one tile = one grid cell. Engine
 * positions are already grid coordinates, so world conversion is a direct axis swap with no
 * scaling: grid x -> world x, grid y (depth on the bench) -> world z.
 */
export function gridToWorld(pos: Vec2): readonly [number, number, number] {
  return [pos.x, 0, pos.y];
}

export function worldToGrid(x: number, z: number): Vec2 {
  return { x, y: z };
}

export const GRID_BOUNDS = { minX: -4.5, maxX: 3.5, minY: -1.5, maxY: 1.5 } as const;

interface BenchColors {
  readonly tile: string;
  readonly grout: string;
  readonly wall: string;
  readonly bg: string;
}

/** Reads the bench palette from CSS variables; fallbacks match the C1.1 tokens for the given theme. */
function readBenchColors(theme: "light" | "dark"): BenchColors {
  const dark = theme === "dark";
  return {
    tile: resolveCssColor("--bench-tile", dark ? "#2A2C31" : "#ECEAE4"),
    grout: resolveCssColor("--bench-grout", dark ? "#212327" : "#DCD9D1"),
    wall: resolveCssColor("--bench-wall", dark ? "#1C1E23" : "#E4E7EC"),
    bg: resolveCssColor("--bg", dark ? "#26282E" : "#F8F7F4"),
  };
}

export function Bench() {
  const theme = useLabStore((s) => s.ui.theme);
  // Bench colors come from CSS custom properties, so they are re-read (and the fog/textures
  // regenerated) whenever the theme changes (C9: "dark mode 3D mismatch").
  const colors = useMemo(() => readBenchColors(theme), [theme]);

  const tileTexture = useMemo(() => makeBenchTileTexture(colors.tile, colors.grout), [colors.tile, colors.grout]);
  const wallTexture = useMemo(() => makeWallGradientTexture(colors.wall, colors.bg), [colors.wall, colors.bg]);

  useEffect(() => {
    return () => {
      tileTexture.dispose();
      wallTexture.dispose();
    };
  }, [tileTexture, wallTexture]);

  return (
    <group>
      <fog attach="fog" args={[colors.bg, 11, 18]} />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial map={tileTexture} roughness={0.86} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[14, 0.5, 8]} />
        <meshStandardMaterial color={colors.tile} roughness={0.9} />
      </mesh>
      <mesh position={[0, 5.5, -4.5]}>
        <planeGeometry args={[30, 12]} />
        <meshBasicMaterial map={wallTexture} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}
