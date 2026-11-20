# Phase 4 — Contract v1.3 evidence

## Automated checks

- `npm test` — **86 passed, 0 failed** (Phase 1–2 regressions and unchanged Phase 3 rules included).
- `npm run test:browser` — passed leaderboard ordering/render, JSON export, saved key remapping, duplicate warning, reset, and game start/HUD. The first browser run exposed the settings panel extending below the viewport; `max-height` and scrolling were added, then the test passed.
- `npm run build` — passed. Vite reports the main minified JS chunk is 602.78 kB (156.32 kB gzip), above its advisory threshold of 500 kB; the Nezuko GLB loader is a separate lazy-loaded chunk.
- Headless leaderboard export — `node src/headless.js --export-leaderboard leaderboard-export-check.json` emitted a valid `{ "entries": [] }` for an empty local export file.

## Browser benchmark

Command: `npm run bench -- --seed 42 --duration 30 --out bench.json`

Recorded on Windows with Chromium/WebGL2 using an AMD Radeon(TM) Graphics adapter over Direct3D11. The runner opened a 1280×720 viewport, set `--disable-frame-rate-limit` and `--disable-gpu-vsync`, used the standard benchmark scene, warmed up for three seconds, then sampled 30 seconds.

| Metric | Result | Local threshold |
|---|---:|---:|
| Average FPS | 299.0 | ≥ 60 — pass |
| p1-low FPS | 38.4 | ≥ 30 — pass |
| frame time p95 | 7.1 ms | reported |
| Frames | 8,971 | reported |
| Scene load | 1,322 ms | ≤ 10,000 — pass |
| Peak RSS | `null` | Browser runner cannot read Chromium RSS reliably |

Machine-readable result: [`bench.json`](../../bench.json). These numbers are local reference values; instructor hardware remains the scoring machine.

## Soak

Command: `npm run soak -- --seed 7 --nights 10 --out soak.json`. Results: **10 nights, 0 crashes**, RSS 40.0 MiB at start and 43.2 MiB at end (1.08×, under 1.2×), 1.6 seconds wall time. All ten seeded runs ended in `lost`; the soak checks stability and reproducibility, not player win rate. Low-memory Node flags are part of the documented command to keep RSS sampling within the same-process limit.

Machine-readable result: [`soak.json`](../../soak.json).

## Visual and release notes

- The menu screenshot is [`docs/demo/menu.png`](../demo/menu.png); the recorded gameplay and test evidence are [`docs/demo/demo.mp4`](../demo/demo.mp4).
- The benchmark result sets `peak_mem_mb: null` as specified for a web build without reliable process RSS access.
- The release is a static web build. The game has no background music; brief runtime cues remain.
