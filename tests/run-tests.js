/**
 * Đảo Đèn Lồng - Test Suite
 * Run: node tests/run-tests.js
 */

import { GameEngine, TUNING, SeededRNG } from '../src/game-engine.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

function assertClose(a, b, eps, msg) {
  assert(Math.abs(a - b) < eps, `${msg} (got ${a}, expected ~${b})`);
}

// ========== UNIT TESTS ==========
console.log('\n=== Unit Tests ===\n');

// Test 1: SeededRNG determinism
console.log('Test: SeededRNG determinism');
{
  const rng1 = new SeededRNG(42);
  const rng2 = new SeededRNG(42);
  const vals1 = Array.from({ length: 100 }, () => rng1.next());
  const vals2 = Array.from({ length: 100 }, () => rng2.next());
  assert(JSON.stringify(vals1) === JSON.stringify(vals2), 'Same seed produces same sequence');
}

// Test 2: Game initialization
console.log('Test: Game initialization');
{
  const engine = new GameEngine(1);
  assert(engine.player.pos[0] === 0 && engine.player.pos[1] === 0 && engine.player.pos[2] === 0, 'Player starts at origin');
  assert(engine.player.flames === TUNING.flames, `Player has ${TUNING.flames} flames`);
  assert(engine.player.carried === 0, 'Player carries 0 motes');
  assert(engine.lanterns.length === 5, '5 lanterns created');
  assert(engine.motes.length === 24, 'Night 1 uses its 24 deterministic mote points');
  assert(engine.state === 'playing', 'State is playing');
}

// Test 3: Player movement
console.log('Test: Player movement');
{
  const engine = new GameEngine(1);
  engine.input.move = [0, 1]; // move forward (+Z)
  engine.input.cam_yaw_deg = 0;
  for (let i = 0; i < 60; i++) engine.step(); // 1 second
  assertClose(engine.player.pos[2], TUNING.player_speed, 0.5, 'Player moves at the increased Phase 3 speed');
}

// Test 4: Mote pickup
console.log('Test: Mote pickup');
{
  const engine = new GameEngine(1);
  // Place a mote at [2, 0, 0]
  engine.motes = [{ id: 'M0', pos: [1.5, 0, 0], active: true }];
  engine.randomMotes = false;
  engine.input.move = [1, 0]; // move right (+X)
  engine.input.cam_yaw_deg = 0;
  for (let i = 0; i < 60; i++) engine.step();
  assert(engine.player.carried >= 1, 'Player picks up nearby mote');
  assert(engine.score === 0, 'Mote score is awarded when deposited into a lantern');
}

// Test 5: Lantern deposit and lighting
console.log('Test: Lantern deposit & lighting');
{
  const engine = new GameEngine(1);
  engine.randomMotes = false;
  engine.randomShades = false;
  engine.motes = [];
  engine.shades = [];
  // Give player enough motes
  engine.player.carried = TUNING.lantern_cost;
  // Move player to lantern L1
  engine.player.pos = [...engine.lanterns[0].pos];

  // Interact
  engine.input.interact = true;
  engine.step();
  engine.input.interact = false;
  engine.step();

  assert(engine.lanterns[0].deposited === 0, 'Fuelled lantern resets deposited progress after lighting');
  assert(engine.lanterns[0].lit === true, 'Lantern is lit');
  assert(engine.player.carried === 0, 'Player carried is 0 after deposit');
  assert(engine.score === 150, 'First light awards 5 per mote plus 100 for lighting');
}

// Test 6: Pulse mechanic
console.log('Test: Pulse mechanic');
{
  const engine = new GameEngine(1);
  engine.randomMotes = false;
  engine.randomShades = false;
  engine.motes = [];
  engine.player.carried = TUNING.pulse_cost;
  engine.shades = [{
    id: 'S0',
    pos: [3, 0, 0], // within pulse_radius
    state: 'chase',
    stunTimer: 0,
  }];

  engine.input.pulse = true;
  engine.step();
  engine.input.pulse = false;

  assert(engine.shades[0].state === 'stunned', 'Shade is stunned after pulse');
  assert(engine.player.carried === 0, 'Pulse consumed motes');
  assert(engine.player.pulseCooldown > 0, 'Pulse cooldown active');
}

