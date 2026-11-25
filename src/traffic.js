import * as THREE from 'three';
import { buildCar, buildTruck, buildBus, spinWheels, STYLE_KEYS, VEH, IND_OFF, IND_ON } from './car.js';
import { LANES, laneX } from './world.js';

const COLORS = [0xf2c500, 0xd01818, 0x2e6bff, 0x8f2bd1, 0xf4f4f4, 0x1c1c1c, 0xff7a00, 0x11a36a, 0xb0b5bb];
const TRUCK_COLORS = [0xd01818, 0x2e6bff, 0xf2c500, 0x11a36a, 0xf4f4f4];
const CARGO_COLORS = [0xe9e9e9, 0xc9ced4, 0x2b6fbf, 0xd8a23a];
const BUS_COLORS = [0xf2c500, 0xff7a00, 0x2e6bff, 0xf4f4f4];
const ONC = [0, 1];   // oncoming lanes on a two-way road
const SAME2 = [2, 3]; // same-direction lanes on a two-way road
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * AI traffic: cars, trucks, buses.
 *  - car-following (never drive through the vehicle in front)
 *  - lane changes: indicator blinks ~1.1 s, then a smooth 1.4 s move. The target lane is reserved while signalling.
 *  - two-way mode: lanes 0-1 carry oncoming cars (dir = -1, rotated 180 deg)
 *  - difficulty 0..1: more vehicles, wider speed spread, more trucks/buses, more lane changes
 * Each entry: { type, mesh, len, wid, active, dir (+1 same way / -1 oncoming), lane, speed, ... }
 */
export class Traffic {
  constructor(scene, nCars = 12, nTrucks = 3, nBuses = 2) {
    this.group = new THREE.Group();
    this.cars = [];
    this.nCars = nCars;
    this.diff = 0; this.twoWay = false; this.glow = 1; this.t = 0; this.quality = 2;
    for (let i = 0; i < nCars; i++) {
      this._add('car', buildCar(COLORS[i % COLORS.length], { style: STYLE_KEYS[i % STYLE_KEYS.length], spoiler: Math.random() < 0.3, indicators: true }), i);
    }
    for (let i = 0; i < nTrucks; i++) this._add('truck', buildTruck(pick(TRUCK_COLORS), pick(CARGO_COLORS)), i);
    for (let i = 0; i < nBuses; i++) this._add('bus', buildBus(pick(BUS_COLORS)), i);
    scene.add(this.group);
  }

  _add(type, mesh, idx) {
    const v = VEH[type];
    mesh.visible = false;
    this.group.add(mesh);
    this.cars.push({
      type, idx, mesh, len: v.len, wid: v.wid, active: false, idle: 0, dir: 1,
      lane: 0, target: 0, from: 0, phase: 0, sig: 0, sgn: 0, indSt: 0, timer: 5, blocked: false,
      speed: 20, base: 20, passed: false, hit: false, vx: 0, spinV: 0, minDx: 99,
    });
  }

  /** Tail-light brightness multiplier (night glow). */
  setGlow(k) {
    this.glow = k;
    for (const c of this.cars) c.mesh.userData.tail.color.setHex(0xaa1010).multiplyScalar(k);
  }
  setDifficulty(d) { this.diff = d; }
  setQuality(q) { this.quality = Math.max(0, Math.min(2, q)); }
  setTwoWay(on) { this.twoWay = on; }

  reset(pz) { for (const c of this.cars) this._spawn(c, pz, true); }

  /** Is vehicle `o` using (or about to use) `lane`? */
  _occ(o, lane) { return o.lane === lane || (o.phase === 1 && o.target === lane) || (o.phase === 2 && o.from === lane); }

  _off(c, pz) {
    c.active = false; c.mesh.visible = false; c.idle = rnd(1.5, 5);
    c.mesh.position.z = pz + 400;
  }

  _spawn(c, pz, initial) {
    let on;
    const density = [0.58, 0.82, 1][this.quality];
    if (initial) {
      // A race must never open on an empty road: seed a visible pack immediately.
      if (c.type === 'car') on = c.idx < Math.min(this.nCars, Math.max(5, Math.round(this.nCars * 0.68)));
      else on = c.idx === 0; // one truck and one bus join the opening traffic pack
    } else if (c.type === 'car') on = c.idx < Math.round(this.nCars * (0.6 + 0.4 * this.diff) * density);
    else if (c.type === 'truck') on = Math.random() < (0.25 + this.diff * 0.5) * density;
    else on = Math.random() < (0.15 + this.diff * 0.4) * density;
    if (!on) { this._off(c, pz); return; }

    for (let t = 0; t < 25; t++) {
      let dir = 1, lane;
      if (this.twoWay) {
        if (c.type === 'car' && Math.random() < 0.5) { dir = -1; lane = pick(ONC); } else lane = pick(SAME2);
      } else lane = Math.floor(Math.random() * LANES);
      const z = dir > 0
        ? pz - (initial ? 65 : 250) - Math.random() * (initial ? 300 : 260)
        : pz - (initial ? 85 : 300) - Math.random() * (initial ? 300 : 400);
      const free = this.cars.every((o) => o === c || !o.active || !this._occ(o, lane) || Math.abs(o.mesh.position.z - z) > 40 + (o.len + c.len) / 2);
      if (free) { this._place(c, lane, z, dir); return; }
    }
    this._off(c, pz);
  }

