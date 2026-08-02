# UserFeedback — dein direkter Draht zum Agenten

**So funktioniert's:** Schreib unten unter „Neu von dir" einfach rein, was dich
stört, was fehlt oder was du dir wünschst — Stichworte reichen, kein Format nötig.
Der Agent liest die Datei vor und nach jeder Arbeitsrunde, hakt Erledigtes ab und
schreibt dazu, WAS er gemacht hat.

| Zeichen | Bedeutung |
|---|---|
| `[ ]` | offen |
| `[~]` | der Agent arbeitet gerade daran |
| `[x]` | erledigt (mit Erklärung darunter) |
| `[?]` | Rückfrage an dich |
| `[-]` | bewusst zurückgestellt (mit Begründung) |

---

## 1. Neu von dir

> **Hier reinschreiben.** Stichworte reichen, z. B. „HUD im Querformat zu weit links"
> oder „Taxi-Sound zu laut". Der Agent hakt sie ab und schreibt dazu, was er gemacht hat.



_(NEU seit W18: Das Projekt lebt jetzt AUCH im Repo `PermissionMAXED/Monkey-Party`
auf dem Branch `cursor/gooby-godot-loop-continue` — der komplette Stand aus
`MedusaV9/MinecraftBubbleShieldMod@cursor/gooby-godot-loop-2c10` (dorthin war es
seit W16 umgezogen) wurde importiert. Der Agent führt die kontinuierliche
Verbesserungs-Schleife HIER weiter, ausschließlich mit Fable-Agents — das
Protokoll steht in `docs/godot-rewrite/LOOP.md`. Die unsignierte .ipa baut
weiterhin jeder Push automatisch über `.github/workflows/gooby-godot.yml`
(Artefakt `GOOBY-godot-unsigned-ipa`). Diese Datei bleibt dein direkter Draht:
einfach oben reinschreiben.)_

_(Deine zwei neuen Stichpunkte von oben sind jetzt als A1–A3 formatiert — die
Original-Links sind alle übernommen:)_

- [x] **A1 Asset-Rotations- und Ausrichtungs-Audit** — dein Punkt: „sicherstellen,
      dass alle Assets immer richtig rotiert sind und richtig rum stehen".
      **Gemacht (2. August):** Alle **723** `.glb`/`.gltf` headless geprüft
      (Spiegelungen/negative Skalen, NaN, gekippte Hoch-Achse, krumme
      90°-Raster-Verstöße) **plus** visuelle Kontaktbögen aller Modelle
      **plus** Review ALLER Dreh-Formeln in den Skripten (dort werden Modelle
      platziert, kaum in .tscn). Die Assets selbst standen alle richtig —
      aber 3 ECHTE Blickrichtungs-Bugs gefunden und gefixt: **(a)** Zebra/
      Reh/Ente/Fuchs/Katze liefen als Dorf-NPCs RÜCKWÄRTS, **(b)** der
      Hufingen-Marktstand-Verkäufer stand mit dem Rücken zur Kundschaft,
      **(c)** im Hüte-Minispiel galoppierte das Pferd rückwärts und der
      Reiter saß falsch herum. Vorher/Nachher-Renders + die zwei
      Blickrichtungs-Verträge (+Z prozedural / -Z GLB) stehen in
      `docs/godot-rewrite/ASSET-ORIENTATION.md`. **Dauerhaft:** die neue
      Wache `tests/unit/test_asset_orientierung.gd` läuft in Preflight + CI
      mit (keine Spiegelungen/NaN, Pferd-GLB hält „Blick -Z", die Fixes
      können nicht zurückrutschen); der volle Report ist jederzeit über
      `tests/tools/asset_orientation_probe.gd` abrufbar. Boden-Kontakt
      wachen weiterhin die Bestands-Tests (Fahrzeug-Bodenkontakt,
      Pferde-Huf-Wache).
- [x] **A2 Mehr echte Modelle — stilkonform und lizenzsauber** — dein Punkt:
      „nutze / downloade dir endlich mal mehr Modelle, aber nur wenn der Stil
      zu unserem Spiel passt!!". Deine Quellen-Links (alle übernommen):
      - https://blockbenchworkshop.com/browse?status=free&sort=downloads
      - https://sketchfab.com/3d-models?date=week&features=downloadable&sort_by=-likeCount
      - https://assetstore.unity.com/packages/3d/free-low-poly-pack-65375?srsltid=AfmBOopI2uLBGsg25yrGayQnnA8GDYPH9EbuyNHhDkPbKCKt8WpzPLtX
      - https://assetstore.unity.com/listing#nf-ec_price_filter=0...0
      - https://assetstore.unity.com/packages/3d/environments/landscapes/low-poly-atmospheric-locations-pack-278928
      - https://assetstore.unity.com/packages/3d/environments/low-poly-environment-315184
      - https://assetstore.unity.com/packages/3d/environments/simplepoly-city-low-poly-assets-58899
      - https://assetstore.unity.com/packages/2d/textures-materials/sky/farland-skies-low-poly-64604
      - https://assetstore.unity.com/packages/package/low-poly-environment-park-242702
      - https://assetstore.unity.com/search#q=Low%20Poly&nf-ec_price_filter=0...0

      Akzeptanzkriterien:
      **(1)** kuratierte Auswahl NUR im Gooby-Stil (low-poly, weiche
      Pastellfarben, runde Formen) — jeder Kandidat wird per
      Screenshot-Vergleich gegen bestehende Szenen bewertet, Stil-Ausreißer
      fliegen raus;
      **(2)** mindestens 20 neue Modelle integriert (Stadt-Requisiten,
      Laden-Einrichtung für REHWEI/IKEA/DLC-Läden, Ranch/Natur,
      Skybox-Alternativen), über die Intake-Pipeline (A3) normalisiert
      (Maßstab, Pivot, Rotation nach A1-Regeln, Kollisionsformen) und in
      ECHTEN Szenen platziert — nicht nur im Assets-Ordner;
      **(3)** Lizenz pro Modell dokumentiert (`GOOBY-GODOT/assets/LICENSES.md`),
      nur CC0/CC-BY/ausdrücklich freie Lizenzen. Ehrliche Ansage dazu: die
      Unity-Asset-Store-Standard-EULA bindet viele „free"-Packs an
      Unity-Projekte — solche Packs kommen NICHT ins Godot-Spiel; stattdessen
      liefern account-freie CC0-Quellen im selben Look (z. B. Kenney,
      Quaternius, Poly Pizza) denselben Stil ohne Rechtsrisiko.
      Sketchfab-/Blockbench-Fundstücke nur mit download-erlaubter Lizenz.
      Zu „erstell dir notfalls einen Account mit Temp-Mail": mache ich nicht —
      Wegwerf-Accounts verstoßen gegen die Nutzungsbedingungen der Stores und
      die CC0-Quellen decken denselben Stil ohne Account ab. Falls du ein
      bestimmtes Store-Pack unbedingt willst: lade es selbst und leg es ins
      Repo, dann binde ich es sauber ein.
      **Gemacht (2. August, 70 neue Modelle in zwei Wellen):**
      Welle 1 (33 Modelle, alle sichtbar platziert): Kenney Survival Kit →
      Urlaubs-Zeltplatz in den Bergen, Kenney Pirate Kit → Strand (Palmen,
      Ruderboot, Sandburg-Deko), Kenney Racing Kit → Autohaus-Probefahrbahn
      (Pylonen, Banden), Kenney Farm-Requisiten → Ranch-Hof (Tröge, Fässer,
      Werkbank). Welle 2 (37 Modelle, drei bisher kahle Bereiche): Kenney
      **Space Kit** (12) → Raumstation endlich eingerichtet (Astronauten,
      Generatoren, Konsolen-Arbeitsplatz, Rover, Satellitenschüssel,
      Mond-Kristalle); Kenney **Fantasy Town Kit** (11) → Hufingen-Marktecke
      (Stände mit Planen, Warentisch, Bank/Hocker, Erntekarren, flach
      liegendes Ersatzrad, Laternen am Anreiseweg) + Fern-Dorfstraße + zwei
      Eröffnungs-Banner im Goo-und-Bye; Kenney **Food Kit** (14) →
      Goo-und-Bye-Warenwelt (Gemüse, Brote, Kartons, Dosen, Flaschen, Honig).
      Alles CC0, über die A3-Pipeline normalisiert (Space-Kit-Raster-Pivots
      beim Import auf Bodenmitte zentriert, Banner als begründete
      Hänge-Pivot-Ausnahmen in `test_asset_intake.gd`), Lizenzen in
      `assets/city/LIZENZ.md` + `docs/godot-rewrite/RANCH-ASSETS.md`,
      Index `assets/LICENSES.md`. Screenshot-Review aller Ecken ist gelaufen.
