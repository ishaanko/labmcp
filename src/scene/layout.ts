import type { Container, Instrument } from "@/engine";

/** Rest height for a container sitting on a hotplate cell (C3.2), just above the plate. */
export const HOTPLATE_TOP_Y = 0.12;

/** Whether a container shares its cell with a hotplate, for its rest y and effect origins. */
export function isOnHotplate(container: Container, hotplates: ReadonlyArray<Instrument>): boolean {
  return hotplates.some((h) => h.position.x === container.position.x && h.position.y === container.position.y);
}
