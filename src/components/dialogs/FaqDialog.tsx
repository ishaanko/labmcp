"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const EXAMPLE_PROMPTS: ReadonlyArray<string> = [
  "Help me find the acid concentration in the flask. Dispense the coarse part, then let me handle the endpoint.",
  "I added some by hand. Where are we now?",
  "Bring this solution to pH 7.",
  "Which sample is the carbonate?",
  "What just happened? Explain the reaction.",
  "List the reagents on the shelf.",
  "Undo my last action.",
];

const SCENARIOS: ReadonlyArray<{ title: string; body: string }> = [
  { title: "Sandbox", body: "An empty bench and every reagent, for free mixing." },
  { title: "Titration", body: "Find an unknown acid's concentration with a burette and a pH meter." },
  { title: "Reaction mystery", body: "Four unlabeled samples on the bench. Test them to find which pair makes a gas, a precipitate, or a color change." },
  { title: "Precipitation", body: "Mix two solutions and watch a solid form." },
  { title: "Neutralize to pH 7", body: "Bring a beaker to pH 7.0 ± 0.1 with the reagents on the shelf." },
  { title: "Dilution", body: "Prepare 100 mL of 0.10 M solution from a 1.0 M stock." },
  { title: "Solubility", body: "Dissolve a solid, then heat and cool it to watch how much stays dissolved." },
];

type FaqDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Judge-facing FAQ: what LabMCP is, how to drive it, and prompts to try with the agent. */
export function FaqDialog({ open, onOpenChange }: FaqDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>About LabMCP</DialogTitle>
          <DialogDescription>One lab, two interfaces. A human has hands, an agent has WebMCP tools, and both act on the same experiment.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="flex flex-col gap-5 text-sm">
            <section className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">How to use it</h3>
              <p className="text-foreground">
                Drag reagents, instruments, and indicators onto the bench with the mouse, same as a real bench. To bring in the agent, press{" "}
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">A</kbd> or click <span className="font-medium">Agent</span> in the
                top bar, then type a request. The agent calls the same tools a person's clicks call, so every action shows up as a feed entry on the bench.
              </p>
              <p className="text-foreground">
                LabMCP also registers its tools on <code className="rounded bg-muted px-1 py-0.5 text-xs">document.modelContext</code>, so the ChatGPT desktop
                app's built-in browser can drive the bench directly, with no server call on this side.
              </p>
            </section>
            <section className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">Example prompts</h3>
              <ul className="flex flex-col gap-1">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <li key={prompt} className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-foreground">
                    &ldquo;{prompt}&rdquo;
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">Scenarios</h3>
              <ul className="flex flex-col gap-1.5">
                {SCENARIOS.map((scenario) => (
                  <li key={scenario.title}>
                    <span className="font-medium text-foreground">{scenario.title}.</span> <span className="text-muted-foreground">{scenario.body}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-1.5">
              <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">Good to know</h3>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                <li>Tools never hand the agent a hidden answer: it reads pH, color, and volume the same way a person does, by attaching an instrument.</li>
                <li>Either party can undo. One command reverses atomically, reaction products included.</li>
                <li>Switch scenarios any time from the menu next to the LabMCP wordmark; the bench and feed reset with it.</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