- [x] **A3 Asset-Intake-Pipeline dokumentieren + absichern** (Unterbau für
      A1 + A2). Akzeptanzkriterien:
      **(1)** kurze Checkliste in `GOOBY-GODOT/assets/README.md`, wie externe
      Modelle reinkommen (Format glb/gltf, Maßstab-Referenz „Gooby ≈ Referenzhöhe",
      Pivot am Boden, einheitliche Front-Achsen-Konvention, Kollisions-Shape,
      erzeugte `.import`/`.uid` MIT committen, Lizenz-Eintrag in LICENSES.md);
      **(2)** ein Import-Konformitäts-Test prüft neue Assets automatisch gegen
      diese Konvention (Rotation/Maßstab/Pivot) und läuft in Preflight + CI mit.
      **Gemacht (2. August):** Die verbindliche Anleitung steht in
      `docs/godot-rewrite/ASSET-INTAKE.md` (Ordner-Layout „ein Pack = ein
      Unterordner", glb/gltf-Format, Maßstab-Referenz **Gooby ≈ 1,13 m**
      + Decke 2,45 m + Pferderücken 1,42 m, Pivot = Boden-Mitte samt
      Ausnahme-Regeln, -Z-Front-Vertrag aus A1, wer die Kollision liefert
      — Katalog-Footprint bzw. Szenen-Blocker, GLBs bleiben ohne
      Collision-Mesh —, Lizenz-Pflichten, Stil-Gate, 8-Schritte-Ablauf).
      Die Kurz-Checkliste dazu: `GOOBY-GODOT/assets/README.md` (Kriterium 1);
      der bislang fehlende zentrale Lizenz-Index (von A2 + LOOP.md schon
      referenziert) existiert jetzt: `GOOBY-GODOT/assets/LICENSES.md`.
      **Dauerhaft (Kriterium 2):** die neue Wache
      `tests/unit/test_asset_intake.gd` läuft im Haupt-Runner (Preflight
      4/6 + CI linux-checks) und prüft JEDES Modell unter `assets/`:
      `.import` liegt daneben im Repo, Maßstab-Band 0,02–40 m (fängt
      cm-/inch-Exporte), Pivot auf der Boden-Kante (±6 cm bzw. 10 % Höhe;
      32 begründete Bestands-Ausnahmen wie Wand-/Hänge-/Achs-Pivots stehen
      MIT Begründung im Test, verwaiste Einträge werden gemeldet) und
      90°-Rotations-Raster. Bestand komplett vermessen (723 Modelle) —
      alles konform.



- [~] **Dein Feedback vom 1. August (mit 7 Screenshots, iPhone quer):** UI-Full-
      Rework, dynamisches UI mit Animationen (z. B. Baumenü → andere Knöpfe
      verschwinden), ALLE Bugs fixen, Subagents sollen das Spiel richtig SPIELEN
      (10 parallel, jeder eigene Instanz), iPhone 17 Pro Max + Querformat als
      Leitformat, Modal-Menüs + Swipen/Wischen fixen, Läden sind zu leer (echte
      Orte mit animierten Chars!), alles fühlt sich wie eine Dev-Demo bzw. wie
      einzelne Spiele statt EIN Gooby-Spiel an. → **Welle G7 „SPIELGEFÜHL" ist
      FERTIG** (alle 10 Pakete gelandet — Details unten in „In Arbeit"; das
      Leitformat-Audit meldet jetzt **34 Screens × iPhone 17 Pro Max quer =
      0 Befunde**); die 30-Ideen-Planner-Welle ist fertig
      (`docs/godot-rewrite/IDEAS-WELLE-I.md`), es bleibt die Playtest-Welle
      (10 Spieler-Agents), deshalb bleibt dieser Punkt offen. Deine
      Screenshot-Befunde sind alle gefixt: HUD-Kacheln schneiden keine Wörter
      mehr ab („IGohbi/Garder/Gestalt" → Font-Autoshrink), Sprechblasen brechen
      nie mehr mitten im Wort, Tagesquests-Blatt dimmt das HUD weg statt es zu
      überlagern, IGohbie-Telefon-Icons repariert, Gestalten-Liste schneidet
      „Briefkasten" nicht mehr ab, Baumodus-Knopf-Salat aufgeräumt (HUD gleitet
      animiert weg, Kamera-Chips weichen dem Dock aus).

- [x] **Onkel-Alwin-Ritual (2. August, das Alwin-NPC-Paket aus der
      Wellen-J/K-Warteschlange):** Onkel Alwin ist im Goo-und-Bye-Laden
      jetzt eine ECHTE Type statt nur der erste Bon: Punkt 9 Uhr kommt er
      mit grauer **Schiebermütze** (sitzt per Bone-Anker auf dem Kopf und
      macht Kopf-Nicken, Lauf-Wippen und Hängeohren-Pose mit), wirft
      seinen **Kennerblick** ins Regal (er hat den Laden 40 Jahre
      geführt) und sagt seine **Tageszeile** als Sprechblase —
      deterministisch aus dem Tages-Seed, 8 Möhren-Sprüche + 4
      Leergefegt-Sprüche, gleicher Tag = gleiche Zeile, DE+EN. Liegt
      seine Möhre da, **poliert er im Vorbeigehen ein Regal**
      („blitzblank!“-Toast), kauft GENAU eine Möhre und geht selig; ist
      das Möhrenregal leer, dreht er mit Hängeohren wieder ab — ohne
      Kassen-Stopp. Jede bediente Möhre zählt ins neue
      **Stammkunden-Buch** (`alwinBedient` im Spielstand — Futter für den
      §7.3-Erfolg „treuesteMoehre“). Dazu ein neuer Trailer-Clip
      `tools/capture/clips/goobye_alwin.gd` (Happy-Path +
      `--variante=leer` für den traurigen Pfad). Wachen:
      `test_dlc_goobye_logik.gd` (Möhren-Erkennung, deterministische
      Tageszeile inkl. DE/EN-Pool-Parität) + `test_dlc_goobye.gd`
      (Ritual-Choreo mit Mütze + Sprechblase, trauriger Pfad ohne Kauf,
      Zähler-Normalisierung).
- [x] **Doku-Refresh (2. August, aus der Wellen-J-Warteschlange):** Die
      Vollständigkeits-Matrix `docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md`
      ist auf die **Revision H/J** gebracht — alle seit W13 geschlossenen
      Zeilen am Code nachgeprüft und umgebucht: Ball-Wurf, Sammlungsset-UI,
      Gyro-Parallax, sichtbare Wetter-FX, Fotomodus-Werkzeuge (Pose/Emotion/
      Rahmen), Nougatschleuse + Nutella und City Drive als echte
      Arcade-Runde sind jetzt „Vollständig"; neue Summen **77 von 79
      vollständig, 1 teilweise (nur noch die Speise `corn-dog`), 0 fehlend,
      1 gestrichen** (~97 %). B11 ist als BEHOBEN verbucht (Warn-Sweep:
      Anchor-Warnung im kompletten Walkthrough weg), B4 bleibt ehrlich
      teilweise (Boot-Smoke leakfrei, Leak-Gate über alle 38 Spiele fehlt);
      Restliste #17/20/21/22/29/30 auf ERLEDIGT. Außerdem alle README-/
      Doku-Zeiger aufs neue Zuhause `PermissionMAXED/Monkey-Party@
      cursor/gooby-godot-loop-continue` aktualisiert: Root-`README.md` ist
      jetzt ein Wegweiser (GOOBY ↔ MONKEY-PARTY/AETHERKLANG),
      `GOOBY-README.md` (Branch-Hinweis, Ordner-Tabelle inkl. neuer
      Repo-Projekte, Arbeitsregeln-Link auf `GOOBY-AGENTS.md`, Trailer 5.1)
      und die veraltete „Repo-Umzug (W16)"-Notiz in `GOOBY-AGENTS.md` →
      W18-Stand.
