extends "res://tests/tools/playtest_flows/flow_basis.gd"
## Flow (H) „Profil & Freunde“: Boot → Onboarding → Profil über den HUD-
## Knopf (Pass, Statistik, Rekorde) → Erfolgs-Screen hin und zurück →
## „Freunde & Besuche“ (Social-Screen, offline-first) → zurück Richtung
## Wohnzimmer. Die Zurück-Schritte sind pflicht=false-Bug-Wächter: die
## Router-History entscheidet, wo „Zurück“ landet — Abweichungen sollen
## auffallen, aber den Lauf nicht abbrechen.
## Aufruf: tools/ci/run_playtest.sh flow_profil_freunde


func schritte() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	liste.append_array(onboarding_schritte())
	(
		liste
		. append_array(
			[
				{
					"name": "profil_oeffnen",
					"aktion": "tipp_name",
					"node": "BtnProfil",
					"erwarte": {"route": "profil"},
					"timeout_s": 60.0,
				},
				{"name": "pass_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "erfolge_oeffnen",
					"aktion": "tipp_name",
					"node": "ErfolgeBtn",
					"erwarte": {"route": "erfolge"},
					"timeout_s": 60.0,
				},
				{"name": "erfolge_ansehen", "aktion": "warte", "sekunden": 1.5},
				{
					"name": "erfolge_zurueck",
					"aktion": "tipp_name",
					"node": "BackBtn",
					"erwarte": {"route": "profil"},
					"timeout_s": 60.0,
				},
				{
					"name": "freunde_oeffnen",
					"aktion": "tipp_name",
					"node": "FreundeBtn",
					"erwarte": {"route": "social"},
					"timeout_s": 60.0,
				},
				{"name": "freunde_ansehen", "aktion": "warte", "sekunden": 2.0},
				{
					"name": "zurueck_zum_profil",
					"aktion": "tipp_text",
					"text": "Zurück",
					"erwarte": {"route": "profil"},
					"timeout_s": 60.0,
					"pflicht": false,
				},
				{
					"name": "profil_zurueck_nach_hause",
					"aktion": "tipp_name",
					"node": "BackBtn",
					"erwarte": {"route": "home/living"},
					"timeout_s": 90.0,
					"pflicht": false,
				},
				{"name": "abschluss", "aktion": "warte", "sekunden": 2.0},
			]
		)
	)
	return liste
