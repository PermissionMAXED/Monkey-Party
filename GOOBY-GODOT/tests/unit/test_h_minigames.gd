extends TestCase
## H-MINIGAMES — Playtest-Wächter (docs/godot-rewrite/playtest/H-minigames.md):
## 1) teaParty: eine VERSCHÜTTETE Tasse ("miss") rutscht NICHT als serviert
##    raus — der alte Vergleich mit "spill" war immer wahr (pour_result kennt
##    nur perfect/good/miss).
## 2) veggieChop/basketBounce: HUD skaliert per _ui-Faktor (M9) — vorher
##    standen die Labels auf festen 16/10/48-px-Offsets (Krümelschrift auf
##    grossen Landscape-Viewports).
## 3) gardenRush: _layout_hud skaliert mit dem Viewport-Rect (_ui).
## 4) ranchHerde: die Schaf-Optik spiegelt die Sim JEDEN Frame — vorher sass
##    die Schleife hinter dem visible-Gate der Zielfahne (Schafe froren ein,
##    solange keine Fahne stand).

const TEA_SCENE := "res://scripts/minigames/games/tea_party/tea_party.tscn"
const CHOP_SCENE := "res://scripts/minigames/games/veggie_chop/veggie_chop.tscn"
const RUSH_SCENE := "res://scripts/minigames/games/garden_rush/garden_rush.tscn"
const BASKET_SCENE := "res://scripts/minigames/games/basket_bounce/basket_bounce.tscn"
const HERDE_SCENE := "res://scripts/minigames/games/ranch_herde/herde_game.tscn"


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


func test_tea_spill_serviert_keine_ghost_tasse() -> void:
	var game := _mount(TEA_SCENE, "teaParty")
	game.set("_intro_left", 0.0)
	game.set("serving", false)
	game.set("cup_slide", 0.0)
	var stage: Node3D = game.get("_stage")
	assert_true(float(stage.get("_ghost_age")) > 90.0, "Ghost-Tasse startet inaktiv")
	# Weit unterm Band loslassen → miss/Spill: KEINE servierte Ghost-Tasse.
	game.set("level", 0.05)
	game.call("_release")
	assert_eq(int(game.get("spills")), 1, "Spill gezählt (Sim unangetastet)")
	assert_true(
		float(stage.get("_ghost_age")) > 90.0,
		"Spill serviert KEINE Ghost-Tasse (alter !=-spill-Vergleich war immer wahr)"
	)
	# In der Bandmitte loslassen → perfect: die Tasse rutscht sichtbar raus.
	game.set("serving", false)
	game.set("cup_slide", 0.0)
	var band: Dictionary = game.get("band")
	game.set("level", float(band["center"]))
	game.call("_release")
	assert_true(float(stage.get("_ghost_age")) < 0.01, "Perfect serviert die Ghost-Tasse")
	game.free()


func test_veggie_chop_hud_skaliert_mit_ui_faktor() -> void:
	var game := _mount(CHOP_SCENE, "veggieChop")
	game.call("apply_view", Vector2(390.0, 844.0))
	assert_almost(float(game.get("_ui")), 1.0, 1e-6, "Phone-Kurzkante = Faktor 1")
	var time_label := game.get("_time_label") as Label
	var hint_phone := (game.get("_hint_label") as Label).size.x
	assert_eq(time_label.get_theme_font_size("font_size"), 34, "Phone: Headline bleibt 34")
	game.call("apply_view", Vector2(1194.0, 834.0))
	assert_almost(float(game.get("_ui")), 834.0 / 390.0, 1e-4, "iPad quer: Kurzkante/390")
	assert_eq(
		time_label.get_theme_font_size("font_size"),
		int(34.0 * 834.0 / 390.0),
		"Zeit-Label wächst mit (keine Krümelschrift mehr)"
	)
	assert_true(
		(game.get("_hint_label") as Label).size.x > hint_phone,
		"Hinweis wächst mit (kein 360-px-Nagel)"
	)
	game.call("apply_view", Vector2(9999.0, 9999.0))
	assert_almost(float(game.get("_ui")), 3.0, 1e-6, "Deckel bei 3,0")
	game.call("apply_view", Vector2(200.0, 400.0))
	assert_almost(float(game.get("_ui")), 0.75, 1e-6, "Boden bei 0,75")
	game.free()


