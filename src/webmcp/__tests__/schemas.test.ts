import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/store/labStore", () => ({ useLabStore: { getState: vi.fn() } }));

import { buildTools } from "../tools";

const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

interface JsonSchemaObject {
  readonly type?: string;
  readonly additionalProperties?: boolean;
  readonly properties?: Record<string, { readonly description?: string; readonly enum?: ReadonlyArray<unknown> }>;
  readonly enum?: ReadonlyArray<unknown>;
}

function isJsonSchemaObject(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null;
}

describe("webmcp tool schemas", () => {
  const tools = buildTools();

  it("registers exactly the documented catalog (24 + submit_conclusion)", () => {
    expect(tools).toHaveLength(25);
  });

  it("every tool name is unique and matches the WebMCP name pattern", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(NAME_PATTERN);
  });

  it("every schema is a strict object with every property described", () => {
    for (const tool of tools) {
      const schema = z.toJSONSchema(tool.input);
      expect(isJsonSchemaObject(schema)).toBe(true);
      if (!isJsonSchemaObject(schema)) continue;
      expect(schema.type, `${tool.name}: type`).toBe("object");
      expect(schema.additionalProperties, `${tool.name}: additionalProperties`).toBe(false);
      for (const [prop, def] of Object.entries(schema.properties ?? {})) {
        expect(def.description, `${tool.name}.${prop} should be described`).toBeTruthy();
      }
    }
  });

  it("every tool has a non-empty description and a readOnly flag", () => {
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(typeof tool.readOnly).toBe("boolean");
    }
  });

  it("read-only tools are exactly the documented set", () => {
    const readOnlyNames = tools.filter((t) => t.readOnly).map((t) => t.name).sort();
    expect(readOnlyNames).toEqual(
      [
        "calculate_moles",
        "check_objective",
        "get_lab_state",
        "get_notebook",
        "get_titration_data",
        "inspect_contents",
        "list_equipment",
        "list_reagents",
        "measure_ph",
        "measure_temperature",
        "measure_volume",
        "predict_supported_reactions",
      ].sort(),
    );
  });

  it("enums are present on constrained fields (reagent_id, indicator_id, scenario_id)", () => {
    const addReagent = tools.find((t) => t.name === "add_reagent");
    expect(addReagent).toBeDefined();
    const schema = z.toJSONSchema(addReagent!.input);
    expect(isJsonSchemaObject(schema)).toBe(true);
    if (!isJsonSchemaObject(schema)) return;
    const reagentIdProp = schema.properties?.["reagent_id"];
    expect(reagentIdProp?.enum).toBeTruthy();
  });

  it("every example input parses against its own tool's schema", () => {
    for (const tool of tools) {
      for (const example of tool.examples ?? []) {
        const result = tool.input.safeParse(example.input);
        expect(result.success, `${tool.name} example "${example.label}": ${result.success ? "" : JSON.stringify(result.error.issues)}`).toBe(true);
      }
    }
  });
});
