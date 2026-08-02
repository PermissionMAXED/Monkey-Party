# Playtest H — Ranch & Reise/Urlaub (Fable Playtester)

Playtest der beiden großen Ausflugs-Systeme: **Reise/Urlaub** (Handy-App →
Buchen → Abflug-Cutscene → Postkarten → Abholung/Reunion) und **Ranch**
(Level-15-Angebot → Überlandfahrt → Kauf am Tor → Hof-Loop mit Galopp,
Pferdepflege, Ausritt in die offene Region). Gespielt über zwei neue
Headless-Flows im Playtest-Harness (echter Boot inkl. Onboarding,
synthetische Taps, Screenshot je Schritt):

- `tests/tools/playtest_flows/flow_urlaub_reise.gd` — Buchung, Abflug,
  Zeitraffer über die gepinnte Uhr (Postkarte, returnReady), Abholung,
  Reunion-Werte. **Endlauf: 47/47 Schritte grün.**
- `tests/tools/playtest_flows/flow_ranch_kauf.gd` — Angebot, echte Fahrt
  bis ans Tor, Kauf (−2500 ᴳ, Start-Tiere), Galopp, Heu füttern,
  Ausreiten + Rückweg. **Endlauf: 30/30 Schritte grün.**

Wächter-Tests: `tests/unit/test_h_ranch_travel.gd` (12 Tests).

## Befunde & Fixes (7 gefixt)

### 1. Reise: „Gute Reise!“ strandete den Spieler am Flughafen (BLOCKER, FIXED)

`reise_app.gd/_on_gute_reise()` schloss das PanelSheet SOFORT — `close()`
räumt den Öffner-Layer samt ReiseApp noch im selben Frame ab, und mit der
App starb die `fertig`-Verbindung der Abflug-Cutscene. `_on_cutscene_fertig`
(Buchung + Heimweg) lief NIE: Geld bezahlt, kein Urlaub gebucht, App zu.
**Fix:** Sheet wird beim Abflug nur versteckt; `close()` läuft erst im
Cutscene-Finale nach Buchung + Taxi-Abschluss.

### 2. Reise: `ranch`-Pendant im Urlaub — Reunion füllte nur `energy` (FIXED)

Die Abholung setzte nur `energy` auf 100. Web-Vertrag
(`economy.js completeVacationPickup`, `Vacation.PICKUP_STAT_FILL`): ALLE
vier Werte (hunger/energy/hygiene/fun) auf 100. **Fix:** `_on_abholen`
füllt alle Stats.

### 3. Reise: Overdue-Taxi mit < 60 ᴳ war GRATIS (FIXED)

`Economy.spend` ist atomar (alles oder nichts) — bei < 60 ᴳ buchte die
verspätete Abholung GAR NICHTS ab: Freifahrt für arme, voller Preis für
reiche Spieler. Web (`payTaxiReturn`): „der Fahrer nimmt, was da ist“.
**Fix:** `ReiseLogic.taxi_gebuehr(coins)` deckelt die Gebühr an der Kasse.

### 4. Ranch: Pferdepflege + Hofladen waren NIRGENDS montiert (FIXED)

`RanchPflegeScreen` (Füttern/Tränken/Striegeln/Ausmisten) und
`RanchAusbauPanel` (Hofladen) waren fertig gebaut, aber kein Screen im
Spiel öffnete sie — toter Content. **Fix:** `ranch_hof_scene.gd` hängt nach
dem Kauf „Pflege“ + „Hofladen“ in die Fuß-Leiste des Hof-HUDs (Overlay im
HudLayer, `back_pressed` räumt ab; i18n de/en in `ranch_play.json`).

### 5. Reise: Urlaubs-Maschine tickte nur beim Boot (FIXED)

`GoobyTicker._live_tick_core` kehrte bei `Vacation.is_away` früh zurück —
`Vacation.tick` lief NUR im Offline-Catch-up. Postkarten, returnReady und
overdue kamen erst nach App-Neustart an (Web tickt vacation im 1-s-Takt,
`core/timeEngine.js`). **Fix:** `_vacation_live_tick` im Live-Takt, gleiche
Event-Strings wie `offline.gd` („vacationPostcard“ …).

### 6. Ranch: `ranch`-Slice fehlte im Produktions-Boot (BLOCKER, FIXED)

`DEFAULT_SLICE_SCRIPTS` (game_state.gd) kannte `ranch` nicht und KEIN
Produktions-Code rief `RanchState.register_slice()` — nur Tests. Auf jedem
frischen Save fehlte `state["ranch"]` komplett. Folgen (alle im
Playtest-Log belegt):

- `RanchState.angebot_gesehen/verschieben` starben mit SCRIPT ERROR
  (`Invalid access to key 'ranch'`) — das Angebot-Flag landete nie im Save.
- `RanchKauf.kaufe` brach NACH `Economy.spend` mitten im update ab:
  **Münzen weg, Ranch nicht gekauft** (die versprochene Atomarität war
  gebrochen; im Lauf rettete nur ein zufälliger Fremd-Heal
  (`rquest_state._speichere`: `state["ranch"] = {}`) den Kauf).
