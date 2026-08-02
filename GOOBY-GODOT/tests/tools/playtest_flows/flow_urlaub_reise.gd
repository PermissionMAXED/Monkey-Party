extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (H) „Urlaub & Reise": kompletter Reise-Loop wie ein Spieler — Boot →
## Onboarding → Flughafen → Glitzermeer buchen (Bestätigung, Taxi, Boarding-
## Pass, Abflug-Cutscene) → Zeitsprung +1 Tag (Postkarte!) → Gooby VOR ORT
## besuchen (Streicheln + Souvenir-Spot) → Zeitsprung zur Rückkehr →
## Abholen am Flughafen → Nachprüfen: Münzen, Sammelpass, Erholungs-Boost
## und der Reunion-Kontrakt „ALLE vier Werte auf 100" (vacation.gd
## PICKUP_STAT_FILL, Web: economy.js completeVacationPickup).
## Playtest-Cheats (dokumentiert): Münzen auffüllen, debug.taxi_warte_s=3,
## Zeitsprünge über die pinnbare GameState-Clock, Direktsprung zum
## Flughafen-Ort (die Stadtfahrt selbst ist NICHT Gegenstand dieses Flows).
## Aufruf: tools/ci/run_playtest.sh flow_urlaub_reise

const Vacation := preload("res://scripts/logic/vacation.gd")

const ZIEL := "beach"
const START_COINS := 999

var _coins_vorher := -1
var _fun_vorher := -1.0


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	liste.append_array(_buchungs_schritte())
	liste.append_array(_besuchs_schritte())
	liste.append_array(_abhol_schritte())
	return liste


func _buchungs_schritte() -> Array[Dictionary]:
	return [
		{"name": "cheat_reisekasse", "aktion": "tue", "funktion": cheat_reisekasse},
		{
			"name": "zum_flughafen",
			"aktion": "tue",
			"funktion": gehe_zum_flughafen,
			"erwarte": {"route": "city/ort/flughafen"},
			"timeout_s": 120.0,
		},
		{"name": "flughafen_ankommen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "reise_schalter_oeffnen",
			"aktion": "tipp_text",
			"text": "Reise buchen",
			"erwarte": {"text": "Wohin soll Gooby fliegen?"},
			"timeout_s": 45.0,
		},
		# Sheet federt ein (open.call_deferred) — Taps während der Animation
		# verfehlen den wandernden Knopf (Press+Release müssen treffen).
		{"name": "sheet_einfedern_lassen", "aktion": "warte", "sekunden": 3.0},
		{"name": "coins_merken", "aktion": "tue", "funktion": merke_coins},
		# „Glitzermeer — “ trifft NUR den Buchungs-Knopf (die Abflugtafel
		# schreibt GLITZERMEER in Großbuchstaben ohne Gedankenstrich).
		{
			"name": "ziel_glitzermeer",
			"aktion": "tipp_text",
			"text": "Glitzermeer — ",
			"erwarte": {"text": "Gooby fliegt für"},
			"timeout_s": 30.0,
		},
		{"name": "confirm_lesen", "aktion": "warte", "sekunden": 1.5},
		{
			"name": "buchen",
			"aktion": "tipp_text",
			"text": "Buchen ✈",
			"erwarte": {"text": "Taxi ist unterwegs"},
			"timeout_s": 30.0,
		},
		{
			"name": "buchungskosten_geprueft",
			"aktion": "tue",
			"funktion": pruefe_buchungskosten,
			"erwartung": "Preis 180 + Taxi 10 abgebucht",
		},
		{"name": "taxi_abwarten", "aktion": "warte_bis", "text": "Einsteigen!", "timeout_s": 60.0},
		{
			"name": "einsteigen",
			"aktion": "tipp_text",
			"text": "Einsteigen!",
			"erwarte": {"text": "Gute Reise"},
			"timeout_s": 30.0,
		},
		{"name": "gute_reise", "aktion": "tipp_text", "text": "Gute Reise", "timeout_s": 30.0},
		{
			"name": "abflug_cutscene_skip",
			"aktion": "tipp_falls_da",
			"text": "Überspringen",
			"timeout_s": 20.0,
			"pflicht": false,
		},
		{
			"name": "nach_hause_nach_abflug",
			"aktion": "warte_bis",
			"route": "home/living",
			"timeout_s": 240.0,
		},
		{
			"name": "urlaub_gebucht_geprueft",
			"aktion": "tue",
			"funktion": pruefe_gebucht,
			"erwartung": "vacation.phase == away, destId == beach",
		},
	]


