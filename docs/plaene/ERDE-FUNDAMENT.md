# Bauplan: Erde-Fundament (der Planet selbst – fest, grabbar, schön)

Ziel: Der Planet in `labore/erde` soll sich anfühlen wie **Valheim + Enshrouded + Vintage Story** – riesige Sichtweite (bleibt!),
dazu echtes Graben (Löcher, Tunnel, Höhlen), sichtbare Erd- und Gesteinsschichten, Gras bis weit hinaus, verlässliches Wasser.
Bäume, Assets, Sounds, Effekte: später. Hier geht es nur um **Boden, Fels, Wasser, Topografie, Bewegung darauf**.

## 0. Entscheidung 26.11.: Graben = feines Höhenfeld (Voxel ruhen)
Am Handy machte die Mischung Höhenfeld + Voxel-Säulen Ärger: Stufen/Wände am Säulenrand (Kachel-LOD ≠ Voxel-Oberfläche), höchstens 12 ausgeschnittene
Säulen (dahinter „verschwanden“ Gruben), Loch-Schleife im Bodenshader für jedes Pixel, Neubau ganzer 16-m-Würfel mit allen Ops je Schlag.
Jetzt: `labore/erde/js/graben-feld.js` – Flecken (Stufe-13-Kacheln, ~19 m) mit 0,2-m-Höhenraster, Gruben als Kegel (flacher Boden, ~60°-Wände),
Abfrage O(1), Gelände-Kacheln über Flecken 1 Stufe feiner (~0,3 m). Keine Nähte, keine Zusatz-Netze. Steile Wände kann man nicht hochlaufen.
Tunnel/Höhlen später als **exakte Mischung** (Recherche 26.11.): Voxel-Dichte aus dem GEZEICHNETEN Höhenfeld, Randpunkte auf das Kachelnetz
schnappen, Höhenfeld-Vierecke aus dem Index nehmen statt `discard`, triplanar. Bis dahin: alter Voxel-Weg mit `?voxel=1`.

## 1. Grundsatz: eine Wahrheit, zwei Darstellungen
| | Fern (bis Horizont) | Nah (um Grabstellen, ~16-m-Würfel) |
|---|---|---|
| Form | Höhenfeld auf der Würfelkugel (Quadtree-Kacheln, wie heute) | **Voxel-Dichte** 0,5 m (Surface Nets, glatt) – Tunnel, Überhänge, Höhlen |
| Grabungen | als grobe Mulde (`eingriffe.js`, `fern: true`) – sieht man von weitem | exakt als Kugel-/Kapsel-Eingriff (`voxel-kugel` Ops) |
| Stoff | Oberflächenfarbe (Biom, Gestein, Hang) | Stoff je Voxel: Schichten + Gestein + Erzadern |

- **Wahrheit** = Höhenfunktion `planet-hoehe` (ohne Fern-Mulden) + Liste der Voxel-Eingriffe. Alles (Bild, Kollision, Graben, später Wasser) fragt diese eine Wahrheit.
- Voxel gibt es **nur, wo gegraben wurde** (+ später natürliche Höhlen). Unberührter Boden bleibt billiges Höhenfeld → Sichtweite und Handy-Leistung bleiben.
- Wo eine Voxel-Säule die Oberfläche enthält, wird das Höhenfeld dort per **Loch-Maske** im Shader ausgeschnitten (auch im Schattenbild).
- Gitter global und fest: Würfelseite → Winkelzellen (equi-angular), Radius in 0,5-m-Stufen. Kein lokales Koordinatensystem, das „wandert“.
- Speichern/Mehrspieler: nur die Op-Liste (deterministisch neu erzeugbar). Alte Höhen-Eingriffe bleiben gültig.

## 2. Schichten & Gestein (Vintage-Story-Gefühl)
- Von oben: Schnee/Eis → Oberboden (Humus, Torf, Sand …) → Unterboden (Lehm, Kies, roter Lehm) → **Grundgestein** (`geologie.js`: Sandstein, Kalk, Granit, Schiefer, Basalt).
- Im Gestein: **Bänke** (1–3 m, leicht geneigt, nach Gestein), Wechsellagerung (z. B. Kalk ↔ Mergel), **Erzadern** als 3D-Rauschen (Kupfer, Eisen, Gold je Gestein, `boden.js` ERZE).
- Graben gibt genau den Stoff, den man trifft. Härte → Werkzeugstufe (gibt es schon).
- An Klippen/Steilhängen sieht man die Bänke schon von weitem (Bodenshader `schicht`, später Gesteinsfarbe je Bank).

