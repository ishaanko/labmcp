import { z } from "zod";

/**
 * Falls back to this when `OPENAI_MODEL` is unset. Also the label AgentPanel shows in its
 * header, since the client cannot read the server's env var; keep this in sync with
 * .env.example.
 */
export const DEFAULT_MODEL_LABEL = "gpt-5.4";

/**
 * Wire contract for POST /api/agent, shared by the route handler (server) and the loop
 * (browser). Every shape here is a minimal slice of the Responses API's `ResponseInputItem` /
 * `ResponseOutputItem` unions: only the fields the loop actually reads or re-sends. Each schema
 * below is structurally assignable to its Responses API counterpart, so route.ts can hand
 * `parsed.data.input` / `parsed.data.tools` straight to `client.responses.create` with no cast.
 */

// ---------- input items (what the loop sends the model) ----------

/** A user or assistant text turn. The loop never sends multi-part content. */
export const MessageInputSchema = z.object({
  type: z.literal("message").optional(),
  role: z.enum(["user", "assistant", "system", "developer"]),
  content: z.string(),
});
export type MessageInput = z.infer<typeof MessageInputSchema>;

/** A tool call the model asked for, echoed back verbatim as part of the next turn's input. */
export const FunctionCallInputSchema = z.object({
  type: z.literal("function_call"),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});
export type FunctionCallInput = z.infer<typeof FunctionCallInputSchema>;

/** A tool result sent back to the model, keyed to the call it answers. */
export const FunctionCallOutputInputSchema = z.object({
  type: z.literal("function_call_output"),
  call_id: z.string(),
  output: z.string(),
});
export type FunctionCallOutputInput = z.infer<typeof FunctionCallOutputInputSchema>;

export const ModelInputItemSchema = z.union([FunctionCallOutputInputSchema, FunctionCallInputSchema, MessageInputSchema]);
export type ModelInputItem = z.infer<typeof ModelInputItemSchema>;

// ---------- output items (what the model sends back) ----------

const OutputTextSchema = z.object({ type: z.literal("output_text"), text: z.string() }).loose();
const OutputRefusalSchema = z.object({ type: z.literal("refusal"), refusal: z.string() }).loose();

/** An assistant text turn. `content` mirrors `ResponseOutputMessage`; other fields are ignored. */
export const ModelMessageOutputSchema = z
  .object({
    type: z.literal("message"),
    role: z.literal("assistant"),
    content: z.array(z.union([OutputTextSchema, OutputRefusalSchema])),
  })
  .loose();
export type ModelMessageOutput = z.infer<typeof ModelMessageOutputSchema>;

/** A tool call is both an output item and (echoed back) an input item, so it reuses one schema. */
export const ModelOutputItemSchema = z.union([ModelMessageOutputSchema, FunctionCallInputSchema]);
export type ModelOutputItem = z.infer<typeof ModelOutputItemSchema>;

export const AgentUsageSchema = z
  .object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
  })
  .loose();
export type AgentUsage = z.infer<typeof AgentUsageSchema>;

// ---------- tool declarations (what the model is offered) ----------

/** The essential fields of `FunctionTool`; JSON-schema `parameters` come from `z.toJSONSchema`. */
export const FunctionToolSchema = z.object({
  type: z.literal("function"),
  name: z.string().min(1),
  description: z.string().nullish(),
  parameters: z.record(z.string(), z.unknown()).nullable(),
  strict: z.boolean().nullable(),
});
export type FunctionToolInput = z.infer<typeof FunctionToolSchema>;

// ---------- POST /api/agent request/response envelopes ----------

export const AgentRouteRequestSchema = z.object({
  input: z.array(ModelInputItemSchema).min(1).max(200),
  tools: z.array(FunctionToolSchema).max(60),
});
export type AgentRouteRequest = z.infer<typeof AgentRouteRequestSchema>;

export const AgentRouteResponseSchema = z.object({
  output: z.array(ModelOutputItemSchema),
  usage: AgentUsageSchema.nullish(),
});
export type AgentRouteResponse = z.infer<typeof AgentRouteResponseSchema>;

export const AgentRouteErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
export type AgentRouteError = z.infer<typeof AgentRouteErrorSchema>;

// ---------- transcript and step-machine state (src/agent/loop.ts) ----------

export type TranscriptEntry =
  | { readonly id: string; readonly kind: "user"; readonly text: string }
  | { readonly id: string; readonly kind: "assistant"; readonly text: string }
  | {
      readonly id: string;
      readonly kind: "tool";
      readonly callId: string;
      readonly name: string;
      readonly input: unknown;
      readonly status: "running" | "done";
      readonly ok?: boolean;
      readonly resultSummary?: string;
      readonly durationMs?: number;
    };

export type AgentPhase = "idle" | "thinking" | "executing" | "done" | "error";

export interface AgentState {
  readonly phase: AgentPhase;
  /** Rendered in AgentPanel. */
  readonly transcript: ReadonlyArray<TranscriptEntry>;
  /** Sent to the model on the next call; grows every turn. */
  readonly history: ReadonlyArray<ModelInputItem>;
  readonly error: string | null;
  /** Model round-trips in the current run, for the max-steps guard. */
  readonly steps: number;
}
