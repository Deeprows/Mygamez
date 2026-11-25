import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { World, laneX, PLAYER_BOUND, BIOME, BIOMES } from './world.js';
import { spinWheels, setHeadGlow, CAR_W, CAR_L } from './car.js';
import { CARS, COLORS, loadCar, quickCar } from './cars.js';
import { Traffic } from './traffic.js';
import { Pickups } from './pickups.js';
import { Controls } from './controls.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Post } from './post.js';
import { Particles } from './particles.js';
import { TODS, TOD, TOD_ICONS, applyTOD } from './tod.js';
import { MISSIONS, goalValue, goalTarget, goalLabel, fmtTime } from './modes.js';
import { profile, save, addCoins, effStats } from './save.js';
import { initMenu } from './menu.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a = -1, b = 1) => a + Math.random() * (b - a);
const MOBILE = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

// ------------------------------------------------------------------ renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfdcf2, 150, 700);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 1500);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a7a3a, 0.9);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 40, bottom: -40, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
const head = new THREE.SpotLight(0xfff0d0, 0, 120, 0.55, 0.6, 2);
scene.add(hemi, sun, sun.target, head, head.target);

// ------------------------------------------------------------------ state
const saved = (() => { try { return JSON.parse(safeGet('hr3d-car') || 'null'); } catch { return null; } })();
const P = profile();
const S = {
  mode: 'menu', // menu | playing | over
  x: laneX(1), z: 0, speed: 0, vx: 0,
  psi: 0, slip: 0, drifting: false,
  nitro: 100, nitroLock: false, nK: 0,
  health: 100, score: 0, dist: 0, shake: 0, pitch: 0, orbit: 0,
  // Stage 4: selected mode + per-run state
  gm: ['endless', 'time', 'missions'].includes(P.sel.gm) ? P.sel.gm : 'endless', // endless | time | missions
  missionIdx: clamp(Number(P.sel.mi) || 0, 0, MISSIONS.length - 1),
  twoWay: !!P.sel.tw, // menu toggle (endless / time attack)
  mission: null, tw: false, mul: 1, st: null, curBiome: 'highway', nextBiome: 2500, biomeIdx: 0,
  runCoins: 0, overtakes: 0, combo: 0, comboT: 0, bestCombo: 0, oncMisses: 0, holdT: 0, elapsed: 0, timeLeft: 0, cpZ: -1000, cpCount: 0,
  carIdx: saved && CARS[saved.i] ? saved.i : 0,
  color: saved && Number.isFinite(saved.c) ? saved.c : CARS[saved && CARS[saved.i] ? saved.i : 0].color,
  tod: Math.max(0, TODS.indexOf(safeGet('hr3d-tod') || 'day')),
  quality: Number(safeGet('hr3d-q') ?? (MOBILE ? 1 : 2)),
};
let cur = TOD.day; // current time-of-day preset
S.st = effStats(CARS[S.carIdx]); // catalog stats + shop upgrades

const world = new World(scene);
const traffic = new Traffic(scene, MOBILE ? 9 : 12, MOBILE ? 2 : 3, MOBILE ? 1 : 2);
const pickups = new Pickups(scene);
let player = quickCar(CARS[S.carIdx], S.color);
scene.add(player);
const controls = new Controls();
const hud = new Hud($('speedo'));
const sfx = new Sfx();
const post = new Post(renderer, scene, camera);
const smoke = new Particles(scene, { max: 260, blending: THREE.NormalBlending, drag: 1.5 });
const sparks = new Particles(scene, { max: 320, blending: THREE.AdditiveBlending, gravity: -12, drag: 0.4 });
const _v = new THREE.Vector3();

sfx.muted = safeGet('hr3d-mute') === '1';
sfx.music = safeGet('hr3d-music') === '1';

