import * as THREE from "three";
import { raycastGroundPlane } from "./picking";

/**
 * Module-level handle onto the live R3F canvas, set once by `LabCanvas` (inside `<Canvas>`, the
 * only place `useThree` works) and read from anywhere else: chrome components that need to
 * raycast or project bench positions without themselves living inside the Canvas tree
 * (`DragController`, popovers anchored to a vessel, keyboard shortcuts). Mirrors the
 * `visualStore` pattern: plain module state, no React context indirection.
 */
export interface SceneSize {
  readonly width: number;
  readonly height: number;
}

interface SceneRefsState {
  readonly camera: THREE.Camera;
  readonly scene: THREE.Scene;
  readonly domElement: HTMLElement;
  readonly size: SceneSize;
}

let refs: SceneRefsState | null = null;
let frame = 0;

export function setSceneRefs(next: SceneRefsState | null): void {
  refs = next;
  boundsCache.clear();
}

/** Bumps the per-frame cache generation for `projectObjectBounds`; called once per tick by `DragController`. */
export function bumpFrame(): void {
  frame += 1;
}

const raycaster = new THREE.Raycaster();

function clientToNdc(clientX: number, clientY: number, domElement: HTMLElement): THREE.Vector2 {
  const rect = domElement.getBoundingClientRect();
  return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
}

/** Walks up from a raycast hit to the nearest ancestor carrying `userData.objectId`. */
function objectIdOf(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const id: unknown = current.userData.objectId;
    if (typeof id === "string") return id;
    current = current.parent;
  }
  return null;
}

/**
 * Raycasts from a client pointer position against every mesh in the scene carrying
 * `userData.objectId` (the invisible hit volumes in `Vessel.tsx` and the instrument groups),
 * returning the closest one. `excludeId` skips a specific object (typically the one already
 * being dragged, which would otherwise always win since it tracks the pointer 1:1).
 */
export function pickObjectAt(clientX: number, clientY: number, excludeId?: string): string | null {
  if (!refs) return null;
  const ndc = clientToNdc(clientX, clientY, refs.domElement);
  raycaster.setFromCamera(ndc, refs.camera);
  const hits = raycaster.intersectObjects(refs.scene.children, true);
  for (const hit of hits) {
    const id = objectIdOf(hit.object);
    if (id && id !== excludeId) return id;
  }
  return null;
}

export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * Raycasts from a client pointer position onto the bench's ground plane (y = 0), in world
 * units. Callers convert to grid cells themselves via `Bench.worldToGrid`, since a raw ground
 * point is also what a live drag needs for its 1:1 world-space tracking before any snapping.
 */
export function groundPointAt(clientX: number, clientY: number): WorldPoint | null {
  if (!refs) return null;
  const ndc = clientToNdc(clientX, clientY, refs.domElement);
  const hit = raycastGroundPlane(refs.camera, ndc);
  return hit ? { x: hit.x, z: hit.z } : null;
}

const boundsCache = new Map<string, DOMRect | null>();
let boundsCacheFrame = -1;

/**
 * Projects an object's world-space bounding box (its registered hit volume, or its whole group
 * for instruments) to a client-space `DOMRect`, for anchoring popovers. Cached for the current
 * frame (bumped by `DragController`'s `useFrame`) since a popover and its trigger can both ask
 * in the same tick.
 */
export function projectObjectBounds(objectId: string): DOMRect | null {
  if (!refs) return null;
  if (boundsCacheFrame !== frame) {
    boundsCache.clear();
    boundsCacheFrame = frame;
  }
  const cached = boundsCache.get(objectId);
  if (cached !== undefined) return cached;

  const object = findObjectById(refs.scene, objectId);
  const rect = object ? projectBox(object, refs.camera, refs.domElement) : null;
  boundsCache.set(objectId, rect);
  return rect;
}

function findObjectById(root: THREE.Object3D, objectId: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (!found && child.userData.objectId === objectId) found = child;
  });
  return found;
}

const CORNER_SIGNS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];

function projectBox(object: THREE.Object3D, camera: THREE.Camera, domElement: HTMLElement): DOMRect | null {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const rect = domElement.getBoundingClientRect();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const point = new THREE.Vector3();
  for (const [sx, sy, sz] of CORNER_SIGNS) {
    point.set(center.x + half.x * sx, center.y + half.y * sy, center.z + half.z * sz).project(camera);
    const cx = rect.left + ((point.x + 1) / 2) * rect.width;
    const cy = rect.top + ((1 - point.y) / 2) * rect.height;
    minX = Math.min(minX, cx);
    maxX = Math.max(maxX, cx);
    minY = Math.min(minY, cy);
    maxY = Math.max(maxY, cy);
  }
  return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}
