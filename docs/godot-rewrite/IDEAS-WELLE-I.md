# IDEAS-WELLE-I — Welle I: die konsolidierte 30+-Ideen-Roadmap (Fable)

Auftrag aus `UserFeedback.md` („Welle I: 30+ Ideen-Planner"): priorisierte Ideen über
alle Spielbereiche, konsolidiert zur Roadmap. Diese Runde lief als **EIN
Konsolidierungs-Planner, der alle 10 Planner-Bereiche abdeckt** (statt 10 parallel) —
das Ergebnisformat ist identisch: 10 Bereichs-Kapitel (§2), eine Gesamt-Rangliste (§3)
und die Gruppierung in Umsetzungs-Wellen (§4). Geliefert: **50 konkrete Ideen**
(gefordert: 30+).

Grundlagen (alles gegen den echten Stand geprüft, nichts doppelt zu Geliefertem):
`UserFeedback.md` (offene Punkte + G6-Queue), `STATUS.md` (ehrlicher Ist-Stand),
`EVAL-VOLLSTAENDIGKEIT.md` (Restpunkte), `GODOT-PLAN.md` §6 (Backlog),
`DLC-GOO-UND-BYE.md` + `DLC-MCGOOBY.md` (Welle-B-Design steht bereits),
`RANCH-DLC-IDEAS-1…4` (Ranch-Tiefe), `USER-WISHES.md` (verbatim User-Wünsche).

**Aufwand ist immer nur S/M/L** (Umfang/Risiko/betroffene Systeme) — niemals
Kalenderzeit (Konvention seit `RANCH-DLC-IDEAS-1.md`).

---

## 1) Bewertungsschema

| Feld | Bedeutung |
|---|---|
| **Wow (1–5)** | Wie stark spürt der Spieler die Idee? 5 = „davon erzählt man Freunden", 1 = unsichtbare Hygiene |
| **Aufwand (S/M/L)** | S = wenige Dateien/bestehende Systeme, M = neues Modul auf Bestand, L = mehrere Systeme/Netz/neue Szenenfamilie |
| **Score** | Wow − Aufwandspunkte (S=0, M=1, L=2). Sortier-Hilfe für „Wow pro Aufwand" — Pflicht-Hygiene läuft außer Konkurrenz |

Leitplanken (gelten für JEDE Idee): offline-first, eine Währung, alles erspielbar,
kein FOMO, keine offenen Chats, Zeit/Zufall injiziert (Clock/RNG-Muster), DE führend
mit EN-Parität, Pack-updatebar wo sinnvoll.

---

## 2) Die 10 Planner-Bereiche (je 5 Ideen)

### Planner 1 — Gooby-Seele & Momente

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-01 | **Goobys Tagebuch** — abends schreibt Gooby knuffige Einträge aus dem echten Erinnerungs-System (`soul`-Erlebnisse), am Schreibtisch lesbar, beste Einträge als Postkarte teilbar | 4 | M | 3 |
| I-02 | **Begrüßungs-Ritual** — geheimer Handschlag beim ersten Öffnen des Tages; wächst mit der Beziehung (neue Moves ab Meilensteinen), 10 s pure Zuneigung | 3 | S | 3 |
| I-03 | **Traum-Dioramen** — während Gooby schläft schwebt eine Traumblase mit einer Miniatur-3D-Szene aus einem Tageserlebnis über dem Bett (deterministisch aus dem Erlebnis-Log) | 4 | M | 3 |
| I-04 | **Gobster, das Haustier fürs Haustier** — Gooby pflegt selbst ein Mini-Tierchen im Glas (Käfer/Schnecke); Meta-Gag, der den Care-Loop spiegelt („Gooby, hast DU gefüttert?") | 4 | M | 3 |
| I-05 | **Jahreszeiten-Feste** — 4 Kalender-Feste (Frühlingsblüte, Sommerlaternen, Herbstfest, Winterlichter): Stadt-/Haus-Deko wechselt, Fest-Quests, exklusive Sticker; deterministisch nach Datum, Inhalte als Content-Pack | 5 | L | 3 |

### Planner 2 — Haus, Bau & Garten

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-06 | **Echter CEILING-Layer** — Decken-Items nicht mehr als WALL-Umweg (Backlog D); Voraussetzung für Girlanden-/Lampen-Ausbau | 2 | M | 1 |
| I-07 | **Keller + 2. Etage + Balkon** — die großen Haus-Upgrades (expliziter User-Wunsch, M3-Backlog D) mit Treppen-Bau-Cutscene im Gooby-hämmert-Qualm-Stil | 5 | L | 3 |
| I-08 | **Zimmer-Codes** — Raum-Layout als Code exportieren/importieren; Freunde bauen Zimmer nach, Vorlagen-Foto landet im Album | 3 | M | 2 |
| I-09 | **Schaugarten-Wettbewerb** — wöchentliches Garten-Thema („Nur Gelb!"), NPC-Jury läuft durch und bewertet knuffig, Rosetten als Deko-Belohnung | 4 | M | 3 |
| I-10 | **Aquarium-Möbel** — gefangene Fische aus dem Sammelset schwimmen sichtbar im kaufbaren Aquarium, Fütter-Interaktion inklusive; macht das Angeln dauerhaft wertvoll | 4 | M | 3 |

### Planner 3 — Stadt & Orte

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-11 | **Stadtfest-Wochenende** — 1×/Monat verwandelt sich der Marktplatz (Stände, Girlanden, Abend-Feuerwerk), 2 Fest-Stände mit Mini-Aktionen; nutzt die frischen „Läden lebendig"-Bausteine (`ort_leben.gd`) | 4 | M | 3 |
| I-12 | **Stadt-Polish-Rest** — Ziel-GPS-Pfeil, Near-Miss-Funken, sichtbarer Guber-Surge-Gag (Backlog-E-Rest in einem Rutsch) | 2 | S | 2 |
| I-13 | **Friseursalon „GOOBHAAR"** — neuer Ort: Styling mit Stuhl-Dreh-Cutscene, Vorher/Nachher-Spiegel-Gag, Frisuren als Cosmetics-Pack | 4 | M | 3 |
| I-14 | **Buslinie 1** — günstige Taxi-Alternative: Haltestellen, Fahrplan-Gag, Warten im Bushäuschen mit Mitfahrer-NPCs; Bus verpassen ist ein Gag, keine Strafe | 3 | M | 2 |
| I-15 | **Ambient-Audio-Distrikte** — eigener Klangteppich je Viertel (Markt-Gemurmel, Park-Vögel, Bahnhofs-Halligkeit); M3-Backlog E, passt zum Audio-Feel-Paket | 2 | M | 1 |

### Planner 4 — Minispiele & Arcade

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-16 | **City-Drive-Feinschliff** — 3-Strikes-Cutscene + Auto-Stats-Anzeige in ALLEN Fahr-Spielen (Backlog-G-Rest; die Arcade-Runde selbst ist seit W13 da) | 3 | S | 3 |
| I-17 | **Wochen-Challenge** — jede Woche EIN Spiel mit fixem Seed + Modifikator, Freunde-Ghost-Leaderboard (Ranch-Ghost-Muster wiederverwenden); offline spielbar, online vergleichbar | 4 | M | 3 |
| I-18 | **Pokal-Abend** — lokaler Turniermodus: 4 zufällige Spiele, Zwischenstand-Tafel, Pokal-Zeremonie mit Konfetti; perfekt für Couch-Runden | 4 | M | 3 |
| I-19 | **Chaos-Modus** — Modifikator-Glücksrad vor dem Start dreht 2 zufällige Modifikatoren (Modifier-Engine mit 6 Typen existiert — hier nur UI + Gag) | 3 | S | 3 |
| I-20 | **GOB-NOM-Baukasten für Spieler** — der Editor-interne Level-Editor (W15) wird In-Game-Feature: Level bauen, Solver-Check verhindert Unlösbares, Teilen per Level-Code | 5 | L | 3 |

### Planner 5 — Ranch & Open World *(Tiefen-Backlog: `RANCH-DLC-IDEAS-1…4`)*

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-21 | **Fohlen-Momente** — Geburt/Aufstehen/erste Schritte als inszenierte Warte-Quest mit Benachrichtigung (Star-Stable-Horses-Lehre aus IDEAS-1 §2: Wachstum, auf das man wartet, erzeugt Zuneigung) | 5 | M | 4 |
| I-22 | **Foto-Spots + Verweil-Modus** — markierte Aussichtspunkte, HUD blendet sich beim Stillstehen aus (RSHR-Lehre), Foto-Sticker als Belohnung | 3 | S | 3 |
| I-23 | **Ranch-Kirmes** — saisonaler Jahrmarkt auf der Festwiese: Hufeisen-Werfen, Heuballen-Rennen als Mini-Aktionen, Lampion-Abend | 4 | M | 3 |
| I-24 | **Wildpferd-Bogen** — Glitzer-Spuren suchen → anschleichen → sanftes Rhythmus-Zähmen (BotW-Lehre ohne Abwurf-Frust); nutzt `ranch_pferd`-Vertrag + Marker-lose Suchquest-Idee | 4 | M | 3 |
| I-25 | **Geschenk-Vorlieben in Hufingen** — jeder Dorf-NPC mit Lieblings-/Hass-Geschenken (AC-Muster), Freundschafts-Reaktionen + Brief-Antworten über das Post-System | 3 | M | 2 |

### Planner 6 — DLCs („Goo und Bye" + „McGooby")

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-26 | **„Goo und Bye" Welle B** — Großmarkt-Fahrt mit Kofferraum-Laden, Preis-Schieber, Erweiterungsstufe 2, erster Mitarbeiter (Design steht komplett: `DLC-GOO-UND-BYE.md` §3–§5) — *G6-Paket, bereits eingeplant* | 5 | L | 3 |
| I-27 | **„McGooby" Welle B** — Kauf-Gate, Management-Ebene, zweite Station, Schwarzes-Brett-Team (`DLC-MCGOOBY.md` §2.3/§5) — *G6-Paket (inkl. McGooby-Bühne), bereits eingeplant* | 5 | L | 3 |
| I-28 | **Koop-Rush „Übernimm die Fritteuse!"** — 2 Spieler teilen sich die McGooby-Küche übers Netz (Doc §8.1; Lockstep-Muster von GOB-NOM/GvZ-PvP liegt fertig da) | 5 | L | 3 |
| I-29 | **DLC-Ladebildschirme** — eigenes Artwork + Tipps je DLC — *G6-Paket, bereits eingeplant* | 2 | S | 2 |
| I-30 | **Läden-Synergie-Paket** — eigene Garten-Ernte in die Goo-und-Bye-Regale, Wochenmarkt-Zutaten für McGooby-Tages-Specials (Synergie-Matrizen beider Design-Docs umsetzen) | 4 | M | 3 |

### Planner 7 — Multiplayer & Social

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-31 | **GvZ-Coop-Kampagne** — 15 Coop-Level (einer obere, einer untere Reihen; USER-WISHES §G); PvP-Netz existiert seit P38R als direkte Vorlage, die Coop-LEVEL fehlen noch komplett | 4 | L | 2 |
| I-32 | **Brettspiel Nr. 3: „Gooby ärgere dich nicht"** — auf der bestehenden Turn-Maschine (`boardgames.js`: battleship/chess); Tomate 1×/Runde inklusive | 4 | M | 3 |
| I-33 | **Foto-Pinnwand** — InstantGooby-Feed als echtes 3D-Pinnwand-Möbel im Flur; Besucher sehen die Fotos beim Besuch | 3 | M | 2 |
| I-34 | **Gemeinsam angeln** — beim Besuch zusammen am Teich sitzen, Fang-Momente synchron feiern (POS-Relay + Event-Kanal existieren) | 4 | M | 3 |
| I-35 | **Geburtstags-Post von Freunden** — der Server erinnert Freunde vor Goobys Geburtstag; Karten landen gesammelt im Briefkasten und Gooby liest sie vor | 3 | S | 3 |

### Planner 8 — Progression, Quests & Sammlungen

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-36 | **Sticker-Tauschbörse** — Duplikate mit Freunden tauschen (Server-Trade mit beidseitiger Bestätigung, Tageslimit; kein Markt, kein Geld) | 4 | M | 3 |
| I-37 | **Das Gooby-Heft** — monatliches, komplett kostenloses Aufgaben-Heft (Saison-Pass ohne Bezahlung): 20 Aufgaben, Heft-Seiten füllen sich sichtbar, Abschluss-Belohnung; Inhalte als Content-Pack | 4 | M | 3 |
| I-38 | **Funkelpark-Museum** — begehbare Ausstellung der 4 Sammlungssets: Vitrinen füllen sich mit den echten 3D-Modellen der gesammelten Stücke; der Endgame-Grund, Sammlungen zu vollenden | 5 | L | 3 |
| I-39 | **Rekord-Reprisen** — „Heute vor einem Monat: dein pancakeTower-Rekord!" als News-Karte mit Nochmal-Knopf (nutzt vorhandene Analytics/Rekorde) | 3 | S | 3 |
| I-40 | **Meister-Sterne** — Meta-Leiter über die Stern-Summen aller Spiele; Stufen schalten Arcade-Deko + Profil-Titel frei | 3 | M | 2 |

### Planner 9 — UI/UX, Telefon & Zugänglichkeit

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-41 | **Recovery-Toast verdrahten** — `system.recovered_backup` + `state_loaded` haben bis heute keinen Konsumenten (dokumentierte STATUS-Lücke) — Pflicht-Hygiene | 1 | S | 1 |
| I-42 | **Presence-i18n** — der EN-Client zeigt deutsche Aktivitätstexte (Server-Labels lokalisieren) — Pflicht-Hygiene | 1 | S | 1 |
| I-43 | **IGohbie-Startbildschirm anpassbar** — App-Icons umsortieren + 2 Mini-Widgets (Münzen/Tagesquest) im Telefon; spielt die Handy-Fiktion weiter aus | 3 | M | 2 |
| I-44 | **Rückkehrer-Karte** — nach ≥ 7 Tagen Pause: „Was bisher geschah" (Gooby erzählt, was er „alleine gemacht" hat) + sanfte Wieder-Einstiegs-Quest; bester Retention-Hebel pro Aufwand | 4 | S | 4 |
| I-45 | **Lese-Hilfe-Paket** — extragroße Schrift-Stufe, langsameres Typewriter-Tempo, Symbol-Unterstützung für Nichtleser (Kern-Zielgruppe!) | 3 | M | 2 |

### Planner 10 — Audio, Juice & Technik

| ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|
| I-46 | **Audio-Feel-Paket** — Musik-Intensitäts-Layer je Ort/Tageszeit + Übergangs-Stinger — *G6-Paket, bereits eingeplant* | 4 | M | 3 |
| I-47 | **B11 + Warn-Sweep + Leak-Gate** — GvZ-Anchor-Warnung, systematisches B4-Leak-Gate über alle Spiele — *G6-Paket + STATUS-Lücke, Pflicht-Hygiene* | 1 | M | 0 |
| I-48 | **Natives Notification-Plugin** — echte Zustellung bei GESCHLOSSENER App (`_os_schedule()`-Andockpunkt existiert; anders als Live Activities auch in der Sideload-.ipa möglich) | 4 | L | 2 |
| I-49 | **Rekord-Zeitlupe überall** — HitStop + Slow-Mo-Konfetti bei persönlichen Rekorden in allen Spielen (kleine JuiceKit-Erweiterung, wirkt überall gleichzeitig) | 3 | S | 3 |
| I-50 | **Foto-Quests** — „Fotografiere Gooby beim Gähnen im Regen": Motiv-Aufgaben, geprüft über Spielzustand (nicht Pixel), eigene Album-Seite füllt sich | 4 | M | 3 |

---

## 3) Gesamt-Rangliste — Top 12 nach Wow-pro-Aufwand

| Rang | ID | Idee | Wow | Aufwand | Score |
|---|---|---|---|---|---|
| 1 | I-21 | Fohlen-Momente | 5 | M | **4** |
| 2 | I-44 | Rückkehrer-Karte | 4 | S | **4** |
| 3 | I-05 | Jahreszeiten-Feste | 5 | L | 3 |
| 4 | I-07 | Keller + 2. Etage + Balkon | 5 | L | 3 |
| 5 | I-26 | „Goo und Bye" Welle B *(G6)* | 5 | L | 3 |
| 6 | I-27 | „McGooby" Welle B *(G6)* | 5 | L | 3 |
| 7 | I-28 | Koop-Rush „Übernimm die Fritteuse!" | 5 | L | 3 |
| 8 | I-38 | Funkelpark-Museum | 5 | L | 3 |
| 9 | I-20 | GOB-NOM-Baukasten für Spieler | 5 | L | 3 |
| 10 | I-36 | Sticker-Tauschbörse | 4 | M | 3 |
| 11 | I-37 | Das Gooby-Heft | 4 | M | 3 |
| 12 | I-17 | Wochen-Challenge | 4 | M | 3 |

Dahinter dicht gestaffelt (alle Score 3): I-01, I-02, I-03, I-04, I-09, I-10, I-11,
I-13, I-16, I-18, I-19, I-22, I-23, I-24, I-30, I-32, I-34, I-35, I-39, I-46, I-49,
I-50. Pflicht-Hygiene läuft außer Konkurrenz: I-41, I-42, I-47.

---

## 4) Die Umsetzungs-Wellen (J–M + Backlog)

Regeln: **Welle-H-Playtest-Befunde schlagen alles** (frische Bugs vor neuen Features,
LOOP-Protokoll §2); die neu einsortierten **G6-Pakete sind gesetzt** und werden hier
nur eingeordnet, nicht neu bewertet; jede Welle ist auf 8–10 parallele Pakete
geschnitten.

### Welle J — „Pflicht + Quick-Wins" (Hygiene zuerst, dann maximaler Wow pro Aufwand)

1. **Playtest-Fixes aus Welle H** (Platzhalter — Umfang nach Befundlage, hat Vorrang)
2. I-47 B11 + Warn-Sweep + Leak-Gate *(G6)*
3. I-41 + I-42 Hygiene-Duo (Recovery-Toast + Presence-i18n)
4. I-44 Rückkehrer-Karte
5. I-16 City-Drive-Feinschliff + I-12 Stadt-Polish-Rest
6. I-19 Chaos-Modus + I-49 Rekord-Zeitlupe (Minigame-Juice-Doppelpack)
7. I-46 Audio-Feel-Paket *(G6)*
8. I-29 DLC-Ladebildschirme + Doku-Refresh *(beide G6)*
9. I-22 Foto-Spots/Verweil-Modus + I-02 Begrüßungs-Ritual
10. I-35 Geburtstags-Post + I-39 Rekord-Reprisen

### Welle K — „Die großen Brocken" (DLC Welle B + Haus + Ranch-Herzstücke)

1. I-26 „Goo und Bye" Welle B inkl. Alwin-NPC-Ausbau *(G6)*
2. I-27 „McGooby" Welle B inkl. McGooby-Bühne *(G6)*
3. I-30 Läden-Synergie-Paket (direkt hinter den Welle-B-Landungen)
4. I-07 Keller + 2. Etage + Balkon
5. I-21 Fohlen-Momente
6. I-24 Wildpferd-Bogen
7. Ball-Wurf-Feinschliff *(G6-Rest — der Kern ist seit W13 da; gemeint sind
   Apportier-Varianten/Politur)*

### Welle L — „Zusammen & Sammeln" (Multiplayer + Progression)

1. I-28 Koop-Rush „Übernimm die Fritteuse!"
2. I-32 Brettspiel Nr. 3 „Gooby ärgere dich nicht"
3. I-34 Gemeinsam angeln
4. I-36 Sticker-Tauschbörse
5. I-37 Das Gooby-Heft
6. I-17 Wochen-Challenge
7. I-18 Pokal-Abend
8. I-31 GvZ-Coop-Kampagne (größtes Paket der Welle)

### Welle M — „Welt & Feste" (Orte, Events, Sammel-Endgame)

1. I-05 Jahreszeiten-Feste
2. I-11 Stadtfest-Wochenende
3. I-13 Friseursalon „GOOBHAAR"
4. I-23 Ranch-Kirmes
5. I-09 Schaugarten-Wettbewerb
6. I-10 Aquarium-Möbel
7. I-38 Funkelpark-Museum
8. I-01 Goobys Tagebuch

### Später / Backlog (Welle N+)

I-03 Traum-Dioramen, I-04 Gobster, I-06 CEILING-Layer, I-08 Zimmer-Codes,
I-14 Buslinie 1, I-15 Ambient-Audio-Distrikte, I-20 GOB-NOM-Baukasten,
I-25 Geschenk-Vorlieben, I-33 Foto-Pinnwand, I-40 Meister-Sterne,
I-43 IGohbie-Widgets, I-45 Lese-Hilfe-Paket, I-48 Notification-Plugin,
I-50 Foto-Quests. Nichts davon ist verworfen — nur ehrlich hinter die Wellen J–M
einsortiert. I-48 rückt vor, sobald ein natives Plugin-Fundament ohnehin angefasst
wird.

---

## 5) Bewusste Nicht-Ziele dieser Roadmap

1. **Keine Kalenderzeit-Schätzungen** — nur S/M/L (Umfang/Risiko).
2. **Nichts, was Signing braucht** — Dynamic Island/Live Activities bleiben ehrlich
   zurückgestellt (`[-]` in `UserFeedback.md`), bis eine signierte App existiert.
3. **Keine Monetarisierung, kein FOMO, keine Rotations-Shops** — das Gooby-Heft
   (I-37) ist bewusst komplett kostenlos und ohne Zeitdruck einlösbar.
4. **Keine offenen Chats/Matchmaking** — Multiplayer bleibt Freunde-only mit Emotes
   und kuratierten Textbausteinen.
5. **Keine Unity-EULA-Assets, keine Wegwerf-Accounts** — Asset-Intake weiterhin nur
   über die A1–A3-Regeln (CC0/CC-BY, `LICENSES.md`).
6. **Keine Doppel-Systeme** — jede Idee oben dockt an ein benanntes Bestandssystem an
   (Registries, Packs, Lockstep, JuiceKit, Grid-Bau, Post, Ghost-Leaderboards);
   nichts wird zweimal gebaut.
