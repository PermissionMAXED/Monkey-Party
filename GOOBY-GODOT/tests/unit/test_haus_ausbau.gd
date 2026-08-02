extends TestCase
## I-07 (Welle K) — HausAusbau: Keller/Zweite Etage/Balkon sind kaufbare
## Räume. Daten-Integrität (Preise, requires, Tür-Kinds), Tür-Freischaltung
## (zugemauert bis zum Kauf), der Kauf-Pfad über EconomyLogic und der
## crash-sichere Einweihungs-Feier-Lebenszyklus.

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

const NOW_MS := 1768478400000

var _seq := 0


func _fresh_gs() -> Node:
	_seq += 1
	var dir := "user://ausbau_tests/%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	HomeState.register_slice()
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.initialize(dir + "/save_v5.json")
	return gs


func _teardown(gs: Node) -> void:
	gs.free()
	SaveSchema.unregister_slice(HomeState.SLICE_ID)
	HomeState.reset_for_tests()


func test_ausbau_daten_integritaet() -> void:
	assert_eq(HausAusbau.ausbau_ids(), ["balcony", "basement", "floor2"], "3 Ausbauten")
	for room_id: String in HausAusbau.ausbau_ids():
		assert_true(HausAusbau.preis(room_id) > 0, "%s: Preis > 0" % room_id)
		for noetig: Variant in HausAusbau.voraussetzungen(room_id):
			assert_false(
				RoomDefs.room(str(noetig)).is_empty(),
				"%s: requires %s existiert" % [room_id, noetig]
			)
	# Treppen/Glastür-Kinds sitzen auf BEIDEN Seiten jeder Ausbau-Verbindung.
	assert_eq(str(RoomDefs.door("living", "living_etage")["kind"]), "treppe_rauf")
	assert_eq(str(RoomDefs.door("floor2", "etage_living")["kind"]), "treppe_runter")
	assert_eq(str(RoomDefs.door("living", "living_keller")["kind"]), "treppe_runter")
	assert_eq(str(RoomDefs.door("basement", "keller_living")["kind"]), "treppe_rauf")
	assert_eq(str(RoomDefs.door("floor2", "etage_balkon")["kind"]), "glastuer")
	assert_eq(str(RoomDefs.door("balcony", "balkon_etage")["kind"]), "glastuer")
	# Der Keller ist ein Keller: keine Fenster, keine Außenwände.
	assert_eq(RoomDefs.room("basement")["windows"], [], "Keller ohne Fenster")
	assert_true(RoomDefs.exterior_walls(RoomDefs.room("basement")).is_empty(), "unterirdisch")


func test_tuer_frei_und_wand_spans_ohne_kauf() -> void:
	var gs := _fresh_gs()
	var living := RoomDefs.room("living")
	for door_def: Dictionary in living["doors"]:
		var ziel := str(door_def["to"])
		var erwartet := not HausAusbau.ist_ausbau(ziel)
		assert_eq(HausAusbau.tuer_frei(gs, door_def), erwartet, "living→%s" % ziel)
	# Wand-Öffnungen: nur die freien Türen; die Grid-Blockade kennt ALLE.
	var offen := HausAusbau.offene_tuer_spans(gs, living)
	var alle := RoomDefs.wall_door_spans(living)
	assert_eq(offen.get("N", []).size(), 1, "Küchen-Tür offen")
	assert_eq(offen.get("W", []).size(), 1, "nur Schlafzimmer-Tür (Treppe zu)")
	assert_eq(alle.get("W", []).size(), 2, "Blockade kennt auch die Treppe")
	assert_eq(offen.get("E", []).size(), 1, "nur Garten-Tür (Keller zu)")
	assert_eq(alle.get("E", []).size(), 2)
	# Ohne GameState (isolierte Szenen) bleiben Ausbauten ebenfalls zu.
	assert_false(HausAusbau.tuer_frei(null, RoomDefs.door("living", "living_etage")))
	_teardown(gs)


