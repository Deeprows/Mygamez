# STAGES-GODOT — Highway Racer: Realistic (Godot 4) track

Portable hand-off file. Copy it with the repo (or alone) into any AI chat / platform and say "continue from the next stage".
Companion file: `STAGES.md` (the original Three.js build, Stages 1-4 done). This file does NOT replace it.

## 0. Where we are (read this first)
- Original game: **Highway Racer 3D**, Three.js + Vite, Stages 1-4 done (`STAGES.md`).
- **Stage 5 (Ship it) is ON HOLD** on purpose. Full text is kept in section 8. We resume it after the realism track.
- Current work: a **more realistic version in Godot 4 (Forward+ 3D renderer)**, in the folder `godot/`.
  Stages here are named **G1, G2, ...** so they never clash with the old Stage numbers.
- **G1 is written but has never been run** (it was authored in an environment with no Godot and no internet). First job in any new session: open it, run it, fix whatever the Output panel says. See section 6.

## 1. Look targets
- Reference A (orange sports car, drifting, desert track): realistic sun, long shadows, tyre smoke, kerbs, palm/rock backdrop, sharp reflections on the paint, atmospheric haze, mountains.
- Reference B (blue car, KMH HUD): chase camera, tarmac with real grain, red/white kerbs, guardrails, dense trees, **HUD = X (top-left), KMH panel (top-centre), ? (top-right), R (left), steering wheel with L/R slider (bottom-left), brake + gas pedals (bottom-right)**.
- Quality bar: "looks like a 2015+ mobile racing game on desktop, and a trimmed version of that on a mid phone".

## 2. Decisions (and why)
| Decision | Reason |
|---|---|
| Engine: **Godot 4.3+**, GDScript | Free, PBR, SSR/SSAO/volumetric fog, soft shadows, glTF native, exports to Windows/Linux/macOS/Android |
| Renderer: **Forward+** for development/desktop; **Mobile** renderer for phones | Realism features (SSR, SSAO, SSIL, SDFGI, volumetric fog) are Forward+ only. Mobile keeps PBR, shadows, glow, fog |
| **Web export is NOT the target** | Godot 4 web builds use the Compatibility renderer only (as of 4.3), which loses most of the realistic effects. The old Three.js build stays the web version |
| Driving = arcade model ported from `src/main.js` | Same feel as the existing game, light on phones. Rapier/VehicleBody3D deliberately not used yet |
| No downloaded assets in G1 (procedural materials + procedural car) | Build env had no internet. G2 swaps in real CC0 assets |
| No SDFGI | World is recycled/moving; SDFGI wants static geometry. Revisit in G5 |
| Everything built in code (scenes are near-empty) | Hand-writing .tscn without the editor is error-prone; code is easier to patch from any chat |

## 3. Status board
| Stage | Name | Status |
|---|---|---|
| G1 | Foundation: renderer, light, road, terrain, car, HUD, driving | **DONE (written, not yet run)** |
| G2 | Real assets and materials | next |
| G3 | Traffic and game rules port | planned |
| G4 | Vehicle feel and effects | planned |
| G5 | Lighting, weather, wet road | planned |
| G6 | Biomes and track pieces (desert like Reference A) | planned |
| G7 | Game structure port (menu, garage, shop, modes, save) | planned |
| G8 | Audio, performance, export | planned |
| Stage 5 | Ship it (PWA / leaderboard / wrap) | **ON HOLD** (section 8) |

## 4. Repo layout
```
STAGES.md            original Three.js stages (1-4 done, 5 on hold)
STAGES-GODOT.md      this file
godot/
  project.godot      Forward+ , MSAA 4x, 4096 shadow atlas, landscape, mouse emulates touch
  main.tscn          one Node3D that runs scripts/main.gd
  scripts/
    main.gd          state, input actions, driving physics (port of driveFrame), camera, loop
    atmosphere.gd    sky, sun, fog, tonemap, SSR/SSAO/glow/volumetric fog, quality tiers 0/1/2
    tod.gd           day / sunset / night presets (data only)
    road.gd          recycled 60 m segments: asphalt, markings, kerbs, guardrails, lamps, hills+mountains, trees
    car.gd           player car: loads assets/cars/player.glb if present, else procedural car
    mats.gd          procedural PBR materials (asphalt, grass, paint, glass, tyre, rim ...)
    hud.gd           HUD + multi-touch controls (Control with _draw)
    post_fx.gd       full-screen speed blur + vignette layer
    cfg.gd           shared constants (same numbers as world.js)
  shaders/post_fx.gdshader
  assets/cars/README.md   how to drop in a GLB
```

