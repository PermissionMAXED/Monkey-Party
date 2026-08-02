extends TestCase
## Wachen für die Rückkehrer-Karte (Welle J / Idee I-44):
## 1. Slice-Self-Heal + Fälligkeits-Gating (≥ 7 Tage, Onboarding,
##    nie doppelt für dieselbe Abwesenheit).
## 2. Geschichten: deterministisch (gleicher Seed ⇒ gleiche Auswahl),
##    zustandsbasiert (Ranch-Story nur mit gekaufter Ranch), nie leer
##    (immer-Rückfaller füllen auf GESCHICHTEN_ANZAHL auf).
## 3. Sanfte Quest: Baselines frieren beim Karten-Start ein (alte Zähler
##    zählen nicht), Abschluss zahlt das Wiedersehens-Geschenk GENAU
##    EINMAL über die echten Economy/Leveling-Pfade.
## 4. Strings: jede Pool-/Aufgaben-Id hat ihren de+en-Text (Karte fällt
##    sonst auf rohe Keys zurück).
## 5. Die Karten-Szene baut headless (Zeilen + Knopf vorhanden).

const GameStateScript := preload("res://scripts/state/game_state.gd")
const KARTE_SCENE := preload("res://scripts/ui/rueckkehr_karte.tscn")

const NOW_MS := 1768478400000
const TAG_MS := SoulTriggers.MS_PER_DAY

var _seq := 0


func _fresh_gs() -> Node:
	RueckkehrLogic.reset_for_tests()
	RueckkehrLogic.register_slice()
	_seq += 1
	var dir := "user://rueckkehr_tests/rk_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(dir + "/save_v5.json")
	return gs


func test_slice_normalize_selbstheilung() -> void:
	var kaputt := {"shownAt": "quatsch", "count": -3, "quest": [1, 2, 3]}
	var heil := RueckkehrLogic.normalize_slice(kaputt)
	assert_eq(int(heil["shownAt"]), 0, "shownAt heilt auf 0")
	assert_eq(int(heil["count"]), 0, "count heilt auf 0")
	assert_eq(heil["quest"], {}, "kaputte Quest heilt auf leer")
	var teil := {"quest": {"aktiv": 1, "claimed": "ja", "base": {"rk_fuettern": {"n": 4}}}}
	var quest: Dictionary = RueckkehrLogic.normalize_slice(teil)["quest"]
	assert_false(bool(quest["aktiv"]), "aktiv nur bei echtem bool true")
	assert_false(bool(quest["claimed"]), "claimed nur bei echtem bool true")
	assert_eq(int(quest["base"]["rk_fuettern"]["n"]), 4, "Baselines bleiben erhalten")


func test_faellig_gating() -> void:
	var frisch := RueckkehrLogic.default_slice()
	var knapp := RueckkehrLogic.MIN_GAP_MS - 1
	assert_false(
		RueckkehrLogic.faellig(frisch, knapp, NOW_MS, true), "6,99 Tage Lücke reicht nicht"
	)
	assert_true(
		RueckkehrLogic.faellig(frisch, RueckkehrLogic.MIN_GAP_MS, NOW_MS, true),
		"exakt 7 Tage Lücke ist fällig"
	)
	assert_false(
		RueckkehrLogic.faellig(frisch, RueckkehrLogic.MIN_GAP_MS, NOW_MS, false),
		"vor dem Onboarding nie"
	)
	var gezeigt := {"shownAt": NOW_MS - 2 * TAG_MS, "count": 1, "quest": {}}
	assert_false(
		RueckkehrLogic.faellig(gezeigt, RueckkehrLogic.MIN_GAP_MS, NOW_MS, true),
		"kürzlich gezeigt — nicht doppelt für dieselbe Abwesenheit"
	)
	var lange_her := {"shownAt": NOW_MS - 8 * TAG_MS, "count": 1, "quest": {}}
	assert_true(
		RueckkehrLogic.faellig(lange_her, 8 * TAG_MS, NOW_MS, true),
		"neue volle Lücke nach alter Karte ist wieder fällig"
	)
	assert_eq(RueckkehrLogic.gap_tage(8 * TAG_MS), 8, "gap_tage rundet auf ganze Tage")
	assert_eq(RueckkehrLogic.gap_tage(int(7.9 * TAG_MS)), 7, "angebrochene Tage zählen nicht")


