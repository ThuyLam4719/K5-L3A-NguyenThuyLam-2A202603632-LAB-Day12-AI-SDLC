/**
 * Đảo Đèn Lồng - Main Visual Entry Point
 * Three.js renderer + game engine integration
 */

import * as THREE from 'three';
import { GameEngine, TUNING } from './game-engine.js';

// ========== GLOBALS ==========
let engine;
let scene, camera, renderer;
let clock;
let keys = {};
let mouseX = 0, mouseY = 0;
let cameraYaw = 0, cameraPitch = 0.3;
let isPointerLocked = false;
let gameStarted = false;
let selectedNight = 1;
let totalScore = 0;
let currentSeed = 42;
let leaderboardSubmitted = false;
let nightsWon = 0;
let runResultProcessed = false;
let benchmarkMode = false;
let benchmarkLoadMs = null;
let benchmarkOrbitStart = 0;
let benchmarkCaptureStart = 0, benchmarkMeasurementStart = null, benchmarkPreviousFrame = null, benchmarkSamples = [], benchmarkCaptureDuration = 30;
let sensitivity = Number(localStorage.getItem('lantern-sensitivity') || 0.003);
let volume = Number(localStorage.getItem('lantern-volume') || 0.35);
let colorblind = localStorage.getItem('lantern-colorblind') === 'true';
let largeText = localStorage.getItem('lantern-large-text') === 'true';
let reducedMotion = localStorage.getItem('lantern-reduced-motion') === 'true';
const DEFAULT_KEYS = { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD', jump:'Space', dash:'ShiftLeft', interact:'KeyE', pulse:'KeyF', pause:'Escape' };
let keyBindings = (() => { try { return { ...DEFAULT_KEYS, ...JSON.parse(localStorage.getItem('lantern-key-bindings') || '{}') }; } catch { return { ...DEFAULT_KEYS }; } })();
let lastCountdown = 0;
let youtubeMusicOpen = false;
let lastHudUpdate = 0;
let accumulator = 0;
const DT = 1 / 60;

// Visual objects
let playerMesh;
let playerFallback;
let lanternMeshes = [];
let moteMeshes = [];
let shadeMeshes = [];
let drifterMeshes = [];
let charmMeshes = [];
let islandMesh;
let ambientLight, playerLight;
let lanternLights = [];
let fogParticles;
let skybox;
let benchmarkShadeBody, benchmarkShadeEyes, benchmarkMoteMesh;
const instanceDummy = new THREE.Object3D();

// ========== INIT ==========
function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17182b);
  scene.fog = new THREE.FogExp2(0x20243d, 0.011);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  // Dynamic point-light shadows and 2x device pixel ratios caused severe GPU load.
  // Keep painted/emissive lighting and disable expensive shadow-map passes.
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  clock = new THREE.Clock();

  // Lights
  ambientLight = new THREE.AmbientLight(0x45435d, 0.15);
  scene.add(ambientLight);

  const fillLight = new THREE.HemisphereLight(0xdce3ff, 0x7b866a, 0.62);
  scene.add(fillLight);

  const moonLight = new THREE.DirectionalLight(0x9ea7d0, 0.38);
  moonLight.position.set(50, 80, 30);
  scene.add(moonLight);

  // Create world
  createIsland();
  createSkybox();
  createPlayer();

  // Events
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', e => { keys[e.code] = true; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click', () => { totalScore = 0; nightsWon=0; startGame(); });
  document.getElementById('retry-btn').addEventListener('click', restartGame);
  document.getElementById('night-select').addEventListener('change', e => {
    selectedNight = Number(e.target.value);
    document.getElementById('night-title').textContent = ['','Đêm 1 — Đảo Bến','Đêm 2 — Cầu Tre','Đêm 3 — Tháp Chuông'][selectedNight];
    document.getElementById('night-story').innerHTML = [
      '',
      'Sương đen phủ kín Đảo Bến. Nezuko phải giữ ít nhất ba đèn sáng đến bình minh; châm dầu trước khi chúng tắt.',
      'Qua Cầu Tre, giữ ít nhất bốn đèn sáng đến bình minh; Gió Lạc và Bóng Mực đều rình ánh sáng.',
      'Trên Tháp Chuông, giữ ít nhất năm đèn sáng đến bình minh. Dầu cạn nhanh hơn giữa gió mạnh.',
    ][selectedNight];
  });
  document.getElementById('continue-btn').addEventListener('click', () => { totalScore += engine.score; selectedNight++; startGame(); });
  document.getElementById('menu-btn').addEventListener('click', returnToMenu);
  document.getElementById('pause-menu-btn').addEventListener('click', returnToMenu);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('pause-retry-btn').addEventListener('click', restartGame);
  document.getElementById('settings-btn').addEventListener('click', showSettings);
  document.getElementById('pause-settings-btn').addEventListener('click', showSettings);
  document.getElementById('settings-close').addEventListener('click', () => { document.getElementById('settings-modal').style.display = 'none'; });
  document.getElementById('leaderboard-btn').addEventListener('click', showLeaderboard);
  document.getElementById('leaderboard-close').addEventListener('click', () => { document.getElementById('leaderboard-modal').style.display='none'; });
  document.getElementById('leaderboard-export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({entries:readLeaderboard()},null,2)+'\n'],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='leaderboard.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
  document.getElementById('sensitivity-setting').value = sensitivity;
  document.getElementById('colorblind-setting').checked = colorblind;
  document.body.classList.toggle('colorblind', colorblind);
  document.getElementById('large-text-setting').checked = largeText;
  document.getElementById('reduced-motion-setting').checked = reducedMotion;
  document.body.classList.toggle('large-text', largeText);
  document.body.classList.toggle('reduced-motion', reducedMotion);
  document.getElementById('large-text-setting').addEventListener('change', e => { largeText=e.target.checked; localStorage.setItem('lantern-large-text',String(largeText)); document.body.classList.toggle('large-text',largeText); });
  document.getElementById('reduced-motion-setting').addEventListener('change', e => { reducedMotion=e.target.checked; localStorage.setItem('lantern-reduced-motion',String(reducedMotion)); document.body.classList.toggle('reduced-motion',reducedMotion); });
  buildKeyBindingsUI();
  document.getElementById('colorblind-setting').addEventListener('change', e => {
    colorblind = e.target.checked; localStorage.setItem('lantern-colorblind', String(colorblind));
    document.body.classList.toggle('colorblind', colorblind); if (engine) updateShadeMeshes();
  });
  document.getElementById('sensitivity-setting').addEventListener('input', e => {
    sensitivity = Number(e.target.value); localStorage.setItem('lantern-sensitivity', sensitivity);
  });
}

