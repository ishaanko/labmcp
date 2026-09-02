import { Sparkles, Hand, Cog } from "lucide-react";
import { clsx } from "clsx";
import type { Actor } from "@/engine";

const ICON: Record<Actor, typeof Sparkles> = { agent: Sparkles, human: Hand, system: Cog };
const LABEL: Record<Actor, string> = { agent: "Agent", human: "You", system: "System" };

export interface SourceBadgeProps {
  actor: Actor;
  className?: string;
}

/** 16px source badge used on feed entries and the notebook. Amber for the agent, neutral otherwise. */
export function SourceBadge({ actor, className }: SourceBadgeProps) {
  const Icon = ICON[actor];
  return (
    <span
      className={clsx("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full", actor === "agent" ? "bg-amber/20 text-amber" : "bg-muted text-muted-foreground", className)}
      title={LABEL[actor]}
    >
      <Icon size={10} strokeWidth={2.25} />
    </span>
  );
}
