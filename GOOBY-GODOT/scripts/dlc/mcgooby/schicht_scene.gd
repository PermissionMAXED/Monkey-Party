class_name McGoobySchichtScene
extends Control
## McGooby-Mini-Schicht (Welle A, Doc §2.2 #1): EINE Station — Burger braten.
## 2–4 Kunden-Bestellungen nacheinander (deterministisch aus dem Tages-Seed,
## McGoobySchichtLogic), taktiles Wenden im goldenen Timing-Fenster mit
## „Perfekt!“-Callout, Bestellglocke + Brutzel-Feedback aus BESTEHENDEN
## SfxMap-Ids, Schicht-Ende-Karte mit Kassensturz (McGoobyAbrechnung).
## Hinter der UI liegt die McGooby-BÜHNE (McGoobySchichtStage3D, J+/G6-
## Paket): das gemeinsame 3D-Set der Schicht — Gooby als Grill-Koch, ein
## echter Patty, der live mit dem Logik-Zustand die Farbe wechselt und beim
## Wenden einen Salto macht, Brutzel-Dampf und jubelnde Kunden. Die UI
## bleibt vollständig bedienbar wie zuvor; ein Verlaufs-Scrim („Wallpaper“)
## hält Kopfzeile und Karten über der Bühne lesbar.
## Beim Erststart erzählt eine Dialog-Karte den Eröffnungs-Hook (Doc §1.3);
## der Haken wird im additiven Save-Slice `mcgooby` gemerkt (McGoobyState).
## Jederzeit pausierbar über das bestehende MinigamePauseModal-Muster.
##
## Route `mcgooby_schicht` — der DLC-Hub (P24) verweist später per
## Katalog-Eintrag hierher; die Route registriert sich selbst (Muster
## ChessScene/DlcScreen), der Hub muss nur `register_routes()` + `goto()`.

signal ready_for_reveal

const Economy := preload("res://scripts/logic/economy.gd")

const ROUTE := &"mcgooby_schicht"
const ROUTES := {ROUTE: "res://scripts/dlc/mcgooby/schicht_scene.tscn"}

## Patty-Zustandsfarben (Parodie mit Herz: Kohle ist ein Gag, kein Fail).
const FARBE_ROH := Color("#E8A18B")
const FARBE_GOLDBRAUN := Color("#E8C25A")
const FARBE_KOHLE := Color("#54382A")
const FARBE_TEXT_HELL := Color("#FFF3DC")
const FARBE_TEXT_DUNKEL := Color("#6B4A2B")

## Wunschgröße des Patty-Knopfs (Design-px, skaliert mit f; nie unter Floor).
const PATTY_BASIS := 168.0
## Karten-Wunschbreite der Intro-/Ende-Overlays (Design-px).
const KARTE_BASIS := 360.0

## Schicht-Anpfiff: Kamera-Anflug aus der Küchen-Totale (burger_build-
## Muster; Reduced Motion springt direkt in die Spielpose).
const ANFLUG_SEC := 0.9

## Tests/Screenshots: GameState-Double statt /root/GameState.
var gs_override: Object = null
## Tests: fester Seed statt Tages-Seed (0 = Tages-Seed).
var seed_override := 0
## Tests: Navigation abschaltbar.
var auto_navigate := true

var _gs: Object = null
var _bal: Dictionary = {}
var _menu: Array = []
var _folge: Array[Dictionary] = []
var _runde := 0
var _laeuft := false
var _pausiert := false
var _bestellung_idx := 0
var _patty_idx := 0
var _patty_zeit := 0.0
var _patty_aktiv := false
var _patty_timing: Dictionary = {}
var _patty_zustand := McGoobySchichtLogic.ZUSTAND_ROH
var _punkte := 0
var _perfekt_gesamt := 0
var _bestellung_punkte := 0
var _bestellung_fehlerfrei := true
var _ergebnisse: Array[Dictionary] = []
var _kasse: Dictionary = {}
var _m: Dictionary = {}
var _anflug_left := 0.0

