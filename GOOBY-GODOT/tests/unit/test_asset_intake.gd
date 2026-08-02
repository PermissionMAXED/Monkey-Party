extends TestCase
## Intake-Wache (docs/godot-rewrite/ASSET-INTAKE.md, UserFeedback A3):
## prüft JEDES Modell unter res://assets gegen die Intake-Konvention —
## neue Assets können damit nicht unbemerkt daneben liegen.
##
## Vier Schichten:
##  1. IMPORT-ARTEFAKTE — jede importierbare Ressource (glb/gltf/png/ogg/…)
##     hat ihre `.import`-Datei daneben (Checkliste: „erzeugte .import MIT
##     committen"; Vollständigkeit der Ziele wacht tools/ci/check_imports.py).
##  2. MASSSTAB — größte Kante im Band 0,02–40 m (1 Unit = 1 m; fängt
##     cm-/inch-Exporte, die um Faktor 100 danebenliegen).
##  3. PIVOT — Ursprung auf der Boden-Kante (|min_y| ≤ max(6 cm; 10 % Höhe) —
##     die 6 cm decken die designte 5-cm-Einsink-Basis der Kenney-Natur-Kits);
##     Wand-/Decken-/Hänge-/Achs-Pivots NUR mit begründetem Eintrag in
##     AUSNAHMEN_PIVOT. Verwaiste Einträge werden gemeldet.
##  4. ROTATION — keine gebackenen X/Z-Rotationen außerhalb des 90°-Rasters
##     an den Wurzel-Kindern (krummer Export). Spiegelungen/NaN und die
##     Blickrichtungs-Verträge wacht test_asset_orientierung.gd.

## Dateiendungen, die Godot importiert — für jede MUSS die `.import` daneben
## im Repo liegen (sonst baut ein frischer Checkout/Export kaputt).
const IMPORT_ENDUNGEN: Array[String] = [
	"glb", "gltf", "png", "webp", "svg", "jpg", "jpeg", "ogg", "wav", "mp3", "ttf", "otf"
]
const MODELL_ENDUNGEN: Array[String] = ["glb", "gltf"]
## Maßstab-Band (Meter) für die größte AABB-Kante eines Modells.
const MIN_KANTE := 0.02
const MAX_KANTE := 40.0
## Pivot-Toleranz: |min_y| ≤ max(PIVOT_TOL_ABS, PIVOT_TOL_REL × Höhe).
## 6 cm absolut: Kenney-Natur-/Garten-Kits senken Vegetation designt 5 cm
## unter den Ursprung (Einsink-Basis für unebenes Gelände).
const PIVOT_TOL_ABS := 0.06
const PIVOT_TOL_REL := 0.10
## Gebackene X/Z-Rotationen der Wurzel-Kinder müssen im 90°-Raster liegen
## (± diese Toleranz in Grad).
const ROTATION_TOLERANZ_GRAD := 2.0
## Begründete Pivot-Ausnahmen (Pfad-Suffix → Begründung). NUR ergänzen, wenn
## der Versatz-Pivot BAUART ist (Wand-/Deckenmontage, Hänge-, Achs-,
## Wasserlinien- oder Kit-Raster-Pivot) — sonst das Modell fixen
## (ASSET-INTAKE.md §4). Bestand vermessen am 2026-08-02.
const AUSNAHMEN_PIVOT := {
	"city/autos/wheel-default.glb": "Rad: Achs-Pivot in der Nabenmitte (dreht um die Achse)",
	"furniture/aline/bookshelf.glb": "Wandregal: Pivot am Montagepunkt",
	"furniture/aline/cactus.glb": "Topf-Pivot unterm Übertopf (Bestand, steht korrekt)",
	"furniture/aline/plant.glb": "Topf-Pivot unterm Übertopf (Bestand, steht korrekt)",
	"furniture/bathroomSink.glb": "Waschbecken: Wandmontage-Pivot",
	"furniture/kaykit-furniture/book_set.gltf": "Bücher-Set: Regalbrett-Pivot mittig",
	"furniture/kaykit-furniture/pictureframe_medium.gltf": "Bilderrahmen: Wand-Hänge-Pivot",
	"furniture/kaykit-halloween/lantern_hanging.gltf": "Hängelaterne: Pivot am Aufhängepunkt",
	"furniture/kenney-furniture/bathroomCabinetDrawer.glb": "Badschrank: Wandmontage-Pivot",
	"furniture/kenney-furniture/ceilingFan.glb": "Deckenventilator: Pivot an der Decke",
	"furniture/nougatschleuse.glb": "Eigenbau: sitzt über der Arbeitsplatte (Wand-Pivot)",
	"furniture/pflanzen/pothos_plant_large_potted.gltf": "Hängepflanze: Pivot am Aufhängepunkt",
	"furniture/tiny-treats/bad/toilet_roll_holder.gltf": "Rollenhalter: Wandmontage-Pivot",
	"furniture/tt-bathroom/toilet_roll_holder.gltf": "Rollenhalter: Wandmontage-Pivot (Kit-Kopie)",
	"minigames/harbor_hopper/watercraft-kit/buoy-flag.glb": "Boje: Wasserlinien-Pivot",
	"minigames/harbor_hopper/watercraft-kit/buoy.glb": "Boje: Wasserlinien-Pivot",
	"minigames/purble_place/tinytreats/dough_roller.gltf": "Nudelholz: Griff-Achs-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-corner-large.glb":
	"Kenney-Kit: Strecken-Raster-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-corner-small.glb":
	"Kenney-Kit: Strecken-Raster-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-curve.glb": "Kenney-Kit: Strecken-Raster-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-looping.glb": "Kenney-Kit: Strecken-Raster-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-straight-bump-down.glb":
	"Kenney-Kit: Strecken-Raster-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-straight-bump-up.glb":
	"Kenney-Kit: Strecken-Raster-Pivot",
	"minigames/toy_racer/toy-car-kit/track-narrow-straight.glb":
	"Kenney-Kit: Strecken-Raster-Pivot",
	"props/bilderrahmen.glb": "Bilderrahmen (Eigenbau): Wand-Hänge-Pivot",
	"props/duschkopf.glb": "Duschkopf (Eigenbau): Wandmontage auf Kopfhöhe",
	"props/fenster_rahmen_1.glb": "Fensterrahmen (Eigenbau): Pivot in der Wandöffnung",
	"props/fenster_rahmen_2.glb": "Fensterrahmen (Eigenbau): Pivot in der Wandöffnung",
	"props/fenster_rahmen_3.glb": "Fensterrahmen (Eigenbau): Pivot in der Wandöffnung",
	"props/wurfball.glb": "Ball: Kugel-Pivot im Zentrum (rollt/fliegt um den Mittelpunkt)",
	"ranch/props/sattel.glb": "Sattel: Pivot an der Auflage-Kurve (sitzt auf dem Pferderücken)",
	"furniture/tt-bakery/dough_roller.gltf": "Nudelholz: Griff-Achs-Pivot",
}

