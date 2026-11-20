# Phase 2 — Assumptions and AI notes

## Assumptions where PRD-2 omitted a numeric value

- Each night uses 300 seconds. The supplied PRD text names duration tuning keys but does not give distinct duration values.
- Basic dash is 14 m/s for 12 ticks (0.2 s) with 2 s cooldown. The charm description explicitly gives the dash speed and duration; the basic cooldown was unspecified, so 2 s is a playable default.
- Dropped motes last 30 seconds, matching the required `ttl_s` field while keeping the scenario reproducible.
- Wind first begins at simulation tick 1800 (30 s), lasts 300 ticks, warns at tick 1680, then repeats every 1800 ticks.

These values are centralized in `game.contract.json` or engine constants. The phase spec does not include the promised explicit per-channel color table, so colors follow the described warm-light / cool-danger palette and ambient-light formula.

## AI use log

- **Tool:** OpenAI Codex.
- **Work:** Read Phase 2 PRD, reconciled the engine/contract, added nights, movement and enemy mechanics, added UI/audio, wrote scenario-based checks, and updated agent/project docs.
- **Token estimate:** not recorded by the environment; no exact token count is claimed.

## Verification performed

See [`../proof/phase2.md`](../proof/phase2.md) for reproducible commands and recorded results.
