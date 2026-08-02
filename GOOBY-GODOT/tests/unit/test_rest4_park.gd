extends TestCase
## REST-4 — Funkelpark (EVAL Rang 9): ParkState-Übergänge, die pure
## CoasterLogic (komplette Runde headless, Tempo-Klemmen, Event-Reihenfolge)
## und die Funkelpark-Szene inklusive bezahlter Fahrten. Der Gondel-Test
## pinnt den gemeldeten Fehler des Vorgänger-Branches: Gooby sitzt als
## echtes Kind im Wagen/in der Gondel und sein Sitzabstand bleibt während
## der GANZEN Fahrt konstant klein — er kann nicht herausfallen.

const SaveSchema := preload("res://scripts/state/save_schema.gd")
const ClockScript := preload("res://scripts/logic/clock.gd")


## GameState-Double: dotted get/set + update(mutator) wie /root/GameState.
class FakeGameState:
	extends RefCounted
	var state: Dictionary = {}
	var slices_notified: Array[String] = []

	func _init() -> void:
		state = SaveSchema.default_state(1700000000000)

	func get_value(path: String, fallback: Variant = null) -> Variant:
		var node: Variant = state
		for part in path.split("."):
			if node is Dictionary and (node as Dictionary).has(part):
				node = node[part]
			else:
				return fallback
		return node

	func set_value(path: String, wert: Variant) -> void:
		var teile := path.split(".")
		var node: Dictionary = state
		for i in teile.size() - 1:
			if not (node.get(teile[i]) is Dictionary):
				node[teile[i]] = {}
			node = node[teile[i]]
		node[teile[teile.size() - 1]] = wert

	func update(mutator: Callable) -> void:
		mutator.call(state)

	func notify_slice_changed(slice_id: String) -> void:
		slices_notified.append(slice_id)


## Double MIT pinnbarer Uhr — Funkelpark.stunde() liest gs.clock (W1d).
class FakeClockGameState:
	extends FakeGameState
	var clock: Object = null


## ------------------------------------------------------- ParkState (pur)


func test_park_state_uebergaenge() -> void:
	var s := ParkState.record_visit(null)
	assert_eq(int(s["visits"]), 1, "erster Besuch zählt")
	assert_false(bool(s["nightVisit"]), "Tag-Besuch latcht keine Nacht")
	s = ParkState.record_visit(s, true)
	assert_eq(int(s["visits"]), 2)
	assert_true(bool(s["nightVisit"]), "Nacht-Besuch latcht nightVisit")
	s = ParkState.record_ride(s, "coaster")
	s = ParkState.record_ride(s, "coaster")
	s = ParkState.record_ride(s, "wheel")
	s = ParkState.record_ride(s, "ufo")
	assert_eq(int(s["rides"]["coaster"]), 2)
	assert_eq(int(s["rides"]["wheel"]), 1)
	assert_false((s["rides"] as Dictionary).has("ufo"), "unbekannte Ride-Id fliegt raus")
	s = ParkState.record_candy(s)
	s = ParkState.record_hands_up(s)
	assert_eq(int(s["candyBought"]), 1)
	assert_eq(int(s["handsUp"]), 1)


func test_park_state_nachtband() -> void:
	assert_true(ParkState.ist_nacht(19.0), "19 Uhr = Nacht")
	assert_true(ParkState.ist_nacht(23.5))
	assert_true(ParkState.ist_nacht(3.0))
	assert_false(ParkState.ist_nacht(6.0), "6 Uhr = Morgen")
	assert_false(ParkState.ist_nacht(12.0))


func test_park_state_klemmt_muell() -> void:
	var s := ParkState.slice_of({"park": {"visits": -3, "rides": {"coaster": 1e12}}})
	assert_eq(int(s["visits"]), 0, "negative Zähler klemmen auf 0")
	assert_eq(int(s["rides"]["coaster"]), ParkState.MAX_COUNT, "Riesenwerte klemmen")
	var leer := ParkState.slice_of({"park": "quatsch"})
	assert_eq(int(leer["visits"]), 0, "Nicht-Dict fällt auf Defaults")


