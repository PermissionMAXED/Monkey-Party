extends "res://tools/capture/clip_driver.gd"
## Clip: Onkel Alwins Stammkunden-Ritual im Goo-und-Bye-Laden (§6.3) —
## Punkt 9 Uhr betritt Alwin als ERSTER Kunde den Laden: Schiebermütze,
## Kennerblick am Regal (Tageszeile als Sprechblase), Polier-Wisch im
## Vorbeigehen und GENAU eine Möhre an der Kasse. Mit `--variante=leer`
## zeigt der Clip den traurigen Pfad: kein Möhren-Slot bestückt,
## Hängeohren-Zeile, KEIN Kassen-Stopp (Alwin dreht wieder ab).
## Regie: echte Spiellogik (laden_oeffnen → deterministischer Markttag);
## nur bestückt wird direkt über GoobyeRegal, und Navigation/Slot-Knöpfe
## sind ausgeblendet (Aufnahme-Regie wie markt.gd, kein Motiv).

const LadenSzene := preload("res://scripts/dlc/goobye/laden_scene.tscn")

## Fester Tages-Seed: Kunde 0 ist IMMER Alwin, die Tageszeile ist damit
## reproduzierbar (GoobyeAlwin.spruch_index → Seed % Poolgröße; 8 trifft
## in BEIDEN Pools Zeile 0 — kurz genug, dass der Typewriter im Clip
## durchkommt).
const SEED := 8

## Regal-Schaufenster: je Slot [Katalog-Ware, Stückzahl] — Möhre mittig.
const BESTUECKUNG := [["apple", 5], ["carrot", 6], ["bread", 4], ["cookie", 5], ["cheese", 4]]

## Start-Lager, deckt die Bestückung ab (Rest bleibt liegen).
const LAGER := {"apple": 6, "carrot": 8, "bread": 5, "cookie": 5, "cheese": 4}

var laden: GoobyeLadenScene
var leer := false


func _setup() -> void:
	leer = OS.get_cmdline_user_args().has("--variante=leer")
	duration = 7.5 if leer else 10.5
	_zustand_vorbereiten()
	laden = LadenSzene.instantiate()
	laden.seed_override = SEED
	laden.auto_navigate = false
	add_child(laden)
	_regal_bestuecken()
	_navigation_ausblenden()
	schedule(0.2, _kino_kamera)
	schedule(1.2, func() -> void: laden.laden_oeffnen())
	if not leer:
		schedule(5.6, _kamera_zur_kasse)


## Save-Vorbereitung: Intro-Karte (§1.3) schon gesehen + Lager gefüllt —
## der Clip startet direkt im bestückten Laden.
func _zustand_vorbereiten() -> void:
	var gs: Object = get_node_or_null("/root/GameState")
	if gs == null:
		return
	GoobyeState.register_slice()
	GoobyeState.erstbesuch_merken(gs)
	GoobyeState.lager_setzen(gs, LAGER.duplicate())


## Regal direkt füllen (gleiche Logik wie slot_tippen, ohne Tipp-Choreo).
## Variante `leer`: der Möhren-Slot bleibt frei — Alwins Bon hat dann
## KEINE Möhre (GoobyeMarkttag zählt sie als verpassten Griff).
func _regal_bestuecken() -> void:
	for slot in BESTUECKUNG.size():
		var eintrag: Array = BESTUECKUNG[slot]
		if leer and str(eintrag[0]) == GoobyeMarkttag.ALWIN_WARE:
			continue
		GoobyeRegal.einraeumen(laden._regal, slot, str(eintrag[0]), int(eintrag[1]), laden._lager)
	laden._slots_aktualisieren()
	laden._lager_label_aktualisieren()


## Navigation + Slot-Knöpfe sind Bedienung, kein Motiv — und die Slot-
## Knöpfe kleben am Scene-Cam-Unproject (unter der Kino-Kamera falsch).
func _navigation_ausblenden() -> void:
	if laden._verlassen != null:
		laden._verlassen.visible = false
	if laden._leiste != null:
		laden._leiste.visible = false
	for knopf in laden._slot_knoepfe:
		knopf.visible = false


## Start nahe der Spiel-Kamera (ganzes Diorama: Tür rechts, Regal links),
## dann sanfter Push-in Richtung Regal — Ankunft zum Kennerblick.
func _kino_kamera() -> void:
	cine_camera(Vector3(0.0, 2.0, 4.2), Vector3(0.0, 0.94, -0.8), 75.0)
	move_camera(Vector3(-0.2, 1.75, 3.55), Vector3(-0.9, 0.8, -0.8), 4.2, 62.0)


## Schwenk zur Kasse für Möhren-Piep + seligen Abgang (nur Happy-Path).
func _kamera_zur_kasse() -> void:
	move_camera(Vector3(0.6, 1.8, 3.8), Vector3(1.4, 0.7, -0.7), 1.6)
