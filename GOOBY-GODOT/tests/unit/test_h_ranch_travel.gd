extends TestCase
## Playtest H „Ranch & Reise“ — Regressionstests zu den Befunden
## (docs/godot-rewrite/playtest/H-ranch-travel.md):
## 1. Abflug-Finale: „Gute Reise!“ schloss das Sheet SOFORT — der Öffner-
##    Layer starb samt App noch im selben Frame, die fertig-Verbindung der
##    Cutscene mit ihm, und _on_cutscene_fertig (Buchung + Heimweg) lief
##    NIE: der Spieler strandete bezahlt am Flughafen (Blocker).
## 2. Reunion-Kontrakt: die Abholung füllt ALLE vier Gooby-Werte auf
##    Vacation.PICKUP_STAT_FILL (vorher nur energy — Web economy.js
##    completeVacationPickup füllt alle Stats).
## 3. Overdue-Taxi-Gebühr an der Kasse gedeckelt (Web payTaxiReturn: „der
##    Fahrer nimmt, was da ist“) — vorher fuhr ein Spieler mit < 60 ᴳ
##    GRATIS, weil das atomare Economy.spend die Gebühr ganz ausließ.
## 4. Pferdepflege + Hofladen (RANCH-2-Screens) hängen am Hof-HUD —
##    vorher waren beide Screens fertig gebaut, aber NIRGENDS montiert.
## 5. Urlaubs-Maschine tickt LIVE (Postkarten/returnReady/overdue kamen
##    vorher nur über den Offline-Catch-up beim Boot an).
## 6. `ranch`-Slice steht im Produktions-Boot (DEFAULT_SLICE_SCRIPTS) —
##    vorher registrierten ihn NUR Tests: angebot_gesehen starb mit
##    Key-Fehler, der Kauf brach NACH dem spend ab (Geld weg, keine
##    Ranch) und der frische Hof hatte 0 Heu/0 Äpfel statt 4/2.
## 7. Wegweiser-Bretter der offenen Region: Label3D-Front zeigte INS
##    Brett — Spieler lasen alle Ortsnamen spiegelverkehrt.

const Vacation := preload("res://scripts/logic/vacation.gd")
const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

const HOF_SZENE := "res://scenes/ranch/ranch_hof.tscn"


## GameState-Double (Muster test_w15_urlaub): dotted get/set +
## update(mutator) + state().
class FakeGameState:
	extends RefCounted
	var daten: Dictionary = {}

	func _init(start: Dictionary = {}) -> void:
		daten = start

	func state() -> Dictionary:
		return daten

	func get_value(path: String, fallback: Variant = null) -> Variant:
		var node: Variant = daten
		for part in path.split("."):
			if node is Dictionary and (node as Dictionary).has(part):
				node = node[part]
			else:
				return fallback
		return node

	func set_value(path: String, wert: Variant) -> void:
		var teile := path.split(".")
		var node: Dictionary = daten
		for i in teile.size() - 1:
			if not (node.get(teile[i]) is Dictionary):
				node[teile[i]] = {}
			node = node[teile[i]]
		node[teile[teile.size() - 1]] = wert

	func update(mutator: Callable) -> void:
		mutator.call(daten)

	func notify_slice_changed(_slice_id: String) -> void:
		pass


## ---------------------------------------------- 1. Abflug-Finale lebt


func test_gute_reise_finale_ueberlebt_das_sheet() -> void:
	var gs := (
		FakeGameState
		. new(
			{
				"vacation": Vacation.default_slice(),
				"economy": {"coins": 500},
				"inventory": {"items": {}, "food": {}},
				"gooby": {"stats": {"hunger": 80.0, "energy": 80.0, "hygiene": 80.0, "fun": 50.0}},
				"city": {},
			}
		)
	)
	var app := ReiseApp.oeffne(tree.root, gs)
	await wait_frames(2)
	# „Gute Reise!“ (Boarding-Pass-Callback): App muss die Cutscene
	# ÜBERLEBEN — vorher starb sie mit dem sofort geschlossenen Sheet.
	app._on_gute_reise("beach")
	await wait_frames(3)
	assert_true(is_instance_valid(app), "App lebt, solange die Cutscene läuft")
	var cutscene: ReiseCutscene = null
	for kind in tree.root.get_children():
		if kind is ReiseCutscene:
			cutscene = kind
	assert_ne(cutscene, null, "Abflug-Cutscene hängt am Root")
	if cutscene == null:
		return
	cutscene.fertig.emit()
	await wait_frames(2)
	assert_eq(
		str(gs.get_value("vacation.phase")),
		Vacation.PHASE_AWAY,
		"Finale bucht den Urlaub (vorher: verpuffte ins Leere)"
	)
	assert_eq(str(gs.get_value("vacation.destId")), "beach", "Ziel steht im Slice")
	assert_true(cutscene.is_queued_for_deletion(), "Finale räumt die Cutscene ab")
	await wait_frames(2)


