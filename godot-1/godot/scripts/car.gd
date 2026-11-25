extends Node3D
## Player car. Uses assets/cars/player.glb if present, otherwise a procedural sports car
## (lofted body, clearcoat paint, mirror glass, spoked wheels, emissive lights, real headlight spots).
## Same contract as the Three.js car: wheels[] spin on X, steerers[] turn on Y, tail material for brake lights.

const Mats = preload("res://scripts/mats.gd")

const GLB_PATH := "res://assets/cars/player.glb"
const GLB_ROT_Y := 0.0          # set PI if the model's nose points to +Z
const CAR_LENGTH := 4.4
const WHEEL_R := 0.34

var wheels: Array = []          # Node3D that spin around local X
var steerers: Array = []        # front wheel pivots, rotated on Y
var head_lights: Array = []     # SpotLight3D
var tail_mat: StandardMaterial3D
var head_mat: StandardMaterial3D
var paint: StandardMaterial3D

func build(color: Color) -> void:
	for c in get_children():
		remove_child(c)
		c.queue_free()
	wheels.clear()
	steerers.clear()
	head_lights.clear()
	tail_mat = null
	head_mat = null
	paint = Mats.car_paint(color)
	if _try_glb(color):
		return
	_build_procedural()

# ------------------------------------------------------------------ runtime control

func steer_wheels(v: float) -> void:
	for s in steerers:
		(s as Node3D).rotation.y = -v * 0.45

func spin(dist: float) -> void:
	for w in wheels:
		var n := w as Node3D
		n.rotation.x = fposmod(n.rotation.x - dist / WHEEL_R, TAU)

func set_brake(on: bool) -> void:
	if tail_mat:
		tail_mat.emission_energy_multiplier = 4.5 if on else 0.9

func set_lights(k: float) -> void:
	for l in head_lights:
		(l as SpotLight3D).light_energy = 18.0 * k
	if head_mat:
		head_mat.emission_energy_multiplier = 1.5 + 5.0 * k

# ------------------------------------------------------------------ GLB path

func _try_glb(color: Color) -> bool:
	if not ResourceLoader.exists(GLB_PATH):
		return false
	var res = load(GLB_PATH)
	if not (res is PackedScene):
		return false
	var root := (res as PackedScene).instantiate() as Node3D
	if root == null:
		return false
	root.rotation.y = GLB_ROT_Y
	var boxes: Array = []
	_collect_aabbs(root, Transform3D.IDENTITY, boxes)
	if boxes.is_empty():
		root.queue_free()
		return false
	var bb: AABB = boxes[0]
	for i in range(1, boxes.size()):
		bb = bb.merge(boxes[i])
	var sc := CAR_LENGTH / maxf(bb.size.z, 0.001)
	root.scale = Vector3.ONE * sc
	root.position = Vector3(-(bb.position.x + bb.size.x * 0.5) * sc, -bb.position.y * sc, -(bb.position.z + bb.size.z * 0.5) * sc)
	add_child(root)
	_walk_glb(root, color)
	return true

func _collect_aabbs(n: Node, parent_xf: Transform3D, out: Array) -> void:
	var xf := parent_xf
	if n is Node3D:
		xf = parent_xf * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		out.append(xf * (n as MeshInstance3D).get_aabb())
	for c in n.get_children():
		_collect_aabbs(c, xf, out)

func _walk_glb(n: Node, color: Color) -> void:
	var nm := String(n.name).to_lower()
	if n is Node3D and (nm.contains("wheel") or nm.contains("tyre") or nm.contains("tire")):
		wheels.append(n)
		return
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		if mi.mesh != null:
			for i in mi.mesh.get_surface_count():
				var m := mi.mesh.surface_get_material(i)
				if m is BaseMaterial3D:
					var mn := m.resource_name.to_lower()
					if mn.contains("body") or mn.contains("paint"):
						var dup := (m as BaseMaterial3D).duplicate() as BaseMaterial3D
						dup.albedo_color = color
						mi.set_surface_override_material(i, dup)
	for c in n.get_children():
		_walk_glb(c, color)

# ------------------------------------------------------------------ procedural car

