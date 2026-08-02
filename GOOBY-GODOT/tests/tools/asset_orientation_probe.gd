extends SceneTree
## Asset-Orientierungs-Probe (UserFeedback: „sicherstellen, dass alle Assets
## immer richtig rotiert sind und richtig herum stehen").
##
## KEIN Test — druckt einen vollständigen Orientierungs-Report über ALLE
## .glb/.gltf unter res://assets:
##   MIRROR  — ein Knoten im Asset hat eine gespiegelte Basis (det < 0);
##             kaputte Normalen/Culling, IMMER ein Fehler.
##   NAN     — Transform enthält NaN/Inf.
##   LIEGT   — Asset einer „aufrecht"-Klasse (Baum, Laterne, Gebäude …) ist
##             flacher als breit → vermutlich Z-up-Export oder verdrehte Wurzel.
##   HOCHKANT— Asset einer „flach"-Klasse (Straße, Weg …) ist höher als lang
##             → vermutlich um 90° gekippt.
##   PITCHED — die Wurzel-Kinder tragen gebackene X/Z-Rotationen, die KEIN
##             Vielfaches von 90° sind (krummer Export). Nur informativ.
##
## Aufruf (Repo-Wurzel, Import-Cache muss existieren):
##   godot --headless --path GOOBY-GODOT \
##     --script res://tests/tools/asset_orientation_probe.gd
## Exit-Code: 1 bei harten Fehlern (MIRROR/NAN/lädt nicht), sonst 0.

## Dateiname enthält eines dieser Wörter → Asset soll AUFRECHT stehen
## (Höhe >= TALL_FAKTOR × größte Grundfläche-Kante).
const TALL_KEYS: Array[String] = [
	"tree",
	"baum",
	"streetlight",
	"lantern",
	"laterne",
	"lamp",
	"light-curved",
	"light-square",
	"fountain",
	"brunnen",
	"hydrant",
	"tower",
	"turm",
	"windmuehle",
	"silo",
	"cactus",
	"kaktus",
	"scheune",
	"building",
	"gebaeude",
]
## Dateiname enthält eines dieser Wörter → Asset soll FLACH liegen
## (Höhe <= FLAT_FAKTOR × größte Grundfläche-Kante).
const FLAT_KEYS: Array[String] = [
	"road-",
	"road_",
	"path-",
	"path_",
	"driveway",
	"teppich",
	"rug",
]
## Aufrecht: Höhe muss mindestens das 0,55-Fache der größten Fußabdruck-Kante
## sein (Baumkronen sind breit — ein GEKIPPTER Baum fällt trotzdem unter 0,55).
const TALL_FAKTOR := 0.55
## Flach: Höhe darf höchstens das 0,6-Fache der längsten Kante sein.
const FLAT_FAKTOR := 0.6
## Bewusste Ausnahmen (Pfad-Suffix → Begründung) — hier NUR eintragen, wenn
## das Asset nachweislich richtig herum steht (Screenshot/Szene geprüft;
## Belege: docs/godot-rewrite/ASSET-ORIENTATION.md §4).
const AUSNAHMEN := {
	"city/natur/tree_blocks.glb": "Klotz-Baum: Krone breiter als hoch, steht korrekt",
	"ranch/natur/tree_blocks_fall.glb": "Klotz-Baum (Herbst), wie tree_blocks",
	"city/gebaeude/building-e.glb": "breites 2-Etagen-Flachdach-Haus, steht korrekt",
	"furniture/lampWall.glb": "Wandlampe: Schirm ragt bauartbedingt flach aus der Wand",
	"furniture/tt-park/fountain.gltf": "flacher Becken-Brunnen (tiny treats), steht korrekt",
	"minigames/carrot_catch/mpb/fountain.gltf": "gleicher Becken-Brunnen, Kopie im Kit",
	"minigames/hide_seek/tinytreats/fountain.gltf": "gleicher Becken-Brunnen, Kopie im Kit",
}


func _initialize() -> void:
	_lauf.call_deferred()


func _lauf() -> void:
	var pfade: Array[String] = []
	_sammle_modelle("res://assets", pfade)
	pfade.sort()
	var harte_fehler := 0
	var warnungen := 0
	print("== Asset-Orientierungs-Probe: %d Modelle ==" % pfade.size())
	for pfad in pfade:
		var befunde := _pruefe_asset(pfad)
		for befund: Dictionary in befunde:
			if bool(befund["hart"]):
				harte_fehler += 1
			else:
				warnungen += 1
			print("%s %s -> %s" % [str(befund["art"]).rpad(8), pfad, befund["detail"]])
	print(
		(
			"== Ergebnis: %d Modelle, %d harte Fehler, %d Warnungen =="
			% [pfade.size(), harte_fehler, warnungen]
		)
	)
	quit(1 if harte_fehler > 0 else 0)