var _stage: McGoobySchichtStage3D

var _rows: VBoxContainer
var _back: Button
var _pause_btn: Button
var _punkte_label: Label
var _bestellung_label: Label
var _gericht_label: Label
var _patty_label: Label
var _callout: Label
var _patty_btn: Button
var _garbar: ProgressBar
var _intro_overlay: Control
var _intro_karte: PanelContainer
var _intro_knopf: Button
var _ende_overlay: Control
var _ende_karte: PanelContainer
var _ende_zeilen: VBoxContainer
var _nochmal_knopf: Button
var _feierabend_knopf: Button
var _pause_modal: MinigamePauseModal


static func register_routes() -> void:
	var loop := Engine.get_main_loop()
	if not (loop is SceneTree):
		return
	var router := (loop as SceneTree).root.get_node_or_null("/root/SceneRouter")
	if router != null and router.has_method("register_routes"):
		router.register_routes(ROUTES)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = ThemeService.theme()
	register_routes()
	McGoobyState.register_slice()
	_gs = gs_override if gs_override != null else get_node_or_null("/root/GameState")
	_bal = McGoobyKatalog.balance()
	_menu = McGoobyKatalog.rezepte_fuer("grill")
	_build_ui()
	_apply_metrics()
	get_viewport().size_changed.connect(_apply_metrics)
	if McGoobyState.ist_intro_gesehen(_gs):
		_starte_schicht()
	else:
		_zeige_intro()
	ready_for_reveal.emit()


func receive_params(params: Dictionary) -> void:
	seed_override = int(params.get("seed", seed_override))


func _process(delta: float) -> void:
	# Die Bühne lebt auch zwischen Bestellungen und unter den Overlays
	# (Kunden schunkeln, Glow zerfällt) — nur die Pause friert sie ein.
	if _stage != null and not _pausiert:
		_stage.tick(delta)
		if _anflug_left > 0.0:
			_anflug_left = maxf(0.0, _anflug_left - delta)
			_stage.establish(1.0 if _reduced_motion() else 1.0 - _anflug_left / ANFLUG_SEC)
	if not _laeuft or _pausiert or not _patty_aktiv:
		return
	_patty_zeit += delta
	var timing := _patty_timing
	var zustand := McGoobySchichtLogic.zustand(_patty_zeit, timing)
	if zustand != _patty_zustand:
		_patty_zustand = zustand
		# Brutzel-Feedback: der Zustandswechsel „ploppt“ hörbar (mg_good).
		if zustand == McGoobySchichtLogic.ZUSTAND_GOLDBRAUN:
			AudioDirector.try_play(self, "mg_good")
	_patty_visualisieren()
	# Liegengelassene Pattys lösen sich nach dem Nachlauf freundlich selbst
	# auf (Röstaroma-Spezial, halbe Punkte — nie ein Fail-State, Doc §4.2).
	var ende := (
		float(timing.get("gar_sec", 4.0))
		+ float(timing.get("fenster_sec", 1.4))
		+ float(timing.get("nachlauf_sec", 2.0))
	)
	if _patty_zeit >= ende:
		_werte_patty(McGoobySchichtLogic.bewerte_liegengelassen(_bal))


## ---------------------------------------------------------------- Test-API


func ist_intro_offen() -> bool:
	return _intro_overlay != null and _intro_overlay.visible


func ist_ende_offen() -> bool:
	return _ende_overlay != null and _ende_overlay.visible


func ist_am_laufen() -> bool:
	return _laeuft and not _pausiert


func bestellung_aktuell() -> Dictionary:
	if _bestellung_idx >= 0 and _bestellung_idx < _folge.size():
		return _folge[_bestellung_idx]
	return {}


func schicht_ergebnis() -> Dictionary:
	return _kasse.duplicate(true)


## Tests: Brat-Zeit des aktiven Pattys pinnen (statt Frames abzuwarten).
func patty_zeit_setzen(t_sec: float) -> void:
	_patty_zeit = maxf(0.0, t_sec)
	_patty_zustand = McGoobySchichtLogic.zustand(_patty_zeit, _patty_timing)
	_patty_visualisieren()


