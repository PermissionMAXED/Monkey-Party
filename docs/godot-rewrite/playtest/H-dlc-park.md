# Playtest H-dlc-park — DLCs (McGooby, Goo und Bye), Funkelpark & IGohbie

Playtest-Durchlauf der DLC-/Park-/Telefon-Flows: McGooby-Schicht (Intro →
Patty-Wenden → Kassensturz), „Goo und Bye“-Markttag (Kauf → Einräumen →
Kundenstrom inkl. Alwin-Ritual → Kassensturz), Funkelpark (Ticket, alle
Fahrgeschäfte, Naschgasse, Nachtband) und die IGohbie-Apps (Grid, Fahrdienst,
Sperr-Badges). Getestet headless über Szene-Mounts + gezielte
Logik-Reproduktionen (Muster `test_rest4_park`/`test_dlc_goobye`), dazu
Code-Walkthrough gegen die Web-Referenz (`GOOBY/src/park/parkScene.js`,
`systems/themePark.js`) und den Orientierungs-Vertrag
(`ASSET-ORIENTATION.md` §1); Vorher/Nachher-Belege als xvfb-Renders
(Wegwerf-Skript, nicht committet). Alle 4 Funde wurden GEFIXT und mit
neuen Dauerwachen in den Bestands-Suiten abgesichert.

## Funde & Fixes

### 1. Funkelpark: Nachtband kippt nie WÄHREND des Besuchs (Bug, GROSS)

**Repro:** Park am Nachmittag betreten → bis nach 19 Uhr im Park bleiben
(oder Dev-Zeitreise): Himmel bleibt taghell, die Lichterketten gehen nie an,
`park.nightVisit` bleibt `false` — der nightLights-Sticker ist auf diesem
Weg unerreichbar. Nur wer den Park NACH 19 Uhr betritt, bekommt die Nacht.

**Befund:** `funkelpark.gd` wertete das Nachtband genau EINMAL in `_ready()`
aus (`_wende_nacht_an`). Die Web-Referenz prüft das Band dagegen im
laufenden Tick (`parkScene.js` `applyBand`/`bookNightIfNight`).
`ParkState.record_night` („Band kippt WÄHREND Gooby da steht“, Port von
`themePark.recordNight`) existierte samt Tests — aber KEIN Produktionspfad
rief sie auf (gleiche Klasse wie der tote `mark_woke_up`-Fund aus H-home).
Zusätzlich las `stunde()` direkt die Systemuhr statt der pinnbaren
`gs.clock` (W1d-Regel) — gepinnte Dev-/Test-Uhren konnten das Band also
gar nicht kippen.

**Fix (`scripts/park/funkelpark.gd`, `scripts/logic/clock.gd`):** Band-Wache
1×/s aus `_process` (`_pruefe_nachtband`): kippt das Band, wird die Optik
in BEIDE Richtungen angewandt (`_wende_band_an` — Nacht dimmt, der Morgen
hellt wieder auf; Tag-Werte jetzt als `TAG_*`-Konstanten statt Duplikate)
und beim Kipp auf Nacht `ParkState.record_night` nachgebucht (+ Toast
`park.nacht.lichter`). `stunde()` liest jetzt `gs.clock.local_hour()` —
neue Clock-Methode (gleiche Offset-Behandlung wie `local_day`, pinnbar),
Fallback bleibt die Systemuhr.

### 2. Goo und Bye: Kunde läuft RÜCKWÄRTS zur Kasse (Bug, MITTEL)

**Repro:** Laden öffnen → jeder Kunde (auch Alwin mit Möhre) stöbert am
Regal und geht dann zur Kasse: auf dem Regal→Kasse-Bein zeigt sein Gesicht
weiter zur Tür-Seite — er läuft rückwärts und tippt blind auf die Kasse.

**Befund:** `laden_scene.gd` setzte den Kunden-Yaw hart auf `PI/2`
(Auftritt) bzw. `-PI/2` (Abgang) und ließ das mittlere Bein GANZ aus. Der
Kunde ist ein `GoobyRig` (GLB-Rig, Front -Z — steht sogar im
Mützen-Kommentar der Datei); der Orientierungs-Vertrag
(`ASSET-ORIENTATION.md` §1: „Formel aus der Tabelle nehmen, NICHT raten“)
verlangt `atan2(-dx, -dz)`. Die beiden hart kodierten Werte lagen für
Auftritt/Abgang nur zufällig nah dran (±10–20°), fürs Kasse-Bein aber
~180° daneben.

**Fix (`scripts/dlc/goobye/laden_scene.gd`):** Neue statische
Vertrags-Helferin `blick_yaw(von, nach)` + Choreo-Callback
`_kunde_blickt_zu(ziel)`; alle DREI Beine (Tür→Regal, Regal→Kasse,
Kasse→Tür) drehen den Kunden jetzt vor dem Tween in Laufrichtung — auch
auf Alwins Ritual-Pfad.

### 3. Achterbahn „Hände hoch“: Pose fällt beim Halten um (Bug, KLEIN)

