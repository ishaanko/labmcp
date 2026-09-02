import * as THREE from "three";
import { extend, type ThreeElement } from "@react-three/fiber";

/**
 * The liquid body and its meniscus disc share one shader (C3.6). `uMeniscus` toggles between
 * the two modes: body space discards everything above `uFill` and clouds/darkens the fill;
 * meniscus mode skips the discard and instead dips + swirls the disc surface and brightens its
 * rim, so the same material serves both meshes with one extra flag.
 */
const vertexShader = /* glsl */ `
  uniform float uStir;
  uniform float uMeniscus;
  varying vec3 vLocalPos;
  varying float vRadius;
  void main() {
    vLocalPos = position;
    vRadius = length(position.xz);
    vec3 pos = position;
    if (uMeniscus > 0.5) {
      float r = clamp(vRadius, 0.0, 1.0);
      pos.y -= uStir * 0.08 * (1.0 - r);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFill;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uCloud;
  uniform vec3 uCloudColor;
  uniform float uTime;
  uniform float uStir;
  uniform float uMeniscus;
  varying vec3 vLocalPos;
  varying float vRadius;

  void main() {
    if (uMeniscus < 0.5 && vLocalPos.y > uFill) discard;

    vec3 col = mix(uColor, uCloudColor, uCloud);
    float darken = uMeniscus < 0.5 ? smoothstep(0.0, 0.15, uFill - vLocalPos.y) * 0.08 : 0.0;
    col *= (1.0 - darken);

    float a = max(uAlpha, 0.32);
    if (uMeniscus > 0.5) {
      a += 0.15;
      float edge = smoothstep(0.94, 1.0, vRadius);
      col = mix(col, vec3(1.0), edge * 0.3);
      float swirl = sin(atan(vLocalPos.y, vLocalPos.x) * 3.0 - vRadius * 7.0 + uTime * uStir * 6.0);
      col += swirl * 0.12 * uStir;
    }
    gl_FragColor = vec4(col, a);
  }
`;

export interface LiquidMaterialUniforms {
  [uniform: string]: THREE.IUniform;
  uFill: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
  uAlpha: THREE.IUniform<number>;
  uCloud: THREE.IUniform<number>;
  uCloudColor: THREE.IUniform<THREE.Color>;
  uTime: THREE.IUniform<number>;
  uStir: THREE.IUniform<number>;
  uMeniscus: THREE.IUniform<number>;
}

export class LiquidMaterial extends THREE.ShaderMaterial {
  declare uniforms: LiquidMaterialUniforms;

  constructor(meniscus = false) {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      uniforms: {
        uFill: { value: 0 },
        uColor: { value: new THREE.Color("#bed6e8") },
        uAlpha: { value: 0.35 },
        uCloud: { value: 0 },
        uCloudColor: { value: new THREE.Color("#f4f2ee") },
        uTime: { value: 0 },
        uStir: { value: 0 },
        uMeniscus: { value: meniscus ? 1 : 0 },
      },
    });
  }
}

extend({ LiquidMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    liquidMaterial: ThreeElement<typeof LiquidMaterial>;
  }
}
