/**
 * Đảo Đèn Lồng - Game Engine Core
 * Logic game thuần, không phụ thuộc DOM/GPU.
 * Dùng chung cho cả visual mode và headless mode.
 */

// ========== TUNING CONSTANTS ==========
export const TUNING = {
  player_speed: 7.5,        // m/s (Phase 3 mobility increase)
  carry_capacity: 10,       // max motes carried
  lantern_cost: 10,         // first-light cost; relights use relight_cost
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  lantern_count_night1: 5,  // number of lanterns
  pickup_radius: 2,         // meters
  interact_radius: 3,       // meters
  pulse_cost: 2,            // motes consumed by pulse
  pulse_radius: 8,          // meters
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 2,
  flames: 5,                // starting HP
  invuln_s: 1.5,            // invulnerability after hit
  hit_drop_ratio: 0.5,      // fraction of carried motes dropped on hit
  pulse_stun_s: 3,          // how long shade is stunned
  pulse_push_m: 5,          // push distance
  pulse_cooldown_s: 5,      // cooldown between pulses
  safe_radius: 6,           // lantern safe zone radius
  shade_speed: 3.5,         // m/s
  shade_hit_radius: 1.5,    // meters
  fall_enabled: true,       // fall off island penalty
  island_radius: 40,        // meters
  jump_velocity: 8,         // m/s upward
  gravity: 20,              // m/s^2
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_relight: 40,
    per_stun: 5,
    per_drain_stun: 15,
  },
};

const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

