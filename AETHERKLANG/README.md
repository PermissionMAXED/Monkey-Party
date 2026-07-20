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

Die remappte Mod-JAR liegt danach unter `build/libs/aetherklang-0.1.0.jar`.
Ein Datengenerator ist in WP1 nicht konfiguriert; die minimalen Blockstates,
Modelle und Texturen sind eingecheckt.

## Eingefrorene Schnittstellen

- Blöcke: vier Resonanzkristalle, Stimmaltar, Dissonanzriss und Glockenspiel-Portal
- Gegenstände: Stimmgabel, Resonanzklinge, Hallharfe, Basshammer, Echostiefel und Kodex
- Entitäten: Dissonanzgeist, Hallwächter, Echonote und Choral
- Partikel: Note Spark, Beat Ring, Dissonanz Smoke und Beam Mote
- Payloads: `dash`, `resonance_sync` und `beat_fx`
- Spieler-Attachment: `resonance`
- Creative Tab: `main`

Alle IDs verwenden den Namespace `aetherklang`.
