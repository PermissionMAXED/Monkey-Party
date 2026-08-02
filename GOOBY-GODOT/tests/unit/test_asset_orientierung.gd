extends TestCase
## Orientierungs-Wachen (docs/godot-rewrite/ASSET-ORIENTATION.md, UserFeedback:
## „sicherstellen, dass alle Assets immer richtig rotiert sind und richtig
## herum stehen").
##
## Drei Schichten:
##  1. ASSET-Ebene — kein Modell unter res://assets bringt gespiegelte
##     (det < 0) oder NaN/Inf-Transforms mit (kaputte Normalen/Culling).
##  2. VERTRAGS-Ebene — die beiden Blickrichtungs-Verträge bleiben messbar:
##     RanchPferd-GLB schaut -Z (head-Knochen vor der Mitte), RNpcFigur
##     kompensiert die -Z-Tier-GLBs mit yaw = PI (sonst läuft das Zebra
##     RÜCKWÄRTS durchs Dorf).
##  3. CALL-SITE-Ebene — die 2026-08-Fixes (Herde-Pferd, Marktstand-
##     Verkäufer) dürfen nicht zurückrutschen.

const RNpcFigurScript := preload("res://scripts/ranch/npc/rnpc_figur.gd")
const ZEBRA_PFAD := "res://assets/ranch/tiere/zebra.glb"

## --------------------------------------------------------- 1. Asset-Ebene


func test_keine_gespiegelten_oder_nan_transforms_in_modellen() -> void:
	var pfade: Array[String] = []
	_sammle_modelle("res://assets", pfade)
	assert_true(pfade.size() >= 50, "Modelle unter res://assets gefunden (%d)" % pfade.size())
	var fehler: PackedStringArray = PackedStringArray()
	var uebersprungen := 0
	for pfad in pfade:
		# Unimportierte Modelle (frischer Checkout ohne --import) sind kein
		# Orientierungs-Problem — die Import-Vollständigkeit wacht
		# tools/ci/check_imports.py.
		var szene := load(pfad) as PackedScene
		if szene == null:
			uebersprungen += 1
			continue
		var node := szene.instantiate()
		if node == null:
			fehler.append("%s: instantiate() == null" % pfad)
			continue
		var mess := {"mirror": 0, "nan": 0}
		_pruefe_knoten(node, mess)
		node.free()
		if int(mess["mirror"]) > 0:
			fehler.append("%s: %d Knoten mit det<0 (gespiegelt)" % [pfad, int(mess["mirror"])])
		if int(mess["nan"]) > 0:
			fehler.append("%s: %d Knoten mit NaN/Inf" % [pfad, int(mess["nan"])])
	if uebersprungen > 0:
		print("    (Orientierung: %d nicht importierte Modelle übersprungen)" % uebersprungen)
	assert_true(fehler.is_empty(), "Modell-Transforms sauber: %s" % "; ".join(fehler))


func _pruefe_knoten(node: Node, mess: Dictionary) -> void:
	if node is Node3D:
		var t := (node as Node3D).transform
		if not _ist_endlich(t):
			mess["nan"] = int(mess["nan"]) + 1
		elif t.basis.determinant() <= 0.0:
			mess["mirror"] = int(mess["mirror"]) + 1
	for kind in node.get_children():
		_pruefe_knoten(kind, mess)


func _ist_endlich(t: Transform3D) -> bool:
	for achse: Vector3 in [t.basis.x, t.basis.y, t.basis.z, t.origin]:
		if not (is_finite(achse.x) and is_finite(achse.y) and is_finite(achse.z)):
			return false
	return true


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


## ------------------------------------------------------- 2. Vertrags-Ebene