## 5. Conventions (keep these when changing things)
- Player travels toward **-Z**. Car nose faces -Z. Ground y = 0. Units = metres, speed = m/s (HUD = x3.6).
- 4 lanes, `Cfg.lane_x(i)`, lane width 3.6 m, road 14.4 m, `PLAYER_BOUND` 7.2.
- Steering: `steer` -1..1, **+ = right = +X**. Car yaw = `-(psi + slip)`. Front wheels yaw `-steer*0.45`.
- Car contract: `wheels[]` spin on local X, `steerers[]` rotate on Y, `tail_mat` brake light, `head_lights[]` spots. Any GLB must satisfy the same.
- Road is recycled: segments of 60 m jump forward when 130 m behind. Ground and trees are rebuilt from world position, so everything is seamless and deterministic.
- Materials use **world triplanar** UVs (no UV maps needed, seamless across segments).
- No `class_name` anywhere: scripts use `preload(...)` constants so the project runs without the editor's class cache.
- Driving tuning constants: top of `main.gd` (`TOP`, `ACC`, `HND`) and `_drive()`. They equal the Three.js "Striker" car.
- Look tuning: `tod.gd` (sky, sun, fog, exposure, glow), `atmosphere.gd` (effects per quality), `mats.gd` (surfaces), `road.gd` constants (`GROUND_COLS`, `TREES_PER_SIDE`, `ground_h`).

## 6. STAGE G1 — DONE (unverified): foundation
What exists
- Forward+ project; ACES tonemap, procedural sky with sun disc, exponential fog with aerial perspective and sun scatter, glow/bloom.
- Sun with 4-split cascaded shadows, soft (PCSS-like) shadows on HIGH. SSAO from MED, SSR + volumetric fog (sunset only) on HIGH. MSAA 0/2x/4x.
- 3 quality tiers (button Q, saved in `user://settings.cfg`): LOW / MED / HIGH. Default MED on phones, HIGH on desktop.
- Day / Sunset / Night (button T). Night turns on car headlight spots and emissive road lamps.
- Road: noise-based PBR asphalt (albedo + normal), dashed lane lines, edge lines, red/white kerbs, metal guardrail + posts, lamp posts, rolling hills that grow into far mountains, 18 trees per segment with per-tree tint.
- Player car: lofted body, metallic paint with clearcoat, mirror glass, 10-spoke wheels (spin + steer), spoiler, emissive head/tail lights, brake light, body pitch/roll. Optional real car via `assets/cars/player.glb`.
- Arcade driving ported 1:1: gas/brake, speed-sensitive steering, drift (brake + steer hard above ~80 km/h), nitro with lock/refill, road-edge scrub, speed FOV kick, speed blur.
- HUD matching Reference B with true multi-touch (wheel and pedals at the same time). Mouse works as touch on desktop.
- NOT in G1: traffic, collisions, score, modes, menu, shop, audio, particles, real assets.

How to run
1. Install Godot **4.3 or newer** (standard build). Open `godot/project.godot`, press F5. (Terminal: `godot --path godot`.)
2. Syntax smoke test without a window: `godot --headless --path godot --quit-after 60` — it must print no `SCRIPT ERROR` / `Parse Error`.
3. Keys: W/Up gas, S/Down/Space brake, A D / arrows steer, Shift/E nitro, T time of day, Q quality, R restart, H help, Esc quit.

G1 acceptance checklist (tick these, fix what fails, then mark G1 verified here)
- [ ] Project opens, Output panel shows no errors/warnings that stop the run
- [ ] Orange car visible from behind, road, kerbs, rails, trees, hills, sky
- [ ] W accelerates to about 223 km/h; steering, brake, drift, nitro work
- [ ] T cycles day -> sunset -> night; night shows headlight beams and glowing lamps
- [ ] Q cycles LOW/MED/HIGH; HIGH shows soft shadows, contact darkening (SSAO), reflections on the road/paint
- [ ] Steady frame rate: 60 fps on desktop HIGH. Note the fps on your phone for G8
- [ ] Touch (or mouse-as-touch): wheel area steers, right pedal gas, left pedal brake, N2O works together

Known limits / things to look at first
- **Never run.** Expect small fixes: a wrong property name, a winding/normal problem on the procedural car body, a texture that loads late (noise textures generate in a thread, so the first frames may look flat).
- Procedural car is a stand-in (boxy-smooth). Real realism for the car comes from a GLB in G2.
- Trees are stacked cones (stand-ins). Road is straight (Reference A is a curved track; see G6 decision).
- Sky stars are not drawn at night yet (procedural sky has none). Rain/wet road not yet.
- If SSR or volumetric fog looks wrong on your GPU, lower to MED (Q).

## 7. Planned stages
Each stage: goal, tasks, done-when. Keep each one shippable.

### G2 — Real assets and materials (biggest realism jump)
- Player car: 1-3 real glTF cars (separate body / glass / wheels / lights), correct wheel pivots, brake discs, interior or dark glass. Keep the car contract (section 5). Colour variants through the paint material.
- Road: CC0 PBR asphalt set (albedo, normal, roughness, AO), cracks / tyre-rubber lines as Decal nodes, worn paint on markings.
- Terrain: slope/height-blended grass + rock material, real trees/bushes/rocks (glTF, with LOD and visibility ranges), grass cards near the road.
- Sky: HDRI panorama for day/sunset (keep procedural for night + add stars).
- Props: real guardrail, concrete barriers, signs/gantries, lamp models.
- Done when: a screenshot next to Reference B is hard to tell apart in quality; still 60 fps desktop HIGH; asset licences recorded in section 9.

