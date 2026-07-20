# Aetherklang

> „Die Welt hat eine Stimme. Du lernst sie zu spielen.“

Aetherklang ist ein Fabric-Mod für Minecraft 1.21.9 über Resonanz- und
Klangmagie. Spielende kanalisieren **Stimmungen**, folgen **Beat/Takt**,
sammeln **Resonance Points (RP)** und halten die wachsende **Dissonanz**
in Schach. Das Handbuch im Spiel heißt **Kodex der Resonanz**.

WP1 friert die öffentlichen Registry- und Netzwerk-IDs ein. Die
Spielmechaniken, Entitäten und Renderer sind bewusst kompilierbare Stubs,
damit weitere Arbeitspakete unabhängig darauf aufbauen können.

## Branding

| Rolle | Farbe |
| --- | --- |
| Indigo / Grundton | `#1A1033` |
| Cyan / Resonanz | `#5FF5E0` |
| Gold / Takt | `#F5C95F` |
| Magenta / Dissonanz | `#E03A8C` |

## Voraussetzungen

- JDK 21
- Internetverbindung beim ersten Gradle-Lauf

## Entwicklung

Minecraft-Quellen für die IDE vorbereiten:

```sh
./gradlew genSources
```

Den Entwicklungsclient starten:

```sh
./gradlew runClient
```

Prüfen und bauen:

```sh
./gradlew check
./gradlew build
```

Die remappte Mod-JAR liegt danach unter
`build/libs/aetherklang-0.2.0-sinfonie.jar`.
Ein Datengenerator ist in WP1 nicht konfiguriert; die minimalen Blockstates,
Modelle und Texturen sind eingecheckt.

## Kammerton-Endspiel

Platziere ein `aetherklang:glockenspiel_portal` in der Oberwelt und betrete es
mit dem Kodex in einer Hand oder mindestens 24 RP. Das Portal führt zur
Kammerton-Ankunftsinsel. Folge der goldenen Brücke und nähere dich dem
Stimmaltar in der Arena, um Choral beim ersten Besuch zu erwecken. Das Portal
hinter dem Ankunftspunkt führt kostenlos zum Oberwelt-Spawn zurück.

Für einen schnellen Entwicklungstest:

```mcfunction
/execute in aetherklang:kammerton run tp @s 0.5 129 0.5
/execute in aetherklang:kammerton run summon aetherklang:choral 0.5 140 96.5
```

## Klangmeer-Regionen und Bossarenen

Vier feste Regionen tragen je ein einmalig erzeugtes Wahrzeichen. Beim ersten
Annähern auf 24 Blöcke wird der zugehörige Boss genau einmal beschworen:

| Region / Wahrzeichen | Teleport | Boss |
| --- | --- | --- |
| Bassgewölbe / Die Große Pauke | `/execute in aetherklang:kammerton run tp @s -899.5 130 0.5` | Tremolo |
| Arpeggienmeer / Saitenbrücken | `/execute in aetherklang:kammerton run tp @s 900.5 130 0.5` | Glissanda |
| Kakophonie-Riff / Schwarmthron | `/execute in aetherklang:kammerton run tp @s 0.5 130 900.5` | Kakophon |
| Generalpause-Öde / Leeres Podium | `/execute in aetherklang:kammerton run tp @s 0.5 130 1600.5` | Generalpause |

Für wiederholbare Bosswerk-Tests nach dem verbrauchten Annäherungstrigger:

```mcfunction
/execute in aetherklang:kammerton run summon aetherklang:boss_tremolo -899.5 135 0.5
/execute in aetherklang:kammerton run summon aetherklang:boss_glissanda 900.5 132 4.5
/execute in aetherklang:kammerton run summon aetherklang:boss_kakophon 0.5 135 900.5
/execute in aetherklang:kammerton run summon aetherklang:boss_generalpause 0.5 133 1600.5
```

Zusätzlich entstehen zwei Resonanzorte mit Ring und Stimmpfeiler relativ zum
Oberwelt-Spawn bei `(-36, +28)` und `(+36, +28)` Blöcken.

## Eingefrorene Schnittstellen

- Blöcke: vier Resonanzkristalle, Stimmaltar, Dissonanzriss und Glockenspiel-Portal
- Gegenstände: Stimmgabel, Resonanzklinge, Hallharfe, Basshammer, Echostiefel und Kodex
- Entitäten: Dissonanzgeist, Hallwächter, Echonote und Choral
- Partikel: Note Spark, Beat Ring, Dissonanz Smoke und Beam Mote
- Payloads: `dash`, `resonance_sync` und `beat_fx`
- Spieler-Attachment: `resonance`
- Creative Tab: `main`

Alle IDs verwenden den Namespace `aetherklang`.
