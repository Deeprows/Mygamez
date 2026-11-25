# Player car model (optional)

Drop a car as `player.glb` in this folder. If it exists, the game uses it instead of the built-in procedural car.

Rules (same idea as the Three.js build):
1. Nose must face -Z. If it drives backwards, set `GLB_ROT_Y = PI` at the top of `scripts/car.gd`.
2. The model is auto-scaled to `CAR_LENGTH` (4.4 m) and its pivot is moved to the bottom centre.
3. Wheel nodes are found by name containing `wheel`, `tyre` or `tire`. Each wheel node's origin must be the wheel centre and its axle the local X axis, otherwise it will wobble instead of spinning.
4. Body re-colour works on materials whose name contains `body` or `paint`.
5. Keep it under ~100k triangles for phones (Mobile renderer); ~300k is fine on desktop.

Where to get models (check each licence): Sketchfab (filter Downloadable + CC0/CC-BY, export glTF), Kenney "Car Kit" (CC0, low-poly), Quaternius (CC0).