// ========== SEEDED RNG ==========
export class SeededRNG {
  constructor(seed) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }
  next() {
    // xorshift32
    let s = this.state;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.state = s >>> 0;
    return this.state;
  }
  float() {
    return this.next() / 4294967296;
  }
  range(min, max) {
    return min + this.float() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

// ========== VECTOR HELPERS ==========
function dist2D(a, b) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function normalize2D(x, z) {
  const len = Math.sqrt(x * x + z * z);
  if (len < 0.0001) return [0, 0];
  return [x / len, z / len];
}

function roundPos(pos) {
  return [
    Math.round(pos[0] * 1000) / 1000,
    Math.round(pos[1] * 1000) / 1000,
    Math.round(pos[2] * 1000) / 1000,
  ];
}

// ========== GAME ENGINE ==========
export class GameEngine {
  constructor(seed = 42, night = 1) {
    this.rng = new SeededRNG(seed);
    this.seed = seed;
    this.tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.successfulLights = 0;
    this.night = [1, 2, 3].includes(Number(night)) ? Number(night) : 1;
    this.nightDuration = TUNING[`night${this.night}_duration_s`];
    this.simTick = 0;
    this.globalScore = 0;
    this.wind = { active: false, dir_deg: 0, nextTick: 1800, endTick: 0, warning: false };
    this.windEnabled = this.night === 3;
    this.randomDrifters = true;
    this.paused = false;
    this.dashId = 0;
    this.events = [];
    this.snapshotInterval = 10;

    // Player
    this.player = {
      pos: this.night === 3 ? [0, 6, 0] : [0, 0, 0],
      vel: [0, 0, 0],
      flames: TUNING.flames,
      carried: 0,
      capacity: TUNING.carry_capacity,
      onGround: true,
      invulnTimer: 0,
      pulseCooldown: 0,
      dashCooldown: 0,
      dashTicks: 0,
      launchTicks: 0,
      charmTicks: 0,
      grounded: true,
      invulnTicks: 0,
    };

    // Lanterns - placed in a circle around center
    this.lanterns = [];
    this._initLanterns();

    // Motes (fireflies)
    this.motes = [];
    this._initMotes();

    // Shades (ink creatures)
    this.shades = [];
    this._initShades();

    this.drifters = [];
    this.drifterIdCounter = 1;
    this.charms = [];
    this._initNightExtras();

    this.shadeSpawnTimer = 0;
    this.shadeIdCounter = this.shades.length;
    this.moteSpawnTimer = 0;
    this.moteIdCounter = this.motes.length;

    // Input state
    this.input = {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };
    this.prevInput = { jump: false, interact: false, pulse: false, dash: false, pause: false };

    // Flags for scenario override
    this.randomMotes = true;
    this.randomShades = true;
    this.events.push({ type: 'event', tick: 0, name: 'night_start', data: { night: this.night } });
  }

  _initLanterns() {
    const positions = this.night === 1
      ? [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]
      : this.night === 2
        ? [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]
        : [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]];
    this.lanterns = positions.map((pos, i) => ({
        id: `L${i + 1}`,
        pos,
        lit: false,
        deposited: 0,
      fuelUnits: 0,
      ever_lit: false,
      relit_count: 0,
      }));
  }

  _initMotes() {
    const polar = (r, degrees, y = 0, cx = 0, cz = 0) => [
      Math.round((cx + Math.cos(degrees * Math.PI / 180) * r) * 1000) / 1000,
      y,
      Math.round((cz + Math.sin(degrees * Math.PI / 180) * r) * 1000) / 1000,
    ];
    let points;
    if (this.night === 1) {
      points = [...Array.from({ length: 8 }, (_, i) => polar(12, i * 45)), ...Array.from({ length: 16 }, (_, i) => polar(33, i * 22.5))];
    } else if (this.night === 2) {
      points = [];
      for (const cx of [0, 70]) points.push(...[0, 90, 180, 270].map(a => polar(10, a, 0, cx)), ...Array.from({ length: 8 }, (_, i) => polar(22, i * 45, 0, cx)));
    } else {
      points = [...Array.from({ length: 18 }, (_, i) => polar(34, i * 20)), ...Array.from({ length: 8 }, (_, i) => polar(18, 20 + i * 20, 3)), ...[45, 135, 225, 315].map(a => polar(5, a, 6))];
    }
    this.moteSpawnPoints = points;
    this.motes = points.map((pos, i) => ({ id: `M${i}`, pos, active: true, kind: 'random', ttlTicks: 0 }));
    this.moteIdCounter = this.motes.length;
  }

  _spawnMote(id) {
    if (this.moteSpawnPoints?.length) {
      const pos = this.moteSpawnPoints[this.rng.int(0, this.moteSpawnPoints.length - 1)];
      return { id: `M${id}`, pos: [...pos], active: true, kind: 'random', ttlTicks: 0 };
    }
    const angle = this.rng.float() * Math.PI * 2;
    const dist = this.rng.range(3, TUNING.island_radius - 2);
    return {
      id: `M${id}`,
      pos: [
        Math.round(Math.cos(angle) * dist * 1000) / 1000,
        0,
        Math.round(Math.sin(angle) * dist * 1000) / 1000,
      ],
      active: true,
    };
  }

  _initShades() {
    this.shades = [];
    this.shadeIdCounter = 0;
    const polar = (radius, degrees, cx = 0) => [cx + Math.cos(degrees * Math.PI / 180) * radius, 0, Math.sin(degrees * Math.PI / 180) * radius];
    this.shadeSpawnPoints = this.night === 1
      ? Array.from({ length: 12 }, (_, i) => polar(37, 15 + i * 30))
      : this.night === 2
        ? [0, 70].flatMap(cx => Array.from({ length: 8 }, (_, i) => polar(26, 22.5 + i * 45, cx)))
        : Array.from({ length: 16 }, (_, i) => polar(43, i * 22.5));
    this.nextShadeTick = this.night === 1 ? 300 : this.night === 2 ? 420 : 360;
  }

  _createShade(id, pos = null) {
    if (!pos) {
      const start = this.rng.int(0, this.shadeSpawnPoints.length - 1);
      let point = this.shadeSpawnPoints[start];
      for (let i = 0; i < this.shadeSpawnPoints.length; i++) {
        const candidate = this.shadeSpawnPoints[(start + i) % this.shadeSpawnPoints.length];
        if (dist2D(candidate, this.player.pos) >= 15) { point = candidate; break; }
      }
      pos = [...point];
    }
    return {
      id: `S${id}`,
      pos: [...pos],
        state: 'spawning',
      stunTimer: 0,
      stateTicksLeft: 60,
        targetLanternId: null,
        drainTicks: 0,
        recoilTicks: 0,
    };
  }

  _initNightExtras() {
    const charmPositions = this.night === 2 ? [[35, 0, 0]] : this.night === 3 ? [[30, 0, 25], [-30, 0, 25]] : [];
    this.charms = charmPositions.map((pos, i) => ({ id: `C${i + 1}`, pos, available: true, respawnTicks: 0 }));
  }

  // ========== SCENARIO LOADING ==========
  applyScenario(scenario) {
    if (scenario.player) {
      if (scenario.player.pos) this.player.pos = [...scenario.player.pos];
      if (scenario.player.carried !== undefined) this.player.carried = scenario.player.carried;
      if (scenario.player.successful_lights !== undefined) this.successfulLights = scenario.player.successful_lights;
      this.player.capacity = Math.min(TUNING.capacity_max, TUNING.carry_capacity + 2 * this.successfulLights);
      if (scenario.player.flames !== undefined) this.player.flames = scenario.player.flames;
      if (scenario.player.invuln_ticks !== undefined) this.player.invulnTicks = scenario.player.invuln_ticks;
      if (scenario.player.dash_cd_ticks !== undefined) this.player.dashCooldown = scenario.player.dash_cd_ticks / TICK_RATE;
      if (scenario.player.pulse_cd_ticks !== undefined) this.player.pulseCooldown = scenario.player.pulse_cd_ticks / TICK_RATE;
      if (scenario.player.charm_ticks !== undefined) this.player.charmTicks = scenario.player.charm_ticks;
    }

    if (scenario.random_motes !== undefined) {
      this.randomMotes = scenario.random_motes;
    }
    if (scenario.random_shades !== undefined) {
      this.randomShades = scenario.random_shades;
    }

    if (scenario.motes !== undefined) {
      this.motes = scenario.motes.map((mote, i) => ({
        id: Array.isArray(mote) ? `M${i}` : (mote.id || `M${i}`),
        pos: [...(Array.isArray(mote) ? mote : mote.pos)],
        active: true,
        kind: Array.isArray(mote) ? 'random' : (mote.kind || 'random'),
        ttlTicks: Array.isArray(mote) ? 0 : Math.round((mote.ttl_s || 0) * TICK_RATE),
      }));
      this.moteIdCounter = Math.max(scenario.motes.length, ...this.motes.map(m => Number(m.id.replace(/\D/g, '')) + 1));
    }

    if (scenario.shades !== undefined) {
      this.shades = scenario.shades.map((s, i) => ({
        id: s.id || `S${i}`,
        pos: [...s.pos],
        state: s.state || 'wander',
        stunTimer: (s.state_ticks_left || 0) / TICK_RATE,
        stateTicksLeft: s.state_ticks_left || 0,
      }));
      this.shadeIdCounter = Math.max(this.shades.length, ...this.shades.map(s => Number(s.id.replace(/\D/g, '')) + 1));
    }

    if (scenario.lanterns !== undefined) {
      for (const sl of scenario.lanterns) {
        const existing = this.lanterns.find(l => l.id === sl.id);
        if (existing) {
          if (sl.pos) existing.pos = [...sl.pos];
          if (sl.deposited !== undefined) existing.deposited = sl.deposited;
          if (sl.lit !== undefined) existing.lit = sl.lit;
          if (sl.fuel !== undefined) existing.fuelUnits = Math.round(Math.max(0, Math.min(TUNING.fuel_max, sl.fuel)) * TICK_RATE);
          else if (sl.lit === true) existing.fuelUnits = TUNING.fuel_max * TICK_RATE;
          if (sl.ever_lit !== undefined) existing.ever_lit = sl.ever_lit;
          else if (sl.lit === true) existing.ever_lit = true;
          if (sl.relit_count !== undefined) existing.relit_count = sl.relit_count;
          if (!existing.lit) existing.fuelUnits = 0;
        }
      }
    }

    if (scenario.shades !== undefined) {
      this.shades = scenario.shades.map((s,i)=>({id:s.id||`S${i}`,pos:[...s.pos],state:s.state||'wander',stunTimer:(s.state_ticks_left||0)/TICK_RATE,stateTicksLeft:s.state_ticks_left||0,targetLanternId:s.target_lantern_id||null,drainTicks:s.drain_ticks||0,recoilTicks:s.recoil_ticks||0}));
    }

    if (scenario.time_left_s !== undefined) {
      this.nightDuration = scenario.time_left_s;
    }
    if (scenario.random_motes !== undefined) this.randomMotes = scenario.random_motes;
    if (scenario.random_shades !== undefined) this.randomShades = scenario.random_shades;
    if (scenario.random_drifters !== undefined) this.randomDrifters = scenario.random_drifters;
    if (scenario.wind_enabled !== undefined) this.windEnabled = scenario.wind_enabled;
    if (scenario.drifters !== undefined) this.drifters = scenario.drifters.map((d, i) => ({ id: d.id || `D${i + 1}`, pos: [...d.pos], state: d.state || 'idle', stolen: d.stolen || 0, fleeTicks: d.state_ticks_left || 240, fleeSinceTick: -1, idleDirection: i % 2 ? -1 : 1, dropped: false }));
    if (scenario.drifters !== undefined) this.drifterIdCounter = Math.max(1, ...this.drifters.map(d => Number(d.id.replace(/\D/g, '')) + 1));
    if (scenario.charms !== undefined) this.charms = scenario.charms.map((c, i) => ({ id: c.id || `C${i + 1}`, pos: [...c.pos], available: c.available !== false, respawnTicks: Math.round((c.respawn_s || 0) * TICK_RATE) }));
  }

  // ========== INPUT HANDLING ==========
  setInput(frame) {
    if (frame.move !== undefined) this.input.move = [...frame.move];
    if (frame.cam_yaw_deg !== undefined) this.input.cam_yaw_deg = frame.cam_yaw_deg;
    if (frame.jump !== undefined) this.input.jump = frame.jump;
    if (frame.interact !== undefined) this.input.interact = frame.interact;
    if (frame.pulse !== undefined) this.input.pulse = frame.pulse;
    if (frame.dash !== undefined) this.input.dash = frame.dash;
    if (frame.pause !== undefined) this.input.pause = frame.pause;
  }

  // ========== MAIN STEP ==========
  step() {
    if (this.state === 'won' || this.state === 'lost') return;

    this.events = [];

    // Detect rising edges
    const jumpPressed = this.input.jump && !this.prevInput.jump;
    const interactPressed = this.input.interact && !this.prevInput.interact;
    const pulsePressed = this.input.pulse && !this.prevInput.pulse;
    const dashPressed = this.input.dash && !this.prevInput.dash;
    const pausePressed = this.input.pause && !this.prevInput.pause;

    if (pausePressed) {
      this.paused = !this.paused;
      this.state = this.paused ? 'paused' : 'playing';
      this.events.push({ type: 'event', tick: this.tick + 1, name: this.paused ? 'paused' : 'resumed', data: {} });
    }
    this.prevInput = { jump: this.input.jump, interact: this.input.interact, pulse: this.input.pulse, dash: this.input.dash, pause: this.input.pause };
    if (this.paused) { this.tick++; return; }

    // Update timers
    if (this.player.invulnTimer > 0) this.player.invulnTimer -= DT;
    if (this.player.pulseCooldown > 0) this.player.pulseCooldown -= DT;
    if (this.player.dashCooldown > 0) this.player.dashCooldown = Math.max(0, this.player.dashCooldown - DT);
    if (this.player.charmTicks > 0) this.player.charmTicks--;
    if (this.player.invulnTicks > 0) this.player.invulnTicks--;
    this.player.invulnTimer = this.player.invulnTicks / TICK_RATE;
    for (const shade of this.shades) if (shade.state === 'stunned') {
      shade.stunTimer = Math.max(0, shade.stunTimer - DT);
      if (shade.stunTimer === 0) shade.state = 'wander';
    }
    this._tickWind();
    for (const mote of this.motes) if (mote.active && mote.ttlTicks > 0 && --mote.ttlTicks === 0) mote.active = false;
    for (const charm of this.charms) if (!charm.available && charm.respawnTicks > 0 && --charm.respawnTicks === 0) charm.available = true;

    // Ticket 03 tick step 2: decay and active drain, then extinguish at zero.
    this._updateLanternFuel();

    // Player movement
    this._movePlayer(jumpPressed, dashPressed);

    // Check fall off island
    this._checkFall();

    // Pick up motes
    this._pickupMotes();
    this._pickupCharms();

    // Interact with lanterns
    if (interactPressed) {
      this._interactLantern();
    }

    // Pulse (radiate light)
    if (pulsePressed) {
      this._doPulse();
    }

    // Update shades
    this._updateShades();
    this._updateDrifters();

    // Check shade collision
    this._checkShadeCollision();
    this._checkDrifterCollision();

    // Spawn new shades over time
    if (this.randomShades) {
      this._spawnShadeTimer();
    }
    this._spawnDrifterTimer();

    // Spawn new motes over time
    if (this.randomMotes) {
      this._spawnMoteTimer();
    }

    // Check win/lose
    this._checkWinLose();

    // Save prev input
    this.tick++;
    this.simTick++;
  }

  _movePlayer(jumpPressed, dashPressed = false) {
    const mx = this.input.move[0];
    const mz = this.input.move[1];

    // Normalize if length > 1
    let len = Math.sqrt(mx * mx + mz * mz);
    let nx = mx, nz = mz;
    if (len > 1) {
      nx = mx / len;
      nz = mz / len;
      len = 1;
    }

    // Apply camera yaw rotation
    const yawRad = (this.input.cam_yaw_deg * Math.PI) / 180;
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const worldX = nx * cosY + nz * sinY;
    const worldZ = -nx * sinY + nz * cosY;

    const oldX = this.player.pos[0], oldZ = this.player.pos[2];
    // Move horizontally
    if (dashPressed && this.player.dashCooldown <= 0 && (nx || nz)) {
      this.player.dashTicks = Math.round(TUNING.dash_duration_s * TICK_RATE);
      this.player.dashCooldown = this.player.charmTicks > 0 ? 0 : TUNING.dash_cooldown_s;
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'dash', data: {} });
    }
    if (this.player.launchTicks <= 0) {
      const speed = this.player.dashTicks > 0 ? TUNING.dash_speed : this.player.charmTicks > 0 ? 9 : TUNING.player_speed;
      this.player.pos[0] += worldX * speed * DT;
      this.player.pos[2] += worldZ * speed * DT;
    }
    if (this.player.dashTicks > 0) this.player.dashTicks--;
    if (this.wind.active) {
      const a = this.wind.dir_deg * Math.PI / 180;
      this.player.pos[0] += Math.cos(a) * 2 * DT;
      this.player.pos[2] += Math.sin(a) * 2 * DT;
    }

    if (this.night === 3 && this.player.pos[1] >= 6 && this.player.pos[1] < 14 && Math.hypot(this.player.pos[0], this.player.pos[2]) < 2) {
      const a = Math.atan2(this.player.pos[2], this.player.pos[0]) || Math.atan2(worldZ, worldX);
      this.player.pos[0] = Math.cos(a) * 2;
      this.player.pos[2] = Math.sin(a) * 2;
    }

    if (this.player.onGround) {
      const nextFloor = this._floorHeight(this.player.pos[0], this.player.pos[2]);
      if (!Number.isFinite(nextFloor) || nextFloor < this.player.pos[1] - 0.05) {
        this.player.onGround = false;
        this.player.vel[1] = 0;
      } else if (nextFloor > this.player.pos[1]) {
        if (this.night === 3 && !this._isRamp(this.player.pos[0], this.player.pos[2])) {
          this.player.pos[0] = oldX; this.player.pos[2] = oldZ;
        } else this.player.pos[1] = nextFloor;
      }
    }

    if (this._checkJumpPad()) return;

    // Jump
    if (jumpPressed && this.player.onGround) {
      this.player.vel[1] = TUNING.jump_velocity;
      this.player.onGround = false;
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'jump', data: {} });
    }

    // Gravity
    if (!this.player.onGround) {
      this.player.vel[1] -= TUNING.gravity * DT;
      if (this.player.launchTicks > 0) {
        this.player.pos[0] += this.player.vel[0] * DT;
        this.player.pos[2] += this.player.vel[2] * DT;
        this.player.launchTicks--;
      }
      this.player.pos[1] += this.player.vel[1] * DT;
      const floor = this._floorHeight(this.player.pos[0], this.player.pos[2]);
      if (Number.isFinite(floor) && this.player.pos[1] <= floor) {
        this.player.pos[1] = floor;
        this.player.vel[1] = 0;
        this.player.vel[0] = 0;
        this.player.vel[2] = 0;
        this.player.onGround = true;
      }
    }
  }

  _floorHeight(x, z) {
    const r = Math.hypot(x, z);
    if (this.night === 1) return r <= 40 ? 0 : -Infinity;
    if (this.night === 2) {
      if (r <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
      if (x >= 26 && x <= 44 && Math.abs(z) <= 2) return 0;
      return -Infinity;
    }
    if (r > 45) return -Infinity;
    if (r <= 8) return 6;
    if (r >= 12 && r <= 24 && z > 0) return 3;
    const ramp = this._isRamp(x, z);
    if (ramp) return r <= 24 ? 3 : Math.max(0, 3 * (30 - r) / 6);
    return 0;
  }

  _isRamp(x, z) {
    const r = Math.hypot(x, z);
    const a = ((Math.atan2(z, x) * 180 / Math.PI) + 360) % 360;
    return [30, 150].some(angle => Math.abs(((a - angle + 540) % 360) - 180) <= 4 && r >= 24 && r <= 30);
  }

  _checkJumpPad() {
    if (!this.player.onGround) return false;
    const [x, , z] = this.player.pos;
    let launch = null;
    if (this.night === 2) {
      for (const [px, pz, tx] of [[20, 18, 70], [50, -18, 0]]) {
        if (Math.hypot(x - px, z - pz) <= 1) launch = [tx > x ? 1 : -1, 0, 14, 24];
      }
    } else if (this.night === 3 && Math.hypot(x, z - 13) <= 1 && this.player.pos[1] >= 2.9) launch = [0, -1, 12, 8];
    if (!launch) return false;
    this.player.vel[1] = launch[2];
    this.player.vel[0] = launch[0] * launch[3];
    this.player.vel[2] = launch[1] * launch[3];
    this.player.launchTicks = 84;
    this.player.onGround = false;
    this.events.push({ type: 'event', tick: this.tick + 1, name: 'jump', data: { pad: true } });
    return true;
  }

  _tickWind() {
    if (!this.windEnabled) return;
    const n = this.simTick + 1;
    if (!this.wind.active && !this.wind.warning && n >= this.wind.nextTick - 120) {
      this.wind.warning = true;
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'wind_warning', data: {} });
    }
    if (!this.wind.active && n >= this.wind.nextTick) {
      this.wind.active = true;
      this.wind.dir_deg = Math.floor(this.rng.float() * 360);
      this.wind.endTick = n + 300;
      this.wind.warning = false;
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'wind_started', data: { dir_deg: this.wind.dir_deg } });
    } else if (this.wind.active && n >= this.wind.endTick) {
      this.wind.active = false;
      this.wind.nextTick += 1800;
    }
  }

  _pickupCharms() {
    for (const charm of this.charms) {
      if (!charm.available || dist2D(this.player.pos, charm.pos) > TUNING.pickup_radius) continue;
      charm.available = false;
      charm.respawnTicks = 2700;
      this.player.charmTicks = 600;
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'charm_picked', data: { charm_id: charm.id, charm_ticks: 600 } });
    }
  }

  _spawnDrifterTimer() {
    if (this.night === 1 || !this.randomDrifters) return;
    if (this.simTick + 1 >= 1200 && (this.simTick + 1) % 1200 === 0 && this.drifters.filter(d => d.state !== 'removed').length < 2) {
      const angle = this.rng.float() * Math.PI * 2;
      const center = this.night === 2 && this.rng.float() > 0.5 ? 70 : 0;
      const d = { id: `D${this.drifterIdCounter++}`, pos: [center + Math.cos(angle) * 25, 2, Math.sin(angle) * 25], state: 'idle', stolen: 0, fleeTicks: 0, fleeSinceTick: -1, idleDirection: this.rng.float() < 0.5 ? -1 : 1, dropped: false };
      this.drifters.push(d);
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'drifter_spawned', data: { id: d.id } });
    }
  }

  _updateDrifters() {
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      const dx = this.player.pos[0] - d.pos[0], dz = this.player.pos[2] - d.pos[2];
      const dist = Math.hypot(dx, dz) || 1;
      if (d.state === 'idle' && this.player.carried >= 5 && dist <= 15) d.state = 'chase';
      if (d.state === 'chase' && this.player.carried < 5) d.state = 'idle';
      if (d.state === 'flee') {
        if (d.fleeSinceTick !== this.simTick + 1) d.fleeTicks--;
        if (d.fleeTicks <= 0) d.state = 'removed';
        else { d.pos[0] -= dx / dist * 7 * DT; d.pos[2] -= dz / dist * 7 * DT; }
      } else {
        if (d.state === 'chase') {
          d.pos[0] += dx / dist * 7 * DT;
          d.pos[2] += dz / dist * 7 * DT;
        } else {
          d.pos[0] += -dz / dist * 2 * DT * (d.idleDirection || 1);
          d.pos[2] += dx / dist * 2 * DT * (d.idleDirection || 1);
        }
      }
    }
  }

  _checkDrifterCollision() {
    for (const d of this.drifters) {
      if (d.state !== 'chase' || dist2D(this.player.pos, d.pos) > 1.2) continue;
      const amount = Math.min(3, this.player.carried);
      this.player.carried -= amount;
      d.stolen = amount;
      d.state = 'flee';
      d.fleeTicks = 240;
      d.fleeSinceTick = this.simTick + 1;
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'drifter_steal', data: { drifter_id: d.id, amount, carried: this.player.carried } });
    }
  }

  _checkFall() {
    if (!TUNING.fall_enabled) return;
    const floor = this._floorHeight(this.player.pos[0], this.player.pos[2]);
    if (!Number.isFinite(floor) || this.player.pos[1] < -2) {
      const fallPos = [...this.player.pos];
      // Fell off island - teleport back and lose a flame
      this.player.pos = this.night === 3 ? [0, 6, 0] : [0, 0, 0];
      this.player.pos[1] = this.night === 3 ? 6 : 0;
      this.player.vel = [0, 0, 0];
      this.player.onGround = true;

      if (this.player.invulnTicks <= 0 && this.player.invulnTimer <= 0) {
        this.player.flames--;
        const dropped = Math.floor(this.player.carried * TUNING.hit_drop_ratio);
        this.player.carried -= dropped;
        for (let i = 0; i < dropped; i++) this._dropMote(fallPos);
        this.player.invulnTimer = TUNING.invuln_s;
        this.player.invulnTicks = Math.round(TUNING.invuln_s * TICK_RATE);

        this.events.push({
          type: 'event',
          tick: this.tick + 1,
          name: 'player_hit',
          data: { by: 'fall', flames: this.player.flames, dropped, lost: dropped },
        });
      }
    }
  }

  _pickupMotes() {
    for (const mote of this.motes) {
      if (!mote.active) continue;
      if (this.player.carried >= this.player.capacity) break;

      const d = dist2D(this.player.pos, mote.pos);
      if (d <= TUNING.pickup_radius) {
        mote.active = false;
        this.player.carried++;

        this.events.push({
          type: 'event',
          tick: this.tick + 1,
          name: 'mote_picked',
          data: { carried: this.player.carried },
        });
      }
    }
  }

  _interactLantern() {
    const candidates = this.lanterns.filter(l => (!l.lit || l.fuelUnits < TUNING.fuel_max * TICK_RATE) && dist2D(this.player.pos, l.pos) <= TUNING.interact_radius)
      .sort((a,b) => dist2D(this.player.pos,a.pos)-dist2D(this.player.pos,b.pos) || a.id.localeCompare(b.id));
    const lantern = candidates[0];
    if (!lantern || this.player.carried <= 0) return;
    if (lantern.lit) {
      const fuel = lantern.fuelUnits / TICK_RATE;
      const used = Math.min(this.player.carried, Math.ceil((TUNING.fuel_max - fuel) / TUNING.fuel_per_mote));
      if (!used) return;
      this.player.carried -= used;
      lantern.fuelUnits = Math.min(TUNING.fuel_max * TICK_RATE, lantern.fuelUnits + used * TUNING.fuel_per_mote * TICK_RATE);
      this.score += used * TUNING.score.per_mote;
      this.events.push({ type:'event', tick:this.tick+1, name:'refuel', data:{ lantern_id:lantern.id, amount:used, fuel:Math.round(lantern.fuelUnits/TICK_RATE*10)/10 } });
      if (lantern.fuelUnits / TICK_RATE >= TUNING.low_fuel_threshold) this._repelNearbyShades(lantern);
      return;
    }
    const relight = lantern.ever_lit;
    const needed = relight ? TUNING.relight_cost : TUNING.lantern_cost;
    const amount = Math.min(this.player.carried, Math.max(0, needed - lantern.deposited));
    if (!amount) return;
    this.player.carried -= amount;
    lantern.deposited += amount;
    this.score += amount * TUNING.score.per_mote;
    this.events.push({ type:'event', tick:this.tick+1, name:'deposit', data:{ lantern_id:lantern.id, amount, deposited:lantern.deposited } });
    if (lantern.deposited >= needed) {
      if (relight) lantern.relit_count = (lantern.relit_count || 0) + 1;
      lantern.lit = true; lantern.ever_lit = true; lantern.deposited = 0;
      lantern.fuelUnits = TUNING.fuel_max * TICK_RATE; this.successfulLights++;
      this.player.capacity = Math.min(TUNING.capacity_max, TUNING.carry_capacity + 2 * this.successfulLights);
      this.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
      this.events.push({ type:'event', tick:this.tick+1, name:'lantern_lit', data:{ lantern_id:lantern.id, relight } });
      this._repelNearbyShades(lantern);
    }
  }

  _repelNearbyShades(lantern) {
    for (const shade of this.shades) if (shade.state !== 'stunned' && dist2D(shade.pos,lantern.pos) <= TUNING.safe_radius) {
      let [dx,dz] = normalize2D(shade.pos[0]-lantern.pos[0], shade.pos[2]-lantern.pos[2]);
      if (!dx && !dz) dx=1;
      shade.pos[0] = lantern.pos[0] + dx * TUNING.safe_radius;
      shade.pos[2] = lantern.pos[2] + dz * TUNING.safe_radius;
      shade.state = 'recoil'; shade.recoilTicks = 30; shade.targetLanternId = lantern.id;
    }
  }

  _doPulse() {
    if (this.player.pulseCooldown > 0) return;
    if (this.player.carried < TUNING.pulse_cost) return;

    this.player.carried -= TUNING.pulse_cost;
    this.player.pulseCooldown = TUNING.pulse_cooldown_s;

    const stunnedIds = [];
    for (const drifter of this.drifters) {
      if (drifter.state === 'removed' || dist2D(this.player.pos, drifter.pos) > TUNING.pulse_radius) continue;
      if (drifter.state === 'chase') {
        drifter.state = 'flee';
        drifter.stolen = 0;
        drifter.fleeTicks = 240;
        drifter.fleeSinceTick = this.simTick + 1;
      } else if (drifter.state === 'flee' && drifter.stolen > 0) {
        const amount = drifter.stolen;
        for (let i = 0; i < amount; i++) this._dropMote(drifter.pos);
        drifter.stolen = 0;
        drifter.fleeTicks = 120;
        drifter.fleeSinceTick = this.simTick + 1;
        this.events.push({ type: 'event', tick: this.tick + 1, name: 'drifter_drop', data: { drifter_id: drifter.id, amount } });
      }
    }

    for (const shade of this.shades) {
      const d = dist2D(this.player.pos, shade.pos);
      if (d <= TUNING.pulse_radius) {
        const wasDraining = shade.state === 'drain';
        shade.state = 'stunned';
        shade.stunTimer = TUNING.pulse_stun_s;
        stunnedIds.push(shade.id);

        // Push shade away
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const [ndx, ndz] = normalize2D(dx, dz);
        shade.pos[0] += ndx * TUNING.pulse_push_m;
        shade.pos[2] += ndz * TUNING.pulse_push_m;

        this.score += wasDraining ? TUNING.score.per_drain_stun : TUNING.score.per_stun;
      }
    }

    this.events.push({
      type: 'event',
      tick: this.tick + 1,
      name: 'pulse',
      data: { stunned_ids: stunnedIds },
    });
  }

  _updateLanternFuel() {
    const drains = new Map();
    for (const shade of this.shades) if (shade.state === 'drain' && shade.targetLanternId) {
      drains.set(shade.targetLanternId, (drains.get(shade.targetLanternId) || 0) + Math.round(TUNING.drain_per_s));
    }
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      lantern.fuelUnits = Math.max(0, lantern.fuelUnits - Math.round(TUNING.fuel_decay_per_s) - (drains.get(lantern.id) || 0));
      if (lantern.fuelUnits <= 0) {
        lantern.lit = false; lantern.deposited = 0; lantern.fuelUnits = 0;
        this.events.push({type:'event',tick:this.tick+1,name:'lantern_out',data:{lantern_id:lantern.id}});
      }
    }
    for (const shade of this.shades) if (shade.state==='drain' && (shade.drainTicks+1)%60===0) {
      const lantern=this.lanterns.find(l=>l.id===shade.targetLanternId);
      if(lantern) this.events.push({type:'event',tick:this.tick+1,name:'fuel_drain',data:{lantern_id:lantern.id,shade_id:shade.id,fuel:Math.round((lantern.lit?lantern.fuelUnits/TICK_RATE:0)*10)/10}});
    }
  }

  _dropMote(pos) {
    this.motes.push({ id: `M${this.moteIdCounter++}`, pos: [...pos], active: true, kind: 'dropped', ttlTicks: 1800 });
  }

  _updateShades() {
    for (const shade of this.shades) {
      if (shade.state === 'spawning') {
        shade.stateTicksLeft--;
        if (shade.stateTicksLeft <= 0) shade.state = 'wander';
        continue;
      }
      if (shade.state === 'wander') {
        const weak = this.lanterns.filter(l => l.lit && l.fuelUnits < TUNING.low_fuel_threshold*TICK_RATE).sort((a,b)=>dist2D(shade.pos,a.pos)-dist2D(shade.pos,b.pos)||a.id.localeCompare(b.id))[0];
        const dark = this.lanterns.filter(l => !l.lit).sort((a,b)=>dist2D(shade.pos,a.pos)-dist2D(shade.pos,b.pos)||a.id.localeCompare(b.id))[0];
        const target = weak || dark;
        shade.targetLanternId = target?.id || null;
      }
      if (shade.state === 'stunned') {
        continue;
      }

      if (shade.state === 'recoil') {
        shade.recoilTicks = Math.max(0, (shade.recoilTicks || 0)-1);
        if (shade.recoilTicks > 0) continue;
        shade.state = 'wander';
      }

      if (shade.state === 'drain') {
        const target = this.lanterns.find(l=>l.id===shade.targetLanternId);
        if (!target || !target.lit || target.fuelUnits >= TUNING.low_fuel_threshold*TICK_RATE || dist2D(shade.pos,target.pos)>2 || dist2D(shade.pos,this.player.pos)<=6) { shade.state = dist2D(shade.pos,this.player.pos)<=6 ? 'chase' : 'wander'; continue; }
        shade.drainTicks = (shade.drainTicks || 0)+1;
        continue;
      }

      // Fuel below 30 removes a lantern's safe zone.
      let inSafeZone = false;
      for (const lantern of this.lanterns) {
        if (lantern.lit && lantern.fuelUnits >= TUNING.low_fuel_threshold*TICK_RATE) {
          const d = dist2D(shade.pos, lantern.pos);
          if (d <= TUNING.safe_radius) {
            inSafeZone = true;
            break;
          }
        }
      }

      if (inSafeZone) {
        // Flee from lantern
        shade.state = 'recoil'; shade.recoilTicks = Math.max(shade.recoilTicks || 0,1);
        // Move away from nearest lit lantern
        let nearest = null;
        let nearDist = Infinity;
        for (const lantern of this.lanterns) {
          if (lantern.lit) {
            const d = dist2D(shade.pos, lantern.pos);
            if (d < nearDist) {
              nearDist = d;
              nearest = lantern;
            }
          }
        }
        if (nearest) {
          const dx = shade.pos[0] - nearest.pos[0];
          const dz = shade.pos[2] - nearest.pos[2];
          let [ndx, ndz] = normalize2D(dx, dz); if (!ndx && !ndz) ndx=1;
          shade.pos[0] += ndx * TUNING.shade_speed * DT;
          shade.pos[2] += ndz * TUNING.shade_speed * DT;
        }
      } else {
        const target = shade.state === 'wander' ? this.lanterns.find(l=>l.id===shade.targetLanternId) : null;
        const dx = (target?.pos[0] ?? this.player.pos[0]) - shade.pos[0];
        const dz = (target?.pos[2] ?? this.player.pos[2]) - shade.pos[2];
        const [ndx, ndz] = normalize2D(dx, dz);
        shade.pos[0] += ndx * TUNING.shade_speed * DT;
        shade.pos[2] += ndz * TUNING.shade_speed * DT;
        if (target && dist2D(shade.pos,target.pos)<=2) shade.state='drain';
        else if (!target) shade.state='chase';
      }
    }
  }

  _checkShadeCollision() {
    if (this.player.invulnTimer > 0) return;

    const ordered = [...this.shades].sort((a,b) => Number(a.id.replace(/\D/g,'')) - Number(b.id.replace(/\D/g,'')));
    for (const shade of ordered) {
      if (shade.state === 'stunned' || shade.state === 'spawning' || shade.state === 'recoil' || shade.state === 'drain') continue;

      const d = dist2D(this.player.pos, shade.pos);
      if (d <= TUNING.shade_hit_radius) {
        this.player.flames--;
        const dropped = Math.floor(this.player.carried * TUNING.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.invulnTimer = TUNING.invuln_s;
        this.player.invulnTicks = Math.round(TUNING.invuln_s * TICK_RATE);

        // Drop motes near player
        for (let i = 0; i < dropped; i++) {
          const angle = this.rng.float() * Math.PI * 2;
          const dist = this.rng.range(1, 3);
          this.motes.push({
            id: `M${this.moteIdCounter++}`,
            pos: [
              Math.round((this.player.pos[0] + Math.cos(angle) * dist) * 1000) / 1000,
              0,
              Math.round((this.player.pos[2] + Math.sin(angle) * dist) * 1000) / 1000,
            ],
            active: true,
            kind: 'dropped',
            ttlTicks: 1800,
          });
        }

        this.events.push({
          type: 'event',
          tick: this.tick + 1,
          name: 'player_hit',
          data: { by: 'shade', flames: this.player.flames, dropped, lost: dropped },
        });
        break; // only one hit per tick
      }
    }
  }

  _spawnShadeTimer() {
    if (this.simTick + 1 < this.nextShadeTick) return;
    const max = this.night === 1 ? 6 : this.night === 2 ? 8 : 10;
    const count = this.night === 1 && this.simTick < 600 ? 2 : 1;
    for (let i = 0; i < count && this.shades.length < max; i++) {
      const shade = this._createShade(this.shadeIdCounter++);
      this.shades.push(shade);
      this.events.push({ type: 'event', tick: this.tick + 1, name: 'shade_spawned', data: { id: shade.id } });
    }
    this.nextShadeTick += this.night === 1 ? 480 : this.night === 2 ? 420 : 360;
  }

  _spawnMoteTimer() {
    this.moteSpawnTimer += DT;
    const activeMotes = this.motes.filter(m => m.active).length;
    // Respawn motes every 15 seconds if fewer than 10 active
    if (this.moteSpawnTimer >= 15 && activeMotes < 10) {
      this.moteSpawnTimer = 0;
      const mote = this._spawnMote(this.moteIdCounter++);
      this.motes.push(mote);
    }
  }

  _checkWinLose() {
    // Lose: no flames
    if (this.player.flames <= 0) {
      this.state = 'lost';
      this.events.push({
        type: 'event',
        tick: this.tick + 1,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' },
      });
      return;
    }

    if (this.nightDuration - (this.simTick + 1) / TICK_RATE <= 0) {
      const lit = this.lanterns.filter(l => l.lit).length;
      const required = Math.ceil(TUNING.win_ratio * this.lanterns.length);
      const won = lit >= required;
      if (won) {
        this.score += this.lanterns.filter(l=>l.lit).reduce((sum,l)=>sum+50+Math.floor(l.fuelUnits/TICK_RATE),0) + this.player.flames*50;
        this.state='won';
      } else this.state='lost';
      this.events.push({
        type: 'event',
        tick: this.tick + 1,
        name: 'game_over',
        data: { result: won ? 'won' : 'lost', reason: won ? 'dawn_survived' : 'dawn' },
      });
    }
  }

  // ========== QUERIES ==========
  getTimeLeft() {
    return Math.max(0, this.nightDuration - this.simTick / TICK_RATE);
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      night: this.night,
      wind: { active: this.wind.active, dir_deg: this.wind.dir_deg },
      time_left_s: Math.round(this.getTimeLeft() * 1000) / 1000,
      score: this.score,
      player: {
        pos: roundPos(this.player.pos),
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.player.capacity,
        vel: roundPos(this.player.vel),
        grounded: this.player.onGround,
        invuln: Math.round(this.player.invulnTicks / TICK_RATE * 1000) / 1000,
        dash_cd_s: Math.round(this.player.dashCooldown * 1000) / 1000,
        pulse_cd_s: Math.round(this.player.pulseCooldown * 1000) / 1000,
        charm_s: Math.round(this.player.charmTicks / TICK_RATE * 1000) / 1000,
      },
      lanterns: this.lanterns.map(l => ({
        id: l.id,
        pos: roundPos(l.pos),
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? Math.round(l.fuelUnits / TICK_RATE * 10) / 10 : 0,
        ever_lit: l.ever_lit,
        relit_count: l.relit_count || 0,
      })),
      shades: this.shades.map(s => ({
        id: s.id,
        pos: roundPos(s.pos),
        state: s.state,
        target_lantern_id: s.targetLanternId || null,
      })),
      motes: this.motes.filter(m => m.active).map(m => ({ id: m.id, pos: roundPos(m.pos), kind: m.kind || 'random', ttl_s: Math.round((m.ttlTicks || 0) / TICK_RATE * 1000) / 1000 })),
      drifters: this.drifters.filter(d => d.state !== 'removed').map(d => ({ id: d.id, pos: roundPos(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map(c => ({ id: c.id, available: c.available, respawn_s: Math.round(c.respawnTicks / TICK_RATE * 1000) / 1000 })),
      motes_active: this.motes.filter(m => m.active).length,
    };
  }

  getEndRecord() {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }
}
