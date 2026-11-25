# STAGES-GODOT — Highway Racer: Realistic (Godot 4) track

Portable hand-off file. Copy it with the repo (or alone) into any AI chat / platform and say "continue from the next stage".
`STAGES.md` documents the original Three.js implementation (Stages 1-4) and is retained only as a feature/reference record during migration. This Godot plan is the active plan for the existing Highway Racer 3D game.

## 0. Where we are (read this first)
- Existing game: **Highway Racer 3D**. Its original Three.js + Vite implementation (Stages 1-4) is documented in `STAGES.md`; use it as the source of existing features and behaviour to port.
- **Migration target: Godot 4 (GDScript).** Godot replaces Three.js as the game engine and becomes the only maintained game implementation. Do not create a separate Godot game or keep Three.js as a parallel/lite game.
- The Godot project currently lives at `godot-1/godot/` in this repository. The G1-G8 stages below describe migration and upgrade of the existing Highway Racer 3D game.
- **G1 is written but has never been run** (it was authored in an environment with no Godot and no internet). First job: open the project, run it, fix what the Output panel reports, and complete the G1 acceptance checklist in section 6 before moving on.
- Stage 5 from the old Three.js plan is superseded by the Godot migration plan. Its useful product requirements should be carried into the Godot implementation where applicable; do not resume the old Three.js PWA/Capacitor build.

## 1. Look targets
- Reference A (orange sports car, drifting, desert track): realistic sun, long shadows, tyre smoke, kerbs, palm/rock backdrop, sharp reflections on the paint, atmospheric haze, mountains.
- Reference B (blue car, KMH HUD): chase camera, tarmac with real grain, red/white kerbs, guardrails, dense trees, **HUD = X (top-left), KMH panel (top-centre), ? (top-right), R (left), steering wheel with L/R slider (bottom-left), brake + gas pedals (bottom-right)**.
- Quality bar: "looks like a 2015+ mobile racing game on desktop, and a trimmed version of that on a mid phone".

## 2. Decisions (and why)
| Decision | Reason |
|---|---|
| Engine: **Godot 4.3+**, GDScript | Free, PBR, SSR/SSAO/volumetric fog, soft shadows, glTF native, exports to Windows/Linux/macOS/Android |
| Renderer: **Forward+** for development/desktop; **Mobile** renderer for phones | Realism features (SSR, SSAO, SSIL, SDFGI, volumetric fog) are Forward+ only. Mobile keeps PBR, shadows, glow, fog |
| **Godot replaces the Three.js runtime** | Do not retain Three.js as a second/lite game. Godot export targets, including whether a web build can meet the required visual/performance quality, must be validated during G8; do not claim web support until an actual export is tested |
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
| Legacy Stage 5 | Old Three.js PWA / Capacitor ship work | **SUPERSEDED** by Godot migration |

## 4. Repo layout
```
STAGES.md            historical Three.js feature/reference record for porting
STAGES-GODOT.md      active Godot migration and upgrade plan
godot-1/godot/
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
1. Install Godot **4.3 or newer** (standard build). Open `godot-1/godot/project.godot`, press F5. (Terminal: `godot --path godot-1/godot`.)
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

## 8. Shipping requirements — Godot game only
The old Three.js Stage 5 PWA/Capacitor instructions are historical and are not the shipping plan for this migration. The existing game is being replaced by the Godot implementation; do not build or maintain a separate Three.js lite version.

- Carry forward applicable player-facing requirements from the old Stage 5, including fullscreen/landscape behaviour, pause, leaderboard and score sharing, in the Godot game where supported.
- G8 is responsible for validating performance and preparing the required Godot exports. The Godot web export uses the Compatibility renderer and may not support the Forward+ visual effects described in this plan. Test the actual export and its quality before deciding whether it can replace the current GitHub Pages game.
- Until a Godot export has been built and tested successfully, the existing Pages deployment must not be described as running the Godot game. Do not remove the existing working deployment prematurely.
- Final delivery target is one Highway Racer 3D game powered by Godot. The exact export/deployment arrangement must be based on tested Godot builds, not assumptions.

## 9. Asset sourcing and licences (fill in as assets are added)
Prefer CC0. Always keep a line here per asset: name, source URL, licence, author, where used.
- Textures / HDRIs / models: ambientCG (CC0), Poly Haven (CC0)
- Low-poly vehicles and nature kits: Kenney (CC0), Quaternius (CC0)
- Realistic cars: Sketchfab (licence differs per model: check CC0 vs CC-BY and credit when required)
| Asset | Source | Licence | Used in |
|---|---|---|---|
| (none yet, G1 is fully procedural) | | | |

## 10. Hand-off prompt (paste into any AI/platform with the repo)
"I am migrating the existing Highway Racer 3D game from Three.js to Godot 4. The Three.js files and STAGES.md are historical feature/reference material for porting; Godot is to become the sole game implementation, not a separate game or parallel lite version. The Godot project is in `godot-1/godot/`; the active plan is `godot-1/STAGES-GODOT.md`.
Read STAGES-GODOT.md fully. Continue with stage G__ (first run G1's checklist if it is not marked verified).
Rules: Godot 4.3+ GDScript, follow the renderer/export decisions and conventions in this file, and preserve existing game features by using STAGES.md and the original source as references. Do not invent unrelated features.
Return full code for every changed or new file with its path, say exactly what to click/run to test it, and update STAGES-GODOT.md: mark what is done, what is verified, what changed, and what is next."

## 11. Change log
- G1 written: Godot project, atmosphere + quality tiers, procedural road/terrain/trees, procedural car, HUD + touch controls, arcade driving port, speed blur. Unverified.
- Migration direction clarified: Godot is to replace the Three.js runtime for the existing Highway Racer 3D game; Three.js documentation/source is retained only as a porting reference.
