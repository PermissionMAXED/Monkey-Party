extends TestCase
## W18-A11y — Wachen fuer die Barrierefreiheits-Optionen: (1) der
## persistierte Reduced-Motion-Schalter erreicht den UiTheme-Laufzeit-
## Schalter beim Boot (Seed) und bei JEDEM Schreiber (setting_changed-Sync,
## nicht nur Settings-Screen-Toggle); (2) der Radio-Endlos-Ticker friert
## unter Reduced Motion ein; (3) der Tomaten-Splat verzichtet auf
## Aufprall-Zoom und Abrutschen; (4) „Hinweise anzeigen: Laenger“ verlaengert
## auch die Toast-Standzeit (nicht nur das Notify-Banner).

const ThemeServiceScript := preload("res://themes/theme_service.gd")

var _langer_text := (
	"Ein wirklich ausgesprochen langer Songtitel mit Sendernamen, "
	+ "der die Ticker-Sichtbreite deutlich sprengt und laufen muesste."
)


func _app() -> Node:
	return tree.root.get_node_or_null("/root/AppSettings")


func _ui_theme() -> Node:
	return tree.root.get_node_or_null("/root/UiTheme")


## Boot-Seed: ein frischer ThemeService uebernimmt den persistierten
## AppSettings-Wert schon in _ready — vorher blieb er nach App-Neustart
## false, bis der Settings-Screen-Toggle einmal neu umgelegt wurde.
func test_uitheme_seed_aus_appsettings() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev: Variant = app.get_setting("reduced_motion", false)
	app.set_setting("reduced_motion", true)
	var svc: Node = ThemeServiceScript.new()
	tree.root.add_child(svc)
	assert_true(bool(svc.get("reduced_motion")), "Seed aus AppSettings beim Boot")
	tree.root.remove_child(svc)
	svc.free()
	app.set_setting("reduced_motion", prev)


## Laufzeit-Sync: JEDER AppSettings-Schreiber (nicht nur der Settings-
## Screen) haelt den UiTheme-Autoload synchron.
func test_uitheme_sync_bei_setting_changed() -> void:
	var app := _app()
	var svc := _ui_theme()
	if app == null or svc == null:
		fail_test("Autoloads fehlen")
		return
	var prev: Variant = app.get_setting("reduced_motion", false)
	app.set_setting("reduced_motion", true)
	assert_true(bool(svc.get("reduced_motion")), "setting_changed synct UiTheme")
	app.set_setting("reduced_motion", false)
	assert_false(bool(svc.get("reduced_motion")), "Ruecknahme synct ebenfalls")
	app.set_setting("reduced_motion", prev)


## Radio-Ticker: unter Reduced Motion steht der Text am Anfang still und
## die Endlos-Wickel-Kopie bleibt unsichtbar; ohne laeuft er wieder los.
func test_ticker_steht_bei_reduced_motion() -> void:
	var svc := _ui_theme()
	if svc == null:
		fail_test("UiTheme-Autoload fehlt")
		return
	var prev: bool = svc.get("reduced_motion")
	svc.set("reduced_motion", true)
	var chip := NowPlayingChip.new()
	chip.inline = true
	tree.root.add_child(chip)
	chip.set_leer(_langer_text)
	await wait_frames(3)
	var label := chip.find_child("TickerText", true, false) as Label
	var kopie := chip.find_child("TickerTextKopie", true, false) as Label
	assert_eq(label.position.x, 0.0, "Reduced Motion: Ticker steht am Textanfang")
	assert_false(kopie.visible, "Reduced Motion: keine Wickel-Kopie")
	svc.set("reduced_motion", false)
	var laeuft := await wait_until(func() -> bool: return label.position.x < 0.0)
	assert_true(laeuft, "ohne Reduced Motion laeuft der Ticker wieder")
	tree.root.remove_child(chip)
	chip.free()
	svc.set("reduced_motion", prev)


## Tomaten-Splat: Reduced Motion = nur Ein-/Ausblenden — kein 1.6er-
## Aufprall-Zoom, kein Abrutschen; ohne Reduced Motion bleibt der Zoom.
func test_tomato_splat_reduced_ohne_slide() -> void:
	var svc := _ui_theme()
	if svc == null:
		fail_test("UiTheme-Autoload fehlt")
		return
	var prev: bool = svc.get("reduced_motion")
	svc.set("reduced_motion", true)
	# Host mit fester Groesse: das Overlay ankert sich full-rect hinein —
	# direktes size-Setzen wuerde die Anker-Warnung der Engine ausloesen.
	var host := Control.new()
	tree.root.add_child(host)
	host.size = Vector2(800, 600)
	var overlay := TomatoOverlay.new()
	host.add_child(overlay)
	await wait_frames(1)
	overlay.splat()
	var rect := overlay.get_child(0) as TextureRect
	assert_eq(rect.scale, Vector2.ONE, "Reduced Motion: kein Aufprall-Zoom")
	var start_y := rect.position.y
	await wait_frames(3)
	assert_almost(rect.position.y, start_y, 0.001, "Reduced Motion: kein Abrutschen")
	svc.set("reduced_motion", false)
	overlay.splat()
	var voll := overlay.get_child(1) as TextureRect
	assert_almost(voll.scale.x, 1.6, 0.001, "voll animiert: Aufprall-Zoom startet gross")
	tree.root.remove_child(host)
	host.free()
	svc.set("reduced_motion", prev)


## Hinweisdauer: „lang“ verdoppelt die Toast-Standzeit (2.2 s → 4.4 s) —
## dieselbe Regel wie beim Notify-Banner (notification_service.gd).
func test_toast_standzeit_hinweisdauer_lang() -> void:
	var app := _app()
	if app == null:
		fail_test("AppSettings-Autoload fehlt")
		return
	var prev: Variant = app.value_of("accessibility.hint_duration")
	var layer := ToastLayer.new()
	tree.root.add_child(layer)
	await wait_frames(1)
	app.set_setting("accessibility.hint_duration", "lang")
	layer.show_toast("Laenger lesbar bitte")
	var timer := layer.get("_hold_timer") as Timer
	assert_almost(timer.wait_time, ToastLayer.HOLD_SEC_LANG, 0.001, "lang = doppelte Standzeit")
	app.set_setting("accessibility.hint_duration", "normal")
	timer.stop()
	layer.queue.clear()
	layer.show_toast("Normal getaktet")
	assert_almost(timer.wait_time, ToastLayer.HOLD_SEC, 0.001, "normal = 2.2 s")
	tree.root.remove_child(layer)
	layer.free()
	app.set_setting("accessibility.hint_duration", prev)