func test_geschichten_deterministisch_und_zustandsbasiert() -> void:
	var leer := {}
	var nur_immer := RueckkehrLogic.geschichten(leer, "seed:a")
	assert_eq(nur_immer.size(), RueckkehrLogic.GESCHICHTEN_ANZAHL, "Karte ist NIE leer")
	for key: String in nur_immer:
		assert_true(
			key in ["rueckkehr.story.fenster", "rueckkehr.story.kissen", "rueckkehr.story.staub"],
			"leerer Save erzählt nur immer-Geschichten (%s)" % key
		)
	var state := {
		"ranch": {"gekauft": true},
		"achievements": {"counters": {"feeds": 5}},
	}
	var a := RueckkehrLogic.geschichten(state, "seed:b")
	var b := RueckkehrLogic.geschichten(state, "seed:b")
	assert_eq(a, b, "gleicher Seed ⇒ gleiche Auswahl")
	assert_eq(a.size(), RueckkehrLogic.GESCHICHTEN_ANZAHL, "immer volle Karte")
	var spezial := 0
	for key: String in a:
		if key in ["rueckkehr.story.ranch", "rueckkehr.story.kuehlschrank"]:
			spezial += 1
	assert_eq(spezial, RueckkehrLogic.MAX_SPEZIAL, "beide passenden Spezial-Geschichten dabei")
	var ohne_ranch := RueckkehrLogic.geschichten(
		{"achievements": {"counters": {"feeds": 5}}}, "seed:b"
	)
	assert_false("rueckkehr.story.ranch" in ohne_ranch, "Ranch-Story nur mit gekaufter Ranch")


func test_quest_baseline_und_geschenk_einmalig() -> void:
	var gs := _fresh_gs()
	# Vorgeschichte: 4 Fütterungen VOR der Rückkehr — dürfen nicht zählen.
	gs.update(func(s: Dictionary) -> void: s["achievements"]["counters"]["feeds"] = 4)
	gs.update(
		func(s: Dictionary) -> void:
			var slice: Dictionary = s[RueckkehrLogic.SLICE_ID]
			RueckkehrLogic.karte_starten(slice, s, NOW_MS, 9 * TAG_MS)
	)
	var slice := RueckkehrLogic.normalize_slice(gs.get_value(RueckkehrLogic.SLICE_ID, {}))
	assert_eq(int(slice["shownAt"]), NOW_MS, "Karten-Stempel sitzt")
	assert_eq(int(slice["quest"]["tage"]), 9, "Quest merkt sich die Lücke in Tagen")
	assert_true(RueckkehrLogic.quest_aktiv(slice), "Quest läuft nach dem Karten-Start")
	for row: Dictionary in RueckkehrLogic.fortschritt(slice, gs.state()):
		assert_eq(int(row["progress"]), 0, "Baselines eingefroren: %s" % str(row["def"]["id"]))
	assert_false(RueckkehrLogic.alles_fertig(slice, gs.state()), "noch nichts erledigt")
	# Die drei sanften Momente passieren: streicheln ×3, füttern, 1 Runde.
	gs.update(
		func(s: Dictionary) -> void:
			var counters: Dictionary = s["achievements"]["counters"]
			counters["petsToday"] = 3
			counters["petsDay"] = gs.clock.local_day()
			counters["feeds"] = 5
			s["minigames"]["plays"] = {"teaParty": 1}
	)
	slice = RueckkehrLogic.normalize_slice(gs.get_value(RueckkehrLogic.SLICE_ID, {}))
	assert_true(RueckkehrLogic.alles_fertig(slice, gs.state()), "alle drei Momente erkannt")
	var service := RueckkehrService.new()
	service.gs = gs
	var coins_vorher := int(gs.get_value("economy.coins", 0))
	service.pruefe_und_belohne()
	var coins_nachher := int(gs.get_value("economy.coins", 0))
	assert_true(
		coins_nachher >= coins_vorher + RueckkehrLogic.BELOHNUNG_MUENZEN,
		(
			"Wiedersehens-Geschenk bezahlt (+%d erwartet, +%d bekommen)"
			% [RueckkehrLogic.BELOHNUNG_MUENZEN, coins_nachher - coins_vorher]
		)
	)
	slice = RueckkehrLogic.normalize_slice(gs.get_value(RueckkehrLogic.SLICE_ID, {}))
	assert_true(bool(slice["quest"]["claimed"]), "Quest als bezahlt markiert")
	assert_false(RueckkehrLogic.quest_aktiv(slice), "Quest ist danach aus")
	service.pruefe_und_belohne()
	assert_eq(
		int(gs.get_value("economy.coins", 0)), coins_nachher, "zweiter Aufruf zahlt NICHT doppelt"
	)
	service.free()
	gs.free()


