extends TestCase
## FIX-4: MusicDirector — Kontext-Auflösung, Crossfade-Logik (Trackwechsel,
## Overlay-Stapel), Radio-Queue mit Level-Schranken. Headless: Dummy-Audio
## spielt still, die Logik ist identisch.

const DirectorScript := preload("res://scripts/audio/music_director.gd")


func _director() -> MusicDirector:
	var node: MusicDirector = DirectorScript.new()
	tree.root.add_child(node)
	return node


func test_resolve_track_kontexte_und_fallbacks() -> void:
	var director := _director()
	assert_eq(director.resolve_track(""), "", "Leerer Kontext = keine Musik.")
	assert_eq(director.resolve_track("home"), MusicRegistry.track_for("room:living"))
	assert_eq(
		director.resolve_track("game:unbekanntesSpiel"),
		MusicRegistry.track_for("arcade"),
		"Unbekannte game:-Kontexte klingen nach Arcade."
	)
	assert_eq(director.resolve_track("home", true), MusicRegistry.track_for("home"))
	director.queue_free()
	await wait_frames(1)


func test_kontextwechsel_crossfadet_auf_neuen_track() -> void:
	var director := _director()
	var changes: Array = []
	director.track_changed.connect(func(track_id: String) -> void: changes.append(track_id))
	director.set_context("home")
	assert_eq(director.current_track_id(), MusicRegistry.track_for("room:living"))
	director.set_context("city")
	assert_eq(director.current_track_id(), MusicRegistry.track_for("location:city"))
	director.set_context("city")
	assert_eq(changes.size(), 2, "Gleicher Kontext = kein erneuter Crossfade.")
	director.queue_free()
	await wait_frames(1)


func test_overlay_stapel_push_pop() -> void:
	var director := _director()
	director.set_context("home")
	director.push_context("shop")
	assert_eq(director.active_context(), "shop")
	assert_eq(director.current_track_id(), MusicRegistry.track_for("location:shop"))
	director.pop_context("shop")
	assert_eq(director.active_context(), "home")
	assert_eq(director.current_track_id(), MusicRegistry.track_for("room:living"))
	director.queue_free()
	await wait_frames(1)


func test_play_track_und_stop() -> void:
	var director := _director()
	director.play_track("recap-abenteuer", 0.1, false)
	assert_eq(director.current_track_id(), "recap-abenteuer")
	director.stop_music(0.1)
	assert_eq(director.current_track_id(), "", "stop_music leert den Track.")
	director.queue_free()
	await wait_frames(1)


func test_radio_queue_respektiert_level() -> void:
	var level1: Array = MusicDirector.radio_queue_for("gooby-fm", 1)
	var level30: Array = MusicDirector.radio_queue_for("gooby-fm", 30)
	assert_true(level1.size() > 0, "Level 1 hat freie Radio-Tracks.")
	assert_true(level30.size() > level1.size(), "Höheres Level schaltet mehr frei.")
	for track_id: String in level1:
		assert_true(
			int(MusicRegistry.entry(track_id).get("unlock_level", 1)) <= 1,
			"Gesperrter Track in Level-1-Queue: %s" % track_id
		)


func test_duck_senkt_und_hebt_musikbett() -> void:
	## EVAL-1 S8: duck() senkt den MusicBed-Unterbus (Attack) und stellt
	## ihn nach Halten + Release wieder auf 0 dB — der Stinger-Player
	## (Bus "Music") bleibt unberührt.
	var director := _director()
	await wait_frames(1)
	assert_true(AudioServer.get_bus_index(MusicDirector.BED_BUS) >= 0, "MusicBed-Unterbus fehlt")
	director.duck(-8.0, 0.05)
	await tree.create_timer(0.2).timeout
	assert_true(
		director.bed_duck_db() < -4.0,
		"Duck greift nicht (Bett bei %.1f dB)" % director.bed_duck_db()
	)
	await tree.create_timer(0.9).timeout
	assert_true(
		absf(director.bed_duck_db()) < 0.5,
		"Duck kommt nicht zurück (Bett bei %.1f dB)" % director.bed_duck_db()
	)
	director.queue_free()
	await wait_frames(1)


func test_kontext_player_spielen_auf_dem_bett_bus() -> void:
	## Kontext-/Radio-Player laufen auf MusicBed (duckbar), der Stinger-
	## Player direkt auf Music (wird bei Feiern NICHT mitgeduckt).
	var director := _director()
	await wait_frames(1)
	var bed_count := 0
	var music_count := 0
	for child in director.get_children():
		if child is AudioStreamPlayer:
			if String((child as AudioStreamPlayer).bus) == MusicDirector.BED_BUS:
				bed_count += 1
			elif (child as AudioStreamPlayer).bus == &"Music":
				music_count += 1
	assert_eq(bed_count, 2, "Beide Kontext-Player gehören auf MusicBed")
	assert_eq(music_count, 1, "Der Stinger-Player bleibt auf Music")
	director.queue_free()
	await wait_frames(1)


func test_radio_ersetzt_kontext_und_stoppt_zurueck() -> void:
	var director := _director()
	director.set_context("home")
	director.radio_play("recap-fm")
	assert_true(director.is_radio_playing())
	assert_true(
		MusicRegistry.station_track_ids("recap-fm").has(director.current_track_id()),
		"Radio spielt einen Sender-Track."
	)
	director.set_context("city")
	assert_true(director.is_radio_playing(), "Kontextwechsel wirft das Radio nicht raus.")
	director.radio_stop()
	assert_false(director.is_radio_playing())
	assert_eq(
		director.current_track_id(),
		MusicRegistry.track_for("location:city"),
		"Nach radio_stop läuft der gemerkte Kontext."
	)
	director.queue_free()
	await wait_frames(1)