func test_park_state_schreibe_notify() -> void:
	var gs := FakeGameState.new()
	ParkState.schreibe(gs, func(slice: Variant) -> Dictionary: return ParkState.record_visit(slice))
	assert_eq(int(gs.get_value("park.visits", 0)), 1, "Besuch landet im Save")
	assert_true(gs.slices_notified.has("park"), "Slice-Notify für die Sticker")


## ---------------------------------------------------- CoasterLogic (pur)


func test_coaster_faehrt_komplett_durch() -> void:
	var curve := CoasterLogic.make_curve()
	var sim := CoasterLogic.neu(curve)
	var events: Array[String] = []
	var v_max := 0.0
	var schritte := 0
	while not bool(sim["done"]) and schritte < 20000:
		events.append_array(CoasterLogic.step(sim, 1.0 / 30.0))
		v_max = maxf(v_max, float(sim["v"]))
		schritte += 1
	assert_true(bool(sim["done"]), "Runde endet (kein Liegenbleiben)")
	assert_true(float(sim["t"]) < CoasterLogic.WATCHDOG_SEC, "fertig vor dem Watchdog")
	assert_true(v_max <= CoasterLogic.VMAX + 0.001, "Tempo-Klemme hält (VMAX)")
	for muss in ["board", "depart", "lift", "drop", "loop", "photo", "hills", "brake", "done"]:
		assert_true(events.has(muss), "Event fehlt: %s" % muss)
	assert_true(
		events.find("drop") < events.find("loop") and events.find("loop") < events.find("done"),
		"Events in Fahrt-Reihenfolge"
	)


func test_coaster_events_feuern_nur_einmal() -> void:
	var sim := CoasterLogic.neu(CoasterLogic.make_curve())
	var events: Array[String] = []
	var schritte := 0
	while not bool(sim["done"]) and schritte < 20000:
		events.append_array(CoasterLogic.step(sim, 1.0 / 60.0))
		schritte += 1
	for event in events:
		assert_eq(events.count(event), 1, "Event doppelt: %s" % event)


func test_coaster_hands_up_zonen() -> void:
	assert_true(CoasterLogic.hands_up_erlaubt("loop"))
	assert_true(CoasterLogic.hands_up_erlaubt("drop"))
	assert_false(CoasterLogic.hands_up_erlaubt("station"))
	assert_false(CoasterLogic.hands_up_erlaubt("lift"))


## --------------------------------------------- Funkelpark-Szene (Nodes)


func test_funkelpark_szene_coaster_fahrt() -> void:
	var gs := FakeGameState.new()
	gs.state["economy"]["coins"] = 200
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 12.0
	tree.root.add_child(park)
	await wait_frames(3)
	assert_eq(int(gs.get_value("park.visits", 0)), 1, "Betreten bucht einen Besuch")
	assert_false(bool(gs.get_value("park.nightVisit", true)), "mittags keine Nacht")
	assert_true(park.fahre("coaster"), "Fahrt startet bei vollem Konto")
	assert_eq(int(gs.get_value("economy.coins", 0)), 200 - 15, "Kasse zieht 15 Münzen")
	assert_false(park.rig.visible, "Plaza-Gooby steigt ein (unsichtbar)")
	assert_true(park.coaster.rig.visible, "Gooby sitzt SICHTBAR im Wagen")
	assert_false(park.fahre("wheel"), "keine zweite Fahrt während der Fahrt")
	park.coaster.set_hands_up(true)
	var max_abstand := 0.0
	var schritte := 0
	while park.coaster.faehrt and schritte < 6000:
		park.coaster.simuliere(1.0 / 30.0)
		max_abstand = maxf(max_abstand, park.coaster.gooby_sitz_abstand())
		schritte += 1
	assert_false(park.coaster.faehrt, "Runde endet")
	assert_true(max_abstand < 0.05, "Gooby bleibt im Wagen (Sitzabstand %.3f m)" % max_abstand)
	assert_eq(int(gs.get_value("park.rides.coaster", 0)), 1, "Fahrt gebucht")
	assert_eq(int(gs.get_value("park.handsUp", 0)), 1, "Hände-hoch-Moment gebucht")
	assert_eq(park.aktive_fahrt, "", "Fahrt-Slot wieder frei")
	assert_true(park.rig.visible, "Plaza-Gooby ist zurück")
	park.queue_free()
	await wait_frames(1)


