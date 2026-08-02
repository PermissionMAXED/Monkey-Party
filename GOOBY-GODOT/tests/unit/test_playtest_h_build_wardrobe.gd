extends TestCase
## PLAYTEST-H (Baumodus/Garderobe/Gestalten) — Guard-Tests der drei Fixes:
## - BUG 1: Garderoben-Cosmetics erscheinen am HOME-Gooby (vorher nur in der
##   Garderoben-Vorschau — im Raum lief Gooby immer nackt herum).
## - BUG 2: Unter eine wartende SURFACE-Deko (Träger im Lager, E9-P1-1-
##   Gnadenfrist) darf kein Nicht-Träger-Bodenmöbel — sonst clippte die Deko
##   ins Möbel und ging beim nächsten Raum-Load still als Leftover verloren.
## - BUG 3: Die Gestalten-Tapete überlebt den Wand-Neubau nach einem
##   Fenster-Umbau (vorher fielen alle Wall_*-Meshes aufs Default zurück).

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

var _seq := 0


func _fresh_gs() -> Node:
	_seq += 1
	var dir := "user://playtest_h/case_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	HomeState.register_slice()
	var gs: Node = GameStateScript.new()
	gs.initialize(dir + "/save_v5.json")
	return gs


func _open_room(gs: Node, scene_path: String) -> RoomBase:
	var scene: PackedScene = load(scene_path)
	var room: RoomBase = scene.instantiate()
	room.game_state_override = gs
	tree.root.add_child(room)
	await wait_frames(4)
	return room


func _cleanup(room: Node, gs: Node) -> void:
	if room != null:
		room.queue_free()
	await wait_frames(2)
	gs.free()
	SaveSchema.unregister_slice(HomeState.SLICE_ID)
	HomeState.reset_for_tests()


## BUG 1: Hut + Premium-Fell in der Garderobe angelegt → der Gooby IM RAUM
## trägt beides (CosmeticAttach am Home-Rig) und folgt Änderungen live.
func test_home_gooby_traegt_garderobe() -> void:
	var gs := _fresh_gs()
	CosmeticsState.apply_to_state(
		gs,
		func(slice: Dictionary, _econ: Dictionary) -> Variant:
			CosmeticsState.grant(slice, "partyHat")
			CosmeticsState.grant(slice, "midnight")
			CosmeticsState.equip(slice, "partyHat")
			CosmeticsState.equip(slice, "midnight")
			return true
	)
	var room := await _open_room(gs, "res://scenes/home/wohnzimmer.tscn")
	var gooby := room.gooby()
	assert_true(gooby != null, "Gooby im Raum")
	var attach: CosmeticAttach = null
	if gooby != null:
		attach = gooby.rig.get_node_or_null("CosmeticAttach")
	assert_true(attach != null, "CosmeticAttach am Home-Gooby (BUG 1)")
	if attach != null:
		assert_eq(attach.getragene_id("hut"), "partyHat", "Partyhut sitzt im Raum")
		assert_eq(attach.getragene_id("fell"), "midnight", "Mitternacht-Fell angelegt")
	# Live-Folgen: Hut abgelegt (slice_changed) → der Raum-Gooby zieht nach.
	CosmeticsState.apply_to_state(
		gs,
		func(slice: Dictionary, _econ: Dictionary) -> Variant:
			CosmeticsState.unequip(slice, "hut")
			return true
	)
	await wait_frames(1)
	if attach != null:
		assert_eq(attach.getragene_id("hut"), "", "Hut live abgelegt")
		assert_eq(attach.getragene_id("fell"), "midnight", "Fell bleibt an")
	await _cleanup(room, gs)


