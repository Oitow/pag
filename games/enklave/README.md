# 🏰 Die Enklave

Startgebiet für das spätere MMO: ein geschütztes **Tutorial-Tal**, ein geschwungener **Pfad** (~540 m mit Wegweisern, Brücke und Aussichtspunkt)
und die ummauerte **Enklave** auf einem Plateau (Tor mit Wachen, Markt mit Brunnen, Taverne, Schmiede, Tempel, Wachtürme, ~29 Bürger).
Bauplan: [`docs/WELT-ENKLAVE.md`](../../docs/WELT-ENKLAVE.md). Asset-Galerie (alle Gebäude + Kleinkram): [galerie.html](galerie.html).

## Ablauf (Tutorial, 16 Schritte)
Mentorin **Alwine** am Lagerfeuer → Steinkreis (Kamera) → über den Bach springen → Bo ansprechen → Kräuter sammeln → Rucksack →
Trainingspuppe (Nahkampf) → Zauber → erste Ratten → Flutwelle (Großzauber) → Wegweiser → Aussichtspunkt mit Blick auf die Enklave →
Brücke → Tor öffnet sich: **„Willkommen in der Enklave“**. Fortschritt, Position, Uhr und Rucksack werden automatisch gespeichert.

## Steuerung
WASD/Pfeile laufen · Leertaste springen · E ansprechen/aufheben · F Schlag (halten = schwer) · 1 Funkenschlag · G Großzauber (ab dem Schritt Flutwelle) ·
I Rucksack · T Ziel · Ziehen = Kamera. Handy: Stick links, Knöpfe rechts, 💬 bei NPCs.

## Technik
- Welt: Weltgenerator + `engine/world/welt-plan` (Zonen einebnen, Plateau, Pfad mit Gefälle-Grenze, Bach/Fluss, Brücke) mit festem Seed, Plan-Daten in `js/plan-daten.js`
- Gebäude/Kleinkram: `engine/models/bau/*` (Low-Poly, Kollision, Anker für Laternen/Rauch/Schilder)
- Aufgaben: `engine/gameplay/aufgaben` + `engine/ui/aufgaben-anzeige` (Ziel-Zeile, Wegpunkt-Pfeil), Daten in `js/tutorial-daten.js`
- Figuren: nah voll animiert (höchstens 3), fern als `engine/models/character/character-lod` (alle in 1 Draw-Call)
- Atmosphäre: Tag/Nacht (`world/himmel`), Rauch/Glut/Glühwürmchen/Pollen, Ambiente-Klang (abschaltbar), Nachtbeleuchtung
- PS1-Look (`render/psx`) und automatische Qualität (`render/qualitaet`); Wasser rastet mit dem Gelände ein (kein Durchscheinen am Ufer)
- Grafik-Stil im Menü (☰ → Optionen): **PS1**, **Klar** oder **Splat** (`render/splat-look`, mit Reglern für Dichte und Fleck-Größe)
- Lebendiges Wasser: Wellen, Glitzern, Ufer-Schaum (`world/wasser-glanz`)

## Test-Abkürzungen
`?ort=tal|aussicht|tor|stadt` · `?stil=ps1|klar|splat` · `?schritt=<Nr|id>` · `?frisch` (Spielstand ignorieren) · `?debug` (fps, Draw-Calls) · `?zeitraffer=N` · `?test=1` (Smoke)

## Offen
- Handy-Leistung nicht auf echtem Gerät gemessen (Tal ~138 Draw-Calls, Ziel ≤ 120); Ambiente-Klang nicht angehört
- Keine Innenräume, kein Dialog-System (Sprechblasen), Figur/Menü sind angepasste Kopien aus der Testwelt (später in die Engine befördern)
