class_name RueckkehrService
extends Node
## Rückkehrer-Dienst (Welle J / I-44): liest beim Home-Start die
## Besuchslücke (VOR dem touch_visit-Stempel der Seele — Muster
## SeeleRunner._luecke_vor_besuch) und zeigt nach ≥ 7 Tagen Pause EINMAL
## die Rückkehrer-Karte „Was bisher geschah" (Geschichten + sanfte
## Wieder-Einstiegs-Quest). Danach beobachtet er die vorhandenen Zähler
## und zahlt das Wiedersehens-Geschenk, sobald alle drei kleinen Momente
## passiert sind — mit Feier, ohne Zeitdruck (die Quest verfällt nie).
##
## Häng-Punkt: home_entry._ready (Muster DailyQuestService.attach_to) —
## so läuft die Lücken-Messung garantiert vor dem ersten Raum-Betreten.

const GROUP := &"rueckkehr_service"
const KARTE_SCENE := "res://scripts/ui/rueckkehr_karte.tscn"
## Kleine Atempause nach der Raum-Ankunft, damit der Blütenblätter-Wipe
## fertig ist, bevor die Karte hereinfedert.
const KARTE_DELAY_S := 1.1
## Sicherheitsnetz-Puls für den Quest-Fortschritt (billig: 3 Messungen).
const TICK_S := 10.0
const KONFETTI_TEILE := 40

const Economy := preload("res://scripts/logic/economy.gd")
const Leveling := preload("res://scripts/logic/leveling.gd")

var gs: Object = null

var _layer: CanvasLayer
var _toasts: ToastLayer
var _karte: RueckkehrKarte
var _gap_ms := 0
var _karte_gezeigt := false


## Dienst erzeugen und an den Home-Entry hängen (idempotent, Gruppe).
static func attach_to(parent: Node, game_state: Object) -> RueckkehrService:
	var tree := parent.get_tree()
	if tree != null:
		var existing := tree.get_first_node_in_group(GROUP)
		if existing is RueckkehrService:
			return existing
	var service := RueckkehrService.new()
	service.name = "RueckkehrService"
	service.gs = game_state
	parent.add_child(service)
	return service


func _ready() -> void:
	add_to_group(GROUP)
	RueckkehrLogic.register_slice()
	_layer = CanvasLayer.new()
	_layer.name = "RueckkehrLayer"
	_layer.layer = 70
	add_child(_layer)
	_toasts = ToastLayer.new()
	_toasts.name = "RueckkehrToasts"
	_toasts.theme = ThemeService.theme()
	_toasts.set_anchors_preset(Control.PRESET_FULL_RECT)
	_toasts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_layer.add_child(_toasts)
	# Lücke JETZT lesen — GoobyReactions stempelt lastVisitAt beim ersten
	# Raum-Betreten neu (SoulState.touch_visit), danach wäre sie weg.
	_gap_ms = _luecke_vor_besuch()
	if gs is Node:
		var node := gs as Node
		if node.has_signal("slice_changed"):
			node.slice_changed.connect(_on_slice_changed)
		if node.has_signal("coins_changed"):
			node.coins_changed.connect(func(_coins: int) -> void: pruefe_und_belohne())
		if node.has_signal("stats_changed"):
			node.stats_changed.connect(func(_stats: Dictionary) -> void: pruefe_und_belohne())
	var timer := Timer.new()
	timer.wait_time = TICK_S
	timer.timeout.connect(pruefe_und_belohne)
	add_child(timer)
	timer.start()
	var router := get_node_or_null("/root/SceneRouter")
	if router != null and router.has_signal("travel_finished"):
		router.travel_finished.connect(_on_travel_finished)


## Prüft die sanfte Quest gegen die Live-Zähler und zahlt das
## Wiedersehens-Geschenk GENAU EINMAL (Claim-Gate in der Logik).
## Public — Tests rufen direkt.
func pruefe_und_belohne() -> void:
	if gs == null:
		return
	if not RueckkehrLogic.alles_fertig(_slice(), gs.state()):
		return
	var day := _heute()
	var result := {"ok": false, "muenzen": 0, "xp": 0}
	gs.update(
		func(s: Dictionary) -> void:
			var slice := _ensure_slice(s)
			# Dictionary-Capture (W13C-Muster): merge statt Reassignment.
			result.merge(RueckkehrLogic.belohnung_abschliessen(slice, s), true)
			if not bool(result["ok"]):
				return
			_zahle(s, int(result["muenzen"]), int(result["xp"]), day)
	)
	if not bool(result["ok"]):
		return
	gs.notify_slice_changed(RueckkehrLogic.SLICE_ID)
	_feiere(int(result["muenzen"]), int(result["xp"]))