var _mess_cache: Array = []

## ------------------------------------------------- 1. Import-Artefakte


func test_import_artefakte_liegen_neben_jeder_ressource() -> void:
	var pfade: Array[String] = []
	_sammle_dateien("res://assets", IMPORT_ENDUNGEN, pfade)
	assert_true(pfade.size() >= 100, "importierbare Ressourcen gefunden (%d)" % pfade.size())
	var fehlend := PackedStringArray()
	for pfad in pfade:
		if not FileAccess.file_exists(pfad + ".import"):
			fehlend.append(pfad)
	assert_true(
		fehlend.is_empty(),
		(
			".import fehlt (einmal `godot --headless --path GOOBY-GODOT --import`, "
			+ "dann MIT committen): %s" % "; ".join(fehlend)
		)
	)


## --------------------------------------------------------- 2. Maßstab


func test_massstab_im_plausiblen_band() -> void:
	var fehler := PackedStringArray()
	for mess: Dictionary in _messungen():
		var groesse: Vector3 = mess["groesse"]
		var kante := maxf(groesse.x, maxf(groesse.y, groesse.z))
		if kante < MIN_KANTE or kante > MAX_KANTE:
			fehler.append("%s: größte Kante %.3f m (size=%s)" % [mess["pfad"], kante, groesse])
	assert_true(
		fehler.is_empty(),
		(
			(
				"Maßstab außerhalb %.2f–%.0f m (1 Unit = 1 m, Gooby ≈ 1,13 m — "
				% [MIN_KANTE, MAX_KANTE]
			)
			+ "ASSET-INTAKE.md §3): %s" % "; ".join(fehler)
		)
	)


## ----------------------------------------------------------- 3. Pivot


func test_pivot_liegt_auf_der_bodenkante() -> void:
	var fehler := PackedStringArray()
	for mess: Dictionary in _messungen():
		var pfad: String = mess["pfad"]
		if _ausnahme_fuer(pfad) != "":
			continue
		var groesse: Vector3 = mess["groesse"]
		var min_y: float = mess["min_y"]
		var toleranz := maxf(PIVOT_TOL_ABS, PIVOT_TOL_REL * groesse.y)
		if absf(min_y) > toleranz:
			fehler.append("%s: min_y=%.3f (Toleranz ±%.3f)" % [pfad, min_y, toleranz])
	assert_true(
		fehler.is_empty(),
		(
			"Pivot nicht auf der Boden-Kante (ASSET-INTAKE.md §4 — fixen oder "
			+ "begründete AUSNAHMEN_PIVOT-Zeile): %s" % "; ".join(fehler)
		)
	)


