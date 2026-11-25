import * as THREE from 'three';
import { buildCar, spinWheels, CAR_L } from './car.js';
import { LANES, laneX } from './world.js';

const COLORS = [0xf2c500, 0xd01818, 0x2e6bff, 0x8f2bd1, 0xf4f4f4, 0x1c1c1c, 0xff7a00, 0x11a36a, 0xb0b5bb];

export class Traffic {
  constructor(scene, count = 12) {
    this.group = new THREE.Group();
    this.cars = [];
    for (let i = 0; i < count; i++) {
      const mesh = buildCar(COLORS[i % COLORS.length], { spoiler: Math.random() < 0.3 });
      this.group.add(mesh);
      this.cars.push({ mesh, lane: 0, speed: 20, base: 20, passed: false, hit: false, vx: 0, spinV: 0, minDx: 99 });
    }
    scene.add(this.group);
  }

  reset(pz) { for (const c of this.cars) this._spawn(c, pz, true); }

  _place(c, lane, z) {
    c.lane = lane;
    c.base = c.speed = 16 + Math.random() * 20; // 58-130 km/h
    c.passed = false; c.hit = false; c.vx = 0; c.spinV = 0; c.minDx = 99;
    c.mesh.rotation.set(0, 0, 0);
    c.mesh.position.set(laneX(lane), 0, z);
  }

  _spawn(c, pz, initial) {
    for (let t = 0; t < 25; t++) {
      const lane = Math.floor(Math.random() * LANES);
      const z = pz - (initial ? 60 : 250) - Math.random() * (initial ? 520 : 260);
      if (this.cars.every((o) => o === c || o.lane !== lane || Math.abs(o.mesh.position.z - z) > 35)) {
        this._place(c, lane, z); return;
      }
    }
    this._place(c, Math.floor(Math.random() * LANES), pz - 700);
  }

  update(dt, pz) {
    for (const c of this.cars) {
      const m = c.mesh;
      if (c.hit) {
        c.speed = Math.max(0, c.speed - 14 * dt);
        m.position.x += c.vx * dt;
        m.rotation.y += c.spinV * dt;
      } else {
        // simple car-following: never drive through the car in front
        let limit = Infinity;
        for (const o of this.cars) {
          if (o === c || o.lane !== c.lane || o.hit) continue;
          const gap = m.position.z - o.mesh.position.z - CAR_L;
          if (gap > 0 && gap < 16) limit = Math.min(limit, o.speed);
        }
        if (c.speed > limit) c.speed = limit;
        else c.speed += (c.base - c.speed) * Math.min(1, dt * 0.6);
      }
      m.position.z -= c.speed * dt;
      spinWheels(m, c.speed * dt);

      const dz = m.position.z - pz;
      if (dz > 45 || dz < -760) this._spawn(c, pz, false);
    }
  }
}