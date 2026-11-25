import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildCar, CAR_L } from './car.js';

/**
 * CAR CATALOG. Add a real model by dropping a .glb in /public/models and adding an entry:
 *   { id:'gt', name:'GT', model:'./models/gt.glb', rotY:0, length:4.4, recolor:true,
 *     stats:{ top:64, acc:1.0, hnd:1.0 } }
 * rotY: set Math.PI if the model's nose points to +Z (game needs nose at -Z).
 * Wheel nodes are found by name (/wheel|tyre|tire/i) and spun on their local X axis.
 * If the file is missing or fails to load, the procedural fallback is used.
 * stats: top = max m/s (62 ~ 223 km/h), acc = accel multiplier, hnd = steering multiplier.
 */
export const CARS = [
  { id: 'striker', name: 'Striker', style: 'sport',  color: 0x19b5ff, stats: { top: 62, acc: 1.0,  hnd: 1.0 } },
  { id: 'bruiser', name: 'Bruiser', style: 'muscle', color: 0xd01818, stats: { top: 57, acc: 1.15, hnd: 0.85 } },
  { id: 'phantom', name: 'Phantom', style: 'hyper',  color: 0x8f2bd1, stats: { top: 66, acc: 0.95, hnd: 1.1 } },
  // { id: 'gt', name: 'GT', model: './models/gt.glb', rotY: 0, length: 4.4, recolor: true, stats: { top: 64, acc: 1.0, hnd: 1.0 } },
];

export const COLORS = [0x19b5ff, 0xd01818, 0x8f2bd1, 0xf2c500, 0x11a36a, 0xff7a00, 0xf4f4f4, 0x222222];

export const quickCar = (entry, color) => buildCar(color, { style: entry.style || 'sport', spoiler: true });

const loader = new GLTFLoader();
const gltfCache = new Map();

export async function loadCar(entry, color) {
  if (!entry.model) return quickCar(entry, color);
  try {
    if (!gltfCache.has(entry.model)) gltfCache.set(entry.model, loader.loadAsync(entry.model));
    const gltf = await gltfCache.get(entry.model);
    return prepareGltf(gltf.scene.clone(true), entry, color);
  } catch (err) {
    console.warn('GLB failed, using procedural car:', entry.model, err);
    return quickCar(entry, color);
  }
}

function prepareGltf(root, entry, color) {
  const holder = new THREE.Group();
  holder.add(root);
  root.rotation.y = entry.rotY || 0;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.setScalar((entry.length || CAR_L) / size.z);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);

  const wheels = [];
  const walk = (node, inWheel) => {
    const isWheel = !inWheel && /wheel|tyre|tire/i.test(node.name);
    if (isWheel) wheels.push(node);
    if (node.isMesh) {
      node.castShadow = true;
      if (entry.recolor !== false && /body|paint|carpaint/i.test(node.material?.name || '')) {
        node.material = node.material.clone();
        node.material.color.setHex(color);
      }
    }
    for (const ch of node.children) walk(ch, inWheel || isWheel);
  };
  walk(root, false);

  holder.userData = { wheels, steerers: [], tail: new THREE.MeshBasicMaterial() };
  return holder;
}
