class_name McGoobySchichtStage3D
extends "res://scripts/minigames/games/_3dc_stage/stage3d.gd"
## McGooby-Bühne (J+/G6-Paket, Doc §9 Technik-Plan): das EINE gemeinsame
## 3D-Set der Schicht — kein SubViewport pro Station, Muster
## `burger_build_stage3d.gd`. Welle A rahmt die Grill-Station frontal;
## die übrigen Stationen (Fritteuse, Belegen, Shake) stehen als Kulisse
## bereit, damit Welle B nur noch die Kamera schwenken muss.
##
## Was die Bühne zeigt: Gooby als Grill-Koch mit Papierhütchen hinter der
## Theke, ein ECHTER Patty (Food-Kit-GLB) auf der Grillplatte, dessen Farbe
## live dem Logik-Zustand folgt (rosa → goldbraun → Kohle — dieselben
## Farbwerte wie der 2D-Wende-Knopf), Brutzel-Dampf, der mit dem Garungs-
## Fortschritt anwächst, Kohle-Qualm als Gag, das Bananen-Bögen-Schild
## („McGooby“ — zwei goldgelbe Bögen), Menütafel mit den vier Stations-
## Chips und zwei wartende Kunden-Goobys an der Abholtheke, die bei jeder
## fertigen Bestellung mitjubeln.
##
## Alle Requisiten kommen aus dem BESTEHENDEN Bestand
## (`assets/minigames/burger_build/`, Kenney Food-/Furniture-Kit) — die
## Bühne lädt kein einziges neues Asset. Reduced Motion (Q2) friert
## Schunkeln/Wende-Salto ein; Charakter-Clips (normale Animation) laufen.

const Models := preload("res://scripts/minigames/games/_3dc_stage/models3d.gd")
const Puff := preload("res://scripts/minigames/games/_3dc_stage/puff3d.gd")
const DIR := "res://assets/minigames/burger_build/"

## Kameraabstand zur Spielebene (burger_build-Projektion, erprobt in
## beiden Formaten).
const CAM_DIST := 16.0
## Halbe sichtbare Bildhöhe in Metern (Hochformat-Rahmung).
const HALF_H := 7.36
const COUNTER_Y := -3.62
const FLOOR_Y := -6.8
const WALL_Z := -5.4

## Patty-Zustandsfarben — MÜSSEN zu den 2D-Knopf-Farben der Szene passen
## (eine Farbsprache für Knopf und Bühne, Doc §2.2).
const FARBE_ROH := Color("#E8A18B")
const FARBE_GOLDBRAUN := Color("#E8C25A")
const FARBE_KOHLE := Color("#54382A")

## McGooby-Markenfarben (Parodie mit Herz: Ketchup-Rot + Bananen-Gold).
const MARKE_ROT := Color(0.83, 0.3, 0.24)
const MARKE_GOLD := Color(1.0, 0.8, 0.25)

## Wo der Patty auf der Grillplatte liegt (links der Bildmitte — der
## 2D-Wende-Knopf sitzt mittig, der 3D-Patty bleibt daneben sichtbar).
const PATTY_POS := Vector3(-2.7, COUNTER_Y + 0.22, -0.5)
## Abholtheke rechts: Tablett-Anker für den Jubel-Poof.
const TABLETT_POS := Vector3(2.7, COUNTER_Y + 0.4, -0.5)

## Wie schnell die Patty-Farbe dem Zustand nachzieht (1/s, rein visuell).
const FARB_TEMPO := 7.0

var gooby: GoobyRig

var _patty: Node3D
var _patty_mat: StandardMaterial3D
var _patty_zustand := "roh"
var _patty_farbe_ziel := FARBE_ROH
var _heat_mat: StandardMaterial3D
var _sizzle: GPUParticles3D
var _qualm: GPUParticles3D
var _pop: GPUParticles3D
var _emotion := "happy"
var _kunden: Array[GoobyRig] = []
var _kunden_basen: Array[Vector3] = []
var _kunden_t := 0.0
var _kunden_jubel := 0.0
var _wende_tween: Tween
var _reduced := false


func setup_stage() -> void:
	build(
		{
			"sky_top": Color(0.56, 0.73, 0.9),
			"sky_horizon": Color(1.0, 0.9, 0.78),
			"ground_horizon": Color(0.9, 0.77, 0.68),
			"ground_bottom": Color(0.6, 0.4, 0.35),
			"sky_energy": 0.4,
			"ambient": 0.46,
			"sun_color": Color(1.0, 0.87, 0.7),
			"sun_energy": 1.9,
			"sun_dir": Vector3(-0.32, -0.72, -0.6),
			"fill_color": Color(0.78, 0.86, 1.0),
			"fill_energy": 0.55,
			"shadows": false,
			"glow": 0.34,
			"glow_bloom": 0.02,
			"glow_threshold": 1.0,
			"far": 70.0,
		}
	)
	# Belichtungs-Eichung wie die Diner-Bühne (dort gegen Luma-Messung
	# kalibriert): Filmic drückt die Creme-Wand sonst in den Anschlag.
	environment.tonemap_exposure = 0.66
	environment.adjustment_enabled = true
	environment.adjustment_contrast = 1.06
	environment.adjustment_saturation = 1.12
	frame(HALF_H)
	_build_room()
	_build_counter()
	_build_grill_station()
	_build_abholtheke()
	_build_kulissen_stationen()
	_build_lampen([-2.7, 2.7])
	_build_koch()
	_build_kunden()
	_build_effects()


