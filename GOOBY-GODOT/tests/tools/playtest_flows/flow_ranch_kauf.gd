extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (H) „Ranch-Kauf & Hof-Loop": Boot → Onboarding → Ranch-Angebot
## (Level-15-Sheet) → „Jetzt losfahren" → ECHTE Überlandfahrt bis ans Tor
## (das Auto fährt selbst, wie in der Stadt) → Kauf am Tor (2500 ᴳ) → Hof:
## Galopp, Pferdepflege (Heu füttern — der Spieler-Einstieg in den
## RANCH-2-Care-Loop), Ausritt in die offene Region und zurück.
## Playtest-Cheats (dokumentiert): Level 15 + Münzen — das Level-Grinden
## selbst ist nicht Gegenstand dieses Flows.
## Aufruf: tools/ci/run_playtest.sh flow_ranch_kauf

const START_COINS := 3000

var _coins_vorher := -1
var _hunger_vorher := -1.0


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	liste.append_array(_kauf_schritte())
	liste.append_array(_hof_schritte())
	return liste


func _kauf_schritte() -> Array[Dictionary]:
	return [
		{"name": "cheat_level_und_kasse", "aktion": "tue", "funktion": cheat_level_und_kasse},
		{
			"name": "ranch_angebot_zeigen",
			"aktion": "tue",
			"funktion": angebot_oeffnen,
			"erwarte": {"text": "Jetzt losfahren"},
			"timeout_s": 30.0,
		},
		{
			"name": "jetzt_losfahren",
			"aktion": "tipp_text",
			"text": "Jetzt losfahren",
			"erwarte": {"route": "ranch/fahrt"},
			"timeout_s": 180.0,
		},
		{
			"name": "landstrasse_bis_zum_tor",
			"aktion": "warte_bis",
			"text": "Ranch-Tor",
			"timeout_s": 300.0,
			"erwartung": "Auto erreicht das Tor (Prompt „Da vorne ist das Ranch-Tor!“)",
		},
		{
			"name": "tor_prompt_druecken",
			"aktion": "tipp_text",
			"text": "Kaufen (",
			"erwarte": {"text": "Riesenfeld"},
			"timeout_s": 30.0,
		},
		{
			"name": "kauf_bestaetigen",
			"aktion": "tue",
			"funktion": kauf_im_sheet_bestaetigen,
			"erwarte": {"route": "ranch/hof"},
			"timeout_s": 180.0,
		},
		{
			"name": "kauf_geprueft",
			"aktion": "tue",
			"funktion": pruefe_kauf,
			"erwartung": "ranch.gekauft, −2500 ᴳ, Start-Pferde + Hoftiere eingezogen",
		},
	]


func _hof_schritte() -> Array[Dictionary]:
	return [
		{"name": "hof_ankommen", "aktion": "warte", "sekunden": 2.0},
		{"name": "galopp_an", "aktion": "tipp_text", "text": "Galopp!", "timeout_s": 30.0},
		{"name": "galopp_zuschauen", "aktion": "warte", "sekunden": 3.0},
		{
			"name": "pflege_oeffnen",
			"aktion": "tipp_text",
			"text": "Pflege",
			"erwarte": {"klasse": "RanchPflegeScreen"},
			"timeout_s": 30.0,
		},
		{"name": "pferdehunger_merken", "aktion": "tue", "funktion": merke_pferdehunger},
		{"name": "heu_fuettern", "aktion": "tipp_text", "text": "Heu füttern", "timeout_s": 30.0},
		{
			"name": "heu_wirkt",
			"aktion": "warte_bis",
			"bedingung": pferdehunger_gestiegen,
			"timeout_s": 15.0,
			"erwartung": "Pferde-Hunger steigt nach dem Füttern (Heu-Vorrat −1)",
		},
		{
			"name": "pflege_zurueck",
			"aktion": "tipp_text",
			"text": "Zurück",
			"erwarte": {"weg_klasse": "RanchPflegeScreen"},
			"timeout_s": 30.0,
		},
		{
			"name": "ausreiten",
			"aktion": "tipp_text",
			"text": "Ausreiten",
			"erwarte": {"route": "ranch/welt"},
			"timeout_s": 240.0,
		},
		{"name": "region_erkunden", "aktion": "warte", "sekunden": 6.0},
		# Der HUD-Knopf der Region heißt „Zum Hof“ (rwelt.hud.zur_ranch —
		# der Key täuscht, der DE-Text ist „Zum Hof“).
		{
			"name": "zurueck_zum_hof",
			"aktion": "tipp_text",
			"text": "Zum Hof",
			"erwarte": {"route": "ranch/hof"},
			"timeout_s": 180.0,
		},
		{"name": "abschluss_hof", "aktion": "warte", "sekunden": 2.0},
	]