function startGame() {
  document.body.dataset.benchmarkStatus='game-start';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('pause-menu').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('lantern-progress').style.display = 'flex';
  document.getElementById('crosshair').style.display = 'block';

  benchmarkMode = new URLSearchParams(location.search).get('bench') === '1';
  if (!benchmarkMode) renderer.domElement.requestPointerLock();

  clearVisualObjects();
  currentSeed = Date.now() & 0xFFFFFFFF;
  engine = new GameEngine(currentSeed, selectedNight);
  if (benchmarkMode) configureBenchmarkScene();
  leaderboardSubmitted = false;
  runResultProcessed = false;
  createIsland();
  document.getElementById('lantern-progress').innerHTML = engine.lanterns.map((_, i) => `<div class="lantern-pip" id="lp${i + 1}"></div>`).join('');
  document.getElementById('mote-meter').innerHTML = Array.from({ length: TUNING.capacity_max }, (_, i) => `<span class="mote-cell" id="mc${i + 1}"></span>`).join('');
  document.getElementById('mote-meter').style.display = 'flex';
  buildLanternFuelHud();
  stopAmbientMusic();
  gameStarted = true;
  accumulator = 0;

  // Build visual objects
  buildVisualObjects();
  if (benchmarkMode) beginBenchmarkCapture();
  animate();
}

function configureBenchmarkScene() {
  benchmarkOrbitStart=0;
  document.body.dataset.benchmarkStatus='scene-configured';
  const random={s:42,next(){this.s=(Math.imul(this.s,1664525)+1013904223)>>>0;return this.s/4294967296;}};
  const shades=Array.from({length:200},(_,i)=>{const a=random.next()*Math.PI*2,r=3+Math.sqrt(random.next())*34;return{id:`S${String(i).padStart(3,'0')}`,state:'wander',pos:[Math.cos(a)*r,0,Math.sin(a)*r]};});
  const motes=Array.from({length:100},()=>{const a=random.next()*Math.PI*2,r=Math.sqrt(random.next())*35;return[Math.cos(a)*r,0,Math.sin(a)*r];});
  engine.applyScenario({random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,shades,motes,lanterns:[{id:'L1',lit:true,fuel:100},{id:'L2',lit:true,fuel:100},{id:'L3',lit:true,fuel:100}]});
  document.getElementById('hud').style.display='none';document.getElementById('lantern-progress').style.display='none';document.getElementById('mote-meter').style.display='none';
  camera.position.set(30,15,0);camera.lookAt(0,0,0);
}

function beginBenchmarkCapture() {
  document.body.dataset.benchmarkStatus='capture-started';
  const params=new URLSearchParams(location.search);benchmarkCaptureDuration=Math.max(1,Number(params.get('duration')||30));document.body.dataset.benchmarkDuration=String(benchmarkCaptureDuration);
  benchmarkOrbitStart=performance.now();benchmarkCaptureStart=performance.now();benchmarkMeasurementStart=null;benchmarkPreviousFrame=null;benchmarkSamples=[];
}

function recordBenchmarkFrame(now) {
  if(benchmarkMeasurementStart===null){benchmarkPreviousFrame=now;if(now-benchmarkCaptureStart>=3000)benchmarkMeasurementStart=now;return;}
  benchmarkSamples.push(now-benchmarkPreviousFrame);benchmarkPreviousFrame=now;
  document.body.dataset.benchmarkFrames=String(benchmarkSamples.length);document.body.dataset.benchmarkElapsed=String(Math.max(0,Math.round(now-benchmarkMeasurementStart)));
  if(now-benchmarkMeasurementStart<benchmarkCaptureDuration*1000)return;
  const ordered=[...benchmarkSamples].sort((a,b)=>a-b),k=Math.max(1,Math.ceil(.01*ordered.length)),slow=ordered.slice(-k),p95=ordered[Math.min(ordered.length-1,Math.ceil(.95*ordered.length)-1)];
  const result={contract_version:'1.3',avg_fps:Math.round(benchmarkSamples.length*10000/benchmarkSamples.reduce((a,b)=>a+b,0))/10,p1_low_fps:Math.round(10000/(slow.reduce((a,b)=>a+b,0)/slow.length))/10,frame_ms_p95:Math.round(p95*10)/10,frames:benchmarkSamples.length,load_ms:benchmarkLoadMs??Math.round(benchmarkCaptureStart),peak_mem_mb:null,vsync_off:true,renderer:`Three.js ${renderer.capabilities.isWebGL2?'WebGL2':'WebGL'}; ${renderer.info.render.triangles} triangles`,os:'browser'};
  const params=new URLSearchParams(location.search),link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}));link.download=params.get('out')||'bench.json';link.click();document.body.dataset.benchmarkResult=JSON.stringify(result);benchmarkMode=false;
}

function restartGame() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('pause-menu').style.display = 'none';
  // Clear old visuals
  clearVisualObjects();
  if(runResultProcessed&&engine?.state==='won')nightsWon=Math.max(0,nightsWon-1);
  currentSeed = Date.now() & 0xFFFFFFFF;
  engine = new GameEngine(currentSeed, selectedNight);
  leaderboardSubmitted = false;
  runResultProcessed = false;
  createIsland();
  document.getElementById('lantern-progress').innerHTML = engine.lanterns.map((_, i) => `<div class="lantern-pip" id="lp${i + 1}"></div>`).join('');
  document.getElementById('mote-meter').innerHTML = Array.from({ length: TUNING.capacity_max }, (_, i) => `<span class="mote-cell" id="mc${i + 1}"></span>`).join('');
  document.getElementById('mote-meter').style.display = 'flex';
  buildLanternFuelHud();
  buildVisualObjects();
  gameStarted = true;
  accumulator = 0;
  stopAmbientMusic();
  renderer.domElement.requestPointerLock();
}

function showSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
}

