# Drop .glb car models here
1. Put `mycar.glb` in this folder (free CC0 packs: Kenney "Car Kit", Quaternius vehicles).
2. Add an entry to `CARS` in `src/cars.js` (see the commented example): `model: './models/mycar.glb'`.
3. Nose must face -Z. If the car drives backwards in the garage, set `rotY: Math.PI`.
4. Wheels spin only if their node names contain "wheel", "tyre" or "tire". Axle must be the node's local X axis.
5. Body recolor works for materials whose name contains "body" or "paint"; otherwise set `recolor: false`.
Keep each model under ~1.5 MB (low-poly, compressed textures) for mobile.