// ------------------------------------------------------------------ settings buttons
function applyQuality() {
  const q = S.quality;
  const pr = Math.min(window.devicePixelRatio, q === 0 ? 1.25 : (MOBILE ? 1.5 : 2));
  renderer.setPixelRatio(pr);
  post.setQuality(q);
  const sz = q === 2 ? 2048 : 1024;
  sun.shadow.mapSize.set(sz, sz);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  $('qualBtn').textContent = ['LOW', 'MED', 'HIGH'][q];
  safeSet('hr3d-q', String(q));
  resize();
}
function setTod() {
  const name = TODS[S.tod];
  cur = applyTOD(name, {
    scene, world, hemi, sun, head, post, renderer,
    onGlow: (k) => { setHeadGlow(k); traffic.setGlow(k); },
  });
  $('todBtn').textContent = TOD_ICONS[name];
  safeSet('hr3d-tod', name);
}
function refreshSoundButtons() {
  $('muteBtn').innerHTML = sfx.muted ? '&#128263;' : '&#128266;';
  $('muteBtn').classList.toggle('off', sfx.muted);
  $('musicBtn').classList.toggle('off', !sfx.music);
}
$('qualBtn').addEventListener('click', () => { S.quality = (S.quality + 1) % 3; applyQuality(); });
$('todBtn').addEventListener('click', () => { S.tod = (S.tod + 1) % TODS.length; setTod(); });
$('muteBtn').addEventListener('click', () => { sfx.setMuted(!sfx.muted); safeSet('hr3d-mute', sfx.muted ? '1' : '0'); refreshSoundButtons(); });
$('musicBtn').addEventListener('click', () => {
  sfx.start(); sfx.setMusic(!sfx.music); safeSet('hr3d-music', sfx.music ? '1' : '0'); refreshSoundButtons();
});
refreshSoundButtons();

// ------------------------------------------------------------------ garage
let buildToken = 0;
async function applyCar() {
  const my = ++buildToken;
  const model = await loadCar(CARS[S.carIdx], S.color);
  if (my !== buildToken) return;
  model.position.copy(player.position);
  scene.remove(player);
  player = model;
  scene.add(player);
}
const saveCar = () => safeSet('hr3d-car', JSON.stringify({ i: S.carIdx, c: S.color }));
const bar = (id, v) => { $(id).style.width = Math.round(clamp(v, 0, 1) * 100) + '%'; };

function refreshGarage() {
  const e = CARS[S.carIdx], st = effStats(e);
  S.st = st;
  $('carName').textContent = e.name.toUpperCase();
  $('carChip').textContent = e.name.toUpperCase();
  $('carCount').textContent = `${S.carIdx + 1} / ${CARS.length}`;
  bar('bSpeed', st.top / 80); bar('bAcc', st.acc / 1.3); bar('bHnd', st.hnd / 1.5);
  $('swatches').classList.toggle('hidden', e.recolor === false);
  [...$('swatches').children].forEach((b) => b.classList.toggle('on', Number(b.dataset.c) === S.color));
}
for (const c of COLORS) {
  const b = document.createElement('button');
  b.className = 'sw'; b.dataset.c = c;
  b.style.background = '#' + c.toString(16).padStart(6, '0');
  b.addEventListener('click', () => { S.color = c; saveCar(); applyCar(); refreshGarage(); });
  $('swatches').appendChild(b);
}
const cycle = (d) => {
  S.carIdx = (S.carIdx + d + CARS.length) % CARS.length;
  S.color = CARS[S.carIdx].color;
  saveCar(); applyCar(); refreshGarage();
};
$('prevCar').addEventListener('click', () => cycle(-1));
$('nextCar').addEventListener('click', () => cycle(1));
if (CARS.length < 2) { $('prevCar').classList.add('hidden'); $('nextCar').classList.add('hidden'); }
refreshGarage();
applyCar();
const menu = initMenu(S, { cars: CARS, onUpgrade: () => refreshGarage() });

// ------------------------------------------------------------------ UI helpers / flow
const overlay = $('overlay');
let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 900);
}
function flash() {
  const el = $('flash');
  el.classList.add('hit');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('hit')));
}