## Rahmung an die Orientierung koppeln (Bildmitte = Weltnullpunkt).
func frame(half_h: float) -> void:
	set_half_height(half_h, CAM_DIST)
	camera.position = Vector3(0.0, 0.0, CAM_DIST)
	camera.rotation = Vector3.ZERO


## Schicht-Anpfiff: die Kamera schwebt aus einer erhöhten Küchen-Totale in
## die frontale Grill-Pose (k = 1 == exakte frame()-Rahmung; Reduced Motion
## ruft direkt mit 1.0 — burger_build-Muster).
func establish(k: float) -> void:
	var e := 1.0 - ease(clampf(k, 0.0, 1.0), 0.4)
	camera.position = Vector3(0.0, 0.0, CAM_DIST) + Vector3(-1.6, 2.4, 4.2) * e
	camera.rotation_degrees = Vector3(-7.0 * e, -3.0 * e, 0.0)


## ------------------------------------------------------------- Spiel-Sync


## Jeden Frame aus der Szene: Patty-Farbe/Effekte dem Logik-Zustand
## nachziehen. `fortschritt` (0..1, McGoobySchichtLogic.fortschritt) steuert
## Brutzel-Dampf und Grill-Glut, `aktiv` == liegt gerade ein Patty drauf.
func sync_patty(zustand: String, fortschritt: float, aktiv: bool, reduced := false) -> void:
	_reduced = reduced
	_patty_zustand = zustand
	match zustand:
		"goldbraun":
			_patty_farbe_ziel = FARBE_GOLDBRAUN
		"kohle":
			_patty_farbe_ziel = FARBE_KOHLE
		_:
			# Rohes Patty bräunt schon sichtbar AN (Vorfreude aufs Fenster).
			_patty_farbe_ziel = FARBE_ROH.lerp(FARBE_GOLDBRAUN, clampf(fortschritt, 0.0, 1.0) * 0.4)
	_patty.visible = aktiv
	_sizzle.emitting = aktiv
	# Mehr Garung = mehr Brutzeln: der Dampf legt hörbar sichtbar zu.
	_sizzle.speed_scale = 0.7 + 1.1 * clampf(fortschritt, 0.0, 1.0)
	_qualm.emitting = aktiv and zustand == "kohle"
	_heat_mat.emission_energy_multiplier = 0.7 + 1.9 * clampf(fortschritt, 0.0, 1.0)


## Taktiles Wenden: der Patty macht einen Salto (Reduced Motion: nur der
## Funken-Poof), der Koch feiert Perfekt-Wenden mit.
func wenden(perfekt: bool) -> void:
	Puff.fire(
		_pop,
		PATTY_POS + Vector3(0.0, 0.5, 0.4),
		Color(1.0, 0.88, 0.5) if perfekt else Color(0.62, 0.52, 0.44)
	)
	if perfekt:
		gooby.play_clip_for("celebrate", 0.9)
	if _reduced:
		return
	if _wende_tween != null and _wende_tween.is_running():
		_wende_tween.kill()
	_patty.rotation = Vector3.ZERO
	_patty.position = PATTY_POS
	_wende_tween = create_tween()
	_wende_tween.set_parallel(true)
	_wende_tween.tween_property(_patty, "rotation:x", PI, 0.3)
	(
		_wende_tween
		. tween_property(_patty, "position:y", PATTY_POS.y + 1.0, 0.15)
		. set_ease(Tween.EASE_OUT)
	)
	_wende_tween.set_parallel(false)
	(
		_wende_tween
		. tween_property(_patty, "position:y", PATTY_POS.y, 0.15)
		. set_ease(Tween.EASE_IN)
	)
	_wende_tween.tween_callback(func() -> void: _patty.rotation = Vector3.ZERO)


## Frischer Patty auf dem Grill: Zustand zurück auf roh (Farbe springt —
## ein NEUES Patty blendet nicht aus der alten Kohle hoch). WICHTIG: ein
## laufender Wende-Salto wird NICHT gekillt — das Wenden und der nächste
## Patty passieren im selben Call-Stack, und die Landung des Saltos IST
## der frische Patty (sonst wäre der Salto nie zu sehen).
func patty_neu() -> void:
	_patty_zustand = "roh"
	_patty_farbe_ziel = FARBE_ROH
	_patty_mat.albedo_color = FARBE_ROH
	if _wende_tween != null and _wende_tween.is_running():
		return
	_patty.rotation = Vector3.ZERO
	_patty.position = PATTY_POS