func test_ranch_pferd_glb_haelt_blick_minus_z() -> void:
	var pferd := RanchPferd.neu(Color("#D9A066"), Color("#8A5A33"))
	tree.root.add_child(pferd)
	await wait_frames(1)
	var skel := pferd.find_child("Skeleton3D", true, false) as Skeleton3D
	assert_true(skel != null, "Pferd-GLB hat ein Skeleton3D")
	if skel != null:
		var idx := skel.find_bone("head")
		assert_true(idx >= 0, "head-Knochen vorhanden")
		if idx >= 0:
			var kopf_z := skel.get_bone_global_rest(idx).origin.z
			# RANCH-2-Vertrag „Blick -Z": der Kopf sitzt deutlich VOR der
			# Körpermitte — alle atan2(-x, -z)-Call-Sites bauen darauf.
			assert_true(kopf_z < -0.2, "Pferd schaut -Z (head bei z=%.2f)" % kopf_z)
	pferd.queue_free()
	await wait_frames(1)


func test_rnpc_glb_tier_wird_um_180_grad_kompensiert() -> void:
	if not ResourceLoader.exists(ZEBRA_PFAD):
		return  # Teil-Checkout ohne Tier-GLBs — Fallback baut den Gooby.
	# Katalog-Id "punktabzug" (das Zebra) — so existiert der Namens-Key
	# rnpc.punktabzug.name und das Namensschild loggt keinen Fehler.
	var def := {
		"id": "punktabzug",
		"typ": "npc",
		"modell": {"art": "glb", "datei": ZEBRA_PFAD, "groesse": 1.0},
	}
	var figur: Node3D = RNpcFigurScript.neu(def)
	tree.root.add_child(figur)
	await wait_frames(1)
	var kompensiert := false
	for kind in figur.get_children():
		if kind is Node3D and absf(absf((kind as Node3D).rotation.y) - PI) < 0.001:
			kompensiert = true
	assert_true(
		kompensiert, "Tier-GLB (-Z-Blick) muss mit yaw=PI auf die +Z-NPC-Konvention gedreht werden"
	)
	figur.queue_free()
	await wait_frames(1)


## ------------------------------------------------------ 3. Call-Site-Ebene


func test_herde_pferd_und_reiter_folgen_minus_z_vertrag() -> void:
	var text := _quelle("res://scripts/minigames/games/ranch_herde/herde_game.gd")
	assert_true(
		text.contains("atan2(-richtung.x, -richtung.y)"),
		"Herde-Pferd dreht mit der -Z-Formel (wie ranch_wildtiere/comp_lauf)"
	)
	assert_true(
		text.contains('"mount", 0.62, PI'),
		"Herde-Reiter sitzt mit yaw=PI in Blickrichtung des -Z-Pferds"
	)


func test_marktstand_verkaeufer_schaut_zur_plaza() -> void:
	var text := _quelle("res://scripts/ranch/dorf/hufingen_szene.gd")
	assert_true(
		text.contains("npc.rotation.y = 0.0"),
		"Verkäufer (nativ +Z) schaut mit yaw=0 über die Theke zur Plaza"
	)
	assert_false(
		text.contains("npc.rotation.y = PI"),
		"die alte 180°-Kompensation (Rücken zur Kundschaft) ist raus"
	)


func test_rnpc_schichten_bleiben_konsistent() -> void:
	# Manager rechnet +Z — die Figur muss -Z-GLBs deshalb selbst drehen.
	var manager := _quelle("res://scripts/ranch/npc/rnpc_manager.gd")
	assert_true(
		manager.contains("atan2(blick.x, blick.z)"), "RNpcManager stellt Blick mit +Z-Formel"
	)
	var figur := _quelle("res://scripts/ranch/npc/rnpc_figur.gd")
	assert_true(figur.contains("glb.rotation.y = PI"), "RNpcFigur kompensiert -Z-Tier-GLBs")


func _quelle(pfad: String) -> String:
	if not FileAccess.file_exists(pfad):
		fail_test("Datei fehlt: %s" % pfad)
		return ""
	return FileAccess.get_file_as_string(pfad)