- Der Fremd-Heal ist ein Torso ohne `wirtschaft`: der frische Hof hatte
  **0 Heu / 0 Äpfel statt 4/2** — „Heu füttern“ war tot geschaltet
  (exakt der `heu_wirkt`-Timeout des ersten Laufs).

**Fix:** `ranch` steht in `DEFAULT_SLICE_SCRIPTS`; zusätzlich heilt
`RanchState.heile_slice(state)` den Slice defensiv IN den Schreib-Lambdas
(Kauf + Angebot) — „Geld weg, keine Ranch“ ist damit strukturell
ausgeschlossen. Folge-Anpassung: `test_rquest_state` erwartet die
Apfel-Belohnung jetzt als Delta (frischer Save startet regulär mit 2).

### 7. Ranch-Region: Wegweiser-Schrift spiegelverkehrt (FIXED)

Das eine Label3D pro Wegweiser-Brett saß auf der +X-Seite, seine FRONT
zeigte aber INS Brett (`rotation.y = -PI/2`) — Spieler lasen „Blubberbach
325 m“ & Co. nur als double-sided-Spiegelschrift. **Fix:**
`ranch_wegenetz.gd` beschriftet beide Brettseiten, Front jeweils nach
außen, `double_sided = false`.

## Harness-Ausbau

`playtest_harness.gd/_scrolle_ins_bild`: Tipp-Ziele werden vor dem Tap in
ihren ScrollContainer-Vorfahren eingerollt (`ensure_control_visible`).
Vorher tippte der Harness den Rect-Mittelpunkt „unter der Falz“ — der Tap
traf den Scrim NEBEN dem PanelSheet und schloss es (Reise-Flow, Schritt
„Ziel wählen“).

## Flow-Korrekturen (Test-Seite, keine Spiel-Bugs)

- Kassen-Prüfung des Ranch-Kaufs rechnet als Delta ab dem Tor-Sheet: der
  Level/Münzen-Cheat selbst löst die Erfolge `coins1000` (+50 ᴳ) und
  `level10` (+100 ᴳ) aus.
- Der Rückweg-Knopf der Region heißt „Zum Hof“ (der i18n-Key
  `rwelt.hud.zur_ranch` täuscht).
- „Glitzermeer — “ (mit Gedankenstrich) trifft nur den Buchungs-Knopf,
  nicht die Abflugtafel; Einfeder-Wartezeiten fürs animierte Sheet.

## Wächter-Tests (`tests/unit/test_h_ranch_travel.gd`, 12 Tests)

- `test_gute_reise_finale_ueberlebt_das_sheet` — App überlebt die
  Cutscene, Finale bucht (fiel vor Fix 1).
- `test_live_tick_bringt_postkarten_und_phasenwechsel` — Postkarte +
  returnReady kommen LIVE, Werte bleiben eingefroren (fiel vor Fix 5).
- `test_taxi_gebuehr_an_der_kasse_gedeckelt`,
  `test_abholung_overdue_arm_faehrt_nicht_gratis`,
  `test_abholung_overdue_reich_zahlt_volle_gebuehr` — Gebühren-Deckel
  (fiel vor Fix 3).
- `test_abholung_fuellt_alle_vier_werte` — Reunion-Kontrakt (fiel vor
  Fix 2).
- `test_hof_hud_pflege_und_hofladen_nach_kauf`,
  `test_hof_hud_vor_dem_kauf_ohne_pflege_knoepfe`,
  `test_hud_strings_de_en` — Einbau + Gating der RANCH-2-Screens (Fix 4).
- `test_produktions_boot_bringt_ranch_slice_mit` — echter Boot-Pfad
  registriert `ranch`, frisches Lager 4 Heu/2 Äpfel, `angebot_gesehen`
  crasht nicht mehr (fiel vor Fix 6).
- `test_kauf_heilt_fehlenden_slice_atomar` — Worst Case ohne Slice: Kauf
  heilt und bucht exakt einmal (fiel vor Fix 6).
- `test_wegweiser_labels_beidseitig_nach_aussen` — Label-Fronten zeigen
  vom Brett weg, keine double-sided-Rückseite (fiel vor Fix 7).

## Beleg-Läufe

- `flow_ranch_kauf` h_ranch_lauf2: **30 ok / 0 fail** (vorher 27/3 mit
  SCRIPT ERROR im Log; Pflege zeigt „Vorrat: 3 Heu · 2 Äpfel“ nach dem
  Füttern, Hunger 100, Wegweiser lesbar).
- `flow_urlaub_reise` h_reise_lauf5: **47 ok / 0 fail** (Buchung,
  Abflug-Cutscene, Postkarte im Zeitraffer, Abholung, alle vier Werte 100).
- Preflight (format, lint, Import-Gate, 3507 Tests, W1c-Runner,
  Boot-Smoke): **grün**.
