shader_type canvas_item;
// Speed blur (radial) + vignette. Drawn on a CanvasLayer above the 3D view, below the HUD.

uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_linear;
uniform float strength : hint_range(0.0, 1.0) = 0.0;
uniform float vignette : hint_range(0.0, 1.0) = 0.3;

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 dir = uv - vec2(0.5, 0.5);
	float d = length(dir);
	float s = strength * 0.07 * smoothstep(0.12, 0.75, d);
	vec3 col = vec3(0.0);
	for (int i = 0; i < 8; i++) {
		float t = float(i) / 7.0;
		col += textureLod(screen_tex, uv - dir * s * t, 0.0).rgb;
	}
	col /= 8.0;
	float v = 1.0 - smoothstep(0.25, 0.85, d);
	col *= mix(1.0 - vignette, 1.0, v);
	COLOR = vec4(col, 1.0);
}
