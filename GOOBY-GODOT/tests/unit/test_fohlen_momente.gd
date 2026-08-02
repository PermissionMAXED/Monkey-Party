extends TestCase
## I-21 Fohlen-Momente (IDEAS-WELLE-I §3 Rang 1) — Wachen für den ersten
## vertikalen Schnitt: Herz-Moment startet die Trächtigkeit + plant die
## `fohlen_`-Notification, laufende Trächtigkeiten zeigen den Warte-
## Hinweis, die fällige Geburt committet das Fohlen ABBRUCH-SICHER in den
## Bestand und fährt die vier inszenierten Beats (Geburt → Aufstehen →
## erste Schritte → Taufe) deterministisch durch. Ohne Ranch-Kauf bleibt
## der Host stumm.

const GameStateScript := preload("res://scripts/state/game_state.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")

const NOW_MS := 1768478400000
const STUNDE_MS := 3_600_000
const TAG_MS := 86_400_000

var _dir_seq := 0


## Hof-Szenen-Attrappe (Duck-Typing-Vertrag des Momente-Hosts).
class StubSzene:
	extends Node3D

	var gs: Object = null
	var meldungen: Array = []

	func game_state() -> Object:
		return gs

	func zeige_meldung(text: String) -> void:
		meldungen.append(text)

	func event_anker() -> Vector3:
		return Vector3(10.0, 0.0, 20.0)


