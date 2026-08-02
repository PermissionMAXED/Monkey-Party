# Playtest H-city — Stadt & Läden

Playtest-Durchlauf der City-/Shop-Flows (Doc E): freie Fahrt → Parkplatz-Prompt
→ Ort betreten → NPC-Dialog → Laden-Sheet → Kauf/Verkauf, dazu die
IGohbie-Reise-Apps (GOOBERANDO-Lieferung inkl. Trinkgeld-Moment). Getestet
headless über gezielte Logik-Reproduktionen (Testsuite-Muster
`test_fix5_nacht`/`test_city_orte`) plus Code-Walkthrough der UI-Pfade;
alle Funde wurden GEFIXT und mit `tests/unit/test_hcity_fixes.gd` (8 Tests)
dauerhaft abgesichert.

## Funde & Fixes

### 1. GOOBERANDO: Gratis-Buff bei leerem Münzbeutel (Exploit, MITTEL)

**Repro:** Lieferung annehmen → Trinkgeld-Prompt → mit < 5 Münzen auf
„Trinkgeld (5 ᴳ) 💛“ tippen.

**Befund:** `GooberandoApp._on_trinkgeld` rief ZUERST
`GooberandoLogic.trinkgeld()` (bucht Trinkgeld-Zähler + 30-%-Buff-Chance in
den Slice) und speicherte den Slice IMMER — der `Economy.spend`-Fehlschlag
wurde nur fürs Kauf-Geräusch ausgewertet. Ergebnis: Trinkgeld-Statistik und
„Extra-Grinsen“-Buff gab es auch ohne Bezahlung. Außerdem war der Knopf bei
leerem Beutel nicht gesperrt (anders als „Bestellen“/FahrdienstApp).

**Fix (`scripts/city/travel/gooberando.gd`):** Zahlung ZUERST; schlägt
`spend()` fehl, läuft die Übergabe als „nur winken“ weiter (Toast
`travel.gooberando.trinkgeld_pleite`, neu in de+en). Der Trinkgeld-Knopf ist
bei < 5 Münzen disabled. Zusätzlicher Guard: gebucht wird nur im
TRINKGELD-Zustand.

### 2. Öffnungszeiten wurden beim Betreten nicht erzwungen (Bug, MITTEL)

**Repro:** Dienstagnachts vor dem Wochenmarkt parken → „Betreten“.

**Befund:** Der Wochenmarkt hat in `city_map.json` die Öffnungsregel
Sa 8–14 Uhr, und `OrtKatalog.ist_offen()` existierte samt Tests — aber KEIN
Produktionspfad rief sie auf: `CityScene._on_betreten` zog Energie ab und
routete in die Ort-Szene, egal wann. Der Parkplatz-Prompt tat so, als wäre
offen.

**Fix (`scripts/city/city_scene.gd`, `scripts/city/drive_hud.gd`):**
`_on_betreten` prüft `OrtKatalog.ist_offen()` VOR dem Energie-Abzug und
zeigt sonst den „Warum zu?“-Toast (`OrtKatalog.geschlossen_key`). Der
Parkplatz-Prompt zeigt bei geschlossenen Orten den Grund
(`city.fahren.geschlossen`, neu in de+en) und sperrt den Betreten-Knopf.
Test-Hook: `CityScene.unix_override` (Muster `MarktSheet.zeit_override`).

### 3. Shop-UIs zeigten in EN deutsche Warennamen (i18n-Bug, KLEIN)

**Repro:** Sprache auf Englisch → REHWEI-Sortiment oder
Wochenmarkt-Ankauf öffnen: „Möhre“, „Törtchen“ … statt „Carrot“, „Cupcake“.

**Befund:** `HaendlerSheet._zeile`/`_buch_zeile` und `MarktSheet._baue_zeile`
lasen hart `name_de` aus dem Sortiment-JSON, obwohl alle Food-Ids
lokalisierte `rewards.food.*`-Strings haben (`FoodCatalog.display_name`
existierte bereits und wird z. B. vom Kühlschrank benutzt).

**Fix (`scripts/city/haendler_sheet.gd`, `scripts/city/ui/markt_sheet.gd`):**
Neuer Helfer `HaendlerSheet.ware_name()`: Food-Waren (leeres `inventar`)
gehen über `FoodCatalog.display_name`, Item-Waren (Bücher/Saatgut/…) über
`name_<locale>` mit `name_de`-Fallback. Der Markt-Ankauf nutzt dieselbe
Kette für die Ernte-Namen.

### 4. Laden-Sheet nach dem Schließen unerreichbar (UX, KLEIN)

**Repro:** REHWEI betreten → Dialog bis „laden“-Effekt durchtippen → Sheet
schließen → es gibt keinen Weg zurück ins Sortiment; man muss den Ort
verlassen und NEU betreten (kostet wieder Energie).

**Befund:** Der „laden“-Effekt hängt am Dialog, der Dialog lief aber genau
einmal pro Besuch (`OrtScene._ready`). Orte ohne eigene Knopfleiste hatten
danach keinerlei Wiedereinstieg.

**Fix (`scripts/city/ort_scene.gd`, `scripts/city/dialog_view.gd`):**
Tap-to-Talk — jeder Ort-NPC bekommt eine `Area3D` (`NpcTippBereich`);
Antippen startet den Dialog (und damit das Laden-Sheet) neu. Guard
`OrtDialogView.ist_aktiv()`: ein LAUFENDER Dialog wird nie neu gestartet.
Funktioniert in allen von `OrtScene` erbenden Orten, ohne deren eigene
Knopfleisten (Flughafen/Raumstation) anzufassen.

## Verifikation

- Neu: `tests/unit/test_hcity_fixes.gd` — 8 Tests decken alle vier Fixes ab
  (Trinkgeld pleite/bezahlt/Knopf-Sperre, Energie-Gate + Prompt-Sperre
  dienstags vs. samstags, lokalisierte Händler-/Markt-Namen en+de,
  NPC-Tap-Guard + Neustart).
- Betroffene Suiten grün: `test_city_*`, `test_fix5_*`,
  `test_w13b_gooberando`, `test_w13b_citydrive`, `test_w13b_stadtleben`,
  `test_w15_markt`, `test_w15_crops`, `test_g7_ort_leben`,
  `test_g7_laeden_lebendig*`, `test_g3_orte`, `test_rdorf_haendler`,
  `test_w13b_raumstation`, `test_rnpc_dialog`, `test_w15_doortravel` u. a.
  (Subset-Läufe: 244 + 113 Tests, 0 rot; inkl. `test_strings_de_en_paritaet`
  für die zwei neuen String-Keys).
- Voller Runner `tests/run_tests.gd`: Exit 0 (failed=0).
- `gdlint` + `gdformat --check` auf allen angefassten Dateien sauber.
