# Phase 2 — Verification evidence

## Automated checks

Run from the repository root:

```text
node tests/run-tests.js
Results: 59 passed, 0 failed, 59 total

npm run build
Vite production build completed successfully.
```

The production JavaScript bundle is 534.35 kB minified (137.15 kB gzip); Vite prints its large-chunk advisory. The soundtrack is copied separately under `dist/audio/`.

## Full-night headless runs

Command used for each night:

```bash
node src/headless.js --seed 4242 --night N --scenario docs/proof/phase2_fullnight_scenario.json --ticks 21600 --out docs/proof/nightN_headless.jsonl --snapshot-every 18000
```

The shared scenario disables enemies and motes so the runner measures a complete 300-second simulation rather than ending early from combat. It uses a 60 Hz fixed step and terminates at the dawn loss condition.

| Night | Ticks | End state | Local elapsed |
|---|---:|---|---:|
| 1 | 18,000 | lost / dawn | 0.180 s |
| 2 | 18,000 | lost / dawn | 0.093 s |
| 3 | 18,000 | lost / dawn | 0.104 s |

The corresponding JSONL files are next to this report. The final records show `ticks: 18000`, `state: "lost"`, and a final snapshot with `time_left_s: 0`.

## Browser performance

A graphical production build succeeds. I did not obtain a valid 1280×720 average-FPS measurement. The browser inspection was interrupted by the user pressing Escape during reload, so the required 30 FPS average remains unverified. See also the limitation in [`../spec/phase2.md`](../spec/phase2.md).
