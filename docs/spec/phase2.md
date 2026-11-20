# Phase 2 — Acceptance criteria (Contract v1.1)

This document defines observable acceptance criteria for the Phase 2 feature set. Coordinates and timing use meters, seconds, XZ distance, and 60 fixed ticks per second.

## Core and maps

- [x] Night 1 uses a radius-40 island, player start `(0,0,0)`, the five specified lantern coordinates, and the 8 + 16 mote spawn points. Shades spawn at the twelve radius-37 points, first at tick 300, then every 480 sim ticks, capped at six.
- [x] Night 2 has radius-28 islands centered at `(0,0,0)` and `(70,0,0)`, a bridge covering x=26..44 and z=−2..2, six lanterns, specified mote/shade points, and two launch pads. Launch keeps its velocity for 84 ticks.
- [x] Night 3 has a radius-45 island, base/ring/summit floor heights, two ramps, seven specified lanterns, 30 mote points, 16 shade points, the summit jump pad, and the non-climbable bell tower in the browser scene.
- [x] Night durations are supplied by contract and the headless CLI accepts only nights 1, 2, or 3. Headless output is deterministic for equal seed, scenario, and inputs.
- [x] Contract scoring awards 10 points per mote deposited, 100 per lantern, 5 per shade hit by each pulse, and the specified victory bonuses. Campaign UI accumulates successful-night scores.

## Phase 2 gameplay features

### 1. Gió Lạc
- [x] Nights 2–3 can spawn deterministic `D1…` drifters at 1200-sim-tick intervals, with at most two active.
- [x] An idle drifter chases when the player carries at least five motes within 15 m; contact at XZ distance ≤1.2 steals up to three and flees for 240 ticks without damaging flames.
- [x] Pulse makes a chasing drifter flee without stealing. Pulsing a fleeing drifter with stolen motes drops them at its location and removes it after the recovery period.
- [x] Snapshot and event records include drifter state, stolen amount, steals, and drops.

### 2. Bùa Gió
- [x] Night 2 places C1 at `(35,0,0)`; Night 3 places C1/C2 at the specified locations.
- [x] Pickup refreshes the 600-tick charm; speed becomes 7.2 m/s and dash cooldown is removed. Unavailable charms respawn after 2700 ticks.
- [x] `charm_picked` reports charm id and duration; charm availability and respawn seconds appear in snapshots.

### 3. Campaign flow
- [x] Menu selection offers all three named nights with a short Ông Đăng introduction.
- [x] A win offers the next night; a loss offers retry; Night 3 victory shows dawn and the total score.

### 4. Pause
- [x] Esc/P toggles pause. Pause/resume events are recorded. Wall `tick` advances while `sim_tick`, gameplay timers, movement and spawns freeze.
- [x] Pause menu offers continue, retry, settings and return to menu.

### 5. Settings
- [x] Volume and mouse sensitivity controls apply immediately and persist in local storage across reloads.

### 6. Audio
- [x] Local Japanese koto BGM starts after the user's start action, loops, pauses with the game, and follows the volume setting.
- [x] Short synthesized cues cover pickup, charm, lighting, pulse, hit/theft, jump/dash, enemy spawn, gust warning/start, victory/defeat and the final ten seconds.

### 7. HUD
- [x] HUD shows flames, mm:ss timer, lantern count, score, ten carried-mote slots, dash/pulse cooldowns, near-lantern deposit hint and an off-screen nearest-lantern arrow.
- [x] Timer turns red and blinks at 30 seconds or less.

### 8. Visual brightness and palette intent
- [x] Ambient intensity follows `0.15 + 0.55 × lit lanterns / total lanterns`.
- [x] Night background, fog and ground are slightly brighter than Phase 1 while retaining the warm lantern / cool danger palette.

## Contract and quality checks

- [x] `game.contract.json` is version 1.1 and declares normalized scores, dash tuning and all three durations.
- [x] Snapshot adds night, wind, player velocity/grounding/timers, active mote details, drifters and charms. Scenario supports the new fields and input supports rising-edge dash/pause.
- [x] Bóng Mực snapshots use only the v1.1 state names: spawning, wander, chase, recoil, stunned.
- [x] Phase 1 unit/headless checks and Phase 2 headless scenarios run through `node tests/run-tests.js`.
- [ ] 30 FPS average at 1280×720 still needs measurement on the grading laptop; JavaScript build is 534.35 kB minified (137.15 kB gzip).
