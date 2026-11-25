import * as THREE from 'three';
import { LANES, laneX } from './world.js';

const MAXC = 40; // coin slots
const MAXR = 3;  // repair-kit slots

/** Coins (instanced, spinning, bloom) in lane streaks ahead of the player + occasional repair kits. */
export class Pickups {
  constructor(scene) {
    this.group = new THREE.Group();
    this.t = 0; this.nextZ = null; this.prevZ = null;
    this._d = new THREE.Object3D();

    const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20).rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.8, roughness: 0.25, emissive: 0xff9a00, emissiveIntensity: 1.2 });
    this.coins = new THREE.InstancedMesh(geo, mat, MAXC);
    this.coins.frustumCulled = false;
    this.group.add(this.coins);
    this.cx = new Float32Array(MAXC); this.cz = new Float32Array(MAXC); this.con = new Uint8Array(MAXC);

    const gm = new THREE.MeshStandardMaterial({ color: 0x2bd96b, emissive: 0x12b24a, emissiveIntensity: 1.1, roughness: 0.4 });
    const h = new THREE.BoxGeometry(1.0, 0.32, 0.32), v = new THREE.BoxGeometry(0.32, 1.0, 0.32);
    this.rep = [];
    for (let i = 0; i < MAXR; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(h, gm), new THREE.Mesh(v, gm));
      g.visible = false;
      this.group.add(g);
      this.rep.push({ g, on: false, x: 0, z: 0 });
    }
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.con.fill(0);
    for (const r of this.rep) { r.on = false; r.g.visible = false; }
    this.nextZ = null; this.prevZ = null;
  }

  _streak(z, traffic) {
    // lane with the most clearance from traffic around the streak start (+ some randomness)
    let best = 0, bestScore = -1;
    for (let l = 0; l < LANES; l++) {
      let gap = 999;
      for (const o of traffic.cars) {
        if (o.active && (o.lane === l || (o.phase > 0 && o.target === l))) gap = Math.min(gap, Math.abs(o.mesh.position.z - (z - 15)));
      }
      const sc = Math.min(gap, 80) + Math.random() * 60;
      if (sc > bestScore) { bestScore = sc; best = l; }
    }
    if (Math.random() < 0.08) {
      const r = this.rep.find((q) => !q.on);
      if (r) { r.on = true; r.x = laneX(best); r.z = z; r.g.visible = true; return; }
    }
    const n = 5 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const i = this.con.indexOf(0);
      if (i < 0) return;
      this.con[i] = 1; this.cx[i] = laneX(best); this.cz[i] = z - k * 6.5;
    }
  }

  /** cb('coin' | 'repair') is called when the player picks something up. */
  update(dt, pz, px, traffic, live, cb) {
    this.t += dt;
    if (this.prevZ === null) this.prevZ = pz;
    if (this.nextZ === null) this.nextZ = pz - 140;
    if (live) {
      while (this.nextZ > pz - 480) { this._streak(this.nextZ, traffic); this.nextZ -= 45 + Math.random() * 70; }
    }
    // swept test along the distance travelled this frame, so fast frames never skip a coin
    const z0 = Math.min(pz, this.prevZ) - 1.6, z1 = Math.max(pz, this.prevZ) + 1.6;
    const d = this._d;
    for (let i = 0; i < MAXC; i++) {
      if (this.con[i]) {
        const z = this.cz[i];
        if (z > pz + 25) this.con[i] = 0;
        else if (live && z >= z0 && z <= z1 && Math.abs(this.cx[i] - px) < 1.6) { this.con[i] = 0; cb('coin'); }
      }
      if (this.con[i]) {
        d.position.set(this.cx[i], 1.05 + Math.sin(this.t * 3 + i) * 0.08, this.cz[i]);
        d.rotation.set(0, this.t * 3 + i, 0); d.scale.setScalar(1);
      } else { d.position.set(0, -50, 0); d.scale.setScalar(0); }
      d.updateMatrix();
      this.coins.setMatrixAt(i, d.matrix);
    }
    this.coins.instanceMatrix.needsUpdate = true;

    for (const r of this.rep) {
      if (!r.on) continue;
      if (r.z > pz + 25) { r.on = false; r.g.visible = false; continue; }
      if (live && r.z >= z0 && r.z <= z1 && Math.abs(r.x - px) < 1.8) { r.on = false; r.g.visible = false; cb('repair'); continue; }
      r.g.position.set(r.x, 1.1 + Math.sin(this.t * 3) * 0.1, r.z);
      r.g.rotation.y = this.t * 2;
    }
    this.prevZ = pz;
  }
}
