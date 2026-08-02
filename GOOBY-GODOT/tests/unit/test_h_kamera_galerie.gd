extends TestCase
## H-PLAYTEST Telefon/Radio-Rest — Wächter (docs/godot-rewrite/playtest/
## H-phone-radio.md):
## 1) FotoModus.merke_foto: die PNG einer über den MAX_FOTOS-Deckel
##    verdrängten Aufnahme wird MIT-gelöscht — vorher blieb sie für immer
##    unter user://fotos/ liegen (stiller Speicherfresser; nur das
##    Galerie-Löschen räumte Dateien).
## 2) Kappungs-Wächter: das Passfoto (profile.passPhoto) und Dateien, die
##    sich mehrere Index-Einträge teilen (foto_pfad ist sekundengenau),
##    überleben die Kappung.
## 3) GalerieScreen-Löschen: hängt der Reisepass an der gelöschten Aufnahme,
##    wird profile.passPhoto mit geleert (kein toter Pfad im Save).

const SaveSchema := preload("res://scripts/state/save_schema.gd")

const TEST_DIR := "user://test_h_kamera_galerie"


## GameState-Double: dotted get/set + update(mutator) wie /root/GameState.
class FakeGameState:
	extends RefCounted
	var s: Dictionary = {}
	var slices_notified: Array[String] = []

	func _init() -> void:
		s = SaveSchema.default_state(1700000000000)

	func state() -> Dictionary:
		return s

	func get_value(path: String, fallback: Variant = null) -> Variant:
		var node: Variant = s
		for part in path.split("."):
			if node is Dictionary and (node as Dictionary).has(part):
				node = node[part]
			else:
				return fallback
		return node

	func set_value(path: String, value: Variant) -> void:
		var parts := path.split(".")
		var node: Dictionary = s
		for i in parts.size() - 1:
			if not (node.get(parts[i]) is Dictionary):
				node[parts[i]] = {}
			node = node[parts[i]]
		node[parts[parts.size() - 1]] = value

	func update(mutator: Callable) -> void:
		mutator.call(s)

	func notify_slice_changed(slice_id: String) -> void:
		slices_notified.append(slice_id)


## ------------------------------------------------- Kappung räumt Dateien


func test_kappung_loescht_verdraengte_png() -> void:
	var pfade := _lege_testfotos_an(2)
	var gs := FakeGameState.new()
	var alt: Array = []
	# Deckel exakt voll: Platz 0 = jüngstes, Platz 39 = ältestes (echte PNG).
	for i in FotoModus.MAX_FOTOS - 1:
		alt.append({"pfad": "user://fotos/fake_%d.png" % i, "at": 2000 + i})
	alt.append({"pfad": pfade[0], "at": 1000})
	gs.s["city"]["fotos"] = alt
	var neu := FotoModus.merke_foto(gs, pfade[1], 99000)
	assert_eq(neu.size(), FotoModus.MAX_FOTOS, "Index bleibt gedeckelt")
	assert_eq(str((neu[0] as Dictionary)["pfad"]), pfade[1], "Neuestes vorn")
	assert_false(
		FileAccess.file_exists(ProjectSettings.globalize_path(pfade[0])),
		"verdrängte PNG ist vom Datenträger gelöscht (kein Speicherfresser)"
	)
	assert_true(
		FileAccess.file_exists(ProjectSettings.globalize_path(pfade[1])),
		"die frische Aufnahme bleibt liegen"
	)
	_raeume_testfotos_auf()


func test_kappung_schont_passfoto() -> void:
	var pfade := _lege_testfotos_an(2)
	var gs := FakeGameState.new()
	gs.set_value(PassportCard.PASSFOTO_PFAD, pfade[0])
	var alt: Array = []
	for i in FotoModus.MAX_FOTOS - 1:
		alt.append({"pfad": "user://fotos/fake_%d.png" % i, "at": 2000 + i})
	alt.append({"pfad": pfade[0], "at": 1000})
	gs.s["city"]["fotos"] = alt
	var neu := FotoModus.merke_foto(gs, pfade[1], 99000)
	assert_eq(neu.size(), FotoModus.MAX_FOTOS, "Index bleibt gedeckelt")
	assert_true(
		FileAccess.file_exists(ProjectSettings.globalize_path(pfade[0])),
		"Passfoto-Datei überlebt die Kappung (der Pass zeigt sie weiter)"
	)
	_raeume_testfotos_auf()


