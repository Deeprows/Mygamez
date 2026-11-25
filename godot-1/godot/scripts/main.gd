extends Node3D
## Highway Racer 3D - Godot realism build. Stage G1: renderer, lighting, road/terrain, car, HUD, driving.
## Driving model is a direct port of driveFrame() from the Three.js build (src/main.js).
## Keys: W/Up gas, S/Down/Space brake, A/D or arrows steer, Shift/E nitro, T time of day, Q quality, R restart, H help, Esc quit.

const Cfg = preload("res://scripts/cfg.gd")
const Tod = preload("res://scripts/tod.gd")
const AtmoScript = preload("res://scripts/atmosphere.gd")
const RoadScript = preload("res://scripts/road.gd")
const CarScript = preload("res://scripts/car.gd")
const HudScript = preload("res://scripts/hud.gd")
const FxScript = preload("res://scripts/post_fx.gd")

const TOP := 62.0           # max speed m/s (~223 km/h), same as the Striker in cars.js
const ACC := 1.0            # acceleration multiplier
const HND := 1.0            # steering multiplier
const CAR_COLOR := Color(1.0, 0.42, 0.04)
const SETTINGS := "user://settings.cfg"

var atmo
var road
var car
var cam: Camera3D
var hud
var fx

var quality := 2
var tod_i := 0

# player state
var px := 0.0
var pz := 0.0
var speed := 0.0
var psi := 0.0
var slip := 0.0
var steer := 0.0
var nitro := 100.0
var nitro_lock := false
var nk := 0.0
var pitch := 0.0
var roll := 0.0
var accel := 0.0
var drifting := false
var braking := false
var ctl_gas := false
var ctl_brake := false
var ctl_nitro := false
var cam_pos := Vector3.ZERO

func _ready() -> void:
	_setup_input()
	_load_settings()

	atmo = AtmoScript.new()
	add_child(atmo)
	road = RoadScript.new()
	add_child(road)
	car = CarScript.new()
	add_child(car)
	car.build(CAR_COLOR)

	cam = Camera3D.new()
	cam.fov = 60.0
	cam.near = 0.2
	cam.far = 1800.0
	add_child(cam)
	cam.make_current()

	fx = FxScript.new()
	add_child(fx)
	var hl := CanvasLayer.new()
	hl.layer = 2
	add_child(hl)
	hud = HudScript.new()
	hl.add_child(hud)
	hud.action.connect(_on_action)

	_set_quality(quality)
	_set_tod(tod_i)
	_reset()

func _setup_input() -> void:
	_add_action("accelerate", [KEY_W, KEY_UP])
	_add_action("brake", [KEY_S, KEY_DOWN, KEY_SPACE])
	_add_action("steer_left", [KEY_A, KEY_LEFT])
	_add_action("steer_right", [KEY_D, KEY_RIGHT])
	_add_action("nitro", [KEY_SHIFT, KEY_E])
	_add_action("tod", [KEY_T])
	_add_action("quality", [KEY_Q])
	_add_action("restart", [KEY_R])
	_add_action("help", [KEY_H, KEY_F1])
	_add_action("exit", [KEY_ESCAPE])

func _add_action(act: String, keys: Array) -> void:
	if not InputMap.has_action(act):
		InputMap.add_action(act)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k as Key
		InputMap.action_add_event(act, ev)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		for a in ["tod", "quality", "restart", "help", "exit"]:
			if event.is_action_pressed(a):
				_on_action(a)

func _on_action(what: String) -> void:
	match what:
		"exit": get_tree().quit()
		"restart": _reset()
		"help": hud.show_help = not hud.show_help
		"tod": _set_tod(tod_i + 1)
		"quality": _set_quality((quality + 1) % 3)

# ------------------------------------------------------------------ settings
func _load_settings() -> void:
	quality = 1 if OS.has_feature("mobile") else 2
	var cf := ConfigFile.new()
	if cf.load(SETTINGS) == OK:
		quality = clampi(int(cf.get_value("g", "quality", quality)), 0, 2)
		tod_i = clampi(int(cf.get_value("g", "tod", 0)), 0, Tod.NAMES.size() - 1)

func _save_settings() -> void:
	var cf := ConfigFile.new()
	cf.set_value("g", "quality", quality)
	cf.set_value("g", "tod", tod_i)
	cf.save(SETTINGS)

func _set_quality(q: int) -> void:
	quality = q
	atmo.apply_quality(q)
	fx.set_enabled(q >= 1)
	hud.quality_text = ["LOW", "MED", "HIGH"][q]
	_save_settings()

func _set_tod(i: int) -> void:
	tod_i = posmod(i, Tod.NAMES.size())
	var p: Dictionary = atmo.apply_tod(Tod.NAMES[tod_i])
	road.set_lamps(float(p["lamps"]))
	car.set_lights(float(p["headlights"]))
	hud.tod_text = String(Tod.NAMES[tod_i]).to_upper()
	_save_settings()

