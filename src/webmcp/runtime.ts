import type { Container, Instrument, LabError, LabState } from "@/engine";
import { parseContainerId, publicView } from "@/engine";
import { feedId } from "@/lib/ids";
import { safeObservationLine, summarizeLab, visibleObservationEvents } from "@/lib/summary";
import { useLabStore } from "@/store/labStore";
import type { DispatchResult, FeedEntry, LabStore } from "@/store/types";
import { mapLabError } from "./errors";
import type { AnyToolDef, ToolErr, ToolErrorCode, ToolOk, ToolResponse } from "./types";

/**
 * The per-event `describeEvent` lines produced by a successful dispatch, for the tool response's
 * `events`. Filtered through the same `visibleObservationEvents` policy as the feed line and
 * toasts, then redacted through the current publicView same as `dr.observation`, so a hidden
 * container's pH or reaction chemistry never reaches an agent through this path either.
 */
export function eventStrings(getState: () => LabStore, dr: Extract<DispatchResult, { ok: true }>): ReadonlyArray<string> {
  const pub = publicView(getState().lab);
  return visibleObservationEvents(pub, dr.events.map((o) => o.event))
    .map((event) => safeObservationLine(pub, event))
    .filter((line): line is string => line !== null && line.length > 0);
}

/** The engine's own "id not found" shape, for ids that never made it into the lab. */
export function unknownObjectError(id: string): LabError {
  return { kind: "UNKNOWN_OBJECT", id, hint: "reread_lab_state" };
}

/** Resolves a raw id string to a Container, or undefined when malformed or absent from the bench. */
export function findContainer(lab: LabState, raw: string): Container | undefined {
  const id = parseContainerId(raw);
  if (!id) return undefined;
  return lab.objects.find((o): o is Container => o.kind === "container" && o.id === id);
}

/** Resolves a raw id string to an Instrument, or undefined when malformed or absent from the bench. */
export function findInstrument(lab: LabState, raw: string): Instrument | undefined {
  return lab.objects.find((o): o is Instrument => o.kind === "instrument" && o.id === raw);
}

/** The first ph_meter on the bench, regardless of what it is currently attached to. */
export function findBenchPhMeter(lab: LabState): Instrument | undefined {
  return lab.objects.find((o): o is Instrument => o.kind === "instrument" && o.type === "ph_meter");
}

/** Builds a successful tool envelope. `state` is snapshotted from `getState()` at call time. */
export function ok<T>(getState: () => LabStore, result: T, observation: string, events: ReadonlyArray<string>): ToolOk<T> {
  const s = getState();
  return { ok: true, stateVersion: s.stateVersion, observation, result, state: summarizeLab(s.lab, s.stateVersion), events };
}

/** Builds a failed tool envelope from a tool error code directly (validation, abort, engine crash). */
export function err(getState: () => LabStore, code: ToolErrorCode, message: string, suggestions?: ReadonlyArray<string>): ToolErr {
  const s = getState();
  return { ok: false, stateVersion: s.stateVersion, error: { code, message, suggestions }, state: summarizeLab(s.lab, s.stateVersion) };
}

/** Builds a failed tool envelope from an engine LabError, via the code/message/suggestions mapping. */
export function errFromLabError(getState: () => LabStore, error: LabError): ToolErr {
  const mapped = mapLabError(error, getState().lab);
  return err(getState, mapped.code, mapped.message, mapped.suggestions);
}

/**
 * Wraps a ToolDef into the WebMCP `execute` callback: parses input, runs the handler, and
 * mirrors the call into the activity feed as a running -> done entry. Never throws; a thrown
 * handler becomes an ENGINE_ERROR envelope so the agent always gets a response back.
 */
export function runTool(def: AnyToolDef) {
  return async (rawInput: unknown, options?: { signal?: AbortSignal }): Promise<ToolResponse> => {
    const getState = () => useLabStore.getState();
    const signal = options?.signal ?? new AbortController().signal;
    const startedAt = Date.now();
    const entryId = getState().pushFeed({
      id: feedId(),
      ts: startedAt,
      source: "agent",
      kind: "tool_call",
      tool: def.name,
      input: rawInput,
      status: "running",
      readOnly: def.readOnly,
    });

    const finish = (response: ToolResponse, targetId: string | undefined): ToolResponse => {
      const s = getState();
      const patch: Partial<FeedEntry> = {
        status: "done",
        ok: response.ok,
        durationMs: Date.now() - startedAt,
        targetId,
        historySeq: s.lab.history.at(-1)?.seq,
      };
      if (response.ok) {
        patch.resultSummary = response.observation;
      } else {
        patch.errorCode = response.error.code;
      }
      s.patchFeed(entryId, patch);
      s.setAgentBusy(false);
      return response;
    };

    if (signal.aborted) {
      return finish(err(getState, "ABORTED", `${def.name} was aborted before it started.`), undefined);
    }

    const parsed = def.input.safeParse(rawInput);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
      return finish(err(getState, "INVALID_INPUT", message), undefined);
    }

    getState().setAgentBusy(true);
    const targetId = def.targetId?.(parsed.data);

    try {
      const response = await def.handler(parsed.data, {
        getState,
        dispatch: (command, actor) => getState().dispatch(command, actor),
        signal,
      });
      return finish(response, targetId);
    } catch {
      return finish(err(getState, "ENGINE_ERROR", `${def.name} failed unexpectedly.`), targetId);
    }
  };
}
