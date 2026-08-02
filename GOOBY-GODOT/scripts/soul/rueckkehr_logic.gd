class_name RueckkehrLogic
extends RefCounted
## Rückkehrer-Karte (Welle J / Idee I-44): kommt der Spieler nach ≥ 7 Tagen
## Pause zurück, erzählt Gooby EINMAL „Was bisher geschah" — kleine
## Geschichten, deterministisch aus dem ECHTEN Spielstand gewählt — und
## startet eine sanfte Wieder-Einstiegs-Quest (streicheln, füttern, eine
## Arcade-Runde; ohne Zeitdruck, ohne FOMO). Sind alle drei Momente
## passiert, zahlt der Service einmalig das Wiedersehens-Geschenk.
##
## PURE Statics (Muster SoulState/DailyQuestEngine): Zeit/Seed werden
## hereingereicht, Zufall läuft deterministisch über den mulberry32-Port
## der DailyQuestEngine — headless testbar, keine OS-Uhr, kein randomize().
##
## Save-Slice `rueckkehr` (additiv über die SaveSchema-Registry):
##   {shownAt, count, quest: {aktiv, claimed, startedAt, tage, base}}

const SaveSchema := preload("res://scripts/state/save_schema.gd")

const SLICE_ID := "rueckkehr"

## Ab dieser Lücke gilt der Besuch als „Rückkehr" (I-44: ≥ 7 Tage Pause).
const MIN_GAP_MS := 7 * SoulTriggers.MS_PER_DAY
## Wie viele Geschichten die Karte erzählt.
const GESCHICHTEN_ANZAHL := 3
## Höchstens so viele zustandsabhängige Geschichten — mindestens eine
## „immer"-Geschichte bleibt drin (der Warte-am-Fenster-Ton der Karte).
const MAX_SPEZIAL := 2
## Wiedersehens-Geschenk nach der sanften Quest.
const BELOHNUNG_MUENZEN := 120
const BELOHNUNG_XP := 40

static var _registered := false


## Idempotent — der Service ruft das beim Attach (Muster SoulState); alte
## Saves ohne Slice heilen über normalize_slice beim ersten Zugriff.
static func register_slice() -> void:
	if _registered:
		return
	_registered = true
	SaveSchema.register_slice(SLICE_ID, default_slice, normalize_slice)


static func default_slice() -> Dictionary:
	return {"shownAt": 0, "count": 0, "quest": {}}


## Self-Heal (Web-mergeDefaults-Stil): kaputte Typen fallen auf Defaults.
static func normalize_slice(raw: Variant) -> Dictionary:
	var slice: Dictionary = raw if raw is Dictionary else {}
	var out := default_slice()
	out["shownAt"] = maxi(0, int(_num(slice.get("shownAt"))))
	out["count"] = maxi(0, int(_num(slice.get("count"))))
	var quest: Variant = slice.get("quest")
	if quest is Dictionary and not (quest as Dictionary).is_empty():
		var q: Dictionary = quest
		var base := {}
		if q.get("base") is Dictionary:
			base = (q["base"] as Dictionary).duplicate(true)
		out["quest"] = {
			"aktiv": _ist_wahr(q.get("aktiv")),
			"claimed": _ist_wahr(q.get("claimed")),
			"startedAt": maxi(0, int(_num(q.get("startedAt")))),
			"tage": maxi(0, int(_num(q.get("tage")))),
			"base": base,
		}
	return out


## Ist die Karte JETZT fällig? Nur nach echter Lücke, nur nach Onboarding,
## und nie doppelt für dieselbe Abwesenheit (shownAt-Wache: seit der
## letzten Karte muss wieder eine volle Lücke liegen).
static func faellig(slice: Dictionary, gap_ms: int, now_ms: int, onboarding_done: bool) -> bool:
	if not onboarding_done or gap_ms < MIN_GAP_MS:
		return false
	var shown_at := int(_num(slice.get("shownAt")))
	return shown_at <= 0 or now_ms - shown_at >= MIN_GAP_MS


## Abwesenheit in ganzen Tagen (für die Karten-Texte, nie unter 1).
static func gap_tage(gap_ms: int) -> int:
	return maxi(1, int(float(gap_ms) / float(SoulTriggers.MS_PER_DAY)))


