# Playtest H-build-wardrobe — Baumodus, Garderobe & Gestalten

Playtest-Durchlauf der drei Ausstattungs-Flows: Baumodus (Doc D §2, Möbel
platzieren/verschieben/einlagern, Fenster), Garderobe (CONTENT-A, Slots
Hut/Brille/Hals/Rücken + Fellfarben) und Gestalten (HAUS-CUSTOM, Tapete/
Boden/Fassade). Getestet headless über gezielte Szenen-Proben (echte
`RoomBase`/`BuildMode`/`GridData`-Kette mit frischem GameState) plus einen
kompletten Realspiel-Lauf `tools/ci/run_playtest.sh flow_baumodus`
(Onboarding → Baumodus → Bett aus dem Lager platzieren, alle 21 Schritte
OK). Alle drei Funde wurden GEFIXT und mit
`tests/unit/test_playtest_h_build_wardrobe.gd` (3 Tests) dauerhaft
abgesichert.

## Funde & Fixes

### 1. Garderobe wirkte nur in der Vorschau — der Gooby im Raum blieb nackt (Bug, GROSS)

**Repro:** Hut (`partyHat`) + Premium-Fell (`midnight`) kaufen und in der
Garderobe anlegen → zurück ins Wohnzimmer: Gooby läuft in Standard-Fell und
ohne Hut herum. Headless-Probe bestätigt: am Home-Rig hängt KEIN
`CosmeticAttach` (`null`), das Fell-Surface-Override am Mesh ist `null`.

**Befund:** `CosmeticAttach` (Anker + Fell-Palette) wurde ausschließlich in
der Garderoben-Vorschau (`wardrobe_screen.gd`) und im Char-Editor
instanziert. `GoobyHome._ready()` übernahm nur die Morphs
(`rig.apply_saved_morphs`), nie die angelegten Cosmetics — gekaufte
Outfits/Felle waren im eigentlichen Spiel unsichtbar (nur im
Garderoben-SubViewport zu sehen). Die Web-Referenz hängt Outfits global um
(`initOutfitSync`/`applyEquippedOutfits`); im Port fehlte dieser Pfad
komplett.

**Fix (`scripts/home/gooby_home.gd`):** `_ready()` löst den GameState jetzt
über den Raum auf (`RoomBase.game_state()` honoriert das Test-Override,
Fallback Autoload) und zieht den Rig per `CosmeticAttach.fuer_rig()` +
`apply_from_state()` an. Zusätzlich abonniert der Gooby `slice_changed`
(cosmetics/meta) und zieht Änderungen live nach. In der Besuchs-Szene ist
`GoobyHome` immer der EIGENE Gooby — das lokale Save ist dort korrekt.

### 2. Bodenmöbel durften unter wartende Tisch-Deko — Clipping + stiller Datenverlust (Bug, MITTEL)

**Repro:** Beistelltisch mit Tischlampe drauf → Tisch einlagern (Lampe
wartet absichtsgemäß in der Luft, E9-P1-1-Gnadenfrist) → Stuhl auf die
Lampen-Zelle stellen: `can_place` sagt `ok:true`, der Stuhl clippt durch
die schwebende Lampe. Beim nächsten Raum-Betreten scheitert die Lampe an
`needs_surface` und wandert als Leftover STILL ins Lager — aus
Spielersicht „verschwindet“ die Deko.

**Befund:** `GridData._cell_reason` prüfte für FLOOR-Items nur die eigene
Layer-Map (`_floor_cells`). Ein wartendes SURFACE-Item auf der Zelle wurde
ignoriert — der Live-Zustand (Lampe schwebt über dem Stuhl) und der
Save-Reload-Zustand (Lampe im Lager) liefen auseinander; die Probe zeigte
`can_place(chair@Lampen-Zelle) → ok:true` und nach Reload
`Lampe im Lager: 1`.

**Fix (`scripts/home/grid_data.gd`):** Unter eine wartende SURFACE-Deko
darf nur noch ein TRÄGER (Def-Flag `surface`). `can_place` reicht das Flag
an `_cell_reason` durch; Nicht-Träger (Stuhl, Kühlschrank — auch bloß
überlappend, auch per `move_item`) bekommen `occupied`. Die Gnadenfrist
selbst bleibt unangetastet: ein neuer Tisch darf weiterhin unter die Lampe
(Bestands-Test `test_tischlampe_bleibt_nach_raumwechsel_auf_dem_tisch`
bleibt grün).

### 3. Gestalten-Tapete verschwand bei jedem Fenster-Umbau (Bug, MITTEL)

**Repro:** Im Gestalten-Modus Tapete/Boden wählen → im Baumodus ein
Außenfenster hängen (oder abnehmen): alle Wände springen auf die
Default-Wandfarbe des Raums zurück; erst ein Raumwechsel holt die Tapete
wieder.

**Befund:** Ein Fenster-Umbau ändert die Fenster-Signatur, worauf
`RoomBase.rebuild_furniture()` die Wände komplett neu baut
(`_build_walls()` ersetzt alle `Wall_*`-Meshes samt frischem
`_flat_material`-Override). `HouseStyle.apply_to_room()` lief aber nur
EINMAL in `_ready()` — nach dem Neubau trug keine Wand mehr das
Gestalten-Material.

**Fix (`scripts/home/room_base.gd`):** Nach jedem Signatur-getriebenen
`_build_walls()` in `rebuild_furniture()` wird
`HouseStyle.apply_to_room(self, HouseStyleState.style(_gs))` erneut
angewendet (idempotent, geteilte gecachte Materialien — kein Neubau, nur
Override-Zuweisung).

## Guard-Tests

`tests/unit/test_playtest_h_build_wardrobe.gd`:

- `test_home_gooby_traegt_garderobe` — Hut + Fell angelegt → der Gooby IM
  RAUM trägt beides; Hut ablegen wirkt live (slice_changed).
- `test_kein_bodenmoebel_unter_wartender_deko` — Stuhl/Kühlschrank werden
  unter der wartenden Lampe abgelehnt (`occupied`), ein neuer Träger darf
  zurück, danach steht die Lampe wieder regulär auf dem Tisch.
- `test_tapete_ueberlebt_fenster_umbau` — alle `Wall_*`-Meshes tragen nach
  dem Fenster-Umbau wieder DAS geteilte Gestalten-Material (Identität).

## Testlage

- Realspiel-Lauf `flow_baumodus` (xvfb, 1280×720): 21/21 Schritte OK —
  Baumodus öffnen, Bett aus dem Lager, Ghost, Platzieren, Save-Check.
- Voller Suite-Lauf lokal: 3548 Tests. Einziger Ausfall war
  `test_settings_screen.gd::test_einzelregler_markiert_benutzerdefiniert`
  unter doppelter Suite-Last (zwei parallele Godot-Läufe auf derselben VM);
  isoliert grün, CI auf HEAD grün — kein Zusammenhang mit diesen Fixes.
