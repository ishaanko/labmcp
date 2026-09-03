"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { Sparkles, Square, ArrowUp } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLabStore } from "@/store/labStore";
import { toolRegistry } from "@/webmcp/register";
import { err, runTool } from "@/webmcp/runtime";
import { buildFunctionTools } from "@/agent/toolSchemas";
import { createInitialAgentState, runAgent, type ModelResult } from "@/agent/loop";
import { AgentRouteErrorSchema, AgentRouteResponseSchema, DEFAULT_MODEL_LABEL, type AgentPhase, type AgentState, type ModelInputItem } from "@/agent/types";
import { AgentMessage } from "./AgentMessage";

const SUGGESTED_PROMPTS = [
  "Help me complete this titration, but let me handle the endpoint.",
  "What is in the beaker?",
  "Add 10 mL of water to the beaker and tell me the new volume.",
] as const;

const MISSING_KEY_ERROR = "missing_key";

const DOT_COLOR: Readonly<Record<AgentPhase, string>> = {
  idle: "bg-ink-3",
  thinking: "bg-amber",
  executing: "bg-amber",
  done: "bg-ok",
  error: "bg-danger",
};

/** Posts one model turn to /api/agent and validates the reply at this client boundary too. */
async function fetchModel(input: ReadonlyArray<ModelInputItem>, signal: AbortSignal): Promise<ModelResult> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, tools: buildFunctionTools() }),
    signal,
  });
  const json: unknown = await res.json();

  if (!res.ok) {
    if (res.status === 503) throw new Error(MISSING_KEY_ERROR);
    const parsedError = AgentRouteErrorSchema.safeParse(json);
    throw new Error(parsedError.success ? (parsedError.data.message ?? parsedError.data.error) : "The agent route failed.");
  }

  const parsed = AgentRouteResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("The agent route returned an unexpected shape.");
  return { output: parsed.data.output };
}

/** Runs one WebMCP tool by name, the same path a browser agent's call takes, as actor "agent". */
function execute(name: string, input: unknown, signal: AbortSignal) {
  const def = toolRegistry.get(name);
  if (!def) return Promise.resolve(err(useLabStore.getState, "INVALID_INPUT", `Unknown tool "${name}".`));
  return runTool(def)(input, { signal });
}

export interface AgentPanelProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * The in-app lab partner: a right-hand sheet that runs `runAgent` against the live store, so the
 * human can watch it call the same WebMCP tools ChatGPT would. The sheet is non-modal with no
 * backdrop: the bench stays visible and clickable while the agent works, and only Escape or the
 * close button dismiss it. `open`/`onOpenChange` mirror
 * `ui.agentPanelOpen`/`toggleAgentPanel`; the caller (LabShell) owns that wiring, same as it
 * does for every other dialog. Keyboard shortcut A toggles the panel via `useKeyboard`.
 */
export function AgentPanel({ open, onOpenChange }: AgentPanelProps) {
  const [state, setState] = useState<AgentState>(createInitialAgentState);
  const [text, setText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const running = state.phase === "thinking" || state.phase === "executing";
  const missingKey = state.phase === "error" && state.error === MISSING_KEY_ERROR;
  const [runId, setRunId] = useState(0);
  const wasRunning = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [state.transcript]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // A fresh key per run so the progress bar's `initial` width (0) re-applies on mount instead of
  // animating backward from wherever the previous run left it.
  useEffect(() => {
    if (running && !wasRunning.current) setRunId((v) => v + 1);
    wasRunning.current = running;
  }, [running]);

  const send = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || running) return;
    setText("");
    const controller = new AbortController();
    abortRef.current = controller;
    await runAgent({
      userText: trimmed,
      state,
      signal: controller.signal,
      execute: (name, input) => execute(name, input, controller.signal),
      fetchModel: (input) => fetchModel(input, controller.signal),
      onState: setState,
    });
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent side="right" overlay={false} className="gap-0 p-0 data-[side=right]:w-[380px] data-[side=right]:sm:max-w-[380px]">
        <SheetHeader className="flex-row items-center gap-2 border-b border-hairline pt-4 pr-10 pb-3 pl-3">
          <Sparkles size={14} className="text-amber" />
          <SheetTitle>Lab partner</SheetTitle>
          <span className={clsx("ml-auto h-1.5 w-1.5 rounded-full", DOT_COLOR[state.phase])} aria-hidden />
          <span className="text-xs text-ink-3">{DEFAULT_MODEL_LABEL}</span>
        </SheetHeader>

        <div className="h-0.5 shrink-0 overflow-hidden bg-transparent">
          <motion.div
            key={runId}
            className="h-full bg-amber"
            initial={{ width: "0%" }}
            animate={{
              width: running ? "78%" : state.phase === "done" ? "100%" : "0%",
              opacity: running || state.phase === "done" ? 1 : 0,
            }}
            transition={{
              width: { duration: running ? 1.6 : 0.2, ease: [0.23, 1, 0.32, 1] },
              opacity: { duration: state.phase === "done" ? 0.3 : 0, delay: state.phase === "done" ? 0.3 : 0 },
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {state.transcript.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-lg border border-hairline px-2.5 py-2 text-left text-xs text-ink-2 transition-colors hover:border-hairline-strong hover:text-ink"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {state.transcript.map((entry) => (
                <AgentMessage key={entry.id} entry={entry} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {missingKey ? (
          <p className="border-t border-hairline px-3 py-2 text-xs text-danger">Set OPENAI_API_KEY to enable the in-app agent.</p>
        ) : state.phase === "error" && state.error ? (
          <p className="border-t border-hairline px-3 py-2 text-xs text-danger">{state.error}</p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
          className="flex items-center gap-2 border-t border-hairline p-2.5"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask the lab partner…"
            disabled={running}
            className="flex-1"
          />
          {running ? (
            <Button type="button" variant="outline" size="icon" onClick={stop} aria-label="Stop">
              <Square size={14} />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={text.trim().length === 0} aria-label="Send">
              <ArrowUp size={14} />
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
