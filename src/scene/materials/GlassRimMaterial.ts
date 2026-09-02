import * as THREE from "three";
import { extend, type ThreeElement } from "@react-three/fiber";

/**
 * Cheap fresnel glass (C3.4): rendered twice per vessel (BackSide dim, FrontSide bright), no
 * transmission pass. Alpha ramps from `uBaseAlpha` at normal incidence to `uRimAlpha` at
 * grazing angles; a small specular term catches the key light.
 */
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTint;
  uniform vec3 uRim;
  uniform vec3 uLightDir;
  uniform float uBaseAlpha;
  uniform float uRimAlpha;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);
    float f = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    vec3 spec = vec3(pow(max(dot(reflect(-uLightDir, normal), viewDir), 0.0), 60.0)) * 0.85;
    vec3 col = mix(uTint, uRim, f) + spec;
    float a = uBaseAlpha + (uRimAlpha - uBaseAlpha) * f;
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

export interface GlassRimMaterialUniforms {
  [uniform: string]: THREE.IUniform;
  uTint: THREE.IUniform<THREE.Color>;
  uRim: THREE.IUniform<THREE.Color>;
  uLightDir: THREE.IUniform<THREE.Vector3>;
  uBaseAlpha: THREE.IUniform<number>;
  uRimAlpha: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
}

export class GlassRimMaterial extends THREE.ShaderMaterial {
  declare uniforms: GlassRimMaterialUniforms;

  constructor(baseAlpha = 0.08, rimAlpha = 0.68) {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTint: { value: new THREE.Color("#cfe0f2") },
        uRim: { value: new THREE.Color("#eef6ff") },
        uLightDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
        uBaseAlpha: { value: baseAlpha },
        uRimAlpha: { value: rimAlpha },
        uOpacity: { value: 1 },
      },
    });
  }
}

extend({ GlassRimMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    glassRimMaterial: ThreeElement<typeof GlassRimMaterial>;
  }
}