## Bestellglocke: die wartenden Kunden recken sich kurz (neue Bestellung).
func bestellglocke() -> void:
	_kunden_jubel = maxf(_kunden_jubel, 0.6)


## Fertige Bestellung: Kunden jubeln, über dem Abhol-Tablett goldene Funken,
## die Bühne blitzt warm auf. Clips laufen auch unter Reduced Motion
## (normale Charakter-Animation), nur der Schunkel-Schub wird gegated (Q2).
func bestellung_fertig() -> void:
	for kunde in _kunden:
		kunde.play_clip_for("celebrate", 1.2)
	Puff.fire(_pop, TABLETT_POS, Color(1.0, 0.85, 0.4))
	pulse_glow(0.9)
	if _reduced:
		return
	_kunden_jubel = 1.2


## Feierabend: der Koch verbeugt sich feiernd, alle Kunden jubeln mit.
func feierabend_jubel() -> void:
	gooby.play_clip_for("celebrate", 1.6)
	bestellung_fertig()


## Koch-Emotion setzen (nur bei Wechsel, sonst flackert der Blend).
func feel(emotion: String) -> void:
	if gooby == null or _emotion == emotion:
		return
	_emotion = emotion
	gooby.set_emotion(emotion)


## Glow-Zerfall der Basis + Patty-Farbverlauf + Kunden-Schunkeln.
func tick(delta: float) -> void:
	super.tick(delta)
	_patty_mat.albedo_color = (
		_patty_mat.albedo_color.lerp(_patty_farbe_ziel, minf(1.0, FARB_TEMPO * delta))
	)
	_kunden_jubel = maxf(0.0, _kunden_jubel - delta)
	if _reduced:
		for i in _kunden.size():
			_kunden[i].position = _kunden_basen[i]
		return
	_kunden_t += delta
	var amp := 0.05 + 0.14 * _kunden_jubel
	for i in _kunden.size():
		var lift := absf(sin(_kunden_t * 2.4 + float(i) * 1.7)) * amp
		_kunden[i].position = _kunden_basen[i] + Vector3(0.0, lift, 0.0)


## ---------------------------------------------------------------- Test-API


func patty_zustand() -> String:
	return _patty_zustand


func patty_farbe_ziel() -> Color:
	return _patty_farbe_ziel


func kunden() -> Array[GoobyRig]:
	return _kunden


# ── Aufbau ────────────────────────────────────────────────────────────────


func _build_room() -> void:
	var wall := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(40.0, 26.0, 0.4)
	var mat := StandardMaterial3D.new()
	# Wärmer als das Diner (Bananen-Creme): McGooby ist GELB gebrandet.
	mat.albedo_color = Color(0.94, 0.86, 0.7)
	mat.roughness = 1.0
	box.material = mat
	wall.mesh = box
	wall.position = Vector3(0.0, 4.0, WALL_Z)
	add_child(wall)
	# Marken-Doppelstreifen auf Kopfhöhe: Ketchup-Rot über Bananen-Gold.
	var stripe := MeshInstance3D.new()
	var sbox := BoxMesh.new()
	sbox.size = Vector3(40.0, 0.7, 0.1)
	var smat := StandardMaterial3D.new()
	smat.albedo_color = MARKE_ROT
	sbox.material = smat
	stripe.mesh = sbox
	stripe.position = Vector3(0.0, -1.3, WALL_Z + 0.25)
	add_child(stripe)
	var gold := MeshInstance3D.new()
	var gbox := BoxMesh.new()
	gbox.size = Vector3(40.0, 0.24, 0.1)
	var gmat := StandardMaterial3D.new()
	gmat.albedo_color = MARKE_GOLD
	gbox.material = gmat
	gold.mesh = gbox
	gold.position = Vector3(0.0, -1.82, WALL_Z + 0.25)
	add_child(gold)
	_build_floor()
	_build_fenster()
	_build_menutafel()
	_build_bananen_boegen()


## Terrakotta-Schachbrettboden (MultiMesh = 1 Draw-Call je Farbe).
func _build_floor() -> void:
	var slab := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(40.0, 26.0)
	var base := StandardMaterial3D.new()
	base.albedo_color = Color(0.98, 0.94, 0.88)
	base.roughness = 0.9
	plane.material = base
	slab.mesh = plane
	slab.position = Vector3(0.0, FLOOR_Y, 0.0)
	add_child(slab)
	var tile := BoxMesh.new()
	tile.size = Vector3(1.5, 0.04, 1.5)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.8, 0.42, 0.3)
	mat.roughness = 0.9
	tile.material = mat
	var poses: Array = []
	for row in 8:
		for col in 16:
			if (row + col) % 2 != 0:
				continue
			var pos := Vector3(-11.25 + col * 1.5, FLOOR_Y + 0.03, 6.0 - row * 1.5)
			poses.append(Transform3D(Basis.IDENTITY, pos))
	add_child(Models.swarm([{"mesh": tile, "xform": Transform3D.IDENTITY}], poses, 40.0))


