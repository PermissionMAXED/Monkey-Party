extends SceneTree
## H-Playtest Batch 2+3 (KEIN Test): mountet jedes Minigame der Rest-Liste
## wie der Host (setup → start), spielt es kurz headless an (Taps, Tasten,
## Pause/Resume, beide Orientierungen am Leitformat) und lässt es wieder
## frei. Jede Godot-Fehlerausgabe im Log ist ein Fund:
##   tools/ci/run_godot_isolated.sh godot --headless --path GOOBY-GODOT \
##     --script res://tests/tools/h2_mg_probe.gd 2>&1 | tee /tmp/h2_probe.log

const BATCH1: Array[String] = [
	"tea_party",
	"veggie_chop",
	"garden_rush",
	"basket_bounce",
	"ranch_herde",
	"ranch_tonnen",
	"ranch_zeit"
]
const GAMES_DIR := "res://scripts/minigames/games"
## Landscape-Leitformat (iPhone 17 Pro Max) + Hochkant-Gegenprobe.
const SIZE_LAND := Vector2(2868.0, 1320.0)
const SIZE_PORT := Vector2(1320.0, 2868.0)
const FRAMES := 200


func _initialize() -> void:
	_run()


func _run() -> void:
	await process_frame
	var eintraege := _lade_spiele()
	print("[H2] %d Spiele in der Probe" % eintraege.size())
	for eintrag: Dictionary in eintraege:
		await _probe(eintrag, "normal")
	for eintrag: Dictionary in eintraege:
		if bool(eintrag["endless"]):
			await _probe(eintrag, "endless")
	print("[H2] fertig")
	quit(0)


func _lade_spiele() -> Array[Dictionary]:
	var liste: Array[Dictionary] = []
	var dir := DirAccess.open(GAMES_DIR)
	var dirs := dir.get_directories()
	dirs.sort()
	for d: String in dirs:
		if d.begins_with("_") or BATCH1.has(d):
			continue
		var json_path := "%s/%s/game.json" % [GAMES_DIR, d]
		if not FileAccess.file_exists(json_path):
			continue
		var def: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(json_path))
		(
			liste
			. append(
				{
					"dir": d,
					"id": str(def.get("id", d)),
					"scene": str(def.get("scene", "")),
					"orientation": str(def.get("orientation", "portrait")),
					"endless": bool(def.get("supports_endless", false)),
				}
			)
		)
	# Inline-registrierte Spiele (minigame_registry.gd) ohne game.json.
	for def: Dictionary in MinigameRegistry.all_games():
		var id := str(def.get("id", ""))
		if id in ["carrotCatch", "gvz", "gobnom"]:
			(
				liste
				. append(
					{
						"dir": id,
						"id": id,
						"scene": str(def.get("scene", "")),
						"orientation": str(def.get("orientation", "portrait")),
						"endless": bool(def.get("supports_endless", false)),
					}
				)
			)
	return liste


func _probe(eintrag: Dictionary, difficulty: String) -> void:
	var id := str(eintrag["id"])
	print("[H2] === %s (%s) ===" % [id, difficulty])
	var scene := load(str(eintrag["scene"])) as PackedScene
	if scene == null:
		print("[H2] FUND %s: Szene lädt nicht (%s)" % [id, eintrag["scene"]])
		return
	var ctx := MinigameCtx.new()
	ctx.game_id = id
	ctx.difficulty = difficulty
	ctx.orientation = str(eintrag["orientation"])
	ctx.run_seed = 20260802
	var game := scene.instantiate() as MinigameBase
	if game == null:
		print("[H2] FUND %s: Wurzel ist kein MinigameBase" % id)
		return
	root.add_child(game)
	game.setup(ctx)
	var land := str(eintrag["orientation"]) == "landscape"
	_apply_view(game, SIZE_LAND if land else SIZE_PORT)
	game.start()
	var rng := GoobyRng.new(7)
	for frame in FRAMES:
		if frame == 40:
			game.pause()
		elif frame == 50:
			game.resume()
		elif frame == 100:
			_apply_view(game, SIZE_PORT if land else SIZE_LAND)
		elif frame == 110:
			_apply_view(game, SIZE_LAND if land else SIZE_PORT)
		if frame % 15 == 3:
			_tap(rng)
		if frame % 30 == 7:
			_taste(KEY_SPACE)
		await process_frame
	game.end()
	root.remove_child(game)
	game.free()
	await process_frame


func _apply_view(game: Node, size: Vector2) -> void:
	if game.has_method("apply_view"):
		game.call("apply_view", size)


func _tap(rng: GoobyRng) -> void:
	var pos := Vector2(rng.range_f(100.0, 1200.0), rng.range_f(100.0, 1200.0))
	var runter := InputEventScreenTouch.new()
	runter.index = 0
	runter.position = pos
	runter.pressed = true
	Input.parse_input_event(runter)
	var hoch := InputEventScreenTouch.new()
	hoch.index = 0
	hoch.position = pos
	hoch.pressed = false
	Input.parse_input_event(hoch)


func _taste(code: Key) -> void:
	var runter := InputEventKey.new()
	runter.physical_keycode = code
	runter.pressed = true
	Input.parse_input_event(runter)
	var hoch := InputEventKey.new()
	hoch.physical_keycode = code
	hoch.pressed = false
	Input.parse_input_event(hoch)
