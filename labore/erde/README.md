# 🌍 Wildgrund (Erde-Labor)

Erfundener Planet (Standard R = 100 km) vom Orbit bis zum Boden, zu Fuß begehbar, mit Geologie, Klima, Wetter, Natur und Graben.
Ausprobieren: `https://oitow.github.io/pag/labore/erde/` · Baum-Galerie: `labore/erde/baeume.html` (`?art=eiche`, `?zeit=herbst`, `?nah=1`) · Sprungmarken `?ort=orbit|berg|kueste|strand|boden|himmel|fluss|ufer|see|vulkan|krater|wald|tafel|biom0…9|gestein0…4`
· Testschalter `?grafik=Niedrig|Mittel|Hoch|Ultra`, `?test=1` (kein Spielstand), `?hunger=0.2`, `?tasche=voll`, `?herstellen=offen`, `?bautest=1`, `?tiere=test|aus`, `?ueberleben=aus`, `?schmiedetest=1`, `?gleiter=1&flug=1` (300 m) / `&flug=800`, `?tagebuch=offen|aus`, `?feldtest=1`, `?wetter=regen|schnee|gewitter|nebel|sturm|klar`, `?uhr=19` (Ortszeit), `?seed=`, `?r=` (km), `?neu=1`.

## Module (`js/`, reine Logik ohne THREE wo möglich → Tests in `tests/erde-*.test.mjs`)
| Datei | Aufgabe |
|---|---|
| `geologie.js` | einmal beim Start: Platten, Gebirge, Vulkane, Erosion, Flüsse, Seen, **Gestein**, **Klima** (Temperatur, Feuchte) |
| `klima.js` | Biome, Walddichte, Bodenfarbe, **Sonnenstand** (Drehachse y, Jahreszeiten), **Temperatur jetzt** (Tag/Jahr/Wetter) |
| `wachstum.js` | **was wächst wo**: Klimaansprüche je Baum/Feldfrucht → Eignung 0…1 |
| `boden.js` | **Bodenschichten** (Schnee → Oberboden → Unterboden → Gestein), Stoffe mit Härte, Erze/Funde |
| `ernte.js` | was gibt ein Baum/Busch/Fels, welches Werkzeug braucht es |
| `eingriffe.js` | **Graben/Aufschütten** als Höhenänderung + entfernte Natur, speicherbar |
| `voxel-erde.js` | **Voxel-Nahzone**: Graben/Aufschütten in Blickrichtung (Gruben, Tunnel) mit `engine/world/voxel-kugel.js`; Stoff je Voxel aus `boden.js`-Schichten, Gesteinsbänke; Loch-Maske im Bodenshader, Kollision (Boden/Wand/Decke), Kamera im Tunnel. Testschalter `?grabtest=1` (Grube) / `2` (im Tunnel). Plan: `docs/plaene/ERDE-FUNDAMENT.md` |
| `aktionen.js` | Spieler: graben, aufschütten, nehmen (Regeln + Eingriffe + Inventar) |
| `planet-hoehe.js` | Höhe/Wasser/Farbe an jedem Punkt (Geologie + feines Rauschen + Flussbetten + Eingriffe) |
| `planet-baum.js`, `kachel-bau.js`, `kachel-strom.js`, `kachel-worker.js` | Würfel-Kugel-Quadtree, Kachelbau im Worker, nahtloser Austausch |
| `natur-streu.js` → `natur.js` | Natur je 80-m-Kachel streuen (Worker) → InstancedMesh, Wind, nah/mittel/fern. Laubbäume + Kiefer/Pinie aus `engine/models/natur/astbaum.js` (echte Äste, Zweige, Blätter): nah bis 16 m (~5k △), nah bis 25 m, mittel bis 50 m, weit bis 90 m; fern **Impostor** (`engine/render/baum-impostor.js`: Foto des nahen Modells aus 8 Richtungen, 2 △ je Baum, alle Baumarten) |
| `zeit-wetter.js` | Uhr (engine `zeit`), Wetter (engine `wetter`), Regen/Schnee (engine `niederschlag`) auf der Kugel |
| `planet.js` | Seite: Steuerung, Kamera, Himmel, Sonnenschatten, Mond, Grafik-Stufe, HUD, Karte |
| `erweiterungen.js` | Andock-Stelle für Spiel-Module (Vertrag oben in der Datei); Plan: `docs/plaene/ERDE-UEBERLEBEN.md` |
| `ueberleben.js` (+ `-regeln`) | Leben, Hunger, Durst, Körperwärme (Wetter, Nässe, Kleidung, Feuer, Dach), Essen, Trinken, Tod/Aufwachen, Lava |
| `herstellen.js` (+ `-daten`) | Herstellen-Fenster (engine `rezepte`), Stationen Lagerfeuer/Werkbank, Kleidung tragen |
| `bauen.js` (+ `-regeln`, `bauteile.js`) | Bau-Modus: Fundament, Wand, Dach, Treppe, Lagerfeuer, Werkbank – einrasten, Kosten, Abreißen |
| `gleiter.js` (+ `-physik`) | Gleiter: Flugphysik (Gleitzahl 9), Thermik über sonnigen Hängen und Kratern, Hangwind, Landung/Absturz, Fallschaden, Vario |
| `tagebuch.js` (+ `-daten`) | Ziele für die ersten Stunden (Feuer, Speer, Jagd, Hütte, Feld, Gleiter, Eisen) + Entdeckungen (Biome, Vulkan, Meer) |
| Schmiede (in `bauen*`, `herstellen-daten`) | Schmelzofen, Amboss; Holzkohle, Kupfer-/Eisenbarren, Kupfer-/Eisenwerkzeug – Stufen: Granit/Basalt ab Kupfer, Gold ab Eisen |
| `spielerfigur.js` | sichtbare Figur in der 3.-Person-Ansicht (Menü Ansicht „1./3. Person“, `?person=1`, `?figur=ritter`, `?koerper=organisch`) |
| `wolken.js`, `vulkan-rauch.js` | Wolkendecke nach Wetter/Wind (`?wolken=aus`), Rauchsäulen über den Kratern |
| `tiere.js` (+ `-regeln`) | Wild je Biom (Reh, Hase, Keiler, Wolf), Flucht/Angriff, Jagen → Fleisch, Fell, Knochen |