## Zwei Fenster mit warmem Abendlicht (burger_build-Positionen — dort gegen
## beide Formate geprüft): draußen Sonnenuntergang, drinnen Grill-Glut.
func _build_fenster() -> void:
	var frame_mat := StandardMaterial3D.new()
	frame_mat.albedo_color = Color(0.99, 0.97, 0.94)
	frame_mat.roughness = 0.7
	var glass_mat := StandardMaterial3D.new()
	glass_mat.albedo_color = Color(1.0, 0.78, 0.55)
	glass_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	glass_mat.emission_enabled = true
	glass_mat.emission = Color(1.0, 0.72, 0.45)
	glass_mat.emission_energy_multiplier = 0.55
	for wx in [-4.35, 4.35]:
		var glass := MeshInstance3D.new()
		var pane := BoxMesh.new()
		pane.size = Vector3(1.9, 2.2, 0.06)
		pane.material = glass_mat
		glass.mesh = pane
		glass.position = Vector3(wx, 2.5, WALL_Z + 0.28)
		add_child(glass)
		var frame_node := MeshInstance3D.new()
		var fbox := BoxMesh.new()
		fbox.size = Vector3(2.2, 2.5, 0.1)
		fbox.material = frame_mat
		frame_node.mesh = fbox
		frame_node.position = Vector3(wx, 2.5, WALL_Z + 0.24)
		add_child(frame_node)
		var cross := MeshInstance3D.new()
		var cbox := BoxMesh.new()
		cbox.size = Vector3(0.1, 2.2, 0.05)
		cbox.material = frame_mat
		cross.mesh = cbox
		cross.position = Vector3(wx, 2.5, WALL_Z + 0.33)
		add_child(cross)


## Menütafel mit VIER Stations-Chips (grill/belegen/fritteuse/shake) — die
## Kulissen-Versprechung für Welle B steht damit schon an der Wand.
func _build_menutafel() -> void:
	var board := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(5.6, 2.4, 0.18)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.26, 0.21, 0.22)
	mat.roughness = 0.95
	box.material = mat
	board.mesh = box
	board.position = Vector3(0.0, 1.6, WALL_Z + 0.3)
	add_child(board)
	# Goldrahmen statt Holz: die Tafel gehört zum McGooby-Branding.
	var trim := StandardMaterial3D.new()
	trim.albedo_color = MARKE_GOLD.darkened(0.25)
	trim.roughness = 0.75
	for edge: Array in [[0.0, 2.86, 5.9, 0.14], [0.0, 0.34, 5.9, 0.14]]:
		var bar := MeshInstance3D.new()
		var bbox := BoxMesh.new()
		bbox.size = Vector3(float(edge[2]), float(edge[3]), 0.2)
		bbox.material = trim
		bar.mesh = bbox
		bar.position = Vector3(float(edge[0]), float(edge[1]), WALL_Z + 0.32)
		add_child(bar)
	for side: float in [-2.87, 2.87]:
		var bar := MeshInstance3D.new()
		var bbox := BoxMesh.new()
		bbox.size = Vector3(0.14, 2.66, 0.2)
		bbox.material = trim
		bar.mesh = bbox
		bar.position = Vector3(side, 1.6, WALL_Z + 0.32)
		add_child(bar)
	var chalk := StandardMaterial3D.new()
	chalk.albedo_color = Color(1.0, 0.96, 0.88)
	chalk.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	# Stations-Chips in der Stationsfarbe: Grill-Rot, Salat-Grün,
	# Pommes-Gold, Shake-Rosa (Form+Farbe-Sprache, nie nur Text).
	const CHIP_TINTS: Array[Color] = [
		Color(0.9, 0.31, 0.28),
		Color(0.5, 0.79, 0.38),
		Color(1.0, 0.79, 0.28),
		Color(0.95, 0.62, 0.78),
	]
	for i in 4:
		var line := MeshInstance3D.new()
		var lbox := BoxMesh.new()
		lbox.size = Vector3(2.7 - i * 0.4, 0.13, 0.05)
		lbox.material = chalk
		line.mesh = lbox
		line.position = Vector3(-0.35 + i * 0.15, 2.3 - i * 0.48, WALL_Z + 0.42)
		add_child(line)
		var chip := MeshInstance3D.new()
		var cbox := BoxMesh.new()
		cbox.size = Vector3(0.34, 0.26, 0.08)
		var cmat := StandardMaterial3D.new()
		cmat.albedo_color = CHIP_TINTS[i]
		cmat.roughness = 0.8
		cbox.material = cmat
		chip.mesh = cbox
		chip.position = Vector3(-2.25, 2.3 - i * 0.48, WALL_Z + 0.42)
		add_child(chip)


