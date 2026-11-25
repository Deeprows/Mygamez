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

const TREES = 40; // per segment (half each side)

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
    const cm = new THREE.SpriteMaterial({ map: makeCloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(cm);
      s.scale.set(160 + Math.random() * 160, 50 + Math.random() * 40, 1);
      s.position.set((Math.random() - 0.5) * 1500, 120 + Math.random() * 140, -(450 + Math.random() * 400));
      this.clouds.add(s);
    }
    scene.add(this.clouds);

    // ---- mountains (follow player Z, so they sit at the horizon forever) ----
    this.mountains = new THREE.Group();
    const mm = new THREE.MeshLambertMaterial({ color: 0x6f8fb3, flatShading: true });
    for (let i = 0; i < 18; i++) {
      const r = 70 + Math.random() * 90, h = 50 + Math.random() * 90;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mm);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * (r + 70 + Math.random() * 220), h / 2 - 2, -(300 + Math.random() * 400));
      m.rotation.y = Math.random() * 3;
      this.mountains.add(m);
    }
    scene.add(this.mountains);

    // ---- road segments (recycled forever) ----
    const roadMat = new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3c, roughness: 1 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xa4a9b0, roughness: 0.85 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.6, roughness: 0.5 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe0 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });

    const roadGeo = new THREE.PlaneGeometry(TOTAL_W, SEG_LEN).rotateX(-Math.PI / 2);
    const grassGeo = new THREE.PlaneGeometry(700, SEG_LEN).rotateX(-Math.PI / 2);
    const barrierGeo = new THREE.BoxGeometry(0.5, 0.8, SEG_LEN);
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 9, 6);
    const armGeo = new THREE.BoxGeometry(2.6, 0.12, 0.12);
    const lampGeo = new THREE.BoxGeometry(0.7, 0.14, 0.3);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 6).translate(0, 1.2, 0);
    const leafGeo = new THREE.IcosahedronGeometry(1.8, 0).scale(1, 1.35, 1).translate(0, 3.9, 0);

    this.segs = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const seg = new THREE.Group();
      const road = new THREE.Mesh(roadGeo, roadMat); road.position.y = 0.04; road.receiveShadow = true;
      const grass = new THREE.Mesh(grassGeo, grassMat); grass.position.y = -0.04; grass.receiveShadow = true;
      seg.add(road, grass);
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
      seg.add(trunks, foliage);
      seg.userData = { trunks, foliage };
      scene.add(seg);
      this.segs.push(seg);
    }
    this.reset();
  }

  reset() {
    this.segs.forEach((s, i) => { s.position.z = (2 - i) * SEG_LEN; this._scatter(s); });
  }

  _scatter(seg) {
    const { trunks, foliage } = seg.userData;
    const d = this._dummy, col = this._col;
    for (let i = 0; i < TREES; i++) {
      const side = i % 2 ? 1 : -1;
      d.position.set(side * (TOTAL_W / 2 + 2.5 + Math.pow(Math.random(), 1.7) * 70), 0, (Math.random() - 0.5) * SEG_LEN);
      d.scale.setScalar(0.8 + Math.random() * 1.0);
      d.rotation.y = Math.random() * 6;
      d.updateMatrix();
      trunks.setMatrixAt(i, d.matrix);
      foliage.setMatrixAt(i, d.matrix);
      col.setHSL(0.24 + Math.random() * 0.12, 0.5, 0.22 + Math.random() * 0.14, THREE.SRGBColorSpace);
      foliage.setColorAt(i, col);
    }
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    foliage.instanceColor.needsUpdate = true;
  }

  update(playerZ, camera) {
    for (const s of this.segs) {
      if (s.position.z - playerZ > SEG_LEN * 2) {
        s.position.z -= SEG_LEN * SEG_COUNT;
        this._scatter(s);
      }
    }
    this.mountains.position.z = playerZ;
    this.sky.position.copy(camera.position);
    this.clouds.position.set(camera.position.x, 0, camera.position.z);
  }
}
