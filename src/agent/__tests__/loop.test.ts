import { describe, expect, it } from "vitest";
import type { ToolResponse } from "@/webmcp/types";
import type { LabSummary } from "@/lib/summary";
import { runAgent, type ModelResult } from "../loop";
import type { ModelInputItem } from "../types";

const STUB_STATE: LabSummary = {
  scenario: { id: "sandbox", objective: "", revealed: false },
  clockS: 0,
  ambientC: 22,
  stateVersion: 1,
  containers: [],
  instruments: [],
  shelf: [],
  indicatorsAvailable: [],
  equipmentTypes: [],
  lastObservations: [],
};

function okResponse(observation: string): ToolResponse {
  return { ok: true, stateVersion: 1, observation, result: null, state: STUB_STATE, events: [] };
}

describe("runAgent", () => {
  it("executes two tool calls before returning a final message", async () => {
    const modelCalls: ReadonlyArray<ModelInputItem>[] = [];
    const executed: Array<{ name: string; input: unknown }> = [];

    let round = 0;
    const fetchModel = async (input: ReadonlyArray<ModelInputItem>): Promise<ModelResult> => {
      modelCalls.push(input);
      round += 1;
      if (round === 1) {
        return { output: [{ type: "function_call", call_id: "call_1", name: "get_lab_state", arguments: "{}" }] };
      }
      if (round === 2) {
        return { output: [{ type: "function_call", call_id: "call_2", name: "dispense", arguments: '{"to_id":"c_2","volume_ml":2}' }] };
      }
      return { output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Dispensed 2 mL." }] }] };
    };

    const execute = async (name: string, input: unknown): Promise<ToolResponse> => {
      executed.push({ name, input });
      return okResponse(`ran ${name}`);
    };

    const state = await runAgent({ userText: "Help me titrate.", execute, fetchModel });

    expect(state.phase).toBe("done");
    expect(modelCalls).toHaveLength(3);
    expect(executed).toEqual([
      { name: "get_lab_state", input: {} },
      { name: "dispense", input: { to_id: "c_2", volume_ml: 2 } },
    ]);

    const kinds = state.transcript.map((entry) => entry.kind);
    expect(kinds).toEqual(["user", "tool", "tool", "assistant"]);

    const [, toolOne, toolTwo, assistant] = state.transcript;
    expect(toolOne).toMatchObject({ kind: "tool", name: "get_lab_state", status: "done", ok: true });
    expect(toolTwo).toMatchObject({ kind: "tool", name: "dispense", status: "done", ok: true });
    expect(assistant).toMatchObject({ kind: "assistant", text: "Dispensed 2 mL." });
  });

  it("stops after maxSteps and reports the limit as an error", async () => {
    let round = 0;
    const fetchModel = async (): Promise<ModelResult> => {
      round += 1;
      return { output: [{ type: "function_call", call_id: `call_${round}`, name: "get_lab_state", arguments: "{}" }] };
    };
    const execute = async (): Promise<ToolResponse> => okResponse("ran");

    const state = await runAgent({ userText: "loop forever", execute, fetchModel, maxSteps: 2 });

    expect(state.phase).toBe("error");
    expect(state.error).toMatch(/step limit/);
    expect(round).toBe(2);
  });

  it("stops calling the model once aborted", async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetchModel = async (): Promise<ModelResult> => {
      calls += 1;
      controller.abort();
      return { output: [{ type: "function_call", call_id: "call_1", name: "get_lab_state", arguments: "{}" }] };
    };
    const execute = async (): Promise<ToolResponse> => okResponse("ran");

    const state = await runAgent({ userText: "cancel me", execute, fetchModel, signal: controller.signal });

    expect(state.phase).toBe("idle");
    expect(calls).toBe(1);
  });
});
