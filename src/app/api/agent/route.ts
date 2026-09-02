import OpenAI, { APIError } from "openai";
import { AgentRouteRequestSchema, DEFAULT_MODEL_LABEL } from "@/agent/types";
import { SYSTEM_PROMPT } from "@/agent/prompt";

/** Talks to OpenAI; the key never reaches the browser. */
export const runtime = "nodejs";

const MAX_OUTPUT_TOKENS = 1200;

function shortMessage(error: unknown): string {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return "The model call failed.";
}

/**
 * The lab partner's only server route: takes the loop's accumulated conversation and tool
 * catalog, makes one Responses API call, and hands back the raw output items. Everything else
 * (looping over tool calls, executing them, deciding when to stop) happens client-side in
 * src/agent/loop.ts, against the same WebMCP tool path a browser agent would use.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing_key" }, { status: 503 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = AgentRouteRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "Request did not match the expected shape." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL_LABEL;

  try {
    const response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: parsed.data.input,
      tools: parsed.data.tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    // The loop only ever reads message text and function calls; drop reasoning items and the
    // like rather than growing the wire contract to cover shapes nothing consumes.
    const output = response.output.filter((item) => item.type === "message" || item.type === "function_call");
    return Response.json({ output, usage: response.usage });
  } catch (error: unknown) {
    return Response.json({ error: "model_error", message: shortMessage(error) }, { status: 500 });
  }
}
