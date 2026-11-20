# Credits

## Engine and framework
- [Three.js](https://threejs.org/) — MIT License — 3D rendering.
- [Vite](https://vitejs.dev/) — MIT License — dev server and build.
- [Playwright](https://playwright.dev/) — Apache-2.0 — browser benchmark and demo capture automation.
- FFmpeg via the `ffmpeg-static` development tool — used to encode the demo video; the encoder binary is installed locally by npm and is not included in the game build.
- [Node.js](https://nodejs.org/) — runtime.

## Art and sound
- Built-in Nezuko-inspired 3D character, island, lantern, enemy and UI geometry: authored in this repository with Three.js primitives.
- Optional external character: user-supplied GLB at `public/assets/models/nezuko.glb`; add creator, model URL and license here before redistribution.
- No background music or third-party sound assets are included. Short gameplay interface cues are synthesized at runtime with Web Audio.

## AI assistance
- Phase 1: Google Antigravity (Gemini), as recorded in Phase 1 notes.
- Phase 2–4: OpenAI Codex — contract, engine, visuals, accessibility, performance, documentation and verification.
