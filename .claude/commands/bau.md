---
description: Feature bauen – planen, delegieren, testen, ansehen
argument-hint: <was gebaut werden soll>
---
Aufgabe: $ARGUMENTS

1. Lass `sucher` die betroffenen Stellen und passende Engine-Module finden.
2. Schreib einen Plan in höchstens 6 Punkten mit Abnahmekriterium. Große Sachen (neue Welt, neues System): erst Bauplan `docs/WELT-<name>.md` bzw. `docs/<SYSTEM>.md`
   mit festen Verträgen (API, Dateien je Agent), dann bauen. Bei echter Unklarheit: EINE Frage an mich, sonst direkt weiter.
3. Gib die Umsetzung an `bauer` (unabhängige Teile parallel, jeder nur seine Dateien). Den kniffligen Kern – neue Algorithmen, Architektur, Performance – machst du selbst.
4. Lass `tester` prüfen. Bei ROT: Ursache selbst klären, Fix wieder an `bauer`.
5. Sieht man die Änderung? Dann `gucker` (Bilder gegen `docs/ART-DIRECTION.md`). „Schwach“ heißt: noch eine Runde.
6. Bei großer Änderung `pruefer` drüberschauen lassen.
7. Commit auf einem Branch + PR. Abschluss: 3 Zeilen und der GitHub-Pages-Pfad zum Ausprobieren.
