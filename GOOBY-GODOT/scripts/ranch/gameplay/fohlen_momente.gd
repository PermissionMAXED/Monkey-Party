class_name RanchFohlenMomente
extends Node3D
## Fohlen-Momente (I-21, IDEAS-WELLE-I §3 Rang 1) — erster vertikaler
## Schnitt: Geburt/Aufstehen/erste Schritte als INSZENIERTE Momente auf
## dem Hof, samt Warte-Benachrichtigung (Star-Stable-Horses-Lehre aus
## RANCH-DLC-IDEAS-1 §2: Wachstum, auf das man wartet, erzeugt Zuneigung).
##
## Einbau wie der RanchEventHost (Duck-Typing-Vertrag der Hof-Szene:
## `game_state()`, `zeige_meldung()`, `event_anker()`):
##   RanchFohlenMomente.attach_to(hof_szene)   # nach dem Hof-Aufbau
##
## Der Host deckt den GANZEN Bogen ab:
##   1. Herz-Moment  — zwei zuchtreife Pferde stupsen sich, ein Tipp aufs
##      schwebende Herz startet die Trächtigkeit (RanchHorseBreeding).
##   2. Warte-Quest  — läuft eine Trächtigkeit, plant jeder Hof-Besuch die
##      positive Notification neu (Präfix `fohlen_`, Kategorie existiert in
##      notify_rules) und zeigt die Restzeit als Bubble (nie blockierend).
##   3. Geburt       — ist die Geburt fällig, wird das Fohlen ZUERST fest
##      in den Bestand geschrieben (Abbruch-sicher) und DANN choreografiert:
##      Geburt (liegend im Strohbett) → Aufstehen (wackelig) → erste
##      Schritte (zur Mama) → Namens-Taufe. Dialog-Zeilen als Bubbles,
##      Juice über Funkel-Puffs + Pferdelaute (RanchAudio) + Wackel-Tweens
##      (Reduced-Motion: keine Hopser, kürzere Beats).
##
## Zeit/Zufall IMMER injizierbar (now_ms_override/rng_override VOR
## add_child — Muster RanchEventHost); Tests fahren die Phasen mit
## choreo_auto=false über naechste_phase() deterministisch durch.

signal momente_fertig(fohlen_id: String)

const NOTIFY_PREFIX := "fohlen_"
const PHASE_KEINE := 0
const PHASE_GEBURT := 1
const PHASE_AUFSTEHEN := 2
const PHASE_SCHRITTE := 3
const PHASE_FERTIG := 4
## Beat-Längen (s) je Phase — Reduced-Motion nimmt die kurzen Werte.
const BEAT_S := {PHASE_GEBURT: 2.8, PHASE_AUFSTEHEN: 3.2, PHASE_SCHRITTE: 3.8}
const BEAT_REDUZIERT_S := 1.2
## Kuschelige Fohlen-Namen (Eigennamen, DE = EN); Duplikate im Bestand
## werden deterministisch übersprungen.
const NAMEN: Array[String] = [
	"Puschel",
	"Tapsi",
	"Wirbel",
	"Flauschi",
	"Keks",
	"Muffin",
	"Sternchen",
	"Hopser",
	"Fussel",
	"Kastanie",
	"Zimtschnecke",
	"Knuffel",
]
const STROH_FARBE := Color("#E8C97A")
const FUNKEL_ROSA := Color("#F9C6CF")
const FUNKEL_GOLD := Color("#F2B04C")
const HERZ_ROSA := Color("#F27E9D")
const TAP_UNSICHTBAR := Color(1, 1, 1, 0.02)
## Screen-Space-Fangradius fürs Herz (Muster RanchEventHost/G4).
const TAP_RADIUS_PT := 44.0

## Tests/Screenshots injizieren VOR add_child (Muster Hof-Szene).
var game_state_override: Object = null
var now_ms_override := -1
var rng_override: RandomNumberGenerator = null
## false = Tests treiben die Phasen selbst über naechste_phase().
var choreo_auto := true

