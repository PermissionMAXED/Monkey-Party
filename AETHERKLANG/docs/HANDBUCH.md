# AETHERKLANG
## Handbuch der Resonanz

> **„Die Welt hat eine Stimme. Du lernst sie zu spielen.“**

Dieses Handbuch ist die vollständige Begleitung zu Aetherklang. Es erklärt
Mythos, Systeme, Inhalte, Bedienung und den vorgesehenen Weg vom ersten
Kristall bis zur finalen Kadenz. Im Spiel trägt es den Namen **Kodex der
Resonanz** und erscheint als indigo-goldenes Tonarium.

### Legende zum Entwicklungsstand

- **Spielbar** – in der aktuellen Fassung verdrahtet und nutzbar.
- **Fundament** – registriert, sichtbar und für weitere Mechanik vorbereitet.
- **Vision** – das geplante Spielziel; wichtig für Balancing und Progression.

Die Statusangaben halten dieses Handbuch ehrlich, ohne die Weltbeschreibung
auf bloße Patchnotes zu reduzieren.

---

## 1. Das Lied unter der Welt

Lange bevor die erste Spitzhacke Stein berührte, schwang der
**Aetherklang** durch alles Lebendige und Unbelebte. Berge hielten tiefe
Grundtöne. Flüsse trugen Melodien weiter. Kristalle bewahrten Erinnerungen an
jeden Klang, der sie je erreichte.

Dieses Gefüge war nie vollkommen still. Es lebte von Spannung und Auflösung,
von Frage und Antwort. Doch **Choral**, einst Hüter der großen Kadenz, wollte
die Weltenstimme nicht länger begleiten. Er wollte sie besitzen. Er schnitt
Töne aus ihrem Zusammenhang, schichtete Echos übereinander und formte daraus
die **Dissonanz**: Klang ohne Einverständnis.

Seitdem öffnen sich Dissonanzrisse. Erinnerungen werden zu Kreaturen.
Resonanzkristalle wachsen dort, wo die Welt versucht, sich selbst wieder zu
stimmen.

Du bist ein **Resonant**. Du hörst den Grundpuls, den andere für Wind,
Redstone oder Zufall halten. Deine Aufgabe ist nicht, jedes Geräusch zum
Schweigen zu bringen. Du musst zuhören, antworten und das Lied wieder in eine
Form bringen, in der viele Stimmen nebeneinander bestehen können.

---

## 2. Schnellstart: deine erste Kadenz

1. Öffne im Kreativinventar den Tab **Aetherklang** oder folge im
   Überlebensmodus den freigeschalteten Rezepten.
2. Nimm eine **Stimmgabel** und einen **Kodex der Resonanz**.
3. Rechtsklicke mit der Stimmgabel. Sie markiert Resonanzquellen in deiner
   Umgebung und stimmt dich auf **Stille**.
4. Drücke **K** oder benutze den Kodex mit Rechtsklick.
5. Beobachte den Beat. Eine Aktion nahe am Puls erzeugt das stärkste
   Feedback und Resonance Points.
6. Probiere die **Resonanzklinge**: On-Beat-Treffer und ihre geduckte
   Resonanzwelle zeigen das Grundprinzip aus Aufbau und Ausgabe.

**Tipp:** Übe erst an einem sicheren Ort. Aetherklang belohnt eine einzelne
bewusste Antwort mehr als hektisches Klicken.

---

## 3. Die fünf Stimmungen

Stimmungen sind Resonanzhaltungen. Sie sind keine dauerhaften Klassen und
keine moralischen Wertungen. Jede verändert, wie du die Welt hörst und welche
Antwort dir leichtfällt.