## 3. Topografie
- Bleibt: Platten, Gebirge, Erosion, Flüsse, Seen (Geologie beim Start). Ausbau später: Klippen/Terrassen (gestufte Bänke), Canyons, Höhlen-Eingänge an Steilhängen.
- Höhlen: natürliche Wurmtunnel (3D-Rauschen) **nur** in Voxel-Säulen → erst wenn Säulen auch ohne Grabung entstehen dürfen (Phase 4).

## 4. Wasser
- Meer: Meeresspiegel-Kugel. Seen/Flüsse: Wasserspiegel aus der Geologie (Höhenfeld). Bleibt die Wahrheit für „wo ist Wasser“.
- Graben neben Wasser (Phase 5): einfache Füll-Regel – eine Grube unter dem Wasserspiegel, die an Wasser grenzt, läuft voll (Zellen-Flutfüllung je Voxel-Säule). Kein Fluid-Sim.
- Unter Wasser: Schwimmen bleibt; Tauchen/Luft später.

## 5. Gras weit sichtbar
- Nah (< 45 m): Halme (`engine/world/gras-feld.js` an die Kugel anpassen). Mittel (45–300 m): Bodenshader „Grasflaum“ (Farbe + Rauschen + Glanz nach Blickwinkel).
  Fern: Biomfarbe (wie heute). Ziel: kein sichtbarer Rand.

## 6. Bewegung & Klettern
- Kollision: Boden aus Voxel wo vorhanden, sonst Höhenfeld; Wände schieben waagerecht (Knie/Kopf-Probe), Decke stoppt den Sprung.
- Klettern (statt Minecraft-Blöcke): **Seil werfen** (Wurfhaken: haftet an Fels/Holz, man hangelt hoch/runter), **Leiter** (baubar), Stufen ins Gestein hacken (Graben schräg nach oben). Steile Wände ohne Seil = rutschen.

## Phasen
| Phase | Inhalt | Stand |
|---|---|---|
| 1 | `engine/world/voxel-kugel.js` (Dichte, Ops, Surface Nets auf der Würfelkugel) + Erde: Worker, Meshes mit Bodenmaterial, Loch-Maske, Kollision (Boden/Wand/Decke), Graben in Blickrichtung (Tunnel), Schichten-Stoff je Voxel, Gesteinsbänke als Farbe | **fertig** (PR `claude/erde-fundament`) |
| 2 | Gesteinsbänke + Erzadern sichtbar in Voxel-Wänden (Farbe/Textur je Stoff, triplanar), Fern-Mulde für Gruben | |
| 3 | Aufschütten/Bauen mit Voxel (Erde, Stein platzieren, glätten) + Speicherstand-Wandel alter Höhen-Eingriffe | |
| 4 | Natürliche Höhlen + Klippen/Terrassen in der Topografie | |
| 5 | Wasser füllt Gruben, Uferabbruch | |
| 6 | Gras mittel/fern, Halme auf der Kugel | |
| 7 | Seil/Wurfhaken, Leiter | |

## Verträge (für Agents)
- `voxel-kugel` ist reine Logik (Worker-tauglich, kein THREE). Planet-spezifisches (Höhe, Stoff) kommt als Funktionen rein.
- `labore/erde/js/voxel-erde.js` verwaltet Säulen, Worker-Aufträge, Meshes, Maske, Kollision. Nur diese Datei spricht mit `voxel-kugel`.
- Stoff-IDs = Index in `VOXEL_STOFFE` (`voxel-erde.js`), Namen = `boden.js` STOFFE.

## Bekannte offene Punkte (Phase 1)
- Gruben sieht man nur in der Nähe (≤ 230 m, höchstens 12 Säulen gleichzeitig ausgeschnitten); fern kommt in Phase 2 eine Mulde ins Höhenfeld.
- Jede Schaufel ist ein Eintrag im Spielstand → später zusammenfassen (Chunk-Schnappschuss statt Op-Liste ab ~N Ops).
- An Würfelkanten der Kugel (6 Linien auf dem Planeten) fehlen Nachbar-Chunks der anderen Seite → dort Graben sperren oder Chunks spiegeln.
- `voxel-erde.js` > 300 Zeilen: Kollision (`fest`, `boden`, `schiebe`, `strahl`) in eigene Datei, `dispose()` ergänzen.
- Ohne Worker (file://) baut der Hauptthread einen Chunk je Bild (Ruckler beim Graben möglich).
- Tunnel sind überall gleich hell (Streulicht) – Fackeln/Lichtabfall später.
