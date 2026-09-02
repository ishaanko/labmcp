import { create } from "zustand";
import type { Container, LabState } from "@/engine";
import { setAnimationSink, type AnimationBatch } from "@/lib/events";
import { useLabStore } from "@/store/labStore";
import { selectLastAgentTarget, type AgentTarget } from "@/store/selectors";

/**
 * Bench 2D's transient visual effects: pours, tilts, endpoint pulses, and agent-presence glow.
 * Fed by two sources, both wired once via `attachEffectsSink`: `setAnimationSink` (committed
 * engine events, for pours/tilts/pulses) and the store's `selectLastAgentTarget` (for the
 * agent-active glow and marker, already computed from the feed by the store lane).
 *
 * Effects are timed sets/lists here; the actual motion (path draw, drop fall, scale pulse) lives
 * in `effects/*.tsx`, which only read this store and never touch the animation sink themselves.
 */

export interface PourEffect {
  readonly id: string;
  readonly kind: "stream" | "drop";
  readonly sourceId: string;
  readonly targetId: string;
}

interface EffectsStoreState {
  readonly pours: ReadonlyArray<PourEffect>;
  readonly tiltIds: ReadonlySet<string>;
  readonly pulseIds: ReadonlySet<string>;
  readonly agentActiveIds: ReadonlySet<string>;
  addPour(effect: PourEffect): void;
  removePour(id: string): void;
  addTilt(id: string): void;
  removeTilt(id: string): void;
  addPulse(id: string): void;
  removePulse(id: string): void;
  addAgentActive(id: string): void;
  removeAgentActive(id: string): void;
}

/** Adds `id` to a `Set`-valued slice, replacing the set only when `id` is new. */
function withAdded(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (set.has(id)) return set;
  const next = new Set(set);
  next.add(id);
  return next;
}

/** Removes `id` from a `Set`-valued slice, replacing the set only when `id` was present. */
function withRemoved(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

export const useEffectsStore = create<EffectsStoreState>((set) => ({
  pours: [],
  tiltIds: new Set(),
  pulseIds: new Set(),
  agentActiveIds: new Set(),
  addPour: (effect) => set((s) => ({ pours: [...s.pours, effect] })),
  removePour: (id) => set((s) => ({ pours: s.pours.filter((p) => p.id !== id) })),
  addTilt: (id) => set((s) => ({ tiltIds: withAdded(s.tiltIds, id) })),
  removeTilt: (id) => set((s) => ({ tiltIds: withRemoved(s.tiltIds, id) })),
  addPulse: (id) => set((s) => ({ pulseIds: withAdded(s.pulseIds, id) })),
  removePulse: (id) => set((s) => ({ pulseIds: withRemoved(s.pulseIds, id) })),
  addAgentActive: (id) => set((s) => ({ agentActiveIds: withAdded(s.agentActiveIds, id) })),
  removeAgentActive: (id) => set((s) => ({ agentActiveIds: withRemoved(s.agentActiveIds, id) })),
}));

// Draw (240ms) + fade (160ms) for a pour stream; fall (160ms) + ripple (160ms) for a burette drop.
const STREAM_LIFETIME_MS = 400;
const DROP_LIFETIME_MS = 320;
const TILT_MS = 400;
const PULSE_MS = 800;
const AGENT_ACTIVE_MS = 1600;

let effectSeq = 0;
function nextEffectId(): string {
  effectSeq += 1;
  return `fx_${effectSeq}`;
}

function findContainer(state: LabState, id: string): Container | undefined {
  const obj = state.objects.find((o) => o.id === id);
  return obj && obj.kind === "container" ? obj : undefined;
}

/** A burette's LIQUID_TRANSFERRED reads as a falling drop; every other pour reads as a stream. */
function handleLiquidTransferred(prev: LabState, fromId: string, toId: string): void {
  const source = findContainer(prev, fromId);
  const isDrop = source?.type === "burette";
  const id = nextEffectId();
  const store = useEffectsStore.getState();
  store.addPour({ id, kind: isDrop ? "drop" : "stream", sourceId: fromId, targetId: toId });
  window.setTimeout(() => useEffectsStore.getState().removePour(id), isDrop ? DROP_LIFETIME_MS : STREAM_LIFETIME_MS);
  if (!isDrop) {
    store.addTilt(fromId);
    window.setTimeout(() => useEffectsStore.getState().removeTilt(fromId), TILT_MS);
  }
}

function handleAnimationBatch(batch: AnimationBatch): void {
  if (useLabStore.getState().ui.reducedMotion) return;
  for (const observation of batch.events) {
    const event = observation.event;
    if (event.kind === "LIQUID_TRANSFERRED") {
      handleLiquidTransferred(batch.prev, event.fromId, event.toId);
    } else if (event.kind === "COLOR_SHIFT" && event.indicatorTransition) {
      const store = useEffectsStore.getState();
      store.addPulse(event.containerId);
      window.setTimeout(() => useEffectsStore.getState().removePulse(event.containerId), PULSE_MS);
    }
  }
}

const agentActiveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function handleAgentTarget(target: AgentTarget | null): void {
  if (!target) return;
  const { targetId } = target;
  useEffectsStore.getState().addAgentActive(targetId);
  const existing = agentActiveTimers.get(targetId);
  if (existing !== undefined) clearTimeout(existing);
  agentActiveTimers.set(
    targetId,
    setTimeout(() => {
      useEffectsStore.getState().removeAgentActive(targetId);
      agentActiveTimers.delete(targetId);
    }, AGENT_ACTIVE_MS),
  );
}

let attached = false;

/** Wires the effects store to the store's animation sink and agent-target selector. Idempotent. */
export function attachEffectsSink(): void {
  if (attached) return;
  attached = true;
  setAnimationSink(handleAnimationBatch);
  useLabStore.subscribe(selectLastAgentTarget, handleAgentTarget);
}