func test_garden_rush_hud_skaliert_mit_ui_faktor() -> void:
	var game := _mount(RUSH_SCENE, "gardenRush")
	game.call("_layout_hud")
	var vp: Vector2 = game.get_viewport_rect().size
	var want_ui := clampf(minf(vp.x, vp.y) / 390.0, 0.75, 3.0)
	assert_almost(float(game.get("_ui")), want_ui, 1e-4, "_ui = Viewport-Kurzkante/390")
	var time_label := game.get("_time_label") as Label
	assert_eq(
		time_label.get_theme_font_size("font_size"),
		int(34.0 * want_ui),
		"Zeit-Label trägt die skalierte Headline"
	)
	var withered := game.get("_withered_label") as Label
	assert_almost(withered.position.x, 16.0 * want_ui, 0.01, "Offsets skalieren (kein 16-px-Nagel)")
	assert_almost(withered.position.y, 48.0 * want_ui, 0.01, "Offsets skalieren (kein 48-px-Nagel)")
	var hint := game.get("_hint_label") as Label
	var hint_w := minf(vp.x - 32.0 * want_ui, 380.0 * want_ui)
	assert_almost(hint.position.x, (vp.x - hint_w) * 0.5, 0.01, "Hinweis bleibt mittig zentriert")
	game.free()


func test_basket_bounce_hud_skaliert_mit_ui_faktor() -> void:
	var game := _mount(BASKET_SCENE, "basketBounce")
	game.call("apply_view", Vector2(390.0, 844.0))
	assert_almost(float(game.get("_ui")), 1.0, 1e-6, "Phone-Kurzkante = Faktor 1")
	var time_label := game.get("_time_label") as Label
	assert_eq(time_label.get_theme_font_size("font_size"), 34, "Phone: Headline bleibt 34")
	game.call("apply_view", Vector2(1194.0, 834.0))
	assert_almost(float(game.get("_ui")), 834.0 / 390.0, 1e-4, "iPad quer: Kurzkante/390")
	assert_eq(
		time_label.get_theme_font_size("font_size"),
		int(34.0 * 834.0 / 390.0),
		"Zeit-Label wächst mit (keine Krümelschrift mehr)"
	)
	var hint := game.get("_hint_label") as Label
	var ui := 834.0 / 390.0
	var hint_w := minf(1194.0 - 32.0 * ui, 300.0 * ui)
	assert_almost(hint.position.x, (1194.0 - hint_w) * 0.5, 0.01, "Hinweis bleibt mittig zentriert")
	game.free()


func test_herde_schafe_folgen_der_sim_ohne_fahne() -> void:
	var game := _mount(HERDE_SCENE, "ranchHerde")
	game.call("_on_level_chosen", 1)
	assert_true(bool(game.get("level_running")), "Level 1 läuft")
	var fahne := game.get("_ziel_fahne") as Node3D
	assert_false(fahne.visible, "Zielfahne startet unsichtbar (vor dem ersten Tipp)")
	# Sim-Zustand direkt verschieben und NUR die Optik ticken: die Knoten
	# müssen folgen, obwohl KEINE Fahne steht (alter Bug: Schleife sass
	# hinter dem visible-Gate in _tick_ziel_fahne → Schafe froren ein).
	var schafe: Array = game.get("schafe")
	var erstes: Dictionary = schafe[0]
	erstes["x"] = 3.25
	erstes["z"] = -1.5
	erstes["vx"] = 0.0
	erstes["vz"] = 0.0
	game.call("_step_optik", 0.016)
	var nodes: Array = game.get("_schaf_nodes")
	var node := nodes[0] as Node3D
	assert_almost(node.position.x, 3.25, 1e-4, "Schaf-Optik folgt der Sim (x)")
	assert_almost(node.position.z, -1.5, 1e-4, "Schaf-Optik folgt der Sim (z)")
	# HUD skaliert ebenfalls per _ui (M9) — vorher feste 16/10/48-px-Offsets.
	game.call("apply_view", Vector2(1194.0, 834.0))
	assert_almost(float(game.get("_ui")), 834.0 / 390.0, 1e-4, "iPad quer: Kurzkante/390")
	assert_eq(
		(game.get("_zeit_label") as Label).get_theme_font_size("font_size"),
		int(34.0 * 834.0 / 390.0),
		"Zeit-Label wächst mit"
	)
	game.free()