var _scene: Node = null
var _gs: Object = null
var _phase := PHASE_KEINE
var _fohlen_id := ""
var _fohlen_name := ""
var _stute_name := ""
var _herz_paar: Array = []
var _herz: Node3D = null
var _tap_frame := -1
var _mutter_node: RanchPferd = null
var _fohlen_node: RanchPferd = null
var _rng := RandomNumberGenerator.new()


## Host an die Hof-Szene hängen (idempotent, Muster RanchEventHost).
static func attach_to(scene: Node) -> RanchFohlenMomente:
	var existing := scene.get_node_or_null("RanchFohlenMomente")
	if existing is RanchFohlenMomente:
		return existing
	var host := RanchFohlenMomente.new()
	host.name = "RanchFohlenMomente"
	scene.add_child(host)
	host.setup(scene)
	return host


## ---------------------------------------------------- PURE Kern-Logik


## Zucht-Slice aus dem Save (immer geheilt).
static func aktuelle_zucht(gs: Object) -> Dictionary:
	if gs == null:
		return RanchPlaySlices.default_zucht()
	return RanchPlaySlices.normalize_zucht(gs.get_value("ranch.zucht", {}))


## Erste fällige Geburt ("" = keine fällig).
static func naechste_geburt(gs: Object, now_ms: int) -> String:
	var zucht := aktuelle_zucht(gs)
	var ids: Array = (zucht["traechtigkeiten"] as Dictionary).keys()
	ids.sort()
	for stute_id: Variant in ids:
		if RanchHorseBreeding.geburt_bereit(zucht, str(stute_id), now_ms):
			return str(stute_id)
	return ""


## Laufende (noch nicht fällige) Trächtigkeiten: [{id, bereitAt}, …].
static func wartende_stuten(gs: Object, now_ms: int) -> Array:
	var zucht := aktuelle_zucht(gs)
	var t: Dictionary = zucht["traechtigkeiten"]
	var ids: Array = t.keys()
	ids.sort()
	var out: Array = []
	for stute_id: Variant in ids:
		var eintrag: Dictionary = t[stute_id]
		var bereit := (
			int(eintrag.get("startAt", 0))
			+ RanchHorseBreeding.dauer_ms(int(eintrag.get("checkpoints", 0)))
		)
		if bereit > now_ms:
			out.append({"id": str(stute_id), "bereitAt": bereit})
	return out


## Zuchtreifes Paar aus dem Bestand ([stute_id, hengst_id] oder []):
## deterministisch nach Bindung (dann Id) sortiert, Gates macht
## RanchHorseBreeding.zucht_erlaubt (Level/Bindung/Laune/Ruhezeit).
static func zucht_paar(gs: Object, now_ms: int) -> Array:
	var pferde := RanchState.pferde(gs)
	if pferde.size() < 2:
		return []
	var zucht := aktuelle_zucht(gs)
	var ids: Array = pferde.keys()
	ids.sort_custom(
		func(a: Variant, b: Variant) -> bool:
			var bind_a := float((pferde[a] as Dictionary).get("bindung", 0.0))
			var bind_b := float((pferde[b] as Dictionary).get("bindung", 0.0))
			if bind_a == bind_b:
				return str(a) < str(b)
			return bind_a > bind_b
	)
	for i in ids.size():
		for j in ids.size():
			if i == j:
				continue
			var stute: Dictionary = pferde[ids[i]]
			var hengst: Dictionary = pferde[ids[j]]
			var werte: Dictionary = stute.get("werte") if stute.get("werte") is Dictionary else {}
			var laune := RanchHorseCare.laune(werte, float(stute.get("bindung", 0.0)))
			var check := RanchHorseBreeding.zucht_erlaubt(
				str(ids[i]), stute, hengst, laune, zucht, now_ms
			)
			if bool(check["ok"]):
				return [str(ids[i]), str(ids[j])]
	return []


