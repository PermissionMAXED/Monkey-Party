extends TestCase
## H-city Playtest-Fixes (docs/godot-rewrite/playtest/H-city.md):
## 1. GOOBERANDO-Trinkgeld bucht NUR bei gelungener Zahlung (kein Gratis-
##    Buff bei leerem Beutel), Knopf ist bei < 5 Münzen gesperrt.
## 2. Öffnungszeiten werden BEIM BETRETEN erzwungen (Wochenmarkt Sa 8–14)
##    und der Parkplatz-Prompt zeigt den „Warum zu?“-Text + sperrt den Knopf.
## 3. Händler-/Markt-Sheets zeigen lokalisierte Warennamen (EN-Locale
##    zeigte vorher überall deutsche name_de-Namen).
## 4. NPC antippen startet den Dialog neu (Laden-Sheet wieder erreichbar,
##    ohne den Ort kostenpflichtig neu zu betreten).

const CitySceneScript := preload("res://scripts/city/city_scene.gd")

## Sa 2026-08-01 10:00 UTC (weekday 6, in 8–14) / Di 2026-08-04 10:00 UTC.
const SAMSTAG_10 := {"year": 2026, "month": 8, "day": 1, "hour": 10, "minute": 0, "second": 0}
const DIENSTAG_10 := {"year": 2026, "month": 8, "day": 4, "hour": 10, "minute": 0, "second": 0}


## GameState-Double (Muster test_city_orte): dotted get/set + update.
class FakeGameState:
	extends RefCounted
	var state: Dictionary = {
		"economy": {"coins": 50},
		"inventory": {"items": {}, "food": {}},
		"city": {},
		"gooby": {"stats": {"energy": 100.0}},
	}

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

	func notify_slice_changed(_slice_id: String) -> void:
		pass


## Ort mit Dialogbaum für den Tap-to-Talk-Test (Basis-OrtScene reicht).
class TapOrt:
	extends OrtScene

	func _dialog_pfad() -> String:
		return "res://scripts/city/data/dialoge/wochenmarkt.json"


## ------------------------------------------------- 1. Trinkgeld-Exploit


func _trinkgeld_app(coins: int) -> GooberandoApp:
	var gs := FakeGameState.new()
	gs.state["economy"]["coins"] = coins
	var slice := GooberandoLogic.default_slice()
	slice["state"] = GooberandoLogic.STATE_TRINKGELD
	slice["gerichtId"] = "burger"
	slice["gerichte"] = ["burger"]
	gs.set_value("city.gooberando", slice)
	var app := GooberandoApp.new()
	app.gs = gs
	tree.root.add_child(app)
	return app


func _app_abbauen(app: GooberandoApp) -> void:
	app.queue_free()
	await wait_frames(2)


func test_trinkgeld_ohne_muenzen_bucht_keinen_buff() -> void:
	var app := _trinkgeld_app(2)
	await wait_frames(2)
	app._on_trinkgeld(true)
	var gs: FakeGameState = app.gs
	assert_eq(int(gs.get_value("economy.coins", -1)), 2, "keine Münzen abgezogen")
	var slice := CityState.gooberando_slice(gs)
	assert_eq(int(slice["trinkgelder"]), 0, "kein Trinkgeld gebucht")
	assert_eq(int(slice["buffBis"]), 0, "kein Gratis-Buff")
	assert_eq(str(slice["state"]), GooberandoLogic.STATE_IDLE, "Lieferung trotzdem abgeschlossen")
	await _app_abbauen(app)


func test_trinkgeld_mit_muenzen_bucht_fuenf() -> void:
	var app := _trinkgeld_app(50)
	await wait_frames(2)
	app._on_trinkgeld(true)
	var gs: FakeGameState = app.gs
	assert_eq(int(gs.get_value("economy.coins", -1)), 45, "5 Münzen Trinkgeld abgezogen")
	var slice := CityState.gooberando_slice(gs)
	assert_eq(int(slice["trinkgelder"]), 1, "Trinkgeld gezählt")
	assert_eq(str(slice["state"]), GooberandoLogic.STATE_IDLE)
	await _app_abbauen(app)


func test_trinkgeld_knopf_gesperrt_wenn_pleite() -> void:
	var app := _trinkgeld_app(GooberandoLogic.TRINKGELD - 1)
	await wait_frames(2)
	var knopf := _finde_knopf(app, I18nService.t("travel.gooberando.trinkgeld_geben"))
	assert_true(knopf != null, "Trinkgeld-Knopf existiert")
	if knopf != null:
		assert_true(knopf.disabled, "pleite → Knopf gesperrt")
	await _app_abbauen(app)
	var reich := _trinkgeld_app(GooberandoLogic.TRINKGELD)
	await wait_frames(2)
	var knopf2 := _finde_knopf(reich, I18nService.t("travel.gooberando.trinkgeld_geben"))
	assert_true(knopf2 != null and not knopf2.disabled, "5 Münzen → Knopf frei")
	await _app_abbauen(reich)


func _finde_knopf(unter: Node, text: String) -> Button:
	for btn in unter.find_children("*", "Button", true, false):
		if (btn as Button).text == text:
			return btn
	return null


## --------------------------------------------- 2. Öffnungszeiten-Gate


func _baue_stadt(unix: int) -> CityScene:
	var city: CityScene = CitySceneScript.new()
	city.game_state_override = FakeGameState.new()
	city.stunde_override = 12.0
	city.unix_override = unix
	tree.root.add_child(city)
	return city


func _reisse_ab(city: CityScene) -> void:
	city.queue_free()
	await wait_frames(2)


