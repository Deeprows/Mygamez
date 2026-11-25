import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { World, laneX, PLAYER_BOUND } from './world.js';
import { spinWheels, CAR_W, CAR_L } from './car.js';
import { CARS, COLORS, loadCar, quickCar } from './cars.js';
import { Traffic } from './traffic.js';
import { Controls } from './controls.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MOBILE = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

// ------------------------------------------------------------------ renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.75 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfdcf2, 150, 700);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 1500);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a7a3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 40, bottom: -40, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ state
const saved = (() => { try { return JSON.parse(safeGet('hr3d-car') || 'null'); } catch { return null; } })();
const S = {
  mode: 'menu', // menu | playing | over
  x: laneX(1), z: 0, speed: 0, vx: 0,
  psi: 0,       // heading angle (rad, + = toward +X / right)
  slip: 0,      // extra body yaw while drifting (visual + feel)
  drifting: false,
  health: 100, score: 0, dist: 0, shake: 0, pitch: 0, orbit: 0,
  best: Number(safeGet('hr3d-best') || 0),
  carIdx: saved && CARS[saved.i] ? saved.i : 0,
  color: saved && Number.isFinite(saved.c) ? saved.c : CARS[saved && CARS[saved.i] ? saved.i : 0].color,
};

const world = new World(scene);
const traffic = new Traffic(scene, MOBILE ? 9 : 12);
let player = quickCar(CARS[S.carIdx], S.color);
scene.add(player);
const controls = new Controls();
const hud = new Hud($('speedo'));
const sfx = new Sfx();

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
  const e = CARS[S.carIdx];
  $('carName').textContent = e.name.toUpperCase();
  bar('bSpeed', e.stats.top / 70); bar('bAcc', e.stats.acc / 1.3); bar('bHnd', e.stats.hnd / 1.3);
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
  Object.assign(S, { mode, x: laneX(1), z: 0, speed: 0, vx: 0, psi: 0, slip: 0, drifting: false, health: 100, score: 0, dist: 0, shake: 0, pitch: 0 });
  world.reset();
}

function enterMenu() {
  resetRun('menu');
  traffic.group.visible = false;
  overlay.classList.remove('over', 'hidden');
  $('title').textContent = 'HIGHWAY RACER 3D';
  $('msg').textContent = 'Hold brake while turning hard to drift.';
  $('garage').classList.remove('hidden');
  $('garageBtn').classList.add('hidden');
  $('start').textContent = 'START';
}

function startGame() {
  resetRun('playing');
  traffic.reset(S.z);
  traffic.group.visible = true;
  overlay.classList.add('hidden');
  sfx.start();
  toast('GO!');
}

function gameOver() {
  S.mode = 'over';
  S.drifting = false;
  sfx.stop();
  const score = Math.floor(S.score);
  if (score > S.best) { S.best = score; safeSet('hr3d-best', String(score)); }
  setTimeout(() => {
    $('title').textContent = 'CRASHED';
    $('msg').textContent = `Score ${score}\nDistance ${(S.dist / 1000).toFixed(2)} km\nBest ${S.best}`;
    $('garage').classList.add('hidden');
    $('garageBtn').classList.remove('hidden');
    $('start').textContent = 'RACE AGAIN';
    overlay.classList.add('over');
    overlay.classList.remove('hidden');
  }, 900);
}

$('start').addEventListener('click', startGame);
$('garageBtn').addEventListener('click', enterMenu);
addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !overlay.classList.contains('hidden')) startGame();
});
enterMenu();

// ------------------------------------------------------------------ gameplay
function interactions() {
  for (const c of traffic.cars) {
    const dz = c.mesh.position.z - S.z;
    const dx = c.mesh.position.x - S.x;
    if (c.hit) continue;

    if (Math.abs(dz) < CAR_L * 0.95 && Math.abs(dx) < CAR_W * 0.92) {
      const rel = Math.max(0, S.speed - c.speed);
      const side = dx >= 0 ? 1 : -1;
      c.hit = true;
      c.vx = side * (5 + rel * 0.2);
      c.spinV = -side * (2 + Math.random() * 2);
      S.health -= Math.min(40, 10 + rel * 0.9);
      S.speed = Math.max(c.speed * 0.8, S.speed * 0.5);
      S.psi = -side * 0.25; S.slip = -side * 0.5;
      S.shake = 0.6;
      flash(); sfx.crash();
      if (S.health <= 0) { S.health = 0; gameOver(); return; }
      continue;
    }

    if (Math.abs(dz) < 8) c.minDx = Math.min(c.minDx, Math.abs(dx));
    if (!c.passed && dz > CAR_L) {
      c.passed = true;
      if (c.minDx < 2.9) { S.score += 100; toast('NEAR MISS +100'); }
    }
  }
}