| Stimmung | Farbe & Haltung | Systemischer Schwerpunkt | Spielidee |
| --- | --- | --- | --- |
| **Stille** | Indigo · aufmerksam | Kreaturen-Bemerkungsradius `×0,75` über die Resonanz-API | Erkunden, vorbereiten, RP bewahren |
| **Freude** | Gold · verbindend | Heilende Aura im Fünf-Sekunden-Puls | Gruppe stabilisieren, gemeinsam spielen |
| **Zorn** | Magenta · entschlossen | Schadensintegration `×1,10` | Kurze offensive Kadenzen, klares Risiko |
| **Trauer** | Cyanblau · tragend | Verlangsamungseinfluss `×0,50` | Kontrolle aushalten, ruhig weiterspielen |
| **Wunder** | Cyan · neugierig | Glückseffekt und Notenpartikel | Entdecken, improvisieren, Chancen öffnen |

### Stille

Stille ist nicht Abwesenheit, sondern Raum. In ihr hörst du gegnerische
Muster früher, verschwendest weniger Resonanz und bereitest die nächste
Phrase vor. Die Stimmgabel führt dich beim Benutzen in diese Haltung.

### Freude

Freude verbindet Stimmen. Ihre Aura pulsiert alle fünf Sekunden in einem
Radius von sechs Blöcken und kann verletzte Verbündete einschließlich dir
selbst leicht heilen. Sie glänzt in Gruppen und langen Expeditionen.

### Zorn

Zorn verdichtet Resonanz zu einem scharfen Akzent. Integrationen können ihren
Ausgangsschaden um zehn Prozent erhöhen. Zorn ist wirkungsvoll, aber keine
Erlaubnis zum Button-Mashing: Ein verfehlter Takt bleibt ein verfehlter Takt.

### Trauer

Trauer nimmt Last an, statt vor ihr davonzulaufen. Ihre Integrationsfunktion
halbiert die Wirkung von Verlangsamung. Das macht sie zur Haltung für
kontrollierte Rückzüge, schwere Arenen und geduldige Gegenangriffe.

### Wunder

Wunder behandelt die Welt als offene Frage. Es erneuert regelmäßig einen
Glückseffekt und zeichnet Notenpartikel um den Resonanten. Diese Stimmung ist
für Entdeckung, seltene Chancen und spielerische Improvisation gedacht.

> **Bedienung:** Die Standardtaste **M** wechselt die Stimmung, sobald die
> zugehörige Client-Mechanik aktiv ist. Admins und Tester können sie bereits
> mit `/aetherklang mood <stimmung>` setzen.

---

## 4. Takt: die Mathematik des guten Moments

Der autoritative Beat läuft mit **120 BPM**. Ein Schlag dauert damit
**500 Millisekunden** beziehungsweise zehn Spielticks bei stabilen 20 TPS.
Bewertet wird der Abstand deiner Aktion zum nächsten Schlag.

| Wertung | Phasenabstand | Zeitfenster bei 120 BPM | Bedeutung |
| --- | ---: | ---: | --- |
| **PERFEKT** | `≤ 0,08` | **±40 ms** | Maximales Feedback; aktuell `+2 RP` für angebundene perfekte Aktionen |
| **GUT** | `≤ 0,20` | **±100 ms** | Solide Ausführung im erweiterten Fenster |
| **DANEBEN** | `> 0,20` | außerhalb **±100 ms** | Aktion kann treffen, erzeugt aber keinen perfekten Beat-Bonus |

Die Fenster liegen **vor und nach** dem Schlag. Ein Treffer 35 ms vor dem
Puls ist ebenso perfekt wie einer 35 ms danach.

### So lernst du den Beat

- Höre auf den Beat-Tick und beobachte den goldenen Ring.
- Zähle in gleichmäßigen Vierteln: **eins – zwei – drei – vier**.
- Beginne mit einzelnen Aktionen, nicht mit langen Serien.
- Nutze `/aetherklang beat info`, um Phase und aktuelle Wertung zu prüfen.
- Bei Server-Lag zählt die serverseitige Phase. Visuelles Feedback ist die
  Bestätigung, nicht die Quelle der Wahrheit.

