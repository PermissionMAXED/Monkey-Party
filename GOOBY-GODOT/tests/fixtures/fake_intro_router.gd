extends Node
## Test-Doppel (G7-P56R2) für die Intro-Wartelogik des MinigameHost:
## meldet eine laufende Reise (is_busy) und feuert travel_finished auf
## Kommando — wie der echte SceneRouter am Ende des Reveal-Wipes.

signal travel_finished(target: StringName)

var busy := true


func is_busy() -> bool:
	return busy


func beende_reise() -> void:
	busy = false
	travel_finished.emit(&"mg_host")