let lastKmh = -1, lastScore = -1, lastDist = '';
function driveFrame(dt) {
  const live = S.mode === 'playing';
  const st = CARS[S.carIdx].stats;
  const gas = live && controls.gas;
  const steer = live ? controls.steer : 0;
  const drifting = live && controls.brake && Math.abs(steer) > 0.45 && S.speed > 22;
  const brake = !live || controls.brake;

  // --- longitudinal
  let a = 0;
  if (gas) a += st.acc * (9 * (1 - S.speed / (st.top + 8)) + 3.5);
  if (brake) a -= drifting ? 9 : (live ? 32 : 26);
  a -= 2.2 + S.speed * S.speed * 0.0006;
  S.speed = clamp(S.speed + a * dt, 0, st.top + 4);

  // --- heading-based steering: target heading shrinks with speed; drift widens it and adds body slip
  const psiMax = (0.42 * st.hnd) / (1 + S.speed / 24) * (drifting ? 1.6 : 1);
  const psiT = steer * psiMax * clamp(S.speed / 6, 0, 1);
  S.psi += (psiT - S.psi) * Math.min(1, (drifting ? 3.5 : 6) * dt);
  S.slip += ((drifting ? steer * 0.5 : 0) - S.slip) * Math.min(1, 5 * dt);
  if (drifting && !S.drifting) toast('DRIFT!');
  if (drifting) S.score += S.speed * dt * 0.3;
  S.drifting = drifting;

  S.vx = S.speed * Math.sin(S.psi);
  S.x += S.vx * dt;
  if (Math.abs(S.x) > PLAYER_BOUND) {
    S.x = Math.sign(S.x) * PLAYER_BOUND;
    if (Math.sign(S.psi) === Math.sign(S.x)) { S.psi = 0; S.slip = 0; }
    if (S.speed > 8) { S.speed *= 1 - 0.9 * dt; S.shake = Math.max(S.shake, 0.12); }
  }
  const fwd = S.speed * Math.cos(S.psi) * dt;
  S.z -= fwd;
  S.dist += fwd;
  if (live) S.score += fwd * 0.1;

  world.update(S.z, camera);
  traffic.update(dt, S.z);
  if (live) interactions();

  // --- visuals
  S.pitch += (clamp(a * 0.0016, -0.05, 0.05) - S.pitch) * Math.min(1, 6 * dt);
  player.position.set(S.x, 0, S.z);
  player.rotation.set(S.pitch, -(S.psi + S.slip), 0);
  for (const w of player.userData.steerers) w.rotation.y = -steer * 0.45;
  spinWheels(player, S.speed * dt);
  player.userData.tail.color.set(brake && live && S.speed > 1 ? 0xff5050 : 0xaa1010);

  const k = 1 - Math.exp(-10 * dt);
  camera.position.x += (S.x * 0.6 - camera.position.x) * k;
  camera.position.y += (3.1 + S.speed * 0.008 - camera.position.y) * k;
  camera.position.z = S.z + 7.2 + S.speed * 0.02;
  S.shake *= Math.exp(-6 * dt);
  camera.position.x += (Math.random() - 0.5) * S.shake;
  camera.position.y += (Math.random() - 0.5) * S.shake;
  camera.lookAt(S.x * 0.4 + Math.sin(S.psi + S.slip * 0.5) * 6, 1.1, S.z - 14);
  setFov(58 + S.speed * 0.22);

  sfx.update(S.speed / st.top, controls.gas && live ? 1 : 0, live);
  updateHud();
}

function menuFrame(dt) {
  S.orbit += dt * 0.35;
  traffic.group.visible = false;
  world.update(S.z, camera);
  player.position.set(S.x, 0, S.z);
  player.rotation.set(0, 0, 0);
  for (const w of player.userData.steerers) w.rotation.y = Math.sin(S.orbit * 2) * 0.25;
  camera.position.set(S.x + Math.sin(S.orbit) * 7.5, 2.6, S.z + Math.cos(S.orbit) * 7.5);
  camera.lookAt(S.x, 0.8, S.z);
  setFov(50);
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
  curFov = 0;
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  controls.update(dt);
  if (S.mode === 'menu') menuFrame(dt); else driveFrame(dt);
  sun.position.set(S.x - 30, 60, S.z + 50);
  sun.target.position.set(S.x, 0, S.z - 10);
  renderer.render(scene, camera);
});