func test_kauf_pfad_muenzen_und_freischaltung() -> void:
	var gs := _fresh_gs()
	# Frische Saves starten mit ein paar Start-Münzen — dynamisch rechnen.
	var start := int(gs.get_value("economy.coins"))
	assert_true(start < 8000, "Start-Münzen reichen NICHT für den Keller")
	assert_false(HausAusbau.kann_kaufen(gs, "basement"), "zu wenig Münzen → kein Kauf")
	assert_eq(HausAusbau.fehlende_muenzen(gs, "basement"), 8000 - start)
	assert_false(HausAusbau.kaufen(gs, "basement"), "kaufen() lehnt sauber ab")
	gs.set_value("economy.coins", 10000)
	assert_true(HausAusbau.kann_kaufen(gs, "basement"))
	assert_true(HausAusbau.kaufen(gs, "basement"), "Kauf läuft")
	assert_eq(int(gs.get_value("economy.coins")), 2000, "8000 Münzen abgebucht")
	assert_true(HomeState.is_room_unlocked(gs, "basement"), "Raum freigeschaltet")
	assert_true(
		HausAusbau.tuer_frei(gs, RoomDefs.door("living", "living_keller")), "Treppe begehbar"
	)
	assert_false(HausAusbau.kann_kaufen(gs, "basement"), "nie doppelt kaufbar")
	assert_false(HausAusbau.kaufen(gs, "basement"))
	assert_eq(int(gs.get_value("economy.coins")), 2000, "kein Doppel-Abzug")
	_teardown(gs)


func test_balkon_braucht_erst_die_etage() -> void:
	var gs := _fresh_gs()
	gs.set_value("economy.coins", 50000)
	assert_eq(HausAusbau.fehlende_voraussetzung(gs, "balcony"), "floor2")
	assert_false(HausAusbau.kann_kaufen(gs, "balcony"), "requires gilt")
	assert_false(HausAusbau.kaufen(gs, "balcony"))
	assert_eq(int(gs.get_value("economy.coins")), 50000, "nichts abgebucht")
	assert_true(HausAusbau.kaufen(gs, "floor2"), "Etage zuerst")
	assert_eq(HausAusbau.fehlende_voraussetzung(gs, "balcony"), "")
	assert_true(HausAusbau.kaufen(gs, "balcony"), "jetzt geht der Balkon")
	assert_eq(int(gs.get_value("economy.coins")), 50000 - 15000 - 5000)
	_teardown(gs)


func test_feier_lebenszyklus_crash_sicher() -> void:
	var gs := _fresh_gs()
	gs.set_value("economy.coins", 8000)
	assert_false(HausAusbau.feier_faellig(gs, "basement"), "vor dem Kauf keine Feier")
	assert_true(HausAusbau.kaufen(gs, "basement"))
	# Kauf persistiert die Feier ALS Flag — überlebt also einen Crash
	# zwischen Kauf und Inszenierung (wie bei den Fohlen-Momenten).
	assert_true(HausAusbau.feier_faellig(gs, "basement"), "Feier vorgemerkt")
	HausAusbau.feier_abgeholt(gs, "basement")
	assert_false(HausAusbau.feier_faellig(gs, "basement"), "genau einmal gefeiert")
	_teardown(gs)


func test_flow_portale_kaufkarte_und_neubau() -> void:
	var gs := _fresh_gs()
	var scene: PackedScene = load("res://scenes/home/wohnzimmer.tscn")
	var room: RoomBase = scene.instantiate()
	room.game_state_override = gs
	tree.root.add_child(room)
	await wait_frames(4)
	var flow := HausAusbauFlow.attach_to(room)
	assert_true(flow != null, "Flow hängt am Raum")
	assert_eq(HausAusbauFlow.attach_to(room), flow, "idempotent")
	await wait_frames(2)
	# Vor dem Kauf: Bauplan-Portale statt Türen an beiden Ausbau-Wänden.
	assert_true(room.get_node_or_null("Bauplan_living_etage") != null, "Etagen-Portal")
	assert_true(room.get_node_or_null("Bauplan_living_keller") != null, "Keller-Portal")
	assert_true(room.get_node_or_null("Door_living_keller") == null, "noch keine Treppe")
	# Tap aufs Portal öffnet die Kauf-Karte.
	flow._on_portal_tapped("living_keller")
	await wait_frames(1)
	var karte := room.ui_layer().get_node_or_null("AusbauKarte")
	assert_true(karte != null, "Kauf-Karte offen")
	# „Später" schließt ohne Abbuchung.
	flow._on_karte_entschieden(RoomDefs.door("living", "living_keller"), false)
	await wait_frames(2)
	assert_true(room.ui_layer().get_node_or_null("AusbauKarte") == null, "Karte zu")
	# Kauf + Raum-Neubau (im Spiel via Router-Reload): Treppe statt Portal.
	gs.set_value("economy.coins", 8000)
	assert_true(HausAusbau.kaufen(gs, "basement"))
	room.queue_free()
	await wait_frames(2)
	var neu: RoomBase = scene.instantiate()
	neu.game_state_override = gs
	tree.root.add_child(neu)
	await wait_frames(4)
	var flow2 := HausAusbauFlow.attach_to(neu)
	assert_true(neu.get_node_or_null("Door_living_keller") != null, "Treppen-Tür steht")
	assert_true(neu.get_node_or_null("Bauplan_living_keller") == null, "Portal weg")
	assert_true(neu.get_node_or_null("Bauplan_living_etage") != null, "Etage weiter kaufbar")
	# Einweihungs-Feier: Flag wird beim Ankommen genau einmal abgeholt.
	assert_true(flow2 != null, "Flow am neuen Raum")
	var gefeiert := await wait_until(
		func() -> bool: return not HausAusbau.feier_faellig(gs, "basement"), 8000
	)
	assert_true(gefeiert, "Feier abgeholt (Tür-Plopp + Spruch)")
	await wait_until(func() -> bool: return not neu._rebake_pending, 3000)
	neu.queue_free()
	await wait_frames(2)
	_teardown(gs)


