"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Hand, Cog, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import type { FeedEntry as FeedEntryData } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FeedEntry } from "./FeedEntry";
import { Notebook } from "./Notebook";

const SPRING_PANEL = { type: "spring", visualDuration: 0.4, bounce: 0 } as const;
const PANEL_EXIT = { transform: "translateX(-24px)", opacity: 0, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } } as const;
const PILL_ICON = { agent: Sparkles, human: Hand, system: Cog } as const;

/** Left column: a collapsed rail closed, a 300px Activity/Notebook tab set open. */
export function ActivityPanel() {
  const open = useLabStore((s) => s.ui.activityOpen);
  const toggleActivity = useLabStore((s) => s.toggleActivity);
  const feed = useLabStore((s) => s.feed);
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
    <div className="pointer-events-auto flex h-full shrink-0 flex-col border-r border-border bg-card">
      <AnimatePresence initial={false} mode="popLayout">
        {!open ? (
          <button
            key="rail"
            type="button"
            onClick={toggleActivity}
            aria-label="Open activity panel"
            className="flex h-full w-11 flex-col items-center gap-2 pt-3 text-muted-foreground hover:text-foreground"
          >
            <PanelLeftOpen size={16} />
            <AnimatePresence initial={false}>
              <motion.span
                key={latest?.source ?? "empty"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                {latest ? <SourceIcon entry={latest} /> : <Cog size={13} />}
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
            className="flex h-full w-[300px] flex-col overflow-hidden"
          >
            <Tabs defaultValue="activity" className="flex h-full min-h-0 flex-col gap-0">
              <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
                <TabsList variant="line">
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="notebook">Notebook</TabsTrigger>
                </TabsList>
                <div className="flex-1" />
                <Button variant="ghost" size="icon-sm" onClick={toggleActivity} aria-label="Collapse activity panel">
                  <PanelLeftClose size={15} />
                </Button>
              </div>
              <TabsContent value="activity" className="min-h-0 flex-1">
                <ScrollArea className="h-full p-2">
                  <ul className="flex flex-col gap-0.5">
                    {feed.map((entry) => (
                      <FeedEntry key={entry.id} entry={entry} />
                    ))}
                  </ul>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="notebook" className="flex min-h-0 flex-1 flex-col p-2">
                <Notebook />
              </TabsContent>
            </Tabs>
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