### Dissonanz und Timing

Die Dissonanzskala reicht von `0,0` bis `1,0`. Sie ist als Gegenrhythmus zu RP
gedacht: Fehler, Risse und riskante Kräfte erhöhen sie; saubere Kadenzen,
Stille und geschlossene Risse bauen sie ab. Die persistente Spielerdatenbasis
ist **spielbar**; weitere Quellen, Schwellen und Weltfolgen sind **Vision**.

---

## 5. Resonance Points (RP)

RP sind gespeicherter Gleichklang. Sie messen nicht Erfahrung, sondern wie
viel sauber aufgebaute Resonanz du gerade in eine besondere Aktion umsetzen
kannst.

### Regeln

- Der Vorrat liegt zwischen **0 und 100 RP**.
- Eine angebundene perfekte Beat-Aktion gewährt aktuell **2 RP**.
- Die Stimmgabel kann bei passendem Takt **3 RP** erzeugen.
- Ein On-Beat-Treffer der Resonanzklinge gewährt **2 RP**.
- Spezialfähigkeiten ziehen ihre Kosten nur bei erfolgreicher Auslösung ab.
- RP, Stimmung, Beatphase, Dissonanz und Kodex-Freischaltungen werden im
  Spieler-Attachment gespeichert und beim Tod kopiert.

### RP-Ökonomie

Der Kernzyklus lautet:

**zuhören → präzise Grundaktion → RP aufbauen → Instrumentfähigkeit →
neu positionieren → wieder zuhören**

Wer alle RP sofort ausgibt, hat keine Antwort auf einen überraschenden
Angriff. Als Faustregel sind 12 bis 25 RP Reserve sinnvoll, solange die
Begegnung noch unbekannt ist.

---

## 6. Gegenstände und Instrumente

### Stimmgabel — `aetherklang:stimmgabel` · Spielbar

Das Werkzeug des ersten Hörens scannt acht Blöcke horizontal und vier Blöcke
vertikal nach Kristallen, Stimmaltar, Dissonanzriss und Glockenspiel-Portal.
Gefundene Quellen erhalten Notenpartikel; eine Meldung nennt Anzahl, nächste
Quelle und Entfernung.

- Rechtsklick: Resonanzscan
- Abklingzeit: 20 Ticks
- Nebenwirkung: setzt Stimmung auf Stille
- On-Beat: `+3 RP`

### Resonanzklinge — `aetherklang:resonanzklinge` · Spielbar

Eine schnelle Nahkampfwaffe für klare Antworten.

- On-Beat-Treffer: `+3` Magieschaden, `+2 RP`, Notenpartikel
- Schleichen + Rechtsklick: Resonanzfächer vor dem Spieler
- Kosten des Fächers: `12 RP`
- Reichweite des Fächers: ungefähr `4,5` Blöcke
- Abklingzeit: 30 Ticks
- Haltbarkeit: 512

### Hallharfe — `aetherklang:hallharfe` · Fundament

Die geplante Fern- und Unterstützungsstimme. Hallharfen-Töne sollen an
Flächen reflektieren, Gegner markieren und in Freude/Harmonie Verbündete
stärken. Rhythmische Saitenfolgen bilden kontrollierende Akkorde.

- Geplante Rolle: Fernkampf, Raumkontrolle, Gruppenspiel
- Haltbarkeitsfundament: 384

### Basshammer — `aetherklang:basshammer` · Fundament

Ein schweres Instrument für Haltungsschaden und Flächenakzente. Sein idealer
Einsatz ist nicht eine schnelle Serie, sondern der letzte Schlag einer
gegnerischen Phrase.

- Geplante Rolle: Haltung brechen, Schockwellen, schwere Beat-Fenster
- Haltbarkeitsfundament: 768

### Echostiefel — `aetherklang:echostiefel` · Fundament