function resetRun(mode) {
  Object.assign(S, {
    mode, x: laneX(1), z: 0, speed: 0, vx: 0, psi: 0, slip: 0, drifting: false, nitro: 100, nitroLock: false, nK: 0, health: 100, score: 0, dist: 0, shake: 0, pitch: 0,
    mission: null, tw: false, mul: 1, runCoins: 0, overtakes: 0, combo: 0, comboT: 0, bestCombo: 0, oncMisses: 0, holdT: 0, elapsed: 0,
    timeLeft: 0, cpZ: -1000, cpCount: 0, nextBiome: 2500, biomeIdx: 0,
  });
}
function enterMenu() {
  resetRun('menu');
  world.reset('highway'); world.setTwoWay(false); world.setSnow(0);
  pickups.reset(); pickups.group.visible = false;
  traffic.group.visible = false;
  overlay.classList.remove('over', 'hidden');
  menu.showTab('race');
  $('menuBox').classList.remove('hidden');
  $('garageBtn').classList.add('hidden');
  $('coinBal').classList.remove('hidden');
  $('start').textContent = 'PLAY';
  menu.refresh();
}
function startGame() {
  const mission = S.gm === 'missions' ? MISSIONS[S.missionIdx] : null;
  resetRun('playing');
  S.st = effStats(CARS[S.carIdx]);
  S.mission = mission;
  S.tw = mission ? mission.tw : (S.gm !== 'missions' && S.twoWay);
  S.x = laneX(S.tw ? 2 : 1); // two-way road: start in a same-direction lane
  S.curBiome = mission ? mission.biome : 'highway';
  world.reset(S.curBiome); world.setTwoWay(S.tw); world.setSnow(S.curBiome === 'snow' ? 1 : 0);
  traffic.setTwoWay(S.tw); traffic.setDifficulty(mission ? mission.diff : 0); traffic.reset(S.z);
  traffic.group.visible = true;
  pickups.reset(); pickups.group.visible = true;
  if (S.gm === 'time') { S.timeLeft = 60; world.setCheckpoint(S.cpZ); } else if (mission) S.timeLeft = mission.time;
  overlay.classList.add('hidden');
  $('coinBal').classList.add('hidden');
  sfx.start();
  sfx.setMuted(sfx.muted); if (sfx.music) sfx.setMusic(true);
  toast(mission ? mission.title : 'GO!');
}

/** End of a run. reason: crash | time (time attack) | complete | fail (mission timed out). */
function finish(reason) {
  if (S.mode !== 'playing') return;
  S.mode = 'over';
  S.drifting = false;
  sfx.stop();
  const score = Math.floor(S.score), m = S.mission;
  let title = 'CRASHED', btn = 'RACE AGAIN';
  let lines = [`Score ${score}`, `Distance ${(S.dist / 1000).toFixed(2)} km`, `Coins +${S.runCoins}`];
  if (reason === 'time') title = 'TIME UP';
  if (m) {
    btn = 'RETRY';
    lines = [m.title, goalLabel(m, S), `Coins +${S.runCoins}`];
    if (reason === 'fail') title = 'TIME UP';
    if (reason === 'complete') {
      const reward = P.done[m.id] ? Math.floor(m.reward * 0.25) : m.reward; // replays pay 25%
      P.done[m.id] = true; addCoins(reward);
      title = 'MISSION COMPLETE';
      lines = [m.title, `Reward +${reward} coins`, `Coins collected +${S.runCoins}`];
      if (S.missionIdx < MISSIONS.length - 1) { S.missionIdx++; btn = 'NEXT MISSION'; } else btn = 'PLAY AGAIN';
    }
  } else {
    const key = S.gm === 'time' ? 'time' : 'endless';
    if (S.gm === 'time') lines.splice(2, 0, `Checkpoints ${S.cpCount}`);
    if (score > P.best[key]) { P.best[key] = score; lines.push('NEW BEST!'); } else lines.push(`Best ${P.best[key]}`);
  }
  menu.persist(); // also saves best / done
  setTimeout(() => {
    $('title').textContent = title;
    $('msg').textContent = lines.join('\n');
    $('menuBox').classList.add('hidden');
    $('garageBtn').classList.remove('hidden');
    $('coinBal').classList.remove('hidden');
    $('start').textContent = btn;
    menu.refresh();
    overlay.classList.add('over');
    overlay.classList.remove('hidden');
  }, reason === 'crash' ? 900 : 400);
}
$('start').addEventListener('click', startGame);
$('garageBtn').addEventListener('click', enterMenu);
addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !overlay.classList.contains('hidden')) startGame();
  if (e.code === 'KeyH' && S.mode === 'playing') sfx.horn();
});

