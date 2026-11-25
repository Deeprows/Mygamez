import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { World, laneX, PLAYER_BOUND } from './world.js';
import { buildCar, spinWheels, CAR_W, CAR_L } from './car.js';
import { Traffic } from './traffic.js';
import { Controls } from './controls.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MOBILE = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
const MAX_SPEED = 62; // m/s  (~223 km/h)

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

// ------------------------------------------------------------------ renderer
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

// ------------------------------------------------------------------ game objects
const world = new World(scene);
const traffic = new Traffic(scene, MOBILE ? 9 : 12);
const player = buildCar(0x19b5ff, { spoiler: true });
scene.add(player);

const controls = new Controls();
const hud = new Hud($('speedo'));
const sfx = new Sfx();

const S = {
  mode: 'menu', // menu | playing | over
  x: laneX(1), z: 0, speed: 0, vx: 0,
  health: 100, score: 0, dist: 0,
  shake: 0, pitch: 0, orbit: 0,
  best: Number(safeGet('hr3d-best') || 0),
};

// ------------------------------------------------------------------ UI helpers
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

function startGame() {
  Object.assign(S, { mode: 'playing', x: laneX(1), z: 0, speed: 0, vx: 0, health: 100, score: 0, dist: 0, shake: 0, pitch: 0 });
  world.reset();
  traffic.reset(S.z);
  traffic.group.visible = true;
  overlay.classList.add('hidden');
  sfx.start();
  toast('GO!');
}

function gameOver() {
  S.mode = 'over';
  sfx.stop();
  const score = Math.floor(S.score);
  if (score > S.best) { S.best = score; safeSet('hr3d-best', String(score)); }
  setTimeout(() => {
    $('title').textContent = 'CRASHED';
    $('msg').textContent = `Score ${score}\nDistance ${(S.dist / 1000).toFixed(2)} km\nBest ${S.best}`;
    $('start').textContent = 'RACE AGAIN';
    overlay.classList.remove('hidden');
  }, 900);
}

$('start').addEventListener('click', startGame);
addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !overlay.classList.contains('hidden')) startGame();
});

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
      S.vx = -side * 4;
      S.shake = 0.6;
      flash(); sfx.crash();
      if (S.health <= 0) { S.health = 0; gameOver(); return; }
      continue;
    }

    if (Math.abs(dz) < 8) c.minDx = Math.min(c.minDx, Math.abs(dx));
    if (!c.passed && dz > CAR_L) {
      c.passed = true;
      if (c.minDx < 2.9) {
        S.score += 100;
        toast('NEAR MISS +100');
      }
    }
  }
}

let lastKmh = -1, lastScore = -1, lastDist = '';
function driveFrame(dt) {
  const live = S.mode === 'playing';
  const gas = live && controls.gas;
  const brake = !live || controls.brake;

  let a = 0;
  if (gas) a += 9 * (1 - S.speed / 70) + 3.5;
  if (brake) a -= live ? 32 : 26;
  a -= 2.2 + S.speed * S.speed * 0.0006;
  S.speed = clamp(S.speed + a * dt, 0, MAX_SPEED + 4);

  const steer = live ? controls.steer : 0;
  const tvx = steer * 9 * clamp(S.speed / 12, 0, 1) * (1 - 0.3 * S.speed / MAX_SPEED);
  S.vx += (tvx - S.vx) * Math.min(1, 8 * dt);
  S.x += S.vx * dt;
  if (Math.abs(S.x) > PLAYER_BOUND) {
    S.x = Math.sign(S.x) * PLAYER_BOUND; S.vx = 0;
    if (S.speed > 8) { S.speed *= 1 - 0.9 * dt; S.shake = Math.max(S.shake, 0.12); }
  }
  S.z -= S.speed * dt;
  S.dist += S.speed * dt;
  if (live) S.score += S.speed * dt * 0.1;

  world.update(S.z, camera);
  traffic.update(dt, S.z);
  if (live) interactions();

  S.pitch += (clamp(a * 0.0016, -0.05, 0.05) - S.pitch) * Math.min(1, 6 * dt);
  player.position.set(S.x, 0, S.z);
  player.rotation.set(S.pitch, -S.vx * 0.025, 0);
  spinWheels(player, S.speed * dt);
  player.userData.tail.color.set(brake && live && S.speed > 1 ? 0xff5050 : 0xaa1010);

  // chase camera
  const targetX = S.x * 0.6, targetY = 3.1 + S.speed * 0.008;
  const k = 1 - Math.exp(-10 * dt);
  camera.position.x += (targetX - camera.position.x) * k;
  camera.position.y += (targetY - camera.position.y) * k;
  camera.position.z = S.z + 7.2 + S.speed * 0.02;
  S.shake *= Math.exp(-6 * dt);
  const sh = S.shake;
  camera.position.x += (Math.random() - 0.5) * sh;
  camera.position.y += (Math.random() - 0.5) * sh;
  camera.lookAt(S.x * 0.4, 1.1, S.z - 14);
  setFov(58 + S.speed * 0.22);

  sfx.update(S.speed / MAX_SPEED, controls.gas && live ? 1 : 0, live);
  updateHud();
}

function menuFrame(dt) {
  S.orbit += dt * 0.35;
  traffic.group.visible = false;
  world.update(S.z, camera);
  player.position.set(S.x, 0, S.z);
  player.rotation.set(0, 0, 0);
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

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  controls.update(dt);
  if (S.mode === 'menu') menuFrame(dt); else driveFrame(dt);
  sun.position.set(S.x - 30, 60, S.z + 50);
  sun.target.position.set(S.x, 0, S.z - 10);
  renderer.render(scene, camera);
});