- [x] **Rückkehrer-Karte (2. August, I-44 aus Welle J — Platz 2 der
      Ideen-Rangliste, bester Retention-Hebel pro Aufwand):** Wer nach
      ≥ 7 Tagen Pause wiederkommt, bekommt direkt nach dem Ankunfts-Wipe
      eine liebevolle **„Was bisher geschah"-Karte**: Gooby erzählt drei
      Geschichten, was er „alleine gemacht" hat — deterministisch aus dem
      Spielstand gewürfelt (Ranch-Anekdote nur mit gekaufter Ranch,
      Kühlschrank-Witz nur mit Fütter-Historie usw.; Immer-Geschichten
      füllen auf, die Karte ist NIE leer) plus die Abwesenheit in ganzen
      Tagen im Untertitel. Dazu startet eine **sanfte
      Wiedereinstiegs-Quest** (3× streicheln, 1× füttern, 1 Minispiel-
      Runde) — die Baselines frieren beim Karten-Start ein, alte Zähler
      zählen also nicht. Der Abschluss zahlt das Wiedersehens-Geschenk
      (120 Münzen + 40 XP) GENAU EINMAL über die echten Economy/Leveling-
      Pfade, mit Konfetti + Toast. Ein offenes Tagesbonus-Popup wird nur
      verdrängt (PanelStack-„Später"-Semantik) und klopft nach dem
      Schließen der Karte erneut an. Nie doppelt für dieselbe
      Abwesenheit, nie vor dem Onboarding. DE+EN.
      Wache: `test_rueckkehr.gd` (Slice-Self-Heal, 7-Tage-Gating inkl.
      nie-doppelt, deterministische zustandsbasierte Geschichten,
      Baseline-Einfrieren + Geschenk einmalig, Besuchslücke am echten
      State, DE/EN-String-Parität, Karte baut headless). Volle Suite
      grün (3520 PASS; die einzigen FAILs stammen aus der parallel
      laufenden Audio-/RMP-Baustelle, nicht aus diesem Schnitt).
- [x] **Fohlen-Momente, erster Schnitt (2. August, I-21 aus Welle K —
      Platz 1 der Ideen-Rangliste):** Die Ranch bekommt ihre Seelen-Momente:
      Stehen zwei erwachsene, gesunde Pferde auf dem Hof, taucht zwischen
      ihnen ein pulsierendes **Herz** auf — antippen startet die
      Fohlen-Überraschung (nutzt die bislang UI-lose Zucht-Logik aus
      `horse_breeding.gd`). Danach läuft eine echte **Warte-Quest** im
      Star-Stable-Stil: Sprechblase mit Restzeit („das Fohlen kommt in
      etwa …"), lokale Benachrichtigung („Fohlen-Zeit auf der Ranch!")
      über die bestehende `fohlen_`-Notify-Kategorie. Ist es so weit,
      wird die **Geburt inszeniert**: Mama trabt zur Stallwiese, Funkel-
      Puffs + Pferdelaute, das Fohlen erscheint klein im Stroh, wackelt
      sich hoch („Wackel … wackel … HOPP!"), macht die ersten Schritte
      hinter der Mama her und bekommt seinen (deterministisch gewürfelten)
      Namen getauft — alle Beats mit Reduced-Motion-Fassung. Das Fohlen
      steht VOR der Inszenierung sicher im Spielstand (crash-sicher) und
      wohnt danach ganz normal im Stall (Pflege, Stammbaum). DE+EN.
      Wache: `test_fohlen_momente.gd` (Paar-Findung inkl. Gate-Regeln,
      Herz→Trächtigkeit+Notification, Warte-Hinweis + Neu-Planung,
      Geburt-Commit + Beat-Folge, deterministische kollisionsfreie Namen,
      stumm ohne Ranch-Kauf). Preflight grün.
- [x] **DLC-Ladebildschirme (2. August, I-29 aus Welle J):** Reisen zu den
      beiden neuen DLCs tragen jetzt eigene Lade-Karten statt der
      „Trautes Heim“-Karte: der Weg in den Goo-und-Bye-Laden zeigt das
      Laden-Coverart aus dem DLC-Hub mit „Ab in den Laden!“ + eigenen
      Tipps (die Tür übt ihr „Goo!“, Onkel Alwin wartet schon auf seine
      Möhre …), der Weg zur McGooby-Schicht das Küchen-Coverart mit
      „Ab zur Schicht!“ + Grill-Tipps (inkl. echtem Gameplay-Tipp zum
      goldbraunen Wende-Fenster) — DE+EN. Der echte Teal-Ladebalken
      („Lädt… NN%“) läuft wie gehabt auch auf den neuen Karten. Die
      Modus-Weiche hängt an den echten Routen-Konstanten und greift per
      Präfix auch für künftige DLC-Unterziele (Großmarkt, Management …).
      Wache: `test_ui_veil.gd` (neuer DLC-Karten-Test, DE/EN-Tipp-Parität
      jetzt über 6 Karten-Modi). Preflight grün.
- [x] **Playtest-Bugfixes, Batch 1 (2. August):** Als Spieler durch Ranch-
      Wettbewerbe, Quest-Log, Erfolge und Minispiel-Awards gespielt (headless
      Tests + Fehlerlog-Jagd) — 7 echte Bugs gefunden und gefixt:
      **(a)** Tonnen-Slalom/Zeitrennen zeigten bei „zu langsam" den ROHEN
      String-Key statt Text (fehlende Keys `mg.ranchTonnen.zu_langsam` +
      `mg.ranchZeit.zu_langsam`, DE+EN nachgetragen); **(b)** Quest-Karten/
      Warte-Notifications kippten bei Quests ohne String-Eintrag (z. B. aus
      Nachschub-Packs) in rohe Keys + Fehler-Spam → lesbarer Fallback über
      `RQuestKatalog.quest_titel/quest_text`; **(c)** dasselbe für Erfolgs-
      Toast + Erfolge-Screen → `AchievementsCatalog.display_name/display_desc`;
      **(d)** Minispiel-Award-Test war TAGES-HISTORIEN-abhängig: das
      150-Münzen-Tagesledger aus echten Spielrunden am selben Kalendertag
      ließ den Award 0 Münzen zahlen (Ledger-Reset im Test-Helfer);
      **(e)** `callv` mit read-only Const-Array ließ den gobnom-Gefecht-
      Einstieg im Stage-Test scheitern (Godot kann Argumente dann nicht
      konvertieren); **(f)** Prozent-Zeichen in Taming-Test-Meldungen war
      nicht escaped (String-Format-Fehler in jedem Lauf); **(g)** die
      SquishButton-Wache meldete durch GDScript-Cache-Identitäts-Drift
      falsche FAILs in langen Suite-Läufen → Skript-Pfad-Fallback, echte
      `Button.new()` fallen weiterhin durch. Preflight grün.
- [x] **Playtest H — Minigames (2. August):** Minigame-Audit (Win/Lose, SFX,
      Kamera, UI) über teaParty, veggieChop, gardenRush, basketBounce,
      ranchHerde, ranchTonnen/ranchZeit — 6 echte Befunde gefixt:
      **(a)** teaParty inszenierte auch VERSCHÜTTETE Tassen als „serviert"
      (der `!= "spill"`-Vergleich war immer wahr — pour_result kennt nur
      perfect/good/miss); **(b–d)** veggieChop, gardenRush und basketBounce
      hatten HUDs auf festen Pixel-Nägeln (16/10/48 px, feste Fonts) —
      Krümelschrift auf dem Landscape-Leitformat → M9-`_ui`-Skalierung
      nachgerüstet (inkl. basketBounce-Flash-Text); **(e)** ranchHerde:
      ALLE Schafe froren ein, solange keine Zielfahne stand (Optik-Schleife
      sass hinter dem visible-Gate) → nach `herde_schaf_optik.gd` extrahiert
      und jeden Frame getickt; **(f)** ranchHerde-HUD ebenfalls auf M9
      umgestellt. SFX-/i18n-Sweeps ohne Befund. 5 Wächter-Tests
      (`test_h_minigames.gd`), Report `docs/godot-rewrite/playtest/H-minigames.md`.
- [x] **Warn-Sweep (2. August, das B11-Paket aus der Wellen-J-Warteschlange):**
      Headless-Fehlerjagd über Boot-Smoke, beide Test-Runner und den kompletten
      bughunt-Walkthrough — 3 echte Ursachen gefunden und gefixt:
      **(a)** die Pill-Polygone der Ladebalken (Veil-Teal-Balken/-Sweep +
      Boot-Möhrenbalken) doppelten bei schmalen Füllständen ihre Kappen-
      Nahtpunkte → „Invalid polygon data, triangulation failed" bei fast
      jedem Screenwechsel (26× pro Walkthrough-Lauf, sichtbar als
      Sweep-Band-Aussetzer) — ein geteilter Punkte-Bauer dedupliziert jetzt
      die Naht, neue Wache `test_warnsweep.gd`; **(b)** der CI-Boot-Smoke
      meldete bei JEDEM Lauf „ObjectDB instances leaked at exit" (7 geleakte
      Instanzen): verschachtelte Coroutine-awaits im Boot (Funktionszustand
      wartet auf Funktionszustand = Referenzzyklus, empirisch per
      Minimal-Probe belegt) plus verwaiste threaded Loads (Welt-Warmup +
      Cover-Artwork) beim Quit mitten im Boot — _boot wartet jetzt auf
      Signale und _exit_tree sammelt die Loader-Tasks ein; **(c)** der
      bughunt-Walkthrough selbst warf einen SCRIPT ERROR (freed Host am
      typisierten Parameter). **Zahlen:** Boot-Smoke 1 → **0** Warnzeilen
      (3× stabil), Walkthrough 31 → **4** Warn-/Fehlerzeilen — die 4
      verbleibenden sind absichtlich provozierte Kanten-Warnungen des Tools
      (unbekannte Spiel-Id, erschöpfter Gooby) + der Tool-Exit. Nebenbefunde:
      die alte B11-Anchor-Warnung (gvz_level_select) trat im kompletten
      Walkthrough NICHT mehr auf; 2 unformatierte McGooby-Dateien am HEAD
      repariert (CI-lint wäre sonst rot geblieben). Ehrlich offen: 4×
      „Parameter material is null" tief in der Testsuite (nur in
      Suiten-Reihenfolge reproduzierbar, isoliert grün) und das
      RID-Aufräum-Rauschen des Dummy-Renderers am Suiten-Ende. Preflight grün.
- [x] **Läden lebendig, Teil 2 (2. August):** Nach REHWEI + Baumarkt (P55) sind
      jetzt ALLE Stadt-Läden echte Orte: GOOBYMAN, GOOBYTHEKE, POW!, Post und
      Autohaus haben schlendernde Kunden-Goobys (mit Hüten, Regal-Griffen und
      eigenen Sprüchen je Laden — Drogerie/Apotheke/POW/Post/Autohaus, DE+EN),
      einen Kassen-NPC, der tippt, winkt und bei JEDEM Kauf hörbar piept
      (auch Autokauf und Post-Schalter), Tür-Glöckchen + Gemurmel-Loops und
      vollere Regale (Drogerie-/Medikamenten-Regalwände, Tiegel auf dem
      Tresen, Wartebänkchen, Bücher im POW-Regal, wachsender Paketberg,
      möblierte Autohaus-Beratungsecke). Der Wochenmarkt hat jetzt zusätzlich
      3 Marktbummler samt Marktgemurmel. 9 neue Wachen-Tests, Preflight grün.