// ------------------------------------------------------------------ particles
function wheelWorld(sx) { player.updateMatrixWorld(); return player.localToWorld(_v.set(sx * 0.98, 0.15, 1.4)); }

function emitSmoke(amount) {
  for (const sx of [-1, 1]) {
    const p = wheelWorld(sx);
    for (let i = 0; i < amount; i++) smoke.emit(p.x + rnd(-0.2, 0.2), 0.15, p.z, rnd(-1.2, 1.2), rnd(0.6, 1.6), rnd(-1, 1), rnd(0.7, 1.1), 0.9, 0.86, 0.86, 0.88, 0.5, 3.2);
  }
}
function emitFlame() {
  for (const sx of [-1, 1]) {
    player.updateMatrixWorld();
    const p = player.localToWorld(_v.set(sx * 0.45, 0.5, 2.3));
    sparks.emit(p.x, p.y, p.z, rnd(-0.4, 0.4), rnd(-0.2, 0.3), 7 + rnd(0, 3), 0.22, 0.42, 0.6, 1.8, 4.5, 0.9, -0.1);
    sparks.emit(p.x, p.y, p.z, rnd(-0.3, 0.3), rnd(-0.1, 0.2), 5 + rnd(0, 2), 0.14, 0.25, 4.5, 2.0, 0.4, 0.9, -0.1);
  }
}
function emitScrape(side) {
  for (let i = 0; i < 3; i++) {
    sparks.emit(S.x + side * 0.95, rnd(0.15, 0.6), S.z + rnd(-1.8, 1.8), -side * rnd(0.5, 3), rnd(1.5, 5), rnd(-2, 4) - S.speed * 0.25, rnd(0.25, 0.55), 0.13, 4.5, 2.2, 0.5, 1);
  }
}
function crashBurst(x, z) {
  for (let i = 0; i < 34; i++) sparks.emit(x, rnd(0.3, 1.1), z, rnd(-7, 7), rnd(1, 8), rnd(-7, 7), rnd(0.4, 0.9), 0.15, 4.5, 2.4, 0.6, 1);
  for (let i = 0; i < 12; i++) smoke.emit(x + rnd(-0.6, 0.6), 0.5, z + rnd(-1, 1), rnd(-2, 2), rnd(1, 3), rnd(-2, 2), rnd(0.9, 1.5), 1.4, 0.2, 0.2, 0.2, 0.65, 4);
}

// ------------------------------------------------------------------ gameplay
function nearMiss(c) {
  S.combo = (S.comboT > 0 ? S.combo : 0) + 1;
  S.comboT = 4; // chain the next near miss within 4 s to keep the combo
  S.bestCombo = Math.max(S.bestCombo, S.combo);
  const pts = Math.round(100 * Math.min(3, 1 + (S.combo - 1) * 0.25) * (c.dir < 0 ? 2 : 1));
  S.score += pts;
  S.nitro = Math.min(100, S.nitro + 12);
  if (c.dir < 0) S.oncMisses++;
  toast(`${c.dir < 0 ? 'ONCOMING ' : ''}NEAR MISS +${pts}${S.combo > 1 ? '  x' + S.combo : ''}`);
  sfx.blip();
}

function interactions() {
  for (const c of traffic.cars) {
    if (!c.active || c.hit) continue;
    const dz = c.mesh.position.z - S.z;
    const dx = c.mesh.position.x - S.x;
    const halfL = (CAR_L + c.len) / 2, halfW = (CAR_W + c.wid) / 2;

    if (Math.abs(dz) < halfL * 0.95 && Math.abs(dx) < halfW * 0.92) {
      const rel = Math.max(0, S.speed + (c.dir < 0 ? c.speed : -c.speed)); // closing speed
      const side = dx >= 0 ? 1 : -1;
      c.hit = true;
      c.vx = side * (5 + rel * 0.2);
      c.spinV = -side * (2 + Math.random() * 2);
      S.health -= Math.min(45, (10 + rel * 0.9) * (c.type === 'car' ? 1 : 1.3));
      S.speed = c.dir < 0 ? S.speed * 0.4 : Math.max(c.speed * 0.8, S.speed * 0.5);
      S.psi = -side * 0.25; S.slip = -side * 0.5;
      S.shake = 0.6;
      S.combo = 0; S.comboT = 0;
      crashBurst(S.x + side * 0.9, S.z + dz * 0.5);
      flash(); sfx.crash();
      if (S.health <= 0) { S.health = 0; finish('crash'); return; }
      continue;
    }

    if (Math.abs(dz) < 8) c.minDx = Math.min(c.minDx, Math.abs(dx));
    if (!c.passed && dz > halfL) {
      c.passed = true;
      if (c.dir > 0) S.overtakes++;
      if (c.minDx < halfW + 1.0) nearMiss(c);
    }
  }
}

