# ChemLab

A virtual chemistry lab that a human and an AI agent share. The human drags, pours, and heats glassware on a 3D bench. The agent uses WebMCP tools (`transfer`, `dispense`, `measure_ph`, ...). Both act on one lab state, and every action animates in the same view.

Built for the OpenAI WebMCP Challenge (September 2026).

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Add `?console=1` to show the tool console in a browser without WebMCP.

## Test

```bash
pnpm check   # typecheck, lint, unit tests
```

## Layout

See `docs/plan.md` and `docs/design/`.