## Deterministischer Fohlen-Name aus dem Zucht-Seed; vergebene Namen
## werden übersprungen (Kollision im Bestand).
static func fohlen_name(seed_wert: int, vergeben: Array = []) -> String:
	var start := absi(hash("fohlenname|%d" % seed_wert)) % NAMEN.size()
	for schritt in NAMEN.size():
		var kandidat: String = NAMEN[(start + schritt) % NAMEN.size()]
		if not vergeben.has(kandidat):
			return kandidat
	return "%s %d" % [NAMEN[start], absi(seed_wert) % 100]


## Trächtigkeit starten (Herz-Moment bestätigt): Zucht-Slice schreiben +
## positive Warte-Notification planen. true = gestartet.
static func traechtigkeit_beginnen(
	gs: Object, stute_id: String, hengst_id: String, now_ms: int, seed_wert: int
) -> bool:
	var pferde := RanchState.pferde(gs)
	if gs == null or not pferde.has(stute_id) or not pferde.has(hengst_id):
		return false
	var zucht_neu := RanchHorseBreeding.traechtigkeit_starten(
		aktuelle_zucht(gs), stute_id, pferde[hengst_id], now_ms, seed_wert
	)
	gs.update(
		func(state: Dictionary) -> void:
			var ranch := RanchState.heile_slice(state)
			ranch["zucht"] = zucht_neu
	)
	gs.notify_slice_changed(RanchState.SLICE_ID)
	plane_benachrichtigung(gs, stute_id)
	return true


## Warte-Notification (Präfix `fohlen_`, Kategorie in notify_rules) —
## id-idempotent, jeder Hof-Besuch aktualisiert den Fertig-Zeitpunkt.
static func plane_benachrichtigung(gs: Object, stute_id: String) -> void:
	var zucht := aktuelle_zucht(gs)
	var t: Dictionary = zucht["traechtigkeiten"]
	if not (t.get(stute_id) is Dictionary):
		return
	var eintrag: Dictionary = t[stute_id]
	var bereit := (
		int(eintrag.get("startAt", 0))
		+ RanchHorseBreeding.dauer_ms(int(eintrag.get("checkpoints", 0)))
	)
	var stute := pferd_name(gs, stute_id)
	NotifyStub.schedule_local(
		NOTIFY_PREFIX + stute_id,
		I18nService.t("rpferd.fohlen.notify_titel"),
		I18nService.t("rpferd.fohlen.notify_text", {"stute": stute}),
		bereit
	)


## Fällige Geburt FEST committen (vor der Inszenierung — Abbruch-sicher):
## Fohlen würfeln (RanchHorseBreeding.gebaeren), taufen, in den Bestand
## schreiben, Zucht-Slice räumen, Notification einlösen.
## Ergebnis {} oder {"id", "pferd", "stuteName"}.
static func geburt_committen(gs: Object, stute_id: String, now_ms: int) -> Dictionary:
	var zucht := aktuelle_zucht(gs)
	var t: Dictionary = zucht["traechtigkeiten"]
	if not (t.get(stute_id) is Dictionary):
		return {}
	var seed_wert := int((t[stute_id] as Dictionary).get("seed", 0))
	var pferde := RanchState.pferde(gs)
	var mutter: Dictionary = pferde.get(stute_id) if pferde.get(stute_id) is Dictionary else {}
	var geburt := RanchHorseBreeding.gebaeren(zucht, stute_id, mutter, now_ms)
	if not bool(geburt["ok"]):
		return {}
	var fohlen: Dictionary = geburt["fohlen"]
	var vergeben: Array = []
	for pid: Variant in pferde:
		vergeben.append(str((pferde[pid] as Dictionary).get("name", "")))
	var taufname := fohlen_name(seed_wert, vergeben)
	var fohlen_id := "fohlen_%d" % now_ms
	var rekord := RanchPlaySlices.neues_pferd(taufname, str(fohlen.get("farbe", "braun")), fohlen)
	gs.update(
		func(state: Dictionary) -> void:
			var ranch := RanchState.heile_slice(state)
			var tiere: Dictionary = RanchPlaySlices.normalize_tiere(ranch.get("tiere"))
			(tiere["pferde"] as Dictionary)[fohlen_id] = rekord
			ranch["tiere"] = tiere
			ranch["zucht"] = geburt["zucht"]
	)
	gs.notify_slice_changed(RanchState.SLICE_ID)
	NotifyStub.cancel_local(NOTIFY_PREFIX + stute_id)
	return {"id": fohlen_id, "pferd": rekord, "stuteName": pferd_name(gs, stute_id)}