## DAS Schild: zwei goldgelbe Bananen-Bögen auf rotem Grund — das „M“ von
## McGooby (Parodie mit Herz). Hängt oben links auf der erprobten
## Neon-Position der Diner-Bühne (in beiden Formaten voll im Bild).
func _build_bananen_boegen() -> void:
	var holder := Node3D.new()
	# Etwas höher/links als die Diner-Neon-Position und einen Tick kleiner:
	# so bleibt zwischen Schild und Menütafel-Goldrahmen Luft — in BEIDEN
	# Formaten voll im Bild (Hochkant sieht an der Wandtiefe ±4,4 wu).
	holder.position = Vector3(-3.5, 3.25, WALL_Z + 0.4)
	holder.scale = Vector3.ONE * 0.75
	add_child(holder)
	var back := MeshInstance3D.new()
	var disc := BoxMesh.new()
	disc.size = Vector3(2.7, 1.7, 0.08)
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = MARKE_ROT
	bmat.roughness = 0.85
	disc.material = bmat
	back.mesh = disc
	holder.add_child(back)
	var rim := MeshInstance3D.new()
	var rbox := BoxMesh.new()
	rbox.size = Vector3(2.86, 1.86, 0.06)
	var rmat := StandardMaterial3D.new()
	rmat.albedo_color = Color(0.99, 0.97, 0.92)
	rbox.material = rmat
	rim.mesh = rbox
	rim.position = Vector3(0.0, 0.0, -0.02)
	holder.add_child(rim)
	# Jeder Bogen = 9 Segmente entlang eines Halbkreises (MultiMesh,
	# 1 Draw-Call für BEIDE Bögen zusammen).
	var seg := BoxMesh.new()
	seg.size = Vector3(0.3, 0.22, 0.14)
	var seg_mat := StandardMaterial3D.new()
	seg_mat.albedo_color = MARKE_GOLD
	seg_mat.emission_enabled = true
	seg_mat.emission = MARKE_GOLD
	seg_mat.emission_energy_multiplier = 1.9
	seg.material = seg_mat
	var poses: Array = []
	for center_x: float in [-0.52, 0.52]:
		for i in 9:
			var winkel := PI * float(i) / 8.0
			var pos := Vector3(
				center_x + cos(winkel) * 0.52, -0.55 + sin(winkel) * 0.95, 0.1
			)
			var basis := Basis(Vector3.BACK, atan2(cos(winkel) * 0.95, -sin(winkel) * 0.52))
			poses.append(Transform3D(basis, pos))
	holder.add_child(Models.swarm([{"mesh": seg, "xform": Transform3D.IDENTITY}], poses, 30.0))


func _build_counter() -> void:
	var top := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(26.0, 0.34, 4.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.9, 0.9, 0.93)
	mat.metallic = 0.35
	mat.roughness = 0.4
	box.material = mat
	top.mesh = box
	top.position = Vector3(0.0, COUNTER_Y - 0.17, -0.6)
	add_child(top)
	var front := MeshInstance3D.new()
	var fbox := BoxMesh.new()
	fbox.size = Vector3(25.6, 1.9, 3.8)
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = MARKE_ROT.darkened(0.08)
	fmat.roughness = 0.85
	fbox.material = fmat
	front.mesh = fbox
	front.position = Vector3(0.0, COUNTER_Y - 1.29, -0.65)
	add_child(front)
	var trim := MeshInstance3D.new()
	var tbox := BoxMesh.new()
	tbox.size = Vector3(25.8, 0.3, 3.9)
	var tmat := StandardMaterial3D.new()
	tmat.albedo_color = Color(0.94, 0.94, 0.96)
	tmat.metallic = 0.4
	tmat.roughness = 0.35
	tbox.material = tmat
	trim.mesh = tbox
	trim.position = Vector3(0.0, COUNTER_Y - 2.38, -0.65)
	add_child(trim)
	# Gold-Paneele + Chromleisten gegen die rote Riesenfläche im Hochformat.
	var panel := BoxMesh.new()
	panel.size = Vector3(1.5, 1.2, 0.1)
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = Color(0.98, 0.86, 0.55)
	pmat.roughness = 0.7
	panel.material = pmat
	var strip := BoxMesh.new()
	strip.size = Vector3(0.16, 1.7, 0.12)
	var chrome := StandardMaterial3D.new()
	chrome.albedo_color = Color(0.94, 0.94, 0.96)
	chrome.metallic = 0.5
	chrome.roughness = 0.3
	strip.material = chrome
	var panels: Array = []
	var strips: Array = []
	for i in 12:
		var x := -11.0 + i * 2.0
		panels.append(Transform3D(Basis.IDENTITY, Vector3(x, COUNTER_Y - 1.29, 1.3)))
		strips.append(Transform3D(Basis.IDENTITY, Vector3(x + 1.0, COUNTER_Y - 1.29, 1.31)))
	add_child(Models.swarm([{"mesh": panel, "xform": Transform3D.IDENTITY}], panels, 30.0))
	add_child(Models.swarm([{"mesh": strip, "xform": Transform3D.IDENTITY}], strips, 30.0))
	var stool := Models.node_by_height(DIR + "stoolBar.glb", 2.6, true)
	stool.position = Vector3(-4.6, FLOOR_Y + 0.05, 2.6)
	add_child(stool)


