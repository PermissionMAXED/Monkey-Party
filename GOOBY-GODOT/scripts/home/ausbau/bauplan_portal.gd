class_name BauplanPortal
extends Node3D
## Bauplan-Portal (I-07): Wo später Treppe/Glastür eines gekauften Ausbaus
## steht, hängt vorher diese Blaupausen-Silhouette an der Wand — Geister-
## Zarge in Pastellblau plus Holz-Schild mit Raumname und Preis. Antippen
## öffnet die Kauf-Karte (haus_ausbau_flow.gd). Lokales Koordinatensystem
## wie DoorTransition: +Z zeigt in den Raum.

signal tapped(door_id: String)

const GEIST_FARBE := Color(0.5, 0.72, 0.91, 0.42)
const SCHILD_HOLZ := Color(0.62, 0.45, 0.28)
const SCHRIFT_FARBE := Color(0.32, 0.22, 0.12)

var door_id := ""

var _breite := RoomDefs.DOOR_WIDTH * GridData.CELL_SIZE


## Baut die Optik + Tap-Fläche (vom Flow gerufen).
func setup(p_door_id: String, raum_name: String, preis_text: String) -> void:
	door_id = p_door_id
	name = "Bauplan_%s" % door_id
	_baue_geist_zarge()
	_baue_schild(raum_name, preis_text)
	_baue_tap_area()


func _baue_geist_zarge() -> void:
	var hoehe := DoorTransition.DOOR_HEIGHT
	for seite in [-1.0, 1.0]:
		var pfosten := _geist_box(Vector3(0.09, hoehe, 0.12))
		pfosten.position = Vector3(seite * (_breite * 0.5 + 0.05), hoehe * 0.5, 0.03)
		add_child(pfosten)
	var sturz := _geist_box(Vector3(_breite + 0.28, 0.1, 0.12))
	sturz.position = Vector3(0.0, hoehe + 0.05, 0.03)
	add_child(sturz)
	# Angedeutete Stufen-Silhouette in der Öffnung (Blaupausen-Look).
	for i in 3:
		var stufe := _geist_box(Vector3(_breite * 0.72, 0.07, 0.09))
		stufe.position = Vector3(0.0, 0.28 + i * 0.5, 0.03)
		add_child(stufe)


func _baue_schild(raum_name: String, preis_text: String) -> void:
	var brett := MeshInstance3D.new()
	brett.name = "Schild"
	var box := BoxMesh.new()
	box.size = Vector3(_breite * 0.94, 0.56, 0.05)
	brett.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = SCHILD_HOLZ
	mat.roughness = 0.9
	brett.material_override = mat
	brett.position = Vector3(0.0, 1.28, 0.1)
	add_child(brett)
	_label(raum_name, 64, Vector3(0.0, 0.12, 0.035), brett)
	_label(preis_text, 48, Vector3(0.0, -0.13, 0.035), brett)


func _label(text: String, groesse: int, pos: Vector3, parent: Node3D) -> void:
	var label := Label3D.new()
	label.text = text
	label.font_size = groesse
	label.pixel_size = 0.0022
	label.modulate = SCHRIFT_FARBE
	label.position = pos
	parent.add_child(label)


func _baue_tap_area() -> void:
	var area := Area3D.new()
	area.name = "TapArea"
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(_breite + 0.3, DoorTransition.DOOR_HEIGHT + 0.2, 0.6)
	shape.shape = box
	shape.position = Vector3(0.0, DoorTransition.DOOR_HEIGHT * 0.5, 0.15)
	area.add_child(shape)
	area.input_event.connect(_on_area_input)
	add_child(area)


func _on_area_input(
	_cam: Node, event: InputEvent, _pos: Vector3, _normal: Vector3, _idx: int
) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and event.pressed)
		or (event is InputEventScreenTouch and event.pressed)
	)
	if pressed:
		tapped.emit(door_id)


func _geist_box(groesse: Vector3) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = groesse
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GEIST_FARBE
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.emission_enabled = true
	mat.emission = Color(0.55, 0.75, 0.95)
	mat.emission_energy_multiplier = 0.25
	mat.roughness = 1.0
	mesh.material_override = mat
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mesh
