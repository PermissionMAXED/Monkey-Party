class_name GoobyeLadenDeko
extends RefCounted
## Deko-/Requisiten-Fabrik des „Goo und Bye“-Ladens (ausgelagert aus
## GoobyeLadenScene — reine Optik, keine Logik): KayKit-/Kenney-Requisiten,
## die Form-Meshes der Warengruppen (§2.5) und Onkel Alwins Schiebermütze
## (Stammkunden-Ritual §6.3). Alles static, Wurzel wird hereingereicht.

const INNEN := "res://assets/city/innen"
## PROPS-2026-08 (A2 Welle 2): Laden-Warenwelt aus dem Kenney Food Kit
## (CC0, assets/city/essen/) + Eröffnungs-Banner aus dem Kenney Fantasy
## Town Kit (CC0, assets/ranch/dorf/) — Lizenzen in den Bereichs-LIZENZ.md.
const ESSEN := "res://assets/city/essen"
const DORF := "res://assets/ranch/dorf"

## Alwins Schiebermütze (Wiedererkennung — Form+Farbe, nie nur Text).
const ALWIN_MUETZE_FARBE := Color("#8A8577")


## KayKit-Requisiten wie im REHWEI-Vorbild: Kasse rechts, Kisten links.
## `kasse_pos` reicht die Szene herein (kein Zyklus zwischen den Klassen).
static func requisiten(wurzel: Node3D, kasse_pos: Vector3) -> void:
	prop(wurzel, "%s/kitchencounter_straight.gltf" % INNEN, kasse_pos, 90.0, 0.9)
	prop(wurzel, "%s/crate_carrots.gltf" % INNEN, Vector3(-3.8, 0.0, -1.8), 12.0, 0.65)
	prop(wurzel, "%s/crate.gltf" % INNEN, Vector3(-4.0, 0.0, 0.0), -10.0, 0.65)
	prop(wurzel, "%s/crate_cheese.gltf" % INNEN, Vector3(3.6, 0.0, 0.6), -14.0, 0.65)
	prop(wurzel, "%s/menu.gltf" % INNEN, Vector3(3.0, 0.0, -3.4), 0.0, 1.6)
	prop(wurzel, "%s/fridge_A.gltf" % INNEN, Vector3(-5.4, 0.0, -3.2), 0.0, 0.9)
	# PROPS-2026-08 (A2 Welle 2, Kenney Food Kit CC0): der Laden wird ein
	# GESCHÄFT — Frische-Ecke bei den Kisten, Lieferstapel an der Tür,
	# Vorrat unterm Regal und Feinkost auf der Kassentheke.
	prop(wurzel, "%s/cabbage.glb" % ESSEN, Vector3(-3.2, 0.0, 0.55), 40.0, 0.8)
	prop(wurzel, "%s/pineapple.glb" % ESSEN, Vector3(-4.6, 0.0, 0.9), 30.0, 0.8)
	prop(wurzel, "%s/paprika.glb" % ESSEN, Vector3(-2.85, 0.0, 0.9), -15.0, 0.8)
	prop(wurzel, "%s/loaf-round.glb" % ESSEN, Vector3(-3.1, 0.0, -0.7), 65.0, 0.8)
	prop(wurzel, "%s/loaf-baguette.glb" % ESSEN, Vector3(-2.45, 0.0, -0.05), -35.0, 0.8)
	prop(wurzel, "%s/carton.glb" % ESSEN, Vector3(4.7, 0.0, -0.4), 12.0, 0.85)
	prop(wurzel, "%s/carton.glb" % ESSEN, Vector3(5.1, 0.0, -0.1), -25.0, 0.85)
	prop(wurzel, "%s/can.glb" % ESSEN, Vector3(4.5, 0.0, 0.25), 0.0, 0.8)
	prop(wurzel, "%s/soda-bottle.glb" % ESSEN, Vector3(4.95, 0.0, 0.55), 55.0, 0.8)
	prop(wurzel, "%s/soda-can.glb" % ESSEN, Vector3(4.55, 0.0, 0.7), -80.0, 0.8)
	prop(wurzel, "%s/bag.glb" % ESSEN, Vector3(5.45, 0.0, 0.35), -40.0, 0.85)
	prop(wurzel, "%s/honey.glb" % ESSEN, Vector3(1.35, 0.86, -1.0), 20.0, 0.75)
	prop(wurzel, "%s/peanut-butter.glb" % ESSEN, Vector3(1.62, 0.86, -0.9), -30.0, 0.75)
	prop(wurzel, "%s/bottle-ketchup.glb" % ESSEN, Vector3(1.35, 0.86, -1.4), 15.0, 0.7)
	prop(wurzel, "%s/bottle-oil.glb" % ESSEN, Vector3(1.6, 0.86, -1.45), -10.0, 0.7)
	# Eröffnungs-Banner an der Rückwand (Fantasy Town Kit). Achtung Pivot:
	# das Tuch hängt +0,4 m in +X neben dem Anker (Wand-Raster-Pivot) —
	# -90° dreht dieses Offset in +Z, das Tuch schwebt also VOR der Wand
	# (Anker liegt unsichtbar in der Wand bei z=-4,35).
	prop(wurzel, "%s/banner-red.glb" % DORF, Vector3(-0.8, 1.25, -4.35), -90.0, 1.6)
	prop(wurzel, "%s/banner-green.glb" % DORF, Vector3(0.8, 1.25, -4.35), -90.0, 1.6)


