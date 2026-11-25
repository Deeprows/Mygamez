# Highway Racer Realistic (Godot 4)

Realistic 3D version of Highway Racer 3D. Plan and status: `../STAGES-GODOT.md`.

## Run
1. Install Godot 4.3+ (standard build, not .NET): https://godotengine.org/download
2. Open `project.godot`, press F5. Terminal: `godot --path .`
3. Syntax check without a window: `godot --headless --path . --quit-after 60`

## Controls
W/Up gas, S/Down/Space brake, A D / arrows steer, Shift/E nitro, T time of day, Q quality, R restart, H help, Esc quit.
Touch: drag in the bottom-left to steer, right pedals for gas/brake, N2O button. On desktop the mouse acts as touch.

## Quality
Q cycles LOW / MED / HIGH. HIGH needs the Forward+ renderer (desktop GPU). Phones use the Mobile renderer
(automatic via project settings) which skips SSR / SSAO / volumetric fog.

## Add a real car
Put `player.glb` in `assets/cars/` (see the README there).
