import { toast } from "sonner";
import type { ToastMessage } from "@/lib/events";

const DEDUPE_MS = 2000;
const recent = new Map<string, number>();

const DURATION_MS: Record<ToastMessage["kind"], number> = { success: 3500, info: 3500, error: 6000 };

/**
 * shadcn/sonner wrapper with a 2s dedupe by exact title and description, so a burst of identical
 * "Nothing under the burette" toasts collapses into one while two "Objective complete." toasts
 * with different details (one per scenario) both show. Registered with `setToastSink` from `@/lib/events`
 * (see `Providers.tsx`), so the store can toast without depending on sonner directly. The
 * `Toaster` in `Providers.tsx` supplies the per-kind icon; this file only picks the sonner call
 * and the duration.
 */
export function observe({ kind, title, description, action, durationMs }: ToastMessage): void {
  const now = Date.now();
  const key = `${title}\n${description ?? ""}`;
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recent.set(key, now);

  const options = { description, duration: durationMs ?? DURATION_MS[kind], action };
  if (kind === "error") toast.error(title, options);
  else if (kind === "success") toast.success(title, options);
  else toast(title, options);
}
