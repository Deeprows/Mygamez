extends Node3D
## Endless recycled road: asphalt, markings, kerbs, guardrails, lamps, rolling hills + mountains, trees.
## Segments are SEG_LEN long and jump forward when they are far behind the player (same idea as world.js).

const Cfg = preload("res://scripts/cfg.gd")
const Mats = preload("res://scripts/mats.gd")

## Ground columns: distance (m) from the road edge. Finer near the road, coarse far away.
const GROUND_COLS := [0.0, 3.0, 8.0, 16.0, 28.0, 45.0, 70.0, 100.0, 150.0, 220.0, 320.0, 450.0, 600.0]
const GROUND_ROWS := 10
const TREES_PER_SIDE := 9
const RAIL_X := 8.7
const LAMP_X := 9.0

class Seg:
	var node: Node3D
	var ground: Array = []        # [left MeshInstance3D, right MeshInstance3D]
	var trunks: MultiMeshInstance3D
	var leaves: MultiMeshInstance3D

var segs: Array = []
var front_z := 0.0
var noise_hills := FastNoiseLite.new()
var noise_mtn := FastNoiseLite.new()

var m_asphalt: StandardMaterial3D
var m_grass: StandardMaterial3D
var m_white: StandardMaterial3D
var m_kerb: StandardMaterial3D
var m_rail: StandardMaterial3D
var m_pole: StandardMaterial3D
var m_lamp: StandardMaterial3D
var m_leaf: StandardMaterial3D
var m_trunk: StandardMaterial3D

var road_mesh: PlaneMesh
var edge_mesh: PlaneMesh
var kerb_mesh: PlaneMesh
var rail_mesh: BoxMesh
var tree_trunk_mesh: Mesh
var tree_leaf_mesh: Mesh
var mm_dashes: MultiMesh
var mm_posts: MultiMesh
var mm_poles: MultiMesh
var mm_lamps: MultiMesh

func _ready() -> void:
	noise_hills.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise_hills.frequency = 0.006
	noise_hills.fractal_octaves = 3
	noise_hills.seed = 7
	noise_mtn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise_mtn.frequency = 0.0025
	noise_mtn.fractal_octaves = 4
	noise_mtn.seed = 19

	_make_materials()
	_make_shared_meshes()
	for i in Cfg.SEG_COUNT:
		var zc := Cfg.SEG_LEN - float(i) * Cfg.SEG_LEN   # first segment centred 60 m behind the start
		segs.append(_make_segment(zc))
		front_z = zc

func _make_materials() -> void:
	m_asphalt = Mats.asphalt()
	m_grass = Mats.grass()
	m_white = Mats.paint_line(Color(0.92, 0.92, 0.9))
	m_kerb = Mats.kerb()
	m_rail = Mats.metal(Color(0.62, 0.64, 0.67), 0.42)
	m_pole = Mats.metal(Color(0.45, 0.47, 0.5), 0.5)
	m_lamp = Mats.emissive(Color(1.0, 0.86, 0.6), 0.0)
	m_leaf = Mats.leaves()
	m_trunk = Mats.trunk()

