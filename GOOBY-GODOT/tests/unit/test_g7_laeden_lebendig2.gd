extends TestCase
## G7-P55b „LÄDEN LEBENDIG, Teil 2“ — Wachen für den Rollout des Ort-
## Ambient-Systems (OrtLeben + KassenNpc) auf die restlichen Läden:
## GOOBYMAN, GOOBYTHEKE, POW!, Post und Autohaus bekommen Besucher samt
## Kassen-Verhalten, der Wochenmarkt bekommt Marktbummler (ohne Kasse).
## Dazu: Käufe piepen über den KassenNpc (eigene UND Basisklassen-Sheets),
## und jede neue Spruch-Domain existiert mit genug Zeilen (die DE/EN-
## Parität aller strings/*-Dateien prüft der W1c-String-Audit).

const GoobymanSzene := preload("res://scenes/city/orte/goobyman.tscn")
const GoobythekeSzene := preload("res://scenes/city/orte/goobytheke.tscn")
const PowSzene := preload("res://scenes/city/orte/pow.tscn")
const PostSzene := preload("res://scenes/city/orte/post.tscn")
const AutohausSzene := preload("res://scenes/city/orte/autohaus.tscn")
const WochenmarktSzene := preload("res://scenes/city/orte/wochenmarkt.tscn")

const SEED := 4711

## Neue Spruch-Domains dieser Welle ("markt" lag bereit, ist jetzt verdrahtet).
const NEUE_DOMAINS: Array[String] = ["drogerie", "apotheke", "pow", "post", "autohaus", "markt"]


## GameState-Double (Muster test_g7_ort_leben): dotted get + update-Pfad +
## slice_changed (der Wochenmarkt verbindet sich darauf).
class FakeGameState:
	extends RefCounted

	signal slice_changed(slice_id: String, data: Variant)

	var daten: Dictionary = {}

	func _init(start: Dictionary = {}) -> void:
		daten = start

	func state() -> Dictionary:
		return daten

	func get_value(path: String, fallback: Variant = null) -> Variant:
		var node: Variant = daten
		for part in path.split("."):
			if node is Dictionary and (node as Dictionary).has(part):
				node = node[part]
			else:
				return fallback
		return node

	func update(mutator: Callable) -> void:
		mutator.call(daten)

	func notify_slice_changed(slice_id: String) -> void:
		slice_changed.emit(slice_id, daten.get(slice_id))


func _basis_state() -> Dictionary:
	return {
		"economy": {"coins": 500},
		"inventory": {"items": {}, "food": {}},
		"city": {},
	}


## Ort mounten (Test-Hooks gesetzt, Ambient-Audio stumm) und ankommen lassen.
func _mount(szene: PackedScene) -> OrtScene:
	var ort: OrtScene = szene.instantiate()
	ort.game_state_override = FakeGameState.new(_basis_state())
	ort.leben_seed_override = SEED
	ort.leben_stumm_override = true
	tree.root.add_child(ort)
	await wait_frames(3)
	return ort


## Ort sauber abbauen (Muster test_g7_ort_leben: erst die Stimme entwerten,
## sonst hängt die Babble-Koroutine am SceneTreeTimer).
func _ort_abbauen(ort: OrtScene) -> void:
	if ort.voice != null and is_instance_valid(ort.voice):
		ort.voice.sagt("")
	await wait_frames(6)
	ort.queue_free()
	await wait_frames(2)


## Gemeinsame Erwartung eines lebendigen Ladens: OrtLeben hängt im Baum,
## spawnt die Besucherzahl, spricht die richtige Domain, hat die Kasse.
func _pruefe_leben(ort: OrtScene, besucher: int, domain: String, kasse: bool) -> void:
	var wer := str(ort.ort_id)
	assert_ne(ort.leben, null, "%s: OrtLeben hängt im Baum" % wer)
	if ort.leben == null:
		return
	assert_eq(ort.leben.besucher_nodes().size(), besucher, "%s: Ambient-Kunden" % wer)
	assert_eq(str(ort.leben.konfig.get("sprueche", "")), domain, "%s: Spruch-Domain" % wer)
	if kasse:
		# Alle Innen-Läden mit Kasse haben auch das Tür-Glöckchen.
		assert_true(bool(ort.leben.konfig.get("tuer_glocke", false)), "%s: Glöckchen" % wer)
		assert_ne(ort.kassen_npc, null, "%s: Haupt-NPC hat das Kassen-Verhalten" % wer)
		if ort.kassen_npc != null:
			assert_eq(ort.kassen_npc.rig, ort.rig, "%s: Kasse steuert den Haupt-NPC" % wer)
	else:
		assert_eq(ort.kassen_npc, null, "%s: bewusst ohne Kasse" % wer)


