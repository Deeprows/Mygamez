# STAGES — Highway Racer 3D (hand-off notes)

Stack: **Three.js (WebGL) + Vite**, plain JS ES modules, no framework. Deploy: GitHub Actions -> GitHub Pages.
Look target: traffic highway, chase cam, speedometer top-left (KM/H + gear), steering wheel bottom-left, brake + gas pedals bottom-right.

## File map
| File | Job |
|---|---|
| index.html | Canvas + HUD DOM (speedo canvas, wheel SVG, pedals, overlay) |
| src/main.js | Renderer, lights, game state `S`, physics, collisions, camera, main loop |
| src/world.js | Sky dome, clouds, mountains, recycled road segments, instanced trees, lamps, barriers, **biomes (city/desert/snow), overhead gantries, two-way median, snowfall, checkpoint arch**. Exports lane constants, `BIOME`, `BIOMES` |
| src/car.js | Procedural builders `buildCar(color,{style,spoiler,indicators})`, `buildTruck`, `buildBus`, `spinWheels`, `VEH` footprints |
| src/cars.js | Car catalog, colours, GLB loader |
| src/traffic.js | Traffic cars/trucks/buses, spawn/recycle, car-following, **lane changes with indicators, oncoming lanes, difficulty ramp**, hit tumble |
| src/controls.js | Keyboard + touch wheel + pedals -> `steer(-1..1) gas brake` |
| src/hud.js | Canvas speedometer (arc, ticks, number, gear) |
| src/audio.js | WebAudio: engine, skid, nitro, crash, horn, synth music |
| src/post.js | Bloom, speed blur, vignette, quality levels |
| src/particles.js | Smoke / spark particle pools |
| src/tod.js | Day / sunset / night presets |
| src/modes.js | Mode list, `MISSIONS` table, goal helpers (pure data, no DOM) |
| src/pickups.js | Coin streaks (instanced) + repair kits, swept pickup test |
| src/save.js | localStorage profile `hr3d-profile`: coins, per-car upgrades, best scores, done missions, menu selection. `effStats()` |
| src/menu.js | Mode tabs, mission picker, two-way toggle, upgrade shop (DOM only) |
| .github/workflows/deploy.yml | Build + deploy to Pages |

## Conventions (keep these when changing things)
- Player travels toward **-Z**. Car front faces -Z. Ground y=0. Units = metres, speed = m/s (HUD = x3.6).
- 4 lanes, `laneX(i)`, lane width 3.6 m, `PLAYER_BOUND` = max |x| for the player.
- A traffic vehicle (`traffic.cars[i]`) has `type` (car/truck/bus), `len`, `wid`, `active`, `dir` (+1 same way, -1 oncoming), `lane`, `speed`. Always use `len`/`wid`, never CAR_L/CAR_W, for other vehicles. Skip entries with `!active`.
- Truck/bus/car models expose the same userData contract (+ optional `wr` wheel radius, `indL`/`indR` indicator materials).
- Two-way road: lanes 0-1 are oncoming (dir -1, mesh rotated 180 deg), lanes 2-3 same direction. Score x2 while the player is on the left half (`S.mul`).
- World is recycled: segments of 60 m jump forward when 120 m behind the player. No floating-origin reset (fine for ~100 km sessions).
- A car model must expose `userData.wheels[]` (spun on X), `userData.steerers[]` (front groups, rotated on Y, may be empty) and `userData.tail` (brake-light material).
- Tuning constants live at the top of `driveFrame` in main.js (accel, drag, steering speed) and in `MAX_SPEED`.

## STAGE 1 — DONE (this commit)
Playable endless highway: 3D scene with PBR + env reflections + soft shadows + fog, sky, clouds, mountains, trees, lamps,
barriers; 4-lane road; player sports car; 12 AI traffic cars with car-following; AABB crashes with damage, tumbling,
camera shake, red flash; near-miss bonus; score/distance/best (localStorage); speedometer HUD; touch wheel + pedals;
keyboard; engine + crash audio; start/game-over overlay; GitHub Pages CI.

## STAGE 2 — DONE: garage, car catalog, glTF pipeline, new handling
- `src/cars.js`: catalog (`CARS`), colours, `loadCar()` (GLTFLoader with procedural fallback), auto-normalises GLB size/pivot, finds wheel nodes, recolours body materials.
- 3 distinct procedural cars (Striker sport, Bruiser muscle with stripes, Phantom hyper with wing); traffic uses the same 3 body styles.
- Garage screen (arrows, stat bars, colour swatches), saved in localStorage `hr3d-car`; GARAGE button after a crash.
- Per-car stats drive physics: `top` (max m/s), `acc` (accel multiplier), `hnd` (steering multiplier).
- Handling rewrite (main.js `driveFrame`): heading angle `psi` with speed-sensitive max heading, front wheels steer visually, drift = hold brake + steer hard above ~80 km/h (wider heading, body slip, speed scrub, drift score).
- NOT done from the original Stage 2 plan: no real GLB files are bundled (build environment had no internet). Drop your own in `public/models/` (see README there). Rapier physics skipped on purpose: arcade model is simpler and lighter on phones.