func patty_knopf() -> Button:
	return _patty_btn


## Tests/Screenshots: Zugriff auf die 3D-Bühne der Schicht.
func buehne() -> McGoobySchichtStage3D:
	return _stage


## ---------------------------------------------------------------- Aufbau


func _build_ui() -> void:
	# Die McGooby-Bühne (3D) liegt HINTER allen CanvasItems — Godot rendert
	# die 3D-Welt eines Viewports immer unter der 2D-Ebene, die UI bleibt
	# also unverändert obenauf (stage3d-Vertrag).
	_stage = McGoobySchichtStage3D.new()
	_stage.name = "Buehne"
	add_child(_stage)
	_stage.setup_stage()

	# Statt des deckenden AcWallpaper: ein Verlaufs-Scrim (oben/unten warm
	# abgedunkelt, Mitte frei) — hält Kopfzeile + Karten über der Bühne
	# lesbar und erfüllt weiter den Vollflächen-Vertrag der Geometrie-Tests.
	var wallpaper := TextureRect.new()
	wallpaper.name = "Wallpaper"
	wallpaper.set_anchors_preset(Control.PRESET_FULL_RECT)
	wallpaper.stretch_mode = TextureRect.STRETCH_SCALE
	wallpaper.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var verlauf := Gradient.new()
	verlauf.offsets = PackedFloat32Array([0.0, 0.3, 0.72, 1.0])
	verlauf.colors = PackedColorArray(
		[
			Color(0.22, 0.12, 0.07, 0.5),
			Color(0.22, 0.12, 0.07, 0.0),
			Color(0.22, 0.12, 0.07, 0.0),
			Color(0.22, 0.12, 0.07, 0.34),
		]
	)
	var scrim := GradientTexture2D.new()
	scrim.gradient = verlauf
	scrim.fill_from = Vector2(0.0, 0.0)
	scrim.fill_to = Vector2(0.0, 1.0)
	wallpaper.texture = scrim
	add_child(wallpaper)

	_rows = VBoxContainer.new()
	_rows.name = "Spalte"
	_rows.add_theme_constant_override("separation", 12)
	add_child(_rows)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 10)
	_rows.add_child(header)
	_back = SquishButton.new()
	_back.name = "Zurueck"
	_back.theme_type_variation = &"BtnGhost"
	_back.text = I18nService.t("dlc_mcgooby.zurueck")
	_back.focus_mode = Control.FOCUS_NONE
	_back.pressed.connect(_on_back_pressed)
	header.add_child(_back)
	var titel := Label.new()
	titel.theme_type_variation = &"TitleLabel"
	titel.text = I18nService.t("dlc_mcgooby.titel")
	titel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	titel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header.add_child(titel)
	_pause_btn = SquishButton.new()
	_pause_btn.name = "Pause"
	_pause_btn.theme_type_variation = &"BtnGhost"
	_pause_btn.text = I18nService.t("dlc_mcgooby.schicht.pause")
	_pause_btn.focus_mode = Control.FOCUS_NONE
	_pause_btn.pressed.connect(_on_pause_pressed)
	header.add_child(_pause_btn)

	_punkte_label = Label.new()
	_punkte_label.name = "Punkte"
	_punkte_label.theme_type_variation = &"CaptionLabel"
	_punkte_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_rows.add_child(_punkte_label)

	var karte := PanelContainer.new()
	karte.name = "BestellKarte"
	karte.theme_type_variation = &"AcCard"
	_rows.add_child(karte)
	var karte_box := VBoxContainer.new()
	karte_box.add_theme_constant_override("separation", 4)
	karte.add_child(karte_box)
	_bestellung_label = Label.new()
	_bestellung_label.name = "Bestellung"
	_bestellung_label.theme_type_variation = &"CaptionLabel"
	karte_box.add_child(_bestellung_label)
	_gericht_label = Label.new()
	_gericht_label.name = "Gericht"
	_gericht_label.theme_type_variation = &"TitleLabel"
	_gericht_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	karte_box.add_child(_gericht_label)
	_patty_label = Label.new()
	_patty_label.name = "PattyZaehler"
	_patty_label.theme_type_variation = &"CaptionLabel"
	karte_box.add_child(_patty_label)

	# Mittig + Daumenzone: die Grill-Gruppe zentriert im Rest-Raum.
	var mitte := CenterContainer.new()
	mitte.name = "Mitte"
	mitte.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_rows.add_child(mitte)
	var grill_box := VBoxContainer.new()
	grill_box.add_theme_constant_override("separation", 14)
	grill_box.alignment = BoxContainer.ALIGNMENT_CENTER
	mitte.add_child(grill_box)
	_callout = Label.new()
	_callout.name = "Callout"
	_callout.theme_type_variation = &"HeadlineLabel"
	_callout.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_callout.text = " "
	grill_box.add_child(_callout)
	_patty_btn = SquishButton.new()
	_patty_btn.name = "PattyKnopf"
	_patty_btn.focus_mode = Control.FOCUS_NONE
	_patty_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_patty_btn.pressed.connect(_on_patty_tap)
	grill_box.add_child(_patty_btn)
	_garbar = ProgressBar.new()
	_garbar.name = "GarBalken"
	_garbar.min_value = 0.0
	_garbar.max_value = 1.0
	_garbar.show_percentage = false
	_garbar.custom_minimum_size = Vector2(0.0, 10.0)
	grill_box.add_child(_garbar)

	_intro_overlay = _baue_intro_overlay()
	_ende_overlay = _baue_ende_overlay()

	_pause_modal = MinigamePauseModal.new()
	_pause_modal.name = "PauseModal"
	_pause_modal.hint_key = "dlc_mcgooby.schicht.hilfe"
	_pause_modal.resume_requested.connect(_on_resume)
	_pause_modal.restart_requested.connect(_on_restart)
	_pause_modal.quit_requested.connect(_on_quit)
	add_child(_pause_modal)