const KEY_LABELS = {up:'Di chuyển lên',down:'Di chuyển xuống',left:'Di chuyển trái',right:'Di chuyển phải',jump:'Nhảy',dash:'Lướt',interact:'Tương tác',pulse:'Tỏa sáng',pause:'Tạm dừng'};
function keyName(code) { return code==='Space'?'Space':code.replace(/^Key/,'').replace(/^Arrow/,'Mũi tên ').replace('ShiftLeft','Shift'); }
function buildKeyBindingsUI() {
  const root=document.getElementById('key-bindings'); root.innerHTML='<h3>Đổi phím</h3>';
  for (const [action,label] of Object.entries(KEY_LABELS)) {
    const row=document.createElement('div'); row.className='setting-row';
    const title=document.createElement('span'); title.textContent=label;
    const button=document.createElement('button'); button.type='button'; button.className='secondary-btn'; button.textContent=keyName(keyBindings[action]); button.setAttribute('aria-label',`${label}: ${keyName(keyBindings[action])}`);
    button.addEventListener('click',()=>{
      button.textContent='Nhấn phím…';
      const capture=e=>{
        e.preventDefault(); e.stopPropagation(); document.removeEventListener('keydown',capture,true);
        if (e.code==='Escape' && action!=='pause') { button.textContent=keyName(keyBindings[action]); return; }
        const other=Object.entries(keyBindings).find(([name,code])=>name!==action&&code===e.code);
        if (other) { button.textContent=`Trùng: ${KEY_LABELS[other[0]]}`; setTimeout(()=>button.textContent=keyName(keyBindings[action]),1500); return; }
        keyBindings[action]=e.code; localStorage.setItem('lantern-key-bindings',JSON.stringify(keyBindings)); button.textContent=keyName(e.code);
      };
      document.addEventListener('keydown',capture,true);
    });
    row.append(title,button); root.append(row);
  }
  document.getElementById('reset-keys').onclick=()=>{ keyBindings={...DEFAULT_KEYS}; localStorage.setItem('lantern-key-bindings',JSON.stringify(keyBindings)); buildKeyBindingsUI(); };
}

function readLeaderboard() { try { const rows=JSON.parse(localStorage.getItem('lantern-leaderboard')||'[]'); return Array.isArray(rows)?rows:[]; } catch { return []; } }
function showLeaderboard() {
  const entries=readLeaderboard();
  document.getElementById('leaderboard-content').innerHTML=entries.length?`<table class="leaderboard-table"><thead><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th></tr></thead><tbody>${entries.map((e,i)=>`<tr><td>${i+1}</td><td>${escapeHTML(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td></tr>`).join('')}</tbody></table>`:'<p>Chưa có điểm được lưu.</p>';
  document.getElementById('leaderboard-modal').style.display='flex';
}
function escapeHTML(text) { const el=document.createElement('span'); el.textContent=text; return el.innerHTML; }
function submitLeaderboard() {
  if (leaderboardSubmitted || (engine.state==='won' && engine.night<3)) return;
  leaderboardSubmitted=true;
  let name=prompt('Nhập tên (3–12 ký tự: A–Z, a–z, 0–9, _):','Player');
  if (name===null) return;
  while (!/^[A-Za-z0-9_]{3,12}$/.test(name)) { name=prompt('Tên chưa hợp lệ. Hãy nhập 3–12 ký tự A–Z, a–z, 0–9 hoặc _.','Player'); if(name===null)return; }
  const wonNow=engine.state==='won';
  const entries=[...readLeaderboard(),{name,score:totalScore+(wonNow?engine.score:0),nights_won:Math.min(3,nightsWon),achieved_at:new Date().toISOString(),seed:currentSeed}];
  entries.sort((a,b)=>b.score-a.score||Date.parse(a.achieved_at)-Date.parse(b.achieved_at));
  localStorage.setItem('lantern-leaderboard',JSON.stringify(entries.slice(0,10)));
}

function resumeGame() {
  if (engine?.state === 'paused') {
    engine.setInput({ pause: true }); engine.step(); engine.setInput({ pause: false });
  }
  document.getElementById('pause-menu').style.display = 'none';
  stopAmbientMusic();
  if (gameStarted) renderer.domElement.requestPointerLock();
}

function returnToMenu() {
  if (engine && engine.state === 'won') totalScore += engine.score;
  stopAmbientMusic();
  gameStarted = false;
  document.exitPointerLock();
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('pause-menu').style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  document.getElementById('lantern-progress').style.display = 'none';
  document.getElementById('mote-meter').style.display = 'none';
  document.getElementById('lantern-fuel-overlay').innerHTML = '';
  document.getElementById('lantern-arrow').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  document.getElementById('night-select').value = selectedNight;
}

// ========== CREATE WORLD ==========
function createIsland() {
  if (islandMesh) disposeVisualTree(islandMesh);
  const group = new THREE.Group();
  const earth = new THREE.MeshStandardMaterial({ color: 0x81946e, emissive: 0x202a17, emissiveIntensity: 0.28, roughness: 0.92, flatShading: true });
  const edge = new THREE.MeshStandardMaterial({ color: 0x443d55, roughness: 1 });
  const lanternLight = new THREE.MeshStandardMaterial({ color: 0xffd38d, emissive: 0x8e4e20, emissiveIntensity: 0.5 });
  const addIsland = (cx, radius, top = 0) => {
    const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 72), earth);
    disk.rotation.x = -Math.PI / 2; disk.position.set(cx, top + 0.015, 0); disk.receiveShadow = true; group.add(disk);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 1.2, 2, 72), edge);
    rim.position.set(cx, top - 1, 0); rim.receiveShadow = true; group.add(rim);
  };
  if (selectedNight === 1) addIsland(0, 40);
  if (selectedNight === 2) {
    addIsland(0, 28); addIsland(70, 28);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 4), new THREE.MeshStandardMaterial({ color: 0x9a714b, roughness: 0.8 }));
    bridge.position.set(35, 0.08, 0); bridge.castShadow = true; bridge.receiveShadow = true; group.add(bridge);
    for (const [x,z] of [[20,18],[50,-18]]) { const pad = new THREE.Mesh(new THREE.CylinderGeometry(1,1,0.18,24), lanternLight); pad.position.set(x,0.1,z); group.add(pad); }
  }
  if (selectedNight === 3) {
    addIsland(0,45);
    const ring = new THREE.Mesh(new THREE.RingGeometry(12,24,72,1,0,Math.PI), new THREE.MeshStandardMaterial({ color:0x7d815f, roughness:.9, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.y=3.02; group.add(ring);
    const summit = new THREE.Mesh(new THREE.CircleGeometry(8,48), new THREE.MeshStandardMaterial({color:0x9b8c65,roughness:.85}));
    summit.rotation.x=-Math.PI/2; summit.position.y=6.02; group.add(summit);
    for (const deg of [30,150]) { const angle=deg*Math.PI/180; const ramp=new THREE.Mesh(new THREE.BoxGeometry(6,.18,3),new THREE.MeshStandardMaterial({color:0x927553,roughness:.9})); ramp.position.set(Math.cos(angle)*27,1.55,Math.sin(angle)*27); ramp.rotation.y=-angle; group.add(ramp); }
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(2,2,8,16),new THREE.MeshStandardMaterial({color:0x80634f,roughness:.75})); tower.position.y=10; tower.castShadow=true; group.add(tower);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.18,24),lanternLight); pad.position.set(0,3.1,13); group.add(pad);
  }
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(420,420), new THREE.MeshStandardMaterial({color:0x8f92ae,transparent:true,opacity:.17,roughness:1}));
  cloud.rotation.x=-Math.PI/2; cloud.position.y=-4; group.add(cloud);
  islandMesh=group; scene.add(group);
}
function createSkybox() {
  // Simple starry sky
  const starCount = 500;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5; // upper hemisphere
    const r = 150;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

function createPlayer() {
  playerMesh = new THREE.Group();
  playerFallback = new THREE.Group();
  const add = (geometry, color, position, scale = [1,1,1], materialExtras = {}) => {
    const {rotation, ...materialOptions}=materialExtras;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color, roughness:.75, ...materialOptions}));
    mesh.position.set(...position); mesh.scale.set(...scale); if(rotation) mesh.rotation.set(rotation.x||0,rotation.y||0,rotation.z||0); mesh.castShadow = true; playerFallback.add(mesh); return mesh;
  };
  add(new THREE.CapsuleGeometry(.33,.62,4,8),0xf0a3b7,[0,.68,0],[1,1,1]); // pink kimono
  add(new THREE.TorusGeometry(.28,.09,6,12),0x8b4a38,[0,.58,0],[1,.6,1]); // obi
  add(new THREE.SphereGeometry(.28,12,10),0xf3c6a8,[0,1.38,.02]); // face
  add(new THREE.SphereGeometry(.32,12,10),0x17141d,[0,1.58,-.04],[1,.9,1.1]); // hair cap
  add(new THREE.CapsuleGeometry(.12,.7,4,8),0x17141d,[0,1.13,-.22],[1,1,1]); // long hair
  add(new THREE.SphereGeometry(.055,8,8),0x9c365d,[-.12,1.4,.265]);
  add(new THREE.SphereGeometry(.055,8,8),0x9c365d,[.12,1.4,.265]);
  add(new THREE.CylinderGeometry(.045,.045,.34,8),0x75a65b,[0,1.32,.31],[1,1,1],{rotation:{x:Math.PI/2}}); // bamboo muzzle
  add(new THREE.ConeGeometry(.14,.35,5),0xe98bab,[-.25,1.72,-.02],[1,1,1]);
  add(new THREE.ConeGeometry(.14,.35,5),0xe98bab,[.25,1.72,-.02],[1,1,1]);
  add(new THREE.SphereGeometry(.13,8,8),0xffd55d,[.43,1.08,0], [1,1,1], {emissive:0xff6600,emissiveIntensity:1.5});
  playerMesh.add(playerFallback);

  // Player light
  playerLight = new THREE.PointLight(0xffaa44, 2, 15);
  playerLight.position.set(0, 1.5, 0);
  playerLight.castShadow = false;
  playerLight.visible = false;
  playerMesh.add(playerLight);

  scene.add(playerMesh);
  loadNezukoModel();
}

