# ASSET-INTAKE.md — die Pipeline für neue 3D-Assets

Stand: 2026-08-02 (UserFeedback A3, Unterbau für A1 + A2). Diese Datei ist die
**verbindliche Anleitung**, wie externe UND selbst gebaute Modelle in
`GOOBY-GODOT/assets/` reinkommen. Die Kurz-Checkliste steht in
`GOOBY-GODOT/assets/README.md`; die automatische Wache ist
`GOOBY-GODOT/tests/unit/test_asset_intake.gd` (läuft im Haupt-Runner, also in
Preflight Schritt 4/6 UND im CI-Job linux-checks).

Verwandte Verträge:

- Blickrichtung/Aufrecht-Stehen: `ASSET-ORIENTATION.md` (§1 FROZEN-Vertrag).
- Ranch-Inventar + Blender-Eigenbau-Pipeline: `RANCH-ASSETS.md`.
- Lizenz-Index: `GOOBY-GODOT/assets/LICENSES.md`.

---

## 1. Ordner-Layout

Assets liegen nach **Bereich** sortiert unter `GOOBY-GODOT/assets/`:

| Ordner | Inhalt |
|---|---|
| `character/` | Gooby-Rig (`gooby.glb`) + Charakter-Zubehör |
| `city/` | Stadt: `strassen/`, `gebaeude/`, `autos/`, `natur/`, `deko/`, `innen/`, `camping/`, `strand/`, `verkehr/`, … |
| `furniture/` | Haus-Möbel; Masse-Packs je in EIGENEM Unterordner (`kenney-*/`, `kaykit-*/`, `tt-*/`, `aline/`) |
| `ranch/` | Ranch-DLC: `pferd/`, `tiere/`, `gebaeude/`, `natur/`, `props/`, `hofdeko/`, `texturen/`, `audio/` |
| `minigames/<spiel>/` | NUR was ein einzelnes Minispiel braucht (Kit-Kopien sind ok — Atlas-Packs bleiben zusammen) |
| `props/` | Blender-Eigenbau-Einzelstücke (Fensterrahmen, Duschkopf, …) |

Regeln (etabliert seit W2a/W3a, stehen auch in den `LIZENZ.md`-Dateien):

1. **Ein Quell-Pack = ein Unterordner.** Nie Dateien verschiedener Packs in
   einen Ordner mischen — viele Packs (KayKit, Tiny Treats) teilen sich pro
   Pack EINE Atlas-Textur; auseinandergerissene Packs verlieren ihre Textur.
2. **Spätere Wellen ergänzen NUR eigene Unterordner** und überschreiben nie
   fremde Dateien.
3. Die Original-Lizenzdatei (`License-*.txt` / `LICENSE.txt`) liegt IMMER mit
   im Pack-Ordner (siehe §6).

## 2. Format

- **glTF als `.glb`** (binär, bevorzugt) oder `.gltf` + Sidecar-Texturen
  (nur wenn das Pack so kommt — dann komplett übernehmen, s. o. Atlas-Regel).
- Godot 4.4.1 importiert ohne Plugins; nach dem Reinkopieren einmal
  `godot --headless --path GOOBY-GODOT --import` laufen lassen (bei
  abhängigen Ressourcen bis zu 4 Durchläufe — macht `tools/ci/preflight.sh`
  Schritt 3/6 automatisch).
- Andere Quellformate (`.blend`, `.fbx`, `.obj`) VOR dem Commit nach glTF
  konvertieren (Blender-Pipeline, Muster: `RANCH-ASSETS.md` §2 Quaternius).
  Quell-`.blend` gehören nach `GOOBY-GODOT/tools/blender/`, nicht in
  `assets/`.

## 3. Maßstab (Referenz: Gooby ≈ 1,13 m)

**1 Unit = 1 m, Y-up** — überall, ohne Ausnahme.

Referenzgrößen zum Einnorden neuer Modelle:

| Referenz | Größe | Quelle |
|---|---|---|
| **Gooby (Rig-GLB)** | **≈ 1,13 m hoch** | `RAW_HEIGHT` in `scripts/minigames/games/_3da_stage/gooby_actor.gd` |
| Pferd (Rücken) | ≈ 1,42 m | `RUECKEN_Y`-Vertrag, `RANCH-ASSETS.md` §1 |
| Zimmerdecke im Haus | 2,45 m | `DECKEN_HOEHE` in `scripts/home/grid_data.gd` |

Ein Stuhl, der neben Gooby wie ein Hochhaus wirkt, ist falsch skaliert —
beim Export korrigieren (nicht per Skript-Hack an der Call-Site). Die Wache
lässt nur Modelle mit größter Kante zwischen **0,02 m und 40 m** durch
(fängt cm-/inch-Exporte, die um Faktor 100 danebenliegen).

## 4. Pivot

**Pivot = Boden-Mitte**: Ursprung liegt vertikal auf der Unterkante
(AABB `min_y ≈ 0`) und horizontal in der Fußabdruck-Mitte. Platzierungs-Code
im ganzen Projekt (`Props3D.model`, `home_props.gd modell_glb`, `_prop(pos,
rot)`-Helfer) setzt Modelle auf `y=0` und verlässt sich darauf.

- Die Wache erzwingt die **Boden-Kante** (|`min_y`| ≤ max(0,06 m; 10 % der
  Höhe) — die 6 cm decken die designte 5-cm-Einsink-Basis der
  Kenney-Natur-Kits). Die horizontale Mitte ist Ziel-Konvention, wird aber
  nicht hart erzwungen (Raster-Kits haben teils bewusste Ecken-Pivots).
- Kommt ein Pack mit Versatz-Pivots, beim Intake die Wurzel-Translations
  zentrieren (glTF-Node-Translation editieren, Geometrie unangetastet) —
  Präzedenzfall: Kenney Racing Kit, `assets/city/LIZENZ.md` Hinweis
  `verkehr/`.
- **Legitime Ausnahmen** (Wand-/Deckenmontage, Hänge-Pivot, Achs-Pivot bei
  Rädern/Bällen, Wasserlinien-Pivot, Kit-Raster): Eintrag MIT Begründung in
  `AUSNAHMEN_PIVOT` in `tests/unit/test_asset_intake.gd` — sonst bleibt die
  Wache rot. Lieber Pivot fixen als Ausnahme stapeln.

## 5. Orientierung (Front-Achse)

Kurzfassung des FROZEN-Vertrags aus `ASSET-ORIENTATION.md` §1:

- **GLB/glTF-Importe schauen nach -Z** (Godot-Forward). Beim Export/Konvertieren
  so drehen (die Blender-Pipeline macht das automatisch; Quaternius-Packs
  wurden beim Intake um 180° gedreht — `RANCH-ASSETS.md` §2).
- Nur **prozedurale Figuren** (RNpcFigur, GoobyActor) schauen +Z. Mischfälle
  lösen die Brückenregel (GLB-Kind um `PI` drehen), NIE die Call-Site-Formel
  verbiegen.
- Aufrecht = Y-up, keine gebackenen X/Z-Rotationen außerhalb des 90°-Rasters,
  keine gespiegelten Basen (det < 0), keine NaN/Inf-Transforms.
- Neue Modelle im Kontaktbogen sichten
  (`tests/unit/screenshot_orientierung.gd`) und die Probe laufen lassen
  (`tests/tools/asset_orientation_probe.gd`) — Werkzeuge + Aufrufe in
  `ASSET-ORIENTATION.md` §5.

## 6. Kollision

GLBs kommen OHNE Collision-Shapes ins Repo (keine `-col`-Suffixe, keine
auto-generierten Trimeshes — zu teuer für iOS). Kollision liefert das
platzierende System:

- **Haus-Möbel**: `footprint`-Zellen im Möbel-Katalog
  (`scripts/home/data/furniture_catalog.json` bzw.
  `content/furniture/data/*.json`) — Grid/Navmesh blocken daraus.