func _besuchs_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "zeitsprung_1_tag",
			"aktion": "tue",
			"funktion": zeitsprung.bind(26.0),
		},
		{"name": "ticker_aufholen_lassen", "aktion": "warte", "sekunden": 3.0},
		{
			"name": "postkarte_angekommen",
			"aktion": "warte_bis",
			"bedingung": postkarte_da,
			"timeout_s": 20.0,
			"erwartung": "vacation.postcards >= 1 nach einem vollen Tag",
		},
		{
			"name": "zurueck_zum_flughafen",
			"aktion": "tue",
			"funktion": gehe_zum_flughafen,
			"erwarte": {"route": "city/ort/flughafen"},
			"timeout_s": 120.0,
		},
		{
			"name": "reise_app_waehrend_urlaub",
			"aktion": "tipp_text",
			"text": "Reise buchen",
			"erwarte": {"text": "Gooby ist im Urlaub"},
			"timeout_s": 45.0,
		},
		{"name": "fun_merken", "aktion": "tue", "funktion": merke_fun},
		{
			"name": "gooby_besuchen",
			"aktion": "tipp_text",
			"text": "Gooby besuchen",
			"erwarte": {"route": "city/urlaub/strand"},
			"timeout_s": 180.0,
		},
		{"name": "strand_ankommen", "aktion": "warte", "sekunden": 2.0},
		{"name": "streicheln", "aktion": "tipp_text", "text": "Streicheln", "timeout_s": 30.0},
		{
			"name": "streicheln_macht_spass",
			"aktion": "warte_bis",
			"bedingung": fun_gestiegen,
			"timeout_s": 15.0,
			"erwartung": "gooby.stats.fun steigt nach dem Streicheln",
		},
		{
			"name": "souvenir_spot",
			"aktion": "tipp_text",
			"text": "Souvenir-Spot",
			"erwarte": {"text": "gefunden!"},
			"timeout_s": 30.0,
		},
		{
			"name": "souvenir_im_inventar",
			"aktion": "tue",
			"funktion": pruefe_souvenir,
			"erwartung": "inventory.items.souvenir_beach == 1 und +5 Münzen",
		},
		{
			"name": "strand_verlassen",
			"aktion": "tipp_name",
			"node": "Verlassen",
			"erwarte": {"route": "city/ort/flughafen"},
			"timeout_s": 120.0,
		},
	]


func _abhol_schritte() -> Array[Dictionary]:
	return [
		{
			"name": "zeitsprung_zur_rueckkehr",
			"aktion": "tue",
			"funktion": zeitsprung_zur_rueckkehr,
		},
		{"name": "rueckkehr_ankommen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "reise_app_abholansicht",
			"aktion": "tipp_text",
			"text": "Reise buchen",
			"erwarte": {"text": "Gooby wartet am Flughafen!"},
			"timeout_s": 45.0,
		},
		{"name": "coins_vor_abholung_merken", "aktion": "tue", "funktion": merke_coins},
		{
			"name": "abholen",
			"aktion": "tipp_text",
			"text": "Abholen 🧳",
			"erwarte": {"text": "Wiedersehen!"},
			"timeout_s": 30.0,
		},
		{
			"name": "abholung_geprueft",
			"aktion": "tue",
			"funktion": pruefe_abholung,
			"erwartung": "+30 Souvenir-Münzen, trips=1, visited.beach, Boost gestempelt",
		},
		{
			"name": "reunion_fuellt_alle_werte",
			"aktion": "tue",
			"funktion": pruefe_reunion_werte,
			"erwartung": "ALLE vier Gooby-Werte stehen nach der Abholung auf 100",
		},
	]


