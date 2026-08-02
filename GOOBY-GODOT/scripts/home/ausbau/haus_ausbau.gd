class_name HausAusbau
extends RefCounted
## Haus-Ausbau-Logik (I-07, Welle K / Doc D §4.1): Keller, Zweite Etage und
## Balkon sind kaufbare Räume (rooms.json trägt `price` + `requires`).
## PURE + headless-testbar — hier lebt NUR die Daten-/Kauf-Seite; die
## Szenen-Seite (Bauplan-Portal, Kauf-Karte, Bau-Gag) wohnt in
## haus_ausbau_flow.gd. Geld läuft ausschließlich über EconomyLogic.spend,
## der Kauf schaltet den Raum in home.unlockedRooms frei und merkt sich die
## Einweihungs-Feier als home.flags-Eintrag (crash-sicher: erst Save, dann
## Inszenierung — wie bei den Fohlen-Momenten).

const EconomyLogic := preload("res://scripts/logic/economy.gd")

const FEIER_PREFIX := "ausbauFeier_"


## Alle kaufbaren Ausbau-Räume (rooms.json price > 0), sortiert.
static func ausbau_ids() -> Array:
	var out: Array = []
	for room_id: String in RoomDefs.ids():
		if ist_ausbau(room_id):
			out.append(room_id)
	return out


static func ist_ausbau(room_id: String) -> bool:
	return preis(room_id) > 0


static func preis(room_id: String) -> int:
	return int(RoomDefs.room(room_id).get("price", 0))


## Voraussetzungs-Räume (rooms.json `requires`), z. B. Balkon → floor2.
static func voraussetzungen(room_id: String) -> Array:
	var raw: Variant = RoomDefs.room(room_id).get("requires", [])
	return raw if raw is Array else []


static func ist_gekauft(gs: Object, room_id: String) -> bool:
	return gs != null and HomeState.is_room_unlocked(gs, room_id)


## Erste fehlende Voraussetzung ("" = alle erfüllt).
static func fehlende_voraussetzung(gs: Object, room_id: String) -> String:
	for noetig: Variant in voraussetzungen(room_id):
		if not ist_gekauft(gs, str(noetig)):
			return str(noetig)
	return ""


static func fehlende_muenzen(gs: Object, room_id: String) -> int:
	var muenzen := int(gs.get_value("economy.coins", 0)) if gs != null else 0
	return maxi(0, preis(room_id) - muenzen)


static func kann_kaufen(gs: Object, room_id: String) -> bool:
	if gs == null or not ist_ausbau(room_id) or ist_gekauft(gs, room_id):
		return false
	if fehlende_voraussetzung(gs, room_id) != "":
		return false
	return fehlende_muenzen(gs, room_id) == 0


## Kauft den Ausbau: Münzen über den EINEN Geld-Pfad, Raum in
## unlockedRooms, Feier-Flag für die Einweihung. false = nicht kaufbar.
static func kaufen(gs: Object, room_id: String) -> bool:
	if not kann_kaufen(gs, room_id):
		return false
	var preis_wert := preis(room_id)
	var ok := [false]
	gs.update(
		func(state: Dictionary) -> void:
			var econ: Dictionary = state["economy"]
			if not EconomyLogic.spend(econ, preis_wert, "haus_ausbau_%s" % room_id):
				return
			var home: Dictionary = state[HomeState.SLICE_ID]
			var unlocked: Array = home.get("unlockedRooms", [])
			if not unlocked.has(room_id):
				unlocked.append(room_id)
			home["unlockedRooms"] = unlocked
			var flags: Dictionary = home.get("flags", {})
			flags[FEIER_PREFIX + room_id] = true
			home["flags"] = flags
			ok[0] = true
	)
	gs.notify_slice_changed(HomeState.SLICE_ID)
	return ok[0]


## Ist die Tür begehbar/gebaut? Türen zu Nicht-Ausbau-Räumen sind immer
## frei; Ausbau-Ziele erst nach Kauf (ohne GameState: gesperrt).
static func tuer_frei(gs: Object, door_def: Dictionary) -> bool:
	var ziel := str(door_def.get("to", ""))
	if not ist_ausbau(ziel):
		return true
	return ist_gekauft(gs, ziel)


## Wand-Tür-Spannen NUR der freigeschalteten Türen — RoomBase schneidet
## damit die Wand-Öffnungen (gesperrte Ausbauten bleiben zugemauert; die
## Grid-Blockade nimmt weiterhin ALLE Türen, s. RoomDefs.wall_door_spans).
static func offene_tuer_spans(gs: Object, room_def: Dictionary) -> Dictionary:
	var spans := {}
	for door_def: Dictionary in room_def.get("doors", []):
		if not tuer_frei(gs, door_def):
			continue
		var wall := str(door_def.get("wall", "N"))
		if not spans.has(wall):
			spans[wall] = []
		var offset := int(door_def.get("offset", 0))
		spans[wall].append([offset, offset + RoomDefs.DOOR_WIDTH])
	return spans


## Taucht der Raum in Raum-Listen auf (Gestalten-Chips usw.)?
static func raum_sichtbar(gs: Object, room_id: String) -> bool:
	return not ist_ausbau(room_id) or ist_gekauft(gs, room_id)


## Alle Raum-Ids für UI-Listen — gesperrte Ausbauten bleiben unsichtbar,
## bis sie gekauft sind (I-07: kein „Geisterraum" in den Gestalten-Chips).
static func sichtbare_raum_ids(gs: Object) -> Array:
	var out: Array = []
	for room_id: String in RoomDefs.ids():
		if raum_sichtbar(gs, room_id):
			out.append(room_id)
	return out


## Einweihungs-Feier fällig? (Kauf gelaufen, Inszenierung noch nicht.)
static func feier_faellig(gs: Object, room_id: String) -> bool:
	return gs != null and HomeState.flag(gs, FEIER_PREFIX + room_id)


static func feier_abgeholt(gs: Object, room_id: String) -> void:
	HomeState.set_flag(gs, FEIER_PREFIX + room_id, false)