## Geschichten-Pool: `wenn` ist eine benannte Zustands-Bedingung
## (_wenn_erfuellt); „immer"-Einträge sind die Rückfaller, damit die Karte
## NIE leer ist. Texte: rueckkehr.story.<id> (de+en).
static func geschichten_pool() -> Array[Dictionary]:
	return [
		{"id": "fenster", "wenn": "immer"},
		{"id": "kissen", "wenn": "immer"},
		{"id": "staub", "wenn": "immer"},
		{"id": "garten", "wenn": "garten"},
		{"id": "ranch", "wenn": "ranch"},
		{"id": "ball", "wenn": "ball"},
		{"id": "kuehlschrank", "wenn": "kuehlschrank"},
		{"id": "radio", "wenn": "radio"},
		{"id": "fotos", "wenn": "fotos"},
		{"id": "arcade", "wenn": "arcade"},
	]


## Die Geschichten der Karte: deterministisch aus dem ECHTEN Spielstand —
## erst bis zu MAX_SPEZIAL zustandsabhängige, aufgefüllt mit „immer"-
## Rückfallern. Gleicher Seed-Text ⇒ gleiche Auswahl (Test-Vertrag).
static func geschichten(state: Dictionary, seed_text: String) -> Array[String]:
	var rng := {"a": DailyQuestEngine.hash32(seed_text)}
	var spezial: Array[Dictionary] = []
	var immer: Array[Dictionary] = []
	for def: Dictionary in geschichten_pool():
		if str(def["wenn"]) == "immer":
			immer.append(def)
		elif _wenn_erfuellt(state, str(def["wenn"])):
			spezial.append(def)
	var gewaehlt := _ziehe(rng, spezial, MAX_SPEZIAL)
	gewaehlt.append_array(_ziehe(rng, immer, GESCHICHTEN_ANZAHL))
	var out: Array[String] = []
	for def: Dictionary in gewaehlt:
		if out.size() >= GESCHICHTEN_ANZAHL:
			break
		out.append("rueckkehr.story." + str(def["id"]))
	return out


## Die sanfte Wieder-Einstiegs-Quest: drei kleine Momente, gemessen über
## die VORHANDENEN Zähler (DailyQuestEngine-Messungen — kein zweites
## Zählwerk). Texte: rueckkehr.aufgabe.<id>; `icon` fürs Karten-Layout.
static func quest_defs() -> Array[Dictionary]:
	return [
		{"id": "rk_streicheln", "ziel": 3, "icon": "fun", "messung": {"typ": "streicheln_heute"}},
		{
			"id": "rk_fuettern",
			"ziel": 1,
			"icon": "hunger",
			"messung": {"typ": "counter", "key": "feeds"},
		},
		{"id": "rk_spielen", "ziel": 1, "icon": "gamepad", "messung": {"typ": "spiele_gesamt"}},
	]


## Buchhaltung beim Zeigen der Karte: Stempel + Quest-Start mit
## eingefrorenen Zähler-Baselines (Fortschritt zählt ab JETZT). Mutiert
## `slice` in place — innerhalb von GameState.update aufrufen.
static func karte_starten(slice: Dictionary, state: Dictionary, now_ms: int, gap_ms: int) -> void:
	slice["shownAt"] = now_ms
	slice["count"] = int(_num(slice.get("count"))) + 1
	var base := {}
	for def: Dictionary in quest_defs():
		base[str(def["id"])] = DailyQuestEngine.baseline_of(def, state)
	slice["quest"] = {
		"aktiv": true,
		"claimed": false,
		"startedAt": now_ms,
		"tage": gap_tage(gap_ms),
		"base": base,
	}


static func quest_aktiv(slice: Dictionary) -> bool:
	var quest: Variant = slice.get("quest")
	if not (quest is Dictionary):
		return false
	var q: Dictionary = quest
	return _ist_wahr(q.get("aktiv")) and not _ist_wahr(q.get("claimed"))


