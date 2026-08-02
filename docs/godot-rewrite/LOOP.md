# LOOP.md — die kontinuierliche Verbesserungs-Schleife (Fable-Loop)

Stand: W18 (August 2026). Heimat der Schleife: Repo `PermissionMAXED/Monkey-Party`,
Branch `cursor/gooby-godot-loop-continue`. Das GOOBY-Godot-Projekt liegt in
`GOOBY-GODOT/` (importiert aus
`MedusaV9/MinecraftBubbleShieldMod@cursor/gooby-godot-loop-2c10` mit vollem
Stand). Arbeitsregeln fürs Godot-Projekt: `GOOBY-AGENTS.md` (Repo-Root); das
Root-`AGENTS.md` gehört zu MONKEY-PARTY/AETHERKLANG und bleibt unberührt.

## Protokoll — eine Runde = eine „Welle"

1. **Feedback lesen.** `UserFeedback.md` VOR jeder Runde komplett lesen. Der
   User schreibt live rein (auch per Web-Commit) — deshalb vor jedem Push
   `git fetch` + Rebase. Neue Stichworte unter „1. Neu von dir" sofort in
   `[ ]`-Punkte mit klaren Akzeptanzkriterien überführen.
2. **Triage + Welle schneiden.** Offene `[ ]`/`[~]` priorisieren
   (frisches User-Feedback schlägt Backlog), in 8–10 parallele Arbeitspakete
   schneiden, Pakete in `UserFeedback.md` auf `[~]` setzen.
3. **Parallel bauen — nur Fable.** Alle Subagents (Planner, Builder, Tester,
   Reviewer, Spieler-Agents) laufen als `claude-fable-5-thinking-xhigh`
   (Vorgabe des Owners). Maximal 10 parallel — Pipeline vollhalten.
4. **Qualitäts-Gate.** Vor JEDEM Push, der `GOOBY-GODOT/**`, `tools/ci/**`
   oder den Workflow berührt: `bash tools/ci/preflight.sh` muss grün sein
   (gdformat, gdlint, Import-Gate, beide Test-Runner, Boot-Smoke — exaktes
   Spiegelbild der CI, Details in `GOOBY-AGENTS.md`).
5. **Pushen → .ipa fällt raus.** Jeder solche Push baut über
   `.github/workflows/gooby-godot.yml` automatisch die unsignierte .ipa
   (Artefakt `GOOBY-godot-unsigned-ipa`; Sideload via AltStore/Sideloadly,
   Runbook `docs/godot-rewrite/IOS-BUILD.md`). Versionierte Releases über
   Tag `ipa-v<semver>`; Daten-Updates über den `updates`-Release
   (`docs/UPDATES.md`).
6. **Buchführung.** Nach jeder Runde `UserFeedback.md` aktualisieren:
   Erledigtes auf `[x]` mit Erklärung, ehrlich Zurückgestelltes auf `[-]`
   mit Begründung, Rückfragen als `[?]`. Nichts stillschweigend fallen
   lassen — der ehrliche Ist-Stand steht zusätzlich in
   `docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md`.
7. **Weiter bei 1.** Die Schleife endet nicht von selbst — sie wird nur vom
   User unterbrochen oder umpriorisiert.

## Leitplanken

- Die Schleife arbeitet NUR auf den GOOBY-Pfaden (`GOOBY-GODOT/`,
  `GOOBY-SERVER/`, `GOOBY/` als Web-Referenz, `tools/`, `trailer/`,
  `docs/`, `UserFeedback.md`). MONKEY-PARTY, AETHERKLANG und MONKEYBAR
  niemals anfassen oder brechen.
- Ehrlichkeit vor Optik: rote Tests, Lücken und bewusste Rückstellungen
  stehen immer sichtbar in `UserFeedback.md`.
- Externe Assets nur lizenzsauber (CC0/CC-BY/ausdrücklich frei, Eintrag in
  `GOOBY-GODOT/assets/LICENSES.md`) und stilkonform; keine Wegwerf-Accounts
  für Asset-Stores. Intake-Regeln: Punkte A1–A3 in `UserFeedback.md`.
- Zeit/Zufall in testbarer Kernlogik immer injizieren (Clock-Muster, RNG als
  Parameter) — Regeln in `GOOBY-AGENTS.md`.
