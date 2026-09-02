import { assertNever } from "@/engine";
import type { ToolResponse } from "@/webmcp/types";
import type { AgentPhase, AgentState, FunctionCallInput, ModelInputItem, ModelMessageOutput, ModelOutputItem, TranscriptEntry } from "./types";

/**
 * The lab partner's step machine: `reduceAgent` is the pure reducer, `runAgent` is the effectful
 * driver that calls it. Kept apart so the reducer stays unit-testable without a network or the
 * store, and so `AgentPanel` can reuse it for optimistic UI if it ever needs to.
 */

let idCounter = 0;
function transcriptId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export type AgentEvent =
  | { readonly kind: "user_submitted"; readonly text: string }
  | { readonly kind: "model_responded"; readonly items: ReadonlyArray<ModelOutputItem> }
  | { readonly kind: "tool_started"; readonly callId: string; readonly name: string; readonly input: unknown }
  | { readonly kind: "tool_finished"; readonly callId: string; readonly ok: boolean; readonly summary: string; readonly durationMs: number; readonly output: string }
  | { readonly kind: "max_steps" }
  | { readonly kind: "aborted" }
  | { readonly kind: "error"; readonly message: string };

export function createInitialAgentState(): AgentState {
  return { phase: "idle", transcript: [], history: [], error: null, steps: 0 };
}

function isFunctionCallItem(item: ModelOutputItem): item is FunctionCallInput {
  return item.type === "function_call";
}

function isMessageItem(item: ModelOutputItem): item is ModelMessageOutput {
  return item.type === "message";
}

function messageText(item: ModelMessageOutput): string {
  return item.content
    .filter((part): part is { type: "output_text"; text: string } => part.type === "output_text")
    .map((part) => part.text)
    .join("");
}

/** Assistant messages round-trip as plain text; tool calls round-trip verbatim (same shape). */
function toHistoryItem(item: ModelOutputItem): ModelInputItem {
  return isFunctionCallItem(item) ? item : { type: "message", role: "assistant", content: messageText(item) };
}

export function reduceAgent(state: AgentState, event: AgentEvent): AgentState {
  switch (event.kind) {
    case "user_submitted": {
      const entry: TranscriptEntry = { id: transcriptId("u"), kind: "user", text: event.text };
      const item: ModelInputItem = { type: "message", role: "user", content: event.text };
      return { ...state, phase: "thinking", error: null, transcript: [...state.transcript, entry], history: [...state.history, item] };
    }
    case "model_responded": {
      const toolCalls = event.items.filter(isFunctionCallItem);
      const assistantText = event.items.filter(isMessageItem).map(messageText).filter((text) => text.length > 0);
      const nextPhase: AgentPhase = toolCalls.length > 0 ? "executing" : "done";
      return {
        ...state,
        phase: nextPhase,
        steps: state.steps + 1,
        history: [...state.history, ...event.items.map(toHistoryItem)],
        transcript: [...state.transcript, ...assistantText.map((text) => ({ id: transcriptId("a"), kind: "assistant" as const, text }))],
      };
    }
    case "tool_started": {
      const entry: TranscriptEntry = {
        id: event.callId,
        kind: "tool",
        callId: event.callId,
        name: event.name,
        input: event.input,
        status: "running",
      };
      return { ...state, transcript: [...state.transcript, entry] };
    }
    case "tool_finished": {
      const item: ModelInputItem = { type: "function_call_output", call_id: event.callId, output: event.output };
      return {
        ...state,
        phase: "thinking",
        history: [...state.history, item],
        transcript: state.transcript.map((entry) =>
          entry.kind === "tool" && entry.callId === event.callId
            ? { ...entry, status: "done", ok: event.ok, resultSummary: event.summary, durationMs: event.durationMs }
            : entry,
        ),
      };
    }
    case "max_steps":
      return { ...state, phase: "error", error: "Stopped after the step limit. Ask again to continue." };
    case "aborted":
      return { ...state, phase: "idle", error: null };
    case "error":
      return { ...state, phase: "error", error: event.message };
    default:
      return assertNever(event);
  }
}

export interface ModelResult {
  readonly output: ReadonlyArray<ModelOutputItem>;
}

export interface RunAgentArgs {
  readonly userText: string;
  readonly execute: (name: string, input: unknown) => Promise<ToolResponse>;
  readonly fetchModel: (input: ReadonlyArray<ModelInputItem>) => Promise<ModelResult>;
  readonly maxSteps?: number;
  readonly signal?: AbortSignal;
  /** Conversation to continue; omitted for a fresh transcript. */
  readonly state?: AgentState;
  /** Fired after every reduction, for a live-updating panel. */
  readonly onState?: (state: AgentState) => void;
}

const DEFAULT_MAX_STEPS = 16;
/** ~6 kB of JSON, character-counted: tool payloads here are near-ASCII English observations. */
const TOOL_OUTPUT_MAX_CHARS = 6 * 1024;

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** `JSON.parse` returns `any`; routing it through this signature contains that at the boundary. */
function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function parseArguments(raw: string): unknown {
  try {
    return parseJson(raw);
  } catch {
    return {};
  }
}

/**
 * Drives one user turn to completion: sends the message, calls the model, executes any tool
 * calls through `execute`, feeds the results back, and repeats until the model answers with no
 * further tool calls or `maxSteps` round-trips pass. Abortable via `signal`; every intermediate
 * step is exposed through `onState` so a panel can render tool calls as they run.
 */
export async function runAgent(args: RunAgentArgs): Promise<AgentState> {
  const { userText, execute, fetchModel, maxSteps = DEFAULT_MAX_STEPS, signal, onState } = args;
  let state = args.state ?? createInitialAgentState();

  const emit = (event: AgentEvent): AgentState => {
    state = reduceAgent(state, event);
    onState?.(state);
    return state;
  };

  emit({ kind: "user_submitted", text: userText });

  for (let step = 0; step < maxSteps; step += 1) {
    if (signal?.aborted) return emit({ kind: "aborted" });

    let result: ModelResult;
    try {
      result = await fetchModel(state.history);
    } catch (error: unknown) {
      if (signal?.aborted) return emit({ kind: "aborted" });
      return emit({ kind: "error", message: error instanceof Error ? error.message : "The model call failed." });
    }

    if (signal?.aborted) return emit({ kind: "aborted" });
    emit({ kind: "model_responded", items: result.output });

    const toolCalls = result.output.filter(isFunctionCallItem);
    if (toolCalls.length === 0) return state;

    for (const call of toolCalls) {
      if (signal?.aborted) return emit({ kind: "aborted" });

      const input = parseArguments(call.arguments);
      emit({ kind: "tool_started", callId: call.call_id, name: call.name, input });

      const startedAt = Date.now();
      const response = await execute(call.name, input);
      const durationMs = Date.now() - startedAt;
      const output = truncate(JSON.stringify(response), TOOL_OUTPUT_MAX_CHARS);
      const summary = response.ok ? response.observation : response.error.message;
      emit({ kind: "tool_finished", callId: call.call_id, ok: response.ok, summary, durationMs, output });
    }
  }

  return emit({ kind: "max_steps" });
}
