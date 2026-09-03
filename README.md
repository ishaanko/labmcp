# LabMCP

A virtual chemistry lab that a human and an AI agent share. The human drags, pours, and heats glassware on a flat 2D bench. The agent uses WebMCP tools such as `dispense`, `measure_ph`, and `transfer`. Both act on one lab state, and every action animates in the same view.

Live: https://labmcp.vercel.app

Built for the OpenAI WebMCP Challenge, September 2026. MIT license.

## Set up

```bash
pnpm install
cp .env.example .env.local
pnpm dev          # http://localhost:3000
```

`.env.local` needs one variable to enable the in-app lab partner:

| Variable | Required | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes, for the in-app agent | none |
| `OPENAI_MODEL` | no | `gpt-5.4` |

Without a key, the bench and the WebMCP tools still work. The agent panel shows a message asking for the key instead of running.

## Two ways to bring an agent

**In-app lab partner.** Press `A`, or click the Agent button, to open the panel. It calls `POST /api/agent`, which sends the conversation to the OpenAI Responses API. The server picks one tool, the client runs it through the same `runTool` path a mouse click uses, and the result feeds back to the model. This repeats until the model has no more tool calls left, or the step limit is hit.

**ChatGPT desktop app.** Open the live URL in the built-in browser. The page registers 24 tools on `document.modelContext` when it loads. ChatGPT drives the tools directly; no server route on this side is involved. Ask, for example:

- "Help me find the acid concentration in the flask. Dispense the coarse part, then let me handle the endpoint."
- "What just happened in the beaker?"
- "Add 10 mL of water to Beaker 2 and tell me the new volume."

Google Chrome: enable `chrome://flags/#enable-webmcp-testing`, relaunch, and use the Model Context Tool Inspector extension to list and invoke the tools.

Any browser: add `?console=1` to the URL and press the backtick key. The console lists the registered tools, runs one with JSON input, or runs a script of several calls in sequence. Calls made from the console take the same path as calls from a real agent.

## Scenarios

- Sandbox. Empty bench, all reagents on the shelf. Mix salts, watch precipitates form, dilute, heat.
- Titration (default). A flask holds an unknown strong acid, a burette holds 0.100 M NaOH, a pH meter waits in its holder. Attach the probe, add phenolphthalein, dispense to the endpoint, then reveal.
- Reaction mystery. Three unlabeled samples. Test each against the known reagents to find the pair that makes a gas, a precipitate, or a color change.
- Precipitation. Mix silver nitrate and sodium chloride in a beaker and watch a white precipitate form.
- Neutralization challenge. Bring a beaker to pH 7 ± 0.1 using the reagents on the shelf.
- Dilution challenge. Prepare 100 mL of 0.10 M solution from a 1.0 M stock.
- Temperature and solubility. Dissolve a solid, then heat and cool it to watch its solubility change.

## Shelf

Acids and bases: hydrochloric acid, sodium hydroxide, acetic acid (weak acid), ammonia (weak base). Salts: silver nitrate, sodium chloride, calcium chloride, barium chloride, sodium carbonate, sodium bicarbonate, sodium sulfate, copper(II) sulfate. Solid, dosed by mass: potassium nitrate. Also water and the three indicators (phenolphthalein, universal, litmus).

## Tools

Read-only tools set `readOnlyHint`. The lab is instrumented, not omniscient: `get_lab_state` reports what a person could see and never reports pH, moles, or concentrations. The agent attaches the pH meter and reads it like anyone else. In the titration and unknown scenarios, `inspect_contents` is denied for containers that hold an unknown sample until the human reveals the result.

| Tool | Kind |
| --- | --- |
| `get_lab_state`, `list_reagents`, `list_equipment` | read |
| `measure_ph`, `measure_temperature`, `measure_volume` | read, logged to the notebook |
| `inspect_contents`, `calculate_moles`, `predict_supported_reactions` | read, permissioned |
| `get_titration_data`, `get_notebook` | read |
| `add_container`, `remove_container`, `add_reagent`, `add_indicator` | mutate |
| `transfer`, `dispense`, `stir`, `heat`, `cool` | mutate |
| `undo_last_action`, `reset_experiment`, `load_scenario`, `submit_conclusion` | mutate |

Every tool returns a plain object: `ok`, an `observation` sentence, a structured `result`, and a compact redacted `state` so the agent can plan the next call without another round trip. Errors come back as `{ ok: false, error: { code, message, suggestions } }`, never as exceptions.

## How WebMCP is wired

- `src/webmcp/register.ts` registers every tool with `document.modelContext.registerTool` under one `AbortController`. When the browser has no native implementation it installs `@mcp-b/webmcp-polyfill` so the console still works.
- `src/webmcp/tools/*.ts` define each tool with a zod input schema. `z.toJSONSchema` produces the `inputSchema`. Every field has a description.
- `src/webmcp/runtime.ts` wraps each handler: validate input, write a feed entry, dispatch a `LabCommand` through the store, attach the redacted state, return.
- The same `dispatch` serves mouse gestures and the in-app lab partner. One queue serializes human and agent commands so the later one always sees the committed state.

## How the in-app lab partner is wired

- `src/agent/loop.ts` runs the step machine: send the conversation, call the model, execute any tool calls the model asks for, feed the results back, repeat until the model stops calling tools or the step limit is hit.
- `src/app/api/agent/route.ts` is the only server route. It takes the loop's conversation and tool catalog, makes one OpenAI Responses API call, and returns the raw output items. The API key never reaches the browser.
- Tool calls from the agent panel run through `runTool`, the same function that mouse gestures and native WebMCP calls use. There is one command path for every actor.
- `src/components/agent/AgentPanel.tsx` renders the conversation and the tool calls as they run, in a non-modal side panel so the bench stays visible and clickable.

## Architecture

```
pointer/keyboard ──┐
                   ├─> store.dispatch(command, actor) ─> engine.applyCommand ─> new LabState + events
WebMCP execute ────┤                                          │
in-app agent loop ─┘                                          ├─> animation queue ─> 2D bench (src/lab2d)
                                                              ├─> activity feed, notebook, toasts
                                                              └─> tool result envelope
```

- `src/engine`: pure TypeScript. Reagent registry, curated reaction rules (neutralization, three precipitations, carbonate gas evolution), strong acid/base pH, indicator colors, undo snapshots, scenarios, and `publicView`, the single redaction point.
- `src/store`: zustand store, command queue, ticker for heating and settling.
- `src/lab2d`: the bench, an SVG grid workspace with one `BenchObject` per lab item, drag handling, and an effects overlay (pour streams, drops, the agent marker).
- `src/agent`: the in-app lab partner's step machine and its OpenAI wire types.
- `src/components`: chrome, built with shadcn/ui on Tailwind v4 and base-ui primitives, sonner for toasts, motion for transitions.

## Develop

```bash
pnpm check        # typecheck, lint, unit tests
pnpm build
```

Tests cover conservation of matter, proportional transfer, neutralization stoichiometry, pH checkpoints along a titration, capacity rejection, atomic undo, tool schema validity, the in-app agent's step machine, and that no tool response leaks a hidden identity.

## Limits

This is a teaching model, not a simulator. It handles a small set of reactions well and treats everything else as inert mixing. Concentrations, colors, and temperatures are stylized. Nothing here is guidance for real laboratory work.