func _baue_intro_overlay() -> Control:
	var teile := _baue_overlay_grund("IntroOverlay")
	var overlay: Control = teile["overlay"]
	_intro_karte = teile["karte"]
	var box: VBoxContainer = teile["inhalt"]
	var titel := Label.new()
	titel.theme_type_variation = &"TitleLabel"
	titel.text = I18nService.t("dlc_mcgooby.intro.titel")
	titel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(titel)
	for key: String in ["zeile1", "zeile2", "zeile3"]:
		var zeile := Label.new()
		zeile.theme_type_variation = &"SoftLabel"
		zeile.text = I18nService.t("dlc_mcgooby.intro." + key)
		zeile.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		box.add_child(zeile)
	_intro_knopf = SquishButton.new()
	_intro_knopf.name = "SchuerzeKnopf"
	_intro_knopf.theme_type_variation = &"BtnLeaf"
	_intro_knopf.text = I18nService.t("dlc_mcgooby.intro.knopf")
	_intro_knopf.focus_mode = Control.FOCUS_NONE
	_intro_knopf.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_intro_knopf.pressed.connect(_on_intro_bestaetigt)
	box.add_child(_intro_knopf)
	return overlay


func _baue_ende_overlay() -> Control:
	var teile := _baue_overlay_grund("EndeOverlay")
	var overlay: Control = teile["overlay"]
	_ende_karte = teile["karte"]
	var box: VBoxContainer = teile["inhalt"]
	var titel := Label.new()
	titel.name = "EndeTitel"
	titel.theme_type_variation = &"TitleLabel"
	titel.text = I18nService.t("dlc_mcgooby.ende.titel")
	titel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(titel)
	var unter := Label.new()
	unter.theme_type_variation = &"CaptionLabel"
	unter.text = I18nService.t("dlc_mcgooby.ende.untertitel")
	unter.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	unter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(unter)
	_ende_zeilen = VBoxContainer.new()
	_ende_zeilen.name = "Kassensturz"
	_ende_zeilen.add_theme_constant_override("separation", 4)
	box.add_child(_ende_zeilen)
	_nochmal_knopf = SquishButton.new()
	_nochmal_knopf.name = "Nochmal"
	_nochmal_knopf.theme_type_variation = &"BtnTeal"
	_nochmal_knopf.text = I18nService.t("dlc_mcgooby.ende.nochmal")
	_nochmal_knopf.focus_mode = Control.FOCUS_NONE
	_nochmal_knopf.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_nochmal_knopf.pressed.connect(_on_nochmal_pressed)
	box.add_child(_nochmal_knopf)
	_feierabend_knopf = SquishButton.new()
	_feierabend_knopf.name = "Feierabend"
	_feierabend_knopf.theme_type_variation = &"BtnGhost"
	_feierabend_knopf.text = I18nService.t("dlc_mcgooby.ende.feierabend")
	_feierabend_knopf.focus_mode = Control.FOCUS_NONE
	_feierabend_knopf.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_feierabend_knopf.pressed.connect(_on_feierabend_pressed)
	box.add_child(_feierabend_knopf)
	return overlay


