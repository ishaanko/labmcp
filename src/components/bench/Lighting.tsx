import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import type * as THREE from "three";
import { damp } from "maath/easing";
import { useLabStore } from "@/store/labStore";

/**
 * Fixed lighting rig (C3.3): Lightformers only (no HDR fetch) plus a key/rim/hemisphere set.
 * Dark mode is a lab at night: a dimmer, cooler key light and a near-black hemisphere floor
 * (light mode's warm hemisphere ground bounce reads as daylight fill, which flattens a dark
 * bench back toward grey). Only the key light's intensity damps on a theme switch (~0.3s); its
 * color and the Lightformer/hemisphere swaps are instant since theme toggles are rare.
 */
const THEME = {
  light: { keyIntensity: 1.3, keyColor: "#fbfaf7", topColor: "#eef2f7", hemiSky: "#e8eef8", hemiGround: "#d8d3c8", hemiIntensity: 0.35 },
  dark: { keyIntensity: 1.5, keyColor: "#d7e3f5", topColor: "#b9c3d3", hemiSky: "#3a4252", hemiGround: "#0a0a0c", hemiIntensity: 0.22 },
} as const;

export function Lighting() {
  const theme = useLabStore((s) => s.ui.theme);
  const keyRef = useRef<THREE.DirectionalLight>(null);

  useFrame((_state, dt) => {
    const key = keyRef.current;
    if (!key) return;
    const intensity = { v: key.intensity };
    damp(intensity, "v", THEME[theme].keyIntensity, 0.3, dt);
    key.intensity = intensity.v;
  });

  return (
    <>
      <directionalLight
        ref={keyRef}
        position={[3, 8, 4]}
        color={THEME[theme].keyColor}
        intensity={THEME.light.keyIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-4, 5, -6]} color="#cfe0ff" intensity={0.8} />
      <hemisphereLight args={[THEME[theme].hemiSky, THEME[theme].hemiGround, THEME[theme].hemiIntensity]} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" position={[0, 6, 0]} scale={[6, 6, 1]} intensity={2.2} color={THEME[theme].topColor} target={[0, 0, 0]} />
        <Lightformer form="rect" position={[8, 3, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} intensity={1.0} color="#ffffff" />
        <Lightformer form="rect" position={[-6, 2, -4]} rotation={[0, Math.PI / 3, 0]} scale={[3, 3, 1]} intensity={0.6} color="#ffe9d2" />
      </Environment>
    </>
  );
}