function loadNezukoModel() {
  fetch('/assets/models/nezuko.glb',{method:'HEAD'}).then(response=>{
    if(!response.ok){console.info('Optional public/assets/models/nezuko.glb missing; using built-in model.');return;}
    import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().load('/assets/models/nezuko.glb', gltf => {
    const model=gltf.scene;
    model.rotation.y=Math.PI;
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    const size=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    const scale=1.75/(size.y || 1);
    model.scale.setScalar(scale);
    model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    playerMesh.add(model);
    playerFallback.visible=false;
    },undefined,error=>console.warn('Could not load optional Nezuko GLB; using built-in model.',error)));
  }).catch(()=>console.info('Optional public/assets/models/nezuko.glb missing; using built-in model.'));
}

// ========== BUILD GAME OBJECTS ==========
function buildVisualObjects() {
  // Lanterns
  lanternMeshes = [];
  lanternLights = [];
  for (const lantern of engine.lanterns) {
    const group = new THREE.Group();

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 3, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.5;
    pole.castShadow = false;
    group.add(pole);

    // Lantern body
    const lanternGeo = new THREE.OctahedronGeometry(0.6, 0);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0x000000,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.8,
    });
    const lanternBody = new THREE.Mesh(lanternGeo, lanternMat);
    lanternBody.position.y = 3.3;
    lanternBody.scale.set(1, 1.3, 1);
    group.add(lanternBody);
    const tear = new THREE.Mesh(new THREE.BoxGeometry(.08,.72,.08), new THREE.MeshStandardMaterial({color:0x211b25,roughness:1}));
    tear.position.set(.16,3.3,.18); tear.rotation.z=-.35; tear.userData.lanternTear=true; group.add(tear);

    // Light (starts dim)
    const light = new THREE.PointLight(0xffaa22, 0, 0);
    light.position.y = 3.3;
    light.castShadow = false;
    // Emissive lantern meshes and ambient light provide glow without dynamic point-light shaders.
    light.visible = false;
    group.add(light);
    lanternLights.push(light);

    group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);
    scene.add(group);
    lanternMeshes.push(group);
  }

  // Initial motes
  updateMoteMeshes();

  // Initial shades
  updateShadeMeshes();
  updateDrifterMeshes();
  updateCharmMeshes();
}

function clearVisualObjects() {
  for (const m of lanternMeshes) disposeVisualTree(m);
  for (const m of moteMeshes) disposeVisualTree(m);
  for (const m of shadeMeshes) disposeVisualTree(m);
  for (const m of drifterMeshes) disposeVisualTree(m);
  for (const m of charmMeshes) disposeVisualTree(m);
  if(benchmarkShadeBody)disposeVisualTree(benchmarkShadeBody);if(benchmarkShadeEyes)disposeVisualTree(benchmarkShadeEyes);
  if(benchmarkMoteMesh)disposeVisualTree(benchmarkMoteMesh);
  benchmarkShadeBody=benchmarkShadeEyes=benchmarkMoteMesh=null;
  lanternMeshes = [];
  lanternLights = [];
  moteMeshes = [];
  shadeMeshes = [];
  drifterMeshes = [];
  charmMeshes = [];
}

function disposeVisualTree(root) {
  scene.remove(root);
  root.traverse?.(node=>{
    if(node.geometry&&node.geometry!==sharedMoteGeometry)node.geometry.dispose();
    const materials=Array.isArray(node.material)?node.material:[node.material];
    for(const material of materials)if(material&&material!==sharedMoteMaterial)material.dispose();
  });
}

function updateDrifterMeshes() {
  for (const mesh of drifterMeshes) disposeVisualTree(mesh);
  drifterMeshes = engine.drifters.filter(d => d.state !== 'removed').map(d => {
    const group = new THREE.Group();
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(.72,.16,8,20), new THREE.MeshStandardMaterial({color:0x8cbac4,emissive:0x2f6474,emissiveIntensity:.8,transparent:true,opacity:.78}));
    ribbon.scale.set(1.5,.38,.6); ribbon.rotation.x=Math.PI/2; group.add(ribbon);
    const core = new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),new THREE.MeshStandardMaterial({color:0xc2e0dd,emissive:0x527a85,emissiveIntensity:.7})); core.position.y=.2; group.add(core);
    group.userData.drifterId=d.id; scene.add(group); return group;
  });
}