func test_besuchsluecke_und_faelligkeit_am_echten_state() -> void:
	var gs := _fresh_gs()
	SoulState.register_slice()
	SoulState.mutate(gs, func(s: Dictionary) -> void: s["lastVisitAt"] = NOW_MS - 9 * TAG_MS)
	gs.set_value("onboarding.done", true)
	var service := RueckkehrService.new()
	service.gs = gs
	assert_eq(service._luecke_vor_besuch(), 9 * TAG_MS, "Lücke = jetzt − lastVisitAt")
	service._gap_ms = service._luecke_vor_besuch()
	assert_true(service._ist_faellig(), "9 Tage Lücke + Onboarding ⇒ Karte fällig")
	gs.set_value("onboarding.done", false)
	assert_false(service._ist_faellig(), "ohne Onboarding keine Karte")
	service.free()
	gs.free()


func test_strings_fuer_pool_und_aufgaben() -> void:
	var de := _lade_json("res://strings/de/rueckkehr.json")
	var en := _lade_json("res://strings/en/rueckkehr.json")
	for locale_name: String in ["de", "en"]:
		var daten := de if locale_name == "de" else en
		var wurzel: Dictionary = daten.get("rueckkehr", {})
		for key: String in ["titel", "untertitel", "quest_titel", "fertig_toast", "button"]:
			assert_true(
				str(wurzel.get(key, "")).length() > 0, "%s: rueckkehr.%s fehlt" % [locale_name, key]
			)
		var stories: Dictionary = wurzel.get("story", {})
		for def: Dictionary in RueckkehrLogic.geschichten_pool():
			var id := str(def["id"])
			assert_true(
				str(stories.get(id, "")).length() > 0,
				"%s: rueckkehr.story.%s fehlt" % [locale_name, id]
			)
		var aufgaben: Dictionary = wurzel.get("aufgabe", {})
		for def: Dictionary in RueckkehrLogic.quest_defs():
			var id := str(def["id"])
			assert_true(
				str(aufgaben.get(id, "")).length() > 0,
				"%s: rueckkehr.aufgabe.%s fehlt" % [locale_name, id]
			)


func test_karte_szene_baut_headless() -> void:
	var karte: RueckkehrKarte = KARTE_SCENE.instantiate()
	tree.root.add_child(karte)
	var gs := _fresh_gs()
	gs.update(
		func(s: Dictionary) -> void:
			var slice: Dictionary = s[RueckkehrLogic.SLICE_ID]
			RueckkehrLogic.karte_starten(slice, s, NOW_MS, 8 * TAG_MS)
	)
	var slice := RueckkehrLogic.normalize_slice(gs.get_value(RueckkehrLogic.SLICE_ID, {}))
	(
		karte
		. setup(
			{
				"tage": 8,
				"geschichten": RueckkehrLogic.geschichten(gs.state(), "seed:test"),
				"aufgaben": RueckkehrLogic.fortschritt(slice, gs.state()),
				"muenzen": RueckkehrLogic.BELOHNUNG_MUENZEN,
				"xp": RueckkehrLogic.BELOHNUNG_XP,
			}
		)
	)
	karte.open()
	await wait_frames(2)
	assert_true(karte.is_open(), "Karte öffnet")
	assert_true(karte.find_child("Story0", true, false) != null, "Geschichten-Zeile da")
	assert_true(karte.find_child("Aufgabe2", true, false) != null, "alle 3 Aufgaben-Zeilen da")
	assert_true(karte.find_child("RueckkehrOkButton", true, false) != null, "OK-Knopf da")
	karte.free()
	PanelStack.clear()
	gs.free()


func _lade_json(pfad: String) -> Dictionary:
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(pfad)) != OK:
		fail_test("JSON kaputt: %s" % pfad)
		return {}
	return json.data if json.data is Dictionary else {}
