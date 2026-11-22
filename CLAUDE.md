# PAG – Claude

Alle Regeln stehen in **AGENTS.md** (gilt für jede KI gleich):

@AGENTS.md

## Nur für Claude: Arbeitsteilung (Limit schonen)
Das Hauptmodell plant, entscheidet und löst den schwierigen Kern. Alles andere wird delegiert (`.claude/agents/`):
- `sucher` (Haiku) – Stellen finden, bevor irgendwas Großes gelesen wird.
- `bauer` (Sonnet) – klar beschriebene Aufgaben umsetzen. Auftrag immer mit Dateien, Ziel, Abnahmekriterium.
- `tester` (Haiku) – Tests/Build laufen lassen, meldet nur GRÜN/ROT.
- `pruefer` (Sonnet) – Diff-Review, nur bei großen Änderungen.
- `gucker` (Sonnet) – macht Bildschirmfotos (`tools/bild.mjs`) und beurteilt sie gegen `docs/ART-DIRECTION.md`.
Parallele Agenten = wie mehrere KIs (AGENTS.md „Mehrere KIs gleichzeitig“): je Agent ein Modul, feste Verträge im Bauplan,
geteilte Dateien schreibt nur das Hauptmodell.
Selbst machen: Architektur, neue Algorithmen, Performance-Probleme, Fehlersuche mit unklarer Ursache.
Sitzungen: `/start` liest `docs/STAND.md` + `docs/ARBEIT.md`, `/ende` schreibt sie. Ein Thema pro Sitzung. `/bau <was>` baut, `/bild <ort>` sieht nach.