function updateCharmMeshes() {
  for (const mesh of charmMeshes) disposeVisualTree(mesh);
  charmMeshes = engine.charms.map(charm => {
    const group = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.OctahedronGeometry(.55,0),new THREE.MeshStandardMaterial({color:0xe65055,emissive:0x8f1e2b,emissiveIntensity:.8}));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.62,.06,6,18),new THREE.MeshStandardMaterial({color:0xffd76c,emissive:0x9d6827,emissiveIntensity:.8}));
    group.add(leaf,rim); group.userData.charmId=charm.id; group.position.set(...charm.pos); scene.add(group); return group;
  });
}

function updateMoteMeshes() {
  if (benchmarkMode) {
    for (const m of moteMeshes) scene.remove(m);
    moteMeshes=[];
    const active=engine.motes.filter(m=>m.active);
    benchmarkMoteMesh=new THREE.InstancedMesh(sharedMoteGeometry,sharedMoteMaterial,Math.max(1,active.length));
    benchmarkMoteMesh.count=active.length; benchmarkMoteMesh.frustumCulled=false; scene.add(benchmarkMoteMesh); moteMeshes=[benchmarkMoteMesh];
    updateBenchmarkMoteInstances(); return;
  }
  // Remove old
  for (const m of moteMeshes) disposeVisualTree(m);
  moteMeshes = [];

  for (const mote of engine.motes) {
    if (!mote.active) continue;

    const moteGeo = sharedMoteGeometry;
    const mesh = new THREE.Mesh(moteGeo, sharedMoteMaterial);
    mesh.position.set(mote.pos[0], 0.8, mote.pos[2]);
    mesh.userData.moteId = mote.id;
    scene.add(mesh);
    moteMeshes.push(mesh);

  }
}

function updateBenchmarkMoteInstances() {
  if(!benchmarkMoteMesh)return;
  let index=0;const time=clock.getElapsedTime();
  for(const mote of engine.motes){if(!mote.active)continue;instanceDummy.position.set(mote.pos[0],.8+Math.sin(time*3+index*.5)*.3,mote.pos[2]);instanceDummy.scale.setScalar(.8+Math.sin(time*4+index)*.2);instanceDummy.updateMatrix();benchmarkMoteMesh.setMatrixAt(index++,instanceDummy.matrix);}
  benchmarkMoteMesh.count=index;benchmarkMoteMesh.instanceMatrix.needsUpdate=true;
}

const sharedMoteGeometry = new THREE.SphereGeometry(0.1, 4, 4);
const sharedMoteMaterial = new THREE.MeshBasicMaterial({ color: 0x8dff9b });

function updateShadeMeshes() {
  if(benchmarkMode){
    if(benchmarkShadeBody)disposeVisualTree(benchmarkShadeBody);if(benchmarkShadeEyes)disposeVisualTree(benchmarkShadeEyes);
    const n=engine.shades.length;
    benchmarkShadeBody=new THREE.InstancedMesh(new THREE.SphereGeometry(.62,7,5),new THREE.MeshBasicMaterial({color:0x211a36}),n);
    benchmarkShadeEyes=new THREE.InstancedMesh(new THREE.SphereGeometry(.075,4,3),new THREE.MeshBasicMaterial({color:colorblind?0x00b3ff:0x7a3cff}),n*2);
    benchmarkShadeBody.frustumCulled=false;benchmarkShadeEyes.frustumCulled=false;
    scene.add(benchmarkShadeBody,benchmarkShadeEyes);shadeMeshes=[];updateBenchmarkShadeInstances();return;
  }
  // Remove old
  for (const m of shadeMeshes) disposeVisualTree(m);
  shadeMeshes = [];

  for (const shade of engine.shades) {
    const group = new THREE.Group();

    // Shade body - blobby dark shape
    const shadeGeo = new THREE.SphereGeometry(0.6, 6, 6);
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0033,
      emissive: 0x220044,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    const shadeBody = new THREE.Mesh(shadeGeo, shadeMat);
    shadeBody.position.y = 0.6;
    shadeBody.scale.set(1, 1.3, 1);
    group.add(shadeBody);

    const rimMat = new THREE.MeshStandardMaterial({color:colorblind?0x00b3ff:0x7a3cff,emissive:colorblind?0x00b3ff:0x7a3cff,emissiveIntensity:1.1});
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.68,.045,6,16),rimMat); rim.position.y=.6; group.add(rim);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 4, 4);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: colorblind ? 0x00b3ff : 0x7a3cff,
      emissive: colorblind ? 0x00b3ff : 0x7a3cff,
      emissiveIntensity: 3,
    });
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(-0.2, 0.8, 0.5);
    group.add(eye1);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.position.set(0.2, 0.8, 0.5);
    group.add(eye2);

    group.position.set(shade.pos[0], 0, shade.pos[2]);
    group.userData.shadeId = shade.id;
    scene.add(group);
    shadeMeshes.push(group);
  }
}

function updateBenchmarkShadeInstances() {
  if(!benchmarkShadeBody||!benchmarkShadeEyes)return;
  const time=clock.getElapsedTime();let eyeIndex=0;
  for(let i=0;i<engine.shades.length;i++){
    const shade=engine.shades[i];instanceDummy.position.set(shade.pos[0],.65+Math.sin(time*2+i*1.5)*.12,shade.pos[2]);instanceDummy.scale.set(1,1,1);instanceDummy.updateMatrix();benchmarkShadeBody.setMatrixAt(i,instanceDummy.matrix);
    for(const side of [-1,1]){instanceDummy.position.set(shade.pos[0]+side*.18,.73+Math.sin(time*2+i*1.5)*.12,shade.pos[2]-.48);instanceDummy.scale.set(1,1,1);instanceDummy.updateMatrix();benchmarkShadeEyes.setMatrixAt(eyeIndex++,instanceDummy.matrix);}
  }
  benchmarkShadeBody.instanceMatrix.needsUpdate=true;benchmarkShadeEyes.instanceMatrix.needsUpdate=true;
}

function buildLanternFuelHud() {
  const overlay = document.getElementById('lantern-fuel-overlay');
  overlay.innerHTML = engine.lanterns.map(l=>`<div class="fuel-hud" id="fuel-${l.id}"><span class="fuel-label">${l.id}</span><span class="fuel-track"><i></i></span></div>`).join('');
}

// ========== INPUT ==========
function onMouseMove(e) {
  if (!isPointerLocked) return;
  cameraYaw -= e.movementX * sensitivity;
  cameraPitch -= e.movementY * sensitivity;
  cameraPitch = Math.max(-0.5, Math.min(1.2, cameraPitch));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if(!gameStarted) renderer.render(scene,camera);
}

