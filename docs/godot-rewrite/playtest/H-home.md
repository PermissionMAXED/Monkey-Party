# Playtest H-home — Zuhause & Pflege

Playtest-Durchlauf der Home-/Care-Flows (Doc F): Füttern (Kühlschrank +
Nougatschleuse), Schlafen/Nickerchen/Wecken am Bett, Bad-Suite (Klo, Dusche,
Zähneputzen), TV, Stat-Verfall über den GoobyTicker. Getestet headless über
gezielte Logik-Reproduktionen (Muster `test_state_gooby_ticker`/
`test_bad_state`) plus Code-Walkthrough der Interactable-Pfade gegen die
Web-Referenz (`GOOBY/src/home/interactions.js`); alle Funde wurden GEFIXT
und mit `tests/unit/test_h_home_playtest.gd` (7 Tests) dauerhaft
abgesichert.

## Funde & Fixes

### 1. Zähneputz-Pflicht wurde nie gesetzt — Feature tot (Bug, GROSS)

**Repro:** Gooby schlafen legen → Schlaf ausschlafen lassen (oder sanft
wecken) → ans Waschbecken gehen: keine Warte-Pose, kein `needsBrushing`.

**Befund:** `BadState.mark_woke_up()` („nach dem Aufwachen wird Zähneputzen
Pflicht“, Doc F §3.2) existierte samt Tests — aber KEIN Produktionspfad
rief sie auf. `bad.needsBrushing` blieb ewig `false`: die Warte-Pose am
Waschbecken (`zahnputz.gd`) und der dort verankerte Pflege-Loop waren nur
aus Tests erreichbar; Zähneputzen ging zwar manuell per Tap, aber der
Mandats-Flow (Gooby wartet sichtbar am Becken) lief nie an.

**Fix (`scripts/state/gooby_ticker.gd`, `scripts/home/interactables/bett.gd`,
`scripts/home/interactables/bad_state.gd`):** Der Ticker ist der EINE Ort,
an dem beide `wokeUp`-Quellen vorbeikommen — `catch_up()` (Offline-Schlaf)
und `live_tick()` (Auto-Wecken) markieren die Pflicht jetzt über die neue
pure Variante `BadState.mark_woke_up_state(state)` (der Ticker arbeitet
direkt auf dem State-Dict, dort gibt es kein `gs.update`). Das frühe
manuelle Wecken (`wokeEarly`) setzt sie im Bett-Panel
(`bett.gd::_on_wake_chosen` → `BadState.mark_woke_up(gs)`).

### 2. Pflege-Taps rissen den Schläfer aus dem Bett (UX, MITTEL)

**Repro:** Gooby schlafen legen → Kühlschrank (oder Klo/Dusche, Waschbecken,
TV) antippen: Gooby wird zum Möbel gezogen/unsichtbar geschaltet, während
der `PflegeRunner` ihn alle 2 s zurück ins Bett snappt — sichtbares
Ping-Pong; die Fütter-/Dusch-Sequenz läuft mit „Geister-Gooby“ weiter.
Zusätzlich: der Auto-Klo-Gang (`KloDusche._process`, alle 5 s geprüft)
feuerte auch MITTEN im Schlaf und im Baumodus, und die Zahnputz-Warte-Pose
hätte (mit Fix 1) den Schläfer ans Becken gezerrt.

**Befund:** Die Web-Referenz gated JEDEN Pflege-Tap über `blockedBySleep`
(`GOOBY/src/home/interactions.js` + Toast `toast.sleeping`); im
Godot-Port hatte nur die Nougatschleuse eine Schlaf-Refusal — Kühlschrank,
Klo/Dusche, Zahnputz und TV prüften nur `_room_busy()` (Baumodus). Die
`_process`-Routinen (Auto-Klo, Warte-Pose) prüften weder Schlaf noch
Baumodus.

**Fix (`interactables_host.gd` + 4 Interactables):** Neuer geteilter Gate
`InteractablesHost.gooby_sleeping()` (liest `Sleep.is_sleeping` auf dem
gooby-Slice). `Kuehlschrank`/`KloDusche`/`Zahnputz`/`Fernseher` weisen Taps
im Schlaf freundlich ab (bestehende Zeile `home.suche.schlaeft` — „Psst…
ich träum grad von einer Riesenmöhre…“, keine neuen Strings nötig).
`KloDusche._process` (Auto-Klo) und `Zahnputz._process` (Warte-Pose)
pausieren im Schlaf UND im Baumodus; Timer/Pflicht bleiben bestehen und
greifen nach dem Aufwachen. Das Bett bleibt bewusst tappbar (Sanft-Wecken
läuft über sein Panel), die Nougatschleuse behält ihre eigene knuffige
Refusal-Zeile.

### 3. Nougatschleuse: laxer `== true`-Schlaf-Check (Robustheit, KLEIN)

**Repro (Junk-Save):** `gooby.sleep.sleeping = 1` (int statt bool) →
Schleuse verweigert „schläft“, während Kühlschrank/HUD/PflegeRunner
denselben Gooby überall als WACH behandeln.

**Befund:** `NougatLogic.can_glob` las `sleep.get("sleeping", false) == true`
— genau das Muster, das `Sleep.is_sleeping` (strict-bool, Schema-
`_is_true`-Semantik) nach einem früheren BUGHUNT-Fund absichtlich vermeidet:
Junk-Werte zählten inkonsistent, ein String-Wert wäre ein
Godot-4-Laufzeitfehler-Risiko (`String == bool`).

**Fix (`scripts/logic/nougat_logic.gd`):** `SleepLogic.is_sleeping(gooby)`
statt des nackten Vergleichs — EINE Schlaf-Sicht für alle Systeme.

## Verifikation

- Neu: `tests/unit/test_h_home_playtest.gd` — 7 Tests decken alle drei
  Fixes ab (Pflicht via Live-Tick/Offline-Catchup/Sanft-Wecken; Tap-Gates
  aller vier Pflege-Interactables inkl. Abweisungs-Zeile; Auto-Klo- und
  Warte-Pose-Pause in Schlaf/Baumodus samt Nachhol-Lauf; strict-bool
  Nougat-Refusal konsistent zu `Sleep.is_sleeping`).
- Voller Runner `tests/run_tests.gd`: 3490 Tests, 3 rot — alle 3 in
  fremden, parallel in Arbeit befindlichen Dateien (`test_asset_intake`,
  `test_h_minigames`; Asset-Pivots/Minigame-HUD, nicht Home/Care) und
  unabhängig von diesen Fixes. Betroffene Bestands-Suiten grün:
  `test_bad_state`, `test_state_gooby_ticker`, `test_ef1_pflege`,
  `test_w13_food_nougat`, `test_w13c_gobty` (44/44).
- W1c-UI-Runner (`run_w1c_tests.gd`): failed=0.
- `gdlint` + `gdformat --check` auf allen angefassten Dateien sauber.