## Anzeigename eines Bestands-Pferds (leer → lokalisierter Mutter-Titel).
static func pferd_name(gs: Object, pferd_id: String) -> String:
	var pferde := RanchState.pferde(gs)
	var name := ""
	if pferde.get(pferd_id) is Dictionary:
		name = str((pferde[pferd_id] as Dictionary).get("name", ""))
	return name if name != "" else I18nService.t("rpferd.stammbaum.mutter")


## ---------------------------------------------------------- Host-Ablauf


## Einstieg nach dem Hof-Aufbau: Geburt fällig → inszenieren; sonst
## Warte-Hinweis + Notification; sonst Herz-Moment, wenn ein Paar reif ist.
func setup(scene: Node) -> void:
	_scene = scene
	_rng = rng_override if rng_override != null else RandomNumberGenerator.new()
	if rng_override == null:
		_rng.randomize()
	_gs = game_state_override
	if _gs == null and scene.has_method("game_state"):
		_gs = scene.game_state()
	if _gs == null:
		_gs = get_node_or_null("/root/GameState")
	if _gs == null or not RanchState.ist_gekauft(_gs):
		return
	var now_ms := _now_ms()
	var stute_id := naechste_geburt(_gs, now_ms)
	if stute_id != "":
		_starte_geburt(stute_id, now_ms)
		return
	var wartende := wartende_stuten(_gs, now_ms)
	if not wartende.is_empty():
		var erste: Dictionary = wartende[0]
		plane_benachrichtigung(_gs, str(erste["id"]))
		var rest := RQuestWarte.restzeit_text(int(erste["bereitAt"]) - now_ms)
		_melde(
			I18nService.t(
				"rpferd.fohlen.warte_bubble",
				{"stute": pferd_name(_gs, str(erste["id"])), "rest": rest}
			)
		)
		return
	var paar := zucht_paar(_gs, now_ms)
	if not paar.is_empty():
		_zeige_herz_moment(paar)


func ist_aktiv() -> bool:
	return _phase != PHASE_KEINE and _phase != PHASE_FERTIG


func phase() -> int:
	return _phase


## Herz-Moment von außen bestätigen (UI-Tap bzw. Tests).
func herz_bestaetigen() -> void:
	if _herz_paar.size() != 2 or _gs == null:
		return
	var now_ms := _now_ms()
	var ok := traechtigkeit_beginnen(
		_gs, str(_herz_paar[0]), str(_herz_paar[1]), now_ms, _rng.randi()
	)
	if not ok:
		return
	var rest := RQuestWarte.restzeit_text(RanchHorseBreeding.dauer_ms(0))
	_melde(
		I18nService.t(
			"rpferd.fohlen.herz_gestartet",
			{"stute": pferd_name(_gs, str(_herz_paar[0])), "rest": rest}
		)
	)
	_herz_paar = []
	if _herz != null and is_instance_valid(_herz):
		_funkel(_herz.position, FUNKEL_ROSA)
		# queue_free braucht einen Baum (Tests mounten ohne) — dort sofort.
		if _herz.is_inside_tree():
			_herz.queue_free()
		else:
			_herz.free()
	_herz = null
	_ton("freude")