function getInputFromKeys() {
  let mx = 0, mz = 0;

  if (keys[keyBindings.up]) mz = 1;
  if (keys[keyBindings.down]) mz = -1;
  if (keys[keyBindings.left]) mx = -1;
  if (keys[keyBindings.right]) mx = 1;

  const jumpPressed = keys[keyBindings.jump] || false;
  const interactPressed = keys[keyBindings.interact] || false;
  const pulsePressed = keys[keyBindings.pulse] || false;
  const dashPressed = keys[keyBindings.dash] || keys['ShiftRight'] || false;
  const pausePressed = keys[keyBindings.pause] || false;

  engine.input.move = [mx, mz];
  engine.input.cam_yaw_deg = (-cameraYaw * 180 / Math.PI) % 360;
  engine.input.jump = jumpPressed;
  engine.input.interact = interactPressed;
  engine.input.pulse = pulsePressed;
  engine.input.dash = dashPressed;
  engine.input.pause = pausePressed;
}

// ========== UPDATE VISUALS ==========
function updateVisuals() {
  if (!engine) return;

  const time = clock.getElapsedTime();

  // Player position
  playerMesh.position.set(engine.player.pos[0], engine.player.pos[1], engine.player.pos[2]);
  // Face movement direction
  const yawRad = -cameraYaw;
  playerMesh.rotation.y = yawRad;

  // Player light intensity based on carried motes
  const baseIntensity = 1;
  const moteBonus = engine.player.carried * 0.3;
  playerLight.intensity = baseIntensity + moteBonus;
  playerLight.distance = 10 + engine.player.carried * 1;

  // Invulnerability flash
  if (engine.player.invulnTimer > 0 && !reducedMotion) {
    playerMesh.visible = Math.floor(time * 10) % 2 === 0;
  } else {
    playerMesh.visible = true;
  }

  // Camera follow
  if (!benchmarkMode) {
    const camDist = 8;
    const camX = engine.player.pos[0] + Math.sin(cameraYaw) * camDist;
    const camZ = engine.player.pos[2] + Math.cos(cameraYaw) * camDist;
    const camY = engine.player.pos[1] + 2 + cameraPitch * 5;
    camera.position.x += (camX - camera.position.x) * 0.1;
    camera.position.y += (camY - camera.position.y) * 0.1;
    camera.position.z += (camZ - camera.position.z) * 0.1;
    camera.lookAt(engine.player.pos[0], engine.player.pos[1] + 1, engine.player.pos[2]);
  }

  // Update lanterns
  for (let i = 0; i < engine.lanterns.length; i++) {
    const lantern = engine.lanterns[i];
    const fuel = lantern.fuelUnits / 60;
    const mesh = lanternMeshes[i];
    const light = lanternLights[i];

    if (lantern.lit) {
      // Lit lantern
      const lanternBody = mesh.children[1];
      lanternBody.material.emissive.setHex(0xff8800);
      lanternBody.material.emissiveIntensity = 1 + Math.sin(time * 2 + i) * 0.3;
      light.intensity = 3 + Math.sin(time * 3 + i) * 0.5;
      light.distance = TUNING.safe_radius * 2;
      light.color.setHex(0xffaa22);
      lanternBody.scale.y=1.3;
      const blinking = fuel < TUNING.low_fuel_threshold;
      const blink = blinking ? (.42 + .58*(.5+.5*Math.sin(time*Math.PI*2))) : 1;
      lanternBody.material.opacity = blink;
      light.intensity = (3 + Math.sin(time * 3 + i) * .5) * blink;
      const tearOn=mesh.children.find(child=>child.userData.lanternTear); if(tearOn) tearOn.visible=false;
    } else if (lantern.deposited > 0) {
      // Partially filled
      const ratio = lantern.deposited / (lantern.ever_lit ? TUNING.relight_cost : TUNING.lantern_cost);
      const lanternBody = mesh.children[1];
      lanternBody.material.emissive.setHex(0xff4400);
      lanternBody.material.emissiveIntensity = ratio * 0.5;
      lanternBody.scale.y=1.04;
      light.intensity = ratio;
      light.distance = 5;
      const tearPartial=mesh.children.find(child=>child.userData.lanternTear); if(tearPartial) tearPartial.visible=true;
    } else {
      mesh.children[1].scale.y=1.04;
      mesh.children[1].material.opacity=1;
      mesh.children[1].material.emissive.setHex(0x000000);
      mesh.children[1].material.emissiveIntensity=0;
      light.intensity=0;
      const tearOff=mesh.children.find(child=>child.userData.lanternTear); if(tearOff) tearOff.visible=true;
    }
  }

  // Update motes (floating animation)
  if(benchmarkMode) updateBenchmarkMoteInstances();
  else {
    let moteIdx = 0;
    for (const mesh of moteMeshes) { if (mesh.parent) { mesh.position.y = 0.8 + Math.sin(time * 3 + moteIdx * 0.5) * 0.3; mesh.scale.setScalar(0.8 + Math.sin(time * 4 + moteIdx) * 0.2); } moteIdx++; }
  }

  // Sync mote visibility
  if(!benchmarkMode){const activeMoteIds = new Set();for (const mote of engine.motes) if (mote.active) activeMoteIds.add(mote.id);for (const mesh of moteMeshes) mesh.visible = activeMoteIds.has(mesh.userData.moteId);}

  // Update shades
  if(benchmarkMode) updateBenchmarkShadeInstances();
  else for (let i = 0; i < engine.shades.length; i++) {
    const shade = engine.shades[i];
    if (i < shadeMeshes.length) {
      const mesh = shadeMeshes[i];
      mesh.position.set(shade.pos[0], 0, shade.pos[2]);

      // Look at player
      mesh.lookAt(engine.player.pos[0], 0, engine.player.pos[2]);

      // Stunned effect
      if (shade.state === 'stunned') {
        mesh.children[0].material.opacity = 0.3;
        mesh.children[0].material.emissive.setHex(0x444444);
      } else {
        mesh.children[0].material.opacity = 0.85;
        mesh.children[0].material.emissive.setHex(0x220044);
      }

      // Bobbing animation
      mesh.children[0].position.y = 0.6 + Math.sin(time * 2 + i * 1.5) * 0.15;
    }
  }

  // Handle new shades
  if (!benchmarkMode && engine.shades.length > shadeMeshes.length) {
    updateShadeMeshes();
  }
  if (engine.drifters.filter(d => d.state !== 'removed').length !== drifterMeshes.length) updateDrifterMeshes();
  for (const mesh of drifterMeshes) {
    const d = engine.drifters.find(item => item.id === mesh.userData.drifterId);
    if (!d || d.state === 'removed') { mesh.visible = false; continue; }
    mesh.visible = true; mesh.position.set(d.pos[0], d.pos[1] + 1 + Math.sin(time * 2) * .25, d.pos[2]);
    mesh.rotation.y = Math.sin(time * 1.2) * .25;
  }
  for (const mesh of charmMeshes) {
    const charm = engine.charms.find(item => item.id === mesh.userData.charmId);
    if (charm) { mesh.visible = charm.available; mesh.rotation.y = time * .7; mesh.position.y = charm.pos[1] + .8 + Math.sin(time * 2) * .18; }
  }

  // Handle new motes (from drops)
  if(!benchmarkMode){const activeMoteCount=engine.motes.reduce((n,m)=>n+(m.active?1:0),0);const visibleMoteCount=moteMeshes.reduce((n,m)=>n+(m.visible?1:0),0);if(activeMoteCount!==visibleMoteCount)updateMoteMeshes();}

  // Ambient light changes as lanterns are lit
  const litCount = engine.lanterns.filter(l => l.lit).length;
  ambientLight.intensity = 0.15 + 0.55 * litCount / engine.lanterns.length;
  scene.fog.density = Math.max(0.004, 0.011 - litCount * 0.001);
  for (const lantern of engine.lanterns) {
    const fuel = lantern.fuelUnits / 60;
    const hud=document.getElementById(`fuel-${lantern.id}`);
    if (!hud) continue;
    const point=new THREE.Vector3(lantern.pos[0],lantern.pos[1]+4.2,lantern.pos[2]).project(camera);
    hud.style.display=lantern.lit && point.z<1 ? 'block' : 'none';
    hud.style.left=`${(point.x*.5+.5)*window.innerWidth}px`; hud.style.top=`${(-point.y*.5+.5)*window.innerHeight}px`;
    hud.classList.toggle('low',lantern.lit && fuel<TUNING.low_fuel_threshold);
    hud.querySelector('i').style.width=`${fuel}%`;
    hud.querySelector('.fuel-label').textContent=`${lantern.id} · ${fuel.toFixed(1)}`;
  }

  // Update HUD
  if (!benchmarkMode && time - lastHudUpdate >= 0.1) { lastHudUpdate = time; updateHUD(); }
}