Aus der Engine (geteilt mit Naturstimmungen/Gigantwelt): `engine/models/natur/naturfundus.js`, `landschaftsgruppen.js` (Wollgras, Pilzholz,
Flechtenbank), `fundmodelle.js` (Erzbrocken, Ammonit, Quarzdruse – liegen nach Gestein halb im Boden), `engine/render/mond.js` (`nachtseite: 'durchsichtig'`).
Testschalter `?ort=gestein0…4` (je Gesteinsart), `?zeige=<art>` (vor das nächste Stück dieser Art stellen).
Grafik: Stufe Niedrig/Mittel/Hoch/Ultra (Knopf „Grafik“, Handy = Mittel) + Fenster „Grafik ⚙“ mit einzelnen Reglern
(Auflösung, Gelände-Detail, Natur-Weite, Schatten nah 1024–4096, **Bergschatten** `fernschatten.js` (zweite grobe Schattenkarte ±1,6 km,
selten neu gerendert, Floating-Origin-Matrix), **Gelände-AO** (`hohl` aus der Krümmung in `kachel-bau.js`), Wasser einfach/Wellen/Kräusel, Dunst);
eigene Einstellung wird gespeichert. Topografie (`planet-hoehe.js`): Tafelberge/Terrassen + Schluchten in trocken-warmen Gegenden, Küstenklippen,
schärfere Grate + Kare im Hochgebirge, Felsbänder, Schutthalden. Das HUD zeigt,
welche Natur-Arten die meisten Dreiecke kosten.

## Assets – Vertrag (für jede KI, die daran arbeitet)
- Quellen: `engine/models/natur/naturfundus.js` (`baueNaturAsset(art, seed)` → Mesh), `engine/models/natur/landschaftsgruppen.js` (`baueGruppe(art, seed)`)
  und `engine/models/natur/natur-assets.js`.
- Ursprung am Fußpunkt, **+Y = oben**, Maße in Metern, eine Geometrie mit Vertexfarben (optional Attribut `wind` 0…1).
- **Größe egal**: `natur.js` bringt Bäume u. a. auf `ZIEL_HOEHE` (m). Neue Zielhöhe → dort eintragen.
- **Namen und Funktion nicht umbenennen** – sonst findet die Welt das Asset nicht.
- **Neue Art** sichtbar machen: in `natur-streu.js` in `STREU_ARTEN` + Regel (Baum: `wachstum.js` PFLANZEN; Boden: `BODEN` je Biom),
  in `ernte.js` was sie gibt. Fundus-Art zusätzlich in `natur.js` `FUNDUS` (Gruppe: `GRUPPEN`).
