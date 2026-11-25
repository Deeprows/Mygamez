# STAGES — Highway Racer 3D (hand-off notes)

Stack: **Three.js (WebGL) + Vite**, plain JS ES modules, no framework. Deploy: GitHub Actions -> GitHub Pages.
Look target: traffic highway, chase cam, speedometer top-left (KM/H + gear), steering wheel bottom-left, brake + gas pedals bottom-right.

## File map
| File | Job |
|---|---|
| index.html | Canvas + HUD DOM (speedo canvas, wheel SVG, pedals, overlay) |
| src/main.js | Renderer, lights, game state `S`, physics, collisions, camera, main loop |
| src/world.js | Sky dome, clouds, mountains, recycled road segments, instanced trees, lamps, barriers. Exports lane constants |
| src/car.js | Procedural car builder `buildCar(color,{spoiler})`, `spinWheels` |
| src/traffic.js | Traffic cars, spawn/recycle, car-following, hit tumble |
| src/controls.js | Keyboard + touch wheel + pedals -> `steer(-1..1) gas brake` |
| src/hud.js | Canvas speedometer (arc, ticks, number, gear) |
| src/audio.js | WebAudio engine synth + crash noise |
| .github/workflows/deploy.yml | Build + deploy to Pages |

## Conventions (keep these when changing things)
- Player travels toward **-Z**. Car front faces -Z. Ground y=0. Units = metres, speed = m/s (HUD = x3.6).
- 4 lanes, `laneX(i)`, lane width 3.6 m, `PLAYER_BOUND` = max |x| for the player.
- World is recycled: segments of 60 m jump forward when 120 m behind the player. No floating-origin reset (fine for ~100 km sessions).
- A car model must expose `userData.wheels[]` (pivot groups spun on X) and `userData.tail` (brake-light material).
- Tuning constants live at the top of `driveFrame` in main.js (accel, drag, steering speed) and in `MAX_SPEED`.

## STAGE 1 — DONE (this commit)
Playable endless highway: 3D scene with PBR + env reflections + soft shadows + fog, sky, clouds, mountains, trees, lamps,
barriers; 4-lane road; player sports car; 12 AI traffic cars with car-following; AABB crashes with damage, tumbling,
camera shake, red flash; near-miss bonus; score/distance/best (localStorage); speedometer HUD; touch wheel + pedals;
keyboard; engine + crash audio; start/game-over overlay; GitHub Pages CI.

## STAGE 2 — NEXT: real models + better handling
- Replace procedural cars with glTF/GLB (free CC0: Kenney Car Kit, Quaternius). Load with `GLTFLoader`, Draco optional. Keep the `userData` contract above. Put files in `public/models/`, use relative URLs (`./models/x.glb`) so Pages works.
- Add garage screen: pick car colour/model, save in localStorage.
- Handling: yaw-based steering (heading angle + lateral grip) instead of direct lateral velocity; drift on brake+steer.
- Optional real physics: `@dimforge/rapier3d-compat` (raycast vehicle) if you want a simulation feel.
- Done when: 3+ selectable cars, wheels steer visually, no regressions in crash logic.

## STAGE 3 — Feel & polish
- Post-processing (`EffectComposer`): bloom on lights, subtle motion blur / radial speed blur above 150 km/h, vignette.
- Particles: tyre smoke, sparks on barrier scrape, crash debris. Speed lines.
- Nitro: boost button (third pedal), FOV kick, FOV/blur effect, cooldown bar.
- Audio: replace synth with samples (engine loop pitch-shifted, skid, horn, music), mute button, volume setting.
- Headlights + night/sunset time-of-day presets (change sky uniforms, fog colour, sun colour).

## STAGE 4 — Game structure
- Modes: Endless, Time Attack, Missions (overtake N cars, reach speed X, near-miss combo).
- Traffic AI: lane changes with indicators, trucks/buses, oncoming lane mode (+score multiplier).
- Coins/pickups, upgrades shop (top speed, handling, nitro) saved in localStorage.
- Difficulty ramp: traffic density and speed spread rise with distance.
- Levels/biomes: city (buildings, bridge, tunnel), desert, snow; overhead green gantry signs.

## STAGE 5 — Ship it
- PWA (manifest + service worker), fullscreen + orientation lock to landscape, pause menu.
- Online leaderboard (Supabase/Firebase free tier), share-score button.
- Wrap to Android/iOS with Capacitor (`npx cap add android`) using the `dist` folder.
- Performance pass: quality setting (shadow size, pixel ratio, traffic count, tree count); target 60 fps on mid phones.

## Known limits / ideas not done
- Cars are boxy by design (Stage 2 fixes it). Trees are single icosahedron blobs. No AI lane changing yet.
- Crash is AABB; no rotational response for the player.
- Audio starts only after tapping START (browser autoplay rule).

## Hand-off prompt (paste into any AI/platform with the repo)
"I have a Three.js + Vite endless highway racer (see README.md and STAGES.md). Stage 1 is done. Implement Stage N from STAGES.md.
Keep conventions (player moves -Z, metres, car userData contract), keep deploy.yml working with `base: './'`, return full code for
every changed file with its path, and update STAGES.md marking what was completed and what is next."