## Erste Raum-Ankunft: ist die Karte fällig, federt sie nach einer kleinen
## Atempause herein. Ein offenes Tagesbonus-Popup weicht dabei von selbst
## (PanelStack-„Später") und wird nach dem Schließen wieder angeboten.
func _on_travel_finished(_target: Variant = null) -> void:
	if _karte_gezeigt or gs == null or not _ist_faellig():
		return
	_karte_gezeigt = true
	var tree := get_tree()
	if tree == null:
		return
	await tree.create_timer(KARTE_DELAY_S).timeout
	_zeige_karte()


func _ist_faellig() -> bool:
	var done := bool(gs.get_value("onboarding.done", false))
	return RueckkehrLogic.faellig(_slice(), _gap_ms, _now_ms(), done)


func _zeige_karte() -> void:
	if gs == null or _layer == null:
		return
	var tage := RueckkehrLogic.gap_tage(_gap_ms)
	var seed_text := "rueckkehr:%s:%d" % [_heute(), tage]
	var story_keys := RueckkehrLogic.geschichten(gs.state(), seed_text)
	gs.update(
		func(s: Dictionary) -> void:
			var slice := _ensure_slice(s)
			RueckkehrLogic.karte_starten(slice, s, _now_ms(), _gap_ms)
	)
	gs.notify_slice_changed(RueckkehrLogic.SLICE_ID)
	_karte = (load(KARTE_SCENE) as PackedScene).instantiate()
	_layer.add_child(_karte)
	(
		_karte
		. setup(
			{
				"tage": tage,
				"geschichten": story_keys,
				"aufgaben": RueckkehrLogic.fortschritt(_slice(), gs.state()),
				"muenzen": RueckkehrLogic.BELOHNUNG_MUENZEN,
				"xp": RueckkehrLogic.BELOHNUNG_XP,
			}
		)
	)
	_karte.closed.connect(_on_karte_zu)
	_karte.open()


## Nach dem Schließen darf der verdrängte Tagesbonus wieder anklopfen.
func _on_karte_zu() -> void:
	var hub := RewardHub.find(self)
	if hub != null:
		hub.reoffer_daily_bonus()


## Münzen + XP über die EINEN Pfade (Muster DailyQuestService._pay).
func _zahle(state: Dictionary, coins: int, xp: int, day: String) -> void:
	var econ: Dictionary = state.get("economy", {})
	if coins > 0:
		Economy.award(econ, coins, "rueckkehr", day)
	if xp <= 0:
		return
	var prog: Dictionary = state.get("progression", {})
	var res := Leveling.apply_xp(
		{"xp": float(prog.get("xp", 0.0)), "level": int(prog.get("level", 1))}, float(xp)
	)
	prog["xp"] = res["xp"]
	prog["level"] = res["level"]
	if int(res["coinsAwarded"]) > 0:
		Economy.award(econ, res["coinsAwarded"], "levelUp", day)


## Feier wie beim Quest-Bonus: Toast + Sticker-Pluck + Konfetti; Gooby
## jubelt None-sicher mit. Headless (ohne UI-Layer) bleibt sie still.
func _feiere(coins: int, xp: int) -> void:
	if _toasts == null or not is_instance_valid(_toasts):
		return
	_toasts.show_toast(I18nService.t("rueckkehr.fertig_toast", {"muenzen": coins, "xp": xp}))
	MusicDirector.try_duck(self)
	AudioDirector.try_play(self, "ui_sticker")
	var breite := 640.0
	var viewport := get_viewport()
	if viewport != null:
		breite = viewport.get_visible_rect().size.x
	RewardFx.konfetti_2d(_toasts, KONFETTI_TEILE, breite)
	SeeleRunner.kommentar_global("feier.erfolg")


func _on_slice_changed(slice_id: String, _data: Variant) -> void:
	if slice_id in ["achievements", "home", "minigames"]:
		pruefe_und_belohne()


## Besuchslücke VOR dem touch_visit-Stempel (0 ohne Vorbesuch).
func _luecke_vor_besuch() -> int:
	if gs == null:
		return 0
	var last := int(SoulState.slice_of(gs)["lastVisitAt"])
	if last <= 0:
		return 0
	return maxi(0, _now_ms() - last)


func _slice() -> Dictionary:
	return RueckkehrLogic.normalize_slice(gs.get_value(RueckkehrLogic.SLICE_ID, {}))


func _ensure_slice(state: Dictionary) -> Dictionary:
	state[RueckkehrLogic.SLICE_ID] = RueckkehrLogic.normalize_slice(
		state.get(RueckkehrLogic.SLICE_ID)
	)
	return state[RueckkehrLogic.SLICE_ID]


func _now_ms() -> int:
	if gs != null and "clock" in gs:
		return int(gs.clock.now_ms())
	return int(Time.get_unix_time_from_system() * 1000.0)


func _heute() -> String:
	if gs != null and "clock" in gs:
		return str(gs.clock.local_day())
	var date := Time.get_datetime_dict_from_system()
	return "%04d-%02d-%02d" % [int(date["year"]), int(date["month"]), int(date["day"])]
