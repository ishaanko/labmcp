import type { z } from "zod";
import type { LabStore } from "@/store/types";
import type { LabSummary } from "@/lib/summary";

export type ToolErrorCode =
  | "INVALID_INPUT"
  | "OBJECT_NOT_FOUND"
  | "CAPACITY_EXCEEDED"
  | "INSUFFICIENT_VOLUME"
  | "INVALID_AMOUNT"
  | "INSTRUMENT_MISSING"
  | "OUT_OF_RANGE"
  | "PERMISSION_DENIED"
  | "NOTHING_TO_UNDO"
  | "UNKNOWN_SCENARIO"
  | "ENGINE_ERROR"
  | "ABORTED";

export interface ToolOk<T> {
  readonly ok: true;
  readonly stateVersion: number;
  /** Short human-readable account of what was observed, e.g. "white precipitate formed". */
  readonly observation: string;
  readonly result: T;
  readonly state: LabSummary;
  readonly events: ReadonlyArray<string>;
}

export interface ToolErr {
  readonly ok: false;
  readonly stateVersion: number;
  readonly error: { readonly code: ToolErrorCode; readonly message: string; readonly suggestions?: ReadonlyArray<string> };
  readonly state: LabSummary;
}

export type ToolResponse<T = unknown> = ToolOk<T> | ToolErr;

export interface ToolCtx {
  readonly getState: () => LabStore;
  readonly dispatch: LabStore["dispatch"];
  readonly signal: AbortSignal;
}

export interface ToolDef<I> {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  readonly readOnly: boolean;
  /** Preset inputs for the dev console. */
  readonly examples?: ReadonlyArray<{ readonly label: string; readonly input: I }>;
  /** The container or instrument the call acts on, so the scene can mark it. */
  targetId?(input: I): string | undefined;
  handler(input: I, ctx: ToolCtx): Promise<ToolResponse>;
}

/**
 * A ToolDef with its input type erased, for the registry and runtime. `targetId` and `handler`
 * are method signatures (bivariant), so a ToolDef<{...}> is assignable to ToolDef<unknown>.
 */
export type AnyToolDef = ToolDef<unknown>;