// Test 7: Shade collision
console.log('Test: Shade collision');
{
  const engine = new GameEngine(1);
  engine.randomMotes = false;
  engine.randomShades = false;
  engine.motes = [];
  engine.shades = [{
    id: 'S0',
    pos: [0.5, 0, 0],
    state: 'chase',
    stunTimer: 0,
  }];

  engine.step();
  assert(engine.player.flames === TUNING.flames - 1, 'Player loses a flame on shade hit');
  assert(engine.player.invulnTimer > 0, 'Invulnerability timer active');
}

// Test 8: Win condition
console.log('Test: Win condition');
{
  const engine = new GameEngine(1);
  engine.randomMotes = false;
  engine.randomShades = false;
  engine.motes = [];
  engine.shades = [];

  // Lighting every lantern no longer ends the night early.
  for (const l of engine.lanterns) { l.lit = true; l.fuelUnits = 100 * 60; l.ever_lit = true; }
  engine.step();
  assert(engine.state === 'playing', 'All lanterns lit does not end the night early');
  engine.nightDuration = 1;
  for (let i=0;i<59;i++) engine.step();
  assert(engine.state === 'won', 'Surviving until dawn with the required lantern count wins');
  assert(engine.events.some(e=>e.name==='game_over' && e.data.reason==='dawn_survived'), 'Dawn victory uses dawn_survived reason');
}

// Test 9: Lose condition - no flames
console.log('Test: Lose condition - no flames');
{
  const engine = new GameEngine(1);
  engine.randomMotes = false;
  engine.randomShades = false;
  engine.motes = [];
  engine.shades = [{
    id: 'S0',
    pos: [0.5, 0, 0],
    state: 'chase',
    stunTimer: 0,
  }];
  engine.player.flames = 1;

  engine.step();
  assert(engine.state === 'lost', 'Game lost when no flames');
}

// Test 10: Scenario loading
console.log('Test: Scenario loading');
{
  const engine = new GameEngine(1);
  engine.applyScenario({
    player: { pos: [5, 0, 5], carried: 3, flames: 2 },
    random_motes: false,
    random_shades: false,
    motes: [[10, 0, 10]],
    shades: [{ pos: [20, 0, 0] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 30], deposited: 2 }],
    time_left_s: 100,
  });

  assert(engine.player.pos[0] === 5, 'Player pos X from scenario');
  assert(engine.player.carried === 3, 'Player carried from scenario');
  assert(engine.player.flames === 2, 'Player flames from scenario');
  assert(engine.motes.length === 1, 'Only 1 mote from scenario');
  assert(engine.shades.length === 1, 'Only 1 shade from scenario');
  assert(engine.lanterns[0].deposited === 2, 'Lantern L1 deposited updated');
  assert(engine.nightDuration === 100, 'Night duration from scenario');
}

// Test 11: Determinism
console.log('Test: Determinism');
{
  function runSim(seed) {
    const engine = new GameEngine(seed);
    engine.input.move = [1, 1];
    for (let i = 0; i < 300; i++) engine.step();
    return engine.getSnapshot();
  }

  const snap1 = runSim(42);
  const snap2 = runSim(42);
  assert(JSON.stringify(snap1) === JSON.stringify(snap2), 'Same seed = identical snapshots');
}

// Test 12: Safe radius
console.log('Test: Safe radius');
{
  const engine = new GameEngine(1);
  engine.randomMotes = false;
  engine.randomShades = false;
  engine.motes = [];
  // Light lantern at [25, 0, 0]
  engine.lanterns[0].lit = true;
  engine.lanterns[0].fuelUnits = 100 * 60;
  engine.lanterns[0].pos = [25, 0, 0];
  // Place shade inside safe_radius
  engine.shades = [{
    id: 'S0',
    pos: [25, 0, 2],
    state: 'chase',
    stunTimer: 0,
  }];

  engine.step();
  assert(['recoil','wander'].includes(engine.shades[0].state), 'Shade is pushed from lit lantern safe zone');
}

