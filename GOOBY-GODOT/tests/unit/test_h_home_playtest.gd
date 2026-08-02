extends TestCase
## H-HOME-Playtest — Regressionstests für die drei Pflege-Funde:
##
## 1. Zähneputz-Pflicht (Doc F §3.2) wird jetzt WIRKLICH gesetzt: der
##    GoobyTicker markiert sie bei jedem wokeUp (Live-Tick UND Offline-
##    Catchup), das Bett-Panel beim sanften Wecken (wokeEarly). Vorher
##    wurde BadState.mark_woke_up in Produktion nirgends gerufen —
##    Warte-Pose + teeth_brushed-Pfad waren tot.
## 2. Schlaf-Gate der Pflege-Interactables (Web blockedBySleep): Taps auf
##    Kühlschrank/Klo/Zahnputz/TV wecken den Schläfer nicht mehr; der
##    Auto-Klo-Gang und die Zahnputz-Warte-Pose pausieren im Schlaf und
##    im Baumodus (vorher: Gooby wurde aus dem Bett gezerrt, der
##    PflegeRunner snappte ihn alle 2 s zurück — sichtbarer Jank).
## 3. NougatLogic.can_glob liest `sleeping` strict-bool wie Sleep.is_sleeping
##    (vorher nackter `== true`: Junk-Saves mit {"sleeping": 1} zählten NUR
##    hier als schlafend, {"sleeping": "ja"} war ein Laufzeitfehler-Risiko).

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SleepLogic := preload("res://scripts/logic/sleep.gd")

const NOW_MS := 1768478400000
const MIN_MS := 60000

var _seq := 0


## Minimaler Raum-Stub (Muster test_w13_auge.FakeRoom): GameState-Override,
## say()-Sammler und schaltbarer Baumodus — genug für Host + Interactables.
class FakeRoom:
	extends Node3D

	var gs: Object = null
	var build_active := false
	var lines: Array[String] = []

	func game_state() -> Object:
		return gs

	func say(text: String) -> void:
		lines.append(text)

	func is_build_mode_active() -> bool:
		return build_active


## Möbel-Stub mit item_def (KloDusche liest die id) + top_y für die Tap-Zone.
class FakeFurniture:
	extends Node3D

	var item_def := {"id": ""}

	func top_y() -> float:
		return 1.0


func _fresh_gs() -> Node:
	BadState.register_slice()
	_seq += 1
	var dir := "user://hhome_tests/pflege_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(dir + "/save_v5.json")
	return gs


func _make_room(gs: Node) -> FakeRoom:
	var room := FakeRoom.new()
	room.gs = gs
	tree.root.add_child(room)
	return room


func _dock(room: FakeRoom, interactable: Node3D, item_id: String) -> Node3D:
	var host := InteractablesHost.attach_to(room)
	var furniture := FakeFurniture.new()
	furniture.item_def = {"id": item_id}
	room.add_child(furniture)
	host.add_child(interactable)
	interactable.setup(host, furniture)
	return interactable


func _schlafen_legen(gs: Node, dauer_min := 30) -> void:
	var now := int(gs.clock.now_ms())
	gs.set_value(
		"gooby.sleep", {"sleeping": true, "startedAt": now, "wakeAt": now + dauer_min * MIN_MS}
	)


func _aufwecken(gs: Node) -> void:
	gs.set_value("gooby.sleep", {"sleeping": false, "startedAt": 0, "wakeAt": 0})


func _cleanup(room: Node, gs: Node) -> void:
	room.queue_free()
	await wait_frames(2)
	gs.free()


# ── Fund 1: Zähneputz-Pflicht nach dem Aufwachen ─────────────────────────────


