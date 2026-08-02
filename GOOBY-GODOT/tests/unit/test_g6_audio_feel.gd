extends TestCase
## G6 Audio-Feel-Welle: Funkelpark-Foley (die Fahrgeschäfte waren stumm),
## Autoscooter-Stups-Trigger, Fahrt-Loop-Lebenszyklus und die neue
## Fanfaren-Duck-Verdrahtung (AUDIO-GRAMMATIK S8). Pegel-Kontrakt der
## neuen Dateien: tests/unit/test_ef2_audio_levels.gd (Fixture via
## python3 tools/audio/ef2_manifest.py).

const ParkTests := preload("res://tests/unit/test_rest4_park.gd")


func test_park_foley_ids_gemappt_und_dateien_da() -> void:
	assert_eq(SfxMap.PARK_REQUIRED_IDS.size(), 5, "5 Park-Foley-Ids (G6-Kontrakt).")
	for id: String in SfxMap.PARK_REQUIRED_IDS:
		assert_true(SfxMap.SOUNDS.has(id), "Park-Id fehlt in der Map: %s" % id)
		var pfad := SfxMap.path(id)
		assert_true(
			pfad.begins_with("res://assets/audio/sfx/foley/"),
			"Park-Foley gehört in foley/: %s (%s)" % [id, pfad]
		)
		assert_true(ResourceLoader.exists(pfad), "Sound-Datei fehlt: %s (%s)" % [id, pfad])


func test_ride_loops_zeigen_auf_gemappte_loop_ids() -> void:
	for ride_id: String in Funkelpark.RIDE_LOOPS:
		var loop_id := str(Funkelpark.RIDE_LOOPS[ride_id])
		assert_true(
			loop_id.ends_with("_loop"),
			"Fahrt-Loops enden auf _loop (Median-Ausnahme im Pegel-Test): %s" % loop_id
		)
		assert_true(SfxMap.SOUNDS.has(loop_id), "Fahrt-Loop-Id ungemappt: %s" % loop_id)


func test_scooter_stups_feuert_nur_auf_der_flanke() -> void:
	assert_true(Autoscooter.stups_jetzt(1.0, false, 0.0), "Eintritt unter die Schwelle stupst")
	assert_false(
		Autoscooter.stups_jetzt(1.0, true, 0.0), "im Nahbereich bleiben stupst NICHT erneut"
	)
	assert_false(Autoscooter.stups_jetzt(1.0, false, 0.5), "Cooldown blockt den Stups")
	assert_false(Autoscooter.stups_jetzt(2.5, false, 0.0), "weit weg ist kein Stups")
	assert_true(
		Autoscooter.BUMP_ABSTAND > 0.0 and Autoscooter.BUMP_COOLDOWN_S > 0.0,
		"Schwelle/Cooldown bleiben positiv"
	)


func test_coaster_fahrt_startet_und_stoppt_foley_loop() -> void:
	var gs := ParkTests.FakeGameState.new()
	gs.state["economy"]["coins"] = 200
	var park: Funkelpark = Funkelpark.new()
	park.game_state_override = gs
	park.stunde_override = 12.0
	tree.root.add_child(park)
	await wait_frames(2)
	var audio := AudioDirector.get_or_create(park)
	assert_true(park.fahre("coaster"), "Fahrt startet bei vollem Konto")
	assert_true(
		audio.is_loop_playing("park_coaster_loop"), "Fahrt-Foley-Loop läuft während der Fahrt"
	)
	var schritte := 0
	while park.coaster.faehrt and schritte < 6000:
		park.coaster.simuliere(1.0 / 30.0)
		schritte += 1
	assert_false(park.coaster.faehrt, "Runde endet")
	assert_false(
		audio.is_loop_playing("park_coaster_loop"), "Loop stoppt am Fahrt-Ende (weicher Fade)"
	)
	park.queue_free()
	await wait_frames(1)


func test_fanfare_duckt_musikbett() -> void:
	## AUDIO-GRAMMATIK S8: RanchAudio.fanfare() ruft try_duck VOR der
	## Fanfare — das Musikbett (MusicBed) senkt sich hörbar ab.
	var ranch := RanchAudio.new()
	tree.root.add_child(ranch)
	await wait_frames(1)
	var music := MusicDirector.get_or_create(ranch)
	ranch.fanfare(false)
	await tree.create_timer(0.2).timeout
	assert_true(
		music.bed_duck_db() < -4.0,
		"Fanfare duckt das Musikbett nicht (Bett bei %.1f dB)" % music.bed_duck_db()
	)
	# Aufräumen: Duck sofort neutralisieren statt 2 s Halten abzuwarten.
	music.duck(0.0, 0.0)
	await tree.create_timer(0.8).timeout
	assert_true(
		absf(music.bed_duck_db()) < 0.5,
		"Bett kommt nicht auf 0 dB zurück (%.1f dB)" % music.bed_duck_db()
	)
	ranch.queue_free()
	await wait_frames(1)