// ========== HEADLESS TESTS ==========
console.log('\n=== Headless Integration Tests ===\n');

// Create test scenario and input files
const testDir = join(ROOT, 'tests', 'fixtures');
if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });

// Test H1: Basic headless run
console.log('Test: Headless basic run');
{
  const outPath = join(testDir, 'h1_out.jsonl');
  try {
    execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 42 --night 1 --ticks 60 --out "${outPath}"`, {
      cwd: ROOT,
      timeout: 10000,
    });

    const lines = readFileSync(outPath, 'utf-8').trim().split('\n');
    const first = JSON.parse(lines[0]);
    const last = JSON.parse(lines[lines.length - 1]);

    assert(first.type === 'snapshot', 'First line is snapshot');
    assert(first.tick === 0, 'First snapshot at tick 0');
    assert(last.type === 'end', 'Last line is end record');
    assert(last.ticks === 60, 'End record shows 60 ticks');
    passed++;
    console.log('  ✅ Headless runs successfully');
  } catch (e) {
    failed++;
    console.log(`  ❌ Headless failed: ${e.message}`);
  }
}

// Test H2: Determinism via headless
console.log('Test: Headless determinism');
{
  const out1 = join(testDir, 'h2_out1.jsonl');
  const out2 = join(testDir, 'h2_out2.jsonl');
  try {
    execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 123 --night 1 --ticks 120 --out "${out1}"`, { cwd: ROOT, timeout: 10000 });
    execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 123 --night 1 --ticks 120 --out "${out2}"`, { cwd: ROOT, timeout: 10000 });

    const data1 = readFileSync(out1, 'utf-8');
    const data2 = readFileSync(out2, 'utf-8');

    assert(data1 === data2, 'Two headless runs with same seed produce identical output');
  } catch (e) {
    failed++;
    console.log(`  ❌ Determinism test failed: ${e.message}`);
  }
}

// Test H3: Scenario + inputs
console.log('Test: Headless with scenario and inputs');
{
  const scenario = {
    player: { pos: [0, 0, 0], carried: 5, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    lanterns: [{ id: 'L1', pos: [0, 0, 3], deposited: 0 }],
    time_left_s: 60,
  };

  const inputs = {
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 10, move: [0, 0], interact: true },
      { tick: 11, interact: false },
    ],
  };

  const scenFile = join(testDir, 'h3_scenario.json');
  const inputFile = join(testDir, 'h3_inputs.json');
  const outPath = join(testDir, 'h3_out.jsonl');

  writeFileSync(scenFile, JSON.stringify(scenario));
  writeFileSync(inputFile, JSON.stringify(inputs));

  try {
    execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 42 --night 1 --scenario "${scenFile}" --inputs "${inputFile}" --ticks 60 --out "${outPath}"`, {
      cwd: ROOT, timeout: 10000,
    });

    const lines = readFileSync(outPath, 'utf-8').trim().split('\n');
    const events = lines.map(l => JSON.parse(l)).filter(o => o.type === 'event');
    const depositEvent = events.find(e => e.name === 'deposit');

    assert(depositEvent !== undefined, 'Deposit event found');
    if (depositEvent) {
      assert(depositEvent.data.lantern_id === 'L1', 'Deposit to L1');
    }

    passed++;
    console.log('  ✅ Scenario + inputs work');
  } catch (e) {
    failed++;
    console.log(`  ❌ Scenario+inputs test failed: ${e.message}`);
  }
}

