# Dopamin/Sound/Feeling-Pass 2 (Fable-Max-Politur)

Stand: 2026-08-02, Branch `cursor/gooby-godot-loop-continue`. Unabhängiger
Folge-Pass zum EVAL-1-Bericht (`EVAL-DOPAMIN-SOUND-FEEL.md`): Audit der
verbliebenen Lücken bei Belohnungsmomenten, SFX-Abdeckung, Musikübergängen
und UI-Klick-Feedback — plus direkte Umsetzung. Viele kleine Berührungspunkte
statt eines großen Umbaus.

## Messwerte vorher → nachher

| Metrik | Vorher | Nachher |
|---|---|---|
| Musik-Ducking an Belohnungsmomenten (EVAL-1 S8, Rang 17) | **0** Aufrufstellen — Fanfaren/Stinger kämpften ungeduckt gegen das −13-dB-Musikbett | **7** Aufrufstellen (`MusicDirector.try_duck`): RewardHub Gold-Sticker, Erfolge, Tagesbonus, LevelUpFeier, Rekord-Fanfare, Sammlungs-Set, Postkarten-Set |
| HUD-Münz-Zuwachs hörbar (EVAL-1 D10, Rang 16) | stumm (Count-Up + Wiggle ohne Ton) | `ui_coins` bei jedem Zuwachs, Pitch +0,02 je Zehnerpotenz; Ausgaben & Boot-Initialwerte bleiben stumm |
| Gemappte, aber NIE verdrahtete SFX-Ids | 1 (`step_tap`, EVAL-1 F8/Rang 25) | 0 — Gooby tapst im Haus im echten Schrittrhythmus (0,34 s × Tempo) |
| Screens mit pressed-Handlern ohne jede Sound-Verdrahtung | 33 Dateien | 25 Dateien (−8: Freunde-App, Galerie, Naschgassen-Stand, Wochenmarkt-Tabs, Profil, Erfolge, Postkarten, Sammlungen) |
| `Button.new()`-Verstöße gegen die W16-Grammatik in den reparierten Screens | 8 Bausteine (Freunde ×5, Galerie-Fotokarte, Park-Kaufknopf, Markt-Tab) | 0 — alle SquishButton (Haptik + Squish zentral) |
| Belohnungs-Claims ohne Ton/Haptik | Sammlungs-Set, Postkarten-Set (nur Toast/Stinger) | beide: `ui_coins` + `Haptics.success` + Duck |

## Neue Bausteine

- **`MusicDirector.duck()` / `try_duck()`**: eigener `MusicBed`-Unterbus
  (Kontext-/Radio-Player) vor `Music` — duck senkt NUR das Bett, Stinger
  bleiben oben. Werte: −6 dB, Attack 80 ms, Halten 1,4 s, Release 600 ms.
  Regel + Verdrahtungsliste: `AUDIO-GRAMMATIK.md`. Wächter:
  `tests/unit/test_audio_music_director.gd` (Duck-Kurve + Bus-Zuordnung).
- **Grammatik-Nachrüstung** in 8 Screens (Sounds nach AUDIO-GRAMMATIK:
  Outcome schlägt Press, `ui_back`/`ui_chip`/`ui_toggle`/`ui_tick`/`ui_buy`/
  `ui_coins`/`ui_error`), inkl. Galerie-Vollansicht als Eigenbau-Overlay
  (`ui_open`/`ui_close`) und Kauf-Bounce am Münzstand der Naschgasse.
  Wächter erweitert: `tests/unit/test_w16_sound_haptik.gd` (ParkStallSheet).

## Ehrlich offen geblieben (Kandidaten für den nächsten Pass)

- Funkelpark-FAHRTEN (Coaster/Riesenrad/Karussell/Autoscooter) haben weiter
  keine eigenen Fahr-Foleys/Loops — braucht neue Assets über die
  ef2-Pipeline, kein Quick-Win.
- Die restlichen 25 Dateien mit stummen pressed-Handlern sind überwiegend
  Ranch-Panels, Dev-Werkzeuge und Netz-Lobbys — nächste Welle.
- `game:gvz`/`game:gobnom` teilen weiter den Arcade-Track (EVAL-1 S9) —
  braucht zwei neue Musikstücke.