## Nächsten Choreo-Beat zünden (Auto-Timer bzw. Tests). Reihenfolge:
## Geburt → Aufstehen → erste Schritte → Taufe/fertig.
func naechste_phase() -> void:
	match _phase:
		PHASE_GEBURT:
			_phase_aufstehen()
		PHASE_AUFSTEHEN:
			_phase_schritte()
		PHASE_SCHRITTE:
			_phase_taufe()
		_:
			pass


## ------------------------------------------------- Inszenierung intern


## Geburt committen (zuerst!) und den ersten Beat aufziehen.
func _starte_geburt(stute_id: String, now_ms: int) -> void:
	var mutter_daten: Dictionary = {}
	var pferde := RanchState.pferde(_gs)
	if pferde.get(stute_id) is Dictionary:
		mutter_daten = (pferde[stute_id] as Dictionary).duplicate(true)
	var ergebnis := geburt_committen(_gs, stute_id, now_ms)
	if ergebnis.is_empty():
		return
	_fohlen_id = str(ergebnis["id"])
	_fohlen_name = str((ergebnis["pferd"] as Dictionary).get("name", ""))
	_stute_name = str(ergebnis["stuteName"])
	_baue_geburts_buehne(mutter_daten, ergebnis["pferd"])
	_phase = PHASE_GEBURT
	_melde(I18nService.t("rpferd.fohlen.geburt", {"stute": _stute_name}))
	_funkel(_bett_pos() + Vector3(0.0, 0.6, 0.0), FUNKEL_ROSA)
	_ton("begruessung")
	_beat_planen(PHASE_GEBURT)


## Strohbett + Mutter + liegendes Fohlen an den Momente-Fleck stellen.
func _baue_geburts_buehne(mutter_daten: Dictionary, fohlen_daten: Dictionary) -> void:
	var bett := MeshInstance3D.new()
	var form := CylinderMesh.new()
	form.top_radius = 1.7
	form.bottom_radius = 1.9
	form.height = 0.14
	bett.mesh = form
	bett.material_override = RanchPferd.material(STROH_FARBE)
	bett.position = _bett_pos() + Vector3(0.0, 0.07, 0.0)
	add_child(bett)
	_mutter_node = RanchPferd.new()
	_mutter_node.position = _bett_pos() + Vector3(2.4, 0.0, -1.6)
	_mutter_node.rotation.y = 2.4
	add_child(_mutter_node)
	var mutter_ohne_bauch := mutter_daten.duplicate(true)
	mutter_ohne_bauch["traechtig"] = false
	_mutter_node.set_aussehen(mutter_ohne_bauch)
	_fohlen_node = RanchPferd.new()
	_fohlen_node.position = _bett_pos()
	_fohlen_node.rotation.y = -0.6
	add_child(_fohlen_node)
	_fohlen_node.set_aussehen(fohlen_daten)
	_fohlen_node.spiele_aktion("schlafen")


## Beat 2 — Aufstehen: wackelig hoch, Kopfschütteln, Schnauben.
func _phase_aufstehen() -> void:
	_phase = PHASE_AUFSTEHEN
	_melde(I18nService.t("rpferd.fohlen.aufstehen"))
	if _fohlen_node != null and is_instance_valid(_fohlen_node):
		_fohlen_node.spiele_aktion("kopfschuetteln")
		_wackel_tween(_fohlen_node)
	_funkel(_bett_pos() + Vector3(0.0, 1.0, 0.0), FUNKEL_ROSA)
	_ton("bindung")
	_beat_planen(PHASE_AUFSTEHEN)


