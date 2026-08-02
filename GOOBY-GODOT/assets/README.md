# assets/ — Intake-Checkliste für neue Modelle

Vollständige Anleitung: **`docs/godot-rewrite/ASSET-INTAKE.md`** (Repo-Root).
Lizenz-Index: `LICENSES.md` (hier daneben). Wache:
`tests/unit/test_asset_intake.gd` (Preflight + CI).

Checkliste — JEDER Punkt vor dem Commit:

- [ ] **Lizenz sauber**: nur CC0 / CC-BY / ausdrücklich frei.
      Original-Lizenzdatei in den Pack-Ordner, Zeile in die `LIZENZ.md` des
      Bereichs, CC-BY zusätzlich in die Pflicht-Credits
      (`docs/godot-rewrite/RANCH-ASSETS.md` §6). KEINE
      Unity-EULA-Packs, keine Wegwerf-Accounts.
- [ ] **Stil passt**: low-poly, Pastell, runde Formen — per Screenshot neben
      bestehenden Szenen verglichen.
- [ ] **Format**: `.glb`/`.gltf`; Atlas-Packs komplett in EINEM Unterordner,
      ein Quell-Pack = ein Ordner, nie fremde Dateien überschreiben.
- [ ] **Maßstab**: 1 Unit = 1 m, Y-up — Referenz: **Gooby ≈ 1,13 m** hoch
      (Decke im Haus 2,45 m, Pferderücken 1,42 m).
- [ ] **Pivot am Boden**: Ursprung auf Unterkante (±6 cm bzw. 10 % der
      Höhe), mittig im Fußabdruck. Wand-/Decken-/Hänge-Pivots brauchen eine
      begründete Ausnahme in `tests/unit/test_asset_intake.gd`
      (`AUSNAHMEN_PIVOT`).
- [ ] **Front-Achse**: GLB schaut nach **-Z** (Vertrag:
      `docs/godot-rewrite/ASSET-ORIENTATION.md` §1); aufrecht Y-up, keine
      krummen gebackenen X/Z-Rotationen, keine Spiegelungen.
- [ ] **Kollision**: Footprint im Möbel-Katalog bzw. Blocker/Shape im
      platzierenden Szenen-Code — GLBs selbst bleiben ohne Collision-Mesh.
- [ ] **Import-Artefakte committen**: einmal
      `godot --headless --path GOOBY-GODOT --import`, dann erzeugte
      `.import` (und `.uid` bei Skripten) MIT einchecken.
- [ ] **In echter Szene platziert** + `bash tools/ci/preflight.sh` grün.
