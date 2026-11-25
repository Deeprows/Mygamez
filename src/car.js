import * as THREE from 'three';

export const CAR_W = 1.9;
export const CAR_L = 4.4;

// ---- shared geometry (cars are cheap: ~20 meshes each) ----
const cabin = new THREE.BoxGeometry(1.6, 0.5, 2.1);
{
  const p = cabin.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.85); p.setZ(i, p.getZ(i) * 0.72); }
  }
  cabin.computeVertexNormals();
}
const G = {
  body: new THREE.BoxGeometry(1.9, 0.45, 4.4),
  hood: new THREE.BoxGeometry(1.76, 0.12, 1.7),
  deck: new THREE.BoxGeometry(1.76, 0.12, 1.2),
  roof: new THREE.BoxGeometry(1.36, 0.04, 1.5),
  under: new THREE.BoxGeometry(1.8, 0.1, 4.2),
  wing: new THREE.BoxGeometry(1.8, 0.05, 0.45),
  strut: new THREE.BoxGeometry(0.06, 0.3, 0.2),
  tail: new THREE.BoxGeometry(0.55, 0.12, 0.06),
  head: new THREE.BoxGeometry(0.45, 0.1, 0.06),
  tire: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 20),
  spokeA: new THREE.BoxGeometry(0.31, 0.5, 0.07),
  spokeB: new THREE.BoxGeometry(0.31, 0.07, 0.5),
  cabin,
};
G.tire.rotateZ(Math.PI / 2); // axle along X

const M = {
  tire: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.9, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0b1a28, metalness: 0.9, roughness: 0.08 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
};

/**
 * Procedural low-poly sports car. Front faces -Z. Ground is y = 0.
 * Stage 2 replaces this with a glTF model (keep the same userData contract:
 * wheels[] for spinning, tail material for brake light).
 */
export function buildCar(color, { spoiler = false } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.28 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xaa1010 });

  const add = (geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    g.add(m);
    return m;
  };

  add(G.body, paint, 0, 0.55, 0);
  add(G.under, M.dark, 0, 0.3, 0, false);
  add(G.hood, paint, 0, 0.82, -1.25).rotation.x = -0.09;
  add(G.deck, paint, 0, 0.82, 1.55).rotation.x = 0.05;
  add(G.cabin, M.glass, 0, 1.0, 0.35);
  add(G.roof, paint, 0, 1.27, 0.35);

  if (spoiler) {
    add(G.wing, paint, 0, 1.2, 1.95);
    add(G.strut, M.dark, -0.6, 1.02, 1.95, false);
    add(G.strut, M.dark, 0.6, 1.02, 1.95, false);
  }

  add(G.tail, tail, -0.6, 0.7, 2.21, false);
  add(G.tail, tail, 0.6, 0.7, 2.21, false);
  add(G.head, M.head, -0.62, 0.68, -2.21, false);
  add(G.head, M.head, 0.62, 0.68, -2.21, false);

  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.98, 0.36, sz * 1.4);
      const tire = new THREE.Mesh(G.tire, M.tire);
      tire.castShadow = true;
      pivot.add(tire);
      pivot.add(new THREE.Mesh(G.spokeA, M.rim));
      pivot.add(new THREE.Mesh(G.spokeB, M.rim));
      g.add(pivot);
      wheels.push(pivot);
    }
  }

  g.userData.wheels = wheels;
  g.userData.tail = tail;
  return g;
}

export function spinWheels(car, distance) {
  const a = distance / 0.36;
  for (const w of car.userData.wheels) w.rotation.x -= a;
}