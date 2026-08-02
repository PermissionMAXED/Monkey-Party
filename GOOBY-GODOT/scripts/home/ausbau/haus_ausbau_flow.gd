class_name HausAusbauFlow
extends Node
## Szenen-Seite des Haus-Ausbaus (I-07, Welle K): hängt Bauplan-Portale an
## gesperrte Ausbau-Türen, zeigt die Kauf-Karte, spielt nach dem Kauf die
## Treppen-Bau-Cutscene im Gooby-hämmert-Qualm-Stil (RoomBase.play_hammer_gag)
## und lädt den Raum neu — beim Wieder-Ankommen feiert die Einweihung
## (Tür-Plopp + Gooby-Spruch, Feier-Flag aus HausAusbau, nie doppelt).
## Angehängt von home_entry.gd nach jeder Reise (wie GoobyReactions & Co.).

## Während der Bau-Cutscene sind Portal-Taps gesperrt.
var _beschaeftigt := false

var _room: Node = null
var _gs: Object = null
var _karte: PanelContainer = null


## An einen RoomBase-Raum hängen (idempotent; ohne GameState still).
static func attach_to(room: Node) -> HausAusbauFlow:
	if not (room is RoomBase) or room.game_state() == null:
		return null
	var vorhanden := room.get_node_or_null("HausAusbauFlow")
	if vorhanden is HausAusbauFlow:
		return vorhanden
	var flow := HausAusbauFlow.new()
	flow.name = "HausAusbauFlow"
	flow._room = room
	flow._gs = room.game_state()
	room.add_child(flow)
	return flow


func _ready() -> void:
	_baue_portale()
	_feier_pruefen.call_deferred()


## Bauplan-Portale an alle noch gesperrten Ausbau-Türen dieses Raums.
func _baue_portale() -> void:
	var room_def: Dictionary = _room.room_def()
	for door_def: Dictionary in room_def.get("doors", []):
		if HausAusbau.tuer_frei(_gs, door_def):
			continue
		var ziel := str(door_def.get("to", ""))
		var portal := BauplanPortal.new()
		portal.setup(
			str(door_def.get("id", "")),
			I18nService.t(str(RoomDefs.room(ziel).get("name_key", ""))),
			I18nService.t("home.ausbau.preis", {"preis": str(HausAusbau.preis(ziel))})
		)
		portal.position = RoomDefs.door_world_pos(room_def, door_def)
		var inward := RoomDefs.wall_inward(str(door_def.get("wall", "N")))
		portal.rotation.y = atan2(inward.x, inward.z)
		portal.tapped.connect(_on_portal_tapped)
		_room.add_child(portal)


func _on_portal_tapped(door_id: String) -> void:
	if _beschaeftigt or _karte != null or _room.is_build_mode_active():
		return
	var door_def := RoomDefs.door(str(_room.get("room_id")), door_id)
	if door_def.is_empty():
		return
	_zeige_karte(door_def)


## Kauf-Karte: Raumname, Schwärm-Zeile, Preis, Bauen!/Später.
func _zeige_karte(door_def: Dictionary) -> void:
	var ziel := str(door_def.get("to", ""))
	var raum_name := I18nService.t(str(RoomDefs.room(ziel).get("name_key", "")))
	_karte = PanelContainer.new()
	_karte.name = "AusbauKarte"
	_karte.theme = ThemeService.theme()
	_karte.theme_type_variation = "AcCard"
	_karte.set_anchors_preset(Control.PRESET_CENTER)
	_karte.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_karte.grow_vertical = Control.GROW_DIRECTION_BOTH
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	_karte.add_child(box)
	_karte_zeile(box, I18nService.t("home.ausbau.titel", {"raum": raum_name}), true)
	_karte_zeile(box, I18nService.t("home.ausbau.pitch.%s" % ziel), false)
	_karte_zeile(
		box, I18nService.t("home.ausbau.preis", {"preis": str(HausAusbau.preis(ziel))}), true
	)
	var reihe := HBoxContainer.new()
	reihe.add_theme_constant_override("separation", 10)
	reihe.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_child(reihe)
	var bauen := Button.new()
	bauen.text = I18nService.t("home.ausbau.bauen")
	bauen.theme_type_variation = "PrimaryButton"
	bauen.pressed.connect(_on_karte_entschieden.bind(door_def, true))
	reihe.add_child(bauen)
	var spaeter := Button.new()
	spaeter.text = I18nService.t("home.ausbau.spaeter")
	spaeter.theme_type_variation = "GhostButton"
	spaeter.pressed.connect(_on_karte_entschieden.bind(door_def, false))
	reihe.add_child(spaeter)
	_room.ui_layer().add_child(_karte)