func _mi(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, rot_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	parent.add_child(mi)
	return mi

func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b

func _build_procedural() -> void:
	var glass := Mats.glass()
	var plastic := Mats.plain(Color(0.05, 0.05, 0.055), 0.6)
	head_mat = Mats.emissive(Color(1.0, 0.96, 0.85), 1.5)
	tail_mat = Mats.emissive(Color(1.0, 0.05, 0.03), 0.9)

	# lower body: stations are [z, width, y_bottom, y_top], front (-Z) to rear (+Z)
	var body := _loft([
		[-2.20, 1.30, 0.38, 0.55],
		[-2.05, 1.62, 0.30, 0.62],
		[-1.60, 1.84, 0.28, 0.78],
		[-0.80, 1.88, 0.28, 0.86],
		[0.60, 1.90, 0.28, 0.90],
		[1.60, 1.88, 0.28, 0.92],
		[2.05, 1.74, 0.30, 0.88],
		[2.20, 1.50, 0.38, 0.78],
	], 20, 4.0)
	_mi(self, body, paint, Vector3.ZERO)

	# cabin (tinted glass) + painted roof
	var cabin := _loft([
		[-0.70, 1.40, 0.88, 0.90],
		[-0.30, 1.50, 0.88, 1.18],
		[0.10, 1.48, 0.88, 1.30],
		[0.90, 1.46, 0.88, 1.28],
		[1.50, 1.50, 0.88, 0.98],
		[1.70, 1.52, 0.88, 0.90],
	], 16, 3.0)
	_mi(self, cabin, glass, Vector3.ZERO)
	_mi(self, _box(Vector3(1.05, 0.03, 1.2)), paint, Vector3(0.0, 1.29, 0.5))

	# splitter, diffuser, spoiler
	_mi(self, _box(Vector3(1.75, 0.05, 0.35)), plastic, Vector3(0.0, 0.29, -2.0))
	_mi(self, _box(Vector3(1.5, 0.08, 0.3)), plastic, Vector3(0.0, 0.3, 2.1))
	_mi(self, _box(Vector3(1.55, 0.04, 0.34)), paint, Vector3(0.0, 1.13, 1.95))
	for sx in [-0.6, 0.6]:
		_mi(self, _box(Vector3(0.05, 0.22, 0.1)), plastic, Vector3(sx, 1.0, 1.9))

	# lights: emissive boxes sit just proud of the nose / tail caps, plus real spotlights
	for sx in [-0.42, 0.42]:
		_mi(self, _box(Vector3(0.3, 0.1, 0.05)), head_mat, Vector3(sx, 0.465, -2.215))
		var sp := SpotLight3D.new()
		sp.position = Vector3(sx, 0.55, -2.25)
		sp.rotation_degrees = Vector3(-3.0, 0.0, 0.0)
		sp.spot_range = 90.0
		sp.spot_angle = 28.0
		sp.light_energy = 0.0
		add_child(sp)
		head_lights.append(sp)
	for sx in [-0.5, 0.5]:
		_mi(self, _box(Vector3(0.36, 0.1, 0.05)), tail_mat, Vector3(sx, 0.62, 2.215))

	# exhausts
	var ex := CylinderMesh.new()
	ex.top_radius = 0.05
	ex.bottom_radius = 0.05
	ex.height = 0.2
	for sx in [-0.4, 0.4]:
		_mi(self, ex, Mats.metal(Color(0.7, 0.7, 0.72), 0.25), Vector3(sx, 0.36, 2.2), Vector3(90.0, 0.0, 0.0))

	# wheels
	for z in [-1.35, 1.4]:
		for sx in [-1.0, 1.0]:
			_add_wheel(Vector3(sx * 0.86, WHEEL_R, z), sx, z < 0.0)

func _add_wheel(pos: Vector3, side: float, front: bool) -> void:
	var pivot := Node3D.new()
	pivot.position = pos
	add_child(pivot)
	if front:
		steerers.append(pivot)
	var spin_node := Node3D.new()
	pivot.add_child(spin_node)
	wheels.append(spin_node)

	var tyre := CylinderMesh.new()
	tyre.top_radius = WHEEL_R
	tyre.bottom_radius = WHEEL_R
	tyre.height = 0.26
	tyre.radial_segments = 28
	_mi(spin_node, tyre, Mats.tyre(), Vector3.ZERO, Vector3(0.0, 0.0, 90.0))
	var rim := CylinderMesh.new()
	rim.top_radius = 0.22
	rim.bottom_radius = 0.22
	rim.height = 0.27
	rim.radial_segments = 24
	var rim_mat := Mats.rim()
	_mi(spin_node, rim, rim_mat, Vector3.ZERO, Vector3(0.0, 0.0, 90.0))
	var spoke := _box(Vector3(0.02, 0.4, 0.05))
	for k in 5:
		_mi(spin_node, spoke, rim_mat, Vector3(side * 0.135, 0.0, 0.0), Vector3(float(k) * 36.0, 0.0, 0.0))

## Loft a closed body through cross-sections (super-ellipse). stations: [z, width, y_bottom, y_top].
func _loft(stations: Array, segs: int, n: float) -> ArrayMesh:
	var rings: Array = []
	for s in stations:
		var z: float = s[0]
		var w: float = s[1]
		var yb: float = s[2]
		var yt: float = s[3]
		var cy := (yb + yt) * 0.5
		var hy := (yt - yb) * 0.5
		var ring: Array = []
		for i in segs:
			var t := TAU * float(i) / float(segs)
			var c := cos(t)
			var sn := sin(t)
			ring.append(Vector3(w * 0.5 * signf(c) * pow(absf(c), 2.0 / n), cy + hy * signf(sn) * pow(absf(sn), 2.0 / n), z))
		rings.append(ring)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in rings.size() - 1:
		var a: Array = rings[r]
		var b: Array = rings[r + 1]
		var cen := _centroid(a)
		for i in segs:
			var j := (i + 1) % segs
			var out: Vector3 = (a[i] as Vector3) - cen
			out.z = 0.0
			_emit(st, a[i], b[j], a[j], out)
			_emit(st, a[i], b[i], b[j], out)
	# end caps
	var first: Array = rings[0]
	var last: Array = rings[rings.size() - 1]
	var c0 := _centroid(first)
	var c1 := _centroid(last)
	for i in segs:
		var j := (i + 1) % segs
		_emit(st, c0, first[i], first[j], Vector3(0.0, 0.0, -1.0))
		_emit(st, c1, last[i], last[j], Vector3(0.0, 0.0, 1.0))
	st.generate_normals()
	return st.commit()

func _centroid(ring: Array) -> Vector3:
	var s := Vector3.ZERO
	for p in ring:
		s += p
	return s / float(ring.size())

## Emit a triangle whose front face (Godot = clockwise from the front) looks along `outward`.
func _emit(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, outward: Vector3) -> void:
	var n := (b - a).cross(c - a)
	if n.dot(outward) > 0.0:
		st.add_vertex(a)
		st.add_vertex(c)
		st.add_vertex(b)
	else:
		st.add_vertex(a)
		st.add_vertex(b)
		st.add_vertex(c)