func test_ticker_live_wokeup_setzt_zahnputz_pflicht() -> void:
	var gs := _fresh_gs()
	assert_false(bool(gs.get_value("bad.needsBrushing", false)), "frisch: keine Pflicht")
	gs.set_value("gooby.stats.energy", 50.0)
	_schlafen_legen(gs, 10)
	gs.set_value("gooby.lastTickAt", NOW_MS)
	gs.clock.advance(11 * MIN_MS)
	gs.run_live_tick()
	assert_false(bool(gs.get_value("gooby.sleep.sleeping")), "Schlaf zu Ende")
	assert_eq(int(gs.get_value("achievements.counters.sleeps")), 1, "Grant gebucht")
	assert_true(bool(gs.get_value("bad.needsBrushing", false)), "wokeUp → Zähneputzen ist Pflicht")
	gs.free()


func test_ticker_catch_up_setzt_zahnputz_pflicht() -> void:
	var gs := _fresh_gs()
	gs.set_value("gooby.stats.energy", 50.0)
	_schlafen_legen(gs, 10)
	gs.set_value("gooby.lastTickAt", NOW_MS)
	gs.clock.advance(60 * MIN_MS)
	gs.run_catch_up()
	assert_false(bool(gs.get_value("gooby.sleep.sleeping")), "Offline-Schlaf zu Ende")
	assert_true(
		bool(gs.get_value("bad.needsBrushing", false)),
		"Offline-Catchup-wokeUp → Zähneputzen ist Pflicht"
	)
	gs.free()


func test_bett_sanft_wecken_setzt_zahnputz_pflicht() -> void:
	var gs := _fresh_gs()
	var room := _make_room(gs)
	var bett: Bett = _dock(room, Bett.new(), "bedSingle")
	_schlafen_legen(gs)
	bett._on_wake_chosen()
	assert_false(bool(gs.get_value("gooby.sleep.sleeping")), "sanft geweckt = wach")
	assert_eq(
		int(gs.get_value("gooby.grumpyUntil", 0)),
		NOW_MS + SleepLogic.EARLY_WAKE_DEBUFF_MIN * MIN_MS,
		"Grumpy-Debuff läuft"
	)
	assert_true(
		bool(gs.get_value("bad.needsBrushing", false)), "wokeEarly → Zähneputzen ist auch Pflicht"
	)
	assert_true(room.lines.has(I18nService.t("sleep.frueh_geweckt")), "Früh-geweckt-Zeile gesagt")
	await _cleanup(room, gs)


# ── Fund 2: Schlaf-Gate der Pflege-Interactables ─────────────────────────────


func test_pflege_taps_blockiert_im_schlaf() -> void:
	var gs := _fresh_gs()
	var room := _make_room(gs)
	var host := InteractablesHost.attach_to(room)
	var kuehlschrank: Kuehlschrank = _dock(room, Kuehlschrank.new(), "kitchenFridge")
	var klo: KloDusche = _dock(room, KloDusche.new(), "toilet")
	var zahnputz: Zahnputz = _dock(room, Zahnputz.new(), "bathroomSink")
	var tv: Fernseher = _dock(room, Fernseher.new(), "televisionModern")
	_schlafen_legen(gs)
	assert_true(host.gooby_sleeping(), "Gate erkennt den Schläfer")
	kuehlschrank._on_tapped()
	klo._on_tapped()
	zahnputz._on_tapped()
	tv._on_tapped()
	assert_false(kuehlschrank.is_busy(), "Kühlschrank startet keine Fütter-Sequenz")
	assert_true(kuehlschrank._panel == null, "kein Fütter-Panel im Schlaf")
	assert_false(klo.is_routine_active(), "kein Klo-Gang im Schlaf")
	assert_false(zahnputz.is_busy(), "kein Rubbel-Spiel im Schlaf")
	assert_false(tv.is_on(), "TV bleibt aus im Schlaf")
	var schlaf_zeile := I18nService.t("home.suche.schlaeft")
	assert_eq(room.lines.count(schlaf_zeile), 4, "jede Abweisung sagt die Schlaf-Zeile")
	_aufwecken(gs)
	assert_false(host.gooby_sleeping(), "wach = Gate offen")
	await _cleanup(room, gs)


