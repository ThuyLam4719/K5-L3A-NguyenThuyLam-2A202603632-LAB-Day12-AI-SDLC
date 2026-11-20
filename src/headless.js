#!/usr/bin/env node
/**
 * Đảo Đèn Lồng - Headless Runner
 * Chạy game không cần GUI, theo Test Contract v1.0
 *
 * Usage:
 *   node src/headless.js --seed <int> --night 1 [--scenario <file.json>]
 *       [--inputs <file.json>] --ticks <int> --out <file.jsonl>
 *       [--snapshot-every <int>]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GameEngine } from './game-engine.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        args[name] = val;
        i++;
      } else {
        args[name] = true;
      }
    }
  }
  return args;
}

function loadJSON(path) {
  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    process.stderr.write(`Error loading JSON file ${path}: ${e.message}\n`);
    process.exit(2);
  }
}

function validateInputs(inputs) {
  if (!inputs || !inputs.frames) {
    process.stderr.write('Invalid inputs file: missing "frames" array\n');
    process.exit(2);
  }
  if (!Array.isArray(inputs.frames)) {
    process.stderr.write('Invalid inputs file: "frames" must be an array\n');
    process.exit(2);
  }
  // Validate tick ordering
  let prevTick = -1;
  for (const frame of inputs.frames) {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame) || !Number.isInteger(frame.tick) || frame.tick < 0 || frame.tick <= prevTick) {
      process.stderr.write(`Invalid inputs file: each frame needs an increasing non-negative integer tick (got ${frame?.tick})\n`);
      process.exit(2);
    }
    if (frame.move !== undefined && (!Array.isArray(frame.move) || frame.move.length !== 2 || frame.move.some(v => !Number.isFinite(v) || v < -1 || v > 1))) {
      process.stderr.write(`Invalid inputs file: frame ${frame.tick} move must be [x,z] within [-1,1]\n`); process.exit(2);
    }
    if (frame.cam_yaw_deg !== undefined && !Number.isFinite(frame.cam_yaw_deg)) { process.stderr.write('Invalid inputs file: cam_yaw_deg must be finite\n'); process.exit(2); }
    for (const key of ['jump','interact','pulse','dash','pause']) if (frame[key] !== undefined && typeof frame[key] !== 'boolean') { process.stderr.write(`Invalid inputs file: ${key} must be boolean\n`); process.exit(2); }
    prevTick = frame.tick;
  }
  return inputs;
}

function validateScenario(scenario) {
  if (typeof scenario !== 'object' || scenario === null) {
    process.stderr.write('Invalid scenario file: must be a JSON object\n');
    process.exit(2);
  }
  const vec = (v, key) => { if (!Array.isArray(v) || v.length !== 3 || v.some(n => !Number.isFinite(n))) { process.stderr.write(`Invalid scenario file: ${key} must be a finite [x,y,z] vector\n`); process.exit(2); } };
  if (scenario.player !== undefined && (!scenario.player || typeof scenario.player !== 'object' || Array.isArray(scenario.player))) { process.stderr.write('Invalid scenario file: player must be an object\n'); process.exit(2); }
  if (scenario.player?.pos !== undefined) vec(scenario.player.pos, 'player.pos');
  for (const key of ['carried','flames','successful_lights','invuln_ticks','dash_cd_ticks','pulse_cd_ticks','charm_ticks']) if (scenario.player?.[key] !== undefined && (!Number.isFinite(scenario.player[key]) || scenario.player[key] < 0)) { process.stderr.write(`Invalid scenario file: player.${key} must be non-negative\n`); process.exit(2); }
  for (const [i,l] of (scenario.lanterns||[]).entries()) for (const key of ['lit','ever_lit']) if (l[key] !== undefined && typeof l[key] !== 'boolean') { process.stderr.write(`Invalid scenario file: lanterns[${i}].${key} must be boolean\n`); process.exit(2); }
  for (const [i,l] of (scenario.lanterns||[]).entries()) for (const key of ['fuel','relit_count','deposited']) if (l[key] !== undefined && (!Number.isFinite(l[key]) || l[key] < 0)) { process.stderr.write(`Invalid scenario file: lanterns[${i}].${key} must be non-negative\n`); process.exit(2); }
  for (const [i,s] of (scenario.shades||[]).entries()) if (s.target_lantern_id !== undefined && s.target_lantern_id !== null && typeof s.target_lantern_id !== 'string') { process.stderr.write(`Invalid scenario file: shades[${i}].target_lantern_id must be a string or null\n`); process.exit(2); }
  for (const key of ['random_motes','random_shades','random_drifters','wind_enabled']) if (scenario[key] !== undefined && typeof scenario[key] !== 'boolean') { process.stderr.write(`Invalid scenario file: ${key} must be boolean\n`); process.exit(2); }
  for (const key of ['motes','shades','drifters','charms','lanterns']) if (scenario[key] !== undefined && !Array.isArray(scenario[key])) { process.stderr.write(`Invalid scenario file: ${key} must be an array\n`); process.exit(2); }
  for (const [i, m] of (scenario.motes || []).entries()) vec(Array.isArray(m) ? m : m?.pos, `motes[${i}].pos`);
  for (const [key, list] of [['shades',scenario.shades],['drifters',scenario.drifters],['charms',scenario.charms],['lanterns',scenario.lanterns]]) for (const [i, obj] of (list || []).entries()) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { process.stderr.write(`Invalid scenario file: ${key}[${i}] must be an object\n`); process.exit(2); }
    if (key !== 'lanterns' || obj.pos !== undefined) vec(obj.pos, `${key}[${i}].pos`);
  }
  if (scenario.time_left_s !== undefined && (!Number.isFinite(scenario.time_left_s) || scenario.time_left_s < 0)) { process.stderr.write('Invalid scenario file: time_left_s must be non-negative\n'); process.exit(2); }
  return scenario;
}

function main() {
  const args = parseArgs(process.argv);

  if (args['export-leaderboard']) {
    let entries=[];
    if (existsSync('leaderboard.json')) {
      const source=JSON.parse(readFileSync('leaderboard.json','utf8'));
      entries=Array.isArray(source)?source:(Array.isArray(source.entries)?source.entries:[]);
    }
    entries=entries.filter(e=>e&&typeof e.name==='string'&&Number.isFinite(e.score)&&Number.isInteger(e.nights_won)&&typeof e.achieved_at==='string'&&Number.isInteger(e.seed))
      .sort((a,b)=>b.score-a.score||Date.parse(a.achieved_at)-Date.parse(b.achieved_at)).slice(0,10);
    writeFileSync(String(args['export-leaderboard']),JSON.stringify({entries},null,2)+'\n','utf8');
    process.exit(0);
  }

  // Required params
  const seed = Number(args.seed);
  if (!Number.isInteger(seed)) {
    process.stderr.write('Missing or invalid --seed\n');
    process.exit(1);
  }

  const night = Number(args.night);
  if (isNaN(night) || ![1, 2, 3].includes(night)) {
    process.stderr.write('Missing or invalid --night (must be 1, 2, or 3)\n');
    process.exit(1);
  }

  const totalTicks = Number(args.ticks);
  if (!Number.isInteger(totalTicks) || totalTicks <= 0) {
    process.stderr.write('Missing or invalid --ticks\n');
    process.exit(1);
  }

  const outPath = args.out;
  if (!outPath) {
    process.stderr.write('Missing --out\n');
    process.exit(1);
  }

  const snapshotEvery = args['snapshot-every'] === undefined ? 10 : Number(args['snapshot-every']);
  if (!Number.isInteger(snapshotEvery) || snapshotEvery <= 0) { process.stderr.write('Invalid --snapshot-every (must be positive integer)\n'); process.exit(1); }

  // Optional: scenario
  let scenario = null;
  if (args.scenario) {
    scenario = validateScenario(loadJSON(args.scenario));
  }

  // Optional: inputs
  let inputs = null;
  if (args.inputs) {
    inputs = validateInputs(loadJSON(args.inputs));
  }

  // Create engine
  const engine = new GameEngine(seed, night);

  // Apply scenario
  if (scenario) {
    engine.applyScenario(scenario);
  }

  // Build input map: tick -> frame
  const inputMap = new Map();
  if (inputs) {
    for (const frame of inputs.frames) {
      inputMap.set(frame.tick, frame);
    }
  }

  // Output buffer
  const lines = [];

  function writeLine(obj) {
    lines.push(JSON.stringify(obj));
  }

  // Snapshot at tick 0 (before any step)
  writeLine(engine.getSnapshot());
  for (const evt of engine.events) writeLine(evt);
  engine.events = [];

  // Run simulation
  for (let t = 0; t < totalTicks; t++) {
    // Apply input for this tick
    if (inputMap.has(t)) {
      engine.setInput(inputMap.get(t));
    }

    // Step
    engine.step();

    // Write events
    for (const evt of engine.events) {
      writeLine(evt);
    }

    // Snapshot
    if (engine.tick % snapshotEvery === 0) {
      writeLine(engine.getSnapshot());
    }

    // Check game over
    if (engine.state === 'won' || engine.state === 'lost') {
      break;
    }
  }

  // Final snapshot if not already written
  if (engine.tick % snapshotEvery !== 0) {
    writeLine(engine.getSnapshot());
  }

  // End record (mandatory last line)
  writeLine(engine.getEndRecord());

  // Write output
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');

  process.exit(0);
}

main();
