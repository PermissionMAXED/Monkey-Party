extends TestCase
## H-PLAYTEST Onboarding/Progression — Wächter (docs/godot-rewrite/playtest/
## H-onboarding-progression.md):
## 1) Die Tour-Karte friert nie mehr in Riesengröße ein: Autowrap-Minima
##    settlen WANN sie wollen — die Karte zieht ihre Größe bei JEDER
##    Minimum-Änderung nach und relayoutet beim Wiederauftauchen (vorher
##    stand die erste Ankunfts-Karte bildschirmfüllend bis zum nächsten
##    Schritt).
## 2) Toasts weichen der Tour-Karte aus (Gruppe wasnun_karte) — vorher lag
##    „Neuer Sticker“ mitten auf Titel und ×-Knopf.
## 3) Der HUD-Coachmark „Deine Knöpfe“ hält den Mund, solange die Tour
##    läuft, und kommt erst dran, wenn sie den Baum verlassen hat.

const GameStateScript := preload("res://scripts/state/game_state.gd")
const HUD_SCENE := preload("res://scripts/ui/hud.tscn")

const NOW_MS := 1785448800000  # 2026-07-30 UTC

var _seq := 0


func _fresh_gs() -> Node:
	_seq += 1
	var dir := "user://h_onb_tests/guide_%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var gs: Node = GameStateScript.new()
	gs.clock.pin(NOW_MS)
	gs.clock.set_utc_offset_minutes(0)
	gs.initialize(dir + "/save_v5.json")
	tree.root.add_child(gs)
	gs.apply_onboarding_profile({"player_name": "Tester", "gooby_nickname": "Flauschi"})
	return gs


func _attach_guide(gs: Node) -> Array:
	var host := Node.new()
	tree.root.add_child(host)
	var guide := OnboardingGuide.attach_to(host, gs)
	return [host, guide]


func _teardown(host: Node, gs: Node) -> void:
	tree.root.remove_child(host)
	host.free()
	gs.get_parent().remove_child(gs)
	gs.free()


## ------------------------------------------------ Karte: Größe settlet


func test_karte_settlet_auf_echte_groesse() -> void:
	var gs := _fresh_gs()
	var pair := _attach_guide(gs)
	var guide: OnboardingGuide = pair[1]
	assert_ne(guide, null, "frischer Save startet die Tour")
	await wait_frames(4)
	var card: PanelContainer = guide._card
	var canvas := Vector2(card.get_viewport().get_visible_rect().size)
	assert_true(
		card.size.y <= canvas.y,
		"Karte bleibt im Bild (war: bildschirmfüllend, %s > %s)" % [card.size.y, canvas.y]
	)
	assert_almost(
		card.size.y,
		card.get_combined_minimum_size().y,
		1.5,
		"Karten-Höhe folgt dem gesettelten Autowrap-Minimum"
	)
	_teardown(pair[0], gs)


func test_karte_zieht_groesse_beim_wiederauftauchen_nach() -> void:
	var gs := _fresh_gs()
	var pair := _attach_guide(gs)
	var guide: OnboardingGuide = pair[1]
	await wait_frames(4)
	var card: PanelContainer = guide._card
	# Travel versteckt die Karte; währenddessen friert (simuliert) eine
	# Riesen-Höhe ein — genau der Playtest-Befund der ersten Ankunfts-Karte.
	# (Sichtbarkeit direkt togglen: _sync_card_visible hängt am SceneRouter-
	# Autoload, der im Test-Baum keinen RoomBase als aktuelle Szene trägt.)
	guide._on_travel_started()
	assert_false(card.visible, "Travel versteckt die Karte")
	card.size = Vector2(card.size.x, 2400.0)
	card.visible = true
	await wait_frames(4)
	assert_true(
		card.size.y < 2000.0,
		"Wiederauftauchen relayoutet: Riesen-Höhe ist weg (war %s)" % card.size.y
	)
	assert_almost(
		card.size.y, card.get_combined_minimum_size().y, 1.5, "Höhe = gesetteltes Minimum"
	)
	_teardown(pair[0], gs)


func test_karte_folgt_minimum_aenderungen() -> void:
	var gs := _fresh_gs()
	var pair := _attach_guide(gs)
	var guide: OnboardingGuide = pair[1]
	await wait_frames(4)
	var card: PanelContainer = guide._card
	var text_label: Label = card.find_child("GuideText", true, false)
	var kurz := text_label.text
	var ruhe_hoehe := card.size.y
	var langtext := "Ganz viel Erklärtext. "
	for _i in 6:
		langtext += langtext
	text_label.text = langtext
	await wait_frames(3)
	assert_true(
		card.size.y > ruhe_hoehe + 10.0,
		"mehr Text → Karte wächst mit (deferred minimum_size_changed-Hook)"
	)
	text_label.text = kurz
	await wait_frames(3)
	assert_almost(
		card.size.y,
		ruhe_hoehe,
		1.5,
		"wieder kurzer Text → Karte schrumpft zurück (kein Einfrieren nach oben)"
	)
	_teardown(pair[0], gs)


