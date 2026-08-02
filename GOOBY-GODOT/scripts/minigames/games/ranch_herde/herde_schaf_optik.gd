class_name RanchHerdeSchafOptik
extends RefCounted
## Schaf-Optik (ranchHerde, H-Playtest): spiegelt den Sim-Zustand JEDEN
## Frame auf die 3D-Knoten. Die Schleife sass vorher in _tick_ziel_fahne
## HINTER dem visible-Gate der Zielfahne — vor dem ersten Tipp und sobald
## das Pferd die Fahne erreichte, froren alle Schafe ein, während die Sim
## sie weiterbewegte (sichtbarer Desync). Reine OPTIK — die Sim
## (RanchHerdeLogic) bleibt unberührt.


## Positionen/Drehung/Hoppeln + Kopf-Animation aus dem Sim-Zustand stellen.
static func tick(schafe: Array, nodes: Array, t_abs: float) -> void:
	for i in mini(schafe.size(), nodes.size()):
		var s: Dictionary = schafe[i]
		var node: Node3D = nodes[i]
		node.position = Vector3(float(s["x"]), 0.0, float(s["z"]))
		var vel := Vector2(float(s["vx"]), float(s["vz"]))
		var speed := vel.length()
		if speed > 0.2:
			node.rotation.y = atan2(vel.x, vel.y)
		# Puschel-Hoppeln: kleine Hüpfer nach Schaf-Phase + Tempo.
		node.position.y = absf(sin(t_abs * 6.0 + float(s["phase"]))) * 0.06 * minf(1.0, speed)
		_kopf(node, s, speed, t_abs)


## Kopf-Animation = Persönlichkeit: gemütliche Schafe grasen (Kopf unten),
## schreckhafte reißen den Kopf hoch und zittern beim Flüchten, drin-Schafe
## nicken zufrieden im Takt.
static func _kopf(node: Node3D, s: Dictionary, speed: float, t_abs: float) -> void:
	var kopf := node.get_node_or_null("Kopf") as Node3D
	if kopf == null:
		return
	var phase := float(s["phase"])
	if bool(s["drin"]):
		kopf.rotation.x = 0.1 + 0.08 * sin(t_abs * 3.0 + phase)
		kopf.rotation.z = 0.0
		return
	var flucht := clampf(speed / 3.0, 0.0, 1.0)
	# Grasen: langsame Schafe senken den Kopf (je nach Phase verschieden
	# tief — die störrischen fressen einfach weiter).
	var grasen := (0.5 + 0.4 * sin(t_abs * 0.9 + phase * 2.0)) * (1.0 - flucht)
	kopf.rotation.x = lerpf(grasen * 0.7, -0.35, flucht)
	# Schreckhaft: beim Flüchten zittert der Kopf seitlich.
	kopf.rotation.z = sin(t_abs * 14.0 + phase) * 0.12 * flucht
