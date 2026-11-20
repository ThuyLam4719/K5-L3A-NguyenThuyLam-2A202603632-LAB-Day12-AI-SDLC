# Changelog

## Phase 1 — Contract v1.0

- Added deterministic Three.js lantern-island game, player controls, light collection and headless runner.

## Phase 2 — Contract v1.1

- Added dash, pulse, wind, charm and enemy mechanics, with regression fixtures.

## Phase 3 — Contract v1.2

Breaking changes from Phase 2 / v1.1:

- Contract version is now `1.2`; night durations are 240, 270 and 300 seconds.
- Lighting every lantern no longer ends a night. Victory is evaluated only at dawn and requires 60% of lanterns lit while the player is alive. End reasons now include `dawn_survived`; `all_lit` is removed.
- Lanterns lose fuel, can be refueled, extinguish and can be relit. Snapshots add `fuel`, `ever_lit`, `relit_count`, player `capacity`, and shade target; shade state `drain` is added.
- Scoring changes to +5 per mote, +100 first-light, +40 relight, +5 normal pulse hit, +15 pulse hit during drain; dawn rewards lit fuel and remaining flames. Time bonus is removed.
- Carry capacity now grows by 2 per successful light, capped at 20.
- Base player movement speed increases from 6 to 7.5 m/s.
- Phase 1–2 tests were updated where the replaced win, scoring, speed or safe-zone assumptions no longer apply; Phase 2 mechanics remain in the regression suite.

Presentation additions: Nezuko-inspired player model, fuel bars and low-fuel blinking, flatten/tear silhouette for unlit lamps, saved colorblind palette option, and original synthesized Japanese-style ambient music.

## Character follow-up

- Added an optional GLB loader at `public/assets/models/nezuko.glb`; the built-in character remains as fallback until a model file is supplied.

## Phase 4 — Contract v1.3

- Updated contract with browser benchmark and 10-night same-process soak commands. Added deterministic input generation, outcome and RSS reporting for soak runs.
- Added benchmark scene with exactly 200 wandering shades, 100 motes and three full lanterns; Chromium collects FPS percentiles and load timing after a 3-second warm-up.
- Added local top-10 leaderboard with persistent browser storage, name validation, score ordering, and JSON export command.
- Added saved key remapping with duplicate detection, reset control, reduced motion and 1.25× text size; added visible shade/wind warnings.
- Replaced decorative emoji glyphs with simple 2D CSS icons, removed background music and the YouTube audio player, and added demo-video capture tooling.
- Reduced GPU work: disabled soft shadows and per-mote point lights, shared mote geometry/material, limited device pixel ratio to 1.25 and throttled DOM HUD updates to 10 Hz.
- Contract version is now `1.3`; gameplay engine/headless v1.0–v1.2 mechanics remain unchanged.