func _reset() -> void:
	px = Cfg.lane_x(1)
	pz = 0.0
	speed = 0.0
	psi = 0.0
	slip = 0.0
	steer = 0.0
	nitro = 100.0
	nitro_lock = false
	nk = 0.0
	cam_pos = Vector3(px * 0.6, 3.1, pz + 7.2)

# ------------------------------------------------------------------ loop
func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	_read_controls(dt)
	_drive(dt)
	_apply_visuals(dt)
	road.update(pz)
	_update_camera(dt)
	_update_hud()

func _read_controls(dt: float) -> void:
	var kb := Input.get_axis("steer_left", "steer_right")
	var target: float = kb if absf(kb) > 0.01 else float(hud.steer_touch)
	steer += (target - steer) * minf(1.0, 9.0 * dt)
	ctl_gas = Input.is_action_pressed("accelerate") or bool(hud.gas)
	ctl_brake = Input.is_action_pressed("brake") or bool(hud.brake)
	ctl_nitro = Input.is_action_pressed("nitro") or bool(hud.nitro_btn)

func _drive(dt: float) -> void:
	drifting = ctl_brake and absf(steer) > 0.45 and speed > 22.0
	braking = ctl_brake

	# nitro
	var nitro_on := ctl_nitro and nitro > 0.0 and not nitro_lock
	if nitro_on:
		nitro -= 38.0 * dt
		if nitro <= 0.0:
			nitro = 0.0
			nitro_lock = true
			nitro_on = false
	else:
		nitro = minf(100.0, nitro + 5.0 * dt)
		if nitro_lock and nitro >= 30.0:
			nitro_lock = false
	if drifting:
		nitro = minf(100.0, nitro + 8.0 * dt)
	nk += ((1.0 if nitro_on else 0.0) - nk) * minf(1.0, 6.0 * dt)

	# longitudinal
	var a := 0.0
	if ctl_gas:
		a += ACC * (9.0 * (1.0 - speed / (TOP + 8.0)) + 3.5)
	if nitro_on:
		a += 15.0
	if ctl_brake:
		a -= (9.0 if drifting else 32.0)
	a -= 2.2 + speed * speed * 0.0006
	if not nitro_on and speed > TOP + 2.0:
		a -= (speed - TOP - 2.0) * 2.5
	speed = clampf(speed + a * dt, 0.0, TOP + 12.0)
	accel = a

	# heading-based steering (+ = right = +X)
	var psi_max := (0.42 * HND) / (1.0 + speed / 24.0) * (1.6 if drifting else 1.0)
	var psi_t := steer * psi_max * clampf(speed / 6.0, 0.0, 1.0)
	psi += (psi_t - psi) * minf(1.0, (3.5 if drifting else 6.0) * dt)
	slip += ((steer * 0.5 if drifting else 0.0) - slip) * minf(1.0, 5.0 * dt)

	px += speed * sin(psi) * dt
	if absf(px) > Cfg.PLAYER_BOUND:
		px = signf(px) * Cfg.PLAYER_BOUND
		if signf(psi) == signf(px):
			psi = 0.0
			slip = 0.0
		if speed > 8.0:
			speed *= 1.0 - 0.9 * dt
	pz -= speed * cos(psi) * dt

func _apply_visuals(dt: float) -> void:
	pitch += (clampf(accel * 0.0016, -0.05, 0.05) - pitch) * minf(1.0, 6.0 * dt)
	var roll_t := steer * 0.04 * clampf(speed / 40.0, 0.0, 1.0)
	roll += (roll_t - roll) * minf(1.0, 6.0 * dt)
	car.position = Vector3(px, 0.0, pz)
	car.basis = Basis(Vector3.UP, -(psi + slip)) * Basis(Vector3.RIGHT, pitch) * Basis(Vector3.BACK, roll)
	car.steer_wheels(steer)
	car.spin(speed * dt)
	car.set_brake(braking and speed > 1.0)

func _update_camera(dt: float) -> void:
	var k := 1.0 - exp(-6.0 * dt)
	cam_pos.x += (px * 0.6 - cam_pos.x) * k
	cam_pos.y += (3.1 + speed * 0.008 - cam_pos.y) * k
	cam_pos.z = pz + 7.2 + speed * 0.02 + nk * 0.8
	cam.position = cam_pos
	cam.look_at(Vector3(px * 0.85, 1.1, pz - 28.0), Vector3.UP)
	cam.fov = 60.0 + clampf(speed / TOP, 0.0, 1.2) * 9.0 + nk * 6.0
	fx.set_strength(clampf((speed - 28.0) / 45.0, 0.0, 1.0) * 0.45 + nk * 0.5)

func _update_hud() -> void:
	hud.speed_kmh = speed * 3.6
	hud.steer_vis = steer
	hud.nitro = nitro
	hud.nitro_locked = nitro_lock
	hud.hint = "PRESS W  /  HOLD THE GAS PEDAL" if speed < 1.0 else ""