function onPickup(kind) {
  if (kind === 'coin') {
    S.runCoins++; addCoins(1); S.score += 10; sfx.coin();
    for (let i = 0; i < 4; i++) sparks.emit(S.x, 1.0, S.z - 1, rnd(-2, 2), rnd(1, 3), rnd(-2, 2), rnd(0.25, 0.4), 0.12, 4.5, 3.2, 0.6, 1);
  } else {
    S.health = Math.min(100, S.health + 25);
    toast('REPAIR +25'); sfx.blip();
  }
}

/** Mode rules, once per frame while playing: combo decay, biome rotation, checkpoints, mission goals, time limits. */
function rules(dt) {
  S.elapsed += dt;
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
  S.mul = S.tw && S.x < 0 ? 2 : 1; // x2 score while driving on the oncoming side

  if (!S.mission && S.dist >= S.nextBiome) { // endless / time attack: new scenery every 2.5 km
    S.nextBiome += 2500;
    S.biomeIdx = (S.biomeIdx + 1) % BIOMES.length;
    world.setBiome(BIOMES[S.biomeIdx]);
  }
  const b = world.biomeUnder(S.z);
  if (b !== S.curBiome) { S.curBiome = b; toast(BIOME[b].label); }
  world.setSnow(b === 'snow' ? 1 : 0);

  if (S.gm === 'time') {
    S.timeLeft -= dt;
    if (S.z <= S.cpZ) {
      const bonus = Math.max(18, 30 - S.cpCount * 2);
      S.timeLeft += bonus; S.cpCount++; S.score += 250;
      S.cpZ -= 1000; world.setCheckpoint(S.cpZ);
      toast(`CHECKPOINT +${bonus}s`); sfx.blip();
    }
    if (S.timeLeft <= 0) { S.timeLeft = 0; finish('time'); }
  } else if (S.mission) {
    const m = S.mission;
    if (m.type === 'speed') S.holdT = S.speed * 3.6 >= m.target ? S.holdT + dt : 0;
    S.timeLeft -= dt;
    if (goalValue(m, S) >= goalTarget(m)) finish('complete');
    else if (S.timeLeft <= 0) { S.timeLeft = 0; finish('fail'); }
  }
}

function goalText() {
  if (S.mode !== 'playing') return '';
  if (S.gm === 'time') return `TIME ${fmtTime(S.timeLeft)}   \u00b7   CHECKPOINT ${Math.max(0, Math.round(S.z - S.cpZ))} m`;
  if (S.mission) return `${S.mission.title}   \u00b7   ${goalLabel(S.mission, S)}   \u00b7   ${fmtTime(S.timeLeft)}`;
  return '';
}

