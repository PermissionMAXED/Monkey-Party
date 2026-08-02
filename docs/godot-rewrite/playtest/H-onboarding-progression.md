# Playtest H — Onboarding + Quests/Progression-Rest (Fable Playtester)

Onboarding/Progression-Tranche der Welle H: der W1c-Onboarding-Dialog
(Name/Spitzname/Editor), die handlungsgeführte Erste-Viertelstunde-Tour
(`OnboardingGuide`, 9 Schritte), der Tagesbonus und die Tagesquests
(3-Karten-Brett, Reroll, Bonus) samt XP-Anzeige. Werkzeug: ein NEUER,
dauerhafter Playtest-Flow `flow_onboarding_tour` (34 Schritte), der die Tour
WIRKLICH spielt statt sie wegzutippen — Ankunft bestätigen, den Gooby per
3D-Tap echt streicheln (Auto-Erfüllung + Feier), die restlichen
Tu-es-Schritte wie ein ungeduldiger Spieler überspringen, Ausblick
bestätigen (`guide.done` im Save), dann Tagesquests öffnen, 3 Karten
prüfen, 1×-Reroll (`quests.rerolledDay`). Dazu Code-Audits
(`onboarding_logic`, `onboarding_guide[_logic]`, `quest_engine`,
`quest_service`, `leveling`) und die Bestands-Tests
(`test_rest2_onboarding_guide`, `test_rest2_quest_engine`,
`test_ui_onboarding*`). Läufe: `run_playtest.sh flow_onboarding_tour
2868x1320` — 34/34 OK, 0 SCRIPT ERRORs.

## Befunde & Fixes (3 gefixt)

### 1. Erste Tour-Karte fror bildschirmfüllend ein (FIXED)

Die allererste Ankunfts-Karte („{nickname} zieht ein!“) stand vom oberen
Rand bis UNTER die Bildschirmkante — Schritt-Zeile und ×-Knopf abgeschnitten,
der halbe Raum verdeckt; erst der nächste Schritt zog die Karte auf
Normalgröße. Ursache: Autowrap-Labels melden ihr Höhen-Minimum erst nach dem
ersten Container-Sort korrekt (vorher wird bei Breite 0 gemessen →
Riesenhöhe), und der Zwei-Frame-Settle (`_relayout_settled`) kam beim
allerersten Einblenden zu früh (Raum lädt noch, Karte zwischendurch
versteckt) — die eingefrorene Riesenhöhe blieb stehen, nichts zog sie je
nach. **Fix:** Die Karte zieht ihre Größe jetzt bei JEDER Minimum-Änderung
nach (`minimum_size_changed` → deferred `_relayout`, Muster
hud.gd-Coachmark) und relayoutet zusätzlich beim Wiederauftauchen
(`visibility_changed`), weil sich Minima ändern können, während sie
versteckt ist (Travel/Overlay).

### 2. HUD-Coachmark „Deine Knöpfe“ konkurrierte mit der Tour (FIXED)

Während der kompletten Tour stand der Erststart-Coachmark „Deine Knöpfe“
(hud.gd) NEBEN bzw. ÜBER der Tour-Karte — zwei konkurrierende Erklär-Karten
gleichzeitig im Erststart, teils überlappend. Zwei Lücken: (a)
`_maybe_show_coachmark` kannte die Tour nicht (die WhatsNextHint-Regel aus
`quest_service` fehlte hier), und (b) home_entry zeigt das HUD VOR
`OnboardingGuide.attach_to` — der Coachmark stand also schon, bevor die
Tour überhaupt da war. **Fix:** `_maybe_show_coachmark` schweigt, solange
die Gruppe `onboarding_guide` besetzt ist, und hängt sich ans Tour-Ende
(`tree_exited`, deferred); wacht die Tour später auf, ruft sie
`call_group(&"hud", &"retract_coachmark")` — der Coachmark zieht sich
zurück OHNE `hints.hud_actions_seen` zu setzen und kommt nach der Tour
einmalig dran (gestaffelter Erststart statt Karten-Gedränge).

