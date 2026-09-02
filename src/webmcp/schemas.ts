import { z } from "zod";
import { constants } from "@/engine";

/**
 * Shared zod fragments for tool inputs. Every field carries a description because the
 * JSON Schema produced from these is what the agent reads.
 */

export const ContainerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .describe('Container id exactly as returned by get_lab_state, e.g. "c_1". Type names are not ids.');

export const ObjectIdSchema = z
  .string()
  .min(1)
  .max(64)
  .describe('Object id exactly as returned by get_lab_state, e.g. "c_1" for glassware or "i_3" for an instrument.');

export const VolumeMlSchema = z.number().gt(0).max(1000).describe("Volume in millilitres (mL), greater than 0.");

export const TemperatureCSchema = z.number().min(0).max(100).describe("Target temperature in °C, 0 to 100 (sandbox range).");

export const SlotSchema = z
  .object({
    col: z.int().min(0).max(constants.GRID.cols - 1).describe(`Bench column, 0 (left) to ${constants.GRID.cols - 1} (right).`),
    row: z.int().min(0).max(constants.GRID.rows - 1).describe(`Bench row, 0 (back) to ${constants.GRID.rows - 1} (front).`),
  })
  .strict()
  .describe("Bench grid slot. Omit to use the next free slot.");

// The equipment catalog itself lives in engine/constants.ts (CONTAINER_TYPES/INSTRUMENT_TYPES/
// EQUIPMENT_TYPES) so the engine, this schema, and the UI's Shelf all read the same list.
export const ContainerTypeSchema = z.enum(constants.CONTAINER_TYPES).describe("Glassware type.");
export const EquipmentTypeSchema = z
  .enum(constants.EQUIPMENT_TYPES)
  .describe(
    "Equipment type. beaker 250 mL, flask 250 mL (Erlenmeyer), test_tube 20 mL, graduated_cylinder 100 mL, burette 50 mL, ph_meter, thermometer, hotplate.",
  );

export const INDICATOR_IDS = ["phenolphthalein", "universal", "litmus"] as const;
export const IndicatorIdSchema = z
  .enum(INDICATOR_IDS)
  .describe(
    "phenolphthalein: colorless below pH ~8.2, pink above. universal: red/orange/yellow/green/blue/purple across pH 1 to 14. litmus: red in acid, blue in base.",
  );

export const SCENARIO_ID_VALUES = ["sandbox", "titration", "unknown_id"] as const;
export const ScenarioIdSchema = z.enum(SCENARIO_ID_VALUES);

export const EmptyInput = z.object({}).strict();