## ------------------------------------- 5. Urlaubs-Maschine tickt LIVE


## Vorher rief NUR der Offline-Catch-up Vacation.tick — mit offener App
## kamen Postkarten/returnReady/overdue nie an (Web: core/timeEngine.js
## tickt vacation im 1-s-Takt). JETZT liefert auch der Live-Tick die
## Events und zieht den Slice nach.
func test_live_tick_bringt_postkarten_und_phasenwechsel() -> void:
	const T := 1784980800000
	var v := Vacation.default_slice()
	v["phase"] = Vacation.PHASE_AWAY
	v["destId"] = "beach"
	v["bookedAt"] = T
	v["returnAt"] = T + 3 * Vacation.MS_PER_DAY
	v["pickupBy"] = T + 4 * Vacation.MS_PER_DAY
	var state := {
		"gooby":
		{
			"stats": {"hunger": 80.0, "energy": 80.0, "hygiene": 80.0, "fun": 50.0},
			"sleep": {"sleeping": false, "startedAt": 0, "wakeAt": 0},
			"grumpyUntil": 0,
			"lastTickAt": T,
			"health": {"state": "healthy"},
			"weight": 50.0,
		},
		"progression": {"xp": 0, "level": 1},
		"economy": {"coins": 100},
		"vacation": v,
		"achievements": {},
	}
	var events := GoobyTicker.live_tick(state, T + 26 * 3_600_000)
	assert_true(events.has("vacationPostcard"), "Postkarte kommt LIVE (nicht erst beim Boot)")
	assert_eq(int((state["vacation"] as Dictionary)["postcards"]), 1, "Zähler zieht nach")
	assert_almost(
		float(state["gooby"]["stats"]["fun"]), 50.0, 1e-6, "Werte bleiben im Urlaub eingefroren"
	)
	var events2 := GoobyTicker.live_tick(state, T + 3 * Vacation.MS_PER_DAY + 60_000)
	assert_true(events2.has("vacationReturnReady"), "returnReady kommt LIVE")
	assert_eq(
		str((state["vacation"] as Dictionary)["phase"]),
		Vacation.PHASE_RETURN_READY,
		"Phase zieht LIVE nach"
	)


## ------------------------------------------------ 3. Taxi-Gebühr-Deckel


func test_taxi_gebuehr_an_der_kasse_gedeckelt() -> void:
	assert_eq(ReiseLogic.taxi_gebuehr(999), Vacation.TAXI_FEE, "reich: volle 60")
	assert_eq(ReiseLogic.taxi_gebuehr(Vacation.TAXI_FEE), Vacation.TAXI_FEE, "exakt reicht")
	assert_eq(ReiseLogic.taxi_gebuehr(10), 10, "arm: der Fahrer nimmt, was da ist")
	assert_eq(ReiseLogic.taxi_gebuehr(0), 0, "pleite: keine Gebühr, kein Soft-Lock")
	assert_eq(ReiseLogic.taxi_gebuehr(-5), 0, "nie negativ")


## ------------------------------------------- 2.+3. Abholung in der App


## ReiseApp/UrlaubsOrt laufen auf Systemzeit — der Slice wird relativ zu
## JETZT gebaut (returnReady bzw. overdue, Muster test_w15_urlaub).
func _abhol_state(overdue: bool, coins: int) -> Dictionary:
	var now := int(Time.get_unix_time_from_system() * 1000.0)
	var v := Vacation.default_slice()
	v["phase"] = Vacation.PHASE_AWAY
	v["destId"] = "beach"
	v["bookedAt"] = now - 4 * Vacation.MS_PER_DAY
	v["returnAt"] = now - Vacation.MS_PER_DAY
	v["pickupBy"] = now - 3_600_000 if overdue else now + Vacation.PICKUP_WINDOW_MS
	return {
		"vacation": v,
		"economy": {"coins": coins},
		"inventory": {"items": {}, "food": {}},
		"gooby": {"stats": {"hunger": 20.0, "energy": 30.0, "hygiene": 40.0, "fun": 10.0}},
		"city": {},
	}