func test_goobyman_lebt() -> void:
	var ort := await _mount(GoobymanSzene)
	_pruefe_leben(ort, 3, "drogerie", true)
	await _ort_abbauen(ort)


func test_goobytheke_lebt() -> void:
	var ort := await _mount(GoobythekeSzene)
	_pruefe_leben(ort, 2, "apotheke", true)
	await _ort_abbauen(ort)


func test_pow_lebt() -> void:
	var ort := await _mount(PowSzene)
	_pruefe_leben(ort, 3, "pow", true)
	await _ort_abbauen(ort)


func test_post_lebt() -> void:
	var ort := await _mount(PostSzene)
	_pruefe_leben(ort, 2, "post", true)
	await _ort_abbauen(ort)


func test_autohaus_lebt() -> void:
	var ort := await _mount(AutohausSzene)
	_pruefe_leben(ort, 2, "autohaus", true)
	await _ort_abbauen(ort)


func test_wochenmarkt_bummelt_ohne_kasse() -> void:
	var ort := await _mount(WochenmarktSzene)
	_pruefe_leben(ort, 3, "markt", false)
	if ort.leben != null:
		assert_true(bool(ort.leben.konfig.get("gemurmel", false)), "Markt hat Gemurmel")
		assert_false(
			bool(ort.leben.konfig.get("tuer_glocke", false)), "kein Glöckchen unter freiem Himmel"
		)
	await _ort_abbauen(ort)


func test_eigenes_sheet_piept_an_der_kasse() -> void:
	# GOOBYMAN hat ein eigenes Händler-UI — sein Kauf-Handler muss die
	# Kasse quittieren lassen (Piep + Winken statt nur Winken).
	var ort: OrtGoobyman = await _mount(GoobymanSzene)
	assert_eq(ort.kassen_npc.piep_zaehler, 0, "noch kein Kunde")
	ort._on_gekauft("zahnbuerste_gut")
	assert_eq(ort.kassen_npc.piep_zaehler, 1, "GOOBYMAN-Kauf piept an der Kasse")
	assert_eq(ort.kassen_npc.letzte_aktion, "kassiert", "Kassen-Winken lief")
	await _ort_abbauen(ort)


func test_basis_sheet_piept_an_der_kasse() -> void:
	# GOOBYTHEKE nutzt das Basisklassen-Sheet: die Kauf-Quittung läuft über
	# OrtScene._on_kasse_kunde_zahlt (verdrahtet in oeffne_laden).
	var ort: OrtGoobytheke = await _mount(GoobythekeSzene)
	assert_eq(ort.kassen_npc.piep_zaehler, 0, "noch kein Kunde")
	ort._on_kasse_kunde_zahlt("gooby_tropfen")
	assert_eq(ort.kassen_npc.piep_zaehler, 1, "Basis-Laden-Kauf piept an der Kasse")
	await _ort_abbauen(ort)


func test_neue_spruch_domains_existieren() -> void:
	OrtLeben.reset_sprueche_fuer_tests()
	for domain in NEUE_DOMAINS:
		var key := "city_leben.sprueche.%s" % domain
		assert_true(I18nService.has_key(key), "Spruch-Domain fehlt: %s" % key)
		assert_true(I18nService.items(key).size() >= 4, "%s hat genug Zeilen" % key)
		assert_false(OrtLeben.naechster_spruch(domain).is_empty(), "%s: Spruch nie leer" % domain)
	OrtLeben.reset_sprueche_fuer_tests()