Die Stiefel speichern den Nachklang von Bewegung. Geplant ist der
**Resonanzschritt**: ein kurzer Dash durch Wellen, zu sicheren Zonen oder auf
den nächsten Beat.

- Standardtaste: **R**
- Geplante Rolle: Mobilität und Rhythmuskorrektur
- Haltbarkeitsfundament: 429

### Kodex der Resonanz — `aetherklang:kodex` · Spielbar

Das Tonarium mit neun Registern, Seitenfortschritt und versiegelten Einträgen.
Im Kreativmodus sind alle Seiten offen. Im Überlebensmodus liest der Kodex
die freigeschalteten Seiten aus deinen Resonanzdaten.

- Rechtsklick mit dem Gegenstand: öffnen
- Standardtaste: **K**
- Register: Lore, Stimmungen, Takt & RP, Instrumente, Blöcke, Kreaturen,
  Dimension, Boss und Tipps

---

## 7. Blöcke und Resonanzorte

Alle sieben Blöcke sind registriert, besitzen Modelle, Texturen, Gegenstände
und Ernte-/Rezeptfundamente. Ihre tieferen Weltmechaniken werden auf diesem
Fundament ausgebaut.

### Indigo-Resonanzkristall

Grundton und Erinnerung. Indigo-Kristalle sind als stabiler Basisträger für
Stimmgabel, Kodex und ruhige Konstruktionen gedacht.

### Cyan-Resonanzkristall

Leitung und Bewegung. Cyan soll Resonanzsignale weitertragen, Ferninstrumente
stimmen und Portalsequenzen verbinden.

### Gold-Resonanzkristall

Takt und Präzision. Gold markiert perfekte Beat-Fenster und dient als
Zeitgeber anspruchsvoller Rituale.

### Magenta-Resonanzkristall

Gebundene Dissonanz. Magenta ist mächtig, aber instabil; es gehört in
Kontrollmechaniken, Rissverschlüsse und Chorals Gegenmelodie.

### Stimmaltar — `aetherklang:stimmaltar`

Der geplante sichere Ort für Stimmungswechsel, Abstimmung und Instrument-
Fortschritt. Ein Altar sollte geschützt und fern von aktiven Rissen stehen.

### Dissonanzriss — `aetherklang:dissonanzriss`

Eine Wunde im Lied der Welt. Risse sollen Dissonanzgeister hervorbringen,
lokale Regeln verzerren und durch abgestimmte Mehrphasenaktionen geschlossen
werden.

### Glockenspiel-Portal — `aetherklang:glockenspiel_portal`

Die kontrollierte Gegenform zum Riss. Eine geplante Folge aus vier
Kristallfarben und sauberem Takt öffnet den Weg ins Tonarium. Der Block ist
bereits als unzerstörbares Portalfundament registriert.

---

## 8. Kreaturen

Die vier Entitätstypen, Größen und Grundattribute sind registriert. KI,
Beute, Spawnregeln, Modelle und vollständige Begegnungen sind noch
**Fundament/Vision**.

### Dissonanzgeist — `aetherklang:dissonanzgeist`

Ein Rhythmusfehler, der laufen lernte. Dissonanzgeister sollen in
unregelmäßigen Offbeats angreifen, frühe Antworten provozieren und nahe
Risse verstärken.

### Hallwächter — `aetherklang:hallwaechter`

Ein großer Prüfer von Haltung und Geduld. Seine schweren Phrasen sollen nach
dem Schlussakzent ein deutliches Gegenfenster öffnen.

### Echonote — `aetherklang:echonote`

Eine kleine schwebende Erinnerung. Echonoten sind als nicht grundsätzlich
feindliche Wegweiser zu Geheimnissen, Resonanzquellen und sicheren Takten
gedacht.

### Choral — `aetherklang:choral`

Der Dirigent der Dissonanz und finale Boss. Choral ist als besonders große
Entität registriert; seine vollständige Mehrphasen-Kadenz ist die
Boss-Vision von Aetherklang.

