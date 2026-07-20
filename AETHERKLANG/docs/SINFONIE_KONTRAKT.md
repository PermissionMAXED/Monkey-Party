# Sinfonie-Vertrag (Wave 0)

Dieser Vertrag friert die öffentlichen IDs für parallele Content-Wellen ein.
IDs dürfen implementiert, aber nicht umbenannt oder wiederverwendet werden.
Namespace ist immer `aetherklang`.

## Registry-IDs

### Gegenstände

| Gruppe | IDs |
| --- | --- |
| Instrumente | `pauke`, `sopranfloete`, `kontrabass`, `triangel` |
| Materialien | `tremolokern`, `saitenherz`, `schwarmauge`, `stillesplitter`, `kaskadenkern`, `notenschluessel`, `klangstaub`, `resonanzbarren` |
| Relikte | `relikt_metronom`, `relikt_echo`, `relikt_fermate`, `relikt_crescendo`, `relikt_ostinato`, `relikt_cadenz`, `relikt_legato`, `relikt_staccato`, `relikt_fortissimo`, `relikt_pianissimo`, `relikt_harmonie`, `relikt_dissonanz` |
| Elixiere | `elixier_freude`, `elixier_zorn`, `elixier_stille` |
| Partituren | `partitur_disc_1`, `partitur_disc_2`, `partitur_disc_3` |

### Blöcke

| Gruppe | IDs |
| --- | --- |
| Funktion | `notenpult`, `klangamboss`, `stimmpfeiler`, `metronomblock`, `dissonanzanker`, `kristallresonator` |
| Bassschiefer | `bassschiefer`, `bassschiefer_poliert`, `bassschiefer_ziegel`, `bassschiefer_treppe`, `bassschiefer_stufe` |
| Arpeggienquarzit | `arpeggienquarzit`, `arpeggienquarzit_poliert`, `arpeggienquarzit_ziegel` |
| Riffbasalt | `riffbasalt`, `riffbasalt_poliert`, `riffbasalt_ziegel` |
| Resonanzholz | `resonanzholz`, `resonanzholz_planken`, `resonanzholz_treppe`, `resonanzholz_stufe` |

### Entitäten

| Gruppe | IDs |
| --- | --- |
| Motive | `motiv_laeufer`, `motiv_schwinge`, `motiv_pulser` |
| Bosse | `boss_tremolo`, `boss_glissanda`, `boss_kakophon`, `boss_generalpause` |

### Netzwerk, Partikel und Sound

| Typ | IDs |
| --- | --- |
| S2C-Payloads | `boss_fx`, `region_sync`, `leitmotiv_sync` |
| Partikel | `tremolo_splitter`, `glissando_spur`, `kakophon_funke`, `generalpause_nebel`, `relikt_aura`, `insel_resonanz`, `leitmotiv_note`, `klangoperation_ring` |
| Sounds | `pauke_hit`, `floete_tone`, `kontrabass_note`, `triangel_chime`, `relikt_activate`, `boss_tremolo`, `boss_glissanda`, `boss_kakophon`, `boss_generalpause`, `region_enter` |

## 16 Klangoperationen

Die serialisierten Enum-Werte aus `Klangoperation` sind:

1. `anschlag`
2. `halten`
3. `freigabe`
4. `impuls`
5. `welle`
6. `strahl`
7. `feld`
8. `echo`
9. `fermate`
10. `crescendo`
11. `ostinato`
12. `kadenz`
13. `bewegung`
14. `schutz`
15. `heilung`
16. `beschwoerung`

## Regionsanker

Anker sind feste Integrationspunkte im Kammerton. Terrain-Wellen dürfen die
Umgebung gestalten, aber diese Koordinaten nicht verschieben.

| Region | X | Y | Z | Rolle |
| --- | ---: | ---: | ---: | --- |
| `ankunft` | 0 | 129 | 0 | bestehende Ankunft |
| `choral_arena` | 0 | 140 | 96 | bestehende Schlussarena |
| `bassbruch` | -900 | 129 | 0 | Tremolo / Bassschiefer |
| `glissando_gaerten` | 900 | 129 | 0 | Glissanda / Resonanzholz |
| `kakophon_schwarm` | 0 | 129 | 900 | Kakophon / Schwarm |
| `generalpause` | 0 | 129 | 1600 | Generalpause / Stille |

## Dateibesitz für parallele Wellen

| Bereich | Eigentümerpfad |
| --- | --- |
| Schemas, Loader, Katalog | `src/main/java/de/aetherklang/data/**` |
| Klangwerk-Verträge | `src/main/java/de/aetherklang/klangwerk/**` |
| Registry-ID-Konstanten | `src/main/java/de/aetherklang/registry/Mod*.java` |
| Dateninhalt | `src/main/resources/data/aetherklang/content/<typ>/<id>.json` |
| Einzelne Assets | `src/main/resources/assets/aetherklang/**/<id>.*` |
| Sprache | pro Welle nur die eigenen Schlüssel in `de_de.json` und `en_us.json` |

Registry-Dateien und dieses Dokument sind Integrationsdateien: Änderungen
müssen bestehende Konstanten additiv erhalten. Eine Content-Welle besitzt
jeweils ihre neuen JSON- und Asset-Dateien; sie darf keine fremden Dateien
umbenennen oder löschen.