## Beat 3 — erste Schritte: staksig zur Mama, die schüttelt liebevoll.
func _phase_schritte() -> void:
	_phase = PHASE_SCHRITTE
	_melde(I18nService.t("rpferd.fohlen.schritte"))
	if _fohlen_node != null and is_instance_valid(_fohlen_node):
		_fohlen_node.set_gangart(RanchPferd.GANG_SCHRITT)
		_schritte_tween(_fohlen_node)
	if _mutter_node != null and is_instance_valid(_mutter_node):
		_mutter_node.spiele_aktion("kopfschuetteln")
	_ton("freude")
	_beat_planen(PHASE_SCHRITTE)


## Beat 4 — Taufe: Name verkünden, Gold-Funkeln, Seele kommentiert.
func _phase_taufe() -> void:
	_phase = PHASE_FERTIG
	if _fohlen_node != null and is_instance_valid(_fohlen_node):
		_fohlen_node.set_gangart(RanchPferd.GANG_IDLE)
	_melde(I18nService.t("rpferd.fohlen.getauft", {"name": _fohlen_name}))
	_melde(I18nService.t("rpferd.fohlen.fertig", {"name": _fohlen_name}))
	_funkel(_fohlen_ziel() + Vector3(0.0, 1.2, 0.0), FUNKEL_GOLD)
	_ton("begruessung")
	SeeleRunner.kommentar_global("w13.ranch")
	momente_fertig.emit(_fohlen_id)


## ------------------------------------------------- Herz-Moment intern


## Schwebendes Tipp-Herz + Bubble über dem Kuschel-Fleck der Koppel.
func _zeige_herz_moment(paar: Array) -> void:
	_herz_paar = paar
	var a := pferd_name(_gs, str(paar[0]))
	var b := pferd_name(_gs, str(paar[1]))
	_melde(I18nService.t("rpferd.fohlen.herz_bubble", {"a": a, "b": b}))
	_herz = EventProps.make_prop(
		TAP_UNSICHTBAR,
		Vector3(1.5, 1.5, 1.5),
		herz_bestaetigen,
		false,
		func(_p: Node3D) -> void: _herz = null
	)
	_herz.position = _anker() + Vector3(-6.0, 2.1, 3.0)
	for teil: Array in [
		[Vector3(-0.24, 0.14, 0.0), Vector3(0.6, 0.6, 0.4)],
		[Vector3(0.24, 0.14, 0.0), Vector3(0.6, 0.6, 0.4)],
		[Vector3(0.0, -0.3, 0.0), Vector3(0.62, 0.62, 0.38)],
	]:
		var kugel := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.5
		mesh.height = 1.0
		kugel.mesh = mesh
		kugel.position = teil[0]
		kugel.scale = teil[1]
		kugel.material_override = RanchPferd.material(HERZ_ROSA)
		_herz.add_child(kugel)
	add_child(_herz)
	_herz_bob_tween()


## Sanftes Auf-und-ab-Schweben des Herzens (Reduced-Motion: statisch).
func _herz_bob_tween() -> void:
	if _herz == null or not is_inside_tree() or _reduziert():
		return
	var basis := _herz.position.y
	var tween := create_tween().set_loops()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(_herz, "position:y", basis + 0.3, 1.1)
	tween.tween_property(_herz, "position:y", basis, 1.1)


## ---------------------------------------------------- gemeinsame Helfer


## Momente-Fleck: neben dem Event-Anker der Hof-Szene (frei einsehbar).
func _anker() -> Vector3:
	if _scene != null and _scene.has_method("event_anker"):
		return _scene.event_anker()
	return Vector3.ZERO


func _bett_pos() -> Vector3:
	return _anker() + Vector3(-14.0, 0.0, 6.0)


## Ziel der ersten Schritte: dicht bei der Mama.
func _fohlen_ziel() -> Vector3:
	return _bett_pos() + Vector3(1.7, 0.0, -1.1)


func _melde(text: String) -> void:
	if _scene != null and _scene.has_method("zeige_meldung"):
		_scene.zeige_meldung(text)