function updateHUD() {
  const timeLeft = engine.getTimeLeft();
  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);

  document.getElementById('flames-val').textContent = engine.player.flames;
  document.getElementById('motes-val').textContent = engine.player.carried;
  document.getElementById('time-val').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('score-val').textContent = engine.score;

  const litCount = engine.lanterns.filter(l => l.lit).length;
  document.getElementById('lanterns-val').textContent = litCount;
  document.getElementById('lanterns-max').textContent = engine.lanterns.length;
  document.getElementById('time-display').classList.toggle('urgent', timeLeft <= 30);
  document.getElementById('time-warning').style.display=timeLeft>0&&timeLeft<=10?'block':'none';
  const windNotice=document.getElementById('wind-warning');
  windNotice.style.display=engine.wind.warning?'block':'none';
  const shadeNotice=document.getElementById('shade-warning');
  const activeShade=engine.shades.filter(s=>s.state!=='stunned').sort((a,b)=>Math.hypot(a.pos[0]-engine.player.pos[0],a.pos[2]-engine.player.pos[2])-Math.hypot(b.pos[0]-engine.player.pos[0],b.pos[2]-engine.player.pos[2]))[0];
  shadeNotice.style.display=activeShade?'block':'none';
  if(activeShade) shadeNotice.textContent=`Bóng Mực gần đó — hướng ${Math.round((Math.atan2(activeShade.pos[0]-engine.player.pos[0],activeShade.pos[2]-engine.player.pos[2])*180/Math.PI+360)%360)}°`;
  const shadeArrow=document.getElementById('shade-arrow');
  if(activeShade){const projected=new THREE.Vector3(activeShade.pos[0],activeShade.pos[1]+1,activeShade.pos[2]).project(camera);const outside=projected.x<-.9||projected.x>.9||projected.y<-.9||projected.y>.9||projected.z>1;shadeArrow.style.display=outside?'block':'none';if(outside){const dx=projected.x,dy=-projected.y,angle=Math.atan2(dx,-dy)*180/Math.PI;shadeArrow.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;shadeArrow.style.left=`${Math.max(32,Math.min(window.innerWidth-32,window.innerWidth/2+dx*window.innerWidth*.36))}px`;shadeArrow.style.top=`${Math.max(100,Math.min(window.innerHeight-32,window.innerHeight/2+dy*window.innerHeight*.36))}px`;}}else shadeArrow.style.display='none';
  document.getElementById('dash-val').textContent = engine.player.dashCooldown > 0 ? `${engine.player.dashCooldown.toFixed(1)}s` : 'Sẵn sàng (Shift)';
  document.getElementById('motes-max').textContent = engine.player.capacity;
  for (let i = 0; i < TUNING.capacity_max; i++) document.getElementById(`mc${i + 1}`)?.classList.toggle('active', i < engine.player.carried && i < engine.player.capacity);
  document.getElementById('pause-menu').style.display = engine.state === 'paused' ? 'flex' : 'none';
  if (engine.state === 'paused') {
    document.exitPointerLock();
    stopAmbientMusic();
  }

  // Pulse cooldown
  if (engine.player.pulseCooldown > 0) {
    document.getElementById('pulse-val').textContent = `${engine.player.pulseCooldown.toFixed(1)}s`;
  } else if (engine.player.carried < TUNING.pulse_cost) {
    document.getElementById('pulse-val').textContent = `Cần ${TUNING.pulse_cost} đom đóm`;
  } else {
    document.getElementById('pulse-val').textContent = 'Sẵn sàng (F)';
  }

  // Lantern progress pips
  for (let i = 0; i < engine.lanterns.length; i++) {
    const pip = document.getElementById(`lp${i + 1}`);
    if (pip) {
      if (engine.lanterns[i].lit) {
        pip.classList.add('lit');
      } else {
        pip.classList.remove('lit');
      }
    }
  }

  // Interaction hint
  const hint = document.getElementById('interact-hint');
  let showHint = false;
  for (const lantern of engine.lanterns) {
    const fuel=lantern.fuelUnits/60;
    if (!lantern.lit || fuel < TUNING.fuel_max) {
      const dx = engine.player.pos[0] - lantern.pos[0];
      const dz = engine.player.pos[2] - lantern.pos[2];
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= TUNING.interact_radius + 1) {
        showHint = true;
        const needed = lantern.lit ? Math.ceil((TUNING.fuel_max-fuel)/TUNING.fuel_per_mote) : (lantern.ever_lit ? TUNING.relight_cost : TUNING.lantern_cost)-lantern.deposited;
        hint.textContent = lantern.lit ? `E — Châm dầu (${engine.player.carried}/${engine.player.capacity}) · Cần ${needed} đom đóm` : `E — ${lantern.ever_lit?'Thắp lại':'Thắp đèn'} (${engine.player.carried}/${engine.player.capacity}) · Còn ${needed} đom đóm`;
        break;
      }
    }
  }
  hint.style.display = showHint ? 'block' : 'none';

  const target = engine.lanterns.filter(l => !l.lit).sort((a,b) => Math.hypot(engine.player.pos[0]-a.pos[0], engine.player.pos[2]-a.pos[2]) - Math.hypot(engine.player.pos[0]-b.pos[0], engine.player.pos[2]-b.pos[2]))[0];
  const arrow = document.getElementById('lantern-arrow');
  if (target) {
    const projected = new THREE.Vector3(target.pos[0], target.pos[1] + 3, target.pos[2]).project(camera);
    const outside = projected.x < -0.88 || projected.x > 0.88 || projected.y < -0.88 || projected.y > 0.88 || projected.z > 1;
    arrow.style.display = outside ? 'block' : 'none';
    if (outside) {
      const dx = projected.x, dy = -projected.y;
      const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      arrow.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
      arrow.style.left = `${Math.max(32, Math.min(window.innerWidth - 32, window.innerWidth / 2 + dx * window.innerWidth * .36))}px`;
      arrow.style.top = `${Math.max(60, Math.min(window.innerHeight - 60, window.innerHeight / 2 + dy * window.innerHeight * .36))}px`;
    }
  } else arrow.style.display = 'none';

  if (timeLeft > 0 && timeLeft <= 10) {
    const countdown = Math.ceil(timeLeft);
    if (countdown !== lastCountdown) { lastCountdown = countdown; playTone(880 - countdown * 24, 0.12, 0.12); }
  } else lastCountdown = 0;

  // Game over
  if (engine.state === 'won' || engine.state === 'lost') {
    showGameOver();
  }
}