func test_funkelpark_szene_riesenrad_gondel() -> void:
	var gs := FakeGameState.new()
	gs.state["economy"]["coins"] = 50
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 12.0
	tree.root.add_child(park)
	await wait_frames(2)
	assert_true(park.fahre("wheel"), "Riesenrad startet")
	assert_eq(int(gs.get_value("economy.coins", 0)), 40, "10 Münzen für die Runde")
	var max_abstand := 0.0
	var max_kippung := 0.0
	var schritte := 0
	while park.wheel.faehrt and schritte < 6000:
		park.wheel.simuliere(1.0 / 30.0)
		max_abstand = maxf(max_abstand, park.wheel.gooby_sitz_abstand())
		var gondel := park.wheel.gooby_gondel()
		max_kippung = maxf(max_kippung, absf(gondel.global_rotation.z))
		schritte += 1
	assert_false(park.wheel.faehrt, "Runde endet")
	assert_true(max_abstand < 0.05, "Gooby fällt NICHT aus der Gondel (%.3f m)" % max_abstand)
	assert_true(max_kippung < 0.01, "Gondel bleibt aufrecht (%.4f rad)" % max_kippung)
	assert_eq(int(gs.get_value("park.rides.wheel", 0)), 1, "Radrunde gebucht")
	park.queue_free()
	await wait_frames(1)


func test_funkelpark_zu_teuer_und_zu_muede() -> void:
	var gs := FakeGameState.new()
	gs.state["economy"]["coins"] = 3
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 12.0
	tree.root.add_child(park)
	await wait_frames(2)
	assert_false(park.fahre("coaster"), "3 Münzen reichen nicht für 15")
	assert_eq(int(gs.get_value("economy.coins", 0)), 3, "kein Abzug bei Ablehnung")
	assert_eq(int(gs.get_value("park.rides.coaster", 0)), 0)
	gs.state["economy"]["coins"] = 100
	gs.set_value("gooby.stats.energy", 1.0)
	assert_false(park.fahre("coaster"), "zu müde für die Fahrt")
	assert_eq(int(gs.get_value("economy.coins", 0)), 100, "auch dann kein Münz-Abzug")
	park.queue_free()
	await wait_frames(1)


func test_funkelpark_nacht_latcht() -> void:
	var gs := FakeGameState.new()
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 21.0
	tree.root.add_child(park)
	await wait_frames(2)
	assert_true(park.ist_nacht(), "21 Uhr ist Parknacht")
	assert_true(bool(gs.get_value("park.nightVisit", false)), "nightVisit gelatcht")
	assert_true(park.get_node("Nachtlichter").visible, "Lichterketten an")
	park.queue_free()
	await wait_frames(1)


## Playtest H-dlc-park: das Nachtband kippt WÄHREND des Besuchs (Web-Vorbild
## parkScene.js prüft im Tick) — Lichter an + nightVisit-Latch nachgebucht,
## und der Morgen hellt die Optik wieder auf (Latch bleibt).
func test_funkelpark_nachtband_kippt_waehrend_besuch() -> void:
	var gs := FakeGameState.new()
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 12.0
	tree.root.add_child(park)
	await wait_frames(2)
	assert_false(bool(gs.get_value("park.nightVisit", true)), "mittags kein Nacht-Latch")
	assert_false(park.get_node("Nachtlichter").visible, "Lichterketten tagsüber aus")
	park.stunde_override = 21.0
	park._pruefe_nachtband()
	assert_true(park.get_node("Nachtlichter").visible, "Sonnenuntergang schaltet die Lichter an")
	assert_true(bool(gs.get_value("park.nightVisit", false)), "nightVisit wird nachgelatcht")
	park.stunde_override = 12.0
	park._pruefe_nachtband()
	assert_false(park.get_node("Nachtlichter").visible, "der Morgen macht die Lichter aus")
	assert_true(bool(gs.get_value("park.nightVisit", false)), "der Latch bleibt gelatcht")
	park.queue_free()
	await wait_frames(1)


