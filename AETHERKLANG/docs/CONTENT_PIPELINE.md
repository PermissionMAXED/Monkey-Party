# Aetherklang Content Pipeline

Sinfonie-Inhalte liegen unter
`src/main/resources/data/aetherklang/content/<typ>/**/*.json`. Beim
Mod-Start liest `ContentLoader` alle JSON-Dateien direkt aus dem Mod-Root
(Entwicklungsverzeichnis oder JAR), decodiert sie mit Mojang `Codec` und
friert sie in `ContentCatalog` ein.

## Unterstützte Typen

| Ordner | Schema |
| --- | --- |
| `instruments` | `InstrumentDef` |
| `mobs` | `MobDef` |
| `islands` | `IslandDef` |
| `akkorde` | `AkkordDef` |
| `kodex_folios` | `KodexFolioDef` |
| `loot_tiers` | `LootTierDef` |
| `fx` | `FxSpec` |
| `bosses` | `BossDef` |
| `relics` | `RelicDef` |

## Neuen Inhalt ergänzen

1. Wähle eine bereits eingefrorene ID aus `SINFONIE_KONTRAKT.md` oder
   reserviere eine neue additive ID.
2. Lege genau eine JSON-Datei im passenden Typordner an. Der Dateiname sollte
   der `id` entsprechen; Unterordner sind erlaubt.
3. Nutze nur kleingeschriebene, namespacelose IDs. Der Loader setzt
   `aetherklang` als Namespace.
4. Ergänze Registry-Code nur, wenn Minecraft einen echten Registry-Eintrag
   braucht. Instrument- und Reliktdefinitionen erhalten notfalls automatisch
   einen generischen Item-Stub. Mob- und Bossdefinitionen müssen bewusst eine
   `EntityType`-Konstante und einen Client-Renderer besitzen.
5. Ergänze `de_de.json`, `en_us.json` und passende Client-Assets für sichtbare
   Registry-Einträge.
6. Starte die Mod neu und führe `./gradlew check` sowie `./gradlew build` aus.

`SchemaValidation` bricht den Start bei unbekannten Typordnern, doppelten oder
ungültigen IDs und offensichtlich ungültigen Werten ab. Das ist absichtlich
strikt, damit ein fehlerhafter Content-Paketstand nicht teilweise geladen
wird.

Der Sinfonie-Katalog unter `content` ist ein Startup-Katalog; nach Änderungen
dort ist deshalb ein Neustart nötig. Klangwerk-Definitionen unter
`data/aetherklang/klangwerk/<typ>/<id>.json` werden dagegen bei jedem
Server-Datapack-Reload atomar neu geladen. Unterstützt werden `motiv`, `affix`,
`relikt`, `insel`, `boss`, `auftrag` und `aufwertung`. Der Codec erwartet
`id`, `type` und optional eine String-Map `parameters`. Ordner, Typ, Dateiname
und ID müssen übereinstimmen; fehlerhafte oder doppelte Definitionen lassen den
Reload scheitern, ohne den zuletzt gültigen Klangwerk-Katalog zu ersetzen.

`/aetherklang klangwerk reload` lädt nur den Klangwerk-Teil aus dem aktuellen
Resource Manager neu. `/aetherklang klangwerk dump` zeigt Anzahl und IDs der
aktuell installierten Definitionen.

## Zugriff aus Code

`ContentCatalog.current()` liefert unveränderliche Maps pro Typ. Greife über
die Content-ID zu und behandle fehlende optionale Definitionen explizit.
Registry-IDs bleiben weiterhin in den `Mod*`-Klassen die maßgebliche
Integrationsschnittstelle.