func test_karte_ist_in_der_toast_ausweich_gruppe() -> void:
	var gs := _fresh_gs()
	var pair := _attach_guide(gs)
	var guide: OnboardingGuide = pair[1]
	await wait_frames(2)
	assert_true(
		guide._card.is_in_group(WhatsNextHint.CARD_GROUP),
		"Toasts weichen der Tour-Karte aus wie der Was-nun-Karte (toast.gd)"
	)
	_teardown(pair[0], gs)


## ------------------------------------------- Coachmark schweigt zur Tour


func test_coachmark_wartet_bis_die_tour_vorbei_ist() -> void:
	# Der Test-Runner (SceneTree-Skript) lädt die ECHTEN Autoloads —
	# hints.hud_actions_seen im echten AppSettings sichern und zurücksetzen.
	var settings := tree.root.get_node("/root/AppSettings")
	var vorher: Variant = settings.get_setting(Hud.COACHMARK_SEEN_KEY, false)
	settings.set_setting(Hud.COACHMARK_SEEN_KEY, false)
	var fake_guide := Node.new()
	fake_guide.add_to_group(OnboardingGuide.GROUP)
	tree.root.add_child(fake_guide)
	var hud: Hud = HUD_SCENE.instantiate()
	tree.root.add_child(hud)
	await wait_frames(2)
	assert_eq(
		hud.find_child("HudCoachmark", true, false),
		null,
		"solange die Tour läuft, gibt es KEINEN Deine-Knöpfe-Coachmark"
	)
	# Tour endet (Node verlässt den Baum) → der Coachmark kommt einmalig dran.
	tree.root.remove_child(fake_guide)
	fake_guide.free()
	await wait_frames(3)
	assert_ne(
		hud.find_child("HudCoachmark", true, false),
		null,
		"nach dem Tour-Ende erscheint der Coachmark (nichts geht verloren)"
	)
	hud._on_coachmark_dismissed()
	assert_true(
		bool(settings.get_setting(Hud.COACHMARK_SEEN_KEY, false)),
		"Wegtippen merkt sich hints.hud_actions_seen"
	)
	tree.root.remove_child(hud)
	hud.free()
	settings.set_setting(Hud.COACHMARK_SEEN_KEY, vorher)


func test_coachmark_zieht_sich_zurueck_wenn_die_tour_spaeter_aufwacht() -> void:
	# Echte Boot-Reihenfolge (home_entry._start_home): HUD wird sichtbar →
	# Coachmark steht → DANN attach_to der Tour. Der Coachmark muss sich
	# zurückziehen (ohne gesehen-Flag) und nach der Tour wiederkommen.
	var settings := tree.root.get_node("/root/AppSettings")
	var vorher: Variant = settings.get_setting(Hud.COACHMARK_SEEN_KEY, false)
	settings.set_setting(Hud.COACHMARK_SEEN_KEY, false)
	var hud: Hud = HUD_SCENE.instantiate()
	tree.root.add_child(hud)
	await wait_frames(2)
	assert_ne(
		hud.find_child("HudCoachmark", true, false), null, "ohne Tour steht der Coachmark sofort"
	)
	var gs := _fresh_gs()
	var pair := _attach_guide(gs)
	assert_ne(pair[1], null, "frischer Save startet die Tour")
	await wait_frames(3)
	assert_eq(
		hud.find_child("HudCoachmark", true, false),
		null,
		"Tour wacht auf → Coachmark zieht sich zurück (retract_coachmark)"
	)
	assert_false(
		bool(settings.get_setting(Hud.COACHMARK_SEEN_KEY, false)),
		"Rückzug setzt das gesehen-Flag NICHT (er kommt ja noch)"
	)
	# Tour verlässt den Baum → Coachmark kommt einmalig dran.
	_teardown(pair[0], gs)
	await wait_frames(3)
	assert_ne(
		hud.find_child("HudCoachmark", true, false),
		null,
		"nach der Tour erscheint der Coachmark wieder"
	)
	tree.root.remove_child(hud)
	hud.free()
	settings.set_setting(Hud.COACHMARK_SEEN_KEY, vorher)


func test_coachmark_respektiert_gesehen_flag() -> void:
	var settings := tree.root.get_node("/root/AppSettings")
	var vorher: Variant = settings.get_setting(Hud.COACHMARK_SEEN_KEY, false)
	settings.set_setting(Hud.COACHMARK_SEEN_KEY, true)
	var hud: Hud = HUD_SCENE.instantiate()
	tree.root.add_child(hud)
	await wait_frames(2)
	assert_eq(
		hud.find_child("HudCoachmark", true, false), null, "gesehen-Flag → nie wieder Coachmark"
	)
	tree.root.remove_child(hud)
	hud.free()
	settings.set_setting(Hud.COACHMARK_SEEN_KEY, vorher)