## Playtest H-dlc-park: die Parkstunde kommt aus der PINNBAREN Uhr (gs.clock)
## statt aus der Systemzeit — sonst kippen Dev-Zeitreisen das Band nie.
func test_funkelpark_stunde_aus_pinnbarer_uhr() -> void:
	var gs := FakeClockGameState.new()
	var uhr: RefCounted = ClockScript.new()
	uhr.pin(1768478400000)  # 2026-01-15T12:00:00Z
	uhr.set_utc_offset_minutes(0)
	gs.clock = uhr
	var park := Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = -1.0
	assert_eq(park.stunde(), 12.0, "Stunde kommt aus der gepinnten Uhr")
	assert_false(park.ist_nacht(), "12 Uhr = Tag")
	uhr.advance(9 * 3600000)
	assert_eq(park.stunde(), 21.0, "9 h später = 21 Uhr")
	assert_true(park.ist_nacht(), "21 Uhr = Parknacht")
	park.free()


## Playtest H-dlc-park: „Hände hoch“ ist eine HALTE-Pose — der wave-One-Shot
## wird nachgefeuert, solange der Knopf gedrückt bleibt; Loslassen stoppt
## die Schleife (der One-Shot-Rückweg blendet zurück in die Sitzpose).
func test_coaster_hands_up_haelt_die_pose() -> void:
	var gs := FakeGameState.new()
	gs.state["economy"]["coins"] = 50
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 12.0
	tree.root.add_child(park)
	await wait_frames(2)
	assert_true(park.fahre("coaster"), "Fahrt startet")
	park.coaster.set_hands_up(true)
	assert_eq(park.coaster.rig._pending_oneshot, "wave", "Hände hoch feuert den Winke-Clip")
	park.coaster.rig._pending_oneshot = ""
	park.coaster._on_rig_clip_finished("wave")
	assert_eq(park.coaster.rig._pending_oneshot, "wave", "gehaltener Knopf feuert nach")
	park.coaster.set_hands_up(false)
	park.coaster.rig._pending_oneshot = ""
	park.coaster._on_rig_clip_finished("wave")
	assert_eq(park.coaster.rig._pending_oneshot, "", "Loslassen stoppt die Winke-Schleife")
	park.queue_free()
	await wait_frames(1)


func test_naschgasse_kauf_bucht_candy() -> void:
	var gs := FakeGameState.new()
	gs.state["economy"]["coins"] = 30
	var sheet := ParkStallSheet.new()
	sheet.gs = gs
	tree.root.add_child(sheet)
	await wait_frames(1)
	sheet._kaufe("cottonCandy", 12)
	assert_eq(int(gs.get_value("economy.coins", 0)), 18, "Zuckerwolke kostet 12")
	assert_eq(int(gs.get_value("inventory.food.cottonCandy", 0)), 1, "Snack im Tablett")
	assert_eq(int(gs.get_value("park.candyBought", 0)), 1, "candyBought gebucht")
	sheet._kaufe("waffle", 20)
	assert_eq(int(gs.get_value("economy.coins", 0)), 18, "zu teuer: kein Abzug")
	assert_eq(int(gs.get_value("park.candyBought", 0)), 1, "zu teuer: kein Zähler")
	sheet.queue_free()
	await wait_frames(1)


func test_city_map_kennt_den_funkelpark() -> void:
	var karte := CityMap.laden()
	var eintrag := karte.ort("funkelpark")
	assert_false(eintrag.is_empty(), "funkelpark steht in der city_map")
	assert_eq(str(eintrag.get("szene", "")), "res://scenes/park/funkelpark.tscn")
	assert_true(ResourceLoader.exists(str(eintrag.get("szene", ""))), "Szene-Datei existiert")
	assert_eq(karte.validieren(), [] as Array[String], "Karte bleibt valide")
