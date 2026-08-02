# assets/city — Herkunft & Lizenzen (W3a CITY)

Kuratierte Kopien aus der Web-Referenz `/workspace/GOOBY/public/assets`
(dort unverändert belassen — READ-ONLY laut GODOT-PLAN §3.1). Regel wie bei
`assets/furniture`: spätere Wellen ergänzen NUR eigene Unterordner und
überschreiben nie fremde Dateien.

| Ordner | Quelle | Lizenz |
|---|---|---|
| `strassen/*.glb` | Kenney **City Kit Roads** (`kenney/city-kit-roads`) | CC0 1.0 — `strassen/License-kenney-city-kit-roads.txt` |
| `gebaeude/*.glb` | Kenney **City Kit Commercial** (`kenney/city-kit-commercial`) | CC0 1.0 — `gebaeude/License-kenney-city-kit-commercial.txt` |
| `autos/*.glb` | Kenney **Car Kit** (`kenney/car-kit`) | CC0 1.0 — `autos/License-kenney-car-kit.txt` |
| `natur/*.glb` | Kenney **Nature Kit** (`kenney/nature-kit`) | CC0 1.0 — `natur/License-kenney-nature-kit.txt` |
| `essen/*.glb` | Kenney **Food Kit** (`kenney/food-kit`) | CC0 1.0 — `essen/License-kenney-food-kit.txt` |
| `deko/*.gltf` | **KayKit City Builder Bits** (`kaykit/kaykit-city`) | CC0 1.0 (KayKit, kaylousberg.com) — `deko/LICENSE.txt` |
| `innen/*.gltf` | **KayKit Restaurant Bits** (`kaykit/kaykit-restaurant`) | CC0 1.0 (KayKit, kaylousberg.com) — `innen/LICENSE.txt` |
| `audio/*.ogg` | Kenney **Interface Sounds** (`kenney/interface-sounds`) | CC0 1.0 — `audio/License-kenney-interface-sounds.txt` |
| `camping/*.glb` | Kenney **Survival Kit** (kenney.nl/assets/survival-kit, 2026-08 direkt geladen) | CC0 1.0 — `camping/License-kenney-survival-kit.txt` |
| `strand/*.glb` | Kenney **Pirate Kit** (kenney.nl/assets/pirate-kit, 2026-08 direkt geladen) | CC0 1.0 — `strand/License-kenney-pirate-kit.txt` |
| `verkehr/*.glb` | Kenney **Racing Kit** (kenney.nl/assets/racing-kit, 2026-08 direkt geladen) | CC0 1.0 — `verkehr/License-kenney-racing-kit.txt` |

Hinweis `verkehr/`: Die Racing-Kit-GLBs kommen ab Werk mit Raster-Pivots
(Versatz ≈ −0,35/−0,65 m fürs Strecken-Snapping). Beim Import wurden die
Wurzel-Translations auf **Bodenmitte** zentriert (Skript-Korrektur der
glTF-Node-Translations, Geometrie unverändert), damit `_prop(pos, rot)`
wie bei allen anderen Kits funktioniert.

Hinweis: Das GOOBERANDO-Logo liegt separat unter `assets/brand/gooberando.png`
(vom Orchestrator generiert, projektinternes Artwork).