## Die Grill-Station (Welle A spielbar): dunkle Grillplatte mit Rosten,
## Glut-Streifen, dem ECHTEN Patty-Modell und Brutzel-Dampf darüber.
func _build_grill_station() -> void:
	var platte := MeshInstance3D.new()
	var pbox := BoxMesh.new()
	pbox.size = Vector3(3.6, 0.2, 2.4)
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = Color(0.2, 0.19, 0.21)
	pmat.metallic = 0.3
	pmat.roughness = 0.55
	pbox.material = pmat
	platte.mesh = pbox
	platte.position = Vector3(PATTY_POS.x, COUNTER_Y + 0.02, -0.5)
	add_child(platte)
	# Grill-Roste als MultiMesh (7 Stäbe, 1 Draw-Call).
	var stab := BoxMesh.new()
	stab.size = Vector3(3.3, 0.05, 0.09)
	var smat := StandardMaterial3D.new()
	smat.albedo_color = Color(0.35, 0.34, 0.37)
	smat.metallic = 0.5
	smat.roughness = 0.4
	stab.material = smat
	var poses: Array = []
	for i in 7:
		poses.append(
			Transform3D(
				Basis.IDENTITY, Vector3(PATTY_POS.x, COUNTER_Y + 0.13, -1.4 + i * 0.3)
			)
		)
	add_child(Models.swarm([{"mesh": stab, "xform": Transform3D.IDENTITY}], poses, 30.0))
	# Glut-Streifen an der Plattenfront: glüht stärker, je weiter die Garung.
	var glut := MeshInstance3D.new()
	var gbox := BoxMesh.new()
	gbox.size = Vector3(3.4, 0.14, 0.1)
	_heat_mat = StandardMaterial3D.new()
	_heat_mat.albedo_color = Color(1.0, 0.45, 0.25)
	_heat_mat.emission_enabled = true
	_heat_mat.emission = Color(1.0, 0.4, 0.2)
	_heat_mat.emission_energy_multiplier = 0.7
	gbox.material = _heat_mat
	glut.mesh = gbox
	glut.position = Vector3(PATTY_POS.x, COUNTER_Y - 0.04, 0.66)
	add_child(glut)
	# DER Patty: echtes Food-Kit-Modell, EIN geteiltes Override-Material,
	# dessen Albedo live dem Logik-Zustand folgt (rosa→goldbraun→Kohle).
	_patty = Models.node(DIR + "meat-patty.glb", 1.5, true)
	_patty.position = PATTY_POS
	_patty_mat = StandardMaterial3D.new()
	_patty_mat.albedo_color = FARBE_ROH
	_patty_mat.roughness = 0.8
	_uebermale(_patty, _patty_mat)
	add_child(_patty)


## Abholtheke rechts: Tablett mit fertigem Essen — hier warten die Kunden,
## hier feiert der Bestellung-fertig-Poof.
func _build_abholtheke() -> void:
	var tablett := Models.node(DIR + "plate-dinner.glb", 2.0, true)
	tablett.position = Vector3(TABLETT_POS.x, COUNTER_Y - 0.02, -0.5)
	add_child(tablett)
	var essen := [
		["burger.glb", 2.35, 0.85],
		["fries.glb", 3.0, 0.8],
		["soda.glb", 3.55, 0.75],
	]
	for entry: Array in essen:
		var prop := Models.node_by_height(DIR + str(entry[0]), float(entry[2]), true)
		prop.position = Vector3(float(entry[1]), COUNTER_Y + 0.02, -0.5)
		add_child(prop)