func _abholen_mit(gs: FakeGameState, overdue: bool) -> void:
	var app := ReiseApp.new()
	app.gs = gs
	tree.root.add_child(app)
	await wait_frames(1)
	app._on_abholen(overdue)
	await wait_frames(1)
	app.queue_free()
	await wait_frames(1)


func test_abholung_fuellt_alle_vier_werte() -> void:
	var gs := FakeGameState.new(_abhol_state(false, 100))
	await _abholen_mit(gs, false)
	for stat: String in ["hunger", "energy", "hygiene", "fun"]:
		assert_almost(
			float(gs.get_value("gooby.stats.%s" % stat)),
			Vacation.PICKUP_STAT_FILL,
			1e-6,
			"Reunion füllt %s (nicht nur energy)" % stat
		)
	assert_eq(int(gs.get_value("economy.coins")), 130, "100 + 30 Souvenir (beach), keine Gebühr")
	assert_eq(str(gs.get_value("vacation.phase")), Vacation.PHASE_NONE, "Slice abgeschlossen")


func test_abholung_overdue_arm_faehrt_nicht_gratis() -> void:
	var gs := FakeGameState.new(_abhol_state(true, 10))
	await _abholen_mit(gs, true)
	# 10 − 10 (gedeckelte Gebühr statt Freifahrt) + 30 Souvenir = 30.
	assert_eq(int(gs.get_value("economy.coins")), 30, "Fahrer nimmt die 10, dann +30 Souvenir")
	assert_eq(int(gs.get_value("economy.coinsSpent", 0)), 10, "Gebühr wurde WIRKLICH gebucht")


func test_abholung_overdue_reich_zahlt_volle_gebuehr() -> void:
	var gs := FakeGameState.new(_abhol_state(true, 200))
	await _abholen_mit(gs, true)
	# 200 − 60 + 30 = 170.
	assert_eq(int(gs.get_value("economy.coins")), 170, "volle 60er-Gebühr + 30 Souvenir")


## --------------------------------------- 4. Pflege + Hofladen am Hof-HUD


func _finde_klasse(node: Node, klasse: String) -> Node:
	var skript: Variant = node.get_script()
	if skript is Script and (skript as Script).get_global_name() == StringName(klasse):
		return node
	for kind in node.get_children():
		var treffer := _finde_klasse(kind, klasse)
		if treffer != null:
			return treffer
	return null


func _hof_mit_kauf() -> RanchHofScene:
	var ranch := RanchState.default_slice()
	ranch["gekauft"] = true
	var gs := FakeGameState.new(
		{"ranch": ranch, "economy": {"coins": 500}, "inventory": {"items": {}, "food": {}}}
	)
	var szene: RanchHofScene = (load(HOF_SZENE) as PackedScene).instantiate()
	szene.game_state_override = gs
	szene.stunde_override = 13.0
	tree.root.add_child(szene)
	return szene


func test_hof_hud_pflege_und_hofladen_nach_kauf() -> void:
	var szene := _hof_mit_kauf()
	await wait_frames(4)
	var fuss: HBoxContainer = szene.get_node("HudLayer/HofHud/FussBox")
	assert_eq(fuss.get_child_count(), 5, "Ausreiten · Galopp · Pflege · Hofladen · MP")
	assert_ne(szene._pflege_knopf, null, "Pflege-Knopf existiert nach dem Kauf")
	assert_ne(szene._laden_knopf, null, "Hofladen-Knopf existiert nach dem Kauf")
	# Pflege öffnen → Screen hängt im HudLayer, Zurück baut ihn wieder ab.
	szene._pflege_knopf.pressed.emit()
	await wait_frames(3)
	var pflege := _finde_klasse(szene, "RanchPflegeScreen")
	assert_ne(pflege, null, "Pflege-Screen ist montiert (vorher: nirgends erreichbar)")
	if pflege != null:
		pflege.emit_signal("back_pressed")
		await wait_frames(2)
		assert_eq(_finde_klasse(szene, "RanchPflegeScreen"), null, "Zurück räumt den Screen ab")
	# Hofladen öffnen → Ausbau-Panel hängt im HudLayer.
	szene._laden_knopf.pressed.emit()
	await wait_frames(3)
	assert_ne(
		_finde_klasse(szene, "RanchAusbauPanel"),
		null,
		"Hofladen/Ausbau ist montiert (vorher: nirgends erreichbar)"
	)
	szene.queue_free()
	await wait_frames(1)


