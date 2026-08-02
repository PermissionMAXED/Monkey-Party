# Playtest H — Telefon/Radio-Rest: Radio, Kamera, Galerie (Fable Playtester)

Telefon/Radio-Tranche der Welle H: das Radio (RadioSheet/RadioLogic samt
IKEA-Kauf-Gate), die IGohbie-Kamera-App, der Fotomodus (Werkzeuge, Selfie,
Album-Kappung) und die Galerie (Raster/Vollansicht/Favoriten/Löschen/Export)
inklusive Reisepass-Verzahnung (`profile.passPhoto`). Werkzeuge: eine
temporäre Headless-Probe (RadioSheet ohne/mit Besitz mit allen Transport-
Aktionen, Kamera-App gesperrt/frei, Fotomodus-Rahmen-Chips, Galerie-
Vollansicht/Zoom/Export — 0 SCRIPT ERRORs), Code-Audits der Datei-Lebenswege
(`user://fotos/`) und der Gate-Matrix, dazu die Bestands-Tests
(`test_rest4_radio`, `test_w13_radio_gates`, `test_rest4_galerie`,
`test_w13c_fotowerk`).

## Befunde & Fixes (2 gefixt)

### 1. Foto-Kappung leckt PNGs: verdrängte Aufnahmen blieben ewig liegen (FIXED)

`foto_modus.gd/merke_foto()` deckelt das Album auf `MAX_FOTOS` (40) und
warf ältere Einträge per `pop_back()` NUR aus dem Save-Index — die
PNG-Dateien unter `user://fotos/` blieben für immer liegen (der alte
Kommentar sagte es sogar: „die Dateien bleiben liegen“). Jede Aufnahme ist
ein Full-Viewport-PNG (auf dem Leitformat mehrere MB): Wer fleißig knipst,
sammelt unbegrenzt unsichtbaren Speichermüll auf dem Gerät — nur das
explizite Galerie-Löschen räumte Dateien. **Fix:** `merke_foto` sammelt die
verdrängten Einträge und `_raeume_verdraengte()` löscht ihre Dateien — mit
zwei Wächtern: `foto_pfad()` ist sekundengenau (zwei Schnappschüsse in
derselben Sekunde teilen sich EINE Datei — gelöscht wird nur, wenn kein
verbliebener Index-Eintrag den Pfad mehr trägt) und das Passfoto
(`profile.passPhoto`) behält seine Datei, auch wenn der Album-Eintrag
rausfällt (der Reisepass zeigt sie weiter).

### 2. Galerie-Löschen ließ einen toten Passfoto-Pfad im Save (FIXED)

`galerie_screen.gd/_on_loeschen_bestaetigt()` löschte Index-Eintrag UND
PNG-Datei — aber wenn genau diese Aufnahme als Passfoto gesetzt war, blieb
`profile.passPhoto` als toter Pfad im Save stehen. Der Pass fiel erst beim
nächsten Fehl-Load kommentarlos aufs 3D-Porträt zurück, der Save trug den
Leichnam dauerhaft mit (und der „Standard-Porträt“-Knopf im Passfoto-Picker
erschien weiter, als wäre ein Foto gesetzt). **Fix:** Trifft das Löschen den
Passfoto-Pfad, wird `profile.passPhoto` über `PassportCard.setze_passfoto`
mit geleert (inkl. `profile`-Slice-Ping); fremde Passfotos bleiben
unangetastet.

## Ohne Befund (geprüft, i. O.)

- **Radio-Kauf-Gate (H §6.1):** Ohne Besitz nur Bordmusik + Play/Pause
  (Skip/Sender/Like hart gesperrt, Senderwahl-Probe blieb auf `bordmusik`);
  mit Radio-Möbel im Lager heilt sich `radio.owned` beim Öffnen selbst.
  Alle Sender durchgeschaltet, Skip/Like/Titel-Likes/Lautstärke ohne
  Fehlerzeile (Headless-Probe).
- **RadioLogic:** Likes strikt bool + nur bekannte Track-Ids
  (Cheat-/Altlast-Schutz), Sender-/Titel-Schlösser gegen
  `progression.level`, `frei_zaehler` konsistent; `_gelesene_station`
  validiert die gespeicherte Station gegen die Registry.
- **Kamera-App:** POW-Gate (`inventory.items.kamera`) baut gesperrt/frei
  sauber um; Vorschau lädt die jüngste Aufnahme, Galerie-Route intakt.
- **Fotomodus:** Rahmen-Chips (alle `FotoRahmen.ids()`) ohne Befund;
  `knipsen()` ist headless nicht fahrbar (wartet auf
  `RenderingServer.frame_post_draw`, das der Dummy-Renderer nie feuert —
  darum injiziert auch `test_w13c_fotowerk` die `foto_quelle`), der
  Album-Pfad läuft über `merke_foto` (Unit-Tests).
- **Galerie:** Raster/Vollansicht/Zoom/Blättern/Favoriten über
  `test_rest4_galerie` grün; Export (`exportiere`) kopiert die PNG in den
  Bilder-Ordner (Headless: `user://export/`) — Probe mit echtem Dateicheck.

## Wächter-Tests (`tests/unit/test_h_kamera_galerie.gd`, 4 Tests)

- `test_kappung_loescht_verdraengte_png` — 40 Fotos + 1 neues: der
  verdrängte Eintrag verliert auch seine Datei, die frische Aufnahme bleibt.
- `test_kappung_schont_passfoto` — ist die verdrängte Aufnahme das
  Passfoto, überlebt ihre Datei die Kappung.
- `test_kappung_schont_geteilte_datei` — teilen sich zwei Einträge eine
  sekundengleiche Datei, bleibt sie beim Verdrängen nur EINES Eintrags.
- `test_galerie_loeschen_raeumt_passfoto` — Galerie-Löschen des
  Passfoto-Bilds leert `profile.passPhoto` (+ `profile`-Ping); ein fremdes
  Passfoto bleibt unangetastet (Gegenprobe ohne unnötigen Ping).

Regressions-Beweis: mit gestashten Fixes fallen
`test_kappung_loescht_verdraengte_png` (PNG bleibt liegen) und
`test_galerie_loeschen_raeumt_passfoto` (toter Pfad bleibt); die beiden
Schon-Wächter sind bewusst in beiden Welten grün (sie sichern gegen
ZU VIEL Löschen). Mit Fixes: alle 4 grün, `test_rest4_galerie`/
`test_w13c_fotowerk` unverändert grün (Suite: 3560 Tests, Fremd-Failures
nur aus dem parallelen Haus-Ausbau-Ast).