func test_kappung_schont_geteilte_datei() -> void:
	var pfade := _lege_testfotos_an(1)
	var gs := FakeGameState.new()
	var alt: Array = []
	for i in FotoModus.MAX_FOTOS - 2:
		alt.append({"pfad": "user://fotos/fake_%d.png" % i, "at": 3000 + i})
	# foto_pfad() ist sekundengenau: zwei Album-Einträge teilen EINE Datei —
	# fällt nur einer raus, muss die PNG für den verbliebenen bleiben.
	alt.append({"pfad": pfade[0], "at": 2000})
	alt.append({"pfad": pfade[0], "at": 1000})
	gs.s["city"]["fotos"] = alt
	var neu := FotoModus.merke_foto(gs, "user://fotos/neu.png", 99000)
	assert_eq(neu.size(), FotoModus.MAX_FOTOS, "Index bleibt gedeckelt")
	assert_true(
		FileAccess.file_exists(ProjectSettings.globalize_path(pfade[0])),
		"geteilte PNG bleibt: ein Index-Eintrag zeigt noch drauf"
	)
	_raeume_testfotos_auf()


## ------------------------------------------- Galerie-Löschen vs. Passfoto


func test_galerie_loeschen_raeumt_passfoto() -> void:
	var pfade := _lege_testfotos_an(2)
	var gs := FakeGameState.new()
	gs.s["city"]["fotos"] = [
		{"pfad": pfade[0], "at": 1700000000000, "ort": "city"},
		{"pfad": pfade[1], "at": 1700000100000, "ort": "funkelpark"},
	]
	gs.set_value(PassportCard.PASSFOTO_PFAD, pfade[0])
	var screen: GalerieScreen = load("res://scripts/ui/galerie/galerie_screen.gd").new()
	screen.gs_override = gs
	screen.auto_navigate = false
	tree.root.add_child(screen)
	await wait_frames(2)
	screen.oeffne_vollansicht(pfade[0])
	await wait_frames(1)
	screen._on_loeschen_bestaetigt()
	await wait_frames(1)
	assert_eq(
		str(gs.get_value(PassportCard.PASSFOTO_PFAD, "?")),
		"",
		"Passfoto-Pfad ist geleert (kein toter Pfad im Save)"
	)
	assert_true(gs.slices_notified.has("profile"), "profile-Slice benachrichtigt")
	assert_false(
		FileAccess.file_exists(ProjectSettings.globalize_path(pfade[0])), "PNG-Datei ist gelöscht"
	)
	# Gegenprobe: das zweite Foto löschen lässt ein FREMDES Passfoto in Ruhe.
	gs.set_value(PassportCard.PASSFOTO_PFAD, "user://fotos/anderes.png")
	gs.slices_notified.clear()
	screen.oeffne_vollansicht(pfade[1])
	await wait_frames(1)
	screen._on_loeschen_bestaetigt()
	await wait_frames(1)
	assert_eq(
		str(gs.get_value(PassportCard.PASSFOTO_PFAD, "?")),
		"user://fotos/anderes.png",
		"fremdes Passfoto bleibt unangetastet"
	)
	assert_false(gs.slices_notified.has("profile"), "kein unnötiger profile-Ping")
	screen.queue_free()
	await wait_frames(1)
	_raeume_testfotos_auf()


## Winzige echte PNGs anlegen (Muster test_rest4_galerie).
func _lege_testfotos_an(anzahl: int) -> Array[String]:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(TEST_DIR))
	var out: Array[String] = []
	for i in anzahl:
		var pfad := "%s/foto_%d.png" % [TEST_DIR, i]
		var bild := Image.create(8, 8, false, Image.FORMAT_RGB8)
		bild.fill(Color(0.3 * i, 0.6, 0.7))
		bild.save_png(pfad)
		out.append(pfad)
	return out


func _raeume_testfotos_auf() -> void:
	var absolut := ProjectSettings.globalize_path(TEST_DIR)
	var dir := DirAccess.open(absolut)
	if dir == null:
		return
	for file in dir.get_files():
		dir.remove(file)
	DirAccess.remove_absolute(absolut)
