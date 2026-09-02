import { inspectTools } from "./inspect";
import { metaTools } from "./meta";
import { mutateTools } from "./mutate";
import { readTools } from "./read";
import type { AnyToolDef } from "../types";

/** The full 24 + 1 (optional submit_conclusion) tool catalog, in registration order. */
export function buildTools(): ReadonlyArray<AnyToolDef> {
  return [...readTools, ...inspectTools, ...mutateTools, ...metaTools];
}