## STAGE 3 — DONE: feel & polish
- `src/post.js`: EffectComposer (4x MSAA, half-float): bloom (HIGH only), radial speed blur + vignette (MED/HIGH), OutputPass tone mapping. Quality button cycles LOW (direct render) / MED / HIGH, saved as `hr3d-q`. Default MED on phones, HIGH on desktop.
- `src/particles.js`: pooled soft-point particles. Tyre smoke (drift / hard braking), wall-scrape sparks, crash debris + smoke, nitro flames. Additive particles use HDR colours so they bloom.
- Nitro: N2O button (3rd control) / Shift / E. Bar under health. +accel, +12 m/s over car top speed, FOV kick, speed lines, flames, shake. Refills slowly, +12 per near miss, +8/s while drifting; locks until 30% after emptying.
- `src/tod.js`: Day / Sunset / Night presets (sky, fog, lights, env, stars, lamp + head/tail glow, bloom). Night/sunset turn on a SpotLight headlight. Button cycles, saved as `hr3d-tod`. Add a look by adding a key in `TOD` + `TODS`.
- Audio (`src/audio.js`): engine now has nitro pitch, skid noise, nitro whoosh, horn (H), near-miss blip, optional procedural synth music (button, off by default), mute button. All saved in localStorage.
- NOT done: real audio samples (no internet in build env; the synth stays, `audio.js` notes where to swap). Motion blur is radial only.
- Perf levers if a phone struggles: set quality LOW, lower `Traffic` count and `TREES` in world.js, lower shadow map size in `applyQuality`.

## STAGE 4 — DONE: game structure
- **Modes** (menu tabs, saved): Endless; Time Attack (60 s, a checkpoint arch every 1 km adds 30, 28, 26 ... min 18 s); Missions (10 missions in `src/modes.js`, time limit each, coin reward, replays pay 25%, finishing one selects the next). Edit/add missions in the `MISSIONS` table: types overtake / speed / combo / coins / distance / onc.
- **Traffic AI**: lane changes (indicator blinks 1.1 s, then a smooth 1.4 s move, target lane reserved, never cuts in next to the player, blocked cars try to overtake sooner), trucks and buses (separate sizes/speeds, bigger crash damage), **two-way road** (menu toggle, forced on in some missions): oncoming cars in lanes 0-1, yellow median line, x2 score + oncoming near-miss bonus on the left side.
- **Near-miss combo**: chain misses within 4 s, multiplier up to x3 (oncoming x2 on top). Feeds the combo missions.
- **Coins + pickups** (`pickups.js`): lane streaks of 5-7 coins, picked lane avoids traffic, +1 coin and +10 score each, saved immediately. Green repair kits (+25 health) are rare.
- **Upgrade shop** (`SHOP` button in the menu and after a run): per car, 3 stats x 5 levels (top speed +2.5 m/s, handling +5%, nitro = longer burn / faster refill / more punch). Costs 150, 300, 550, 900, 1400. Garage bars show upgraded stats.
- **Difficulty ramp**: `diff = clamp(dist / 9000, 0..1)` (missions have a floor in `mission.diff`). It raises active vehicle count (60% -> 100%), speed spread (+-4 -> +-12 m/s), truck/bus share, lane-change frequency.
- **Biomes**: countryside, city (buildings with lit windows at dusk/night), desert (rocks, dry shrubs), snow (white ground, frosted trees, snowfall). Endless/Time Attack rotate every 2.5 km; missions fix one. Segments are re-scattered when recycled, so the change rolls in about 800 m ahead; a toast shows the biome name when you reach it. Add a biome in `BIOME` (world.js).
- **Overhead green gantry signs** every 6th road segment (3 sign texts) + a yellow CHECKPOINT arch in Time Attack.
- Persistence: all in `hr3d-profile` (the old `hr3d-best` is migrated once).
- NOT done from the original Stage 4 plan: **tunnel and bridge** pieces (needs roofed/elevated segment types; add a segment variant in `world.js`). Mission set is sequential data only, no star ratings.
- NOT verified: this stage was written in an environment with no browser and no internet. Traffic AI, pickups, biome rotation and mission helpers were simulated headlessly (no overlaps, lane rules hold in two-way mode, pickups collected at 70 m/s frames), but the visuals (new truck/bus models, building windows, menu/shop layout on phones) have not been looked at. Expect small visual tweaks.

## STAGE 5 — Ship it
- PWA (manifest + service worker), fullscreen + orientation lock to landscape, pause menu.
- Online leaderboard (Supabase/Firebase free tier), share-score button.
- Wrap to Android/iOS with Capacitor (`npx cap add android`) using the `dist` folder.
- Performance pass: quality setting (shadow size, pixel ratio, traffic count, tree count); target 60 fps on mid phones.

## Known limits / ideas not done
- Cars/trucks/buses are boxy by design (swap in GLBs, see public/models/README.md). Trees are single icosahedron blobs. Traffic only changes lanes in the same direction (no overtaking through the oncoming lanes).
- Crash is AABB; no rotational response for the player.
- Audio starts only after tapping START (browser autoplay rule).

## Hand-off prompt (paste into any AI/platform with the repo)
"I have a Three.js + Vite endless highway racer (see README.md and STAGES.md). Stages 1-4 are done. Implement Stage N from STAGES.md.
Keep conventions (player moves -Z, metres, car userData contract), keep deploy.yml working with `base: './'`, return full code for
every changed file with its path, and update STAGES.md marking what was completed and what is next."