let lastKmh = -1, lastScore = -1, lastDist = '', smokeT = 0, lineT = 0, lastCoins = -1, lastGoal = '', lastMul = 0;
function driveFrame(dt) {
  const live = S.mode === 'playing';
  const st = S.st;
  const gas = live && controls.gas;
  const steer = live ? controls.steer : 0;
  const drifting = live && controls.brake && Math.abs(steer) > 0.45 && S.speed > 22;
  const brake = !live || controls.brake;

  // --- nitro
  let nitroOn = live && controls.nitro && S.nitro > 0 && !S.nitroLock;
  if (nitroOn) {
    S.nitro -= 38 * (1 - 0.08 * st.nit) * dt;
    if (S.nitro <= 0) { S.nitro = 0; S.nitroLock = true; nitroOn = false; }
  } else {
    S.nitro = Math.min(100, S.nitro + 5 * (1 + 0.2 * st.nit) * dt);
    if (S.nitroLock && S.nitro >= 30) S.nitroLock = false;
  }
  if (drifting) S.nitro = Math.min(100, S.nitro + 8 * dt);
  S.nK += ((nitroOn ? 1 : 0) - S.nK) * Math.min(1, 6 * dt);

  // --- longitudinal
  let a = 0;
  if (gas) a += st.acc * (9 * (1 - S.speed / (st.top + 8)) + 3.5);
  if (nitroOn) a += 15 * (1 + 0.05 * st.nit);
  if (brake) a -= drifting ? 9 : (live ? 32 : 26);
  a -= 2.2 + S.speed * S.speed * 0.0006;
  if (!nitroOn && S.speed > st.top + 2) a -= (S.speed - st.top - 2) * 2.5;
  S.speed = clamp(S.speed + a * dt, 0, st.top + 12);

  // --- heading-based steering
  const psiMax = (0.42 * st.hnd) / (1 + S.speed / 24) * (drifting ? 1.6 : 1);
  const psiT = steer * psiMax * clamp(S.speed / 6, 0, 1);
  S.psi += (psiT - S.psi) * Math.min(1, (drifting ? 3.5 : 6) * dt);
  S.slip += ((drifting ? steer * 0.5 : 0) - S.slip) * Math.min(1, 5 * dt);
  if (drifting && !S.drifting) toast('DRIFT!');
  if (drifting) S.score += S.speed * dt * 0.3 * S.mul;
  S.drifting = drifting;

  S.vx = S.speed * Math.sin(S.psi);
  S.x += S.vx * dt;
  if (Math.abs(S.x) > PLAYER_BOUND) {
    S.x = Math.sign(S.x) * PLAYER_BOUND;
    if (Math.sign(S.psi) === Math.sign(S.x)) { S.psi = 0; S.slip = 0; }
    if (S.speed > 8) { S.speed *= 1 - 0.9 * dt; S.shake = Math.max(S.shake, 0.12); emitScrape(Math.sign(S.x)); }
  }
  const fwd = S.speed * Math.cos(S.psi) * dt;
  S.z -= fwd;
  S.dist += fwd;
  if (live) S.score += fwd * 0.1 * S.mul;

  // difficulty ramp: traffic density, speed spread, trucks/buses and lane changes grow with distance (missions have a fixed floor)
  traffic.setDifficulty(Math.max(clamp(S.dist / 9000, 0, 1), S.mission ? S.mission.diff : 0));
  world.update(S.z, camera, dt);
  traffic.update(dt, S.z, S.x);
  if (live) interactions();
  pickups.update(dt, S.z, S.x, traffic, S.mode === 'playing', onPickup);
  if (S.mode === 'playing') rules(dt);

  // --- visuals
  S.pitch += (clamp(a * 0.0016, -0.05, 0.05) - S.pitch) * Math.min(1, 6 * dt);
  player.position.set(S.x, 0, S.z);
  player.rotation.set(S.pitch, -(S.psi + S.slip), 0);
  for (const w of player.userData.steerers) w.rotation.y = -steer * 0.45;
  spinWheels(player, S.speed * dt);
  const braking = brake && live && S.speed > 1;
  player.userData.tail.color.setHex(braking ? 0xff5050 : 0xaa1010).multiplyScalar(cur.glow * (braking ? 1.6 : 1));
  head.position.set(S.x, 0.9, S.z - 2);
  head.target.position.set(S.x + Math.sin(S.psi + S.slip) * 25, 0, S.z - 40);

  // --- particles
  smokeT += dt;
  if (smokeT > 0.03) {
    smokeT = 0;
    if (drifting) emitSmoke(2);
    else if (live && controls.brake && S.speed > 35) emitSmoke(1);
    if (nitroOn) emitFlame();
  }
  if (nitroOn) S.shake = Math.max(S.shake, 0.05);

  // --- camera
  const k = 1 - Math.exp(-10 * dt);
  camera.position.x += (S.x * 0.6 - camera.position.x) * k;
  camera.position.y += (3.1 + S.speed * 0.008 - camera.position.y) * k;
  camera.position.z = S.z + 7.2 + S.speed * 0.02 + S.nK * 0.8;
  S.shake *= Math.exp(-6 * dt);
  camera.position.x += (Math.random() - 0.5) * S.shake;
  camera.position.y += (Math.random() - 0.5) * S.shake;
  camera.lookAt(S.x * 0.4 + Math.sin(S.psi + S.slip * 0.5) * 6, 1.1, S.z - 14);
  setFov(58 + S.speed * 0.22 + S.nK * 9);

  // --- audio + FX
  sfx.update(S.speed / st.top, controls.gas && live ? 1 : 0, live, drifting || (live && controls.brake && S.speed > 40) ? 1 : 0, S.nK);
  lineT += dt;
  const lines = $('lines');
  lines.style.opacity = clamp(S.nK * 0.8 + clamp((S.speed - 55) / 20, 0, 1) * 0.1, 0, 0.9).toFixed(2);
  if (lineT > 0.05) { lineT = 0; lines.style.transform = `rotate(${(Math.random() * 8).toFixed(1)}deg)`; }
  updateHud();
}

