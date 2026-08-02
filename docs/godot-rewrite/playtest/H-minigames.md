# Playtest H — Minigames (Fable Playtester)

Audit-Runde über mehrere Minigames: kaputte Win/Lose-Pfade, fehlende SFX,
schlechte Kamera, abgeschnittene/zu kleine UI. Statisch (Code-Audit gegen
`sfx_map.gd`/`feel_sfx.gd`, i18n-Keys gegen `strings/de|en`, HUD-Layout gegen
das M9-`_ui`-Muster) plus Läufe im Headless-Harness. Wächter-Tests:
`tests/unit/test_h_minigames.gd`.

## Auditierte Spiele

teaParty, veggieChop, gardenRush, basketBounce, ranchHerde, ranchTonnen,
ranchZeit (SFX/Strings), dazu Querschnitt: alle `AudioDirector.try_play`/
`FeelSfx.play`-IDs gegen die SfxMap und alle direkten `I18nService.t`-Keys
gegen de/en — beide Sweeps ohne Befund (keine toten Sound-IDs, keine
fehlenden Keys).

## Befunde & Fixes (6 gefixt)

### 1. teaParty: verschüttete Tasse wurde als „serviert" inszeniert (FIXED)

`tea_party.gd/_release()` prüfte `res["result"] != "spill"` — aber
`TeaPartyLogic.pour_result` liefert nur `perfect|good|miss`. Der Vergleich
war IMMER wahr: auch nach einem Spill rutschte die Ghost-Tasse sichtbar
„serviert" nach links raus (Lose-Moment sah aus wie ein Win-Moment).
**Fix:** Vergleich auf `!= "miss"`. Sim/Score unangetastet (reine Optik).

### 2. veggieChop: HUD ohne _ui-Skalierung (FIXED)

Zeit-/Miss-/Banner-/Hint-Label standen auf festen 16/10/48-px-Offsets und
Theme-Fontgrößen — auf dem Leitformat (Landscape 2868×1320) Krümelschrift
in der Ecke. **Fix:** M9-Muster (`DESIGN_SHORT 390`, `_ui` 0,75–3,0) für
Positionen, Breiten und Fontgrößen (Design-Werte bei Faktor 1 unverändert:
Headline 34, Caption 15, Title 28, Soft 20).

### 3. gardenRush: HUD ohne _ui-Skalierung (FIXED)

Gleiches Bild in `_layout_hud()` (feste Offsets, fester 380-px-Hint).
**Fix:** M9-Muster inkl. HUD-Plate-Padding; der Hint zentriert jetzt über
die skalierte Breite statt über den festen −190-px-Nagel.

### 4. basketBounce: HUD + Flash-Text ohne _ui-Skalierung (FIXED)

Feste Label-Offsets, feste Outline-Größen und der Korb-Flash (`_draw_flash`)
mit fester Fontgröße 34. **Fix:** M9-Muster für Labels (inkl. Outlines) und
`int(34.0 * _ui)` für den Flash.

### 5. ranchHerde: Schafe froren ohne Zielfahne ein (FIXED)

Die Schleife, die die Schaf-Knoten aus der Sim stellt (Position, Drehung,
Hoppeln, Kopf-Animation), sass in `_tick_ziel_fahne()` HINTER dem
`_ziel_fahne.visible`-Gate. Die Fahne startet unsichtbar und sinkt weg,
sobald das Pferd sie erreicht — vor dem ersten Tipp und nach jedem
erreichten Ziel froren also ALLE Schafe ein, während die Sim sie
weiterbewegte (sichtbarer Desync; Regressions-Beweis: Testlauf mit
revertiertem Fix zeigt Knoten bei Spawn-Position statt Sim-Position).
**Fix:** Schleife nach `herde_schaf_optik.gd` (`RanchHerdeSchafOptik.tick`,
statisch/pur) extrahiert und in `_step_optik()` JEDEN Frame aufgerufen —
`herde_game.gd` stand exakt am 1000-Zeilen-Deckel, daher Datei-Split statt
Inline-Umzug (Preflight-Regel: aufteilen, kein Disable).

### 6. ranchHerde: HUD ohne _ui-Skalierung (FIXED)

`_layout_hud()` hatte dieselben festen 16/10/48-px-Offsets. **Fix:**
M9-Muster wie oben.

## Ohne Befund (geprüft, i. O.)

- **SFX-Deckung:** alle verwendeten Sound-IDs existieren in
  `sfx_map.gd`/`feel_sfx.gd`; Rundenenden klingen (Host `results.gd` spielt
  `game_win`/`game_lose`, teaParty zusätzlich `mg_win`/`mg_lose` via M8).
- **Win/Lose-Enden:** `endless_should_end`-Pfade der auditierten Spiele
  decken sich mit den `supports_endless`-Flags der Registry; kein Spiel
  kann hängen (Zeit-Deckel + Fehler-Deckel).
- **Kamera:** teaParty (establish-Totale == Spielpose), veggieChop
  (`frame()` pixelgenau auf `_to_screen`), basketBounce (`_frame_court`
  rahmt Korb+Wurflinie in beiden Orientierungen) — keine Findings.
- **ranchTonnen/ranchZeit:** SFX-Ketten (`ui_confirm`, `mg_go`, `mg_spill`,
  `mg_win`) und `zu_langsam`-Strings vorhanden.

## Wächter-Tests (`tests/unit/test_h_minigames.gd`, 5 Tests)

- `test_tea_spill_serviert_keine_ghost_tasse` — Spill lässt die Ghost-Tasse
  inaktiv, Perfect serviert sie (fiel vor dem Fix).
- `test_veggie_chop_hud_skaliert_mit_ui_faktor`,
  `test_garden_rush_hud_skaliert_mit_ui_faktor`,
  `test_basket_bounce_hud_skaliert_mit_ui_faktor` — Faktor 1 auf dem Phone,
  Kurzkante/390 auf iPad quer, Deckel 3,0/Boden 0,75, Labels tragen die
  skalierten Fontgrößen, Hints bleiben zentriert.
- `test_herde_schafe_folgen_der_sim_ohne_fahne` — Schaf-Knoten spiegeln die
  Sim bei unsichtbarer Fahne (fiel vor dem Fix) + HUD-Skalierung.

Regressions-Beweis: mit `git stash` der Fixes fielen genau die beiden
Verhaltens-Tests (tea + herde), mit Fixes sind alle 5 grün.
