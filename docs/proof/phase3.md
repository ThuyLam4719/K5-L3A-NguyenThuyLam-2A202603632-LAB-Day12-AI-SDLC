# Phase 3 — Verification evidence

## Automated checks

`node tests/run-tests.js` — **85 passed, 0 failed**. Checks include the Phase 1–2 regressions, integer fuel decay, out/refuel/relight events and scores, drain targeting and rate, pulse interruption, all three dawn thresholds, no-flames precedence, capacity and duration.

`npm run build` — **passed**. Vite built `dist/public/index.html` and a 638.60 kB JavaScript bundle (165.84 kB gzip). Vite reports its >500 kB advisory.

## Headless dawn run

Command:

```powershell
node src/headless.js --seed 42 --night 1 --scenario docs/proof/phase3_dawn_win_scenario.json --ticks 60 --out docs/proof/phase3_dawn_win.jsonl
```

The saved JSONL ends at 60 simulation ticks with `state: "won"`, reason `dawn_survived`, three of five lamps lit, and no `all_lit` early end.

## Presentation scope

Fuel bars, low-fuel blink, the built-in Nezuko-inspired character and saved colorblind palette are in the browser renderer. The optional GLB loader uses a supplied file when present; the linked Sketchfab file is not included because its license could not be checked and no file was supplied. The requested YouTube video is available in the visible player and needs network access. No graphical FPS measurement was recorded.