function menuFrame(dt) {
  S.orbit += dt * 0.35;
  traffic.group.visible = false;
  world.update(S.z, camera, dt);
  player.position.set(S.x, 0, S.z);
  player.rotation.set(0, 0, 0);
  for (const w of player.userData.steerers) w.rotation.y = Math.sin(S.orbit * 2) * 0.25;
  player.userData.tail.color.setHex(0xaa1010).multiplyScalar(cur.glow);
  head.position.set(S.x, 0.9, S.z - 2);
  head.target.position.set(S.x, 0, S.z - 40);
  camera.position.set(S.x + Math.sin(S.orbit) * 7.5, 2.6, S.z + Math.cos(S.orbit) * 7.5);
  camera.lookAt(S.x, 0.8, S.z);
  setFov(50);
  $('lines').style.opacity = 0;
  updateHud();
}

function updateHud() {
  const kmh = Math.round(S.speed * 3.6);
  if (kmh !== lastKmh) { hud.draw(kmh); lastKmh = kmh; }
  const sc = Math.floor(S.score);
  if (sc !== lastScore) { $('score').textContent = sc; lastScore = sc; }
  const d = (S.dist / 1000).toFixed(1) + ' km';
  if (d !== lastDist) { $('dist').textContent = d; lastDist = d; }
  $('health').firstElementChild.style.transform = `scaleX(${S.health / 100})`;
  $('nitro').firstElementChild.style.transform = `scaleX(${S.nitro / 100})`;
  $('nitro').classList.toggle('locked', S.nitroLock);
  if (S.runCoins !== lastCoins) { $('coins').textContent = '\u25ce ' + S.runCoins; lastCoins = S.runCoins; }
  const g = goalText();
  if (g !== lastGoal) { $('goal').textContent = g; lastGoal = g; }
  if (S.mul !== lastMul) { $('mult').classList.toggle('show', S.mul > 1); lastMul = S.mul; }
}

let curFov = 0;
function setFov(base) {
  const f = camera.aspect < 1 ? Math.min(100, base * (1 + (1 - camera.aspect) * 0.5)) : base;
  if (Math.abs(f - curFov) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); curFov = f; }
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.resize(innerWidth, innerHeight);
  curFov = 0;
}
addEventListener('resize', resize);

enterMenu();
setTod();
applyQuality();

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
const _sz = new THREE.Vector2();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  controls.update(dt);
  if (S.mode === 'menu') menuFrame(dt); else driveFrame(dt);

  sun.position.set(S.x + cur.sunPos[0], cur.sunPos[1], S.z + cur.sunPos[2]);
  sun.target.position.set(S.x, 0, S.z - 10);

  renderer.getDrawingBufferSize(_sz);
  const scale = _sz.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  smoke.setScale(scale); sparks.setScale(scale);
  smoke.update(dt); sparks.update(dt);

  const sp = S.mode === 'menu' ? 0 : clamp((S.speed - 35) / 45, 0, 1);
  post.render(dt, { blur: sp * sp * 0.045 + S.nK * 0.03, vig: 0.18 + S.nK * 0.15 });
});
