extends TestCase
## H-PLAYTEST Batch 2+3 — Wächter (docs/godot-rewrite/playtest/H-minigames-2.md):
## 1) ranchParcours: HUD + Reit-Knöpfe skalieren per _ui (M9) — vorher feste
##    16/10/48-px-Offsets, ein 340-px-Hint-Nagel und 150×64-px-Knöpfe
##    (Krümel-HUD + Mini-Knöpfe auf dem Landscape-Leitformat 2868×1320).
## 2) gobnom: das End-Panel skaliert über ScreenShell.metrics wie das eigene
##    Level-Select — vorher fixe 340×170 px samt 104×48-Knöpfen unterm
##    Touch-Floor; Titel/Knöpfe blieben Theme-klein neben dem skalierten Brett.

const PARCOURS_SCENE := "res://scripts/minigames/games/ranch_parcours/parcours_game.tscn"
const GOBNOM_SCENE := "res://scripts/minigames/games/gobnom/gobnom_game.tscn"


func _mount(scene_path: String, game_id: String, seed_value := 4242) -> MinigameBase:
	var ctx := MinigameCtx.new()
	ctx.game_id = game_id
	ctx.difficulty = "normal"
	ctx.run_seed = seed_value
	var game: MinigameBase = (load(scene_path) as PackedScene).instantiate()
	tree.root.add_child(game)
	game.setup(ctx)
	game.start()
	return game


func test_parcours_hud_skaliert_mit_ui_faktor() -> void:
	var game := _mount(PARCOURS_SCENE, "ranchParcours")
	game.call("_on_level_chosen", 1)
	assert_true(bool(game.get("level_running")), "Kurs 1 läuft")
	game.call("apply_view", Vector2(390.0, 844.0))
	# Null-sicher lesen: VOR dem Fix gab es gar kein _ui-Feld (fester Nagel).
	var ui_wert: Variant = game.get("_ui")
	assert_true(ui_wert != null, "Parcours trägt den M9-_ui-Faktor")
	var ui_f := -1.0
	if ui_wert is float:
		ui_f = ui_wert
	assert_almost(ui_f, 1.0, 1e-6, "Phone = Faktor 1")
	var zeit := game.get("_zeit_label") as Label
	assert_eq(zeit.get_theme_font_size("font_size"), 34, "Phone: Headline bleibt 34")
	var galopp := game.get("_galopp_btn") as Button
	assert_almost(galopp.custom_minimum_size.x, 150.0, 0.01, "Phone: Knopf bleibt 150 breit")
	# Leitformat quer (iPhone 17 Pro Max): Kurzkante 1320/390 → Deckel 3,0.
	game.call("apply_view", Vector2(2868.0, 1320.0))
	assert_almost(float(game.get("_ui")), 3.0, 1e-6, "Leitformat: Deckel 3,0")
	assert_eq(
		zeit.get_theme_font_size("font_size"),
		int(34.0 * 3.0),
		"Zeit-Label wächst mit (keine Krümelschrift mehr)"
	)
	assert_almost(
		galopp.custom_minimum_size.x, 450.0, 0.01, "Galopp-Knopf wächst mit (kein 150-px-Nagel)"
	)
	var sprung := game.get("_sprung_btn") as Button
	assert_almost(
		sprung.position.x,
		2868.0 - 168.0 * 3.0,
		0.01,
		"Sprung-Knopf hält den skalierten Randabstand"
	)
	var hint := game.get("_hint_label") as Label
	var hint_w := minf(2868.0 - 32.0 * 3.0, 340.0 * 3.0)
	assert_almost(hint.position.x, (2868.0 - hint_w) * 0.5, 0.01, "Hinweis bleibt mittig zentriert")
	game.free()


func test_gobnom_end_overlay_skaliert() -> void:
	var game := _mount(GOBNOM_SCENE, "gobnom")
	game.call("_build_end_overlay", true, 2, 120, false)
	var overlay := game.get("_overlay") as Control
	assert_true(overlay != null, "End-Panel steht")
	var m := ScreenShell.metrics(game.get_viewport())
	var f: float = m["f"]
	var floor_px: float = m["floor_px"]
	var title := overlay.get_child(0) as Label
	assert_eq(
		title.get_theme_font_size("font_size"),
		int(maxf(roundf(34.0 * f), 10.0)),
		"Titel skaliert über ScreenShell.scale_fonts (kein Theme-Krümel)"
	)
	var buttons := 0
	for row: Node in overlay.get_children():
		for child: Node in row.get_children():
			var button := child as Button
			if button == null:
				continue
			buttons += 1
			assert_true(
				button.custom_minimum_size.x >= 104.0 * f - 0.01,
				"Knopf-Breite skaliert mit f (kein 104-px-Nagel)"
			)
			assert_true(
				button.custom_minimum_size.y >= floor_px - 0.01, "Knopf hält den Touch-Floor"
			)
	assert_true(buttons >= 2, "End-Panel trägt Weiter/Auswahl-Knöpfe")
	var vp := game.get_viewport_rect().size
	assert_true(overlay.size.x >= 340.0 * f - 0.01, "Plate-Breite skaliert mit f")
	assert_almost(
		overlay.position.x, (vp.x - overlay.size.x) * 0.5, 0.5, "Plate bleibt horizontal zentriert"
	)
	game.free()
