extends RefCounted
## Time-of-day presets. Add a new look: add a case in preset() and a name in NAMES.

const NAMES := ["day", "sunset", "night"]

static func preset(name: String) -> Dictionary:
	match name:
		"sunset":
			return {
				"sky_top": Color.html("#2b3b86"), "sky_horizon": Color.html("#ff9a55"),
				"ground_horizon": Color.html("#6a4a45"), "ground_bottom": Color.html("#2b2330"),
				"sun_color": Color.html("#ff8a3a"), "sun_energy": 2.2, "sun_rot": Vector3(-7.0, 170.0, 0.0),
				"fog_color": Color.html("#f0a070"), "fog_density": 0.0016, "fog_scatter": 0.6,
				"ambient": 0.7, "sky_energy": 1.0, "exposure": 1.05, "glow": 0.6, "saturation": 1.1,
				"lamps": 2.0, "headlights": 0.5, "vol": 0.012,
			}
		"night":
			return {
				"sky_top": Color.html("#02050f"), "sky_horizon": Color.html("#1a2a4c"),
				"ground_horizon": Color.html("#0b1224"), "ground_bottom": Color.html("#04060c"),
				"sun_color": Color.html("#8aa4ff"), "sun_energy": 0.18, "sun_rot": Vector3(-38.0, 25.0, 0.0),
				"fog_color": Color.html("#0a1428"), "fog_density": 0.0022, "fog_scatter": 0.0,
				"ambient": 1.6, "sky_energy": 1.0, "exposure": 1.15, "glow": 0.9, "saturation": 1.0,
				"lamps": 8.0, "headlights": 1.0, "vol": 0.0,
			}
		_:
			return {
				"sky_top": Color.html("#2d78d0"), "sky_horizon": Color.html("#b9d8f0"),
				"ground_horizon": Color.html("#9aa89a"), "ground_bottom": Color.html("#5b6b52"),
				"sun_color": Color.html("#fff0d8"), "sun_energy": 1.7, "sun_rot": Vector3(-48.0, 28.0, 0.0),
				"fog_color": Color.html("#b4d2ec"), "fog_density": 0.0011, "fog_scatter": 0.08,
				"ambient": 1.0, "sky_energy": 1.0, "exposure": 1.0, "glow": 0.35, "saturation": 1.08,
				"lamps": 0.0, "headlights": 0.0, "vol": 0.0,
			}
