import * as THREE from 'three';

export const LANES = 4;
export const LANE_W = 3.6;
export const ROAD_W = LANES * LANE_W;
export const SHOULDER = 1.0;
export const TOTAL_W = ROAD_W + SHOULDER * 2;
export const SEG_LEN = 60;
export const SEG_COUNT = 14;
export const PLAYER_BOUND = TOTAL_W / 2 - 0.95 - 0.05;
export const laneX = (i) => (i - (LANES - 1) / 2) * LANE_W;

const TREES = 40; // max trees per segment (half each side)
const BLD = 12;   // city buildings per segment
const ROCKS = 7;  // desert rocks per segment

/**
 * Scenery presets. Segments are re-scattered when they are recycled, so a biome change appears ahead of the player
 * (about 840 m away, hidden by fog) and rolls in naturally. leaf = [hue, hueRange, sat, light, lightRange].
 * Add a biome: add an entry here, add it to BIOMES order in main.js if you want it in the endless rotation.
 */
export const BIOME = {
  highway: { label: 'COUNTRYSIDE', grass: 0x4f9a3c, leaf: [0.24, 0.12, 0.5, 0.22, 0.14], trees: 40, spread: 70, ts: [0.8, 1.0], bld: 0, rock: 0 },
  city:    { label: 'CITY',        grass: 0x565b63, leaf: [0.30, 0.08, 0.45, 0.25, 0.10], trees: 8,  spread: 12, ts: [0.7, 0.6], bld: BLD, rock: 0 },
  desert:  { label: 'DESERT',      grass: 0xd2a85c, leaf: [0.14, 0.06, 0.40, 0.30, 0.10], trees: 8,  spread: 90, ts: [0.5, 0.6], bld: 0, rock: ROCKS },
  snow:    { label: 'SNOW',        grass: 0xe6edf2, leaf: [0.45, 0.10, 0.12, 0.72, 0.16], trees: 30, spread: 60, ts: [0.8, 1.0], bld: 0, rock: 0 },
};
export const BIOMES = Object.keys(BIOME);

const SRGB = THREE.SRGBColorSpace;

function makeRoadTexture() {
  const W = 512, H = 960;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#3b3e43';
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 14000; i++) {
    const v = 48 + Math.floor(Math.random() * 34);
    x.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  const ppm = W / TOTAL_W;
  const px = (xw) => (xw + TOTAL_W / 2) * ppm;
  x.fillStyle = '#ececec';
  for (const s of [-1, 1]) x.fillRect(px(s * (ROAD_W / 2 - 0.35)) - 0.1 * ppm, 0, 0.2 * ppm, H);
  const period = H / 6, dash = period * 0.5;
  for (let i = 1; i < LANES; i++) {
    const xw = (i - LANES / 2) * LANE_W;
    for (let k = 0; k < 6; k++) x.fillRect(px(xw) - 0.09 * ppm, k * period + period * 0.25, 0.18 * ppm, dash);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeWindowTextures() {
  const W = 128, H = 256, cols = 4, rows = 10;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const base = mk(), emi = mk();
  const b = base.getContext('2d'), e = emi.getContext('2d');
  b.fillStyle = '#4a5666'; b.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.2, y = r * ch + ch * 0.22, w = cw * 0.6, h = ch * 0.5;
      const lit = Math.random() < 0.45;
      b.fillStyle = lit ? '#c9d9e8' : '#27384d'; b.fillRect(x, y, w, h);
      if (lit) { e.fillStyle = '#ffd68a'; e.fillRect(x, y, w, h); }
    }
  }
  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = SRGB; t.anisotropy = 4; return t; };
  return { map: tex(base), emi: tex(emi) };
}

function makeSignTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, 496, 112);
  x.fillStyle = fg; x.font = '800 44px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 66, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = SRGB; t.anisotropy = 4;
  return t;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();

    // ---- sky dome ----
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(800, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(0x2f7fd6) }, bottom: { value: new THREE.Color(0xcfe6f7) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = normalize(vP).y; float t = pow(max(h,0.0),0.55);
            gl_FragColor = vec4(mix(bottom, top, t), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      })
    );
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // ---- clouds ----
    this.clouds = new THREE.Group();
    const cm = this.cloudMat = new THREE.SpriteMaterial({ map: makeCloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(cm);
      s.scale.set(160 + Math.random() * 160, 50 + Math.random() * 40, 1);
      s.position.set((Math.random() - 0.5) * 1500, 120 + Math.random() * 140, -(450 + Math.random() * 400));
      this.clouds.add(s);
    }
    scene.add(this.clouds);

    // ---- mountains (follow player Z, so they sit at the horizon forever) ----
    this.mountains = new THREE.Group();
    const mm = this.mountMat = new THREE.MeshLambertMaterial({ color: 0x6f8fb3, flatShading: true });
    for (let i = 0; i < 18; i++) {
      const r = 70 + Math.random() * 90, h = 50 + Math.random() * 90;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mm);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * (r + 70 + Math.random() * 220), h / 2 - 2, -(300 + Math.random() * 400));
      m.rotation.y = Math.random() * 3;
      this.mountains.add(m);
    }
    scene.add(this.mountains);

    // ---- stars (visible at night only) ----
    const sp = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const u = Math.random(), t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      sp[i * 3] = 700 * r * Math.cos(t); sp[i * 3 + 1] = 700 * u; sp[i * 3 + 2] = 700 * r * Math.sin(t);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.visible = false; this.stars.renderOrder = -9;
    scene.add(this.stars);

    // ---- road segments (recycled forever) ----
    const roadMat = new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3c, roughness: 1 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xa4a9b0, roughness: 0.85 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.6, roughness: 0.5 });
    const lampMat = this.lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe0 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const medianMat = new THREE.MeshStandardMaterial({ color: 0xe8c020, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const win = makeWindowTextures();
    this.bldMat = new THREE.MeshStandardMaterial({ map: win.map, emissiveMap: win.emi, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, metalness: 0.1 });
    this.boardEdge = new THREE.MeshStandardMaterial({ color: 0x0d4d2b, roughness: 0.7 });
    const signMat = (t) => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6 });
    this.signMats = ['EXIT 14  \u25b2  CITY CENTER', 'SERVICES  25 KM', 'HIGHWAY RACER  \u25b2  A1'].map((t) => signMat(makeSignTexture(t, '#0d6b3a', '#ffffff')));
    this.poleMat = poleMat;

    const roadGeo = new THREE.PlaneGeometry(TOTAL_W, SEG_LEN).rotateX(-Math.PI / 2);
    const grassGeo = new THREE.PlaneGeometry(700, SEG_LEN).rotateX(-Math.PI / 2);
    const barrierGeo = new THREE.BoxGeometry(0.5, 0.8, SEG_LEN);
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 9, 6);
    const armGeo = new THREE.BoxGeometry(2.6, 0.12, 0.12);
    const lampGeo = new THREE.BoxGeometry(0.7, 0.14, 0.3);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 6).translate(0, 1.2, 0);
    const leafGeo = new THREE.IcosahedronGeometry(1.8, 0).scale(1, 1.35, 1).translate(0, 3.9, 0);
    const medianGeo = new THREE.PlaneGeometry(0.45, SEG_LEN).rotateX(-Math.PI / 2);
    const bldGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // scaled per instance (w, h, d)
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);

    this.biome = 'highway'; this._n = 0; this.twoWay = false; this.quality = 2;
    this.snowK = 0; this.snowTarget = 0; this.tt = 0;
    // checkpoint arch (time attack), placed by setCheckpoint()
    this.cp = this._makeGantry(signMat(makeSignTexture('CHECKPOINT', '#f2c500', '#1b1b1b')));
    this.cp.visible = false;
    scene.add(this.cp);

    // snowfall: flakes live in world space inside a box around the camera and wrap around it
    const FLAKES = 360;
    this.snowPos = new Float32Array(FLAKES * 3);
    for (let i = 0; i < FLAKES; i++) { this.snowPos[i * 3] = (Math.random() - 0.5) * 44; this.snowPos[i * 3 + 1] = Math.random() * 18; this.snowPos[i * 3 + 2] = -Math.random() * 70; }
    const sgeo = new THREE.BufferGeometry();
    this.snowAttr = new THREE.BufferAttribute(this.snowPos, 3).setUsage(THREE.DynamicDrawUsage);
    sgeo.setAttribute('position', this.snowAttr);
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0, depthWrite: false });
    this.snow = new THREE.Points(sgeo, this.snowMat);
    this.snow.frustumCulled = false; this.snow.visible = false;
    scene.add(this.snow);

    this.segs = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const seg = new THREE.Group();
      const road = new THREE.Mesh(roadGeo, roadMat); road.position.y = 0.04; road.receiveShadow = true;
      const grass = new THREE.Mesh(grassGeo, grassMat.clone()); grass.position.y = -0.04; grass.receiveShadow = true; // own material: colour per biome
      const median = new THREE.Mesh(medianGeo, medianMat); median.position.y = 0.06; median.visible = false;
      seg.add(road, grass, median);
      for (const s of [-1, 1]) {
        const b = new THREE.Mesh(barrierGeo, barrierMat);
        b.position.set(s * (TOTAL_W / 2 + 0.25), 0.4, 0);
        b.receiveShadow = true;
        seg.add(b);
        const px = s * (TOTAL_W / 2 + 0.9);
        const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(px, 4.5, 0);
        const arm = new THREE.Mesh(armGeo, poleMat); arm.position.set(px - s * 1.3, 9, 0);
        const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.set(px - s * 2.4, 8.92, 0);
        seg.add(pole, arm, lamp);
      }
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
      const foliage = new THREE.InstancedMesh(leafGeo, leafMat, TREES);
      trunks.frustumCulled = false; foliage.frustumCulled = false;
      const bld = new THREE.InstancedMesh(bldGeo, this.bldMat, BLD); bld.frustumCulled = false; bld.visible = false;
      const rock = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS); rock.frustumCulled = false; rock.visible = false;
      const gantry = this._makeGantry(this.signMats[0]); gantry.position.z = 21; gantry.visible = false;
      seg.add(trunks, foliage, bld, rock, gantry);
      seg.userData = { trunks, foliage, grass, median, bld, rock, gantry, biome: 'highway' };
      scene.add(seg);
      this.segs.push(seg);
    }
    this.reset();
  }

  /** Overhead gantry: two posts, a beam and a green sign board (front faces +Z, towards the oncoming player). */
  _makeGantry(frontMat) {
    const g = new THREE.Group();
    const hw = TOTAL_W / 2 + 1.7;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.4, 0.5), this.poleMat);
      post.position.set(sx * hw, 3.7, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.5, 0.5, 0.5), this.poleMat);
    beam.position.set(0, 7.3, 0);
    const e = this.boardEdge;
    const board = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 0.18), [e, e, e, e, frontMat, e]);
    board.position.set(0, 5.9, 0);
    g.add(beam, board);
    g.userData.board = board;
    return g;
  }

  reset(biome = 'highway') {
    this.biome = BIOME[biome] ? biome : 'highway';
    this._n = 0;
    this.snowK = this.snowTarget = 0;
    this.hideCheckpoint();
    this.segs.forEach((s, i) => { s.position.z = (2 - i) * SEG_LEN; this._scatter(s); });
  }

  setQuality(q) {
    this.quality = Math.max(0, Math.min(2, q));
    const factor = [0.55, 0.8, 1][this.quality];
    for (const seg of this.segs) {
      const b = BIOME[seg.userData.biome];
      const count = Math.round(b.trees * factor);
      seg.userData.trunks.count = count;
      seg.userData.foliage.count = count;
    }
  }

  /** Biome used for segments recycled from now on (appears ahead of the player). */
  setBiome(name) { if (BIOME[name]) this.biome = name; }
  /** Biome of the road segment the player is on. */
  biomeUnder(z) {
    for (const s of this.segs) if (Math.abs(s.position.z - z) <= SEG_LEN / 2) return s.userData.biome;
    return this.biome;
  }
  setTwoWay(on) { this.twoWay = on; for (const s of this.segs) s.userData.median.visible = on; }
  setSnow(k) { this.snowTarget = k; }
  setCheckpoint(z) { this.cp.position.z = z; this.cp.visible = true; }
  hideCheckpoint() { this.cp.visible = false; }

  _scatter(seg) {
    const u = seg.userData, b = BIOME[this.biome];
    const d = this._dummy, col = this._col;
    u.biome = this.biome;
    u.grass.material.color.setHex(b.grass);

    // trees
    const n = Math.round(b.trees * [0.55, 0.8, 1][this.quality]);
    u.trunks.count = u.foliage.count = n;
    const [h0, hr, sat, l0, lr] = b.leaf;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      d.position.set(side * (TOTAL_W / 2 + 2.5 + Math.pow(Math.random(), 1.7) * b.spread), 0, (Math.random() - 0.5) * SEG_LEN);
      d.scale.setScalar(b.ts[0] + Math.random() * b.ts[1]);
      d.rotation.set(0, Math.random() * 6, 0);
      d.updateMatrix();
      u.trunks.setMatrixAt(i, d.matrix);
      u.foliage.setMatrixAt(i, d.matrix);
      col.setHSL(h0 + Math.random() * hr, sat, l0 + Math.random() * lr, SRGB);
      u.foliage.setColorAt(i, col);
    }
    u.trunks.instanceMatrix.needsUpdate = true;
    u.foliage.instanceMatrix.needsUpdate = true;
    u.foliage.instanceColor.needsUpdate = true;

    // city buildings: 2 rows x 3 slots per side
    u.bld.visible = b.bld > 0;
    if (b.bld) {
      u.bld.count = b.bld;
      let i = 0;
      for (const side of [-1, 1]) {
        for (let row = 0; row < 2; row++) {
          for (let k = 0; k < 3; k++) {
            const w = 12 + Math.random() * 6 + row * 4, dd = 12 + Math.random() * 4 + row * 4, h = 22 + Math.random() * 40 + row * 12;
            d.position.set(side * (TOTAL_W / 2 + 14 + w / 2 + row * 26), 0, (k - 1) * 20 + (Math.random() - 0.5) * 3);
            d.scale.set(w, h, dd); d.rotation.set(0, 0, 0);
            d.updateMatrix();
            u.bld.setMatrixAt(i, d.matrix);
            col.setHSL(0.58 + Math.random() * 0.06, 0.12 + Math.random() * 0.12, 0.7 + Math.random() * 0.25, SRGB);
            u.bld.setColorAt(i, col);
            i++;
          }
        }
      }
      u.bld.instanceMatrix.needsUpdate = true;
      u.bld.instanceColor.needsUpdate = true;
    }

    // desert rocks
    u.rock.visible = b.rock > 0;
    if (b.rock) {
      u.rock.count = b.rock;
      for (let i = 0; i < b.rock; i++) {
        const side = i % 2 ? 1 : -1, w = 5 + Math.random() * 8, h = 2 + Math.random() * 6;
        d.position.set(side * (TOTAL_W / 2 + 12 + Math.random() * 90), h * 0.3, (Math.random() - 0.5) * SEG_LEN);
        d.scale.set(w, h, 5 + Math.random() * 8); d.rotation.set(0, Math.random() * 3, 0);
        d.updateMatrix();
        u.rock.setMatrixAt(i, d.matrix);
        col.setHSL(0.05 + Math.random() * 0.04, 0.45, 0.32 + Math.random() * 0.12, SRGB);
        u.rock.setColorAt(i, col);
      }
      u.rock.instanceMatrix.needsUpdate = true;
      u.rock.instanceColor.needsUpdate = true;
    }

    // overhead sign gantry every 6th segment
    this._n++;
    const showGantry = this._n % 6 === 0;
    u.gantry.visible = showGantry;
    if (showGantry) u.gantry.userData.board.material[4] = this.signMats[Math.floor(this._n / 6) % this.signMats.length];
  }

  _flakes(camera, dt) {
    const p = this.snowPos, cx = camera.position.x, cz = camera.position.z;
    const wrap = (v, c, half, size) => c - half + ((((v - (c - half)) % size) + size) % size);
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] -= (4 + (i % 5)) * dt;
      p[i] += Math.sin(this.tt * 0.8 + i) * 0.6 * dt;
      if (p[i + 1] < 0) p[i + 1] += 18;
      p[i] = wrap(p[i], cx, 22, 44);
      p[i + 2] = wrap(p[i + 2], cz - 15, 35, 70);
    }
    this.snowAttr.needsUpdate = true;
  }

  update(playerZ, camera, dt = 0) {
    for (const s of this.segs) {
      if (s.position.z - playerZ > SEG_LEN * 2) {
        s.position.z -= SEG_LEN * SEG_COUNT;
        this._scatter(s);
      }
    }
    this.mountains.position.z = playerZ;
    this.sky.position.copy(camera.position);
    this.clouds.position.set(camera.position.x, 0, camera.position.z);
    this.stars.position.copy(camera.position);

    this.tt += dt;
    this.snowK += (this.snowTarget - this.snowK) * Math.min(1, dt * 1.5);
    this.snow.visible = this.snowK > 0.02;
    if (this.snow.visible) { this.snowMat.opacity = 0.9 * this.snowK; this._flakes(camera, dt); }
  }

  /** Time-of-day look (see tod.js). */
  setLook(p) {
    this.lampMat.color.setHex(0xfffbe0).multiplyScalar(p.lamp);
    this.cloudMat.color.setHex(p.cloud);
    this.mountMat.color.setHex(p.mount);
    this.stars.material.opacity = p.stars;
    this.stars.visible = p.stars > 0;
    this.bldMat.emissiveIntensity = p.glow > 1 ? (p.glow - 1) * 0.35 : 0; // lit windows at sunset / night
  }
}