func _fresh_gs(gekauft := true) -> Node:
	RanchState.register_slice()
	NotifyStub.reset_for_tests()
	_dir_seq += 1
	var dir := "user://fohlen_tests/fm_%d_%d" % [Time.get_ticks_usec(), _dir_seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(dir + "/save_v5.json")
	gs.set_value("progression.level", 15)
	if gekauft:
		gs.set_value("ranch.gekauft", true)
	return gs


func _teardown_gs(gs: Node) -> void:
	gs.free()
	SaveSchema.unregister_slice(RanchState.SLICE_ID)
	RanchState.reset_for_tests()
	NotifyStub.reset_for_tests()


## Zuchtreifes Bestands-Pferd einsetzen (Level über XP, damit die
## Slice-Normalisierung den Level nicht zurückrechnet).
func _setze_pferd(gs: Object, id: String, name: String, level: int, bindung: float) -> void:
	var pferd := RanchPlaySlices.neues_pferd(name, "braun")
	pferd["xp"] = RanchHorseLevels.xp_summe_bis(level)
	pferd["level"] = level
	pferd["bindung"] = bindung
	pferd["werte"] = {"hunger": 92.0, "durst": 92.0, "sauberkeit": 92.0}
	gs.update(
		func(state: Dictionary) -> void:
			var ranch := RanchState.heile_slice(state)
			var tiere: Dictionary = RanchPlaySlices.normalize_tiere(ranch.get("tiere"))
			(tiere["pferde"] as Dictionary)[id] = pferd
			ranch["tiere"] = tiere
	)


func _mount_host(gs: Object, seed_wert := 7) -> Array:
	var szene := StubSzene.new()
	szene.gs = gs
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_wert
	var host := RanchFohlenMomente.new()
	host.name = "RanchFohlenMomente"
	host.game_state_override = gs
	host.now_ms_override = NOW_MS
	host.rng_override = rng
	host.choreo_auto = false
	szene.add_child(host)
	host.setup(szene)
	return [szene, host]


# ── (a) Zucht-Paar-Gates ─────────────────────────────────────────────────────


func test_zucht_paar_findet_reifes_paar_und_respektiert_gates() -> void:
	var gs := _fresh_gs()
	_setze_pferd(gs, "luna", "Luna", 8, 60.0)
	_setze_pferd(gs, "bruno", "Bruno", 8, 50.0)
	var paar := RanchFohlenMomente.zucht_paar(gs, NOW_MS)
	assert_eq(paar.size(), 2, "reifes Paar gefunden")
	assert_eq(str(paar[0]), "luna", "höchste Bindung wird Stute")
	assert_eq(str(paar[1]), "bruno")
	_teardown_gs(gs)
	gs = _fresh_gs()
	_setze_pferd(gs, "luna", "Luna", 8, 60.0)
	_setze_pferd(gs, "fohli", "Fohli", 7, 60.0)
	assert_true(
		RanchFohlenMomente.zucht_paar(gs, NOW_MS).is_empty(), "Level-Gate (8) blockt das Paar"
	)
	_teardown_gs(gs)


# ── (b) Herz-Moment startet Trächtigkeit + Notification ─────────────────────


func test_herz_moment_startet_traechtigkeit_und_notification() -> void:
	var gs := _fresh_gs()
	_setze_pferd(gs, "luna", "Luna", 8, 60.0)
	_setze_pferd(gs, "bruno", "Bruno", 8, 50.0)
	var mounted := _mount_host(gs)
	var szene: StubSzene = mounted[0]
	var host: RanchFohlenMomente = mounted[1]
	assert_eq(szene.meldungen.size(), 1, "Herz-Bubble kommt")
	assert_true(str(szene.meldungen[0]).contains("Luna"), "Bubble nennt die Stute")
	host.herz_bestaetigen()
	var zucht := RanchFohlenMomente.aktuelle_zucht(gs)
	var t: Dictionary = zucht["traechtigkeiten"]
	assert_true(t.has("luna"), "Trächtigkeit gestartet")
	assert_eq(int((t["luna"] as Dictionary).get("startAt", 0)), NOW_MS)
	var pending := NotifyStub.pending()
	assert_eq(pending.size(), 1, "genau eine Warte-Notification")
	var eintrag: Dictionary = pending[0]
	assert_eq(str(eintrag["id"]), "fohlen_luna", "fohlen_-Präfix (Kategorie notify_rules)")
	assert_eq(int(eintrag["at_ms"]), NOW_MS + 48 * STUNDE_MS, "fällig nach 48 h")
	assert_eq(szene.meldungen.size(), 2, "Bestätigungs-Bubble kommt")
	host.herz_bestaetigen()
	assert_eq(
		(RanchFohlenMomente.aktuelle_zucht(gs)["traechtigkeiten"] as Dictionary).size(),
		1,
		"Doppel-Tap startet keine zweite Trächtigkeit"
	)
	(mounted[0] as Node).free()
	_teardown_gs(gs)


# ── (c) Warte-Hinweis + Notification-Refresh ─────────────────────────────────


func test_laufende_traechtigkeit_zeigt_wartehinweis_und_plant_neu() -> void:
	var gs := _fresh_gs()
	_setze_pferd(gs, "luna", "Luna", 8, 60.0)
	_setze_pferd(gs, "bruno", "Bruno", 8, 50.0)
	assert_true(
		RanchFohlenMomente.traechtigkeit_beginnen(gs, "luna", "bruno", NOW_MS - STUNDE_MS, 42)
	)
	NotifyStub.reset_for_tests()
	var mounted := _mount_host(gs)
	var szene: StubSzene = mounted[0]
	assert_eq(szene.meldungen.size(), 1, "Warte-Bubble kommt")
	assert_true(str(szene.meldungen[0]).contains("Luna"))
	var pending := NotifyStub.pending()
	assert_eq(pending.size(), 1, "Hof-Besuch plant die Notification neu")
	assert_eq(int((pending[0] as Dictionary)["at_ms"]), NOW_MS - STUNDE_MS + 48 * STUNDE_MS)
	assert_eq(RanchFohlenMomente.naechste_geburt(gs, NOW_MS), "", "noch nichts fällig")
	var wartende := RanchFohlenMomente.wartende_stuten(gs, NOW_MS)
	assert_eq(wartende.size(), 1)
	assert_eq(str((wartende[0] as Dictionary)["id"]), "luna")
	(mounted[0] as Node).free()
	_teardown_gs(gs)


# ── (d) Geburt: Commit + vier inszenierte Beats ──────────────────────────────


func test_geburt_committet_fohlen_und_faehrt_die_beats() -> void:
	var gs := _fresh_gs()
	_setze_pferd(gs, "luna", "Luna", 8, 60.0)
	_setze_pferd(gs, "bruno", "Bruno", 8, 50.0)
	assert_true(
		RanchFohlenMomente.traechtigkeit_beginnen(gs, "luna", "bruno", NOW_MS - 48 * STUNDE_MS, 42)
	)
	assert_eq(RanchFohlenMomente.naechste_geburt(gs, NOW_MS), "luna", "Geburt fällig")
	var mounted := _mount_host(gs)
	var szene: StubSzene = mounted[0]
	var host: RanchFohlenMomente = mounted[1]
	var pferde := RanchState.pferde(gs)
	assert_eq(pferde.size(), 3, "Fohlen SOFORT im Bestand (Abbruch-sicher)")
	var fohlen_id := ""
	for pid: Variant in pferde:
		if str(pid).begins_with("fohlen_"):
			fohlen_id = str(pid)
	assert_ne(fohlen_id, "", "Fohlen-Id vergeben")
	var fohlen: Dictionary = pferde[fohlen_id]
	assert_eq(str(fohlen.get("alter", "")), "fohlen")
	assert_eq(int(fohlen.get("geborenAm", 0)), NOW_MS)
	assert_eq(str((fohlen.get("eltern") as Array)[0]), "luna", "Mutter im Stammbaum")
	var name := str(fohlen.get("name", ""))
	assert_true(RanchFohlenMomente.NAMEN.has(name), "Taufname aus dem Namens-Pool")
	var zucht := RanchFohlenMomente.aktuelle_zucht(gs)
	assert_true((zucht["traechtigkeiten"] as Dictionary).is_empty(), "Trächtigkeit beendet")
	assert_eq(int((zucht["ruhezeitBis"] as Dictionary)["luna"]), NOW_MS + 5 * TAG_MS)
	assert_true(NotifyStub.pending().is_empty(), "Notification eingelöst")
	assert_true(host.ist_aktiv())
	assert_eq(host.phase(), RanchFohlenMomente.PHASE_GEBURT)
	assert_eq(szene.meldungen.size(), 1, "Geburts-Bubble")
	var fertig: Array = []
	host.momente_fertig.connect(func(id: String) -> void: fertig.append(id))
	host.naechste_phase()
	assert_eq(host.phase(), RanchFohlenMomente.PHASE_AUFSTEHEN)
	host.naechste_phase()
	assert_eq(host.phase(), RanchFohlenMomente.PHASE_SCHRITTE)
	host.naechste_phase()
	assert_eq(host.phase(), RanchFohlenMomente.PHASE_FERTIG)
	assert_false(host.ist_aktiv(), "Choreo fertig")
	assert_eq(fertig, [fohlen_id], "momente_fertig meldet das Fohlen")
	assert_eq(szene.meldungen.size(), 5, "Geburt/Aufstehen/Schritte/Taufe/Fertig-Zeilen")
	assert_true(str(szene.meldungen[3]).contains(name), "Taufe nennt den Namen")
	host.naechste_phase()
	assert_eq(host.phase(), RanchFohlenMomente.PHASE_FERTIG, "kein Beat nach fertig")
	(mounted[0] as Node).free()
	_teardown_gs(gs)


# ── (e) Namens-Taufe deterministisch + kollisionsfrei ────────────────────────


func test_fohlen_name_deterministisch_und_kollisionsfrei() -> void:
	var a := RanchFohlenMomente.fohlen_name(7)
	assert_eq(a, RanchFohlenMomente.fohlen_name(7), "gleicher Seed = gleicher Name")
	assert_true(RanchFohlenMomente.NAMEN.has(a))
	var b := RanchFohlenMomente.fohlen_name(7, [a])
	assert_ne(b, a, "vergebener Name wird übersprungen")
	assert_true(RanchFohlenMomente.NAMEN.has(b))


# ── (f) Ohne Kauf bleibt der Host stumm ──────────────────────────────────────


func test_ohne_ranch_kauf_bleibt_der_host_stumm() -> void:
	var gs := _fresh_gs(false)
	_setze_pferd(gs, "luna", "Luna", 8, 60.0)
	_setze_pferd(gs, "bruno", "Bruno", 8, 50.0)
	var mounted := _mount_host(gs)
	var szene: StubSzene = mounted[0]
	var host: RanchFohlenMomente = mounted[1]
	assert_true(szene.meldungen.is_empty(), "keine Bubble ohne Kauf")
	assert_true(NotifyStub.pending().is_empty(), "keine Notification ohne Kauf")
	assert_eq(host.phase(), RanchFohlenMomente.PHASE_KEINE)
	(mounted[0] as Node).free()
	_teardown_gs(gs)
