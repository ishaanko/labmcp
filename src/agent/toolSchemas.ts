import { z } from "zod";
import { toolRegistry } from "@/webmcp/register";
import type { FunctionToolInput } from "./types";

/**
 * The live tool catalog, shaped for the Responses API `tools` param. Built from
 * `webmcp/register.ts`'s `toolRegistry`, the same tool defs the browser's WebMCP surface
 * exposes to ChatGPT, so the in-app agent and an external model see identical tools.
 */
export function buildFunctionTools(): ReadonlyArray<FunctionToolInput> {
  return [...toolRegistry.values()].map((def) => ({
    type: "function" as const,
    name: def.name,
    description: def.readOnly ? `Read only. ${def.description}` : def.description,
    parameters: z.toJSONSchema(def.input),
    strict: false,
  }));
}