// Test H4: Invalid inputs file -> exit code 2
console.log('Test: Headless invalid inputs -> exit 2');
{
  const badFile = join(testDir, 'bad_inputs.json');
  writeFileSync(badFile, '{"not_frames": []}');
  const outPath = join(testDir, 'h4_out.jsonl');

  try {
    execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 1 --night 1 --inputs "${badFile}" --ticks 10 --out "${outPath}"`, {
      cwd: ROOT, timeout: 10000,
    });
    failed++;
    console.log('  ❌ Should have exited with code 2');
  } catch (e) {
    assert(e.status === 2, 'Exit code 2 for invalid inputs');
  }
}

// Test H5: Mote pickup via headless
console.log('Test: Headless mote pickup');
{
  const scenario = {
    player: { pos: [0, 0, 0], carried: 0, flames: 5 },
    random_motes: false,
    random_shades: false,
    motes: [[0, 0, 1.5]],
    shades: [],
    time_left_s: 60,
  };

  const inputs = {
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
    ],
  };

  const scenFile = join(testDir, 'h5_scenario.json');
  const inputFile = join(testDir, 'h5_inputs.json');
  const outPath = join(testDir, 'h5_out.jsonl');

  writeFileSync(scenFile, JSON.stringify(scenario));
  writeFileSync(inputFile, JSON.stringify(inputs));

  try {
    execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 42 --night 1 --scenario "${scenFile}" --inputs "${inputFile}" --ticks 30 --out "${outPath}"`, {
      cwd: ROOT, timeout: 10000,
    });

    const lines = readFileSync(outPath, 'utf-8').trim().split('\n');
    const events = lines.map(l => JSON.parse(l)).filter(o => o.type === 'event');
    const pickup = events.find(e => e.name === 'mote_picked');

    assert(pickup !== undefined, 'Mote picked up event found');
    if (pickup) {
      assert(pickup.data.carried === 1, 'Carried = 1 after pickup');
    }
  } catch (e) {
    failed++;
    console.log(`  ❌ Mote pickup headless test failed: ${e.message}`);
  }
}

