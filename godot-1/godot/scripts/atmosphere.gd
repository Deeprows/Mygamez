extends Node
## Sky, sun, fog and post effects (the main realism levers of Forward+), plus 3 quality tiers.
## Forward+ only effects (SSR, SSAO, volumetric fog) are silently ignored by the Mobile renderer.

const Tod = preload("res://scripts/tod.gd")

var env: Environment
var sky_mat: ProceduralSkyMaterial
var sun: DirectionalLight3D
var quality := 2
var tod_name := "day"
var preset: Dictionary = {}

func _ready() -> void:
	sky_mat = ProceduralSkyMaterial.new()
	sky_mat.sky_curve = 0.15
	sky_mat.ground_curve = 0.02
	sky_mat.sun_angle_max = 40.0
	sky_mat.sun_curve = 0.1
	sky_mat.use_debanding = true
	var sky := Sky.new()
	sky.sky_material = sky_mat

	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.05
	env.fog_enabled = true
	env.fog_aerial_perspective = 0.5
	env.fog_sky_affect = 0.3
	env.glow_enabled = true
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.glow_hdr_threshold = 1.0

	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.directional_shadow_blend_splits = true
	add_child(sun)

func apply_tod(tod_key: String) -> Dictionary:
	tod_name = tod_key
	preset = Tod.preset(tod_key)
	var p: Dictionary = preset
	sky_mat.sky_top_color = p["sky_top"]
	sky_mat.sky_horizon_color = p["sky_horizon"]
	sky_mat.ground_horizon_color = p["ground_horizon"]
	sky_mat.ground_bottom_color = p["ground_bottom"]
	sky_mat.energy_multiplier = p["sky_energy"]
	sun.light_color = p["sun_color"]
	sun.light_energy = p["sun_energy"]
	sun.rotation_degrees = p["sun_rot"]
	env.ambient_light_energy = p["ambient"]
	env.tonemap_exposure = p["exposure"]
	env.fog_light_color = p["fog_color"]
	env.fog_density = p["fog_density"]
	env.fog_sun_scatter = p["fog_scatter"]
	env.glow_intensity = p["glow"]
	env.adjustment_saturation = p["saturation"]
	_apply_volumetric()
	return p

func _apply_volumetric() -> void:
	var v: float = float(preset.get("vol", 0.0))
	env.volumetric_fog_enabled = quality >= 2 and v > 0.0
	env.volumetric_fog_density = v
	env.volumetric_fog_albedo = Color(1.0, 0.85, 0.7)
	env.volumetric_fog_length = 220.0
	env.volumetric_fog_anisotropy = 0.7

func apply_quality(q: int) -> void:
	quality = clampi(q, 0, 2)
	var vp := get_viewport()
	match quality:
		0: vp.msaa_3d = Viewport.MSAA_DISABLED
		1: vp.msaa_3d = Viewport.MSAA_2X
		_: vp.msaa_3d = Viewport.MSAA_4X

	env.ssao_enabled = quality >= 1
	env.ssao_radius = 2.0
	env.ssao_intensity = 2.0
	env.ssr_enabled = quality >= 2
	env.ssr_max_steps = 64
	env.ssr_fade_in = 0.15
	env.ssr_fade_out = 2.0
	env.ssr_depth_tolerance = 0.2
	env.glow_enabled = quality >= 1

	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS if quality == 0 else DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	match quality:
		0: sun.directional_shadow_max_distance = 80.0
		1: sun.directional_shadow_max_distance = 130.0
		_: sun.directional_shadow_max_distance = 170.0
	sun.light_angular_distance = 0.35 if quality >= 2 else 0.0   # soft (PCSS-like) shadows on HIGH

	RenderingServer.directional_shadow_atlas_set_size(1024 if quality == 0 else (2048 if quality == 1 else 4096), true)
	if quality == 0:
		RenderingServer.directional_soft_shadow_filter_set_quality(RenderingServer.SHADOW_QUALITY_SOFT_LOW)
	elif quality == 1:
		RenderingServer.directional_soft_shadow_filter_set_quality(RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM)
	else:
		RenderingServer.directional_soft_shadow_filter_set_quality(RenderingServer.SHADOW_QUALITY_SOFT_HIGH)
	_apply_volumetric()