  _place(c, lane, z, dir) {
    const spread = 4 + this.diff * 8;
    c.active = true; c.dir = dir;
    c.lane = c.target = c.from = lane; c.phase = 0; c.sig = 0;
    c.timer = rnd(3, 9) * (c.type === 'car' ? 1 : 2);
    if (dir < 0) c.base = rnd(20, 30);
    else if (c.type === 'truck') c.base = rnd(13, 18);
    else if (c.type === 'bus') c.base = rnd(15, 20);
    else c.base = Math.max(12, 26 + rnd(-1, 1) * spread); // spread widens with difficulty
    c.speed = c.base;
    c.passed = false; c.hit = false; c.vx = 0; c.spinV = 0; c.minDx = 99; c.blocked = false;
    const m = c.mesh;
    m.visible = true;
    m.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
    m.position.set(laneX(lane), 0, z);
    this._paintInd(c, 0);
  }

  /** st: -1 left lamp on, +1 right lamp on, 0 off. */
  _paintInd(c, st) {
    c.indSt = st;
    const u = c.mesh.userData;
    if (!u.indL) return;
    const k = 1 + (this.glow - 1) * 0.8;
    u.indL.color.setHex(st < 0 ? IND_ON : IND_OFF);
    u.indR.color.setHex(st > 0 ? IND_ON : IND_OFF);
    if (st < 0) u.indL.color.multiplyScalar(k);
    if (st > 0) u.indR.color.multiplyScalar(k);
  }

  _tryChange(c, pz, px) {
    const allowed = this.twoWay ? SAME2 : [0, 1, 2, 3];
    const opts = [c.lane - 1, c.lane + 1].filter((l) => allowed.includes(l));
    if (!opts.length) return false;
    const lane = pick(opts), m = c.mesh;
    // never cut in right next to the player
    if (Math.abs(m.position.z - pz) < 16 && Math.abs(laneX(lane) - px) < 2.6) return false;
    for (const o of this.cars) {
      if (o === c || !o.active || o.hit || o.dir !== c.dir || !this._occ(o, lane)) continue;
      const need = (c.len + o.len) / 2 + 10 + Math.abs(o.speed - c.speed) * 2.2;
      if (Math.abs(o.mesh.position.z - m.position.z) < need) return false;
    }
    c.target = lane;
    c.sgn = Math.sign(laneX(lane) - laneX(c.lane));
    return true;
  }

  _laneAI(c, dt, px, pz, blink) {
    const m = c.mesh;
    if (c.phase === 0) {
      c.timer -= dt * (c.blocked ? 3 : 1); // stuck behind a slow vehicle: try to overtake sooner
      if (c.timer <= 0) {
        if (this._tryChange(c, pz, px)) { c.phase = 1; c.sig = 1.1; this._paintInd(c, c.sgn); }
        c.timer = (rnd(5, 12) / (1 + this.diff * 1.2)) * (c.type === 'car' ? 1 : 1.8);
        if (c.phase === 0 && c.blocked) c.timer = 1.2;
      }
    } else if (c.phase === 1) {
      c.sig -= dt;
      const st = blink ? c.sgn : 0;
      if (st !== c.indSt) this._paintInd(c, st);
      if (c.sig <= 0) { c.from = c.lane; c.lane = c.target; c.phase = 2; }
    } else {
      const tx = laneX(c.lane), dx = tx - m.position.x, step = 2.7 * dt;
      const st = blink ? c.sgn : 0;
      if (st !== c.indSt) this._paintInd(c, st);
      if (Math.abs(dx) <= step) { m.position.x = tx; m.rotation.y = 0; c.phase = 0; this._paintInd(c, 0); }
      else { m.position.x += Math.sign(dx) * step; m.rotation.y = -Math.sign(dx) * 0.1; }
    }
  }

  update(dt, pz, px = 0) {
    this.t += dt;
    const blink = (this.t * 4.5) % 1 < 0.5;
    for (const c of this.cars) {
      const m = c.mesh;
      if (!c.active) { c.idle -= dt; if (c.idle <= 0) this._spawn(c, pz, false); continue; }

      if (c.hit) {
        c.speed = Math.max(0, c.speed - 14 * dt);
        m.position.x += c.vx * dt;
        m.rotation.y += c.spinV * dt;
        if (c.indSt) this._paintInd(c, 0);
      } else {
        // car-following: never drive through the vehicle in front (same direction, same lane)
        let limit = Infinity;
        for (const o of this.cars) {
          if (o === c || !o.active || o.hit || o.dir !== c.dir || !this._occ(o, c.lane)) continue;
          const gap = c.dir * (m.position.z - o.mesh.position.z) - (c.len + o.len) / 2;
          if (gap > 0 && gap < 18) limit = Math.min(limit, o.speed);
        }
        c.blocked = limit < c.base - 1;
        if (c.speed > limit) c.speed = limit;
        else c.speed += (c.base - c.speed) * Math.min(1, dt * 0.6);
        if (c.dir > 0) this._laneAI(c, dt, px, pz, blink);
      }
      m.position.z -= c.dir * c.speed * dt;
      spinWheels(m, c.speed * dt);

      const dz = m.position.z - pz;
      if (dz > 45 || dz < -760) this._spawn(c, pz, false);
    }
  }
}