### G3 — Traffic and game rules port
- Port `traffic.js` (cars/trucks/buses, car-following, indicators + lane changes, two-way road, difficulty ramp) and `pickups.js` (coins, repair kits) to GDScript with **pooled nodes** and no physics engine.
- AABB crash with damage, camera shake, tumble, near-miss + combo scoring, distance/score/best.
- Done when: 12 vehicles at 60 fps, no overlaps, crash and near-miss feel the same as the Three.js build.

### G4 — Vehicle feel and effects
- Suspension spring (pitch/roll/heave), tyre smoke (GPUParticles3D), skid marks (Decals), wall sparks, nitro flames, speed lines.
- Camera modes: chase, bumper/hood, cockpit; better camera lag and FOV.
- Done when: drifting in Reference A style (smoke, marks, slide) looks right.

### G5 — Lighting, weather, wet road
- Continuous time-of-day sweep, clouds, stars, sun glare/god rays (volumetric fog), real lamp lights near the player (small pool of SpotLight3D), headlight cones through fog.
- Rain + wet asphalt (lower roughness, SSR), puddle reflections, wipers-free (no interior) rain streak overlay.
- ReflectionProbe on the car, evaluate SDFGI/VoxelGI only if geometry can be made static.
- Done when: night rain looks cinematic and still runs on HIGH.

### G6 — Biomes and track pieces
- Biomes from Stage 4 (countryside, city, desert, snow) + the missing **tunnel and bridge** pieces; per-biome materials, fog, props.
- **Decision to make here:** keep a straight highway (current) or add curves/hills so tracks like Reference A are possible. Curves mean replacing straight segments with a path (Curve3D) or a "curved world" vertex shader. Cheaper option: bend the world visually with a shader while physics stay straight.
- Done when: desert biome (red mesas, palms, dunes, kerbed corners if curves) matches Reference A mood.

### G7 — Game structure port
- Menu, garage (cars, colours, stats), shop (3 stats x 5 levels), modes (Endless, Time Attack, 10 Missions from `modes.js`), pause, settings, save file (`ConfigFile` or JSON in `user://`).
- Done when: full loop menu -> race -> results -> shop works with touch only.

### G8 — Audio, performance, export
- Real audio samples (engine loops by RPM, skid, wind, crash, music) or keep synth via AudioStreamGenerator.
- Perf pass: LOD, visibility ranges, shadow budget, `scaling_3d_mode` (FSR) for phones, MultiMesh everywhere, texture compression (ETC2/ASTC).
- Export: Windows/Linux/macOS, **Android with the Mobile renderer** (needs Android SDK + JDK + export templates). Target 60 fps on a mid phone at MED.
- Then **resume Stage 5** (section 8), re-scoped.

## 8. STAGE 5 — Ship it  (ON HOLD — original text kept)
Original plan for the Three.js build:
- PWA (manifest + service worker), fullscreen + orientation lock to landscape, pause menu.
- Online leaderboard (Supabase/Firebase free tier), share-score button.
- Wrap to Android/iOS with Capacitor (`npx cap add android`) using the `dist` folder.
- Performance pass: quality setting (shadow size, pixel ratio, traffic count, tree count); target 60 fps on mid phones.

When we resume, decide first which build ships:
- **Option A (Godot is the main game):** PWA/Capacitor no longer apply to the realistic build. Keep: pause menu, leaderboard (HTTP requests from Godot), share-score, perf pass, Android export (G8). Keep the Three.js PWA as the "lite" web version.
- **Option B (both):** do the PWA/Capacitor work on the Three.js build exactly as written above, and ship Godot separately.

## 9. Asset sourcing and licences (fill in as assets are added)
Prefer CC0. Always keep a line here per asset: name, source URL, licence, author, where used.
- Textures / HDRIs / models: ambientCG (CC0), Poly Haven (CC0)
- Low-poly vehicles and nature kits: Kenney (CC0), Quaternius (CC0)
- Realistic cars: Sketchfab (licence differs per model: check CC0 vs CC-BY and credit when required)
| Asset | Source | Licence | Used in |
|---|---|---|---|
| (none yet, G1 is fully procedural) | | | |

## 10. Hand-off prompt (paste into any AI/platform with the repo)
"I have a Three.js + Vite highway racer (STAGES.md, Stages 1-4 done, Stage 5 ON HOLD) and a Godot 4 realism build in `godot/` (STAGES-GODOT.md).
Read STAGES-GODOT.md fully. Continue with stage G__ (first run G1's checklist if it is not marked verified).
Rules: Godot 4.3+ GDScript, Forward+ renderer, keep the conventions in section 5 (player moves -Z, metres, car contract, no class_name, preload constants).
Return full code for every changed or new file with its path, say exactly what to click/run to test it, and update STAGES-GODOT.md: mark what is done, what is verified, what changed, and what is next."

## 11. Change log
- G1 written: Godot project, atmosphere + quality tiers, procedural road/terrain/trees, procedural car, HUD + touch controls, arcade driving port, speed blur. Unverified.