## ------------------------------------------------------- Cheats & Checks


## Playtest-Cheat: Ranch-Freischaltlevel + Kaufkasse (Grinden ist nicht
## Gegenstand dieses Flows).
func cheat_level_und_kasse() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	gs.set_value("progression.level", RanchKatalog.freischalt_level())
	gs.set_value("economy.coins", START_COINS)
	_coins_vorher = START_COINS
	return true


## Das ECHTE Angebot-Sheet öffnen (erscheint sonst nach dem Rückblick).
func angebot_oeffnen() -> bool:
	var szene := aktuelle_szene()
	if szene == null:
		return false
	return RanchOffer.zeige(szene, game_state()) != null


## Kauf-Knopf im Tor-Sheet drücken (Meta-Vertrag der Ranch-Sheets — der
## Prompt-Knopf am HUD trägt denselben Text und wäre im Baum mehrdeutig).
## Kassenstand wird HIER gemerkt, nicht beim Cheat: der Cheat selbst löst
## die Erfolge coins1000 (+50 ᴳ) und level10 (+100 ᴳ) aus — gegen den
## Cheat-Stand gerechnet wäre die −2500-Prüfung immer schief.
func kauf_im_sheet_bestaetigen() -> bool:
	var szene := aktuelle_szene()
	if szene == null or not ("tor_sheet" in szene):
		return false
	var sheet: Control = szene.tor_sheet
	if sheet == null or not is_instance_valid(sheet):
		return false
	var knopf: Button = sheet.get_meta(RanchOffer.META_JETZT)
	if knopf == null:
		return false
	_coins_vorher = int(game_state().get_value("economy.coins", -1))
	knopf.pressed.emit()
	return true


func pruefe_kauf() -> bool:
	var gs: Object = game_state()
	if gs == null:
		return false
	if not bool(gs.get_value("ranch.gekauft", false)):
		print("[flow_ranch_kauf] pruefe_kauf: ranch.gekauft ist false")
		return false
	var coins := int(gs.get_value("economy.coins", -1))
	if coins != _coins_vorher - RanchKatalog.preis():
		print(
			(
				"[flow_ranch_kauf] pruefe_kauf: coins %d != %d - %d"
				% [coins, _coins_vorher, RanchKatalog.preis()]
			)
		)
		return false
	var pferde: Variant = gs.get_value("ranch.tiere.pferde", {})
	var hoftiere: Variant = gs.get_value("ranch.hoftiere", [])
	if not (pferde is Dictionary) or (pferde as Dictionary).is_empty():
		print("[flow_ranch_kauf] pruefe_kauf: keine Start-Pferde")
		return false
	if not (hoftiere is Array) or (hoftiere as Array).is_empty():
		print("[flow_ranch_kauf] pruefe_kauf: keine Hoftiere")
		return false
	return true


func merke_pferdehunger() -> bool:
	_hunger_vorher = _erster_pferdehunger()
	return _hunger_vorher >= 0.0


func pferdehunger_gestiegen() -> bool:
	if _hunger_vorher < 0.0:
		return false
	return _erster_pferdehunger() > _hunger_vorher


func _erster_pferdehunger() -> float:
	var gs: Object = game_state()
	if gs == null:
		return -1.0
	var pferde: Variant = gs.get_value("ranch.tiere.pferde", {})
	if not (pferde is Dictionary) or (pferde as Dictionary).is_empty():
		return -1.0
	var ids: Array = (pferde as Dictionary).keys()
	ids.sort()
	var werte: Variant = (pferde as Dictionary)[ids[0]].get("werte", {})
	if not (werte is Dictionary):
		return -1.0
	return float((werte as Dictionary).get("hunger", -1.0))
