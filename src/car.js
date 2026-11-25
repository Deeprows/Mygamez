import * as THREE from 'three';

export const CAR_W = 1.9;
export const CAR_L = 4.4;
export const STYLE_KEYS = ['sport', 'muscle', 'hyper'];

// Body-style parameters. Front faces -Z, ground y = 0.
const STYLES = {
  sport:  { bodyY: 0.55, bodyH: 0.45, hoodLen: 1.7, hoodZ: -1.25, cabW: 1.6,  cabH: 0.5,  cabL: 2.1, tx: 0.85, tz: 0.72, cabY: 1.0,  cabZ: 0.35, stripe: false, wing: false },
  muscle: { bodyY: 0.60, bodyH: 0.52, hoodLen: 2.1, hoodZ: -1.1,  cabW: 1.64, cabH: 0.52, cabL: 1.9, tx: 0.90, tz: 0.80, cabY: 1.12, cabZ: 0.65, stripe: true,  wing: false },
  hyper:  { bodyY: 0.48, bodyH: 0.36, hoodLen: 2.2, hoodZ: -1.05, cabW: 1.5,  cabH: 0.42, cabL: 1.9, tx: 0.78, tz: 0.62, cabY: 0.9,  cabZ: 0.25, stripe: false, wing: true  },
};

const S = {
  under: new THREE.BoxGeometry(1.8, 0.1, 4.2),
  wing: new THREE.BoxGeometry(1.8, 0.05, 0.45),
  strut: new THREE.BoxGeometry(0.06, 0.3, 0.2),
  tail: new THREE.BoxGeometry(0.55, 0.12, 0.06),
  head: new THREE.BoxGeometry(0.45, 0.1, 0.06),
  tire: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 20).rotateZ(Math.PI / 2),
  spokeA: new THREE.BoxGeometry(0.31, 0.5, 0.07),
  spokeB: new THREE.BoxGeometry(0.31, 0.07, 0.5),
  deck: new THREE.BoxGeometry(1.76, 0.12, 1.2),
};
const M = {
  tire: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.9, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0b1a28, metalness: 0.9, roughness: 0.08 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 }),
};

const cache = {};
function geos(style) {
  if (cache[style]) return cache[style];
  const P = STYLES[style];
  const cab = new THREE.BoxGeometry(P.cabW, P.cabH, P.cabL);
  const p = cab.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { p.setX(i, p.getX(i) * P.tx); p.setZ(i, p.getZ(i) * P.tz); }
  }
  cab.computeVertexNormals();
  return (cache[style] = {
    cab,
    body: new THREE.BoxGeometry(1.9, P.bodyH, 4.4),
    hood: new THREE.BoxGeometry(1.76, 0.12, P.hoodLen),
    roof: new THREE.BoxGeometry(P.cabW * P.tx - 0.04, 0.04, P.cabL * P.tz - 0.05),
    stripeHood: new THREE.BoxGeometry(0.34, 0.012, P.hoodLen),
    stripeRoof: new THREE.BoxGeometry(0.34, 0.012, P.cabL * P.tz - 0.05),
    stripeDeck: new THREE.BoxGeometry(0.34, 0.012, 1.2),
  });
}

/**
 * Procedural car. Contract (a glTF car must expose the same):
 *   userData.wheels    spin groups, rotated on X
 *   userData.steerers  front groups, rotated on Y for steering (may be empty)
 *   userData.tail      material whose .color is changed for brake lights
 */
export function buildCar(color, { style = 'sport', spoiler = false } = {}) {
  const P = STYLES[style] || STYLES.sport;
  const G = geos(STYLES[style] ? style : 'sport');
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.28 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xaa1010 });

  const add = (geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = cast; g.add(m); return m;
  };

  const topY = P.bodyY + P.bodyH / 2;
  const hoodY = topY + 0.045;
  add(G.body, paint, 0, P.bodyY, 0);
  add(S.under, M.dark, 0, 0.3, 0, false);
  const hood = add(G.hood, paint, 0, hoodY, P.hoodZ); hood.rotation.x = -0.09;
  const deck = add(S.deck, paint, 0, hoodY, 1.55); deck.rotation.x = 0.05;
  add(G.cab, M.glass, 0, P.cabY, P.cabZ);
  const roof = add(G.roof, paint, 0, P.cabY + P.cabH / 2 + 0.02, P.cabZ);

  if (P.stripe) {
    const st = (geo, parent) => { const s = new THREE.Mesh(geo, M.stripe); s.position.y = 0.067; parent.add(s); };
    st(G.stripeHood, hood); st(G.stripeDeck, deck); st(G.stripeRoof, roof);
  }
  if (spoiler || P.wing) {
    const wy = topY + 0.42;
    add(S.wing, paint, 0, wy, 1.95);
    add(S.strut, M.dark, -0.6, wy - 0.17, 1.95, false);
    add(S.strut, M.dark, 0.6, wy - 0.17, 1.95, false);
  }

  const ly = P.bodyY + 0.15;
  add(S.tail, tail, -0.6, ly, 2.21, false);
  add(S.tail, tail, 0.6, ly, 2.21, false);
  add(S.head, M.head, -0.62, ly - 0.02, -2.21, false);
  add(S.head, M.head, 0.62, ly - 0.02, -2.21, false);

  const wheels = [], steerers = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const steer = new THREE.Group();
      steer.position.set(sx * 0.98, 0.36, sz * 1.4);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(S.tire, M.tire); tire.castShadow = true;
      spin.add(tire, new THREE.Mesh(S.spokeA, M.rim), new THREE.Mesh(S.spokeB, M.rim));
      steer.add(spin); g.add(steer);
      wheels.push(spin);
      if (sz < 0) steerers.push(steer);
    }
  }
  g.userData = { wheels, steerers, tail };
  return g;
}

/** Headlight brightness multiplier (>1 makes them bloom at night). */
export function setHeadGlow(k) { M.head.color.setHex(0xfff2c0).multiplyScalar(k); }

export function spinWheels(car, distance) {
  const a = distance / 0.36;
  for (const w of car.userData.wheels) w.rotation.x -= a;
}
