"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Hand, Cog } from "lucide-react";
import { clsx } from "clsx";
import { useLabStore } from "@/store/labStore";
import type { FeedEntry as FeedEntryData } from "@/store/types";
import { FeedEntry } from "./FeedEntry";
import { Notebook } from "./Notebook";

const SPRING_PANEL = { type: "spring", visualDuration: 0.4, bounce: 0 } as const;
const PANEL_EXIT = { transform: "translateX(-24px)", opacity: 0, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } } as const;
const PILL_ICON = { agent: Sparkles, human: Hand, system: Cog } as const;

/** Collapsible left panel: 44px pill closed, 300px with Activity/Notebook tabs open (C2). */
export function ActivityPanel() {
  const open = useLabStore((s) => s.ui.activityOpen);
  const toggleActivity = useLabStore((s) => s.toggleActivity);
  const feed = useLabStore((s) => s.feed);
  const [tab, setTab] = useState<"activity" | "notebook">("activity");
  const autoOpened = useRef(false);

  useEffect(() => {
    if (autoOpened.current || open) return;
    if (feed.some((e) => e.source === "agent" && e.kind === "tool_call")) {
      autoOpened.current = true;
      toggleActivity();
    }
  }, [feed, open, toggleActivity]);

  const latest: FeedEntryData | undefined = feed[0];

  return (
    <div className="pointer-events-none absolute top-0 left-0 bottom-14 w-[300px]">
      <AnimatePresence initial={false} mode="popLayout">
        {!open ? (
          <button
            key="tab"
            type="button"
            onClick={toggleActivity}
            aria-label="Open activity panel"
            className="material-thin pointer-events-auto relative -ml-3 flex h-8 items-center gap-1.5 rounded-l-none border-l-0 pr-2.5 pl-2 text-xs text-ink-2"
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={latest?.source ?? "empty"}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(2px)" }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center gap-1.5"
              >
                {latest ? <SourceIcon entry={latest} /> : <Cog size={13} />}
                Activity
              </motion.span>
            </AnimatePresence>
          </button>
        ) : (
          <motion.div
            key="panel"
            initial={{ transform: "translateX(-24px)", opacity: 0 }}
            animate={{ transform: "translateX(0px)", opacity: 1 }}
            exit={PANEL_EXIT}
            transition={SPRING_PANEL}
            className="material pointer-events-auto flex h-full w-[300px] flex-col overflow-hidden"
          >
            <div className="flex h-11 shrink-0 items-center gap-1 border-b border-hairline px-2">
              <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
                Activity
              </TabButton>
              <TabButton active={tab === "notebook"} onClick={() => setTab("notebook")}>
                Notebook
              </TabButton>
              <div className="flex-1" />
              <button
                type="button"
                onClick={toggleActivity}
                aria-label="Collapse activity panel"
                className="pressable h-7 w-7 rounded-xs text-ink-3 hover:bg-surface-thin hover:text-ink"
              >
                ⟨
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {tab === "activity" ? (
                <ul className="flex flex-col gap-0.5">
                  {feed.map((entry) => (
                    <FeedEntry key={entry.id} entry={entry} />
                  ))}
                </ul>
              ) : (
                <Notebook />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceIcon({ entry }: { entry: FeedEntryData }) {
  const Icon = PILL_ICON[entry.source];
  return <Icon size={13} />;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "pressable h-7 rounded-xs px-2 text-xs font-medium",
        active ? "bg-surface-thin text-ink" : "text-ink-3 hover:text-ink-2",
      )}
    >
      {children}
    </button>
  );
}
