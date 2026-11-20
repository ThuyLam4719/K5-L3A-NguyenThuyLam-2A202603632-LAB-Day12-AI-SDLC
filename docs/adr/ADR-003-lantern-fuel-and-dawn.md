# ADR-003 — Lantern fuel and dawn survival

- **Status:** Accepted
- **Date:** 2026-11-20
- **Scope:** Phase 3 / Test Contract v1.2

## Context

Playtests showed that lighting every lantern ended a night too early. Ticket 03 changes the objective to keeping enough lanterns lit until dawn and makes lit lanterns deplete over time. This replaces the Phase 1–2 instant-win rule, the no-refill rule, and their score/timer bonuses.

## Decisions

1. Store fuel as integer `fuelUnits`, where 60 units equal one displayed fuel point. Natural decay removes 1 unit per simulation tick; each draining shade removes 5 units per tick. This makes 1 fuel/second and 5 fuel/second exact at 60 Hz. Snapshots round to one decimal place.
2. Preserve `ever_lit` and per-lantern `relit_count` independently of current `lit`. First lighting costs 10 motes; relighting costs 5. Refueling a lit lantern uses the ticket's ceiling rule and never exceeds 100.
3. Only `wander` shades select targets. They prefer the nearest lit lantern below 30 fuel, then the nearest unlit lantern, with lantern ID as tie-break. `chase` retains its target. At 2 m, a shade enters `drain`; proximity to the player, light recovery, extinction, range or a pulse exits that state.
4. Evaluate victory only at the end of the dawn tick, after fuel, collisions and other tick updates. Zero flames always takes precedence. Dawn victory requires `ceil(0.6 × lantern_count)` lit lanterns and awards only the ticket's remaining-fuel and remaining-flame points.
5. Keep a base carrying capacity of 10 and add 2 after every successful first-light or relight, capped at 20. Scenario-provided successful-light counts initialize capacity, but scenario lamps do not count as player successes.
6. Increase normal player movement to 7.5 m/s. This is the Phase 3 movement boost; dash and charm movement remain distinct.
7. Use a Nezuko-inspired original 3D silhouette and a browser-synthesized Japanese-style ambient cue. The Demon Slayer film recording/melody is not bundled.

## Consequences

- Headless output changes intentionally because contract version, fuel snapshots/events, score rules, duration and win timing changed.
- Visual/audio-only code remains outside `game-engine.js` and must not change deterministic output.
- Tests that expected early `all_lit` victory or Phase 1–2 scores are updated in `tests/run-tests.js`; Phase 1–2 movement, pause, map and enemy regressions remain exercised.