### 3. Toasts lagen mitten auf der Tour-Karte (FIXED)

Der „Neuer Sticker: Sommersonne!“-Toast (Erststart-Sticker) lag quer über
Titel und ×-Knopf der Tour-Karte — beide wollen oben mittig sitzen. Der
Toast-Layer weicht seit W14 der „Was nun?“-Karte aus
(`toast.gd/_dodge_hint_card` über Gruppe `wasnun_karte`), die Tour-Karte
war aber nie Mitglied. **Fix:** `GuideKarte` tritt der Gruppe bei
(`WhatsNextHint.CARD_GROUP`) — Toasts rutschen jetzt unter ihre Unterkante.

## Ohne Befund (geprüft, i. O.)

- **Onboarding-Dialog (W1c):** Name/Spitzname/Editor/Fertig führt sauber
  nach `home/living`; Sondereingaben deckt `test_ui_onboarding*` ab.
- **Tour-Mechanik:** Echtes Streicheln (2 Taps auf die wandernde
  `GoobyTapArea`) erfüllt Schritt 2 automatisch (Feier-Karte + Funkeln +
  Weiterschalten); jeder Tu-es-Schritt einzeln überspringbar; Ausblick →
  `guide.done` + Konfetti; Resume/Alt-Save-Heuristik über
  `test_rest2_onboarding_guide` grün.
- **Tagesbonus:** „Abholen!“-Popup erscheint nach der Ankunft und räumt
  sich sauber weg (Flow-Schritt `tagesbonus_abholen`).
- **Tagesquests:** Brett trägt deterministisch 3 Karten
  (`quests.active`), Reroll tauscht nur unangefasste Aufgaben und setzt
  `quests.rerolledDay` (1×/Tag), Bonus-Zeile („Alle drei schaffen…“) und
  XP-Ausweis pro Karte intakt; Engine-Determinismus/Claim/Doppel-Claim
  über `test_rest2_quest_engine` grün.
- **„Was nun?“-Hinweis:** hielt während der Tour den Mund und übernahm
  danach („Tagesquest: Einkaufsbummel“) — Regel aus `quest_service` wirkt.

## Wächter-Tests (`tests/unit/test_h_onboarding_tour.gd`, 7 Tests)

- `test_karte_settlet_auf_echte_groesse` — Karte endet auf dem gesettelten
  Autowrap-Minimum, nie über dem Bildrand.
- `test_karte_zieht_groesse_beim_wiederauftauchen_nach` — versteckt +
  eingefrorene Riesenhöhe → Wiederauftauchen relayoutet.
- `test_karte_folgt_minimum_aenderungen` — mehr Text wächst mit, kurzer
  Text schrumpft zurück (kein Einfrieren nach oben).
- `test_karte_ist_in_der_toast_ausweich_gruppe` — Toast-Dodge greift.
- `test_coachmark_wartet_bis_die_tour_vorbei_ist` — Tour da → kein
  Coachmark; Tour weg → Coachmark einmalig, Wegtippen setzt das Flag.
- `test_coachmark_zieht_sich_zurueck_wenn_die_tour_spaeter_aufwacht` —
  echte Boot-Reihenfolge (HUD zuerst): Rückzug ohne Flag, Wiederkehr danach.
- `test_coachmark_respektiert_gesehen_flag` — gesehen → nie wieder.

Regressions-Beweis: mit gestashten Fixes fallen 4 der 7 Wächter
(Wiederauftauchen, Toast-Gruppe, beide Tour-Coachmark-Tests); die übrigen
drei sind bewusst in beiden Welten grün (Invarianten-Wächter). Mit Fixes:
alle 7 grün, `test_rest2_onboarding_guide`/`test_rest2_quest_engine`/
W1c-Suite (26 631 Checks) unverändert grün; Playtest-Lauf 34/34 OK.
