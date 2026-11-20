# AGENTS.md — Đảo Đèn Lồng

## Dự án
Game 3D Three.js (browser) và Node.js headless. Phase 4 / Test Contract v1.3 có ba Đêm.

## Kiến trúc
- `src/game-engine.js`: logic thuần, deterministic, dùng chung browser/headless; không DOM/GPU/Three.js.
- `src/headless.js`: CLI contract v1.3; `--night 1|2|3`, scenario, inputs, JSONL, leaderboard export.
- `src/bench.js`: fixed browser benchmark scene and JSON FPS/load metrics.
- `src/soak.js`: deterministic 10-night same-process soak runner and RSS metrics.
- `src/main.js`: renderer, HUD, camera, audio và menu.
- `public/index.html`: giao diện browser và HUD.
- `tests/run-tests.js`: hồi quy Phase 1–2 and unchanged Phase 3 contract.

## Lệnh
- `npm install`
- `npx vite` → `http://localhost:5173/public/index.html`
- `node src/headless.js --seed 42 --night 1 --ticks 21600 --out out.jsonl`
- `npm run bench -- --seed 42 --duration 30 --out bench.json` (requires `npx playwright install chromium` once)
- `npm run soak -- --seed 7 --nights 10 --out soak.json` (uses low-memory JIT flags for stable RSS sampling)
- `node tests/run-tests.js`

## Quy ước
- 60 tick/giây, bước cố định; đơn vị mét; trục Y hướng lên.
- Tọa độ JSONL làm tròn 3 chữ số; khoảng cách tương tác đo mặt phẳng XZ.
- Cùng seed/scenario/inputs phải cho output headless giống hệt.
- Tạm dừng tăng `tick` nhưng giữ `sim_tick` và mọi timer gameplay.
- Snapshot ban đầu ở tick 0 sau scenario; sự kiện không phát sinh do dựng scenario.
- Tuning khai trong `game.contract.json`; thay đổi visual/audio không được sửa output headless.
- Fuel lưu bằng số nguyên theo đơn vị 1/60; chỉ làm tròn khi ghi snapshot/event.
- Renderer performance changes must not alter headless output; benchmark-only scene setup lives in `src/main.js`.

## Không được
- Import thư viện render vào `game-engine.js`.
- Thêm test luôn pass hoặc làm thay đổi kết quả chỉ để né contract.
- Commit `.env`, API key hoặc token.
