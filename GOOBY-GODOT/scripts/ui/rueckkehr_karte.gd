class_name RueckkehrKarte
extends PanelSheet
## Rückkehrer-Karte (Welle J / I-44): „Was bisher geschah" nach ≥ 7 Tagen
## Pause — Gooby erzählt kleine Geschichten aus der Abwesenheit, darunter
## lädt die sanfte Wieder-Einstiegs-Quest mit ihren drei Momenten und der
## Geschenk-Zeile zum Wieder-Ankommen ein. Baut auf dem PanelSheet auf
## (News50Panel-Muster: bei jedem Öffnen und bei Rotation frisch bauen,
## damit Lesebreite und Schrift-Skalierung stimmen).

const ICON_DIR := "res://assets/ui/icons/"

## Anzeige-Daten aus dem Service (setup() VOR open() aufrufen):
## {tage, geschichten: [text_keys], aufgaben: [{def, target, ...}],
##  muenzen, xp}
var _daten: Dictionary = {}
## Zuletzt eingehängter Inhalt — beim Neubau SOFORT freigeben (G4-Befund:
## queue_free-pendente Kinder blähen die Min-Size des Sheets).
var _inhalt: Control


func _ready() -> void:
	super()
	set_title(I18nService.t("rueckkehr.titel"))


## Daten anbinden — VOR open().
func setup(daten: Dictionary) -> void:
	_daten = daten


func open() -> void:
	if not is_open():
		_setze_inhalt(_build_content())
	super()


## Rotation bei offenem Blatt: Inhalt frisch bauen (Lesebreite eingebrannt).
func _on_viewport_resized() -> void:
	if is_open():
		_setze_inhalt(_build_content())
	super()


func _setze_inhalt(neu: Control) -> void:
	if _inhalt != null and is_instance_valid(_inhalt):
		var eltern := _inhalt.get_parent()
		if eltern != null:
			eltern.remove_child(_inhalt)
		_inhalt.free()
	_inhalt = neu
	add_content(neu)


func _build_content() -> Control:
	var f := UiScale.for_viewport(get_viewport())
	var lese_breite := _lese_breite(f)
	var vbox := VBoxContainer.new()
	vbox.name = "RueckkehrList"
	vbox.add_theme_constant_override("separation", int(10.0 * f))
	var untertitel := Label.new()
	untertitel.name = "Untertitel"
	untertitel.theme_type_variation = "SoftLabel"
	untertitel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	untertitel.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	untertitel.custom_minimum_size = Vector2(lese_breite, 0.0)
	untertitel.add_theme_font_size_override("font_size", int(AcTokens.FONT_SIZE_BODY * f))
	untertitel.text = I18nService.t("rueckkehr.untertitel", {"tage": int(_daten.get("tage", 7))})
	vbox.add_child(untertitel)
	vbox.add_child(_abschnitt("GeschichtenTitel", I18nService.t("rueckkehr.geschichten_titel"), f))
	var stories: Array = _daten.get("geschichten", []) if _daten.get("geschichten") is Array else []
	for i in stories.size():
		var text := I18nService.t(str(stories[i]))
		vbox.add_child(_zeile("Story%d" % i, "sparkle", AcTokens.YELLOW_DARK, text, f, lese_breite))
	vbox.add_child(_abschnitt("QuestTitel", I18nService.t("rueckkehr.quest_titel"), f))
	var hinweis := Label.new()
	hinweis.name = "QuestHinweis"
	hinweis.theme_type_variation = "CaptionLabel"
	hinweis.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hinweis.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hinweis.custom_minimum_size = Vector2(lese_breite, 0.0)
	hinweis.add_theme_font_size_override("font_size", int(AcTokens.FONT_SIZE_CAPTION * f))
	hinweis.text = I18nService.t("rueckkehr.quest_hinweis")
	vbox.add_child(hinweis)
	var aufgaben: Array = _daten.get("aufgaben", []) if _daten.get("aufgaben") is Array else []
	for i in aufgaben.size():
		var row: Dictionary = aufgaben[i] if aufgaben[i] is Dictionary else {}
		var def: Dictionary = row.get("def", {}) if row.get("def") is Dictionary else {}
		var key := "rueckkehr.aufgabe." + str(def.get("id", ""))
		var text := I18nService.t(key, {"ziel": int(row.get("target", 1))})
		var icon := str(def.get("icon", "sparkle"))
		vbox.add_child(_zeile("Aufgabe%d" % i, icon, AcTokens.TEAL_DARK, text, f, lese_breite))
	var belohnung := Label.new()
	belohnung.name = "BelohnungZeile"
	belohnung.theme_type_variation = "CaptionLabel"
	belohnung.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	belohnung.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	belohnung.custom_minimum_size = Vector2(lese_breite, 0.0)
	belohnung.add_theme_font_size_override("font_size", int(AcTokens.FONT_SIZE_CAPTION * f))
	belohnung.text = I18nService.t(
		"rueckkehr.belohnung",
		{"muenzen": int(_daten.get("muenzen", 0)), "xp": int(_daten.get("xp", 0))}
	)
	vbox.add_child(belohnung)
	var ok := SquishButton.new()
	ok.name = "RueckkehrOkButton"
	ok.theme_type_variation = "BtnLeaf"
	ok.text = I18nService.t("rueckkehr.button")
	ok.custom_minimum_size = Vector2(220.0 * f, 52.0 * f)
	ok.add_theme_font_size_override("font_size", int(AcTokens.FONT_SIZE_BUTTON * f))
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.focus_mode = Control.FOCUS_NONE
	ok.pressed.connect(close)
	vbox.add_child(ok)
	return vbox


## Lesebreite wie News50Panel: Sheet-Innenbreite, gedeckelt auf ~560*f.
func _lese_breite(f: float) -> float:
	var vp := get_viewport()
	var canvas := Vector2(vp.get_visible_rect().size)
	var insets := UiScale.safe_insets_canvas(vp, safe_area_override)
	var innen := PanelSheetLayout.sheet_width(canvas, insets, f) - chrome_width()
	return minf(560.0 * f, maxf(innen, 220.0))


func _abschnitt(row_name: String, text: String, f: float) -> Control:
	var label := Label.new()
	label.name = row_name
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", int(AcTokens.FONT_SIZE_BODY * f))
	label.add_theme_color_override("font_color", AcTokens.INK)
	label.text = text
	return label


func _zeile(
	row_name: String, icon_name: String, tint: Color, text: String, f: float, lese_breite: float
) -> Control:
	var row := PanelContainer.new()
	row.name = row_name
	row.theme_type_variation = "AcWell"
	row.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	row.custom_minimum_size = Vector2(lese_breite, 0.0)
	var box := HBoxContainer.new()
	box.add_theme_constant_override("separation", int(12.0 * f))
	var icon := TextureRect.new()
	icon.texture = load(ICON_DIR + icon_name + ".svg")
	icon.custom_minimum_size = Vector2.ONE * roundf(28.0 * f)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.self_modulate = tint
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	box.add_child(icon)
	var body := Label.new()
	body.name = "ZeilenText"
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size", int(AcTokens.FONT_SIZE_BODY * f))
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# Wrap-Breite stabilisieren (W3a-GOTCHA: Autowrap ohne Min-Breite misst
	# im ersten Pass bei Breite 0): Lesebreite minus Icon/Abstand/Well-Rand.
	body.custom_minimum_size = Vector2(maxf(lese_breite - 80.0 * f, 160.0), 0.0)
	body.text = text
	box.add_child(body)
	row.add_child(box)
	return row
