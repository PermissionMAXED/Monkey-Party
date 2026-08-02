# Playtest H-arcade-friends — Arcade, Freunde & Profil

Playtest-Durchlauf der Arcade- (Grid → Pregame → Host → Pause/Beenden →
Results), Freunde- (FriendsService/FriendsScreen/„Freunde & Besuche“) und
Profil-Flows (Pass, Statistik, Rekorde, Erfolge-Sprung). Gespielt über ZWEI
Headless-Flows im Playtest-Harness — der bestehende `flow_arcade` (27
Schritte: Teestube spielen, gießen, pausieren, beenden) und der NEUE
`flow_profil_freunde` (21 Schritte: Profil → Erfolge → zurück → „Freunde &
Besuche“ → nach Hause), beide grün auf 1320×2868. Dazu Netz-Protokoll-Repros
gegen den Server-Vertrag (`GOOBY-SERVER/src/friends.js`, Mutual-Autoaccept)
im NetTestRig. Alle 3 Funde wurden GEFIXT und mit 4 neuen Wächter-Tests
dauerhaft abgesichert.

## Funde & Fixes

### 1. Tote „Anfrage von X“-Karte nach Mutual-Autoaccept (Netz-Bug, MITTEL)

**Repro:** A schickt B eine Freundschafts-Anfrage, während von B bereits
eine Anfrage an A offen ist. Der Server befreundet beide sofort
(`makeFriends` in `GOOBY-SERVER/src/friends.js` löscht BEIDE Requests und
pusht nur `FRIEND_ADDED`). Bei A erscheint die neue Freundin in der Liste —
aber die alte „Anfrage von B“-Karte bleibt stehen. „Annehmen“ darauf läuft
ins Server-`NOT_FOUND`, die Karte verschwindet nie (bis zum Reconnect).

**Befund:** `FriendsService._on_push` behandelte `FRIEND_ADDED` nur als
Freundeslisten-Upsert; die serverseitig mitgelöschte Gegen-Anfrage wurde
clientseitig nie aus `requests` gespiegelt.

**Fix (`scripts/net/friends_service.gd`):** `FRIEND_ADDED` räumt jetzt die
passende Anfrage (`from == friendCode`) mit ab. `_remove_request` meldet
`requests_changed` nur noch bei ECHTER Änderung — Pushes ohne Gegen-Anfrage
lösen keinen sinnlosen UI-Neuaufbau mehr aus.

### 2. Profil zeigte „Rekord 0“ trotz gespielter Runden (Anzeige-Bug, MITTEL)

**Repro:** Ein Spiel NUR auf Leicht/Schwer (oder Endlos) spielen → Profil →
Minispiel-Rekorde: „Rekord 0 · Runden n“.

**Befund:** `ProfilScreen._build_minigames_card` las ausschließlich
`minigames.legacy.best` — das ist per §G5.7-4 nur das MITTEL-Board
(Normal-Modus). Leicht/Schwer landen in `legacy.bestByDiff`, Endlos in
`legacy.endlessBest`; alle drei wurden ignoriert.

**Fix (`scripts/minigames/framework_logic.gd`,
`scripts/ui/profil/profil_screen.gd`):** neuer purer Reader
`MinigameFrameworkLogic.best_overall(state, id)` (Maximum über
best ∪ bestByDiff.easy/hard ∪ endlessBest, hostile-State-fest); die
Rekordzeile des Profils nutzt ihn statt des rohen `legacy.best`-Griffs.

### 3. Annehmen/Ablehnen: Erfolgston VOR der Antwort, Fehler stumm (UX, KLEIN)

**Repro:** Anfrage-Karte antippen, während der Server ablehnt (z. B.
`NOT_FOUND` durch Fund 1, `RATE_LIMIT` oder Verbindungsabriss mitten im
Request): Es klingt nach Erfolg (Confirm-Sound + Haptik), dann passiert —
nichts. Die Karte bleibt kommentarlos stehen.

**Befund:** `FriendsScreen._on_accept_pressed`/`_on_decline_pressed`
spielten Sound/Haptik VOR dem `await` und werteten das Ergebnis nicht aus —
ein Verstoß gegen die eigene AUDIO-GRAMMATIK „Outcome schlägt Press“, die
`_on_add_pressed` im selben File korrekt umsetzt.

**Fix (`scripts/ui/friends/friends_screen.gd`):** Beide Handler warten die
Antwort ab: Erfolg → Confirm/Back-Sound (+Haptik beim Annehmen); Fehler →
Fehlerton + `NetErrorText`-Feedbackzeile + `refresh()`, der veraltete
Zeilen über den frischen `FRIENDS_STATE` wegräumt (Selbstheilung für
Alt-Sessions, die Fund 1 noch in der Liste haben).

## Verifikation

- Neu: `flow_profil_freunde` (Playtest-Harness) — Profil/Erfolge/„Freunde &
  Besuche“ wie ein Spieler; Lauf `profil_freunde_h`: 21/21 Schritte OK.
- Bestand: `flow_arcade` — Lauf `arcade_h`: 27/27 Schritte OK (Teestube
  spielen inkl. Pause/Weiter/Beenden; Grid, Pregame-Bestwert und
  Zähler-Kapsel „38 Spiele“ geprüft).
- 4 neue Wächter-Tests: `test_net_friends.gd::
  test_friend_added_push_raeumt_gegenanfrage` (Fund 1),
  `test_mg_framework_logic.gd::test_best_overall_maxt_ueber_alle_modi` +
  `test_rest1_profil.gd::test_profil_rekordzeile_nutzt_alle_modi` (Fund 2),
  `test_net_friends_ui.gd::test_accept_fehler_zeigt_feedback_und_resynct`
  (Fund 3).
- Voller Runner `tests/run_tests.gd`: Exit 0 (failed=0);
  `tests/unit/run_w1c_tests.gd`: Exit 0.
- `gdlint` + `gdformat --check` auf allen angefassten Dateien sauber.
