extends TestCase
## WARN-SWEEP-Regressionen (Headless-Fehlerjagd, s. bughunt_walkthrough.gd):
## 1. Pill-Polygone (Veil-Balken/-Sweep + Boot-Möhrenbalken) triangulieren
##    auch bei schmalen Füllständen — vorher doppelten sich bei Breite ≤
##    Höhe die Kappen-Nahtpunkte und JEDER schmale Sweep-Frame spammte
##    „ERROR: Invalid polygon data, triangulation failed" ins Log (26×
##    pro Walkthrough-Lauf, sichtbar als Loch im Sweep-Band).
## 2. main.gd wartet auf Boot-SIGNALE statt direkt auf die Poll-Coroutinen:
##    verschachtelte Coroutine-awaits bilden einen Funktionszustands-Zyklus,
##    der beim Quit mitten im Boot (CI-Smoke `--quit`) als ObjectDB-Leak
##    endet („WARNING: ObjectDB instances leaked at exit" in jedem Lauf).

const MAIN_PFAD := "res://scripts/boot/main.gd"

## Breiten-Stichproben in px für einen 10-px-hohen Track: schmaler als hoch
## (die alten Fehler-Fälle), exakt quadratisch (Boot-Balken-Klemme
## fuell_w == track_h), knapp darüber und der breite Normalfall.
const PILL_BREITEN: Array[float] = [0.6, 1.0, 3.0, 7.5, 10.0, 10.5, 100.0]
const PILL_HOEHE := 10.0


func test_pill_punkte_triangulieren_bei_allen_breiten() -> void:
	for breite in PILL_BREITEN:
		var punkte := LoadingVeilBalken.pill_punkte(Rect2(0.0, 0.0, breite, PILL_HOEHE))
		assert_true(punkte.size() >= 3, "Pill %.1f px liefert ein Polygon" % breite)
		assert_true(
			Geometry2D.triangulate_polygon(punkte).size() > 0,
			"Pill %.1f px trianguliert (vorher: Invalid polygon data)" % breite
		)


func test_pill_punkte_ohne_doppelte_nahtpunkte() -> void:
	for breite in PILL_BREITEN:
		var punkte := LoadingVeilBalken.pill_punkte(Rect2(0.0, 0.0, breite, PILL_HOEHE))
		for i in punkte.size():
			var naechster := punkte[(i + 1) % punkte.size()]
			assert_true(
				punkte[i].distance_squared_to(naechster) > 0.0001,
				"Pill %.1f px: Punkt %d doppelt sich nicht (auch Schluss→Start)" % [breite, i]
			)


func test_breite_pill_bleibt_unveraendert() -> void:
	# Normalfall (Breite >> Höhe): beide Kappen getrennt, alle 16 Punkte
	# einzigartig — das Dedupe darf die Optik hier NICHT anfassen.
	var punkte := LoadingVeilBalken.pill_punkte(Rect2(0.0, 0.0, 100.0, PILL_HOEHE))
	assert_eq(punkte.size(), 2 * (LoadingVeilBalken.KAPPEN_SEGMENTE + 1), "16 Kappen-Punkte")


func test_ohne_doppelpunkte_pur() -> void:
	var eingabe := PackedVector2Array(
		[Vector2.ZERO, Vector2.ZERO, Vector2(1, 0), Vector2(1, 1), Vector2(1, 1), Vector2.ZERO]
	)
	var out := LoadingVeilBalken.ohne_doppelpunkte(eingabe)
	assert_eq(out.size(), 3, "Konsekutive Doppel + Schluss==Start entfernt")
	assert_eq(out[0], Vector2.ZERO)
	assert_eq(out[1], Vector2(1, 0))
	assert_eq(out[2], Vector2(1, 1))


func test_boot_wartet_auf_signale_statt_coroutinen() -> void:
	# Quell-Wache: _boot darf die Poll-Coroutinen nie direkt awaiten —
	# `await _lade_welt()`/`await _warte_auf_zuhause()` wären wieder der
	# Zustand-wartet-auf-Zustand-Zyklus, der beim Boot-Smoke-Quit leakt.
	var quelle := FileAccess.get_file_as_string(MAIN_PFAD)
	assert_false(quelle.is_empty(), "main.gd lesbar")
	assert_false(quelle.contains("await _lade_welt("), "kein await auf _lade_welt")
	assert_false(quelle.contains("await _warte_auf_zuhause("), "kein await auf _warte_auf_zuhause")
	assert_true(quelle.contains("await welt_geladen"), "Welt-Phase wartet auf das Signal")
	assert_true(quelle.contains("await zuhause_erreicht"), "Zuhause-Phase wartet auf das Signal")
