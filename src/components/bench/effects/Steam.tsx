import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeSteamSpriteTexture } from "@/scene/textures";
import { visualFor } from "@/scene/visualStore";
import { useLabStore } from "@/store/labStore";

export interface SteamProps {
  /** The heated container this steam rises from; drives opacity via its displayed temperature. */
  readonly containerId: string;
  /** World-space origin at roughly the liquid surface. */
  readonly origin: readonly [number, number, number];
}

const COUNT = 4;
const RISE_HEIGHT = 0.9;
const CYCLE_S = 2.2;
const MAX_OPACITY = 0.28;
const REDUCED_HEIGHT = RISE_HEIGHT * 0.5;
const REDUCED_SCALE = 0.5;

/** Rising steam sprites above a heated vessel (C3.7): frozen and dim under reduced motion. */
export function Steam({ containerId, origin }: SteamProps) {
  const spriteRefs = useRef<Array<THREE.Sprite | null>>([]);
  const reducedMotion = useLabStore((s) => s.ui.reducedMotion);
  const texture = useMemo(() => makeSteamSpriteTexture(), []);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    const tempC = visualFor(containerId).temperatureC;
    const peakOpacity = MAX_OPACITY * THREE.MathUtils.smoothstep(tempC, 55, 100);

    for (let i = 0; i < COUNT; i++) {
      const sprite = spriteRefs.current[i];
      if (!sprite) continue;
      const material = sprite.material;

      if (reducedMotion) {
        sprite.position.set((i - 1.5) * 0.03, REDUCED_HEIGHT, 0);
        sprite.scale.setScalar(REDUCED_SCALE);
        material.opacity = peakOpacity * 0.5;
        continue;
      }

      const phase = (clock.elapsedTime / CYCLE_S + i / COUNT) % 1;
      sprite.position.set((i - 1.5) * 0.03, phase * RISE_HEIGHT, 0);
      sprite.scale.setScalar(THREE.MathUtils.lerp(0.3, 0.7, phase));
      material.opacity = peakOpacity * Math.sin(Math.PI * phase);
    }
  });

  return (
    <group position={origin}>
      {Array.from({ length: COUNT }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            spriteRefs.current[i] = el;
          }}
          scale={0.3}
        >
          <spriteMaterial map={texture} transparent depthWrite={false} opacity={0} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}
