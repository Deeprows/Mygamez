extends Control
## HUD + multi-touch controls, laid out like the reference screenshot:
## X (top-left), KMH panel (top-centre), ? (top-right), R (left), steering wheel + L/R slider (bottom-left),
## brake + gas pedals (bottom-right). Extra: N2O button, T (time of day), Q (quality).
## Touch roles are tracked per finger so steering and pedals work at the same time.
## Mouse is emulated as touch on desktop (project setting), so you can test with the mouse too.

signal action(what: String)   # "exit" | "restart" | "help" | "tod" | "quality"

const ORANGE := Color(1.0, 0.62, 0.1)
const DARK := Color(0.07, 0.07, 0.08, 0.88)
const STEEL := Color(0.30, 0.31, 0.34, 0.95)
const STEEL_ON := Color(0.55, 0.56, 0.6, 0.98)

var speed_kmh := 0.0
var steer_vis := 0.0
var nitro := 100.0
var nitro_locked := false
var quality_text := "HIGH"
var tod_text := "DAY"
var hint := ""
var show_help := false

# outputs read by main.gd
var steer_touch := 0.0
var gas := false
var brake := false
var nitro_btn := false

var _touches := {}   # finger index -> role

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _process(_dt: float) -> void:
	size = get_viewport_rect().size
	queue_redraw()

# ------------------------------------------------------------------ layout (reference is 600 px tall)
func _u() -> float:
	return maxf(size.y, 1.0) / 600.0
func _r_speed() -> Rect2:
	return Rect2(size.x * 0.5 - _u() * 100.0, 0.0, _u() * 200.0, _u() * 46.0)
func _r_exit() -> Rect2:
	return Rect2(_u() * 14.0, _u() * 14.0, _u() * 70.0, _u() * 70.0)
func _r_help() -> Rect2:
	return Rect2(size.x - _u() * 84.0, _u() * 14.0, _u() * 70.0, _u() * 70.0)
func _r_restart() -> Rect2:
	return Rect2(_u() * 14.0, _u() * 230.0, _u() * 70.0, _u() * 70.0)
func _r_tod() -> Rect2:
	return Rect2(size.x - _u() * 84.0, _u() * 96.0, _u() * 70.0, _u() * 46.0)
func _r_quality() -> Rect2:
	return Rect2(size.x - _u() * 84.0, _u() * 150.0, _u() * 70.0, _u() * 46.0)
func _r_gas() -> Rect2:
	return Rect2(size.x - _u() * 100.0, size.y - _u() * 150.0, _u() * 70.0, _u() * 125.0)
func _r_brake() -> Rect2:
	return Rect2(size.x - _u() * 270.0, size.y - _u() * 100.0, _u() * 140.0, _u() * 75.0)
func _r_nitro() -> Rect2:
	return Rect2(size.x - _u() * 270.0, size.y - _u() * 190.0, _u() * 140.0, _u() * 60.0)
func _r_wheel_zone() -> Rect2:
	return Rect2(0.0, size.y - _u() * 230.0, _u() * 430.0, _u() * 230.0)
func _wheel_center() -> Vector2:
	return Vector2(_u() * 170.0, size.y - _u() * 120.0)

func _role_at(p: Vector2) -> String:
	if _r_gas().grow(_u() * 18.0).has_point(p): return "gas"
	if _r_brake().grow(_u() * 18.0).has_point(p): return "brake"
	if _r_nitro().grow(_u() * 8.0).has_point(p): return "nitro"
	if _r_exit().has_point(p): return "exit"
	if _r_help().has_point(p): return "help"
	if _r_restart().has_point(p): return "restart"
	if _r_tod().has_point(p): return "tod"
	if _r_quality().has_point(p): return "quality"
	if _r_wheel_zone().has_point(p): return "wheel"
	return ""

func _steer_from(p: Vector2) -> float:
	return clampf((p.x - _wheel_center().x) / (_u() * 125.0), -1.0, 1.0)

# ------------------------------------------------------------------ input
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var e := event as InputEventScreenTouch
		if e.pressed:
			var role := _role_at(e.position)
			if role == "":
				pass
			elif role in ["exit", "restart", "help", "tod", "quality"]:
				action.emit(role)
			else:
				_touches[e.index] = role
				if role == "wheel":
					steer_touch = _steer_from(e.position)
		else:
			_touches.erase(e.index)
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if _touches.get(d.index, "") == "wheel":
			steer_touch = _steer_from(d.position)
	var roles: Array = _touches.values()
	gas = roles.has("gas")
	brake = roles.has("brake")
	nitro_btn = roles.has("nitro")
	if not roles.has("wheel"):
		steer_touch = 0.0

# ------------------------------------------------------------------ drawing
func _box(r: Rect2, bg: Color, border: Color = Color(0, 0, 0, 0), radius: float = 8.0, bw: float = 2.0) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(int(bw))
	sb.set_corner_radius_all(int(radius))
	draw_style_box(sb, r)

func _label(r: Rect2, text: String, col: Color, fsize: float, align: int = HORIZONTAL_ALIGNMENT_CENTER) -> void:
	var font := ThemeDB.fallback_font
	var fs := int(fsize)
	var h := font.get_ascent(fs) - font.get_descent(fs) * 0.0
	draw_string(font, Vector2(r.position.x, r.position.y + r.size.y * 0.5 + h * 0.36), text, align, r.size.x, fs, col)

func _button(r: Rect2, text: String, bg: Color, fg: Color, fsize: float) -> void:
	_box(r, bg, Color(0.0, 0.0, 0.0, 0.7), 10.0 * _u(), 3.0)
	_label(r, text, fg, fsize)