**Repro:** Achterbahn fahren → „Hände hoch!“ drücken und GEDRÜCKT halten:
Gooby winkt einmal (~1 s) und nimmt die Hände wieder runter, obwohl der
Knopf gehalten wird (der Wheee-Zähler verlangt 1,5 s Halten in der
erlaubten Zone — die Optik log also über den Zähler).

**Befund:** `wave` ist im Rig ein One-Shot über dem `sit`-Zustand
(`coaster_ride.gd` `set_hands_up`): einmal gefeuert, blendet er von selbst
zurück — für eine HALTE-Pose fehlte das Nachfeuern; `set_hands_up(false)`
war rein visuell ein No-Op.

**Fix (`scripts/park/coaster_ride.gd`):** `rig.clip_finished` →
`_on_rig_clip_finished`: solange `_hands_up` und `faehrt` gilt, wird
`wave` nachgefeuert (Hände bleiben oben); Loslassen stoppt die Schleife,
der One-Shot-Rückweg blendet in die Sitzpose.

### 4. McGooby: Tages-Seed ignoriert die pinnbare Uhr (Bug, KLEIN)

**Repro (gepinnte Uhr/Dev-Zeitreise):** Uhr auf morgen pinnen → Schicht
starten: dieselbe Bestell-Folge wie heute — der „gleicher Tag = gleicher
Kundenstrom“-Seed (Doc §4.1) hing an der Systemzeit.

**Befund:** `schicht_scene.gd` `_basis_seed()` nutzte
`Time.get_date_string_from_system().hash()` — Verstoß gegen die
W1d-Uhr-Regel und inkonsistent zur Schwester-Szene
(`GoobyeLadenScene._tag_key` liest korrekt `gs.clock.now_ms()`).

**Fix (`scripts/dlc/mcgooby/schicht_scene.gd`):** `_tag_key()` nach dem
Goobye-Muster (Uhr aus `gs.clock`, Fallback Systemzeit);
`_basis_seed() = _tag_key().hash()`.

## Geprüft, kein Fund

- **String-Sweep** über `dlc_goobye.*`, `mcgooby.*`, `park.*`, `phone.*`
  (inkl. dynamischer Keys wie `park.stall.%s.name`, `park.%s.done`,
  `phone.app.%s`): alle DE+EN auflösbar.
- **SFX-Sweep:** alle verklangten Ids (u. a. `park_coaster_loop`,
  `park_wheel_loop`, `park_karussell_loop`, `park_coaster_whoosh`,
  Kassen-`ui_chip`-Melodie) existieren in der `SfxMap`.
- **Geld-Pfade:** Goobye-Kauf/Nachschub und Park-Ticket/Naschgasse buchen
  atomar in EINEM `gs.update` (kein Abzug bei Ablehnung); der
  Laden-Abbau (`_bestand_sichern`) bleibt verlustfrei und doppelbuchungssicher
  (`_gesichert`-Latch).
- **Telefon-Kachel-Labels:** der feste `KACHEL_FONT`-Override wird von
  `ScreenShell.scale_fonts` (läuft NACH dem Kachel-Bau in `zeige_grid`)
  als Design-Basis erfasst und skaliert korrekt mit `f` — kein Bug.
- **Fahrdienst:** `stunde_lokal()` nutzt bewusst dieselbe Quelle wie
  `city_scene._stunde` (dokumentierte Stadt-Konvention, per
  `stunde_override` testbar). Beobachtung für später: `_tick()` läuft nur
  bei offener App — ein gerufenes Taxi „friert“ geschlossen ein und holt
  den Zustand erst beim nächsten Öffnen nach (selbstheilend, kein
  Geldverlust).
- **Autoscooter/Karussell/Riesenrad:** Bahn-Orientierung (`atan2`-Formeln)
  vertragskonform; Gondeln bleiben aufrecht (Bestandstests grün).

## Verifikation

- Neue Dauerwachen: `test_rest4_park.gd`
  (`test_funkelpark_nachtband_kippt_waehrend_besuch`,
  `test_funkelpark_stunde_aus_pinnbarer_uhr`,
  `test_coaster_hands_up_haelt_die_pose`), `test_dlc_goobye.gd`
  (`test_laden_kunden_blick_folgt_laufweg` — Vertragsformel für alle drei
  Beine + Spawn-Yaw in der Szene), `test_dlc_mcgooby.gd`
  (`test_tages_seed_folgt_der_pinnbaren_uhr`), `test_state_logic.gd`
  (`test_clock_local_hour`).
- Fokus-Runner über die vier berührten Suiten
  (`rest4_park,dlc_goobye,dlc_mcgooby,state_logic`): **73 Tests, 0 rot**.
- Vorher/Nachher-Renders (xvfb, Wegwerf-Skript): Kunde blickt auf dem
  Kasse-Bein jetzt zur Kasse; Funkelpark kippt im Besuch sichtbar auf
  Nacht (Lichterketten + Toast, `nightVisit false→true` im Log);
  POV-Halte-Pose in der Achterbahn.
- Voller Preflight (`tools/ci/preflight.sh`): GRÜN (gdformat, gdlint,
  Import-Gate, kompletter Test-Runner, W1c-Runner, Boot-Smoke).
