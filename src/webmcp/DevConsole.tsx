"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useLabStore } from "@/store/labStore";
import { runTool } from "./runtime";
import { toolRegistry } from "./register";
import type { AnyToolDef } from "./types";

const ScriptSchema = z.array(z.object({ tool: z.string(), input: z.unknown() }));

/** True when a keydown's target is somewhere the user could be typing a literal backtick. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/** True when the dev console is allowed to exist at all: non-production build, or ?console=1. */
function consoleAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("console") === "1";
}

/** Runs one tool call through runTool: the same feed and animation path a browser agent's call takes. */
function invoke(def: AnyToolDef, input: unknown): Promise<unknown> {
  return runTool(def)(input, { signal: new AbortController().signal });
}

interface RunRecord {
  readonly tool: string;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly result: unknown;
}

/** Runs one call and times it. Kept outside the component so timing stays out of render. */
async function timedInvoke(def: AnyToolDef, input: unknown): Promise<RunRecord> {
  const startedAt = performance.now();
  const result = await invoke(def, input);
  return { tool: def.name, ok: isOk(result), durationMs: performance.now() - startedAt, result };
}

export function DevConsole(): React.JSX.Element | null {
  const open = useLabStore((s) => s.ui.devConsoleOpen);
  const toggle = useLabStore((s) => s.toggleDevConsole);
  const allowed = useMemo(() => consoleAllowed(), []);

  // The registry fills in WebMcpBoot's effect, after this component's first render, so subscribe to
  // the tool count to re-render once registration lands. Sorting 24 entries per render is cheap.
  useLabStore((s) => s.ui.webmcp.toolCount);
  const tools = [...toolRegistry.values()].sort((a, b) => a.name.localeCompare(b.name));
  const [tab, setTab] = useState<"call" | "script">("call");
  const [toolName, setToolName] = useState<string>("");
  const [inputText, setInputText] = useState("{}");
  const [scriptText, setScriptText] = useState('[\n  { "tool": "get_lab_state", "input": {} }\n]');
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [scriptRecords, setScriptRecords] = useState<ReadonlyArray<RunRecord>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) toggle();
      else if (e.key === "Escape" && open) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, open]);

  if (!allowed || !open) return null;

  const selected = tools.find((t) => t.name === toolName) ?? tools[0];

  const runOne = async () => {
    setError(null);
    if (!selected) return;
    let input: unknown;
    try {
      input = JSON.parse(inputText);
    } catch {
      setError("Input is not valid JSON.");
      return;
    }
    setRecord(await timedInvoke(selected, input));
  };

  const runScript = async () => {
    setError(null);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(scriptText);
    } catch {
      setError("Script is not valid JSON.");
      return;
    }
    const parsed = ScriptSchema.safeParse(parsedJson);
    if (!parsed.success) {
      setError(`Script must be an array of { tool, input }: ${parsed.error.issues[0]?.message ?? "invalid shape"}.`);
      return;
    }
    const steps = parsed.data;
    const results: RunRecord[] = [];
    for (const step of steps) {
      const def = tools.find((t) => t.name === step.tool);
      if (!def) {
        results.push({ tool: step.tool, ok: false, durationMs: 0, result: { error: "unknown tool" } });
        continue;
      }
      results.push(await timedInvoke(def, step.input));
    }
    setScriptRecords(results);
  };

  return (
    <div className="material-thick pointer-events-auto fixed bottom-4 right-4 z-50 flex h-[520px] w-[420px] flex-col overflow-hidden text-xs font-mono text-ink">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="font-semibold">WebMCP dev console</span>
        <button type="button" onClick={toggle} className="text-ink-3 hover:text-ink" aria-label="Close dev console">
          ×
        </button>
      </div>

      <div className="flex border-b border-hairline text-[11px]">
        <button type="button" onClick={() => setTab("call")} className={`px-3 py-1.5 ${tab === "call" ? "text-ink" : "text-ink-3"}`}>
          Call
        </button>
        <button type="button" onClick={() => setTab("script")} className={`px-3 py-1.5 ${tab === "script" ? "text-ink" : "text-ink-3"}`}>
          Script
        </button>
      </div>

      {tab === "call" ? (
        <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
          <select
            value={selected?.name ?? ""}
            onChange={(e) => {
              setToolName(e.target.value);
              const def = tools.find((t) => t.name === e.target.value);
              setInputText(JSON.stringify(def?.examples?.[0]?.input ?? {}, null, 2));
            }}
            className="rounded border border-hairline bg-surface px-2 py-1"
          >
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          {selected?.examples && selected.examples.length > 0 ? (
            <select
              defaultValue=""
              onChange={(e) => {
                const example = selected.examples?.find((ex) => ex.label === e.target.value);
                if (example) setInputText(JSON.stringify(example.input, null, 2));
              }}
              className="rounded border border-hairline bg-surface px-2 py-1"
            >
              <option value="" disabled>
                Presets…
              </option>
              {selected.examples.map((ex) => (
                <option key={ex.label} value={ex.label}>
                  {ex.label}
                </option>
              ))}
            </select>
          ) : null}

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="h-24 resize-none rounded border border-hairline bg-surface p-2"
            spellCheck={false}
          />

          <button type="button" onClick={runOne} className="rounded bg-accent px-2 py-1 text-accent-ink">
            Run
          </button>

          {error ? <p className="text-danger">{error}</p> : null}

          <div className="flex-1 overflow-auto rounded border border-hairline bg-surface p-2">
            {record ? (
              <>
                <p className={record.ok ? "text-ok" : "text-danger"}>
                  {record.tool} · {record.ok ? "ok" : "error"} · {record.durationMs.toFixed(0)}ms
                </p>
                <pre className="whitespace-pre-wrap">{JSON.stringify(record.result, null, 2)}</pre>
              </>
            ) : (
              <p className="text-ink-3">No call yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            className="h-28 resize-none rounded border border-hairline bg-surface p-2"
            spellCheck={false}
          />
          <button type="button" onClick={runScript} className="rounded bg-accent px-2 py-1 text-accent-ink">
            Run script
          </button>
          {error ? <p className="text-danger">{error}</p> : null}
          <div className="flex-1 space-y-2 overflow-auto rounded border border-hairline bg-surface p-2">
            {scriptRecords.length === 0 ? (
              <p className="text-ink-3">No script run yet.</p>
            ) : (
              scriptRecords.map((r, i) => (
                <div key={`${r.tool}-${i}`}>
                  <p className={r.ok ? "text-ok" : "text-danger"}>
                    {i + 1}. {r.tool} · {r.ok ? "ok" : "error"} · {r.durationMs.toFixed(0)}ms
                  </p>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(r.result, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isOk(result: unknown): boolean {
  return typeof result === "object" && result !== null && "ok" in result && result.ok === true;
}