## Gemeinsames Overlay-Gerüst: Abdunkelung + mittige AcCardLg-Karte.
## Rückgabe: {"overlay": Control, "karte": PanelContainer, "inhalt": VBox}.
func _baue_overlay_grund(overlay_name: String) -> Dictionary:
	var overlay := Control.new()
	overlay.name = overlay_name
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.visible = false
	add_child(overlay)
	var dim := ColorRect.new()
	dim.name = "Dim"
	dim.color = Color(0.24, 0.16, 0.12, 0.5)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	overlay.add_child(dim)
	var zentrum := CenterContainer.new()
	zentrum.name = "Zentrum"
	zentrum.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(zentrum)
	var karte := PanelContainer.new()
	karte.name = "Karte"
	karte.theme_type_variation = &"AcCardLg"
	zentrum.add_child(karte)
	var box := VBoxContainer.new()
	box.name = "Inhalt"
	box.add_theme_constant_override("separation", 10)
	karte.add_child(box)
	return {"overlay": overlay, "karte": karte, "inhalt": box}


## ---------------------------------------------------------------- Ablauf


func _zeige_intro() -> void:
	_intro_overlay.visible = true
	UiMotion.pop_in(_intro_karte)


func _on_intro_bestaetigt() -> void:
	AudioDirector.try_play(self, "ui_confirm")
	McGoobyState.setze_intro_gesehen(_gs)
	_intro_overlay.visible = false
	_starte_schicht()


func _starte_schicht() -> void:
	_folge = McGoobySchichtLogic.bestell_folge(_basis_seed() + _runde, _menu, _bal)
	_ende_overlay.visible = false
	_ergebnisse = []
	_kasse = {}
	_punkte = 0
	_perfekt_gesamt = 0
	_bestellung_idx = -1
	_laeuft = not _folge.is_empty()
	_pausiert = false
	_anflug_left = ANFLUG_SEC
	_punkte_anzeigen()
	_callout.text = " "
	if _laeuft:
		_naechste_bestellung()
	else:
		push_warning("McGooby: kein Grill-Rezept im Menü — Schicht startet nicht.")


func _naechste_bestellung() -> void:
	_bestellung_idx += 1
	_bestellung_punkte = 0
	_bestellung_fehlerfrei = true
	_patty_idx = 0
	# Bestellglocken-„Pling“ (Doc §2.2.6) aus dem Bestand: gvz_wave-Glocke.
	AudioDirector.try_play(self, "gvz_wave")
	if _stage != null:
		_stage.bestellglocke()
	_bestellung_anzeigen()
	_naechster_patty()


