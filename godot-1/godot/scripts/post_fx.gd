extends CanvasLayer
## Full-screen speed blur + vignette (shaders/post_fx.gdshader).

var mat: ShaderMaterial
var rect: ColorRect

func _ready() -> void:
	layer = 1
	rect = ColorRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	mat.shader = load("res://shaders/post_fx.gdshader")
	rect.material = mat
	add_child(rect)
	rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

func set_strength(v: float) -> void:
	mat.set_shader_parameter("strength", v)

func set_enabled(on: bool) -> void:
	rect.visible = on
