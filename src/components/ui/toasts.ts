import { toast } from "sonner";
import type { ToastMessage } from "@/lib/events";

const DEDUPE_MS = 2000;
const recent = new Map<string, number>();

const DURATION_MS: Record<ToastMessage["kind"], number> = { success: 3500, info: 3500, error: 6000 };

/**
 * Sonner wrapper with a 2s dedupe by exact title, so a burst of identical "Nothing under the
 * burette" toasts collapses into one. Registered with `setToastSink` from `@/lib/events`
 * (see `Providers.tsx`), so the store can toast without depending on sonner directly.
 */
export function observe({ kind, title, description }: ToastMessage): void {
  const now = Date.now();
  const last = recent.get(title);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recent.set(title, now);

  if (kind === "error") toast.error(title, { description, duration: DURATION_MS[kind] });
  else if (kind === "success") toast.success(title, { description, duration: DURATION_MS[kind] });
  else toast(title, { description, duration: DURATION_MS[kind] });
}
