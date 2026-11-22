# 📌 Entscheidungen

> Dauerhafte Festlegungen, neueste oben, je eine Zeile: **was** – warum. `/ende` hängt hier an. Überholtes durchstreichen, nicht löschen.

## Darstellung
- Neue Welten folgen `docs/ART-DIRECTION.md`: düster, groß, weich, echt; Mensch = 1.8 m, alles in Metern – Goi will Größe wie Shadow of the Colossus, kein Playmobil (16.11.2026)
- Meshes sind die Spiel-Wahrheit, SDF formt sie, Gauß-Splats sind nur Aussehen und abschaltbar – Handy-Rückfall, Kollision bleibt einfach (16.11.2026)
- Splats werden per Seed erzeugt, nicht gescannt; eigener kleiner Renderer statt Spark.js – kein Download, file://, Three bleibt 0.170.0 (16.11.2026)
- Kein PS1-Raster in neuen Welten; der PS1-Look bleibt als Schicht für die alten Labore – Wasser-Glitches, passt nicht zu weichen Formen (16.11.2026)
- PS1-Look liegt als Schicht über der Szene (Materialien werden gepatcht, nicht ersetzt) – Module müssen nichts davon wissen

## Welt
- Geplante Gebiete per `welt-plan` als worldgen-Stufen (deterministisch, Seed fest) statt zufällig gefundener Orte; Plan-Daten gelten nur für ihren Seed
- Der Dämmerwald hat ein eigenes, von Hand geformtes Gelände (Höhenfunktion) statt worldgen – eine gestaltete Strecke braucht Kontrolle über jeden Blick (16.11.2026)
- `welt-aenderung` schreibt direkt in `welt.hoehe` (Adapter/Kollision sehen es sofort); vorbereitete Plätze per `festschreiben()` aus dem Spielstand halten
- Abgebaute Bäume/Felsen bleiben bei `gameplay/rohstoffe` (wachsen nach); `welt-aenderung.entferneObjekt` ist für dauerhaftes Entfernen
- Spielzeit für Nachwachsen = Tage als Kommazahl (`uhr.tag + uhr.stunde / 24`)

## Figuren & Spiel
- Ferne Figuren als ein InstancedMesh (`character-lod`), nah höchstens 3 volle Figuren
- Lose Dinge stoßen nicht untereinander zusammen (billig, reicht); Figuren-Kollision ist weich (0.5)
- Werkzeug ist in der Testwelt nie Pflicht (nur schneller); Ausnahme Schaufel
- Mehrspieler: noch kein Netzwerk; Regeln dafür in `docs/ENGINE-FAHRPLAN.md` („Fundament für Mehrspieler“)
- UI-Module: alle Stile inline, keine Timer – alles über `update(dt)`

## Arbeitsweise
- Im Repo zählen nur Spiele und Tests (02.11.2026)
- PAG ist die Werkstatt, `Oitow/Erlenwacht` das spätere MMO-Repo – Umzug erst mit einem spielbaren Gebiet, damit nicht zwei halbe Engines entstehen (16.11.2026)
- Sichtbares gilt erst als fertig, wenn ein Bild gemacht und angesehen wurde (`tools/bild.mjs`, Agent `gucker`) – frühere Sitzungen haben Shader „blind“ abgeliefert (16.11.2026)
- Parallele Agenten nur mit festen Verträgen im Bauplan und getrennten Dateien (bewährt bei Enklave und Dämmerwald)
- Neue oberste Schicht `engine/spiel/` (Host + fertige Spiel-Module). Neue Spiele stecken Module an (`createSpiel({ module })`) statt alles selbst zu verdrahten; Erlenwacht ist die Sammelwelt, in der alles zusammen getestet wird (22.11.2026)
- Agenten-Runden: höchstens ~10 neue Testdateien je Runde, nur reine Logik (22.11.2026)
