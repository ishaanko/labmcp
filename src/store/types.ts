import type { Actor, HistoryEntry, LabCommand, LabError, LabState, Observation } from "@/engine";

export interface XY {
  readonly x: number;
  readonly y: number;
}

export type DragState =
  | { kind: "reagent"; reagentId: string; pointer: XY; overId: string | null }
  | { kind: "indicator"; indicatorId: string; pointer: XY; overId: string | null }
  | { kind: "equipment"; equipmentType: string; pointer: XY; cell: XY | null }
  | { kind: "container"; id: string; pointer: XY; overId: string | null }
  | { kind: "instrument"; id: string; pointer: XY; overId: string | null };

export type PendingDialog =
  | { kind: "add_reagent"; containerId: string; reagentId: string; defaultMl: number; maxMl: number }
  | { kind: "add_indicator"; containerId: string; indicatorId: string }
  | { kind: "transfer"; sourceId: string; destinationId: string; maxMl: number }
  | { kind: "confirm_reset" };

export type WebMcpProvider = "native" | "polyfill" | "none";

export interface UiState {
  selectedId: string | null;
  hoveredId: string | null;
  drag: DragState | null;
  dialog: PendingDialog | null;
  reducedMotion: boolean;
  devConsoleOpen: boolean;
  activityOpen: boolean;
  explainOpen: boolean;
  agentPanelOpen: boolean;
  /** 0.1 | 0.5 | 1 | 5 */
  dispenseIncrementMl: number;
  webmcp: { provider: WebMcpProvider; toolCount: number };
  theme: "light" | "dark";
}

export type FeedEntry =
  | {
      id: string;
      ts: number;
      source: "human";
      kind: "action";
      commandKind: LabCommand["kind"];
      label: string;
      ok: boolean;
      observation: string;
      errorKind?: string;
      historySeq?: number;
      targetId?: string;
    }
  | {
      id: string;
      ts: number;
      source: "agent";
      kind: "tool_call";
      tool: string;
      input: unknown;
      status: "running" | "done";
      ok?: boolean;
      resultSummary?: string;
      errorCode?: string;
      durationMs?: number;
      readOnly: boolean;
      historySeq?: number;
      targetId?: string;
    }
  | { id: string; ts: number; source: Actor; kind: "measurement"; containerId: string; label: string; value: number; unit: string }
  | { id: string; ts: number; source: "system"; kind: "note"; text: string };

export type DispatchResult =
  | {
      readonly ok: true;
      readonly stateVersion: number;
      readonly events: ReadonlyArray<Observation>;
      readonly historyEntry: HistoryEntry | null;
      /** Human-readable summary of what happened, from the engine's describeEvent lines. */
      readonly observation: string;
    }
  | {
      readonly ok: false;
      readonly stateVersion: number;
      readonly error: LabError;
      /** Human-readable summary of what happened, from the engine's describeEvent lines. */
      readonly observation: string;
    };

export interface LabStore {
  lab: LabState;
  /** Increments on every successful commit. */
  stateVersion: number;
  ui: UiState;
  feed: FeedEntry[];
  agentBusy: boolean;

  /** The single command path for humans, agents, and the ticker. Serialized. */
  dispatch(command: LabCommand, actor: Actor): Promise<DispatchResult>;

  select(id: string | null): void;
  setHovered(id: string | null): void;
  setDrag(d: DragState | null): void;
  openDialog(d: PendingDialog | null): void;
  setReducedMotion(v: boolean): void;
  setTheme(t: "light" | "dark"): void;
  toggleDevConsole(): void;
  toggleActivity(): void;
  setExplainOpen(v: boolean): void;
  toggleAgentPanel(): void;
  setDispenseIncrement(ml: number): void;
  setWebmcp(v: UiState["webmcp"]): void;
  setAgentBusy(v: boolean): void;

  pushFeed(entry: FeedEntry): string;
  patchFeed(id: string, patch: Partial<FeedEntry>): void;
}
