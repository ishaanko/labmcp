# LabMCP

A chemistry lab you can run with your hands, or hand to an agent. Drag reagents onto a bench, mix things, watch a titration turn pink at the endpoint. An agent can do the same thing through WebMCP tools, on the same bench, at the same time as you.

Live: https://labmcp.vercel.app

Built for the OpenAI WebMCP Challenge, September 2026. MIT licensed.

## Run it locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Add `OPENAI_API_KEY` to `.env.local` if you want the in-app agent to talk back; without it the bench and every WebMCP tool still work, you just can't chat with the built-in lab partner.

## Bring in an agent

Press `A` in the app to open the in-app lab partner, a chat panel that calls the OpenAI Responses API and runs tools through the same code path your mouse clicks use.

Or skip that entirely and open the live URL in ChatGPT's desktop browser. The page registers its tools on `document.modelContext` when it loads, so ChatGPT drives the bench directly, no server route on this end.

Ask it things like:

- "Help me find the acid concentration in the flask. Dispense the coarse part, then let me handle the endpoint."
- "What just happened in the beaker?"
- "Add 10 mL of water to Beaker 2 and tell me the new volume."

In Chrome, enable `chrome://flags/#enable-webmcp-testing`, relaunch, and use the Model Context Tool Inspector extension to list and call the tools yourself. Any browser also gets a dev console: add `?console=1` to the URL and press the backtick key.

## Scenarios

- **Sandbox.** Every reagent, empty bench, do whatever you want.
- **Titration** (default). Find an unknown acid's concentration with a burette and a pH meter.
- **Reaction mystery.** Four unlabeled samples. Figure out which one bubbles, precipitates, or changes color.
- **Precipitation.** Mix silver nitrate and sodium chloride, watch a white solid form.
- **Neutralization.** Bring a beaker to pH 7.
- **Dilution.** Make 100 mL of 0.10 M solution from a 1.0 M stock.
- **Solubility.** Dissolve a solid, then heat and cool it.

## How it works

The chemistry is a small deterministic engine (`src/engine`), a zustand store, and an SVG bench. A mouse drag, a WebMCP tool call, and the in-app agent all go through the same command queue, so the human and the agent are never out of sync with each other. `get_lab_state` only reports what a person could actually see: color, volume, cloudiness. The agent has to attach a pH meter and read it like anyone else; nothing hands it the answer.

## Tests

```bash
pnpm check
```

Covers conservation of matter, titration stoichiometry, undo, and that no tool response leaks a hidden value.

## Limits

This is a teaching model, not a real lab simulator. It handles a handful of reactions well and treats everything else as inert mixing.