## Funkel-Puff an einer Host-lokalen Position (der Host hängt am
## Szenen-Ursprung — Szene- und Host-Raum fallen zusammen).
func _funkel(pos: Vector3, color: Color) -> void:
	if is_inside_tree():
		EventProps.puff_at(self, pos, color)


func _ton(art: String) -> void:
	if is_inside_tree():
		RanchAudio.get_or_create(self).reaktion(art)


func _reduziert() -> bool:
	return is_inside_tree() and ThemeService.is_reduced_motion(self)


## Nächsten Beat per Timer planen (nur Auto-Choreo im Baum; Tests treiben
## naechste_phase() selbst).
func _beat_planen(aktuelle_phase: int) -> void:
	if not choreo_auto or not is_inside_tree():
		return
	var dauer := float(BEAT_S.get(aktuelle_phase, 2.0))
	if _reduziert():
		dauer = BEAT_REDUZIERT_S
	get_tree().create_timer(dauer).timeout.connect(naechste_phase)


## Wackeliges Aufstehen: kleiner Hopser + Seiten-Wackler (nur im Baum,
## Reduced-Motion überspringt die Bewegung komplett).
func _wackel_tween(ziel: Node3D) -> void:
	if not is_inside_tree() or _reduziert():
		return
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(ziel, "rotation:z", 0.22, 0.5)
	tween.tween_property(ziel, "rotation:z", -0.14, 0.45)
	tween.tween_property(ziel, "rotation:z", 0.0, 0.4)
	tween.parallel().tween_property(ziel, "position:y", 0.16, 0.4)
	tween.tween_property(ziel, "position:y", 0.0, 0.35)


## Erste Schritte als weicher Bogen zur Mama (Reduced-Motion: Sprung ans
## Ziel ohne Wackler).
func _schritte_tween(ziel: Node3D) -> void:
	if not is_inside_tree() or _reduziert():
		ziel.position = _fohlen_ziel()
		return
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(ziel, "position", _fohlen_ziel(), 3.2)
	tween.parallel().tween_property(ziel, "rotation:z", 0.1, 0.8)
	tween.tween_property(ziel, "rotation:z", 0.0, 0.6)


## ------------------------- Tap-Forgiveness (Muster RanchEventHost/G4)


## 44-pt-Fangradius fürs Herz: läuft VOR dem Physics-Picking; der
## Area3D-Direkt-Treffer von EventProps bleibt als Fallback erhalten.
func _unhandled_input(event: InputEvent) -> void:
	if _herz == null or not is_instance_valid(_herz) or not _herz.is_inside_tree():
		return
	var pos := _tap_position(event)
	if pos.x < 0.0:
		return
	var frame := Engine.get_process_frames()
	if frame == _tap_frame:
		return
	var vp := get_viewport()
	var cam := vp.get_camera_3d() if vp != null else null
	if cam == null or cam.is_position_behind(_herz.global_position):
		return
	var radius := TAP_RADIUS_PT * UiScale.touch_px_per_pt(vp)
	if cam.unproject_position(_herz.global_position).distance_to(pos) > radius:
		return
	_tap_frame = frame
	vp.set_input_as_handled()
	herz_bestaetigen()


func _tap_position(event: InputEvent) -> Vector2:
	var touch := event as InputEventScreenTouch
	if touch != null and touch.pressed:
		return touch.position
	var maus := event as InputEventMouseButton
	if maus != null and maus.pressed and maus.button_index == MOUSE_BUTTON_LEFT:
		return maus.position
	return Vector2(-1.0, -1.0)


func _now_ms() -> int:
	if now_ms_override >= 0:
		return now_ms_override
	if _gs != null:
		var clock: Variant = _gs.get("clock")
		if clock is Object and (clock as Object).has_method("now_ms"):
			return int(clock.now_ms())
	return int(Time.get_unix_time_from_system() * 1000.0)
