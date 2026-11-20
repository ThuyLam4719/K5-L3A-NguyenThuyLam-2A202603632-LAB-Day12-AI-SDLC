# Phase 3 — Acceptance criteria (Contract v1.2)

## Lamp fuel
- [x] Fuel is integer 1/60 units internally; snapshots display one decimal. First light/re-light sets 100; natural decay is one unit per tick.
- [x] Refuel consumes `min(carried, ceil((100-fuel)/10))`, adds 10 per mote up to 100, awards +5 per mote, and emits nothing when full.
- [x] Interact selects the nearest eligible lamp; exact ties use ID order. First light costs 10; relight costs 5. `ever_lit` persists and `relit_count` increments.
- [x] Fuel exhaustion extinguishes immediately, clears deposited progress, emits `lantern_out`, and retains `ever_lit`.
- [x] Browser shows a fuel bar; low fuel blinks at 1 Hz. Unlit lamps are flattened and have a paper tear mark.

## Ink shades
- [x] Fuel below 30 removes safe-zone protection; exactly 30 remains protected.
- [x] `wander` selects nearest weak lit lamp, otherwise nearest unlit lamp; target ties use ID. `chase` retains its target.
- [x] Within 2 m, shade drains 5 fuel/second; multiple shades stack. `fuel_drain` is emitted every 60 drain ticks.
- [x] Drain transitions to chase/stunned/wander under the ticket conditions; protected-lamp recovery pushes nearby shades outward and grants 30 ticks without damage.
- [x] Snapshot includes `target_lantern_id`; `drain` is a recognized state. Pulse during drain scores 15.

## Dawn and score
- [x] Durations: 240 / 270 / 300 seconds. All lamps lit does not end the night early.
- [x] Dawn needs 3/5, 4/6, or 5/7 lamps lit and positive flames; `no_flames` wins precedence on the final tick.
- [x] Dawn win uses `dawn_survived`; dawn failure uses `dawn`; no flames uses `no_flames`.
- [x] Ticket score table replaces old score and time bonus.
- [x] Capacity begins at 10, increases by 2 per successful player lighting/relighting, and caps at 20; scenario lamps do not count.

## UI, contract and compatibility
- [x] Contract v1.2 declares all Ticket 03 tuning keys and adds required snapshot/scenario/event fields.
- [x] Saved colorblind setting switches shade rim/eyes to `#00B3FF` and urgent timer to white with `⚠`; lamp states also differ by shape/marking.
- [x] Player speed is 7.5 m/s. Character has a Nezuko-inspired kimono, long dark hair, ribbon and bamboo muzzle silhouette.
- [x] Original generated Japanese-style ambient cue replaces the licensed koto MP3; no Demon Slayer recording/melody is included.
- [x] Phase 1–2 regression suite retained and obsolete assumptions updated with reasons in ADR-003 and CHANGELOG.md.
- [x] Verified by 84 automated checks and production build; see [proof](../proof/phase3.md).