func test_pivot_ausnahmen_liste_ist_nicht_verwaist() -> void:
	var pfade: Array[String] = []
	_sammle_dateien("res://assets", MODELL_ENDUNGEN, pfade)
	var verwaist := PackedStringArray()
	for suffix: String in AUSNAHMEN_PIVOT:
		var gefunden := false
		for pfad in pfade:
			if pfad.ends_with(suffix):
				gefunden = true
				break
		if not gefunden:
			verwaist.append(suffix)
	assert_true(
		verwaist.is_empty(),
		(
			"AUSNAHMEN_PIVOT-Einträge ohne Datei (beim Umbenennen/Löschen mitpflegen): %s"
			% "; ".join(verwaist)
		)
	)


## -------------------------------------------------------- 4. Rotation


func test_keine_krummen_gebackenen_x_z_rotationen() -> void:
	var fehler := PackedStringArray()
	for mess: Dictionary in _messungen():
		var krumm: Array = mess["krumm"]
		if not krumm.is_empty():
			fehler.append("%s: %s" % [mess["pfad"], str(krumm.slice(0, 4))])
	assert_true(
		fehler.is_empty(),
		(
			"gebackene X/Z-Rotationen außerhalb des 90°-Rasters "
			+ "(ASSET-INTAKE.md §5): %s" % "; ".join(fehler)
		)
	)


## ----------------------------------------------------------- Helfer


## Vermisst alle Modelle EINMAL (Cache über die Testmethoden hinweg):
## {pfad, groesse: Vector3, min_y: float, krumm: Array[String]}.
## Nicht importierte Modelle (frischer Checkout ohne --import) werden wie in
## test_asset_orientierung.gd übersprungen — Import-Vollständigkeit wacht
## tools/ci/check_imports.py.
func _messungen() -> Array:
	if not _mess_cache.is_empty():
		return _mess_cache
	var pfade: Array[String] = []
	_sammle_dateien("res://assets", MODELL_ENDUNGEN, pfade)
	assert_true(pfade.size() >= 50, "Modelle unter res://assets gefunden (%d)" % pfade.size())
	var uebersprungen := 0
	for pfad in pfade:
		var szene := load(pfad) as PackedScene
		if szene == null:
			uebersprungen += 1
			continue
		var node := szene.instantiate()
		if node == null:
			fail_test("%s: instantiate() == null" % pfad)
			continue
		var mess := {"aabb": AABB(), "erster": true, "krumm": []}
		_vermesse(node, Transform3D.IDENTITY, node, mess)
		node.free()
		if bool(mess["erster"]):
			continue  # Modell ohne Mesh (reiner Node-Container) — nichts zu messen.
		var aabb: AABB = mess["aabb"]
		_mess_cache.append(
			{"pfad": pfad, "groesse": aabb.size, "min_y": aabb.position.y, "krumm": mess["krumm"]}
		)
	if uebersprungen > 0:
		print("    (Intake: %d nicht importierte Modelle übersprungen)" % uebersprungen)
	return _mess_cache


func _vermesse(node: Node, xform: Transform3D, wurzel: Node, mess: Dictionary) -> void:
	var lokal := xform
	if node is Node3D:
		var t := (node as Node3D).transform
		lokal = xform * t
		if node.get_parent() == wurzel:
			var rot := t.basis.get_euler()
			for winkel: float in [rot.x, rot.z]:
				var grad := absf(rad_to_deg(winkel))
				var rest := fmod(grad, 90.0)
				if rest > ROTATION_TOLERANZ_GRAD and rest < 90.0 - ROTATION_TOLERANZ_GRAD:
					(mess["krumm"] as Array).append("%s: %.1f°" % [node.name, grad])
	if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
		var box: AABB = lokal * (node as MeshInstance3D).mesh.get_aabb()
		if bool(mess["erster"]):
			mess["aabb"] = box
			mess["erster"] = false
		else:
			mess["aabb"] = (mess["aabb"] as AABB).merge(box)
	for kind in node.get_children():
		_vermesse(kind, lokal, wurzel, mess)


func _sammle_dateien(wurzel: String, endungen: Array[String], out: Array[String]) -> void:
	var dir := DirAccess.open(wurzel)
	if dir == null:
		return
	dir.list_dir_begin()
	var eintrag := dir.get_next()
	while eintrag != "":
		var pfad := wurzel + "/" + eintrag
		if dir.current_is_dir():
			if not eintrag.begins_with("."):
				_sammle_dateien(pfad, endungen, out)
		elif eintrag.get_extension().to_lower() in endungen:
			out.append(pfad)
		eintrag = dir.get_next()
	dir.list_dir_end()


func _ausnahme_fuer(pfad: String) -> String:
	for suffix: String in AUSNAHMEN_PIVOT:
		if pfad.ends_with(suffix):
			return str(AUSNAHMEN_PIVOT[suffix])
	return ""
