import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyCommand, describeError, loadScenario, publicView, type Actor, type LabCommand, type LabState } from "@/engine";
import { describeCommand, emitAnimation, emitToast, eventsToMeasurements, eventsToToasts, summarizeEvents, targetOfCommand } from "@/lib/events";
import { feedId } from "@/lib/ids";
import { labelLookup } from "@/lib/labels";
import { enqueue } from "./commandQueue";
import type { DispatchResult, FeedEntry, LabStore, UiState } from "./types";

const DEMO_SEED = 42;
const FEED_CAP = 300;

function initialLab(): LabState {
  return loadScenario("titration", DEMO_SEED);
}

function initialUi(): UiState {
  return {
    selectedId: null,
    lastSelectedContainerId: null,
    hoveredId: null,
    drag: null,
    dialog: null,
    reducedMotion: false,
    devConsoleOpen: false,
    activityOpen: false,
    explainOpen: false,
    agentPanelOpen: false,
    dispenseIncrementMl: 1,
    webmcp: { provider: "none", toolCount: 0 },
    theme: "dark",
  };
}

function noteEntry(text: string): FeedEntry {
  return { id: feedId(), ts: performance.now(), source: "system", kind: "note", text };
}

/**
 * `Partial<FeedEntry>` only widens the keys common to every feed kind, so a straight
 * `{ ...entry, ...patch }` loses the specific member type. Object.assign keeps it: the result is
 * `T & Partial<FeedEntry>`, a strict subtype of the original entry's own member type T.
 */
function mergeFeed<T extends FeedEntry>(entry: T, patch: Partial<FeedEntry>): T {
  return Object.assign({}, entry, patch);
}

const isResetCommand = (command: LabCommand): command is Extract<LabCommand, { kind: "RESET" | "LOAD_SCENARIO" }> =>
  command.kind === "RESET" || command.kind === "LOAD_SCENARIO";

function resetNoteText(command: Extract<LabCommand, { kind: "RESET" | "LOAD_SCENARIO" }>, next: LabState): string {
  return command.kind === "LOAD_SCENARIO" ? `Loaded ${command.scenarioId} scenario.` : `Reset ${next.scenario.kind} scenario.`;
}

export const useLabStore = create<LabStore>()(
  subscribeWithSelector((set, get) => ({
    lab: initialLab(),
    stateVersion: 0,
    ui: initialUi(),
    feed: [noteEntry("Lab ready.")],
    agentBusy: false,

    dispatch(command: LabCommand, actor: Actor): Promise<DispatchResult> {
      return enqueue(() => {
        const prev = get().lab;
        const res = applyCommand(prev, command, actor);

        if (!res.ok) {
          const observation = describeError(res.error, labelLookup(prev));
          if (actor === "human") {
            emitToast({ kind: "error", title: observation });
            get().pushFeed({
              id: feedId(),
              ts: performance.now(),
              source: "human",
              kind: "action",
              commandKind: command.kind,
              label: describeCommand(command, prev),
              ok: false,
              observation,
              errorKind: res.error.kind,
              targetId: targetOfCommand(command),
            });
          }
          return { ok: false, stateVersion: get().stateVersion, error: res.error, observation };
        }

        const { state: next, events, historyEntry } = res.value;
        const version = get().stateVersion + 1;
        const observation = summarizeEvents(publicView(next), events, command.kind === "REMOVE_OBJECT" ? labelLookup(prev) : undefined);
        const reset = isResetCommand(command);

        set((s) => ({
          lab: next,
          stateVersion: version,
          feed: reset ? [noteEntry(resetNoteText(command, next))] : s.feed,
          ui: reset ? { ...s.ui, selectedId: null, lastSelectedContainerId: null } : s.ui,
        }));

        emitAnimation({ prev, next, events, actor, version });
        const undo = (): void => void get().dispatch({ kind: "UNDO" }, "human");
        for (const t of eventsToToasts(events, actor, next, undo)) emitToast(t);
        for (const m of eventsToMeasurements(events, actor)) get().pushFeed({ id: feedId(), ts: performance.now(), ...m });

        if (actor === "human" && !reset) {
          get().pushFeed({
            id: feedId(),
            ts: performance.now(),
            source: "human",
            kind: "action",
            commandKind: command.kind,
            label: describeCommand(command, prev),
            ok: true,
            observation,
            historySeq: historyEntry?.seq,
            targetId: targetOfCommand(command),
          });
        }

        return { ok: true, stateVersion: version, events, historyEntry, observation };
      });
    },

    select(id) {
      set((s) => {
        const isContainer = id !== null && s.lab.objects.some((o) => o.id === id && o.kind === "container");
        return { ui: { ...s.ui, selectedId: id, lastSelectedContainerId: isContainer ? id : s.ui.lastSelectedContainerId } };
      });
    },
    setHovered(id) {
      set((s) => ({ ui: { ...s.ui, hoveredId: id } }));
    },
    setDrag(d) {
      set((s) => ({ ui: { ...s.ui, drag: d } }));
    },
    openDialog(d) {
      set((s) => ({ ui: { ...s.ui, dialog: d } }));
    },
    setReducedMotion(v) {
      set((s) => ({ ui: { ...s.ui, reducedMotion: v } }));
    },
    setTheme(t) {
      set((s) => ({ ui: { ...s.ui, theme: t } }));
    },
    toggleDevConsole() {
      set((s) => ({ ui: { ...s.ui, devConsoleOpen: !s.ui.devConsoleOpen } }));
    },
    toggleActivity() {
      set((s) => ({ ui: { ...s.ui, activityOpen: !s.ui.activityOpen } }));
    },
    setExplainOpen(v) {
      set((s) => ({ ui: { ...s.ui, explainOpen: v } }));
    },
    toggleAgentPanel() {
      set((s) => ({ ui: { ...s.ui, agentPanelOpen: !s.ui.agentPanelOpen } }));
    },
    setDispenseIncrement(ml) {
      set((s) => ({ ui: { ...s.ui, dispenseIncrementMl: ml } }));
    },
    setWebmcp(v) {
      set((s) => ({ ui: { ...s.ui, webmcp: v } }));
    },
    setAgentBusy(v) {
      set({ agentBusy: v });
    },

    pushFeed(entry) {
      set((s) => ({ feed: [entry, ...s.feed].slice(0, FEED_CAP) }));
      return entry.id;
    },
    patchFeed(id, patch) {
      set((s) => ({ feed: s.feed.map((e) => (e.id === id ? mergeFeed(e, patch) : e)) }));
    },
  })),
);