func test_balkon_haengt_am_haus_statt_im_garten() -> void:
	# Die N-Wand des Balkons ist HAUSFASSADE (volle Höhe, Wandfarbe), die
	# übrigen Seiten sind Geländer — und das Garten-Außenmodell gehört
	# NICHT auf den Balkon (das Haus stünde sonst doppelt in der Szene).
	var balkon_def := RoomDefs.room("balcony")
	assert_false(HouseLayout.zaun_wand(balkon_def, "N"), "N = Hauswand")
	for wall: String in ["S", "W", "E"]:
		assert_true(HouseLayout.zaun_wand(balkon_def, wall), "%s = Geländer" % wall)
	assert_eq(HouseLayout.wand_farbe(balkon_def, "N"), balkon_def["wall_color"])
	assert_eq(HouseLayout.wand_farbe(balkon_def, "S"), HouseLayout.ZAUN_FARBE)
	assert_false(HouseLayout.zaun_wand(RoomDefs.room("living"), "N"), "innen nie Zaun")
	var gs := _fresh_gs()
	gs.set_value("economy.coins", 20000)
	assert_true(HausAusbau.kaufen(gs, "floor2"))
	assert_true(HausAusbau.kaufen(gs, "balcony"))
	var scene: PackedScene = load("res://scenes/home/balkon.tscn")
	var room: RoomBase = scene.instantiate()
	room.game_state_override = gs
	tree.root.add_child(room)
	await wait_frames(4)
	assert_true(room.get_node_or_null("GartenHaus") == null, "kein Außenmodell")
	assert_true(room.get_node_or_null("Door_balkon_etage") != null, "Glastür steht")
	var blick := room.get_node_or_null("FlurBlick")
	assert_true(
		blick != null and blick.get_node_or_null("Nische_balkon_etage") != null,
		"durchs Glas: Nische zurück ins Haus"
	)
	var hoechste_n := 0.0
	var hoechste_s := 0.0
	for wand: Node in room.get_node("Walls").get_children():
		if not (wand is MeshInstance3D and str(wand.name).begins_with("Wall_")):
			continue
		var hoehe := ((wand as MeshInstance3D).mesh as BoxMesh).size.y
		if str(wand.name).begins_with("Wall_N_"):
			hoechste_n = maxf(hoechste_n, hoehe)
		elif str(wand.name).begins_with("Wall_S_"):
			hoechste_s = maxf(hoechste_s, hoehe)
	assert_true(hoechste_n > 2.0, "N-Wand hat volle Haushöhe (%.2f)" % hoechste_n)
	assert_true(hoechste_s <= RoomBase.FENCE_HEIGHT + 0.01, "S bleibt Geländer (%.2f)" % hoechste_s)
	room.queue_free()
	await wait_frames(2)
	_teardown(gs)


func test_raum_sichtbar_fuer_ui_listen() -> void:
	var gs := _fresh_gs()
	assert_true(HausAusbau.raum_sichtbar(gs, "living"), "Basis-Räume immer sichtbar")
	assert_false(HausAusbau.raum_sichtbar(gs, "floor2"), "gesperrte Ausbauten versteckt")
	gs.set_value("economy.coins", 15000)
	assert_true(HausAusbau.kaufen(gs, "floor2"))
	assert_true(HausAusbau.raum_sichtbar(gs, "floor2"), "nach dem Kauf sichtbar")
	_teardown(gs)
