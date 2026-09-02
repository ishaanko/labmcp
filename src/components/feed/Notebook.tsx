"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { selectNotebook } from "@/store/selectors";
import { renderNotebookMarkdown } from "@/lib/notebook";
import { SourceBadge } from "@/components/ui-legacy/SourceBadge";
import { Button } from "@/components/ui-legacy/Button";

/** Append-only lab notebook, derived from `lab.observations`. Undo never rewinds it. */
export function Notebook() {
  const rows = useLabStore(selectNotebook);
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(renderNotebookMarkdown(rows));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-2xs text-ink-3">{rows.length} entries</p>
        <Button size="sm" variant="ghost" onClick={() => void copy()}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy notebook"}
        </Button>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.seq} className="flex items-start gap-2 rounded-xs px-1.5 py-1 text-sm hover:bg-surface-thin">
            <SourceBadge actor={row.actor} className="mt-0.5" />
            <p className="min-w-0 flex-1 text-ink">{row.text}</p>
            <span className="tabular shrink-0 text-2xs text-ink-3">{row.clockS.toFixed(0)}s</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
