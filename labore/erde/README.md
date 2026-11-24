# 🌍 Erde-Labor

Erfundener Planet (Standard R = 100 km) vom Orbit bis zum Boden, zu Fuß begehbar, mit Geologie, Klima, Wetter, Natur und Graben.
Ausprobieren: `https://oitow.github.io/pag/labore/erde/` · Sprungmarken `?ort=orbit|berg|kueste|boden|fluss|see|vulkan|wald|biom0…9`
· Testschalter `?test=1` (kein Spielstand), `?h=` (Höhe über Boden, m) und `?nei=` (Blickneigung °) zur Sprungmarke, `?wetter=regen|schnee|gewitter|nebel|sturm|klar`, `?uhr=19` (Ortszeit), `?seed=`, `?r=` (km), `?neu=1`.

## Module (`js/`, reine Logik ohne THREE wo möglich → Tests in `tests/erde-*.test.mjs`)
| Datei | Aufgabe |
|---|---|
| `geologie.js` | einmal beim Start: Platten, Gebirge, Vulkane, Erosion, Flüsse, Seen, **Gestein**, **Klima** (Temperatur, Feuchte) |
| `klima.js` | Biome, Walddichte, Bodenfarbe, **Sonnenstand** (Drehachse y, Jahreszeiten), **Temperatur jetzt** (Tag/Jahr/Wetter) |
| `wachstum.js` | **was wächst wo**: Klimaansprüche je Baum/Feldfrucht → Eignung 0…1 |
| `boden.js` | **Bodenschichten** (Schnee → Oberboden → Unterboden → Gestein), Stoffe mit Härte, Erze/Funde |
| `ernte.js` | was gibt ein Baum/Busch/Fels, welches Werkzeug braucht es |
| `eingriffe.js` | **Graben/Aufschütten** als Höhenänderung + entfernte Natur, speicherbar |
| `aktionen.js` | Spieler: graben, aufschütten, nehmen (Regeln + Eingriffe + Inventar) |
| `planet-hoehe.js` | Höhe/Wasser/Farbe an jedem Punkt (Geologie + feines Rauschen + Flussbetten + Eingriffe) |
| `planet-baum.js`, `kachel-bau.js`, `kachel-strom.js`, `kachel-worker.js` | Würfel-Kugel-Quadtree, Kachelbau im Worker, nahtloser Austausch |
| `natur-streu.js` → `natur.js` | Natur je 80-m-Kachel streuen (Worker) → InstancedMesh, Wind, nah/mittel/fern |
| `zeit-wetter.js` | Uhr (engine `zeit`), Wetter (engine `wetter`), Regen/Schnee (engine `niederschlag`) auf der Kugel |
| `planet.js` | Seite: Steuerung, Kamera, Himmel, Sonnenschatten, Mond, Grafik-Stufe, HUD, Karte |

Mitbenutzt aus `labore/naturstimmungen` (Codex): `gruppen.js` (Wollgras, Pilzholz, Flechtenbank) und `mond.js` (Mond + Mondlicht-Schatten),
aus `labore/gigantwelt/js/fundmodelle.mjs` (Codex): Fundstücke Erzbrocken, Ammonit, Quarzdruse – liegen nach Gestein halb im Boden.
Testschalter `?ort=gestein0…4` (je Gesteinsart), `?zeige=<art>` (vor das nächste Stück dieser Art stellen).
Grafik-Stufe Hoch/Mittel/Niedrig (Knopf, gespeichert): Schatten, Sichtweite der Natur, Geländedetail, Auflösung. Das HUD zeigt,
welche Natur-Arten die meisten Dreiecke kosten.

## Assets – Vertrag (für jede KI, die daran arbeitet)
- Quellen: `naturfundus/naturfundus.mjs` (`baueNaturAsset(art, seed)` → Mesh), `../naturstimmungen/gruppen.js` (`baueGruppe(art, seed)`)
  und `engine/models/natur/natur-assets.js`.
- Ursprung am Fußpunkt, **+Y = oben**, Maße in Metern, eine Geometrie mit Vertexfarben (optional Attribut `wind` 0…1).
- **Größe egal**: `natur.js` bringt Bäume u. a. auf `ZIEL_HOEHE` (m). Neue Zielhöhe → dort eintragen.
- **Namen und Funktion nicht umbenennen** – sonst findet die Welt das Asset nicht.
- **Neue Art** sichtbar machen: in `natur-streu.js` in `STREU_ARTEN` + Regel (Baum: `wachstum.js` PFLANZEN; Boden: `BODEN` je Biom),
  in `ernte.js` was sie gibt. Fundus-Art zusätzlich in `natur.js` `FUNDUS` (Gruppe: `GRUPPEN`).
