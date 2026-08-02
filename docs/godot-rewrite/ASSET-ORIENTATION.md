# ASSET-ORIENTATION.md — Orientierungs-Audit der 3D-Assets

Stand: 2026-08-02 (Agent FABLE-MAX, UserFeedback: „sicherstellen, dass alle
Assets immer richtig rotiert sind und richtig herum stehen"). Diese Datei ist
die **Vertragsgrundlage** für Blickrichtungen und Aufrecht-Stehen aller
3D-Modelle unter `GOOBY-GODOT/assets/` — und das Protokoll des Audits, das
die Verträge etabliert hat.

---

## 1. Der Orientierungs-Vertrag (FROZEN)

Alle Modelle: 1 Unit = 1 m, **Y-up**, Boden bei y=0 (siehe auch
`RANCH-ASSETS.md`, Abschnitt Konventionen).

Für Blickrichtungen gibt es im Projekt GENAU ZWEI Konventionen — welche
gilt, hängt von der Modell-Familie ab:

| Familie | Vorwärts | Yaw-Formel für Blick nach `(dx, dz)` | Referenz-Call-Sites |
|---|---|---|---|
| **GLB-Rigs** (RanchPferd/Fohlen, Tier-GLBs `assets/ranch/tiere/*`, Wildtiere) | **-Z** (Godot-Forward, glTF-Standard unserer Blender-Pipeline) | `atan2(-dx, -dz)` | `ranch_wildtiere.gd`, `comp_lauf.gd` (`_heading_zu`, Bot-Pferde), `ranch_hof_scene.gd` (Kommentar „Blickrichtung des Modells ist -z“), `ranch_tiere.gd` |
| **Prozedurale Figuren** (RNpcFigur-Gooby, GoobyActor, Herde-Schafe) | **+Z** (Augen/Gesicht werden bei +z angebaut) | `atan2(dx, dz)` | `rnpc_manager.gd` `_stellen`, `herde_game.gd` Schafe, `gooby_actor.gd` |

**Brückenregel:** Wo BEIDE Familien unter einer +Z-Konvention leben
(RNpcManager), dreht die Figur selbst ihr GLB-Kind um 180°
(`rnpc_figur.gd` `_baue_glb`: `glb.rotation.y = PI`). Wo ein Gooby auf
einem -Z-Pferd sitzt, wird der Reiter mit `mount(…, PI, …)` gedreht
(`comp_lauf.gd`, `herde_game.gd`).

Wer eine neue Call-Site schreibt: Formel aus der Tabelle nehmen, NICHT raten.
Wer ein neues Modell importiert: -Z-Blick exportieren (Blender-Pipeline
macht das automatisch), dann gelten die GLB-Formeln.

---

## 2. Audit-Methodik

1. **Statische Probe** über alle 723 `.glb`/`.gltf` unter `res://assets`
   (`tests/tools/asset_orientation_probe.gd`): gespiegelte Basen (det < 0),
   NaN/Inf-Transforms, „aufrecht“-Klassen die flach liegen (Baum, Laterne,
   Brunnen, Turm …), „flach“-Klassen die hochkant stehen (Straßen, Wege,
   Teppiche), krumm gebackene X/Z-Rotationen (kein 90°-Raster).
2. **Visuelle Kontaktbögen** aller Modelle
   (`tests/unit/screenshot_orientierung.gd`): 48 Modelle pro Bogen,
   normiert auf Bodenplatte — Gekipptes/Gespiegeltes fällt sofort auf.
3. **Call-Site-Review** aller Rotations-Zuweisungen (`rotation.y = atan2(…)`,
   `rotation.y = PI`, negative Skalen) in `scripts/**` gegen die
   Vertragstabelle aus §1.
4. **Vorher/Nachher-Szenen-Renders** der Verdächtigen (Wegwerf-Skript,
   nicht committet) als Beweis.

---

## 3. Befunde + Fixes (2026-08-02)

Die ASSETS selbst waren durchweg sauber (0 gespiegelte, 0 NaN, 0 gekippte
Modelle). Alle drei echten Bugs waren CALL-SITES, die die falsche Formel
aus §1 gewählt hatten:

| Bug | Symptom | Fix |
|---|---|---|
| `rnpc_figur.gd` `_baue_glb` hängte Tier-GLBs (-Z) ungedreht unter die +Z-NPC-Konvention | Zebra „Herr Punktabzug“, Reh, Ente, Fuchs, Katze liefen RÜCKWÄRTS durchs Dorf (RNpcManager rechnet +Z) | `glb.rotation.y = PI` beim Instanzieren |
| `hufingen_szene.gd` `_baue_theke` drehte den Verkäufer-NPC mit `PI`, als wäre er ein -Z-Modell | Marktstand-Verkäufer stand mit dem RÜCKEN zur Plaza/Kundschaft | `npc.rotation.y = 0.0` (RNpcFigur blickt nativ +Z, Theken-Wurzel zeigt mit +Z zur Plaza) |
| `herde_game.gd` `_step_optik` nutzte die +Z-Formel für das -Z-RanchPferd; Reiter saß mit yaw 0 | Hüte-Minispiel: Pferd galoppierte RÜCKWÄRTS, Gooby saß falsch herum | `atan2(-richtung.x, -richtung.y)` + `mount(0.62, PI, "idle")` + Sitz z=+0.1 (wie `comp_lauf.gd`) |

Geprüfte NICHT-Befunde (bewusst so gelassen):

- **Negative Skalen / det<0**: keine im gesamten Asset-Bestand.
- **X/Z-Rotationen in Skripten**: alle geprüften Stellen sind legitime
  prozedurale Animationen (Kopfnicken, Grasen, Hüpfen) oder gewollte
  Kipp-Optik (Pfeilspitzen, Rampen, Hänge) — keine Orientierungs-Korrekturen,
  die einen falsch exportierten Asset kaschieren.
- **`rotation.y = PI`-Stellen** (`comp_lauf.gd` Podium/Schau): korrekt —
  dort SOLL das -Z-Pferd zur +Z-Kamera schauen.

---

## 4. Heuristik-Ausnahmen (visuell belegt)

Die Probe meldet Höhen-Heuristik-Warnungen; diese fünf sind belegte
False-Positives (Screenshot geprüft, Modell steht korrekt) und stehen in
der `AUSNAHMEN`-Liste der Probe:

- `city/gebaeude/building-e.glb` — breites 2-Etagen-Flachdachhaus.
- `furniture/lampWall.glb` — Wandlampe, ragt bauartbedingt flach aus der Wand.
- `furniture/tt-park/fountain.gltf` (+ 2 Kit-Kopien in
  `minigames/carrot_catch/mpb/` und `minigames/hide_seek/tinytreats/`) —
  flacher Becken-Brunnen.
- `city/natur/tree_blocks.glb` + `ranch/natur/tree_blocks_fall.glb` —
  Klotz-Bäume, Krone breiter als hoch.

Neue Ausnahmen NUR mit visuellem Beleg eintragen (Kontaktbogen rendern).

---

## 5. Werkzeuge + Dauerwachen

| Werkzeug | Zweck | Aufruf |
|---|---|---|
| `tests/tools/asset_orientation_probe.gd` | Voller Orientierungs-Report, Exit 1 bei MIRROR/NAN/Lade-Fehlern | `godot --headless --path GOOBY-GODOT --script res://tests/tools/asset_orientation_probe.gd` |
| `tests/unit/screenshot_orientierung.gd` | Visuelle Kontaktbögen aller Modelle (Notify-Banner wird unterdrückt) | `xvfb-run -a godot --path GOOBY-GODOT --rendering-method gl_compatibility --rendering-driver opengl3 --script res://tests/unit/screenshot_orientierung.gd` → `/tmp/gooby-godot/artifacts/ORIENT/` |
| `tests/unit/test_asset_orientierung.gd` | **CI-Dauerwache** (läuft im Haupt-Runner): keine Spiegelungen/NaN in Modellen, RanchPferd-GLB hält „Blick -Z“ (head-Knochen messbar vor der Mitte), RNpcFigur kompensiert Tier-GLBs mit yaw=PI, die drei Fix-Call-Sites bleiben auf der richtigen Formel | Teil von `tests/run_tests.gd`; einzeln: `godot --headless --path GOOBY-GODOT --script res://tests/tools/run_subset.gd -- --filter=asset_orientierung` |

Checkliste für neue 3D-Inhalte:

1. Modell im Kontaktbogen rendern — steht es richtig herum?
2. Probe laufen lassen — keine neuen Warnungen (oder Ausnahme MIT Beleg).
3. Bewegt es sich? Formel aus §1-Tabelle wählen; bei Mischfamilien die
   Brückenregel anwenden (GLB-Kind drehen, nicht die Call-Site verbiegen).
