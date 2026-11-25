extends RefCounted
## Procedural PBR materials (no downloaded assets needed). Stage G2 replaces these with real CC0 texture sets.

static func _ramp(a: Color, b: Color) -> Gradient:
	var g := Gradient.new()
	g.set_color(0, a)
	g.set_color(1, b)
	return g

static func noise_tex(freq: float, seed_v: int, as_normal: bool, bump: float, ramp: Gradient = null, size: int = 1024) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	n.fractal_octaves = 4
	n.frequency = freq
	n.seed = seed_v
	var t := NoiseTexture2D.new()
	t.width = size
	t.height = size
	t.seamless = true
	t.noise = n
	t.as_normal_map = as_normal
	t.bump_strength = bump
	if ramp != null:
		t.color_ramp = ramp
	return t

## World-space triplanar: no UVs needed and seamless across recycled road segments.
static func _world_tri(m: StandardMaterial3D, scale: float) -> void:
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(scale, scale, scale)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC

static func asphalt() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = noise_tex(0.015, 11, false, 1.0, _ramp(Color(0.09, 0.09, 0.10), Color(0.21, 0.21, 0.22)))
	m.normal_enabled = true
	m.normal_texture = noise_tex(0.12, 12, true, 4.0)
	m.normal_scale = 0.8
	m.roughness = 0.82
	m.metallic_specular = 0.5
	_world_tri(m, 0.12)
	return m

static func grass() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = noise_tex(0.012, 21, false, 1.0, _ramp(Color(0.16, 0.27, 0.07), Color(0.34, 0.42, 0.15)))
	m.normal_enabled = true
	m.normal_texture = noise_tex(0.2, 22, true, 6.0)
	m.normal_scale = 1.0
	m.roughness = 0.95
	m.metallic_specular = 0.2
	_world_tri(m, 0.1)
	return m

static func paint_line(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.55
	return m

static func kerb() -> StandardMaterial3D:
	var img := Image.create(4, 4, false, Image.FORMAT_RGBA8)
	img.fill_rect(Rect2i(0, 0, 4, 2), Color(0.78, 0.08, 0.08))
	img.fill_rect(Rect2i(0, 2, 4, 2), Color(0.92, 0.92, 0.92))
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
	m.uv1_scale = Vector3(1.0, 30.0, 1.0)   # 30 red/white pairs per 60 m segment
	m.roughness = 0.7
	return m

static func metal(c: Color, rough: float = 0.4) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = 0.85
	m.roughness = rough
	return m

static func plain(c: Color, rough: float = 0.8) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m

static func emissive(c: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

static func leaves() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = noise_tex(0.03, 31, false, 1.0, _ramp(Color(0.05, 0.16, 0.05), Color(0.16, 0.34, 0.10)), 512)
	m.vertex_color_use_as_albedo = true   # per-tree tint from MultiMesh colours
	m.roughness = 0.9
	m.uv1_triplanar = true                # object space
	m.uv1_scale = Vector3(0.6, 0.6, 0.6)
	return m

static func trunk() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.26, 0.17, 0.10)
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.95
	return m

## Car paint: metallic base + clearcoat layer.
static func car_paint(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = 0.75
	m.metallic_specular = 0.6
	m.roughness = 0.32
	m.clearcoat_enabled = true
	m.clearcoat = 1.0
	m.clearcoat_roughness = 0.04
	return m

## Heavily tinted, mirror-like glass (opaque so we do not need an interior).
static func glass() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.02, 0.03, 0.04)
	m.metallic = 0.9
	m.roughness = 0.04
	return m

static func tyre() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.03, 0.03, 0.03)
	m.roughness = 0.92
	return m

static func rim() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.78, 0.79, 0.82)
	m.metallic = 1.0
	m.roughness = 0.22
	return m