// ========== PHASE 2 / CONTRACT 1.1 TESTS ==========
console.log('\n=== Regression Tests: Phase 2 Compatibility on Contract 1.3 ===\n');
{
  const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf-8').replace(/^\uFEFF/, ''));
  const unknownTuning = Object.keys(contract.tuning).filter(key => !(key in TUNING));
  assert(contract.contract_version === '1.3', 'Contract declares version 1.3');
  assert(typeof contract.bench_cmd === 'string' && typeof contract.soak_cmd === 'string', 'Contract declares benchmark and soak commands');
  assert(contract.tuning.score.per_lantern === 100 && contract.tuning.score.per_mote === 5 && contract.tuning.score.per_drain_stun === 15, 'Ticket 03 scoring is declared');
  assert(unknownTuning.length === 0, 'Contract tuning keys are backed by engine values');
}
function runP2(name, night, scenario, inputs, ticks = 20) {
  const scenarioPath = join(testDir, `p2_${name}_scenario.json`);
  const inputPath = join(testDir, `p2_${name}_inputs.json`);
  const outPath = join(testDir, `p2_${name}_out.jsonl`);
  writeFileSync(scenarioPath, JSON.stringify(scenario));
  writeFileSync(inputPath, JSON.stringify(inputs));
  execSync(`node "${join(ROOT, 'src', 'headless.js')}" --seed 31 --night ${night} --scenario "${scenarioPath}" --inputs "${inputPath}" --ticks ${ticks} --out "${outPath}"`, { cwd: ROOT, timeout: 15000 });
  return readFileSync(outPath, 'utf-8').trim().split('\n').map(line => JSON.parse(line));
}
console.log('Test: Phase 2 dash scenario');
{
  const rows = runP2('dash', 1, { random_motes:false, random_shades:false, motes:[], shades:[] }, { frames:[{tick:0,move:[0,1],dash:true},{tick:1,dash:false}] });
  assert(rows.some(row => row.type === 'event' && row.name === 'dash'), 'Dash edge emits event');
  assert(rows.filter(row => row.type === 'snapshot').at(-1).player.pos[2] > 1, 'Dash increases travel distance');
}
console.log('Test: Phase 2 pause scenario');
{
  const rows = runP2('pause', 1, { random_motes:false, random_shades:false, motes:[], shades:[] }, { frames:[{tick:0,pause:true},{tick:1,pause:false},{tick:2,pause:true},{tick:3,pause:false},{tick:4,pause:true}] }, 6);
  const events = rows.filter(row => row.type === 'event').map(row => row.name);
  const paused = rows.find(row => row.type === 'snapshot' && row.state === 'paused');
  assert(events.includes('paused') && events.includes('resumed'), 'Pause and resume events recorded');
  assert(paused && paused.sim_tick < paused.tick, 'Wall ticks advance while paused simulation tick freezes');
}
console.log('Test: Phase 2 Wind Charm scenario');
{
  const rows = runP2('charm', 2, { player:{pos:[35,0,0]}, random_motes:false, random_shades:false, motes:[], shades:[] }, { frames:[] });
  assert(rows.some(row => row.type === 'event' && row.name === 'charm_picked' && row.data.charm_id === 'C1'), 'Charm pickup emits contract event');
}
console.log('Test: Phase 2 shade spawn/scoring scenarios');
{
  const spawn = runP2('shade_spawn', 1, { random_motes:false, random_shades:true, motes:[], shades:[] }, { frames:[] }, 300);
  const pulse = runP2('stunned_score', 1, { player:{carried:2}, random_motes:false, random_shades:false, motes:[], shades:[{id:'S1',pos:[3,0,0],state:'stunned',state_ticks_left:120}] }, { frames:[{tick:0,pulse:true}] });
  const initial = spawn[0];
  assert(initial.night === 1 && initial.wind.active === false && initial.player.vel.length === 3, 'v1.1 snapshot carries night, wind and player motion fields');
  assert(spawn.some(row => row.type === 'event' && row.name === 'shade_spawned'), 'Scheduled shade spawn emits an event');
  assert(pulse.filter(row => row.type === 'snapshot').at(-1).score === 5, 'Pulse scores an already-stunned shade');
}
console.log('Test: Phase 2 Drifter steal/drop scenarios');
{
  const steal = runP2('steal', 2, { player:{pos:[0,0,0],carried:5}, random_motes:false, random_shades:false, random_drifters:false, motes:[], shades:[], drifters:[{id:'D1',pos:[1,0,0],state:'chase'}] }, { frames:[] });
  const drop = runP2('drop', 2, { player:{pos:[0,0,0],carried:2}, random_motes:false, random_shades:false, random_drifters:false, motes:[], shades:[], drifters:[{id:'D1',pos:[3,0,0],state:'flee',stolen:2,state_ticks_left:200}] }, { frames:[{tick:0,pulse:true}] });
  assert(steal.some(row => row.type === 'event' && row.name === 'drifter_steal'), 'Drifter steals carried motes');
  assert(drop.some(row => row.type === 'event' && row.name === 'drifter_drop'), 'Pulse recovers motes stolen by a fleeing drifter');
}
console.log('Test: Phase 2 island and jump-pad scenarios');
{
  const bridge = runP2('bridge', 2, { player:{pos:[20,0,18]}, random_motes:false, random_shades:false, motes:[], shades:[] }, { frames:[] }, 3);
  const tower = runP2('tower', 3, { player:{pos:[0,3,13]}, random_motes:false, random_shades:false, wind_enabled:false, motes:[], shades:[] }, { frames:[] }, 3);
  assert(bridge[0].lanterns.length === 6 && bridge.filter(row => row.type === 'snapshot').at(-1).player.pos[1] > 0, 'Night 2 has six lanterns and a working launch pad');
  assert(tower[0].lanterns.length === 7 && tower.filter(row => row.type === 'snapshot').at(-1).player.pos[1] > 3, 'Night 3 has seven lanterns and a working raised launch pad');
}
console.log('Test: Phase 2 wind schedule scenario');
{
  const rows = runP2('wind', 3, { player:{flames:50}, random_motes:false, random_shades:false, wind_enabled:true, motes:[], shades:[], time_left_s:31 }, { frames:[] }, 1801);
  assert(rows.some(row => row.type === 'event' && row.name === 'wind_warning'), 'Wind warning occurs two seconds before a gust');
  assert(rows.some(row => row.type === 'event' && row.name === 'wind_started'), 'Gust starts on its scheduled tick');
}