function showGameOver() {
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';

  const resultText = document.getElementById('result-text');
  const resultDetail = document.getElementById('result-detail');
  const finalScore = document.getElementById('final-score');

  if (engine.state === 'won') {
    if(!runResultProcessed){nightsWon=Math.min(3,nightsWon+1);runResultProcessed=true;}
    resultText.innerHTML = engine.night === 3 ? '<span class="won">BÌNH MINH!</span>' : '<span class="won">CHIẾN THẮNG!</span>';
    resultDetail.textContent = engine.night === 3 ? 'Ba đêm đã qua. Đảo Đèn Lồng trụ vững đến bình minh.' : 'Bạn đã giữ đủ đèn sáng đến bình minh. Đêm tiếp theo đang chờ.';
    document.getElementById('continue-btn').style.display = engine.night < 3 ? 'inline-block' : 'none';
    playTone(660, 0.3, 0.15);
  } else {
    runResultProcessed=true;
    resultText.innerHTML = '<span class="lost">THẤT BẠI</span>';
    const reason = engine.events.find(e => e.name === 'game_over')?.data?.reason;
    if (reason === 'no_flames') {
      resultDetail.textContent = 'Bóng tối đã nuốt chửng bạn...';
    } else {
      resultDetail.textContent = 'Bình minh đến khi số đèn còn sáng thấp hơn yêu cầu.';
    }
    document.getElementById('continue-btn').style.display = 'none';
    playTone(170, 0.4, 0.15);
  }
  stopAmbientMusic();
  submitLeaderboard();

  finalScore.textContent = `Điểm đêm này: ${engine.score} · Tổng điểm: ${totalScore + (engine.state === 'won' ? engine.score : 0)}`;
  document.exitPointerLock();
  gameStarted = false;
}

// ========== GAME LOOP ==========
function animate() {
  requestAnimationFrame(animate);

  if (!gameStarted) {
    renderer.render(scene, camera);
    return;
  }

  const delta = clock.getDelta();
  if (benchmarkMode) {
    if(benchmarkLoadMs===null){const startedAt=Number(new URLSearchParams(location.search).get('startedAt'));benchmarkLoadMs=Number.isFinite(startedAt)?Math.max(0,Date.now()-startedAt):Math.round(performance.now());}
    const t=(performance.now()-benchmarkOrbitStart)/1000;camera.position.set(30*Math.cos(t*2*Math.PI/15),15,-30*Math.sin(t*2*Math.PI/15));camera.lookAt(0,0,0);
    accumulator+=Math.min(delta,.1);while(accumulator>=DT){engine._updateShades();accumulator-=DT;}
    updateVisuals();renderer.render(scene,camera);recordBenchmarkFrame(performance.now());return;
  }
  accumulator += Math.min(delta, 0.1); // cap to prevent spiral

  // Get input
  getInputFromKeys();

  // Fixed timestep
  while (accumulator >= DT) {
    engine.step();
    playEventSounds(engine.events);
    accumulator -= DT;

    if (engine.state !== 'playing') {
      accumulator = 0;
      break;
    }
  }

  updateVisuals();
  renderer.render(scene, camera);
}

let soundContext;
function stopAmbientMusic() {}
function playTone(frequency, duration = 0.1, gain = 0.08) {
  try {
    soundContext ||= new AudioContext();
    const osc = soundContext.createOscillator();
    const amp = soundContext.createGain();
    osc.type = 'sine'; osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain * volume, soundContext.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, soundContext.currentTime + duration);
    osc.connect(amp); amp.connect(soundContext.destination);
    osc.start(); osc.stop(soundContext.currentTime + duration);
  } catch {}
}

function playEventSounds(events) {
  for (const event of events) {
    if (event.name === 'mote_picked' || event.name === 'charm_picked') playTone(880, 0.09, 0.07);
    else if (event.name === 'lantern_lit' || event.name === 'refuel') { playTone(523, 0.18, 0.12); setTimeout(() => playTone(784, 0.24, 0.1), 90); }
    else if (event.name === 'lantern_out') playTone(180, .45, .14);
    else if (event.name === 'pulse') playTone(330, 0.24, 0.12);
    else if (event.name === 'dash') playTone(440, 0.08, 0.1);
    else if (event.name === 'player_hit' || event.name === 'drifter_steal') playTone(150, 0.18, 0.12);
    else if (event.name === 'shade_spawned' || event.name === 'drifter_spawned') playTone(230, 0.28, 0.08);
    else if (event.name === 'jump') playTone(560, 0.1, 0.08);
    else if (event.name === 'wind_started' || event.name === 'wind_warning') playTone(360, 0.35, 0.06);
  }
}

// ========== START ==========
init();
if (new URLSearchParams(location.search).get('bench')==='1') startGame();
// Pre-render the scene even before game starts
function preRender() {
  if (!gameStarted) {
    camera.position.set(0, 20, 40);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
}
preRender();
