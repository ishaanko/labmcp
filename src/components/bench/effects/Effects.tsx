"use client";

import { useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { assertNever } from "@/engine";
import { listEffects, nowMs, pruneEffects, subscribeEffects, type Effect } from "@/scene/effectsStore";
import { Stream } from "./Stream";
import { Drop } from "./Drop";
import { Ripple } from "./Ripple";

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
 * `effectsStore`. Pruning expired effects runs inside `useFrame` against the store's plain
 * array, not React state; `useSyncExternalStore` only re-renders this component when the
 * store notifies (an effect spawned or expired), never on every frame's position update, which
 * each effect component drives itself via its own ref.
 */
export function Effects() {
  const effects = useSyncExternalStore(subscribeEffects, listEffects, listEffects);
  useFrame(() => {
    pruneEffects(nowMs());
  });
  return <group>{effects.map(renderEffect)}</group>;
}
