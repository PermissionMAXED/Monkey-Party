extends SceneTree
## I-07-Screenshot-Tool (KEIN Test — kein test_-Präfix): rendert die
## Review-Artefakte für den Haus-Ausbau „Keller + Zweite Etage + Balkon".
## Motive: Bauplan-Portale im Wohnzimmer, Kauf-Karte, gebaute Keller-Treppe,
## Keller (Funzel-Licht), Zweite Etage (Dachschräge + Balkon-Glastür), Balkon.
## Aufruf:
##   xvfb-run -a godot --path . --rendering-method gl_compatibility \
##     --rendering-driver opengl3 --audio-driver Dummy \
##     --script res://tests/unit/ausbau_screens.gd

const OUT_DIR := "/tmp/gooby-godot/artifacts/AUSBAU"
const SETTLE := 40

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

var _gs: Node


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	DisplayServer.window_set_size(Vector2i(1280, 720))
	root.size = Vector2i(1280, 720)
	var dir := "user://ausbau_shots/%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	HomeState.register_slice()
	_gs = GameStateScript.new()
	_gs.initialize(dir + "/save_v5.json")
	HomeState.ensure_initialized(_gs)
	HomeState.set_flag(_gs, HomeState.FLAG_BED_PLACED, true)
	await _portal_shots()
	_gs.set_value("economy.coins", 30000)
	assert(HausAusbau.kaufen(_gs, "basement"))
	await _treppe_shot()
	await _keller_shot()
	assert(HausAusbau.kaufen(_gs, "floor2"))
	await _etage_shot()
	assert(HausAusbau.kaufen(_gs, "balcony"))
	await _balkon_shot()
	print("Screenshots fertig -> %s" % OUT_DIR)
	_gs.free()
	SaveSchema.unregister_slice(HomeState.SLICE_ID)
	HomeState.reset_for_tests()
	quit(0)


## Wohnzimmer VOR dem Kauf: Blaupausen-Portale an beiden Wänden + Kauf-Karte.
func _portal_shots() -> void:
	var room := await _open_room("living", "")
	var flow := HausAusbauFlow.attach_to(room)
	await _settle(10)
	var rig: HomeCameraRig = room.camera_rig()
	rig.set_process(false)
	rig.camera.global_position = Vector3(6.2, 2.6, 6.2)
	rig.camera.look_at(Vector3(0.4, 1.1, 1.0))
	await _settle(SETTLE)
	await _shot("ausbau_1_portal_etage.png")
	rig.camera.global_position = Vector3(3.2, 2.3, 2.6)
	rig.camera.look_at(Vector3(6.0, 1.1, 4.5))
	await _settle(20)
	await _shot("ausbau_2_portal_keller.png")
	flow._on_portal_tapped("living_keller")
	await _settle(20)
	await _shot("ausbau_3_kaufkarte.png")
	await _close_room(room)


## Nach dem Keller-Kauf: offener Treppen-Durchgang, Stufen fallen ab.
func _treppe_shot() -> void:
	var room := await _open_room("living", "")
	var rig: HomeCameraRig = room.camera_rig()
	rig.set_process(false)
	rig.camera.global_position = Vector3(2.6, 1.9, 2.0)
	rig.camera.look_at(Vector3(6.05, 0.5, 4.6))
	await _settle(SETTLE)
	await _shot("ausbau_4_treppe_gebaut.png")
	await _close_room(room)


func _keller_shot() -> void:
	var room := await _open_room("basement", "keller_living")
	var rig: HomeCameraRig = room.camera_rig()
	rig.set_process(false)
	rig.camera.global_position = Vector3(5.2, 2.4, 6.8)
	rig.camera.look_at(Vector3(2.6, 0.9, 0.6))
	await _settle(SETTLE)
	await _shot("ausbau_5_keller.png")
	await _close_room(room)


## Zweite Etage: Dachschräge + Glastür-Portal Richtung Balkon (E-Wand).
func _etage_shot() -> void:
	var room := await _open_room("floor2", "etage_living")
	HausAusbauFlow.attach_to(room)
	await _settle(10)
	var rig: HomeCameraRig = room.camera_rig()
	rig.set_process(false)
	rig.camera.global_position = Vector3(2.2, 2.4, 6.6)
	rig.camera.look_at(Vector3(6.0, 1.1, 3.0))
	await _settle(SETTLE)
	await _shot("ausbau_6_etage_mit_balkon_portal.png")
	await _close_room(room)


func _balkon_shot() -> void:
	var room := await _open_room("balcony", "balkon_etage")
	var rig: HomeCameraRig = room.camera_rig()
	rig.set_process(false)
	rig.camera.global_position = Vector3(3.2, 2.2, 4.6)
	rig.camera.look_at(Vector3(1.9, 0.95, 0.1))
	await _settle(SETTLE)
	await _shot("ausbau_7_balkon.png")
	await _close_room(room)


func _open_room(room_id: String, door_id: String) -> RoomBase:
	var pfad: String = RoomDefs.room(room_id)["scene"]
	var scene: PackedScene = load(pfad)
	var room: RoomBase = scene.instantiate()
	room.game_state_override = _gs
	room.stunde_override = 13.0
	if door_id != "":
		room.receive_params({"door_id": door_id})
	root.add_child(room)
	await _settle(60)
	return room


func _close_room(room: Node) -> void:
	root.remove_child(room)
	room.queue_free()
	await _settle(4)


func _settle(frames: int) -> void:
	for _i in frames:
		await process_frame


func _shot(file: String) -> void:
	await process_frame
	var image := root.get_texture().get_image()
	image.save_png("%s/%s" % [OUT_DIR, file])
	print("shot: %s" % file)