func _naechster_patty() -> void:
	_patty_idx += 1
	_patty_zeit = 0.0
	_patty_zustand = McGoobySchichtLogic.ZUSTAND_ROH
	_patty_timing = McGoobyKatalog.timing("grill", _rezept_aktuell())
	_patty_aktiv = true
	# Brutzel-Start: der Patty landet raschelnd-zischend auf dem Grill.
	AudioDirector.try_play(self, "ranch_heu")
	if _stage != null:
		_stage.patty_neu()
	_bestellung_anzeigen()
	_patty_visualisieren()


func _on_patty_tap() -> void:
	if not _laeuft or _pausiert or not _patty_aktiv:
		return
	var wertung := McGoobySchichtLogic.bewerte_tap(_patty_zeit, _patty_timing, _bal)
	if str(wertung["wertung"]) == McGoobySchichtLogic.WERTUNG_ROH:
		# Zu früh ist keine Strafe: sanfter Tick, der Patty brät weiter.
		AudioDirector.try_play(self, "ui_tick")
		_callout_zeigen(I18nService.t("dlc_mcgooby.schicht.roh"))
		return
	_werte_patty(wertung)


func _werte_patty(wertung: Dictionary) -> void:
	_patty_aktiv = false
	var punkte := int(wertung["punkte"])
	_punkte += punkte
	_bestellung_punkte += punkte
	var perfekt := str(wertung["wertung"]) == McGoobySchichtLogic.WERTUNG_PERFEKT
	if _stage != null:
		# Bühnen-Echo des Wendens: Patty-Salto + Funken (gold/aschig).
		_stage.wenden(perfekt)
	if perfekt:
		_perfekt_gesamt += 1
		AudioDirector.try_play(self, "mg_perfect")
		_callout_zeigen(I18nService.t("dlc_mcgooby.schicht.perfekt"))
	else:
		_bestellung_fehlerfrei = false
		AudioDirector.try_play(self, "mg_spill")
		_callout_zeigen(I18nService.t("dlc_mcgooby.schicht.roestaroma"))
	_punkte_anzeigen()
	var bestellung := bestellung_aktuell()
	if _patty_idx < int(bestellung.get("patties", 1)):
		_naechster_patty()
	else:
		_bestellung_fertig()


func _bestellung_fertig() -> void:
	var bonus := int(_bal.get("bestellung_fertig_bonus", 15))
	_punkte += bonus
	_bestellung_punkte += bonus
	_ergebnisse.append({"punkte": _bestellung_punkte, "fehlerfrei": _bestellung_fehlerfrei})
	# Münz-Einnahme-Moment: die Kasse klimpert pro fertiger Bestellung.
	AudioDirector.try_play(self, "ui_coins")
	if _stage != null:
		# Die wartenden Kunden jubeln + Funken über dem Abhol-Tablett.
		_stage.bestellung_fertig()
	_punkte_anzeigen()
	if _bestellung_idx + 1 < _folge.size():
		_naechste_bestellung()
	else:
		_schicht_ende()


func _schicht_ende() -> void:
	_laeuft = false
	_patty_aktiv = false
	_kasse = McGoobyAbrechnung.abrechnung(_ergebnisse, _bal)
	AudioDirector.try_play(self, "mg_win")
	if _stage != null:
		_stage.feierabend_jubel()
		_stage.sync_patty(_patty_zustand, 0.0, false, _reduced_motion())
	_muenzen_gutschreiben(int(_kasse.get("muenzen", 0)))
	McGoobyState.schicht_verbuchen(_gs, _punkte)
	_ende_fuellen()
	_ende_overlay.visible = true
	UiMotion.pop_in(_ende_karte)


func _ende_fuellen() -> void:
	for kind in _ende_zeilen.get_children():
		kind.queue_free()
	_ende_zeile("punkte", str(int(_kasse.get("punkte", 0))))
	_ende_zeile("perfekt", str(_perfekt_gesamt))
	_ende_zeile("trinkgeld", str(int(_kasse.get("trinkgeld", 0))))
	_ende_zeile("muenzen", str(int(_kasse.get("muenzen", 0))))