func _sammle_modelle(wurzel: String, out: Array[String]) -> void:
	var dir := DirAccess.open(wurzel)
	if dir == null:
		return
	dir.list_dir_begin()
	var eintrag := dir.get_next()
	while eintrag != "":
		var pfad := wurzel + "/" + eintrag
		if dir.current_is_dir():
			if not eintrag.begins_with("."):
				_sammle_modelle(pfad, out)
		elif eintrag.get_extension() in ["glb", "gltf"]:
			out.append(pfad)
		eintrag = dir.get_next()
	dir.list_dir_end()


func _pruefe_asset(pfad: String) -> Array:
	var befunde: Array = []
	var szene: PackedScene = load(pfad)
	if szene == null:
		befunde.append({"art": "LAEDTNIE", "hart": true, "detail": "PackedScene lädt nicht"})
		return befunde
	var node: Node = szene.instantiate()
	if node == null:
		befunde.append({"art": "LAEDTNIE", "hart": true, "detail": "instantiate() == null"})
		return befunde
	var mess := {"aabb": AABB(), "erster": true, "mirror": 0, "nan": 0, "pitched": []}
	_vermesse(node, Transform3D.IDENTITY, node, mess)
	node.free()
	if int(mess["nan"]) > 0:
		befunde.append(
			{"art": "NAN", "hart": true, "detail": "%d Knoten mit NaN/Inf" % int(mess["nan"])}
		)
	if int(mess["mirror"]) > 0:
		(
			befunde
			. append(
				{
					"art": "MIRROR",
					"hart": true,
					"detail": "%d Knoten mit gespiegelter Basis (det < 0)" % int(mess["mirror"]),
				}
			)
		)
	var groesse: Vector3 = (mess["aabb"] as AABB).size
	if bool(mess["erster"]) or groesse.length() < 0.0001:
		return befunde
	var fuss := maxf(groesse.x, groesse.z)
	var laengste := maxf(fuss, groesse.y)
	var ausnahme := _ausnahme_fuer(pfad)
	if ausnahme == "" and _hat_key(pfad, TALL_KEYS) and groesse.y < fuss * TALL_FAKTOR:
		(
			befunde
			. append(
				{
					"art": "LIEGT",
					"hart": false,
					"detail":
					(
						"aufrecht-Klasse, aber Höhe %.2f < %.2f×%.2f (size=%s)"
						% [groesse.y, TALL_FAKTOR, fuss, groesse]
					),
				}
			)
		)
	if ausnahme == "" and _hat_key(pfad, FLAT_KEYS) and groesse.y > laengste * FLAT_FAKTOR:
		(
			befunde
			. append(
				{
					"art": "HOCHKANT",
					"hart": false,
					"detail":
					(
						"flach-Klasse, aber Höhe %.2f > %.2f×%.2f (size=%s)"
						% [groesse.y, FLAT_FAKTOR, laengste, groesse]
					),
				}
			)
		)
	var pitched: Array = mess["pitched"]
	if not pitched.is_empty():
		(
			befunde
			. append(
				{
					"art": "PITCHED",
					"hart": false,
					"detail": "krumme gebackene X/Z-Rotation: %s" % str(pitched.slice(0, 4)),
				}
			)
		)
	return befunde


func _vermesse(node: Node, xform: Transform3D, wurzel: Node, mess: Dictionary) -> void:
	var lokal := xform
	if node is Node3D:
		var t := (node as Node3D).transform
		lokal = xform * t
		if not t.basis.determinant() > 0.0:
			if _ist_endlich(t):
				mess["mirror"] = int(mess["mirror"]) + 1
		if not _ist_endlich(t):
			mess["nan"] = int(mess["nan"]) + 1
		# Gebackene Pitch/Roll-Winkel, die kein 90°-Raster sind (nur direkte
		# Wurzel-Kinder — tiefere Knoten sind Detailgeometrie des Kits).
		if node.get_parent() == wurzel:
			var rot := t.basis.get_euler()
			for winkel: float in [rot.x, rot.z]:
				var grad := absf(rad_to_deg(winkel))
				var rest := fmod(grad, 90.0)
				if rest > 2.0 and rest < 88.0:
					(mess["pitched"] as Array).append("%s: %.1f°" % [node.name, grad])
	if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
		var box: AABB = lokal * (node as MeshInstance3D).mesh.get_aabb()
		if bool(mess["erster"]):
			mess["aabb"] = box
			mess["erster"] = false
		else:
			mess["aabb"] = (mess["aabb"] as AABB).merge(box)
	for kind in node.get_children():
		_vermesse(kind, lokal, wurzel, mess)


func _ist_endlich(t: Transform3D) -> bool:
	for achse: Vector3 in [t.basis.x, t.basis.y, t.basis.z, t.origin]:
		if not (is_finite(achse.x) and is_finite(achse.y) and is_finite(achse.z)):
			return false
	return true


func _hat_key(pfad: String, keys: Array[String]) -> bool:
	var name := pfad.get_file().to_lower()
	for key in keys:
		if name.contains(key):
			return true
	return false


func _ausnahme_fuer(pfad: String) -> String:
	for suffix: String in AUSNAHMEN:
		if pfad.ends_with(suffix):
			return str(AUSNAHMEN[suffix])
	return ""