- **Welt-Props** (Stadt/Ranch/Orte): einfache Shapes oder Blocker im
  Szenen-Code der platzierenden Skripte (Muster: `ort_leben.gd`,
  `ranch_gelaende.gd`).
- **Physik-Objekte** (z. B. Wurfball): eigener Body im Interactable-Skript
  (`scripts/home/interactables/ball.gd`).

Beim Intake also: Fußabdruck/Blocker im Ziel-System eintragen, NICHT das
GLB anfassen.

## 7. Lizenz (Pflicht, VOR dem Commit)

Nur **CC0, CC-BY oder ausdrücklich freie Lizenzen** — Details + Grenzfälle in
`GOOBY-GODOT/assets/LICENSES.md` (Index). Pro neuem Pack:

1. Original-Lizenzdatei in den Pack-Ordner (`License-<quelle>-<pack>.txt`).
2. Zeile in der `LIZENZ.md` des Bereichs (Ordner → Quelle → Lizenz);
   neue Bereiche zusätzlich im Index `assets/LICENSES.md` verlinken.
3. **CC-BY** ⇒ Namensnennung in die Pflicht-Credits (`RANCH-ASSETS.md` §6
   ist die bestehende Liste).
4. NICHT erlaubt: Unity-Asset-Store-Packs unter Standard-EULA (an
   Unity-Projekte gebunden), Sketchfab/Blockbench ohne download-erlaubte
   Lizenz, Wegwerf-Accounts für Stores (A2-Beschluss in `UserFeedback.md`).

## 8. Stil-Gate (A2)

Nur Modelle im Gooby-Look: **low-poly, weiche Pastellfarben, runde Formen**.
Jeden Kandidaten per Screenshot NEBEN bestehenden Szenen bewerten
(Kontaktbogen oder Testszene) — Stil-Ausreißer fliegen raus, egal wie
praktisch das Pack wäre.

## 9. Intake-Ablauf (Schritt für Schritt)

1. Quelle + Lizenz prüfen (§7) — bei Zweifel: nicht übernehmen.
2. Stil-Gate (§8): Screenshot-Vergleich gegen bestehende Szenen.
3. Konvertieren/Normalisieren: glTF (§2), Maßstab (§3), Pivot (§4),
   -Z-Front (§5).
4. In den richtigen Ordner legen (§1), Original-Lizenzdatei daneben,
   `LIZENZ.md`-Zeile ergänzen.
5. `godot --headless --path GOOBY-GODOT --import` — erzeugte
   `.import`-Dateien (und `.uid` bei neuen Skripten) **MIT committen**
   (Vollständigkeits-Gate: `tools/ci/check_imports.py`).
6. Kollision im Ziel-System eintragen (§6), Modell in ECHTER Szene
   platzieren — nicht nur im Assets-Ordner parken.
7. Kontaktbogen + Probe (§5) sichten.
8. `bash tools/ci/preflight.sh` — grün heißt: Intake-Wache,
   Orientierungs-Wache, Import-Gate und alle Suiten sind einverstanden.

## 10. Wachen + Werkzeuge

| Wache/Werkzeug | Prüft | Läuft |
|---|---|---|
| `tests/unit/test_asset_intake.gd` | Maßstab-Band, Pivot auf Boden (+ begründete Ausnahmen), 90°-Rotations-Raster, `.import` committet — für ALLE Modelle unter `res://assets` | Haupt-Runner ⇒ Preflight 4/6 + CI linux-checks |
| `tests/unit/test_asset_orientierung.gd` | Spiegelungen/NaN, Blickrichtungs-Verträge, fixierte Call-Sites | Haupt-Runner ⇒ Preflight + CI |
| `tools/ci/check_imports.py` | Jede `.import`-Datei hat alle `dest_files` (Import vollständig) | Preflight 3/6 + CI (linux-checks, ios-ipa) |
| `tests/tools/asset_orientation_probe.gd` | Voller Orientierungs-Report auf Abruf | manuell |
| `tests/unit/screenshot_orientierung.gd` | Visuelle Kontaktbögen aller Modelle | manuell |
