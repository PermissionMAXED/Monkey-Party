extends SceneTree
## Orientierungs-Kontaktbögen (KEIN Test — kein test_-Präfix): rendert ALLE
## .glb/.gltf unter res://assets als Gitter-Kontaktbögen, damit man mit einem
## Blick prüfen kann, ob jedes Asset richtig herum steht (UserFeedback:
## „sicherstellen, dass alle Assets richtig rotiert sind").
## Jede Zelle: Modell auf 1 m längste Kante normiert, Unterkante auf der
## Boden-Platte, Name darunter. Kamera leicht erhöht — Gekipptes/Gespiegeltes
## fällt sofort auf. Braucht einen echten Renderer (xvfb):
##   xvfb-run -a godot --path GOOBY-GODOT --rendering-method gl_compatibility \
##     --rendering-driver opengl3 --script res://tests/unit/screenshot_orientierung.gd

const OUT_DIR := "/tmp/gooby-godot/artifacts/ORIENT"
const SETTLE_FRAMES := 12
const SPALTEN := 8
const ZEILEN := 6
const ZELLE := 1.5


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	# Der Quality-Autoload senkt headless die Stufe und zeigt ein Notify-
	# Banner — das läge sonst mitten auf dem Kontaktbogen.
	var notify := root.get_node_or_null("Notify")
	if notify != null:
		notify.set("banner_ui_enabled", false)
	DisplayServer.window_set_size(Vector2i(1920, 1440))
	root.size = Vector2i(1920, 1440)
	var pfade: Array[String] = []
	_sammle("res://assets", pfade)
	pfade.sort()
	var pro_bogen := SPALTEN * ZEILEN
	var bogen_anzahl := int(ceil(float(pfade.size()) / float(pro_bogen)))
	print("Orientierungs-Kontaktbögen: %d Modelle auf %d Bögen" % [pfade.size(), bogen_anzahl])
	for bogen in bogen_anzahl:
		var teil := pfade.slice(bogen * pro_bogen, (bogen + 1) * pro_bogen)
		await _render_bogen(bogen, teil)
	print("ORIENT-Screenshots fertig → %s" % OUT_DIR)
	quit(0)


func _sammle(wurzel: String, out: Array[String]) -> void:
	var dir := DirAccess.open(wurzel)
	if dir == null:
		return
	dir.list_dir_begin()
	var eintrag := dir.get_next()
	while eintrag != "":
		var pfad := wurzel + "/" + eintrag
		if dir.current_is_dir():
			if not eintrag.begins_with("."):
				_sammle(pfad, out)
		elif eintrag.get_extension() in ["glb", "gltf"]:
			out.append(pfad)
		eintrag = dir.get_next()
	dir.list_dir_end()


func _render_bogen(index: int, pfade: Array[String]) -> void:
	var szene := Node3D.new()
	root.add_child(szene)
	var licht := DirectionalLight3D.new()
	licht.rotation_degrees = Vector3(-48.0, -30.0, 0.0)
	licht.light_energy = 1.1
	szene.add_child(licht)
	var umgebung := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#dff0f7")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color.WHITE
	env.ambient_light_energy = 0.75
	umgebung.environment = env
	szene.add_child(umgebung)
	for i in pfade.size():
		var spalte := i % SPALTEN
		var zeile := i / SPALTEN
		var mitte := Vector3(
			(float(spalte) - float(SPALTEN - 1) * 0.5) * ZELLE, -float(zeile) * ZELLE * 1.15, 0.0
		)
		_baue_zelle(szene, pfade[i], mitte)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = float(ZEILEN) * ZELLE * 1.15 + 1.0
	var cam_mitte := Vector3(0.0, -float(ZEILEN - 1) * ZELLE * 1.15 * 0.5 + 0.4, 0.0)
	cam.position = cam_mitte + Vector3(0.0, 2.4, 14.0)
	szene.add_child(cam)
	cam.look_at(cam_mitte)
	cam.current = true
	for _i in SETTLE_FRAMES:
		await process_frame
	var image := root.get_texture().get_image()
	var datei := "%s/bogen_%02d.png" % [OUT_DIR, index]
	image.save_png(datei)
	print("  gespeichert: bogen_%02d.png (%d Modelle)" % [index, pfade.size()])
	szene.queue_free()
	await process_frame
	await process_frame


func _baue_zelle(szene: Node3D, pfad: String, mitte: Vector3) -> void:
	var platte := MeshInstance3D.new()
	var platte_mesh := BoxMesh.new()
	platte_mesh.size = Vector3(ZELLE * 0.84, 0.03, ZELLE * 0.6)
	var platte_mat := StandardMaterial3D.new()
	platte_mat.albedo_color = Color("#9fb7a4")
	platte_mesh.material = platte_mat
	platte.mesh = platte_mesh
	platte.position = mitte + Vector3(0.0, -0.015, 0.0)
	szene.add_child(platte)
	var packed: PackedScene = load(pfad)
	if packed == null:
		return
	var modell: Node3D = packed.instantiate()
	var halter := Node3D.new()
	halter.add_child(modell)
	szene.add_child(halter)
	var aabb := _merged_aabb(modell, Transform3D.IDENTITY)
	var laengste := maxf(aabb.size.x, maxf(aabb.size.y, aabb.size.z))
	if laengste > 0.0001:
		var s := 1.0 / laengste
		modell.scale = Vector3.ONE * s
		var center := aabb.get_center()
		modell.position = Vector3(-center.x * s, -aabb.position.y * s, -center.z * s)
	halter.position = mitte
	var label := Label3D.new()
	label.text = pfad.get_file()
	label.font_size = 30
	label.pixel_size = 0.0016
	label.modulate = Color("#274a5a")
	label.outline_size = 8
	label.position = mitte + Vector3(0.0, -0.12, 0.5)
	szene.add_child(label)


func _merged_aabb(node: Node, xform: Transform3D) -> AABB:
	var merged := AABB()
	var found := false
	var local := xform
	if node is Node3D:
		local = xform * (node as Node3D).transform
	if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
		merged = local * (node as MeshInstance3D).mesh.get_aabb()
		found = true
	for child in node.get_children():
		var sub := _merged_aabb(child, local)
		if sub.size != Vector3.ZERO or sub.position != Vector3.ZERO:
			merged = merged.merge(sub) if found else sub
			found = true
	return merged