## Anzeigefertige Zeilen [{def, progress, target, complete}] — Messung
## läuft über DailyQuestEngine.progress_of gegen die Baselines.
static func fortschritt(slice: Dictionary, state: Dictionary) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var quest: Dictionary = slice.get("quest") if slice.get("quest") is Dictionary else {}
	var base: Dictionary = quest.get("base") if quest.get("base") is Dictionary else {}
	for def: Dictionary in quest_defs():
		var entry := {"id": str(def["id"]), "base": base.get(str(def["id"]), {})}
		var target := DailyQuestEngine.target_of(def)
		var progress := DailyQuestEngine.progress_of(entry, def, state)
		out.append(
			{"def": def, "progress": progress, "target": target, "complete": progress >= target}
		)
	return out


static func alles_fertig(slice: Dictionary, state: Dictionary) -> bool:
	if not quest_aktiv(slice):
		return false
	for row: Dictionary in fortschritt(slice, state):
		if not bool(row["complete"]):
			return false
	return true


## Wiedersehens-Geschenk abschließen (idempotent): markiert die Quest als
## bezahlt und liefert die Beträge — die Auszahlung (Economy/Leveling)
## macht der Aufrufer im SELBEN gs.update (Muster DailyQuestEngine.claim).
static func belohnung_abschliessen(slice: Dictionary, state: Dictionary) -> Dictionary:
	if not alles_fertig(slice, state):
		return {"ok": false, "muenzen": 0, "xp": 0}
	var quest: Dictionary = slice["quest"]
	quest["aktiv"] = false
	quest["claimed"] = true
	return {"ok": true, "muenzen": BELOHNUNG_MUENZEN, "xp": BELOHNUNG_XP}


## Nur für Tests.
static func reset_for_tests() -> void:
	_registered = false


# ── intern ────────────────────────────────────────────────────────────────────


## Benannte Zustands-Bedingung eines Geschichten-Defs gegen den Save.
static func _wenn_erfuellt(state: Dictionary, wenn: String) -> bool:
	var ok := wenn == "immer"
	if wenn == "garten":
		ok = _garten_aktiv(state)
	elif wenn == "ranch":
		ok = _ist_wahr(_dig(state, ["ranch", "gekauft"], false))
	elif wenn == "ball":
		ok = _counter(state, "balls") > 0
	elif wenn == "kuehlschrank":
		ok = _counter(state, "feeds") > 0
	elif wenn == "radio":
		ok = _ist_wahr(_dig(state, ["radio", "owned"], false))
	elif wenn == "fotos":
		ok = (
			_ist_wahr(_dig(state, ["camera", "owned"], false))
			or int(_num(_dig(state, ["profile", "photos"], 0))) > 0
		)
	elif wenn == "arcade":
		ok = not _plays(state).is_empty()
	return ok


static func _garten_aktiv(state: Dictionary) -> bool:
	if _counter(state, "harvests") + _counter(state, "plantings") > 0:
		return true
	var grid: Variant = _dig(state, ["garden", "grid"], [])
	if grid is Array:
		for plot: Variant in grid:
			if plot is Dictionary and (plot as Dictionary).get("crop") != null:
				return true
	return false


## `anzahl` Defs deterministisch ohne Zurücklegen ziehen (mulberry32-Draws
## über DailyQuestEngine.rand_next — eine Zufallsquelle für alles).
static func _ziehe(rng: Dictionary, pool: Array[Dictionary], anzahl: int) -> Array[Dictionary]:
	var rest := pool.duplicate()
	var out: Array[Dictionary] = []
	while out.size() < anzahl and not rest.is_empty():
		var idx := int(DailyQuestEngine.rand_next(rng) * rest.size()) % rest.size()
		out.append(rest[idx])
		rest.remove_at(idx)
	return out


static func _plays(state: Dictionary) -> Dictionary:
	var plays: Variant = _dig(state, ["minigames", "plays"], {})
	return plays if plays is Dictionary else {}


static func _counter(state: Dictionary, key: String) -> int:
	return int(_num(_dig(state, ["achievements", "counters", key], 0)))


static func _dig(data: Variant, path: Array, fallback: Variant) -> Variant:
	var current: Variant = data
	for part: String in path:
		if not (current is Dictionary) or not current.has(part):
			return fallback
		current = current[part]
	return current


## Web-`=== true`-Äquivalent: nur ein echtes bool true zählt.
static func _ist_wahr(value: Variant) -> bool:
	return value is bool and value


static func _num(value: Variant) -> float:
	if value is int or value is float:
		return float(value)
	return 0.0
