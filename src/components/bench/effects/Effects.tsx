"use client";

import { useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { assertNever, type Container, type Instrument } from "@/engine";
import { listEffects, nowMs, pruneEffects, subscribeEffects, type Effect } from "@/scene/effectsStore";
import { HOTPLATE_TOP_Y, isOnHotplate } from "@/scene/layout";
import { profileForContainerType } from "@/scene/profiles";
import { useLabStore } from "@/store/labStore";
import { gridToWorld } from "@/components/bench/Bench";
import { Stream } from "./Stream";
import { Drop } from "./Drop";
import { Ripple } from "./Ripple";
import { Precipitate } from "./Precipitate";
import { Bubbles } from "./Bubbles";

function renderEffect(effect: Effect) {
  switch (effect.kind) {
    case "stream":
      return <Stream key={effect.id} effect={effect} />;
    case "drop":
      return <Drop key={effect.id} effect={effect} />;
    case "ripple":
      return <Ripple key={effect.id} effect={effect} />;
    default:
      return assertNever(effect);
  }
}

/**
 * Mounted once on the bench (C3.7): renders every active stream/drop/ripple from
 * `effectsStore`, plus one `Precipitate` and `Bubbles` instanced mesh per container. Pruning
 * expired transient effects runs inside `useFrame` against the store's plain array, not React
 * state; `useSyncExternalStore` only re-renders this component when the store notifies (an
 * effect spawned or expired), never on every frame's position update, which each effect
 * component drives itself via its own ref. `lab.objects` is read only for container membership
 * and pose (which container exists, where, on a hotplate or not); the per-frame precipitate
 * amount/settled and bubble intensity come straight from `visualStore` inside each child.
 */
export function Effects() {
  const effects = useSyncExternalStore(subscribeEffects, listEffects, listEffects);
  const objects = useLabStore((s) => s.lab.objects);
  useFrame(() => {
    pruneEffects(nowMs());
  });

  const containers = objects.filter((o): o is Container => o.kind === "container");
  const hotplates = objects.filter((o): o is Instrument => o.kind === "instrument" && o.type === "hotplate");

  return (
    <group>
      {effects.map(renderEffect)}
      {containers.map((container) => {
        const [x, , z] = gridToWorld(container.position);
        const origin: readonly [number, number, number] = [x, isOnHotplate(container, hotplates) ? HOTPLATE_TOP_Y : 0, z];
        const profile = profileForContainerType(container.type);
        return (
          <group key={container.id}>
            <Precipitate containerId={container.id} profile={profile} origin={origin} />
            <Bubbles containerId={container.id} profile={profile} origin={origin} />
          </group>
        );
      })}
    </group>
  );
}
