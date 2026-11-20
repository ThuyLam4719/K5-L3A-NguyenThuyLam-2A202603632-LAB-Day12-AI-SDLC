#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { GameEngine } from './game-engine.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const seed = Number(arg('seed', 7));
const nights = Number(arg('nights', 10));
const out = arg('out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1 || !out) throw new Error('Usage: node src/soak.js --seed 7 --nights 10 --out soak.json');
let rng = seed >>> 0;
const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
const rss = () => process.memoryUsage().rss / 1048576;
const results = [];
let memStart = null;
let crashes = 0;
const started = performance.now();
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  const nightSeed=seed+i+1; rng=nightSeed>>>0;
  try {
    const engine = new GameEngine(nightSeed, night);
    if (i === 0) memStart = rss();
    let move = [0, 0];
    for (let tick = 0; tick < engine.nightDuration * 60 && engine.state === 'playing'; tick++) {
      if (tick % 30 === 0) { const angle = random() * Math.PI * 2; move = [Math.sin(angle), Math.cos(angle)]; }
      engine.setInput({ move, jump: random() < .05, dash: random() < .03, pulse: random() < .02, interact: random() < .1 });
      engine.step();
    }
    results.push(engine.state === 'won' ? 'won' : 'lost');
  } catch(error) { crashes++; results.push('crash'); process.stderr.write(`Night ${i+1} failed: ${error.stack||error}\n`); }
  if (global.gc) global.gc();
}
if (global.gc) global.gc();
const report = { nights, crashes, results, mem_start_mb: Math.round(memStart * 10) / 10, mem_end_mb: Math.round(rss() * 10) / 10, duration_s: Math.round((performance.now() - started) / 100) / 10 };
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