---

## 9. Das Tonarium

Das **Tonarium** ist die geplante Aetherklang-Dimension: kein gewöhnlicher
Himmel und keine bloße Höhle, sondern ein Archiv, in dem Klang Geometrie
wird.

### Geplante Orte

- **Saitenbrücken**, die nur im richtigen Beat festen Boden bilden
- **Hallkammern**, in denen ein Ton verzögert als Mechanik zurückkehrt
- **Kristallarchive**, die Kodexseiten und Weltgeschichte bewahren
- **Stille Inseln**, auf denen Dissonanz langsam abklingt
- **Chorals Konservatorium**, die Arena der finalen Kadenz

### Vorbereitung

Nimm ein Ersatzinstrument, Nahrung, Baumaterial, eine Stimmgabel und genug
RP-Reserve mit. Portale sollen nicht nur Transport sein: Das Öffnungsritual
prüft, ob du Kristallfarben, Stimmungen und Beat verstanden hast.

Die Dimensionsregistrierung und Weltgenerierung sind derzeit **Vision**; das
Glockenspiel-Portal ist als Inhaltsfundament vorhanden.

---

## 10. Bossakte: Choral

Choral kämpft wie ein Dirigent. Jeder Angriff gehört zu einer Phrase; jede
Phrase besitzt Auftakt, Steigerung und Kadenz.

### Geplante Phasen

1. **Auftakt der Splitter** – Dissonanzanker verzerren den Grundbeat.
2. **Fuge der Echos** – Hallwächter und kopierte Spieleraktionen überlagern
   die Arena.
3. **Gebrochener Takt** – sichere Felder wechseln mit dem sichtbaren Beat.
4. **Finale Kadenz** – Choral wird verwundbar, wenn die Gruppe seine Phrase
   mit einer sauberen gemeinsamen Antwort auflöst.

### Taktik

- Zerstöre Anker vor dem direkten Schaden.
- Blicke auf Taktstock und Partikel, nicht nur auf den Körper.
- Behalte RP für Mobilität und Verteidigung.
- Unterbrich schlechte Kombos.
- Eine perfekte Aktion am Ende der Phrase ist wertvoller als drei hektische
  Treffer während des Aufbaus.

Der Entitätstyp, Boss-Sound und die visuelle Sprache sind **Fundament**; die
vollständige Begegnung ist **Vision**.

---

## 11. Progression und Meistertipps

### Empfohlener Weg

1. Erster Resonanzkristall
2. Stimmgabel und Kodex
3. Beat an sicheren Zielen lesen
4. Stimmaltar errichten
5. Resonanzklinge oder anderes Instrument fertigen
6. Dissonanzrisse finden und schließen
7. Alle vier Kristallfarben sammeln
8. Glockenspiel-Portal stimmen
9. Tonarium erkunden
10. Choral in der finalen Kadenz beantworten

### Zehn Regeln für Resonanten

1. **Höre vor dem Angriff.**
2. **Übe bei 120 BPM mit einzelnen Aktionen.**
3. **Verwechsle Dissonanz nicht mit einer fünften Haltung:** Die fünf
   Stimmungen heißen Stille, Freude, Zorn, Trauer und Wunder.
4. **Nutze Stille zum Erkunden.**
5. **Spare RP für unbekannte Phasen.**
6. **Die Stimmgabel ist Werkzeug, nicht nur Zutat.**
7. **Magenta bedeutet Risiko.**
8. **Echonoten sind Hinweise.**
9. **Brich eine schlechte Serie bewusst ab.**
10. **Choral wird durch Verstehen besiegt, nicht durch Lautstärke.**

---

## 12. Steuerung