func test_wochenmarkt_geschlossen_kostet_keine_energie() -> void:
	var city := _baue_stadt(int(Time.get_unix_time_from_datetime_dict(DIENSTAG_10)))
	await wait_frames(2)
	city._on_betreten("wochenmarkt")
	assert_almost(
		float(city.game_state().get_value("gooby.stats.energy", -1.0)),
		100.0,
		0.001,
		"dienstags: Markt zu, KEINE Energie weg"
	)
	# Samstag 10 Uhr: offen — jetzt zieht das Betreten die Energie ab.
	city.unix_override = int(Time.get_unix_time_from_datetime_dict(SAMSTAG_10))
	city._on_betreten("wochenmarkt")
	var kosten := city.karte.energie_kosten("wochenmarkt")
	assert_true(kosten > 0, "Wochenmarkt kostet Energie")
	assert_almost(
		float(city.game_state().get_value("gooby.stats.energy", -1.0)),
		100.0 - float(kosten),
		0.001,
		"samstags: Betreten bucht die Energie"
	)
	await _reisse_ab(city)


func test_prompt_zeigt_geschlossen_und_sperrt_knopf() -> void:
	var city := _baue_stadt(int(Time.get_unix_time_from_datetime_dict(DIENSTAG_10)))
	await wait_frames(2)
	# Auto an den Markt-Parkplatz stellen; Ausparken abbrechen, sonst
	# unterdrückt _update_parkplatz den Prompt.
	city._ausparken_abbrechen()
	var park := city.karte.parkplatz_welt("wochenmarkt")
	city.auto.teleport(park.x, park.z, 0.0)
	city._update_parkplatz()
	assert_true(city.hud.prompt_sichtbar(), "Prompt steht")
	assert_true(city.hud._prompt_btn.disabled, "geschlossen → Betreten gesperrt")
	var erwartet := (
		I18nService
		. t("city.fahren.geschlossen")
		. format(
			{
				"ort": I18nService.t("city.ort.wochenmarkt"),
				"grund": I18nService.t("city.ort.nur_samstag"),
			}
		)
	)
	assert_eq(city.hud._prompt_label.text, erwartet, "„Warum zu?“-Text im Prompt")
	# Samstags ist derselbe Prompt wieder frei.
	city.unix_override = int(Time.get_unix_time_from_datetime_dict(SAMSTAG_10))
	city._prompt_ort = ""
	city._update_parkplatz()
	assert_false(city.hud._prompt_btn.disabled, "offen → Betreten frei")
	await _reisse_ab(city)


## ------------------------------------------------ 3. Lokalisierte Namen


func test_haendler_namen_lokalisiert() -> void:
	var sheet := HaendlerSheet.new()
	sheet.gs = FakeGameState.new()
	I18nService.set_locale("en")
	assert_eq(sheet.ware_name({"id": "carrot", "preis": 6}), "Carrot", "EN: Food via rewards")
	assert_eq(
		sheet.ware_name({"id": "buch_x", "inventar": "buch_x", "name_de": "Buch"}),
		"Buch",
		"EN ohne name_en: name_de-Fallback"
	)
	assert_eq(
		sheet.ware_name(
			{"id": "buch_x", "inventar": "buch_x", "name_de": "Buch", "name_en": "Book"}
		),
		"Book",
		"EN mit name_en"
	)
	I18nService.set_locale("de")
	assert_eq(sheet.ware_name({"id": "carrot", "preis": 6}), "Möhre", "DE: Food via rewards")
	sheet.free()


func test_markt_ernte_namen_lokalisiert_en() -> void:
	I18nService.set_locale("en")
	for eintrag: Dictionary in MarktPreise.ernte_sorten():
		var id := str(eintrag.get("id", ""))
		assert_ne(
			FoodCatalog.display_name(id),
			id,
			"Markt-Ernte %s braucht einen rewards.food-String" % id
		)
	I18nService.set_locale("de")


## -------------------------------------------------- 4. NPC-Tap-to-Talk


func test_npc_tipp_startet_dialog_neu() -> void:
	var ort := TapOrt.new()
	ort.ort_id = "wochenmarkt"
	ort.game_state_override = FakeGameState.new()
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	assert_true(ort.rig.get_node_or_null("NpcTippBereich") != null, "Tipp-Bereich am NPC")
	assert_true(ort.dialog.ist_aktiv(), "Dialog läuft nach dem Betreten")
	var klick := InputEventMouseButton.new()
	klick.pressed = true
	klick.button_index = MOUSE_BUTTON_LEFT
	var runner_vorher: OrtDialogRunner = ort.dialog.runner
	ort._on_npc_tipp(null, klick, Vector3.ZERO, Vector3.ZERO, 0)
	assert_true(ort.dialog.runner == runner_vorher, "laufender Dialog wird NICHT neu gestartet")
	# Dialog beenden (leerer Baum → beendet) — Tap startet ihn frisch.
	ort.dialog.starte({}, {})
	assert_false(ort.dialog.ist_aktiv(), "Dialog ist zu Ende")
	ort._on_npc_tipp(null, klick, Vector3.ZERO, Vector3.ZERO, 0)
	assert_true(ort.dialog.ist_aktiv(), "Tap startet den Dialog neu")
	assert_true(ort.dialog.runner.ist_geladen(), "frischer Runner ist geladen")
	# Nicht-Tap-Events prallen ab (kein Restart mitten im frischen Dialog).
	var bewegung := InputEventMouseMotion.new()
	var runner_neu: OrtDialogRunner = ort.dialog.runner
	ort._on_npc_tipp(null, bewegung, Vector3.ZERO, Vector3.ZERO, 0)
	assert_true(ort.dialog.runner == runner_neu, "MouseMotion startet nichts")
	if ort.voice != null and is_instance_valid(ort.voice):
		ort.voice.sagt("")
	await wait_frames(6)
	ort.queue_free()
	await wait_frames(2)