## BUG 2: Träger weg → Nicht-Träger dürfen NICHT unter die wartende Deko;
## ein neuer Träger darf weiterhin zurück (E9-P1-1-Gnadenfrist bleibt).
func test_kein_bodenmoebel_unter_wartender_deko() -> void:
	var grid := GridData.new(Vector2i(8, 8))
	var table := FurnitureCatalog.def("sideTable")
	var lamp := FurnitureCatalog.def("lampRoundTable")
	var chair := FurnitureCatalog.def("chair")
	var fridge := FurnitureCatalog.def("kitchenFridge")
	assert_true(grid.place(table, Vector2i(2, 2), 0, "t1")["ok"], "Tisch steht")
	assert_true(grid.place(lamp, Vector2i(2, 2), 0, "l1")["ok"], "Lampe auf dem Tisch")
	grid.remove_item("t1")  # Einlagern des Trägers — die Lampe wartet.
	var stuhl_check := grid.can_place(chair, Vector2i(2, 2), 0)
	assert_false(bool(stuhl_check["ok"]), "Stuhl nicht unter die wartende Lampe (BUG 2)")
	assert_eq(str(stuhl_check["reason"]), GridData.REASON_OCCUPIED, "Grund: Zelle belegt")
	# 2×2-Kühlschrank, dessen Footprint die Lampen-Zelle nur überlappt.
	assert_false(
		bool(grid.can_place(fridge, Vector2i(1, 1), 0)["ok"]),
		"auch überlappende Nicht-Träger bleiben draußen"
	)
	assert_true(
		bool(grid.can_place(table, Vector2i(2, 2), 0)["ok"]),
		"neuer Träger darf zurück unter die Lampe (E9 P1-1)"
	)
	assert_true(grid.place(chair, Vector2i(5, 5), 0, "c1")["ok"], "Stuhl woanders platziert")
	assert_false(
		bool(grid.move_item("c1", Vector2i(2, 2), 0)["ok"]),
		"auch Verschieben führt nicht unter die Lampe"
	)
	# Lampe wieder auf einem Träger → Zelle ist ganz normal belegt (FLOOR).
	assert_true(grid.place(table, Vector2i(2, 2), 0, "t2")["ok"], "Träger zurückgestellt")
	assert_eq(grid.item_at(Vector2i(2, 2), GridData.Layer.SURFACE), "l1", "Lampe steht drauf")


## BUG 3: Tapete (HouseStyle) überlebt den Wand-Neubau nach Fenster-Umbau —
## alle Wall_*-Meshes tragen danach wieder das GETEILTE Gestalten-Material.
func test_tapete_ueberlebt_fenster_umbau() -> void:
	var gs := _fresh_gs()
	var room := await _open_room(gs, "res://scenes/home/schlafzimmer.tscn")
	var erwartet := HouseStyle.flaechen_material("wand", CustomizeCatalog.raum_default("bedroom"))
	assert_true(_waende_tragen(room, erwartet), "Tapete nach _ready() angewendet")
	var window := FurnitureCatalog.def("window_small")
	var platziert := false
	for offset in room.grid.wall_width("N"):
		if bool(room.grid.can_place_wall(window, "N", offset)["ok"]):
			room.grid.place_wall(window, "N", offset, "test-window")
			platziert = true
			break
	assert_true(platziert, "freier Außenwand-Slot für das Testfenster")
	room.rebuild_furniture()
	await wait_frames(2)
	assert_true(_waende_tragen(room, erwartet), "Tapete überlebt den Fenster-Umbau (BUG 3)")
	await _cleanup(room, gs)


## Tragen ALLE Wall_*-Meshes des aktuellen Walls-Mounts das Material?
func _waende_tragen(room: RoomBase, material: Material) -> bool:
	var walls := room.find_child("Walls", true, false)
	if walls == null:
		return false
	var anzahl := 0
	for kind in walls.get_children():
		if kind is MeshInstance3D and str(kind.name).begins_with(HouseStyle.WALL_PREFIX):
			anzahl += 1
			if (kind as MeshInstance3D).material_override != material:
				return false
	return anzahl > 0
