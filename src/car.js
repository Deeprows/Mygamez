import * as THREE from 'three';

export const CAR_W = 1.9;
export const CAR_L = 4.4;
export const STYLE_KEYS = ['sport', 'muscle', 'hyper'];
/** Vehicle footprints (metres) used for collisions + car-following. */
export const VEH = { car: { len: CAR_L, wid: CAR_W }, truck: { len: 9, wid: 2.5 }, bus: { len: 10.8, wid: 2.5 } };
export const IND_OFF = 0x2a1800, IND_ON = 0xff9a10; // turn-indicator colours

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
  rim: new THREE.MeshPhysicalMaterial({ color: 0xcfd4da, metalness: 0.92, roughness: 0.24, clearcoat: 0.35, clearcoatRoughness: 0.2 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1a28, metalness: 0.42, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, reflectivity: 0.9 }),
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
export function buildCar(color, { style = 'sport', spoiler = false, indicators = false } = {}) {
  const P = STYLES[style] || STYLES.sport;
  const G = geos(STYLES[style] ? style : 'sport');
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.68, roughness: 0.24, clearcoat: 0.9, clearcoatRoughness: 0.16, reflectivity: 0.72 });
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
  if (indicators) Object.assign(g.userData, addIndicators(g, 0.9, 2.2, P.bodyY + 0.05));
  return g;
}

/** Headlight brightness multiplier (>1 makes them bloom at night). */
export function setHeadGlow(k) { M.head.color.setHex(0xfff2c0).multiplyScalar(k); }

export function spinWheels(car, distance) {
  const a = distance / (car.userData.wr || 0.36);
  for (const w of car.userData.wheels) w.rotation.x -= a;
}

// ---------------------------------------------------------------- Stage 4: indicators, trucks, buses
/** Four corner lamps sharing two materials (left / right). Traffic blinks them before a lane change. */
function addIndicators(g, hw, hl, y) {
  const geo = new THREE.BoxGeometry(0.22, 0.12, 0.06);
  const indL = new THREE.MeshBasicMaterial({ color: IND_OFF }), indR = new THREE.MeshBasicMaterial({ color: IND_OFF });
  for (const [sx, mat] of [[-1, indL], [1, indR]]) {
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(sx * hw, y, sz * hl);
      g.add(m);
    }
  }
  return { indL, indR };
}

const HW = {
  tire: new THREE.CylinderGeometry(0.5, 0.5, 0.42, 18).rotateZ(Math.PI / 2),
  spA: new THREE.BoxGeometry(0.43, 0.7, 0.09),
  spB: new THREE.BoxGeometry(0.43, 0.09, 0.7),
};
/** spots: [x, z, isSteering]. Same wheel contract as buildCar (steer group > spin group). */
function heavyWheels(g, spots) {
  const wheels = [], steerers = [];
  for (const [x, z, steer] of spots) {
    const grp = new THREE.Group();
    grp.position.set(x, 0.5, z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(HW.tire, M.tire); tire.castShadow = true;
    spin.add(tire, new THREE.Mesh(HW.spA, M.rim), new THREE.Mesh(HW.spB, M.rim));
    grp.add(spin); g.add(grp);
    wheels.push(spin);
    if (steer) steerers.push(grp);
  }
  return { wheels, steerers };
}
function boxAdder(g) {
  return (w, h, d, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = cast; g.add(m); return m;
  };
}

/** Cab-over box truck, 9 m. Same userData contract as buildCar (+ wr = wheel radius, indL/indR). */
export function buildTruck(color, cargoColor = 0xe9e9e9) {
  const g = new THREE.Group(), add = boxAdder(g);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.58, roughness: 0.3, clearcoat: 0.72, clearcoatRoughness: 0.2 });
  const box = new THREE.MeshStandardMaterial({ color: cargoColor, roughness: 0.7 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xaa1010 });
  add(2.2, 0.35, 8.8, M.dark, 0, 0.65, 0, false);          // chassis
  add(2.4, 2.2, 2.3, paint, 0, 1.85, -3.3);                // cab
  add(2.3, 0.85, 0.05, M.glass, 0, 2.4, -4.47, false);     // windshield
  add(2.42, 0.7, 1.2, M.glass, 0, 2.4, -3.5, false);       // side windows
  add(2.5, 2.9, 6.3, box, 0, 2.25, 1.35);                  // cargo box
  add(2.4, 0.3, 0.15, M.dark, 0, 0.55, -4.5, false);       // bumper
  for (const sx of [-1, 1]) {
    add(0.5, 0.14, 0.06, tail, sx * 0.85, 0.95, 4.52, false);
    add(0.45, 0.12, 0.06, M.head, sx * 0.85, 1.0, -4.5, false);
  }
  const { wheels, steerers } = heavyWheels(g, [[-1.12, -3.4, 1], [1.12, -3.4, 1], [-1.12, 2.4, 0], [1.12, 2.4, 0], [-1.12, 3.8, 0], [1.12, 3.8, 0]]);
  g.userData = { wheels, steerers, tail, wr: 0.5, ...addIndicators(g, 1.15, 4.48, 1.1) };
  return g;
}

/** City bus, 10.8 m. */
export function buildBus(color) {
  const g = new THREE.Group(), add = boxAdder(g);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.32, clearcoat: 0.72, clearcoatRoughness: 0.22 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xaa1010 });
  add(2.3, 0.3, 10.5, M.dark, 0, 0.5, 0, false);           // underbody
  add(2.5, 2.7, 10.8, paint, 0, 1.95, 0);                  // body
  add(2.52, 0.25, 10.8, M.stripe, 0, 1.05, 0, false);      // white stripe
  add(2.52, 0.9, 9.4, M.glass, 0, 2.6, 0.1, false);        // window band
  add(2.3, 1.2, 0.05, M.glass, 0, 2.45, -5.41, false);     // windshield
  add(2.3, 0.8, 0.05, M.glass, 0, 2.6, 5.41, false);       // rear window
  add(1.4, 0.25, 2.6, M.stripe, 0, 3.42, 0.5, false);      // roof unit
  for (const sx of [-1, 1]) {
    add(0.5, 0.14, 0.06, tail, sx * 0.9, 0.9, 5.43, false);
    add(0.45, 0.12, 0.06, M.head, sx * 0.9, 0.9, -5.43, false);
  }
  const { wheels, steerers } = heavyWheels(g, [[-1.12, -3.5, 1], [1.12, -3.5, 1], [-1.12, 3.4, 0], [1.12, 3.4, 0]]);
  g.userData = { wheels, steerers, tail, wr: 0.5, ...addIndicators(g, 1.2, 5.4, 1.2) };
  return g;
}