func _karte_zeile(box: VBoxContainer, text: String, fett: bool) -> void:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size = Vector2(360, 0)
	if fett:
		label.theme_type_variation = "HeadlineLabel"
	box.add_child(label)


func _on_karte_entschieden(door_def: Dictionary, kaufen: bool) -> void:
	if _karte != null:
		_karte.queue_free()
		_karte = null
	if not kaufen:
		return
	var ziel := str(door_def.get("to", ""))
	if HausAusbau.kaufen(_gs, ziel):
		_bau_cutscene(door_def)
		return
	_kauf_abgelehnt(ziel)


## Warum ging der Kauf nicht? Gooby erklärt es freundlich.
func _kauf_abgelehnt(ziel: String) -> void:
	var noetig := HausAusbau.fehlende_voraussetzung(_gs, ziel)
	if noetig != "":
		var noetig_name := I18nService.t(str(RoomDefs.room(noetig).get("name_key", "")))
		_room.say(I18nService.t("home.ausbau.brauch_erst", {"raum": noetig_name}))
		return
	var fehlt := HausAusbau.fehlende_muenzen(_gs, ziel)
	if fehlt > 0:
		_room.say(I18nService.t("home.ausbau.zu_teuer", {"fehlt": str(fehlt)}))


## Treppen-Bau-Cutscene (Doc D §4.1): Gooby hämmert vorm Portal, Qualm,
## Jubel — danach lädt der Raum neu und die echte Treppe/Tür steht da.
func _bau_cutscene(door_def: Dictionary) -> void:
	_beschaeftigt = true
	var room_def: Dictionary = _room.room_def()
	var inward := RoomDefs.wall_inward(str(door_def.get("wall", "N")))
	var pos := RoomDefs.door_world_pos(room_def, door_def) + inward * 0.9
	await _room.play_hammer_gag(pos)
	_beschaeftigt = false
	var router := get_node_or_null("/root/SceneRouter")
	if router == null:
		return
	router.goto(
		RoomDefs.route_target(str(_room.get("room_id"))), {"door_id": str(door_def.get("id", ""))}
	)


## Einweihung nach dem Neu-Laden: neue Tür/Treppe ploppt aus einer
## Qualmwolke, Gooby schwärmt — genau einmal pro Kauf (Feier-Flag).
func _feier_pruefen() -> void:
	if not is_inside_tree():
		return
	for door_def: Dictionary in _room.room_def().get("doors", []):
		var ziel := str(door_def.get("to", ""))
		if not HausAusbau.ist_ausbau(ziel) or not HausAusbau.feier_faellig(_gs, ziel):
			continue
		if not HausAusbau.tuer_frei(_gs, door_def):
			continue
		HausAusbau.feier_abgeholt(_gs, ziel)
		var tuer := _room.get_node_or_null("Door_%s" % str(door_def.get("id", "")))
		if tuer is Node3D:
			await HomeBuildAnim.plopp(_room, tuer, (tuer as Node3D).position)
		if is_inside_tree():
			_room.say(I18nService.t("home.ausbau.feier.%s" % ziel))
		return