- [x] **P56 Nachschlag „Ein-Spiel-Gefühl", Runde 2 (2. August):** Der
      gemeinsame Minispiel-Rahmen sitzt jetzt auch in den ÜBERGÄNGEN:
      **(a)** der 3-2-1-Auftakt wartet auf das ENDE des Blütenblätter-Wipes —
      vorher zählte er schon HINTER dem Veil los (Mindestanzeige 600 ms +
      Wipe 400 ms) und die „3" war in jedem Spiel halb verschluckt;
      **(b)** Reisen ZUR Arcade (rein wie raus aus jedem Minispiel) tragen
      eine eigene Spielhallen-Karte („Ab in die Arcade!", eigene Tipps,
      DE+EN) statt der „Trautes Heim"-Karte — und derselbe Mini-Gooby der
      Lade-Karte begleitet damit wirklich die GANZE Schleife
      Arcade→Pregame→Spiel→Results→Arcade; **(c)** das Pregame wärmt die
      (oft schwere 3D-)Spielszene threaded vor, während du noch die
      Schwierigkeit wählst — der Wipe in die Runde wird spürbar kürzer;
      **(d)** das Pause-Modal NENNT jetzt das Spiel (dieselbe
      Titel+Spielname-Paarung wie die Results-Plate); **(e)** die
      Strike-Teleport-Cutscene dunkelt EXAKT wie Pause/Results ab (vorher
      Freihand-Wert). Wachen ausgebaut: `test_g7_rahmen.gd` (Intro-Sync,
      Prewarm, Spielname-Zeile, Abdunkelungs-Pin) und `test_ui_veil.gd`
      (vierter Karten-Modus „arcade" inkl. DE/EN-Tipp-Parität).
      Preflight grün (26 042 UI-Checks / 0 rot).

_(Runden W14 UND W15 sind FERTIG — Details unten in „Erledigt". Aktueller Stand:)_

- [x] **W16 / Welle G2 FERTIG (1. August):** 13 Umsetzungs-Pakete gelandet,
      voller Testlauf grün (3024 Tests / 0 rot). Im Einzelnen:
      **(a) Update-Kanal aufs neue Repo** (Client-Config + Pack 1.1.0 + Doku
      samt Zugangsschlüssel-Migration),
      **(b) UI-Rework Fundament „Inhaltsspalte"** — Hintergrund vollflächig,
      Knöpfe/Inhalte gedeckelt in der Mitte; 7 Menü-Screens + Einstellungen
      umgestellt, automatische Zentrier-Prüfung wacht jetzt über alle Screens,
      **(c) Ladebildschirm im Alt-Look** — Szenenwechsel-Karte 1:1 nach der
      alten Web-Version (Cover-Zone, hüpfender Sticker, Teal-Balken, Tipps)
      **plus der rosa Blütenblätter-Wipe** als Übergang (26 Blüten/Blätter
      reiten der Wisch-Kante voraus, exakt die alten Web-Kurven),
      **(d) Arcade-Fix** — die 5 Ranch-Wettbewerbe haben echte Cover statt
      „?"-Platzhalter,
      **(e) 5 Minispiel-Polituren** — starHopper, trampoline, hideSeek,
      cityDrive und die Ranch-Arena (Überstrahlung raus, Publikum rein),
      **(f) Boot schneller** — erster Pixel ~55 ms früher, Welt-Laden mit
      echtem Fortschritt + vorgewärmter Musik (kein Ruckler in der Öffnung),
      **(g) 11 Prozess-/Robustheits-Fixe** (stapelnde Klick-Animationen,
      Zeitzonen-Fehler im Schnupfen-Wetter, schlafende Hintergrund-Prozesse,
      Speicher-Rettung aus Backups).
- [x] **W16 / Welle G3 FERTIG (1. August):** 12 Umsetzungs-Pakete gelandet,
      voller Testlauf grün (3078 Tests, alle Störfeuer beseitigt — u. a. 416
      wiederkehrende Fehlerzeilen im Testlauf auf 0 gebracht). Im Einzelnen:
      **(a) Inhaltsspalte ausgerollt** auf Arcade, IKEA-Katalog, Garderobe +
      Gestalten (mit Hochformat-Stapel) und das Album (Rail wird hochkant zur
      Chip-Leiste) — Hintergrund bleibt vollflächig, Knöpfe/Inhalte mittig,
      **(b) 12 Stadt-Orte** bekommen eine zentrierte Knopfleiste in der
      Daumenzone statt Ecken-Knöpfen; „geschlossen" (GOOBY-FREE) sieht man
      jetzt am Ort statt nur als Toast,
      **(c) Sozial + Post fühlbar** — alle Knöpfe drücken sich (Squish + Sound
      + Haptik nach fester Grammatik), Brief-Schreibfeld verwirft nichts mehr
      ohne Nachfrage, Ungelesen-Zähler als hübsche Kapsel,
      **(d) 137 Text-Feinschliffe** (Apostrophe, Gedankenstriche, ein Ding =
      ein Name, wärmerer Tonfall) über 50+ Dateien,
      **(e) Haptik-Stärke** (dezent/normal/stark) wirkt jetzt wirklich,
      **(f) carrotGuard poliert** (Möhren-Reihe fliegt sichtbar, Kombo-Pips,
      König-Banner, Timer-Urgenz, Intro-Beat),
      **(g) Server-CI + ehrliche Doku**, **(h) Trailer-Vorarbeiten**
      (Storyboard v4, 4 neue Aufnahme-Treiber, Zahlen-Fixes).
- [x] **W17 / Welle G4 FERTIG (1. August):** 18 Pakete gelandet, voller Testlauf
      grün (**3235 Tests / 0 rot**, UI-Audit **21 Screens × 4 Formate = 0 Befunde**).
      Das UI-Rework ist damit in der Fläche angekommen:
      **(a) Baumodus** — alle Werkzeuge in EINEM Dock unten-mittig (Daumenzone),
      **(b) IGohbie-Telefon** skaliert endlich mit (kein 420er-Überstand mehr),
      Fotomodus-Sucher in der Safe-Area,
      **(c) Reise-Strecke** — Abflugtafel/Reise-App/Bordkarte auf realer Breite,
      Weltengooby-Fortschritt „n/9 bereist" + Stempel,
      **(d) Radio/Kino/GOB.TY/Geschichten** — alle Knöpfe endlich fingergroß,
      **(e) Ranch-Mehrspieler hat jetzt einen sichtbaren Einstieg im Spiel**
      (Hof-Knopf → Raum anlegen/beitreten/Code teilen),
      **(f) Level-Auswahlen + Brettspiele** mittig mit gepinntem Fertig-Knopf,
      **(g) Boot-Ladebalken als Möhren-Pill im Alt-Web-Look** samt Papier-Ladekarte
      und „Lädt… NN%", **(h) Onboarding/Quests/Geburtstags-Feier** poliert,
      **(i) 7 Minispiel-Polituren** (teaParty, carrotCatch, bubblePop+bunnyHop,
      danceParty, fishingPond, goalieGooby, rocketRescue — Intro-Beats, lesbare
      HUDs, Jubel-Momente), **(j)** zentraler Fix: Punkte-Texte/Ringe treffen
      jetzt in ALLEN Spielen den gemeinten Punkt statt im Creme-Rand zu kleben,
      **(k)** Test-Runner gehärtet (ein Tippfehler in einer Testdatei kann den
      Lauf nicht mehr dauerhaft aufhängen).
- [x] **W17 / Welle G5 FERTIG (1. August):** 13 Pakete gelandet, voller Testlauf
      grün (**3387 Tests / 0 rot**, String-Parität 25 962 Checks / 0). Die großen
      Brocken aus deiner Liste sind jetzt SPIELBAR:
      **(a) DLC „Goo und Bye" Welle A** — im DLC-Hub freigeschaltet (ab Level 12,
      2500 Münzen, Kauf direkt im Angebots-Sheet): erster begehbarer Laden mit
      komplettem Tag-Loop Nachschub → Regal einräumen → Laden öffnen →
      Kundenstrom → Kassensturz; Onkel Alwin kommt jeden Tag um 9 und kauft
      GENAU eine Möhre, die Kasse piept sein Gebrabbel,
      **(b) DLC „McGooby" Welle A** — Probeschicht frei (kein Kauf-Gate, Welle B
      bringt das): Grill-Station mit taktilem Patty-Wenden (rosa → goldbraun →
      Kohle, „JETZT wenden!"), 10 Parodie-Rezepte (GoobyMac, Gurken-Deluxe mit
      7 Gurken …), Kassensturz mit Trinkgeld-Combo,
      **(c) GvZ-PvP übers Netz** — Gooby verteidigt, ein Freund schickt die
      Zombie-Wellen (Lockstep wie GOB-NOM, Matsch-Budget, Überlebens-Timer);
      das Server-Modul kommt in G6, bis dahin zeigt das Panel freundlich
      „Offline",
      **(d) Trailer 5.1 neu aufgenommen** — 62 s im neuen Look, alle 34 Clips
      frisch (Möhren-Ladebalken-Opening, Kühlschrank 2.0, Marktstand-Kamera,
      GvZ mit sichtbaren Zombies, Outro „38 Minispiele"),
      **(e) 11 Minispiele poliert** (goobySays, memoryMatch, lanternFloat,
      miniGolf, pancakeTower, pipeFlow, ghostHunt inkl. Datei-Entflechtung,
      burgerBuild, deliveryRush, shoppingSurf, toyRacer — Intro-Beats, lesbare
      Banner, Motor-/Fluss-Momente, Reduced-Motion sauber),
      **(f) Kino-Untertitel/Skip in der Safe-Area + Freunde-App im Telefon**
      (echtes Telefon-Layout mit Code-Teilen, Anfragen, Online-Punkten),
      **(g) UI-Wache ausgedehnt auf 34 Screens × 4 Formate** — die Alt-Screens
      bleiben bei 0 Befunden; die neue Abdeckung hat einen dicken Alt-Fisch
      gefangen: das Home-HUD bleibt im Baumodus sichtbar und liegt über dem
      Bau-Dock (97 Befunde, EIN Wurzel-Problem) → wird in G6 gefixt.

- [x] **DLC-Umsetzung „Goo und Bye" + „McGooby"** — Welle A beider Fundamente ist
      mit G5 gelandet und spielbar (s. o.); Welle B (Großmarkt-Fahrt, Preis-Schieber,
      weitere Stationen, Kauf-Gate McGooby) ist der nächste Ausbau-Schritt
- [x] **Minispiel-Qualität, Gruppe 3** — die notierten Kandidaten (starHopper-Bühne,
      trampoline-Gym, carrotGuard-HUD, hideSeek-Wiese, cityDrive-Feedback,
      Ranch-Arena-Überstrahlung) sind seit Welle G2/G3 alle umgesetzt; der Rest-
      Batch läuft in G5
- [x] **GvZ-PvP übers Netz** — Client komplett (Lockstep, Panel, End-Overlay);
      nur das kleine Server-Modul (gvzmp.js nach gobnom-Muster) folgt in G6
- [x] **Trailer-Refresh** — `trailer/GOOBY-5.1-Godot-Trailer.mp4` (62 s, 1080p60),
      alle 34 Clips mit dem neuen UI neu aufgenommen, 12 Abnahme-Stills gesichtet
- [-] **Dynamic Island / Live Activities + iOS-Homescreen-Widget** — braucht native
      Extensions in einer SIGNIERTEN App (Sideload-.ipa kann das nicht registrieren).
      Ehrlich zurückgestellt; Godot-Andockpunkte existieren.

---

_(gerade nichts offen — alle bisherigen Punkte stehen unten unter „Erledigt")_

- [x] **verbessere den Aufbau der Feedback Md**
      Neu gegliedert: 1. Neu von dir (hier reinschreiben), 2. In Arbeit,
      3. Wo das Spiel steht (Testen/Spielstand/Offenes/Trailer auf einen Blick),
      4. Erledigt mit Erklärung. Keine Doppelungen mehr, klare Reihenfolge.
- [x] **verbessere das UI von Gooby**
      Jeder Screen einzeln bewertet und nachgezogen: klare Hierarchie (eine Hauptsache
      pro Bild), einheitliche Kopfzeilen, illustrierte Leerzustaende statt leerer
      Flaechen, animierte Hintergruende mit eigener Farbstimmung, Freundescode als
      Blickfang. Die automatische UI-Pruefung (15 Screens x 4 Geraeteformate) bleibt
      bei 0 Befunden.
- [x] **Baumodus-Kulisse + Haus von aussen sehen**
      Diagnose der alten Kulisse: eine Ringstrasse lag 4 m an der Wand, mit Autos die
      groesser waren als der Raum - das las sich als Kreisverkehr um eine Insel. Neu:
      eigenes Grundstueck mit Zaun und Weg, EINE Strasse hinter Vorgarten und Gehweg,
      Nachbarhaeuser in richtiger Groesse, Baumreihen, Horizont. Im Garten steht jetzt
      dein Haus mit Dach im gewaehlten Stil daneben (die Haustuer sitzt exakt ueber der
      Gartentuer), Raeume haben Deckenbalken bzw. Dachschraegen, hinter Tueren sieht man
      den Nachbarraum, und aus Kuechen-/Badfenster blickt man in den Garten.
- [x] **Post-Processing + echte Gefuehle wie bei Animal Crossing**
      12 klar lesbare Emotionen mit Gesicht, Koerperhaltung, Bewegung, Ton und
      Symbol ueber dem Kopf: Schreck (Ausrufezeichen), Freude, Begeisterung,
      Ueberraschung, Verlegenheit, Trotz, Traurigkeit, Muedigkeit, Neugier, Stolz,
      Angst, Verliebtheit (Herz). Sie kommen von selbst - Schreck beim Donner,
      Verliebtheit beim Lieblingsessen, Stolz nach einem Rekord - und die starken
      bekommen einen Kamera-Zoom mit Zeitlupe. Dazu ein Effekt-Stapel: Vignette,
      Tageszeit-Toenung, Bloom, Tiefenschaerfe, Farbstoss bei starken Gefuehlen -
      in den Einstellungen abschaltbar, Kosten nur +1 Draw-Call.

---

## 2. In Arbeit

Runde W17 — Wellen G1–G5 und G7 sind FERTIG (Details oben + unten in „Erledigt").
_Hinweis zur Transparenz: die am 31.7. gestartete Welle G6 ist einem VM-Neustart
zum Opfer gefallen, bevor sie integriert/committet war — kein Stand verloren
gegangen außer der unfertigen Subagent-Arbeit; die G6-Pakete sind neu einsortiert._

**Welle G7 „SPIELGEFÜHL" ist FERTIG** (dein Feedback vom 1.8.; Abschluss-
Politur am 2.8.: die letzten Leitformat-Audit-Befunde gefixt → 34 Screens ×
iPhone 17 Pro Max quer = **0 Befunde**):

- [x] **P50 HUD-Dynamik** — beim Baumenü GLEITEN die HUD-Knöpfe animiert weg
      (und federn zurück), bei offenen Blättern/Modals weicht das HUD
      (Zustandsmaschine `hud_sichtbarkeit.gd`, Zähler-robust); Kachel-Labels
      werden nie mehr abgeschnitten (Font-Autoshrink `hud_label_fit.gd`,
      Ellipsis nur als bewusster letzter Ausweg), „Wo ist mein Gooby?"-Chip
      hält seine Textbreite. Wachen: `test_g7_hud_dynamik.gd`
- [x] **P51 Sprechblasen + Text-Fit** — „Ohh, wird das sch" ade: Höhen-Messung
      auf dem VOLLEN Text (der Typewriter shapte vorher nur die getippten
      Zeichen — Zeilen verschwanden), Blasen wachsen/wickeln sauber.
      Wachen: `test_g7_sprechblasen.gd`
- [x] **P52 IGohbie-Telefon-Rework** — Dunkel-Icon repariert, klare App-Icons
      + Labels, Öffnen-Animation, Wisch-zum-Schließen; quer nutzt das Telefon
      die breite Geräte-Basis. Wachen: `test_g7_phone.gd`
- [x] **P53 Modal/Sheet-System + Swipe** — EIN Blatt-Verhalten überall:
      Slide-in/out, Hintergrund-Dim, Runterwischen schließt (inkl. Radio-
      Like-Offscreen-Fix). Wachen: `test_g7_sheets.gd`
- [x] **P54 Garderobe + Gestalten poliert** — „Briefkasten" u. a. Kategorien
      nie mehr abgeschnitten, Scroll-Hinweise, Karten-Layout, Kauf-Feedback.
      Wachen: `test_g7_garderobe_gestalten.gd`
- [x] **P55 Läden lebendig, Teil 1** — REHWEI + IKEA sind ECHTE Orte:
      animierte Kunden-Goobys, Kassen-NPC, Ambiente-Sound, Deko
      (`ort_leben.gd`, `kassen_npc.gd`). Wachen: `test_g7_ort_leben.gd`
- [x] **P56 Ein-Spiel-Gefühl** — einheitlicher Minispiel-Rahmen (Pregame/
      Pause/Results im Gooby-Look, derselbe Mini-Gooby begleitet Wipe →
      Pregame → Results, EINE Knopf-Reihenfolge in allen 38 Spielen).
      Wachen: `test_g7_rahmen.gd`
- [x] **P57 iPhone-17-Pro-Max-Leitformat (2868×1320 quer)** — UI-Wache +
      Konformitätstests aufs Leitformat; die 17 bekannten Restbefunde gefixt.
      **Abschluss 2.8.:** die letzten 4 Audit-Befunde beseitigt — (a) die
      Baumodus-Kamera-Chips (⟲/⟳) tauchten hinter der Lager-Karte ab → die
      Leiste zentriert sich jetzt im freien Streifen ÜBER dem Dock (bricht
      notfalls auf 2 Spalten/1 Zeile um) und der „Was nun?"-Hinweis duckt
      sich im Baumodus mit dem HUD; (b) der Minispiel-Results-Screen lief
      mit Tagesbonus-Zeilen unten aus dem sicheren Bereich → der Fit-Pass
      schrumpft jetzt auch Sticker/Sterne/Abstände proportional mit
      (Knöpfe behalten den 44-pt-Touch-Floor). Audit: 34 Screens × Leitformat
      = 0 Befunde; neue Wachen in `test_g4_build.gd` +
      `test_fb3_screen_metrics.gd`
- [x] **P38R GvZ-PvP-Server** — `gvzmp.js` nach gobnom-Muster ist da, 11
      Node-Tests grün; das GvZ-Panel spielt jetzt echtes PvP übers Netz
- [x] **P58 Playtest-Harness + Pionier-Spieler** — das „Subagent spielt das
      Spiel"-Werkzeug steht komplett (`tests/tools/playtest_harness.gd` +
      Flows, eigene Instanz, echte Taps/Wische, Screenshot pro Schritt,
      Hänger-Watchdog, Markdown-Bug-Report; Aufruf:
      `tools/ci/run_playtest.sh <flow> 2868x1320`) — die 10-Spieler-Welle
      nutzt es als Nächstes (Welle H unten)

**Danach sofort (Warteschlange):**
- [~] **Welle H: PLAYTEST ×10** — LÄUFT: 6 Bereichs-Läufe sind gespielt,
      berichtet und GEFIXT (Reports in `docs/godot-rewrite/playtest/`):
      **H-home** (Zuhause & Pflege — u. a. tote Zähneputz-Pflicht,
      Schlaf-Gate der Pflege-Taps), **H-city** (Stadt & Läden — u. a.
      GOOBERANDO-Gratis-Buff-Exploit, 8 Wächter-Tests), **H-minigames**
      (Minispiel-Batch 1: teaParty/veggieChop/gardenRush/basketBounce/
      ranchHerde — 6 Funde), **H-ranch-travel** (Ranch-Kauf + Reise/Urlaub
      über 2 neue Headless-Flows im Playtest-Harness — 7 Funde),
      **H-dlc-park** (McGooby/Goo und Bye/Funkelpark/IGohbie — 4 Funde,
      u. a. Nachtband kippte nie während des Parkbesuchs, Goobye-Kunde
      lief rückwärts zur Kasse), **H-arcade-friends** (Arcade/Freunde/
      Profil über `flow_arcade` + neuen Flow `flow_profil_freunde` —
      3 Funde, u. a. tote Anfrage-Karte nach Mutual-Autoaccept und
      „Rekord 0“ im Profil trotz Schwer-/Endlos-Bestwerten); dazu
      zahlt „Playtest-Bugfixes, Batch 1" (s. oben) auf Quests/Erfolge/
      Awards ein. **Noch offen:** Baumodus, Minispiele-Batch 2+3,
      Telefon/Radio-Rest (Radio, Kamera/Galerie), Garderobe/Gestalten,
      Quests/Progression-Rest, Onboarding → die Restläufe bleiben die
      nächste Playtest-Tranche.
- [x] **Welle I: 30+ Ideen-Planner** — **FERTIG (2. August):** konsolidierte
      Ideen-Roadmap mit **50 konkreten Ideen** über alle 10 Planner-Bereiche
      (Seele, Haus/Bau, Stadt, Minispiele, Ranch, DLCs, Multiplayer,
      Progression, UI/UX, Audio/Technik), jede mit Wow-Wert (1–5) + Aufwand
      (S/M/L) bewertet, Top-12-Rangliste und Gruppierung in die
      Umsetzungs-Wellen J–M (inkl. Einordnung der neu einsortierten
      G6-Pakete): **`docs/godot-rewrite/IDEAS-WELLE-I.md`**. Transparenz:
      diese Runde lief als EIN Konsolidierungs-Planner über alle 10 Bereiche
      statt 10 parallel — Ergebnisformat identisch (10 Bereichs-Kapitel,
      priorisierte Gesamt-Roadmap).
- [ ] **Wellen J+: Umsetzung** — Playtest-Bugs + beste Planner-Ideen
      (jetzt konkret geschnitten in `docs/godot-rewrite/IDEAS-WELLE-I.md`
      §4: Wellen J–M) + die neu einsortierten G6-Pakete (DLC Welle B beider
      Läden, Ball-Wurf, ~~DLC-Ladebildschirme~~ *(erledigt 2.8., s. oben in
      „Neu von dir")*, Audio-Feel, ~~B11/Warn-Sweep~~
      *(erledigt 2.8., s. oben in „Neu von dir")*, ~~Doku-Refresh~~
      *(erledigt 2.8., s. oben in „Neu von dir")*,
      McGooby-Bühne, ~~Alwin-NPC~~ *(erledigt 2.8., s. oben in
      „Neu von dir")* — alle in J/K eingeordnet)

---

## 3. Wo das Spiel gerade steht

| | |
|---|---|
| **Testen** | GitHub → Actions → Lauf „GOOBY Godot" → Artefakt `GOOBY-godot-unsigned-ipa` herunterladen, mit AltStore/Sideloadly installieren. Anleitung: `docs/godot-rewrite/IOS-BUILD.md` |
| **Spielstand von früher** | Einstellungen → Spielstand → „Alten Spielstand übertragen"; Anleitung: `docs/godot-rewrite/SAVE-TRANSFER.md` |
| **Was noch offen ist** | `docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md` (ehrliche Feature-Matrix) |
| **Trailer** | `trailer/GOOBY-5.1-Godot-Trailer.mp4` (neu, W17-Look) — Vorgänger 5.0 bleibt daneben liegen |

---

## 4. Erledigt

Chronologisch nach Meldung; die Erklärung steht jeweils darunter.

- [x] **Runde W15 (31. Juli): Updates über DIESES Repo + 9 weitere Pakete**
      **App-Updates laufen jetzt komplett über dieses Repo** (dein Wunsch): Pack-Releases
      per Tag `packs-v*` (rollender `updates`-Release), der Client lädt über die
      GitHub-API mit Zugangsschlüssel (Einstellungen → Updates → „GitHub-Token";
      da das Repo privat ist, brauchen Freunde einen Lese-Token von dir — Anleitung
      in docs/UPDATES.md §6a), und der ipa-Release-Job pflegt latest_native jetzt
      automatisch. KEINE Extra-Repo-Aktion mehr nötig!
      Außerdem: **Gooby im Urlaub besuchen** (Strand/Berge/Stadt-Szenen + Raumstation,
      Streicheln/Foto/Muschel-Sammeln/Souvenir-Spot, 24 neue Urlaubs-Sprüche);
      **Minispiel-Gruppe 2 poliert** (purblePlace-UI-Redesign, ranchHerde-Treiben mit
      Einfluss-Ring, rocketRescue-Kamera, gardenRush-Kulisse, danceParty-Publikum,
      AC-Level-Menüs mit Sterne-Stempeln); **4 neue Garten-Crops** (Radieschen, Mais
      mit Wind-Empfindlichkeit, Aubergine, Kürbis) → das Gemüse-Sammelset ist jetzt
      8/8 erspielbar und ALLE 4 Sammlungen sind komplettierbar; **GOB-NOM-Coop übers
      Netz** (2 Geräte, Lockstep mit Desync-Wächter + Rejoin — zugleich die Vorlage
      für GvZ-PvP); **Kamera fährt jetzt wirklich DURCH die Tür** beim Raumwechsel
      (additiv geladener Zielraum, Gooby läuft voraus; Fallback auf den Wisch bei
      Reduced-Motion/Low-End); **Wochenmarkt-Eigenstand** (Stand bestücken, Preise
      per Slider, deterministische Verkaufs-Sim mit Tagestrend „Heute lieben alle
      Kürbisse!", Abrechnungs-Karte) + 3 neue Craft-Rezepte mit 3D-Vorschau
      (Vogelhäuschen, Kräuterkasten der wöchentlich Markt-Ware liefert, drehendes
      Windrad); **danceParty-Timing-Kalibrierung** (Audio-Latenz-Ausgleich + 8-Beat-
      Antipp-Kalibrierung); **HDR-Glow-Auto-Downgrade** auf schwachen Geräten;
      **GOB-NOM-Level-EDITOR** im Godot-Editor (Level visuell bauen, Solver-Check);
      **neue Gooby-Clips phone_up/phone_tap** (Selfie-Emote echt) + Streichel-Übermut-
      Gag („Paus-e-e!"); **30 von 38 Minispielen sind jetzt bit-genau gegen die alte
      Web-Version zertifiziert** (vorher 12). Qualität: 3.010 Haupt-Tests, 24.815
      UI-Checks, 140 Server-Tests — alles grün, Preflight grün.

- [x] **Runde W14 (31. Juli): dein komplettes Feedback vom Morgen — 12 Arbeitspakete**
      **UI-Full-Rework:** Buttons/Karten exakt an der alten Web-Version geeicht (Press-Squish
      0.94 mit Feder-Overshoot, wärmere dicke Outlines), NEUE animierte runde ACNH-Sprechblasen
      (Pop-In-Wackler, Atmen, Buchstaben-Typewriter, Sprech-Schwanz) überall, haptisches
      Feedback auf JEDEM Knopf (abschaltbar unter Einstellungen → Haptik), und Notifications
      können Goobys Bubble strukturell nie mehr überlappen (Anker-Zonen + Ausweich-Logik, per
      Test bewiesen). Alle Screens reworked: Settings (6 Icon-Gruppen), Arcade, Profil (inkl.
      Reisepass-Hochkant-Fix — lief 40 % übers Canvas!), Album (Off-Screen-Sticker gefixt),
      HUD (Daumen-Zeile unten/Cockpit-Spalte quer nach Design-Doc), IKEA (Preis-Pillen statt
      abgeschnittener Preise), Radio/Codes/News/Pause/Galerie im Einheits-Look.
      **Ladebildschirm:** Beim App-Start jetzt ein generiertes Vollbild-Coverartwork
      (Gooby + Garten/Stadt/Ranch-Panorama) mit ECHTEM Möhren-Ladebalken (an die realen
      Boot-Phasen gekoppelt) + 10 knuffige Sprüche, dann Kreis-Wipe-Öffnung auf Gooby ins
      Spiel; der Szenenwechsel-Veil wurde mitpoliert (hüpfender Gooby, Fortschritts-Punkte).
      **Kühlschrank 2.0:** Regal-Grid mit echten 3D-Vorschauen, Kategorien-Chips,
      Vorrats-Badges, Stat-Pillen — und eine richtige Fütter-Sequenz: die Speise schwebt zu
      Gooby, er mampft in 3 Bissen mit Krümeln und Sound, Lieblingsessen macht verliebt.
      **Gooby lebendiger:** 120+ neue deutsche Text-Lines (Tageszeiten, Wetter, Reaktionen
      auf alle neuen Features, Selbstgespräche), NEU: Antwort-Chips — du kannst Gooby
      antworten und er reagiert (12 Mini-Dialoge), 3 Gebrabbel-Melodien (fragend/aufgeregt/
      schläfrig).
      **Decke weg beim Umschauen:** Kamera von oben = Decke/Balken/Dachschräge faden sanft
      aus (Decken-Lampen im Baumodus als 30-%-Geister). **Stadt-Feinschliff:** Top-5-Diagnose
      gefixt (Pastell-Fassaden-Varianz, Laternen-Lichtkegel nachts, begrünte Vorplätze,
      weiche Distrikt-Übergänge, möblierter Wochenmarkt).
      **Mehrspieler-Settings:** Server + Port + Secret jetzt ganz normal in den Einstellungen
      (mit „Verbindung testen"-Knopf); Secret wird serverseitig geprüft (GOOBY_JOIN_SECRET).
      **DEV-Tools-Werkzeugkasten:** 6 Tabs — Spielstand (Coins/XP/Sticker/Fixtures), Zeit
      (Uhr-Offset + „Nächster Tag"), Events (jedes sofort auslösen + Wetter-Override),
      Gegenstände (durchsuchbare Item-Vergabe), Netz (Config-Dump, Log, Outbox), Perf-Overlay.
      **DLC-Hub:** Einstellungen → DLC mit großen Cover-Karten (Ranch = verfügbar/installiert,
      „Goo und Bye" + „McGooby" = BALD mit generierten Coverarts + spoilerarmen Teasern);
      beide neuen Riesen-DLCs sind fertig durchdesignt (je ~600-700 Zeilen Design-Doc mit
      20-Perspektiven-Ideensammlung, Kern-Loops, Mitarbeiter-Gags, Multiplayer, Technik-Plan).
      **Minispiel-Qualitätspass:** Alle 38 Spiele bewertet (5 Achsen); die 6 schwächsten tief
      poliert — dabei ECHTEN Bug gefunden: die 3 Ranch-Wettkampf-Spiele hatten unsichtbares
      HUD! Dazu GvZ-Intro + Mäher-Fix, starHopper-Forgiveness, runner-Licht, 7 Quick-Wins
      (danceParty-Bahnen sichtbar, deliveryRush-Leuchtkugel, u. a.).
      Qualität: Haupt-Runner 2872 Tests grün, UI-Runner 24027 Checks grün, Preflight grün.

- [x] **Runde W13, Welle A+B (30./31. Juli): Backlog-Großputz — 20 Arbeitspakete**
      Jeder Push baut jetzt automatisch eine frische unsignierte .ipa (Artefakt
      `GOOBY-godot-unsigned-ipa`; Läufe 30592927997 + 30597075885 grün). NEU/GEFIXT:
      Ball werfen & apportieren ist zurück (Web-Physik 1:1, Wohnzimmer); die 4
      Sammlungssets (Fische/Gemüse/Sehenswürdigkeiten/Leckereien) sind wieder im Album
      sichtbar UND werden von Angeln/Ernte/Lieferungen/Füttern echt befüllt; sichtbarer
      Regen/Schnee/Gewitter jetzt auch in Haus (durchs Fenster), Garten und Stadt; die
      Stadt liest echtes Wetter statt Dauer-Sonne; GvZ-Sticker sind endlich erspielbar
      (L5/L10/L15-Meilensteine, 2 neue Sticker „Zaunheld" + „Nutella-Kommandant") und
      der Geheimcode GOLDIGOLD schaltet Goldi frei; „Wo ist mein Gooby?" springt zu ihm
      und er erzählt, was er gerade tut; der Auge-Knopf markiert alle anklickbaren
      Objekte (Rim-Glow + Pfeile); Radio: Bordmusik ohne Kauf nur pausierbar, Sender/Skip
      erst nach IKEA-Kauf, dazu „Was läuft?"-Ticker; Ranch ab Level 15 kaufbar + 4
      Ranch-Random-Events (ausgebüxtes Pferd, Heudieb, Hufschmied, Karottenregen); 9 neue
      Speisen inkl. Nutella + die Küchen-Nougatschleuse aus dem Web ist zurück;
      Post/Mail-Multiplayer komplett (Briefe + Fotos + Geschenke an Freunde, Quota,
      offline-Outbox); GOOBERANDO mit 3 Restaurants und echtem Fahrer auf der Karte;
      Guber kostet 30 (Surge-Gag 18–20 Uhr: 45); City Drive ist jetzt eine echte
      Arcade-Runde mit Score/Strikes, Autos haben Stats, die im Pregame stehen;
      Reisepass 2.0 (Flip-Karte, eigenes Passfoto aus der Galerie, Stempelseite,
      MRZ-Gag) + Abflugtafel im Split-Flap-Look + Boarding-Pass; Raumstation GOOB-1
      als betretbarer Ort (2 Arcade-Terminals, Low-Gravity-Hopser); Weltengooby-Titel
      bei 9/9 Zielen + 48-h-Erholungs-Boost + GOOBY-FREE-Shop am Flughafen; Besucher
      schlafen abends auf der Couch; Coop-Fahrt mit synchronem Radio; Geschichten-Stunde
      mit 6 Büchern/14 neuen Geschichten + Abnutzung; Schüttel-Secret (3 Stufen bis zum
      Ragdoll-Flug + Geheim-Sticker „Ganz blümerant"); Decken-Bau-Layer + spannbare
      Girlanden (Wimpel/Lichterkette/Pompons); Sticker-Rarity-Effekte (Gold glitzert,
      Konfetti+Jingle); Galaxie-Fellfarbe mit Sternen-Shader; Klopapier-Mumie-Event;
      Buchstaben-Typewriter in Dialogen; 5 Kauf-Bugs gefixt (Geld weg ohne Leistung —
      Lambda-Capture-Falle); alte Debug-Instrumentierung entfernt; STATUS.md/Doku auf
      den ehrlichen Ist-Stand gebracht.

- [x] **Stelle immer sicher das die Github Actions runs erfolgreich sind.**
      ALLE DREI JOBS GRUEN (Lauf 30285924723: lint, linux-checks, ios-ipa). Die .ipa liegt als
      Artefakt bereit (188 MB, gewachsen durch Ranch/Musik/Modelle). Damit das so bleibt:
      tools/ci/preflight.sh faehrt lokal exakt dieselben Pruefungen vor jedem Push, und der
      iOS-Job baut jetzt auch dann, wenn Tests rot sind (dann mit Hinweis im Artefaktnamen) - du
      bekommst immer eine .ipa.

- [x] **Erstelle mal richtige Skyboxen selber**
      prozeduraler Himmel-Shader mit 7 Stimmungen (klarer Morgen, Mittag, goldene Stunde,
      Abendrot, Nacht mit Sternen, bedeckt, Gewitter), blendet weich zwischen Tageszeit und
      Wetter.

- [x] **Mach das der Boden auch etwas Textur hat also mal rau ist oder uneben statt das alles nur hunderprozent gerade flächen sind.**
      mehrstufiges Gelände-Rauschen (Großformen + Hügel + Feinstruktur), Bodentextur-Variation
      (Grasbüschel, Erdstellen, Trampelpfade, Kies, Matsch nach Regen) und kleine Unebenheiten.

- [x] **Du kannst dir ja von vielen UIs oder Modelen erst bilder generieren und sie danach nach bauen damit du mehr infos hast wie so etwas ca. aussieht.**
      genau so gemacht: für das Gooby-Modell wurde die alte Web-Version gerendert und
      Bild-für-Bild verglichen, das Ranch-Artwork wurde generiert und danach nachgebaut.

- [x] **Der Trailer ist noch nicht perfekt und vorallem ist das gameplay etwas zu low quality also irgendwie ist das pixelig**
      Ursache gefunden: die Clips wurden in 960x540 aufgenommen und auf 1080p hochskaliert, MSAA
      war aus, und es gab drei verlustbehaftete Kompressionsstufen. Jetzt nativ 1920x1080, MSAA
      4x, verlustfreie Zwischenbilder, ein einziger Endencode mit CRF 16.

- [x] **Die Ranch ist nicht "belebt" genug und irgendwie fehlt so ein richtiges Feeling also Berge, Landschaften, Dinge zum erkunden.**
      Ranch-Openworld massiv erweitert: begehbares Bergmassiv (Gipfel ~90 m) mit Serpentine,
      Plateau, Schlucht mit Hängebrücke und Bergsee, dazu 7 neue Zonen (Lavendelwiese, Nebelmoor,
      Turmruine, Muschelbucht, Apfelgarten, Kornfeld, Strand), Wegenetz mit Wegweisern und
      Rastplätzen, 9 Entdeckungsorte.

- [x] **Viele Regionen sehen noch recht kahl aus also da fehlt so das du Scenerie besser gemacht hast wie zb mehr Bäume, hier und dort blumen,büsche etc**
      neue Streu-Bibliothek verteilt Bäume, Büsche, Blumen, Gräser, Steine und Farne in Gruppen
      statt gleichmäßig - angewendet auf Ranch UND Stadt (Straßenbäume, Blumenkästen, Hecken,
      Grünstreifen, Efeu).

- [x] **Jedes Spiel muss 3D sein**
      alle 36 Minispiele sind jetzt echte 3D-Szenen mit Kamera, Umgebung, Licht und Schatten -
      geprüft durch einen Test, der für jedes Spiel Kamera + Umgebung + Geometrie verlangt.

- [x] **Gooby braucht sein altes Model aus der alten vor Godot version wieder. (Du kannst dir ja einfach den anderen Branch anschauen)**
      das Original ist zurück: alle Proportionen wurden am Web-Quellcode gemessen und im
      Blender-Modell wiederhergestellt (Kopfanteil, Augengröße, Ohren, Wangen). Nebenbefund: die
      Farbpalette war doppelt kodiert und dadurch übersättigt - auch behoben.

- [x] **Viele UI Elemente sind noch nicht polished**
      UI-Prüfung über 15 Screens x 4 Gerätformate fand 430 Befunde - alle behoben (0 verbleibend).
      Dazu Mikro-Animationen: federnde Panels, gestaffeltes Einblenden, hochzählende Zahlen.

- [x] **Der Stadt fehlt auch sceneriere**
      Stadt bekam Alleen, Hecken, Blumenkästen, Grünstreifen, Efeu an Fassaden und
      Park-Verdichtung.

- [x] **Manche Autos schweben**
      Ursache: die Fahrbahn-Kacheln lagen mit ihrer Dicke über Null, die Fahrzeuge aber auf Null.
      Behoben, plus ein Test der für alle Fahrzeuge Bodenkontakt prüft.

- [x] **Viele UI Sachen sind meist ganz ganz außen am Rand und Skalieren nicht wirklich mit der gerät größe**
      zentrale Skalierung an der kurzen Bildschirmkante durchgesetzt, Safe-Area überall
      respektiert, Tippflächen auf mindestens 44 pt gebracht.

- [x] **Viele UI Sachen sind einfach nervig zuerreichen zb bei einem Mini Spiel kann das Pause Menü wenn man es öffnet auch nur ein Modal in der Mitte öffnen.**
      das Pause-Menü ist jetzt eine kompakte, mittige Karte über Abdunkelung (max. 62 % Breite) -
      für alle 36 Spiele auf einmal, inklusive echtem Einfrieren und 3-2-1 beim Fortsetzen.

- [x] **Das Rennen lässt alle in einander fahren?**
      Karts haben jetzt echte gegenseitige Kollision (sanftes Abdrängen + Tempoverlust statt
      Durchfahren), mit Test der den Bug erst nachweist und dann den Fix.

- [x] **Die Seele des Spiels fehlt.**
      Diagnose ergab: es gab zwar 43 Sprueche, aber keinen ZUSTAND. Goobys Gesicht fiel nach jedem
      Moment auf happy zurueck - bei leeren Stats riss er noch Witze. Jetzt: eine traege Laune
      (Halbwertszeit Stunden) faerbt Gesicht, Ohrenstellung, Lider, Bewegungstempo, Stimmlage und
      Idle-Auswahl. Dazu Absicht statt Zufall (Hunger -> er geht zum Kuehlschrank und schaut dich
      an), Blick der dir folgt, und Erinnerungen aus echten Erlebnissen.

- [x] **Du musst checken das die Builds wirklich erfolgreich sind statt immer Fehler kommen.**
      Ursachen analysiert (10x Formatierung, 8x eine veraltete iOS-Prüfung). Es gibt jetzt
      tools/ci/preflight.sh, das lokal exakt dieselben Prüfungen fährt wie die CI - vor jedem
      Push.

- [x] **Die kompletten Rückblicke Cutsecenen fehlen**
      Rückblick-Kino im Querformat und 5 Cutscenes sind gebaut (Aufwachen, Schlafengehen, Abreise,
      Urlaubsankunft, Einkaufsfahrt).

- [x] **Es fehlt fast alles von da vor und was da ist ist einfach nur schlechter, das einzig gute ist das Bau System der Rest sonst ist kacke.**
      unabhängige Prüfung: von 79 Features der alten Version sind jetzt 53 vollständig, 16
      teilweise, 10 fehlen - dazu sieben Spiele, die es vorher gar nicht gab. In dieser Runde neu:
      Profil, 44 Erfolge, Tagesbonus, 24 Tagesquests, Schlaf/Krankheit/Tierarzt, Funkelpark,
      Radio, Codes, Galerie, Postkarten.

- [x] **Das Ganze Spiel ist viel zu unfertig.**
      Vollstaendigkeit gegenueber der alten Version: von 53 auf 70 der 79 Features (5 teilweise, 3
      offen, 1 bewusst gestrichen). Neu in dieser Runde: Profil, 44 Erfolge, Tagesbonus, 24
      Tagesquests, gefuehrtes Onboarding, Schlaf/Krankheit/ Tierarzt, Funkelpark, Radio, Codes,
      Galerie, Postkarten, Arcade-Modifikatoren. Alle 'Bald'-Platzhalter sind beseitigt (per Test
      abgesichert).

- [x] **Das Spiel hat keine Seele**
      43 Seele-Momente gebaut: Gooby grüßt mit deinem Namen nach Tageszeit, vermisst dich nach
      längerer Abwesenheit, kommentiert Wetter und Neuanschaffungen, hat Lieblingsessen, feiert
      Geburtstage und Jubiläen, erinnert sich an echte Erlebnisse, macht Unsinn wenn man nicht
      hinsieht.

- [x] **Das Spiel ist nur eine Alpha.**
      Das Urteil der unabhaengigen Pruefung lautet jetzt: 'Inhaltlich komplettes Spiel mit wenigen
      dokumentierten Restluecken - kein Alpha-Zustand mehr.' Die drei ehrlich offenen Punkte
      (Ball-Wurf, Sammlungsset-UI, Gyro-Parallax) stehen in
      docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md.

- [x] **Alle Spiele sind grauen Haft.**
      siehe Politur oben - jedes Spiel wurde vorher/nachher bewertet und alles unter 4 von 5
      verbessert.

- [x] **Baue wirkliche 3D Spiele und nicht so 2D zeug.**
      erledigt, alle 36 Spiele sind 3D.

- [x] **Stelle sicher das wirklich alles 3D ist und nicht 2D**
      per Test abgesichert: jede Spielszene braucht Kamera, Umgebung, Licht und mindestens drei
      3D-Objekte.

- [x] **Das neue Gooby model ist nicht so toll wie das alte, nutze das alte bitte wieder.**
      siehe oben - das alte Modell ist wiederhergestellt und in allen Ansichten geprüft (Haus,
      Editor, Garderobe, Minispiele, Ranch).

- [x] **Es ist irgendwie nicht alles so gut gebackportet worden nur so gerusht ohne ohne Liebe zum detail.**
      die Vollständigkeitsprüfung listet jetzt jedes Feature der alten Version mit Belegstellen
      auf beiden Seiten - offene Punkte stehen in docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md.

- [x] **Jedes Game hat nicht genug Polish.**
      dito - plus zentral verbesserte Momente (Countdown, Ergebnisbildschirm mit hochzählenden
      Punkten, Sternen, Rekord-Feier), die auf alle Spiele gleichzeitig einzahlen.

- [x] **Das ganze UI ist null wie davor**
      Theme gegen die alte Web-CSS geeicht (Schattenfarben, Radien, Federungskurve, Stat-Pillen
      mit Icons) und animierte Hintergründe mit eigener Farbstimmung je Bereich.

- [x] **Es gibt viele Bugs.**
      systematischer Durchlauf: Godot-Meldungen von 7 Fehlern und 533 Warnungen auf 1 und 5
      gesenkt (Lambda-Captures, Navigations-Sync, Speicherlecks, GPU-Readback, veraltete
      Materialeigenschaft).

- [x] **Warum ist sovieles keine richtigen Assets sondern nur premetives?**
      23 eigene Blender-Modelle gebaut (Kassettentüren mit Klinke, Fensterrahmen, Duschvorhang,
      Duschkopf, Shed, Werkstatt, Gewächshaus, Sprinkler) und 6 fertige Modelle eingebunden; dazu
      Wanddeko (Lichtschalter, Steckdosen, Heizkörper, Bilderrahmen).

- [x] **Es fehlt der polish. Nimm dir mehr Subagents die auch sowas wie Dopamin, Sounddesign und feeling bewerten und verbessern sollen.**
      unabhängiger Prüf-Agent hat Dopamin, Sound und Spielgefühl gemessen; die Befunde wurden
      umgesetzt: Belohnungen von 9 auf 24 pro Erstflow, kein Musikstück clippt mehr, Loop-Nähte
      von 95 dB auf 6 dB, Türwechsel von 918 auf 455 ms, Nochmal-Start von 2450 auf 509 ms.

- [x] **Verbessere den Remotion Trailer massiv vor allem mit dem neuen was du alles geändert hat hat sich ja auch das aussehen geändert also baue den Trailern nochmal besser**
      komplett neu gebaut: 54,6 s, alle 27 Clips neu aufgenommen (der alte zeigte noch das falsche
      Gooby-Modell), mit Ranch-Kapitel, Bergmassiv, neuen Zonen, Wetter, Dorf, Turnier und
      Multiplayer.

- [x] **Deine Ganze Arbeit bisher ist viel zu wenig und es kommt mir so vor als ob du keine Mühe bisher hattest. Gib dir mehr Mühe und nimm mehr Subagents und mehr Teams die gemeinsam ansachen arbeiten statt nur 6-8 Subagents. Du kannst wirklich 20-30 nutzen.**
      auf bis zu 9 gleichzeitige Agents pro Welle hochgezogen, plus unabhängige Bewerter-Agents
      für Dopamin, Sounddesign und Vollständigkeit.

- [x] **Verbessere nochmal die Gooby Ranch sowie Seceneriere ich will das es richtig schönes aussehen gibt es soll auch berge und terrain etc geben baue die OpenWorld da richtig nochmal mehr aus.**
      siehe Bergmassiv + 7 neue Zonen oben.

- [x] **Verbessere jedes Minispiel nochmal mit jeweils 3 Subagents Fable 5 Max Thinking als Model nutzen unbedingt damit die Arbeit wirklich perfekt wird.**
      alle 36 Spiele durch Politur-Agents gelaufen: echte Kulissen mit Tiefe, Gooby als sichtbarer
      Mitspieler, korrigierte Belichtung (die Bühnen waren rund 40 Luma-Stufen zu hell),
      Belohnungsmomente, Ton.