## Kulissen-Stationen für Welle B (Doc §2.2): Fritteuse/Shake-Gerät/Kühlung
## stehen schon im Raum — die Kamera muss später nur schwenken.
func _build_kulissen_stationen() -> void:
	var fridge := Models.node_by_height(DIR + "kitchenFridgeLarge.glb", 4.6, true)
	fridge.position = Vector3(-8.4, FLOOR_Y + 0.05, WALL_Z + 1.4)
	add_child(fridge)
	var herd := Models.node_by_height(DIR + "kitchenStove.glb", 2.6, true)
	herd.position = Vector3(7.9, FLOOR_Y + 0.05, WALL_Z + 1.6)
	add_child(herd)
	# „Shake-O-Matic“ (Kaffeemaschinen-Modell als Gag) + Mikrowelle.
	var shake := Models.node_by_height(DIR + "kitchenCoffeeMachine.glb", 1.4, true)
	shake.position = Vector3(-6.4, COUNTER_Y, -1.9)
	add_child(shake)
	var micro := Models.node_by_height(DIR + "kitchenMicrowave.glb", 1.1, true)
	micro.position = Vector3(6.6, COUNTER_Y, -1.9)
	add_child(micro)
	# Ketchup + Senf auf der Theke (Diner-Charakter im Nahbereich).
	for entry: Array in [[-5.3, Color(0.82, 0.24, 0.2)], [5.3, Color(0.95, 0.75, 0.25)]]:
		var bottle := Node3D.new()
		bottle.position = Vector3(float(entry[0]), COUNTER_Y, -0.4)
		add_child(bottle)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = entry[1]
		mat.roughness = 0.55
		var body := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.17
		cyl.bottom_radius = 0.21
		cyl.height = 0.62
		cyl.radial_segments = 10
		cyl.material = mat
		body.mesh = cyl
		body.position = Vector3(0.0, 0.31, 0.0)
		bottle.add_child(body)
		var tip := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.03
		cone.bottom_radius = 0.14
		cone.height = 0.26
		cone.radial_segments = 10
		cone.material = mat
		tip.mesh = cone
		tip.position = Vector3(0.0, 0.75, 0.0)
		bottle.add_child(tip)


## Hängelampen über Grill und Abholtheke — der Blickfang-Rahmen.
func _build_lampen(columns: Array) -> void:
	for cx: float in columns:
		var cord := MeshInstance3D.new()
		var cbox := BoxMesh.new()
		cbox.size = Vector3(0.06, 1.6, 0.06)
		var cmat := StandardMaterial3D.new()
		cmat.albedo_color = Color(0.3, 0.26, 0.24)
		cbox.material = cmat
		cord.mesh = cbox
		cord.position = Vector3(cx, 4.2, 1.4)
		add_child(cord)
		var shade := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.14
		cone.bottom_radius = 0.62
		cone.height = 0.6
		cone.radial_segments = 14
		var mat := StandardMaterial3D.new()
		mat.albedo_color = MARKE_ROT
		mat.roughness = 0.6
		cone.material = mat
		shade.mesh = cone
		shade.position = Vector3(cx, 3.2, 1.4)
		add_child(shade)
		var bulb := MeshInstance3D.new()
		var ball := SphereMesh.new()
		ball.radius = 0.22
		ball.height = 0.44
		ball.radial_segments = 10
		ball.rings = 6
		var bmat := StandardMaterial3D.new()
		bmat.albedo_color = Color(1.0, 0.93, 0.7)
		bmat.emission_enabled = true
		bmat.emission = Color(1.0, 0.88, 0.6)
		bmat.emission_energy_multiplier = 2.6
		ball.material = bmat
		bulb.mesh = ball
		bulb.position = Vector3(cx, 2.9, 1.4)
		add_child(bulb)
		var halo := MeshInstance3D.new()
		var quad := QuadMesh.new()
		quad.size = Vector2(1.7, 1.7)
		halo.mesh = quad
		var hmat := StandardMaterial3D.new()
		hmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		hmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		hmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		hmat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		hmat.albedo_color = Color(1.0, 0.82, 0.5, 0.34)
		hmat.albedo_texture = load(DIR + "vfx/circle_05.png")
		halo.material_override = hmat
		halo.position = Vector3(cx, 2.9, 1.4)
		add_child(halo)


## Gooby als Grill-Koch mit Papierhütchen — direkt hinter der Grillplatte,
## so „gehört“ ihm der Patty sichtbar.
func _build_koch() -> void:
	gooby = GoobyRig.new()
	gooby.name = "GoobyGriller"
	gooby.scale = Vector3.ONE * 3.9
	gooby.position = Vector3(PATTY_POS.x, COUNTER_Y - 1.5, -1.9)
	gooby.rotation_degrees = Vector3(0.0, 10.0, 0.0)
	add_child(gooby)
	# Tritt hinter der Theke (sonst schaut nur die Mütze über die Platte).
	var step := MeshInstance3D.new()
	var sbox := BoxMesh.new()
	sbox.size = Vector3(4.4, 1.6, 1.8)
	var smat := StandardMaterial3D.new()
	smat.albedo_color = Color(0.72, 0.5, 0.36)
	smat.roughness = 0.9
	sbox.material = smat
	step.mesh = sbox
	step.position = Vector3(PATTY_POS.x, COUNTER_Y - 2.3, -1.9)
	add_child(step)
	gooby.set_emotion(_emotion)
	_build_papierhut()