func _make_shared_meshes() -> void:
	road_mesh = PlaneMesh.new()
	road_mesh.size = Vector2(Cfg.TOTAL_W, Cfg.SEG_LEN)
	edge_mesh = PlaneMesh.new()
	edge_mesh.size = Vector2(0.2, Cfg.SEG_LEN)
	kerb_mesh = PlaneMesh.new()
	kerb_mesh.size = Vector2(0.6, Cfg.SEG_LEN)
	rail_mesh = BoxMesh.new()
	rail_mesh.size = Vector3(0.08, 0.3, Cfg.SEG_LEN)

	# dashed lane dividers: 3 dividers x 5 dashes (12 m period divides 60 m, so it is seamless)
	var dash := PlaneMesh.new()
	dash.size = Vector2(0.15, 3.0)
	var dx: Array = []
	for x in [-Cfg.LANE_W, 0.0, Cfg.LANE_W]:
		for k in 5:
			dx.append(Transform3D(Basis.IDENTITY, Vector3(x, 0.012, -27.0 + float(k) * 12.0)))
	mm_dashes = _mm(dash, dx)

	# guardrail posts every 4 m on both sides
	var post := BoxMesh.new()
	post.size = Vector3(0.1, 0.8, 0.1)
	var px: Array = []
	for side in [-1.0, 1.0]:
		for k in 15:
			px.append(Transform3D(Basis.IDENTITY, Vector3(side * RAIL_X, 0.4, -28.0 + float(k) * 4.0)))
	mm_posts = _mm(post, px)

	# lamps: pole + arm merged into one mesh (arm points toward the road), emissive head separate
	var pole := CylinderMesh.new()
	pole.top_radius = 0.07
	pole.bottom_radius = 0.1
	pole.height = 9.0
	var arm := BoxMesh.new()
	arm.size = Vector3(1.7, 0.08, 0.08)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.append_from(pole, 0, Transform3D(Basis.IDENTITY, Vector3(0.0, 4.5, 0.0)))
	st.append_from(arm, 0, Transform3D(Basis.IDENTITY, Vector3(-0.85, 9.0, 0.0)))
	var pole_mesh := st.commit()
	var head := BoxMesh.new()
	head.size = Vector3(1.1, 0.12, 0.35)
	var left_basis := Basis(Vector3.UP, PI)
	var pxs: Array = [
		Transform3D(Basis.IDENTITY, Vector3(LAMP_X, 0.0, 0.0)),
		Transform3D(left_basis, Vector3(-LAMP_X, 0.0, 0.0)),
	]
	var hxs: Array = [
		Transform3D(Basis.IDENTITY, Vector3(LAMP_X - 1.5, 8.95, 0.0)),
		Transform3D(Basis.IDENTITY, Vector3(-LAMP_X + 1.5, 8.95, 0.0)),
	]
	mm_poles = _mm(pole_mesh, pxs)
	mm_lamps = _mm(head, hxs)

	# trees: 3 stacked cones + trunk
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.12
	trunk.bottom_radius = 0.2
	trunk.height = 2.2
	trunk.radial_segments = 8
	trunk.rings = 1
	var tst := SurfaceTool.new()
	tst.begin(Mesh.PRIMITIVE_TRIANGLES)
	tst.append_from(trunk, 0, Transform3D(Basis.IDENTITY, Vector3(0.0, 1.1, 0.0)))
	tree_trunk_mesh = tst.commit()
	var lst := SurfaceTool.new()
	lst.begin(Mesh.PRIMITIVE_TRIANGLES)
	var radii := [1.7, 1.35, 1.0]
	var ys := [2.6, 3.8, 4.9]
	for i in 3:
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = radii[i]
		cone.height = 2.6
		cone.radial_segments = 10
		cone.rings = 1
		cone.cap_top = false
		lst.append_from(cone, 0, Transform3D(Basis.IDENTITY, Vector3(0.0, ys[i], 0.0)))
	tree_leaf_mesh = lst.commit()

func _mm(mesh: Mesh, xfs: Array) -> MultiMesh:
	var m := MultiMesh.new()
	m.transform_format = MultiMesh.TRANSFORM_3D
	m.mesh = mesh
	m.instance_count = xfs.size()
	for i in xfs.size():
		m.set_instance_transform(i, xfs[i])
	return m

func _add_mesh(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, shadow: bool) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

func _add_mm(parent: Node3D, mm: MultiMesh, mat: Material, shadow: bool) -> MultiMeshInstance3D:
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mmi)
	return mmi

func _make_segment(zc: float) -> Seg:
	var s := Seg.new()
	s.node = Node3D.new()
	s.node.position = Vector3(0.0, 0.0, zc)
	add_child(s.node)

	_add_mesh(s.node, road_mesh, m_asphalt, Vector3.ZERO, false)
	for side in [-1.0, 1.0]:
		_add_mesh(s.node, edge_mesh, m_white, Vector3(side * (Cfg.ROAD_W * 0.5 - 0.3), 0.012, 0.0), false)
		_add_mesh(s.node, kerb_mesh, m_kerb, Vector3(side * (Cfg.TOTAL_W * 0.5 - 0.3), 0.02, 0.0), false)
		_add_mesh(s.node, rail_mesh, m_rail, Vector3(side * RAIL_X, 0.62, 0.0), true)
	_add_mm(s.node, mm_dashes, m_white, false)
	_add_mm(s.node, mm_posts, m_rail, true)
	_add_mm(s.node, mm_poles, m_pole, true)
	_add_mm(s.node, mm_lamps, m_lamp, false)

	for side in [-1.0, 1.0]:
		s.ground.append(_add_mesh(s.node, null, m_grass, Vector3.ZERO, false))

	var tm := MultiMesh.new()
	tm.transform_format = MultiMesh.TRANSFORM_3D
	tm.use_colors = true
	tm.mesh = tree_trunk_mesh
	tm.instance_count = TREES_PER_SIDE * 2
	var lm := MultiMesh.new()
	lm.transform_format = MultiMesh.TRANSFORM_3D
	lm.use_colors = true
	lm.mesh = tree_leaf_mesh
	lm.instance_count = TREES_PER_SIDE * 2
	s.trunks = _add_mm(s.node, tm, m_trunk, true)
	s.leaves = _add_mm(s.node, lm, m_leaf, true)

	_populate(s, zc)
	return s