| Aktion | Standard | Hinweis |
| --- | --- | --- |
| Kodex öffnen | **K** | Funktioniert direkt; Rechtsklick mit dem Kodex ebenfalls |
| Resonanzschritt | **R** | Taste registriert, vollständige Stiefelmechanik im Ausbau |
| Stimmung wechseln | **M** | Taste registriert, vollständiger Clientwechsel im Ausbau |
| Seite/Register wählen | Linksklick | Eigene Tonarium-Schaltflächen |
| Vorige/nächste Seite | `‹` / `›` | Innerhalb des gewählten Registers |
| Kodex schließen | **Esc** oder `×` | Das Spiel läuft im Hintergrund weiter |

Alle Belegungen findest du unter
**Optionen → Steuerung → Tastenbelegung → Aetherklang**.

---

## 13. Kommandoreferenz

Kommandos ohne Änderung können Spielende selbst ausführen. Ändernde
Testkommandos benötigen Berechtigungsstufe 2.

| Kommando | Zweck |
| --- | --- |
| `/aetherklang` | Modstatus anzeigen |
| `/aetherklang rp get` | Eigene RP anzeigen |
| `/aetherklang rp set <0..100>` | RP setzen (Admin) |
| `/aetherklang rp add <-100..100>` | RP addieren/abziehen (Admin) |
| `/aetherklang mood stille` | Stimmung auf Stille setzen |
| `/aetherklang mood freude` | Stimmung auf Freude setzen |
| `/aetherklang mood zorn` | Stimmung auf Zorn setzen |
| `/aetherklang mood trauer` | Stimmung auf Trauer setzen |
| `/aetherklang mood wunder` | Stimmung auf Wunder setzen |
| `/aetherklang beat info` | Beatphase und Wertung anzeigen |
| `/aetherklang codex unlock <0..255>` | Kodex-Folio freischalten (Admin) |
| `/aetherklang codex list` | Freigeschaltete Folio-IDs anzeigen |

Die Kodexdaten verwenden ihre Reihenfolge in
`assets/aetherklang/kodex/pages.json` als Folio-ID, beginnend bei `0`.

---

## 14. Kodex-Freischaltungen

Einträge können drei Zustände haben:

- **Grundwissen:** immer offen, etwa Einstieg, Steuerung und Progression.
- **Entdeckt:** die Folio-ID steht in deinen persistenten Resonanzdaten.
- **Versiegelt:** Titel bleibt sichtbar, der Inhalt wartet auf seine
  Weltentdeckung.

Im Kreativmodus sind alle Folios offen. Das macht den Kodex zugleich zu einem
vollständigen Designarchiv für Bauende, Tester und Content-Creator.

---

## 15. Barrierefreiheit und Spielgefühl

- Alle wichtigen Systeme kombinieren Farbe mit Text, Symbol oder Partikel.
- Tasten sind vollständig neu belegbar.
- Das erweiterte **GUT**-Fenster von ±100 ms erlaubt rhythmisches Spiel ohne
  musikalische Vorbildung.
- Diagnosekommandos machen Beat und Fortschritt prüfbar.
- Untertitel existieren für Beat, Resonanz, Dissonanz, Portal und Choral.
- Der Kodex pausiert die Welt nicht; öffne ihn in sicherer Umgebung.

---

## 16. Credits

- **Konzept, Welt und Entwicklung:** Aetherklang Team
- **Technisches Fundament:** Fabric Loader, Fabric API und Yarn Mappings
- **Spiel:** Minecraft von Mojang Studios
- **Leitmotiv:** „Die Welt hat eine Stimme. Du lernst sie zu spielen.“

Danke an alle, die den ersten Beat nicht nur treffen, sondern ihm zuhören.

---

## Kurzreferenz

- **Kodex:** K oder Rechtsklick mit `aetherklang:kodex`
- **Beat:** 120 BPM
- **Perfekt:** ±40 ms
- **Gut:** ±100 ms
- **RP:** 0–100
- **Stimmungen:** Stille, Freude, Zorn, Trauer, Wunder
- **Ziel:** Kristalle → Instrument → Risse → Portal → Tonarium → Choral