func test_auto_klo_pausiert_im_schlaf_und_baumodus() -> void:
	var gs := _fresh_gs()
	var room := _make_room(gs)
	var klo: KloDusche = _dock(room, KloDusche.new(), "toilet")
	# setup hat den Klo-Timer auf NOW gestellt — 5 h später ist er fällig.
	gs.clock.advance(5 * 60 * MIN_MS)
	assert_true(BadState.klo_due(int(gs.get_value("bad.kloLastMs", 0)), int(gs.clock.now_ms())))
	_schlafen_legen(gs)
	klo._process(KloDusche.KLO_CHECK_S + 0.1)
	assert_false(klo.is_routine_active(), "schlafend: Auto-Klo pausiert")
	_aufwecken(gs)
	room.build_active = true
	klo._process(KloDusche.KLO_CHECK_S + 0.1)
	assert_false(klo.is_routine_active(), "Baumodus: Auto-Klo pausiert")
	room.build_active = false
	klo._process(KloDusche.KLO_CHECK_S + 0.1)
	assert_true(klo.is_routine_active(), "wach + kein Baumodus: Klo-Gang läuft an")
	assert_true(
		await wait_until(func() -> bool: return not klo.is_routine_active(), 8000),
		"Klo-Gang läuft durch"
	)
	assert_eq(int(gs.get_value("bad.kloLastMs", 0)), int(gs.clock.now_ms()), "Timer neu gestartet")
	await _cleanup(room, gs)


func test_zahnputz_warte_pose_pausiert_im_schlaf_und_baumodus() -> void:
	var gs := _fresh_gs()
	var room := _make_room(gs)
	var zahnputz: Zahnputz = _dock(room, Zahnputz.new(), "bathroomSink")
	BadState.mark_woke_up(gs)
	_schlafen_legen(gs)
	zahnputz._process(0.016)
	assert_false(zahnputz._waiting_pose_done, "schlafend: keine Warte-Pose")
	_aufwecken(gs)
	room.build_active = true
	zahnputz._process(0.016)
	assert_false(zahnputz._waiting_pose_done, "Baumodus: keine Warte-Pose")
	room.build_active = false
	zahnputz._process(0.016)
	assert_true(zahnputz._waiting_pose_done, "wach: Warte-Pose greift (Pflicht blieb bestehen)")
	await _cleanup(room, gs)


# ── Fund 3: NougatLogic strict-bool ──────────────────────────────────────────


func test_nougat_can_glob_strict_bool_pure() -> void:
	var echt := {"gooby": {"sleep": {"sleeping": true}}}
	var verdict := NougatLogic.can_glob(echt, NOW_MS)
	assert_false(bool(verdict.get("ok", true)), "echtes true = schlafend")
	assert_eq(str(verdict.get("reason", "")), "sleeping")
	# Junk-Saves: {"sleeping": 1} zählt ÜBERALL sonst (Sleep.is_sleeping,
	# PflegeRunner, HUD) als wach — die Schleuse muss dieselbe Sicht haben.
	var junk_int := {"gooby": {"sleep": {"sleeping": 1}}}
	assert_false(SleepLogic.is_sleeping(junk_int["gooby"]), "Referenz: Sleep sagt wach")
	assert_true(bool(NougatLogic.can_glob(junk_int, NOW_MS).get("ok", false)), "konsistent wach")
	# {"sleeping": "ja"} darf nie crashen (String == bool wäre ein Godot-4-
	# Laufzeitfehler-Muster) und zählt ebenfalls als wach.
	var junk_str := {"gooby": {"sleep": {"sleeping": "ja"}}}
	assert_true(bool(NougatLogic.can_glob(junk_str, NOW_MS).get("ok", false)), "Junk-String wach")