// ========== PHASE 3 / CONTRACT 1.2 TESTS (unchanged gameplay rules) ==========
console.log('\n=== Phase 3 / Contract 1.2 Fuel and Dawn Tests ===\n');
function isolatedEngine(scenario = {}, night = 1) {
  const e=new GameEngine(303,night); e.randomMotes=false; e.randomShades=false; e.randomDrifters=false;
  e.motes=[]; e.shades=[]; e.drifters=[]; e.applyScenario(scenario); return e;
}
{
  const e=isolatedEngine({lanterns:[{id:'L1',lit:true,fuel:2,ever_lit:true}],time_left_s:10});
  e.step();
  assert(e.lanterns[0].fuelUnits===119,'Fuel loses exactly one 1/60 unit per tick');
}
{
  const e=isolatedEngine({lanterns:[{id:'L1',lit:true,fuel:1,ever_lit:true}],time_left_s:10});
  e.lanterns[0].fuelUnits=1; e.step();
  assert(!e.lanterns[0].lit && e.lanterns[0].fuelUnits===0 && e.lanterns[0].deposited===0,'Zero fuel extinguishes and clears deposited motes');
  assert(e.events.some(x=>x.name==='lantern_out'&&x.data.lantern_id==='L1'),'Extinguishing emits lantern_out');
}
{
  const e=isolatedEngine({player:{pos:[0,0,25],carried:1},lanterns:[{id:'L1',lit:true,fuel:95,ever_lit:true}],time_left_s:10});
  e.setInput({interact:true}); e.step();
  assert(e.lanterns[0].fuelUnits===6000 && e.getSnapshot().lanterns[0].fuel===100,'Near-full lamp caps at 100; snapshot rounds to one decimal');
  assert(e.player.carried===0 && e.score===5 && e.events.some(x=>x.name==='refuel'&&x.data.amount===1),'Refuel consumes and scores each mote');
}
{
  const e=isolatedEngine({player:{pos:[0,0,25],carried:5},lanterns:[{id:'L1',ever_lit:true}],time_left_s:10});
  e.setInput({interact:true}); e.step();
  assert(e.lanterns[0].lit && e.lanterns[0].fuelUnits===6000,'Relight costs five motes and begins with full fuel');
  assert(e.player.capacity===12 && e.player.carried===0,'Successful relight grows carrying capacity');
  assert(e.score===65 && e.lanterns[0].relit_count===1 && e.events.some(x=>x.name==='lantern_lit'&&x.data.relight===true),'Relight scoring and event flag follow contract');
}
{
  const e=isolatedEngine({lanterns:[{id:'L1',lit:true,fuel:31,ever_lit:true}],shades:[{id:'S1',pos:[1,0,25],state:'drain',target_lantern_id:'L1'}],player:{pos:[20,0,0]},time_left_s:10});
  e.step();
  assert(e.shades[0].state==='wander','Shade abandons draining once lamp is safely refuelled above threshold');
}
{
  const lamp=isolatedEngine({lanterns:[{id:'L1',lit:true,fuel:25,ever_lit:true}],shades:[{id:'S1',pos:[1,0,25],state:'drain',target_lantern_id:'L1'}],player:{pos:[20,0,0]},time_left_s:10});
  for(let i=0;i<60;i++) lamp.step();
  assert(lamp.getSnapshot().lanterns[0].fuel<25,'Draining shade and natural decay stack on the lantern');
  assert(lamp.events.some(x=>x.name==='fuel_drain'&&x.data.fuel===19),'Fuel drain event reports remaining fuel every 60 drain ticks');
}
{
  const e=isolatedEngine({player:{pos:[1,0,25],carried:2},lanterns:[{id:'L1',lit:true,fuel:25,ever_lit:true}],shades:[{id:'S1',pos:[0,0,25],state:'drain',target_lantern_id:'L1'}],time_left_s:10});
  e.setInput({pulse:true}); e.step();
  assert(e.score===15 && e.shades[0].state==='stunned','Pulse hitting a draining shade scores 15');
}
{
  const e=isolatedEngine({player:{flames:2},lanterns:[{id:'L1',lit:true,fuel:100},{id:'L2',lit:true,fuel:100},{id:'L3',lit:true,fuel:100}],time_left_s:1});
  for(let i=0;i<60;i++) e.step();
  assert(e.state==='won'&&e.events.some(x=>x.name==='game_over'&&x.data.reason==='dawn_survived'),'Three of five lamps meet the dawn victory threshold');
  assert(e.score===3*(50+99)+100,'Dawn score uses lit fuel and remaining flames without time bonus');
}
{
  const e=isolatedEngine({player:{flames:1},shades:[{id:'S1',pos:[.5,0,0],state:'chase'}],time_left_s:1});
  for(let i=0;i<60&&e.state==='playing';i++)e.step();
  assert(e.state==='lost'&&e.events.some(x=>x.name==='game_over'&&x.data.reason==='no_flames'),'No flames takes precedence at the dawn tick');
}
{
  const e=isolatedEngine({player:{successful_lights:5,carried:20},time_left_s:10});
  assert(e.player.capacity===20,'Carry capacity caps at twenty');
  assert([1,2,3].every(n=>new GameEngine(1,n).nightDuration===[240,270,300][n-1]),'Night durations are 240, 270 and 300 seconds');
}
{
  const requirements=[[1,3],[2,4],[3,5]];
  const outcomes=requirements.map(([night,count])=>{
    const e=isolatedEngine({lanterns:Array.from({length:count},(_,i)=>({id:`L${i+1}`,lit:true,fuel:50,ever_lit:true})),time_left_s:1},night);
    for(let i=0;i<60;i++)e.step(); return e.state;
  });
  assert(outcomes.every(x=>x==='won'),'Dawn thresholds are 3/5, 4/6 and 5/7 across the three nights');
  const fail=isolatedEngine({lanterns:[{id:'L1',lit:true,fuel:20},{id:'L2',lit:true,fuel:20}],time_left_s:1},1);
  for(let i=0;i<60;i++)fail.step();
  assert(fail.state==='lost'&&fail.events.some(x=>x.name==='game_over'&&x.data.reason==='dawn'),'Dawn below the required lit count loses with reason dawn');
}
{
  const e=isolatedEngine({player:{pos:[0,0,0],carried:1},lanterns:[{id:'L1',pos:[0,0,1]},{id:'L2',pos:[0,0,-1]}],time_left_s:10});
  e.setInput({interact:true}); e.step();
  assert(e.events.some(x=>x.name==='deposit'&&x.data.lantern_id==='L1'),'Equal-distance interact picks the lower lantern id');
  const full=isolatedEngine({player:{pos:[0,0,25],carried:2},lanterns:[{id:'L1',lit:true,fuel:100}],time_left_s:10});
  full._interactLantern();
  assert(!full.events.some(x=>x.name==='refuel'||x.name==='deposit'),'Full fuel lamp is not selected or scored');
}
{
  const e=isolatedEngine({player:{pos:[20,0,0]},lanterns:[{id:'L1',lit:true,fuel:20},{id:'L2',lit:true,fuel:15}],shades:[{id:'S1',pos:[1,0,25],state:'wander'}],time_left_s:10});
  e.step();
  assert(e.getSnapshot().shades[0].target_lantern_id==='L1','Wandering shade targets the nearest weak lamp and snapshots its target');
  const chase=isolatedEngine({lanterns:[{id:'L1',lit:true,fuel:15},{id:'L2',lit:true,fuel:15}],shades:[{id:'S1',pos:[1,0,25],state:'chase',target_lantern_id:'L2'}],player:{pos:[20,0,0]},time_left_s:10});
  chase.step();
  assert(chase.getSnapshot().shades[0].target_lantern_id==='L2','Chasing shade does not switch its target');
}
{
  const e=isolatedEngine({player:{pos:[20,0,0]},shades:[{id:'S1',pos:[12,0,0],state:'stunned',state_ticks_left:1}],time_left_s:10});
  e.step();
  assert(e.shades[0].state==='wander','Shade returns to wander when its stun ends');
}

// ========== SUMMARY ==========
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
