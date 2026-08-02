extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow „Onboarding + Tour + Tagesquests" (H-Playtest Onboarding/Progression):
## Boot → Onboarding-Dialog wie ein Spieler → Tagesbonus → die Erste-
## Viertelstunde-Tour WIRKLICH spielen statt wegtippen: Ankunft bestätigen,
## den Gooby echt streicheln (Auto-Erfüllung + Feier), die restlichen
## Tu-es-Schritte wie ein ungeduldiger Spieler überspringen, Ausblick
## bestätigen → guide.done im Save. Danach Tagesquests: HUD-Knopf, Brett mit
## 3 Karten, 1×-Reroll (rerolledDay-Flag im Save).
## Aufruf: tools/ci/run_playtest.sh flow_onboarding_tour


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(_onboarding_ohne_tour_wegtippen())
	liste.append_array(_tour_spielen())
	liste.append_array(_tagesquests())
	return liste


## Wie onboarding_schritte(), aber OHNE guide_tour_beenden — die Tour ist
## hier das Testobjekt und soll stehen bleiben.
func _onboarding_ohne_tour_wegtippen() -> Array[Dictionary]:
	return [
		{
			"name": "boot_bis_onboarding",
			"aktion": "warte_bis",
			"klasse": "OnboardingFlow",
			"timeout_s": 180.0,
		},
		{"name": "name_eingeben", "aktion": "eingabe", "node": "NameEdit", "text": "Pionier"},
		{"name": "welcome_weiter", "aktion": "tipp_name", "node": "WelcomeNext"},
		{
			"name": "spitzname_eingeben",
			"aktion": "eingabe",
			"node": "NicknameEdit",
			"text": "Goobster",
		},
		{"name": "spitzname_weiter", "aktion": "tipp_name", "node": "NicknameNext"},
		{"name": "editor_weiter", "aktion": "tipp_name", "node": "EditorNext"},
		{
			"name": "onboarding_fertig",
			"aktion": "tipp_name",
			"node": "DoneButton",
			"erwarte": {"route": "home/living"},
			"timeout_s": 120.0,
		},
		{"name": "wohnzimmer_ankommen", "aktion": "warte", "sekunden": 2.0},
		{
			"name": "tagesbonus_abholen",
			"aktion": "tipp_falls_da",
			"text": "Abholen!",
			"timeout_s": 10.0,
			"pflicht": false,
		},
	]


func _tour_spielen() -> Array[Dictionary]:
	var liste: Array[Dictionary] = [
		{
			"name": "tour_karte_steht",
			"aktion": "warte_bis",
			"klasse": "OnboardingGuide",
			"timeout_s": 30.0,
		},
		{
			"name": "ankunft_bestaetigen",
			"aktion": "tipp_name",
			"node": "GuideWeiter",
			"erwarte": {"bedingung": tour_schritt_mindestens.bind(1)},
			"timeout_s": 25.0,
		},
		# Streicheln WIRKLICH tun: 3 Taps auf die GoobyTapArea (der Gooby
		# wandert — der Finder löst die Position pro Tap frisch auf).
		{"name": "gooby_streicheln_1", "aktion": "tipp_3d", "finder": finde_gooby_tap_area},
		{"name": "streichel_pause", "aktion": "warte", "sekunden": 0.6},
		{"name": "gooby_streicheln_2", "aktion": "tipp_3d", "finder": finde_gooby_tap_area},
		{
			"name": "streicheln_gefeiert",
			"aktion": "warte_bis",
			"bedingung": tour_schritt_mindestens.bind(2),
			"timeout_s": 30.0,
			"erwartung": "echtes Streicheln erfüllt Tour-Schritt 2 (Feier + Weiterschalten)",
		},
	]
	# Schritte 3–8 (füttern/waschen/münzen/minispiel/möbel/sticker) wie ein
	# ungeduldiger Spieler überspringen. tipp_falls_da: ein Schritt kann
	# sich auch selbst erfüllen (Sticker gab es evtl. schon) — dann fehlt
	# der Knopf und nur die Schritt-Bedingung zählt.
	var ueberspringbar := ["fuettern", "waschen", "muenzen", "minispiel", "moebel", "sticker"]
	for i in ueberspringbar.size():
		(
			liste
			. append(
				{
					"name": "tour_%s_ueberspringen" % ueberspringbar[i],
					"aktion": "tipp_falls_da",
					"node": "GuideUeberspringen",
					"timeout_s": 8.0,
				}
			)
		)
		(
			liste
			. append(
				{
					"name": "tour_nach_%s" % ueberspringbar[i],
					# Nach dem Überspringen von STEPS[i+2] steht der Index i+3.
					"aktion": "warte_bis",
					"bedingung": tour_schritt_mindestens.bind(i + 3),
					"timeout_s": 20.0,
					"erwartung": "Tour steht bei Schritt-Index %d+" % (i + 3),
				}
			)
		)
	(
		liste
		. append_array(
			[
				{
					"name": "ausblick_bestaetigen",
					"aktion": "tipp_name",
					"node": "GuideWeiter",
					"erwarte": {"bedingung": tour_fertig},
					"timeout_s": 25.0,
				},
				{"name": "tour_konfetti_ansehen", "aktion": "warte", "sekunden": 2.5},
			]
		)
	)
	return liste


func _tagesquests() -> Array[Dictionary]:
	return [
		{
			"name": "quest_panel_oeffnen",
			"aktion": "tipp_name",
			"node": "BtnQuests",
			"erwarte": {"klasse": "DailyQuestPanel"},
			"timeout_s": 30.0,
		},
		{
			"name": "quest_brett_hat_drei_karten",
			"aktion": "tue",
			"funktion": brett_hat_drei_karten,
			"erwartung": "quests.active trägt 3 Tages-Karten",
		},
		{
			"name": "reroll_druecken",
			"aktion": "tipp_name",
			"node": "RerollButton",
			"erwarte": {"bedingung": reroll_verbraucht},
			"timeout_s": 20.0,
		},
		{
			"name": "brett_nach_reroll_intakt",
			"aktion": "tue",
			"funktion": brett_hat_drei_karten,
			"erwartung": "nach dem Reroll stehen wieder 3 Karten",
		},
		{"name": "quest_brett_ansehen", "aktion": "warte", "sekunden": 1.5},
	]


## Tippfläche des Goobys (Sphere r=0,45 auf Kopfhöhe, folgt dem Wandern).
func finde_gooby_tap_area() -> Node3D:
	var szene := aktuelle_szene()
	if szene == null:
		return null
	var treffer := szene.find_child("GoobyTapArea", true, false)
	return treffer if treffer is Node3D else null


## Tour-Fortschritt aus dem Save (onboarding.guide.step).
func tour_schritt_mindestens(n: int) -> bool:
	var gs := game_state()
	if gs == null:
		return false
	return int(gs.get_value("onboarding.guide.step", -1)) >= n


func tour_fertig() -> bool:
	var gs := game_state()
	return gs != null and bool(gs.get_value("onboarding.guide.done", false))


func brett_hat_drei_karten() -> bool:
	var gs := game_state()
	if gs == null:
		return false
	var active: Variant = gs.get_value("quests.active", [])
	return active is Array and (active as Array).size() == 3


func reroll_verbraucht() -> bool:
	var gs := game_state()
	return gs != null and str(gs.get_value("quests.rerolledDay", "")) != ""