## Requisiten-Helfer (Ort-Muster: still bei Fehlpfad).
static func prop(
	wurzel: Node3D, pfad: String, pos: Vector3, rot_grad: float, groesse: float
) -> Node3D:
	if not ResourceLoader.exists(pfad):
		return null
	var szene: PackedScene = load(pfad)
	if szene == null:
		return null
	var node: Node3D = szene.instantiate()
	node.position = pos
	node.rotation_degrees.y = rot_grad
	node.scale = Vector3.ONE * groesse
	wurzel.add_child(node)
	return node


## Form-Sprache der Warengruppen (§2.5) als Grund-Meshes.
static func form_mesh(form: String) -> Mesh:
	match form:
		"rund":
			var kugel := SphereMesh.new()
			kugel.radius = 0.05
			kugel.height = 0.1
			return kugel
		"tropfen":
			var kapsel := CapsuleMesh.new()
			kapsel.radius = 0.04
			kapsel.height = 0.12
			return kapsel
		"dreieck":
			var prisma := PrismMesh.new()
			prisma.size = Vector3(0.1, 0.1, 0.1)
			return prisma
		"stern":
			var stern := CylinderMesh.new()
			stern.top_radius = 0.02
			stern.bottom_radius = 0.06
			stern.height = 0.1
			stern.radial_segments = 5
			return stern
		_:
			var box := BoxMesh.new()
			box.size = Vector3(0.09, 0.09, 0.09)
			return box


## Mütze auf den Kopf-Bone setzen (BoneAttachment3D, Muster CareMount in
## GoobyRig): so macht sie Kopf-Nicken, Hängeohren-Pose und Lauf-Wippen
## mit. Bone-Raum wie die Care-Props: Gesicht zeigt +Z (Schniefnase-
## Vertrag), deshalb dreht die Mütze 180° — der Schirm landet vorn.
## Ohne Skeleton (Attrappen-Rigs) sitzt sie als Fallback an der Wurzel.
static func muetze_aufsetzen(rig: Node3D) -> void:
	var muetze := alwin_muetze()
	var skelette := rig.find_children("*", "Skeleton3D", true, false)
	if skelette.is_empty():
		muetze.position = Vector3(0.0, 0.78, -0.05)
		muetze.rotation_degrees = Vector3(-8.0, 0.0, 0.0)
		rig.add_child(muetze)
		return
	var halter := BoneAttachment3D.new()
	halter.name = "AlwinMuetzenHalter"
	(skelette[0] as Skeleton3D).add_child(halter)
	halter.bone_name = "head"
	# Leicht Richtung Gesicht (+Z im Bone-Raum): die Ohren wachsen aus dem
	# HINTEREN Scheitel, vorn ist Platz für die Mütze.
	muetze.position = Vector3(0.0, 0.3, 0.05)
	muetze.rotation_degrees = Vector3(-8.0, 180.0, 0.0)
	halter.add_child(muetze)


## Alwins graue Schiebermütze (Muster OrtLeben-Hut): Kappe + Schirm nach
## vorn (Rig-Front ist -Z, GLB-Blickrichtungs-Vertrag aus A1). Position/
## Rotation setzt muetze_aufsetzen (Bone- vs. Wurzel-Raum).
static func alwin_muetze() -> Node3D:
	var muetze := Node3D.new()
	muetze.name = "AlwinMuetze"
	var mat := StandardMaterial3D.new()
	mat.albedo_color = ALWIN_MUETZE_FARBE
	mat.roughness = 0.85
	var kappe := MeshInstance3D.new()
	var kappe_mesh := CylinderMesh.new()
	kappe_mesh.top_radius = 0.16
	kappe_mesh.bottom_radius = 0.21
	kappe_mesh.height = 0.09
	kappe.mesh = kappe_mesh
	kappe.material_override = mat
	kappe.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	muetze.add_child(kappe)
	var schirm := MeshInstance3D.new()
	var schirm_mesh := BoxMesh.new()
	schirm_mesh.size = Vector3(0.28, 0.022, 0.15)
	schirm.mesh = schirm_mesh
	schirm.material_override = mat
	schirm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	schirm.position = Vector3(0.0, -0.035, -0.24)
	muetze.add_child(schirm)
	return muetze
