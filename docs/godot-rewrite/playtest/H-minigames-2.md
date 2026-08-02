# Playtest H — Minigames Batch 2+3 (Fable Playtester)

Zweite und dritte Minispiel-Tranche der Welle H: ALLE 31 Spiele, die in
Batch 1 (`H-minigames.md`: teaParty, veggieChop, gardenRush, basketBounce,
ranchHerde, ranchTonnen, ranchZeit) noch fehlten. Werkzeuge: die neue
Headless-Spielprobe `tests/tools/h2_mg_probe.gd` (mountet jedes Spiel wie
der Host, spielt es mit Taps/Leertaste/Pause/Resume/Orientierungswechsel am
Leitformat an — normal UND endless), dazu die Batch-1-Sweeps (SFX-Ids gegen
`sfx_map.gd`/`feel_sfx.gd`, i18n-Keys gegen `strings/de|en`, HUD-Layout
gegen das M9-`_ui`-Muster) und Code-Audits der Win/Lose-/Overlay-Pfade.

## Auditierte Spiele (31)

bubblePop, bunnyHop, burgerBuild, carrotCatch, carrotGuard, cityDrive,
danceParty, deliveryRush, fishingPond, ghostHunt, goalieGooby, gobnom,
goobySays, gvz, harborHopper, hideSeek, lanternFloat, memoryMatch, miniGolf,
pancakeTower, pipeFlow, purblePlace, ranchParcours, ranchTurnier,
rocketRescue, runner, shoppingSurf, snailMail, starHopper, toyRacer,
trampoline.

## Headless-Spielproben (Realläufe)

- `h2_mg_probe.gd`: 31 Spiele × normal + 27 × endless = **58 Läufe**, je
  200 Frames mit echten Tap-/Tasten-Events, Pause/Resume mitten im Lauf und
  Orientierungs-Doppelwechsel (Leitformat 2868×1320 ↔ 1320×2868) —
  **0 SCRIPT ERRORs, 0 Godot-Fehlerzeilen** über alle Läufe.
- Sweeps: alle verwendeten Sound-Ids existieren (87 bekannte Ids), alle
  `I18nService.t/ts/items`-Keys der Minigames existieren in DE+EN
  (4136 Keys, volle mg-Domänen-Parität) — beide ohne Befund, wie Batch 1.

## Befunde & Fixes (2 gefixt)

### 1. ranchParcours: HUD + Reit-Knöpfe ohne _ui-Skalierung (FIXED)

`parcours_game.gd/_layout_hud()` hatte exakt die Batch-1-Krankheit der
Schwester-Spiele: feste 16/10/48-px-Offsets für Zeit/Punkte, ein
340-px-Hint-Nagel (`view_size.x*0.5 − 170`) und die beiden EINZIGEN
Bedien-Knöpfe (Galopp halten, Springen) fest auf 150×64 px mit
Theme-Fontgrößen — auf dem Landscape-Leitformat (2868×1320) Krümelschrift
plus Mini-Knöpfe an der Unterkante. ranchHerde wurde in Batch 1 gefixt,
ranchTonnen/ranchZeit skalieren über `RcompHud` — nur der Parcours baute
sein HUD selbst und blieb ungeschützt. **Fix:** M9-Muster
(`DESIGN_SHORT 390`, `_ui` 0,75–3,0) für Label-Offsets/Fonts, zentrierten
Hint UND Knopf-Größe/-Position/-Font (Design-Werte bei Faktor 1
unverändert: 34/15/20/22 = Theme-Größen); der Ziel-Jubel-`float_text`
verliert seinen −130-px-Nagel mit.

### 2. gobnom: End-Panel fix 340×170 px — Krümel-Plate unterm Touch-Floor (FIXED)

`gobnom_game.gd/_build_end_overlay()` nagelte das Sieg/Nochmal-Panel auf
340×170 px mit 104×48-px-Knöpfen und Theme-Fonts fest, während das Brett
selbst über `_world_scale()` auf Vollbild skaliert und das eigene
Level-Select längst über `ScreenShell.metrics` mitwächst (GvZ macht es im
Zwillings-Overlay `gvz_overlay.gd` seit Stufe 2 richtig vor). Ergebnis auf
dem Leitformat: riesiges Brett, daneben eine Briefmarken-Plate, deren
Knöpfe klar unter dem 44-pt-Touch-Floor lagen. **Fix:**
`_layout_end_overlay()` skaliert Plate (340×170 × f, min. kombinierte
Mindestgröße), Knöpfe (104×48 × f + `ScreenShell.touch_target`) und Fonts
(`ScreenShell.scale_fonts`) und zentriert horizontal; `apply_view` ruft den
Layout-Pass bei Rotation mit offenem Panel erneut auf.

## Ohne Befund (geprüft, i. O.)

- **Endless-Vertrag:** alle 27 `supports_endless`-Spiele der Tranche haben
  echte Endless-Zweige (Sweep über `endless|ENDLESS`-Treffer + Probelauf in
  der endless-Difficulty ohne Fehler).
- **ranchTurnier:** Menü/Einweisung/Ergebnis/Zeremonie sind Container-
  Layouts mit `_deckle_mitte_panel`-Höhen-Deckel — kein fester Nagel; die
  Turnier-Pipeline (Bots vorab simuliert, `verbuche` additiv) blieb im
  Audit sauber.
- **harborHopper/snailMail/deliveryRush/runner/ghostHunt:** HUDs tragen
  das M9-`_ui`-Muster bereits vollständig (Stichproben-Audit der
  `_layout_hud`-Pfade).
- **gvz:** End-Overlays skalieren über `ScreenShell` (Referenz-Muster für
  den gobnom-Fix); Level-Select mit f-Faktor + Touch-Floor.
- **Impossible-Compare-Sweep** (Batch-1-Klasse „`!= \"spill\"` ist immer
  wahr“): alle `result/kind/outcome`-Vergleiche der Tranche gegen die
  tatsächlichen Rückgabewerte geprüft — kein weiterer Fund.

## Wächter-Tests (`tests/unit/test_h2_minigames.gd`, 2 Tests)

- `test_parcours_hud_skaliert_mit_ui_faktor` — Faktor 1 auf dem Phone,
  Deckel 3,0 am Leitformat; Zeit-Label 34→102, Galopp-Knopf 150→450 breit,
  Sprung-Knopf hält den skalierten Randabstand, Hint bleibt zentriert.
- `test_gobnom_end_overlay_skaliert` — Titel trägt die
  `ScreenShell.scale_fonts`-Größe, jeder Knopf ≥ 104×f UND ≥ Touch-Floor,
  Plate ≥ 340×f und horizontal zentriert.

Regressions-Beweis: mit gestashten Fixes fallen beide Tests (Parcours ohne
`_ui`-Feld, gobnom-Plate/Knöpfe/Fonts ungeskaliert), mit Fixes sind beide
grün.