# ------------------------------------------------------------------ terrain

func ground_h(x: float, z: float) -> float:
	var d := absf(x) - Cfg.TOTAL_W * 0.5
	var k := clampf((d - 6.0) / 60.0, 0.0, 1.0)
	k = k * k * (3.0 - 2.0 * k)
	var k2 := clampf((d - 150.0) / 420.0, 0.0, 1.0)
	var n := noise_hills.get_noise_2d(x, z) * 0.5 + 0.5
	var m := noise_mtn.get_noise_2d(x, z) * 0.5 + 0.5
	return -0.03 + k * (4.0 + n * 30.0) + k2 * m * 150.0

func ground_n(x: float, z: float) -> Vector3:
	var e := 1.5
	var dhdx := (ground_h(x + e, z) - ground_h(x - e, z)) / (2.0 * e)
	var dhdz := (ground_h(x, z + e) - ground_h(x, z - e)) / (2.0 * e)
	return Vector3(-dhdx, 1.0, -dhdz).normalized()

func _build_ground(side: float, zc: float) -> ArrayMesh:
	var edge := Cfg.TOTAL_W * 0.5
	var ncol := GROUND_COLS.size()
	var pts: Array = []
	var nrm: Array = []
	for r in GROUND_ROWS + 1:
		var lz := -Cfg.SEG_LEN * 0.5 + Cfg.SEG_LEN * float(r) / float(GROUND_ROWS)
		for c in ncol:
			var x: float = side * (edge + float(GROUND_COLS[c]))
			pts.append(Vector3(x, ground_h(x, zc + lz), lz))
			nrm.append(ground_n(x, zc + lz))
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in GROUND_ROWS:
		for c in ncol - 1:
			var i0 := r * ncol + c
			var i1 := i0 + 1
			var i2 := i0 + ncol
			var i3 := i2 + 1
			_tri(st, pts, nrm, i0, i1, i2)
			_tri(st, pts, nrm, i1, i3, i2)
	return st.commit()

## Emit a triangle wound so that it faces up (Godot front face = clockwise seen from the front).
func _tri(st: SurfaceTool, pts: Array, nrm: Array, a: int, b: int, c: int) -> void:
	var n: Vector3 = (pts[b] - pts[a]).cross(pts[c] - pts[a])
	var ia := a
	var ib := b
	var ic := c
	if n.y > 0.0:
		ib = c
		ic = b
	for idx in [ia, ib, ic]:
		st.set_normal(nrm[idx])
		st.add_vertex(pts[idx])

func _populate(s: Seg, zc: float) -> void:
	s.ground[0].mesh = _build_ground(-1.0, zc)
	s.ground[1].mesh = _build_ground(1.0, zc)

	var rng := RandomNumberGenerator.new()
	rng.seed = int(zc * 7.0) + 12345
	var tmm: MultiMesh = s.trunks.multimesh
	var lmm: MultiMesh = s.leaves.multimesh
	var i := 0
	for side in [-1.0, 1.0]:
		for t in TREES_PER_SIDE:
			var x: float = side * (Cfg.TOTAL_W * 0.5 + 5.0 + rng.randf() * rng.randf() * 55.0)
			var lz := rng.randf_range(-Cfg.SEG_LEN * 0.5, Cfg.SEG_LEN * 0.5)
			var y := ground_h(x, zc + lz)
			var sc := rng.randf_range(0.9, 1.8)
			var b := Basis(Vector3.UP, rng.randf() * TAU) * Basis.from_scale(Vector3(sc, sc * rng.randf_range(0.9, 1.25), sc))
			var xf := Transform3D(b, Vector3(x, y, lz))
			var v := rng.randf_range(0.65, 1.0)
			var col := Color(v, v * rng.randf_range(0.95, 1.1), v * 0.9)
			tmm.set_instance_transform(i, xf)
			tmm.set_instance_color(i, Color(1, 1, 1))
			lmm.set_instance_transform(i, xf)
			lmm.set_instance_color(i, col)
			i += 1

# ------------------------------------------------------------------ per frame

func update(player_z: float) -> void:
	for s in segs:
		if s.node.position.z > player_z + 130.0:
			var nz := front_z - Cfg.SEG_LEN
			s.node.position.z = nz
			front_z = nz
			_populate(s, nz)

func set_lamps(energy: float) -> void:
	m_lamp.emission_energy_multiplier = energy