func _pedal(r: Rect2, pressed: bool) -> void:
	_box(r, STEEL_ON if pressed else STEEL, Color(0.1, 0.1, 0.1, 0.9), 6.0 * _u(), 3.0)
	var u := _u()
	for fx in [0.25, 0.75]:
		for fy in [0.25, 0.75]:
			draw_circle(r.position + Vector2(r.size.x * fx, r.size.y * fy), 4.0 * u, Color(0.12, 0.12, 0.13))

func _draw() -> void:
	var u := _u()
	var font := ThemeDB.fallback_font

	# speed panel
	var sp := _r_speed()
	_box(sp, DARK, Color(0.55, 0.55, 0.6, 0.9), 6.0 * u, 2.0)
	draw_string(font, Vector2(sp.position.x + 14.0 * u, sp.position.y + 32.0 * u), "KMH", HORIZONTAL_ALIGNMENT_LEFT, -1, int(22.0 * u), ORANGE)
	draw_string(font, Vector2(sp.position.x, sp.position.y + 34.0 * u), str(int(round(speed_kmh))), HORIZONTAL_ALIGNMENT_RIGHT, sp.size.x - 14.0 * u, int(30.0 * u), Color.WHITE)

	# corner buttons
	_button(_r_exit(), "X", Color(0.8, 0.1, 0.1, 0.95), Color(0.1, 0.0, 0.0), 40.0 * u)
	_button(_r_help(), "?", Color(1.0, 0.62, 0.1, 0.95), Color(0.1, 0.05, 0.0), 40.0 * u)
	_button(_r_restart(), "R", Color(1.0, 0.62, 0.1, 0.95), Color(0.1, 0.05, 0.0), 40.0 * u)
	_button(_r_tod(), tod_text, DARK, ORANGE, 16.0 * u)
	_button(_r_quality(), quality_text, DARK, ORANGE, 16.0 * u)

	# steering wheel + L/R slider
	var c := _wheel_center()
	var rad := 72.0 * u
	draw_set_transform(c, steer_vis * 1.6, Vector2.ONE)
	draw_arc(Vector2.ZERO, rad, 0.0, TAU, 48, Color(0.1, 0.1, 0.11, 0.92), 14.0 * u, true)
	draw_arc(Vector2.ZERO, rad, 0.0, TAU, 48, Color(0.42, 0.43, 0.47, 0.95), 3.0 * u, true)
	draw_line(Vector2(-rad, 0.0), Vector2(rad, 0.0), Color(0.15, 0.15, 0.16, 0.92), 10.0 * u)
	draw_line(Vector2(0.0, 0.0), Vector2(0.0, rad), Color(0.15, 0.15, 0.16, 0.92), 10.0 * u)
	draw_circle(Vector2.ZERO, 14.0 * u, Color(0.25, 0.26, 0.29, 0.95))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var track := Rect2(c.x - 140.0 * u, c.y + 36.0 * u, 280.0 * u, 34.0 * u)
	_box(track, DARK, Color(0.5, 0.5, 0.55, 0.8), 4.0 * u, 2.0)
	draw_string(font, track.position + Vector2(8.0 * u, 26.0 * u), "L", HORIZONTAL_ALIGNMENT_LEFT, -1, int(22.0 * u), Color.WHITE)
	draw_string(font, Vector2(track.position.x, track.position.y + 26.0 * u), "R", HORIZONTAL_ALIGNMENT_RIGHT, track.size.x - 8.0 * u, int(22.0 * u), Color.WHITE)
	var kx := c.x + steer_vis * 125.0 * u
	_box(Rect2(kx - 22.0 * u, track.position.y + 4.0 * u, 44.0 * u, track.size.y - 8.0 * u), STEEL_ON, Color(0.1, 0.1, 0.1), 3.0 * u, 2.0)

	# pedals + nitro
	_pedal(_r_brake(), brake)
	_pedal(_r_gas(), gas)
	var nr := _r_nitro()
	var can_boost := not nitro_locked and nitro > 0.0
	_button(nr, "N2O", Color(1.0, 0.62, 0.1, 0.95) if can_boost else Color(0.35, 0.3, 0.2, 0.9), Color(0.1, 0.05, 0.0), 22.0 * u)
	_box(Rect2(nr.position.x, nr.position.y + nr.size.y + 4.0 * u, nr.size.x * clampf(nitro / 100.0, 0.0, 1.0), 6.0 * u), Color(0.3, 0.8, 1.0, 0.95), Color(0, 0, 0, 0), 2.0, 0.0)

	if hint != "":
		draw_string(font, Vector2(0.0, size.y * 0.42), hint, HORIZONTAL_ALIGNMENT_CENTER, size.x, int(26.0 * u), Color(1, 1, 1, 0.9))

	if show_help:
		var pr := Rect2(size.x * 0.5 - 250.0 * u, 80.0 * u, 500.0 * u, 300.0 * u)
		_box(pr, Color(0.03, 0.03, 0.04, 0.9), ORANGE, 10.0 * u, 2.0)
		var lines := [
			"CONTROLS",
			"W / Up  or  right pedal  - gas",
			"S / Down / Space  or  left pedal  - brake",
			"A D / Left Right  or  drag the wheel area  - steer",
			"Hold brake + steer hard at speed  - drift",
			"Shift / E  or  N2O button  - nitro",
			"T time of day   Q quality   R restart   Esc quit",
			"Place a car at assets/cars/player.glb",
		]
		for i in lines.size():
			draw_string(font, pr.position + Vector2(18.0 * u, (38.0 + float(i) * 34.0) * u), lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, int(20.0 * u), ORANGE if i == 0 else Color.WHITE)