## McGooby-Papierhütchen (Schiffchen-Form) am Kopf-Knochen — bewegt sich mit
## jedem Clip/Emotions-Nicken mit (bone_mount-Muster der Kochmütze).
func _build_papierhut() -> void:
	var hat := Node3D.new()
	hat.position = Vector3(0.0, 0.38, -0.03)
	hat.rotation_degrees = Vector3(-6.0, 0.0, 6.0)
	Models.bone_mount(gooby).add_child(hat)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.99, 0.97)
	mat.roughness = 0.95
	var body := MeshInstance3D.new()
	var prism := CylinderMesh.new()
	prism.top_radius = 0.02
	prism.bottom_radius = 0.17
	prism.height = 0.22
	prism.radial_segments = 4
	prism.material = mat
	body.mesh = prism
	body.rotation_degrees = Vector3(0.0, 45.0, 0.0)
	body.position = Vector3(0.0, 0.1, 0.0)
	hat.add_child(body)
	# Rotes Markenband am HUT-Fuß (y leicht über dem Anker — auf 0 säße es
	# quer über Goobys Stirn statt am Papierhütchen).
	var band := MeshInstance3D.new()
	var bband := BoxMesh.new()
	bband.size = Vector3(0.3, 0.05, 0.22)
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = MARKE_ROT
	bband.material = bmat
	band.mesh = bband
	band.position = Vector3(0.0, 0.05, 0.0)
	hat.add_child(band)


## Zwei wartende Kunden-Goobys an der Abholtheke (rechts, im Hochkant-
## Ausschnitt sichtbar) — reines Publikum, das mitjubelt.
func _build_kunden() -> void:
	var plaetze: Array = [
		[Vector3(2.2, FLOOR_Y + 0.05, 2.2), -14.0, 3.2],
		[Vector3(3.4, FLOOR_Y + 0.05, 3.2), 18.0, 3.0],
	]
	for platz: Array in plaetze:
		var kunde := GoobyRig.new()
		kunde.scale = Vector3.ONE * float(platz[2])
		kunde.position = platz[0]
		kunde.rotation_degrees = Vector3(0.0, float(platz[1]), 0.0)
		add_child(kunde)
		kunde.set_emotion("happy")
		_kunden.append(kunde)
		_kunden_basen.append(kunde.position)


func _build_effects() -> void:
	_pop = (
		Puff
		. burst(
			DIR + "vfx/star_03.png",
			{
				"amount": 20,
				"lifetime": 0.6,
				"size": 0.34,
				"dir": Vector3.UP,
				"spread": 150.0,
				"speed": Vector2(1.6, 3.4),
				"gravity": Vector3(0.0, -4.0, 0.0),
				"color": Color(1.0, 0.9, 0.55, 1.0),
				"color_end": Color(1.0, 0.7, 0.4, 0.0),
				"local": false,
			}
		)
	)
	add_child(_pop)
	# Brutzel-Dampf überm Patty (ADDITIV — die Kenney-Sprites haben
	# schwarzen Grund, Alpha-Blending würde dunkle Quadrate malen).
	_sizzle = (
		Puff
		. stream(
			DIR + "vfx/circle_05.png",
			{
				"amount": 10,
				"lifetime": 1.6,
				"size": 0.44,
				"dir": Vector3.UP,
				"spread": 12.0,
				"speed": Vector2(0.6, 1.2),
				"gravity": Vector3(0.0, 0.5, 0.0),
				"color": Color(1.0, 0.95, 0.88, 0.22),
				"color_end": Color(1.0, 1.0, 1.0, 0.0),
				"scale_range": Vector2(0.6, 1.8),
				"emitting": false,
			}
		)
	)
	_sizzle.position = PATTY_POS + Vector3(0.0, 0.3, 0.0)
	add_child(_sizzle)
	# Kohle-Qualm (Gag, kein Fail-State): dunkler, träger, nur bei „kohle“.
	_qualm = (
		Puff
		. stream(
			DIR + "vfx/circle_05.png",
			{
				"amount": 8,
				"lifetime": 2.2,
				"size": 0.5,
				"dir": Vector3.UP,
				"spread": 16.0,
				"speed": Vector2(0.4, 0.8),
				"gravity": Vector3(0.0, 0.6, 0.0),
				"color": Color(0.36, 0.32, 0.3, 0.3),
				"color_end": Color(0.3, 0.28, 0.27, 0.0),
				"scale_range": Vector2(0.8, 2.2),
				"add": false,
				"emitting": false,
			}
		)
	)
	_qualm.position = PATTY_POS + Vector3(0.0, 0.4, 0.0)
	add_child(_qualm)


## Alle Meshes einer GLB-Instanz mit EINEM geteilten Material übermalen
## (der Patty wechselt die Farbe über genau diese eine Material-Referenz).
func _uebermale(node3d: Node, mat: StandardMaterial3D) -> void:
	if node3d is MeshInstance3D:
		(node3d as MeshInstance3D).material_override = mat
	for child in node3d.get_children():
		_uebermale(child, mat)