## ------------------------------------------------------- Cheats & Checks


## Playtest-Cheat: Reisekasse füllen + Taxi-Wartezeit auf 3 s (Debug-Key).
func cheat_reisekasse() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	gs.set_value("economy.coins", START_COINS)
	var settings: Object = harness.root.get_node_or_null("/root/AppSettings")
	if settings == null:
		return false
	settings.set_setting("debug.taxi_warte_s", 3)
	return true


## Direktsprung zum Flughafen-Ort (die Stadtfahrt testet flow_home_basis&Co).
func gehe_zum_flughafen() -> bool:
	var router: Object = harness.root.get_node_or_null("/root/SceneRouter")
	if router == null or router.is_busy():
		return false
	CityScene.register_routes(router)
	router.goto(&"city/ort/flughafen", {})
	return true


func merke_coins() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	_coins_vorher = int(gs.get_value("economy.coins", -1))
	return _coins_vorher >= 0


func pruefe_buchungskosten() -> bool:
	var gs: Object = game_state()
	if gs == null or _coins_vorher < 0:
		return false
	var preis := int(Vacation.CATALOG[ZIEL]["price"])
	return int(gs.get_value("economy.coins", -1)) == _coins_vorher - preis - TaxiLogic.KOSTEN


func pruefe_gebucht() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	var v := Vacation.slice_of(gs.state())
	return str(v["phase"]) == Vacation.PHASE_AWAY and str(v["destId"]) == ZIEL


## Zeitsprung: Clock des GameState um `stunden` nach vorn pinnen.
func zeitsprung(stunden: float) -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	gs.clock.pin(int(gs.clock.now_ms() + stunden * 3_600_000.0))
	return true


## Bis kurz NACH returnAt springen (returnReady — Abholfenster offen).
func zeitsprung_zur_rueckkehr() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	var return_at := int(Vacation.slice_of(gs.state())["returnAt"])
	if return_at <= 0:
		return false
	gs.clock.pin(return_at + 60_000)
	return true


func postkarte_da() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	return int(Vacation.slice_of(gs.state())["postcards"]) >= 1


func merke_fun() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	_fun_vorher = float(gs.get_value("gooby.stats.fun", -1.0))
	return _fun_vorher >= 0.0


func fun_gestiegen() -> bool:
	var gs: Object = game_state()
	if gs == null or _fun_vorher < 0.0:
		return false
	return float(gs.get_value("gooby.stats.fun", -1.0)) > _fun_vorher


func pruefe_souvenir() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	return int(gs.get_value("inventory.items.souvenir_%s" % ZIEL, 0)) == 1


func pruefe_abholung() -> bool:
	var gs: Object = game_state()
	if gs == null or _coins_vorher < 0:
		return false
	var v := Vacation.slice_of(gs.state())
	var souvenir := int(Vacation.CATALOG[ZIEL]["souvenirCoins"])
	if int(gs.get_value("economy.coins", -1)) != _coins_vorher + souvenir:
		return false
	if int(v["trips"]) != 1 or not bool((v["visited"] as Dictionary).get(ZIEL, false)):
		return false
	return int(v["erholtBis"]) > 0


## Reunion-Kontrakt (vacation.gd PICKUP_STAT_FILL, Web completeVacation-
## Pickup): ALLE vier Werte stehen nach der Abholung auf 100.
func pruefe_reunion_werte() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	for stat: String in ["hunger", "energy", "hygiene", "fun"]:
		if float(gs.get_value("gooby.stats.%s" % stat, -1.0)) < 99.9:
			return false
	return true