func _ende_zeile(key: String, wert: String) -> void:
	var zeile := HBoxContainer.new()
	zeile.add_theme_constant_override("separation", 12)
	_ende_zeilen.add_child(zeile)
	var links := Label.new()
	links.theme_type_variation = &"SoftLabel"
	links.text = I18nService.t("dlc_mcgooby.ende." + key)
	links.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	zeile.add_child(links)
	var rechts := Label.new()
	rechts.name = "Wert_" + key
	rechts.theme_type_variation = &"HeadlineLabel"
	rechts.text = wert
	zeile.add_child(rechts)


## ---------------------------------------------------------------- Anzeige


func _bestellung_anzeigen() -> void:
	var bestellung := bestellung_aktuell()
	_bestellung_label.text = I18nService.t(
		"dlc_mcgooby.schicht.bestellung",
		{"nr": int(bestellung.get("nr", 0)), "gesamt": _folge.size()}
	)
	_gericht_label.text = McGoobyKatalog.text_von(_rezept_aktuell(), "name")
	_patty_label.text = I18nService.t(
		"dlc_mcgooby.schicht.patty", {"nr": _patty_idx, "gesamt": int(bestellung.get("patties", 1))}
	)


func _punkte_anzeigen() -> void:
	_punkte_label.text = I18nService.t("dlc_mcgooby.schicht.punkte", {"punkte": _punkte})


func _callout_zeigen(text: String) -> void:
	_callout.text = text
	UiMotion.bounce(_callout)


func _patty_visualisieren() -> void:
	if _patty_btn == null:
		return
	if _stage != null:
		# Bühnen-Sync: der 3D-Patty folgt Zustand + Garungs-Fortschritt,
		# der Koch kommentiert mit der Miene (goldbraun = JETZT wenden!).
		_stage.sync_patty(
			_patty_zustand,
			McGoobySchichtLogic.fortschritt(_patty_zeit, _patty_timing),
			_patty_aktiv,
			_reduced_motion()
		)
		match _patty_zustand:
			McGoobySchichtLogic.ZUSTAND_GOLDBRAUN:
				_stage.feel("ecstatic")
			McGoobySchichtLogic.ZUSTAND_KOHLE:
				_stage.feel("dizzy")
			_:
				_stage.feel("happy")
	var farbe := FARBE_ROH
	var text_farbe := FARBE_TEXT_DUNKEL
	var hinweis := I18nService.t("dlc_mcgooby.schicht.roh")
	match _patty_zustand:
		McGoobySchichtLogic.ZUSTAND_GOLDBRAUN:
			farbe = FARBE_GOLDBRAUN
			hinweis = I18nService.t("dlc_mcgooby.schicht.goldbraun")
		McGoobySchichtLogic.ZUSTAND_KOHLE:
			farbe = FARBE_KOHLE
			text_farbe = FARBE_TEXT_HELL
			hinweis = I18nService.t("dlc_mcgooby.schicht.kohle")
	_patty_btn.text = hinweis
	_patty_btn.add_theme_color_override("font_color", text_farbe)
	_patty_btn.add_theme_color_override("font_pressed_color", text_farbe)
	_patty_btn.add_theme_color_override("font_hover_color", text_farbe)
	var stil := StyleBoxFlat.new()
	stil.bg_color = farbe
	stil.set_corner_radius_all(int(_patty_btn.custom_minimum_size.y / 2.0))
	_patty_btn.add_theme_stylebox_override("normal", stil)
	_patty_btn.add_theme_stylebox_override("hover", stil)
	_patty_btn.add_theme_stylebox_override("pressed", stil)
	_garbar.value = McGoobySchichtLogic.fortschritt(_patty_zeit, _patty_timing)