func test_hof_hud_vor_dem_kauf_ohne_pflege_knoepfe() -> void:
	var gs := FakeGameState.new({})
	var szene: RanchHofScene = (load(HOF_SZENE) as PackedScene).instantiate()
	szene.game_state_override = gs
	szene.stunde_override = 13.0
	tree.root.add_child(szene)
	await wait_frames(4)
	var fuss: HBoxContainer = szene.get_node("HudLayer/HofHud/FussBox")
	assert_eq(fuss.get_child_count(), 3, "vor dem Kauf nur Ausreiten · Galopp · MP")
	assert_eq(szene._pflege_knopf, null, "kein Pflege-Knopf in der Katalog-Vorschau")
	szene.queue_free()
	await wait_frames(1)


func test_hud_strings_de_en() -> void:
	var de := I18nService.table("de")
	var en := I18nService.table("en")
	for key: String in ["ranchplay.hud.pflege", "ranchplay.hud.hofladen"]:
		assert_true(str(de.get(key, "")).length() > 0, "DE fehlt: %s" % key)
		assert_true(str(en.get(key, "")).length() > 0, "EN fehlt: %s" % key)


## ------------------------------------ 6. Ranch-Slice im Produktions-Boot


## Der ECHTE Boot-Pfad (initialize → register_default_slices) muss den
## ranch-Slice mitbringen — vorher taten das nur Tests, und ein frischer
## Save hatte gar keinen `ranch`-Key (Kauf-Lambda starb nach dem spend).
func test_produktions_boot_bringt_ranch_slice_mit() -> void:
	var dir := "user://ranch_tests/boot_%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.initialize(dir + "/save_v5.json")
	assert_true(
		SaveSchema.registered_slice_ids().has("ranch"),
		"ranch gehört zu den Boot-Slices (vorher: nur Tests registrierten ihn)"
	)
	assert_true(gs.get_value("ranch") is Dictionary, "frischer Save hat den ranch-Slice")
	assert_eq(gs.get_value("ranch.gekauft"), false, "Start: nicht gekauft")
	assert_eq(
		int(gs.get_value("ranch.wirtschaft.lager.heu", -1)),
		4,
		"Start-Lager hat 4 Heu (vorher 0 — Füttern war tot geschaltet)"
	)
	assert_eq(int(gs.get_value("ranch.wirtschaft.lager.apfel", -1)), 2, "…und 2 Äpfel")
	# angebot_gesehen war der Absturz aus dem Playtest-Log (ranch_state:111).
	RanchState.angebot_gesehen(gs)
	assert_eq(gs.get_value("ranch.angebotGesehen"), true, "Angebot-Flag landet im Save")
	gs.free()


## Worst Case bleibt abgesichert: fehlt der Slice trotzdem (Alt-Zustand,
## Fremd-Code), heilt der Kauf ihn im SELBEN update — nie wieder
## „Münzen weg, Ranch nicht da“.
func test_kauf_heilt_fehlenden_slice_atomar() -> void:
	var gs := FakeGameState.new({"economy": {"coins": 3000}, "progression": {"level": 15}})
	assert_eq(RanchKauf.kaufe(gs), RanchKauf.RESULT_OK, "Kauf läuft durch")
	assert_eq(gs.get_value("ranch.gekauft"), true, "Ranch gehört dem Spieler")
	assert_eq(
		int(gs.get_value("economy.coins")),
		3000 - RanchKatalog.preis(),
		"genau der Preis ist weg — nicht Preis weg UND keine Ranch"
	)
	assert_eq(int(gs.get_value("ranch.wirtschaft.lager.heu", -1)), 4, "Heu-Start kommt mit")


## ---------------------------------- 7. Wegweiser-Text zeigt nach AUSSEN


func test_wegweiser_labels_beidseitig_nach_aussen() -> void:
	var wurzel := Node3D.new()
	tree.root.add_child(wurzel)
	var gruppe := RanchWegenetz.baue(wurzel)
	await wait_frames(1)
	var labels: Array[Label3D] = []
	_sammle_labels(gruppe, labels)
	assert_true(labels.size() > 0, "Wegweiser haben Beschriftungen")
	assert_eq(labels.size() % 2, 0, "jede Brettseite hat ihr eigenes Label")
	for label in labels:
		assert_true(not label.double_sided, "keine spiegelverkehrte Rückseite mehr")
		var nach_aussen := signf(label.position.x) * PI / 2.0
		assert_almost(
			label.rotation.y,
			nach_aussen,
			1e-4,
			"Front zeigt vom Brett WEG (vorher: ins Brett — Spiegelschrift)"
		)
	wurzel.queue_free()
	await wait_frames(1)


func _sammle_labels(node: Node, out: Array[Label3D]) -> void:
	if node is Label3D:
		out.append(node)
	for kind in node.get_children():
		_sammle_labels(kind, out)