func _apply_metrics() -> void:
	if not is_inside_tree():
		return
	_m = ScreenShell.metrics(get_viewport())
	var f := float(_m["f"])
	if _stage != null:
		_stage.apply_size(_m["canvas"] as Vector2)
	ScreenShell.content_frame(_rows, _m)
	ScreenShell.touch_target(_back, _m)
	ScreenShell.touch_target(_pause_btn, _m)
	for knopf: Button in [_intro_knopf, _nochmal_knopf, _feierabend_knopf]:
		if knopf != null:
			ScreenShell.touch_target(knopf, _m)
	var patty_seite := maxf(float(_m["floor_px"]), PATTY_BASIS * f)
	_patty_btn.custom_minimum_size = Vector2(patty_seite, patty_seite)
	_garbar.custom_minimum_size = Vector2(patty_seite, 10.0 * f)
	for karte: PanelContainer in [_intro_karte, _ende_karte]:
		if karte != null:
			karte.custom_minimum_size.x = ScreenShell.card_width(_m, KARTE_BASIS)
	ScreenShell.scale_fonts(self, f)
	_patty_visualisieren()


## ---------------------------------------------------------------- Steuerung


func _on_pause_pressed() -> void:
	if _pause_modal.is_open():
		return
	AudioDirector.try_play(self, "ui_open")
	_pausiert = true
	_pause_modal.open()


func _on_resume() -> void:
	_pausiert = false


func _on_restart() -> void:
	_pausiert = false
	_starte_schicht()


func _on_quit() -> void:
	_navigiere_zurueck()


func _on_nochmal_pressed() -> void:
	AudioDirector.try_play(self, "ui_confirm")
	_runde += 1
	_starte_schicht()


func _on_feierabend_pressed() -> void:
	AudioDirector.try_play(self, "ui_back")
	_navigiere_zurueck()


func _on_back_pressed() -> void:
	AudioDirector.try_play(self, "ui_back")
	_navigiere_zurueck()


func _navigiere_zurueck() -> void:
	if not auto_navigate:
		return
	var router := get_node_or_null("/root/SceneRouter")
	if router == null:
		return
	if router.has_method("handle_back_request") and router.handle_back_request():
		return
	if router.has_method("goto"):
		router.goto(&"home", {})


## ---------------------------------------------------------------- Intern


func _rezept_aktuell() -> Dictionary:
	return McGoobyKatalog.rezept(str(bestellung_aktuell().get("rezept_id", "")))


func _basis_seed() -> int:
	if seed_override != 0:
		return seed_override
	# Tages-Seed wie MarktSim (Doc §4.1: gleicher Tag = gleicher Kundenstrom).
	# Der Tag kommt aus der PINNBAREN Uhr (gs.clock, Muster
	# GoobyeLadenScene._tag_key) — die Systemzeit ignorierte gepinnte
	# Test-/Dev-Uhren und wich vom Rest des Spiels ab (Playtest H-dlc-park).
	return _tag_key().hash()


func _tag_key() -> String:
	var ms := int(Time.get_unix_time_from_system() * 1000.0)
	if _gs != null and "clock" in _gs:
		ms = int(_gs.clock.now_ms())
	return Time.get_date_string_from_unix_time(floori(float(ms) / 1000.0))


## Reduced-Motion-Abfrage (Duck-Typing wie im JuiceKit — ohne Autoload = aus).
func _reduced_motion() -> bool:
	if not is_inside_tree():
		return true
	var settings := get_node_or_null(^"/root/AppSettings")
	if settings != null and settings.has_method("is_reduced_motion"):
		return bool(settings.call("is_reduced_motion"))
	return false


func _muenzen_gutschreiben(betrag: int) -> void:
	if _gs == null or betrag <= 0:
		return
	if _gs.has_method("update"):
		_gs.update(_muenzen_update.bind(betrag))
	elif _gs.has_method("set_value"):
		var coins := int(_gs.get_value("economy.coins", 0))
		_gs.set_value("economy.coins", coins + betrag)


## Münzen über den EINEN Geld-Pfad (Economy.award) verbuchen.
func _muenzen_update(state: Dictionary, betrag: int) -> void:
	if state.get("economy") is Dictionary:
		Economy.award(state["economy"], betrag, "mcgooby")
