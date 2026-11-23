# Engine-Changelog

## 2026-11-23 – Startdorf Erlenwacht, Erlbach, Gras (Welt v3, Bauplan docs/plaene/WELT-STARTDORF.md)
- spiel/modul-dorf 1.0.0 (neu, Stufe spiel): Dorf am Ort 'siedlung' – Plan, Gebäude/Kleinkram mit Kollision, Nachtlicht, Platz/Gassen/Felder, Brücke über den Erlbach, Stationen Brunnen/Schrein/Anschlagbrett/Amboss/Feuer (Ereignisse dorf:benutzt, dorf:gebunden), Schrein = Wiedererscheinen
- world/dorf-plan 1.0.0 + dorf-plan-kern (neu, ohne THREE): handgesetzter Platz-Kern + prozedurale Häuser, Gärten, Zäune, Laternen, Palisade, Felder, NPC-Punkte, pruefe()
- models/bau/dorf-teile 1.0.0 (neu): Brücke (begehbar), Holzstapel, Karren, Beet ×3, Anschlagbrett, Schrein, Palisade, Heuhaufen, Steg
- render/bau-instanzen 1.0.0, render/licht-pool 1.0.0 (neu): Bau-Assets als Instanzen + Kollision + Anker; wenige PointLights wandern zu den nächsten Laternen/Fackeln/Feuern, flackern, nachts an
- world/gras-feld 1.0.0 (neu): wogendes Gras um den Fokus, ein Draw-Call, Wind, weicher Rand; world/fluss-mesh 1.0.0 (neu): Wasserband aller Flüsse mit Strömung + Schaum
- world/welt-regionen 1.2.0 (additiv): `fluesse` (mehrere Flüsse), Erlbach Hochland → Dorf → Klamm → Dämmerwald → Strand; flussInfo liefert id/rand. world/welt-streu 1.2.0 (additiv: Ufer-Streu UFER)
- spiel/modul-welt 1.2.0 (additiv: Gras, neues Wasser, `fluesse`, sperreObjekte auch als Liste, `?gras=0`), modul-riesenwald 1.1.0 (Riesen nicht in Bächen)
- gameplay/aufgaben 1.1.0 (additiv: Art 'ereignis', punktVon), spiel/modul-tutorial 1.1.0 + tutorial-daten 1.1.0: Dorf-Kette „Willkommen in Erlenwacht“, NPCs Hedda, Oskar, Mira, Ilse

## 2026-11-23 – Aufräumen: Modul-Register, Testfeld, neue Ordner
- spiel/module-register 1.0.0 (neu): Stufen labor → testfeld → spiel je Modul, Zuständigkeit (bausteine), Auswahl mit Abhängigkeiten (`?nur=`), Prüfung
- spiel/module 1.0.0 (neu): alle Modul-Objekte an einer Stelle, `moduleFuer({stufe, nur})` – ersetzt erlenwacht/js/module-liste.js
- Keine API-Änderung an bestehenden Modulen. Ordner: games/ aufgeteilt in erlenwacht/, testfeld/, labore/, spiele/ (Pfade in Kommentaren angepasst)

## 2026-11 – Erlenwacht wird ein MMO (Stufen, Beute, Klassen, Gegner, Tutorial, Oberfläche, Welt v2)
- gameplay/progression 1.0.0, gameplay/beute 1.0.0, gameplay/gegenstaende-daten 1.0.0 (neu): Stufe 1–15, XP-Kurve, Talentbaum je Klasse (3 Zweige × 4), Beute-Tabellen mit Seltenheit + Affixen
- gameplay/klassen-daten 1.0.0 (neu): Krieger (Wut), Magier (Mana/Zauber), Waldläufer (Energie) mit Freischaltung auf Stufe 1/3/5/8/12
- gameplay/boss 1.0.0 (neu): Boss-Phasen, Heulen ruft Rudel, telegrafierte Sprung-/Prankenangriffe, Rücksetzen
- models/kreaturen wolf, keiler, irrlicht 1.0.0 (neu); gameplay/horde 1.2.0 + gegner-lager 1.1.0 (additiv: Arten, Stufen, Entitäts-Daten)
- ui/chat, ui/figur-editor, ui/minikarte 1.0.0 (neu)
- world/welt-regionen 1.1.0 (additiv: weicher Rand, Fluss + Furt, neue Orte wolfsfels/furt/aussicht-moor, Stufen der Lager), world/welt-streu 1.1.0, world/fern-wald 1.0.0 (neu, Impostor-Fernwald)
- spiel: modul-fortschritt, modul-kampf, modul-tutorial (+ tutorial-daten), modul-oberflaeche (+ oberflaeche-fenster) neu; modul-spieler 1.1 (⚔/💬-Knöpfe, Name), modul-zauber 1.1 (setzeLeiste), modul-gegner 1.1, modul-welt 1.1, modul-entitaeten 1.1 (Option zielRahmen). Bauplan: docs/plaene/ERLENWACHT-MMO-PLAN.md

## 2026-11 – Erlenwacht: die Engine als Module, eine große Welt
- core/modul-kern 1.0.0 (neu): Module mit Abhängigkeiten, Startreihenfolge, Takte fest/update/spaet, Dienste, Zustand, Aufräumen rückwärts; fehlende/abgeschaltete Abhängigkeit überspringt statt zu sprengen
- **Neue Schicht `spiel/` (Rang 6)**: spiel 1.0.0 (Host: Renderer, Szene, Schleife, Qualität, URL-Schalter `?aus= ?test ?q ?ort ?seed`), modul-welt, modul-himmel, modul-riesenwald (+ riesenwald-teile), modul-entitaeten, modul-spieler, modul-bewohner, modul-gegner, modul-zauber (+ zauber-gross, zauber-anzeige). Vertrag: docs/plaene/ERLENWACHT-MODULE.md. Nutzer: erlenwacht
- world/welt-regionen 1.0.0, world/chunk-strom 1.0.0, world/welt-streu 1.0.0 (neu, ohne THREE): 4×4-km-Welt aus Regionen (Küste, Dämmerwald, Erlenwacht, Nebelmoor, Hochland, Grauzinnen), Orte, 3 Wege; Quadtree-Gelände-Streaming 64–512 m mit Baubudget; Streu je 64-m-Kachel (Etappe 5, noch ohne Worker)
- world/riesenwald-plan 1.0.0 (neu): Riesen entlang der Wege (Tor-Paar, Lichtungs-Kranz, Reihen, Hinterland)
- core/entitaeten 1.0.0, gameplay/befehle 1.0.0 (neu): stabile IDs (`s:1`, `g:7` …), Raum-Abfrage, Änderungen seit Takt (Netz-Deltas); Befehls-Schicht mit Prüfern, festem Takt und Nachspielen – MMO-Fundament
- gameplay/gegner-lager 1.0.0 (neu): Horden-Lager mit Ruhe/Jagd/Heimkehr, Bissen als Befehle, Respawn, nachts stärker
- gameplay/ausdauer 1.0.0, gameplay/klettern 1.0.0 (neu): Ausdauer (Sprint, Rolle, Schwimmen, Klettern, Erschöpfung), Klettern an Hängen > 55° und hohen Hindernissen
- gameplay/character-motor 1.3.0 (additiv: Kletter-Modus `absicht.klettern`), gameplay/character 1.5.0 (additiv), models/character/character-clips-mehr 1.1.0 (Clip `klettern`)
- gameplay/element-reaktionen 1.0.0 (neu): Elemente + Zustände auf Zielen und Boden-Flecken, 10 Reaktionen (Schock, Eingefroren, Feuersturm, Dampf, Schlamm, Schmelzen, Zerschmettern …); ui/zauber-leiste 1.0.0 (neu)

## 2026-11 – Dämmerwald: Boden, Kronen, Unterwuchs, Tageslicht
- world/boden-anpassung 1.0.0 (neu): Gelände schmiegt sich an große Objekte – Erdwulst aus lokalen Höhenkarten (Wurzeln, Felsen), Verdeckung/AO am Fuß, Bucket-Gitter statt Suche über alle Objekte. Nutzer: labore/daemmerwald
- models/natur/laub-klumpen 1.0.0 (neu, ohne THREE) + render/laub-karten 1.1.0 (neu): Kronen als deckende Blatt-Karten (Blattform prozedural im Shader, Alpha-Test), Durchscheinen zur Sonne, `setzeLicht`, `deckMaterial`, `durchlass`. Nutzer: labore/daemmerwald
- models/natur/pflanze-unterwuchs 1.0.0 (neu): Wedelfarn, Unterholz-Busch, Moospolster, Wurzelschössling, Laubstreu; natur-assets 1.1.0 (Familie `unterwuchs`, im Natur-Labor)
- world/worldgen: worldgen-scatter 1.2.0 (`lichtung`, `fuss`, Quelle `dichte(x,y)`), worldgen-vegetation 1.1.0 (`URWALD_OBJEKTE`, `URWALD_TYPEN`), worldgen-biomes 1.1.0 (`URWALD_BIOM` über `biome.extra`), worldgen-presets 1.3.0 (Presets `urwald`, `daemmerwald`) – alles additiv
- render/kronen-lichtkarte 1.0.0 (neu): kleine Lichtkarte des Kronendachs aus Sonnensicht (nur selten neu), Lichtflecken per Texture-Lookup, Lückensuche für Lichtstrahlen, `lichtBei` für Staub. Nutzer: labore/daemmerwald

## 2026-11 – Dämmerwald: SDF + echte Gauß-Splats
- core/sdf 1.0.0, core/sdf-netz 1.0.1 (neu): Abstandsfelder mit weicher Vereinigung (Kapsel, Kugel, Ellipsoid, Kette, Abzug, Störung), Surface-Nets-Netz mit Block-Vorauswahl (Wicklung an den Gradienten ausgerichtet) und begehbare Höhenkarte
- render/gauss-wolke 1.0.0, gauss-saat 1.0.0, gauss-sortierung 1.0.0 (neu): echte prozedurale 3D-Gauß-Splats – instanzierte Vierecke mit 3D→2D-Kovarianz, vormultipliziertem Alpha, exp²-Nebel, Wind, 16-Bit-Tiefensortierung über Index-Attribut + Float-Datentextur; Aussaat auf Netzen. Demo labore/natur/splat-test.html
- models/natur/riesenbaum 1.0.0 (+ riesenbaum-form, -krone, -netz; neu): Urwald-Riese in echter Größe (110 m) mit SDF-Brettwurzeln, optionalem Wurzelbogen, Ast-Röhren, Laub/Moos/Flechten als Gauß-Splat-Daten, Höhenkarte für die Kollision; `detail` 0.2–2. Demo labore/natur/riesenbaum-test.html. Nutzer: labore/daemmerwald

## 2026-11 – Meer-Flackern, Splat-Look
- render/psx 1.2.0 (additiv): `defines.PSX_KEIN_RASTER` – Material rastet nicht ein. Behebt das Meer, das beim Laufen kurz über dem ganzen Boden aufblitzte (seine Ecken liegen km weit weg; das Einrasten kippte die ganze Fläche um Meter)
- world/terrain-mesh 1.3.1 (intern): Meer und Meeresgrund mit `PSX_KEIN_RASTER`
- render/splat-look 1.0.0 (neu): Gaussian-Splat-Stil als Nachbearbeitung (Bild klein rendern, als weiche, an Kanten gestreckte Gauß-Flecken neu malen; nah größer). Nutzer: labore/enklave

## 2026-11 – Wasser ohne PS1-Flackern
- render/psx 1.1.0 (additiv): Materialien mit `defines.PSX_ANKER` + Attribut `psxAnker` rasten mit dem Versatz des Anker-Punkts ein. Behebt Wasser, das beim Laufen durchs Ufer/den Boden scheint (Wasser und Gelände rasteten getrennt ein und verschoben sich gegeneinander)
- world/terrain-mesh 1.3.0 (additiv): Wasser-Geometrie trägt `psxAnker` (Gelände-Punkt darunter) und `ufer` (1 = trockener Uferpunkt), `wasserMat.userData.ufer = true`
- world/wasser-glanz 1.0.0 (neu): wandernde Wellen, Glitzern und Ufer-Schaum als Shader-Hook auf vorhandenen Wasser-Materialien (kein Draw-Call mehr). Nutzer: labore/enklave

## 2026-11 – Atmosphäre Enklave
- audio/klang 1.2.0 (additiv): Klänge `knistern`, `vogel`, `grille`, `hammer`; Dauerbetten `bett('wind'|'wasser'|'feuer'|'stadt', staerke)` (Rausch-Schleife mit Filter und langsamem Pulsieren), `BETTEN`

## 2026-11 – Startgebiet und Enklave
- models/character/character-lod 1.0.0 (neu): Fern-Darstellung für Figuren – alle in 1 Draw-Call (InstancedMesh, ~250 Dreiecke, Look-Farben/Schalter als Instanz-Attribute, Lauf-Pendeln im Vertex-Shader), `lookZuLod(look)` rein testbar. Nutzer: labore/enklave (npcs.js)
- gameplay/character 1.4.0 (additiv): Option `mimik` (false = festes Gesicht, 3 Draw-Calls weniger je Figur) wird ans Modell durchgereicht
- world/welt-plan 1.0.0 + welt-plan-formen 1.0.0 (neu): geplante Gebiete im Weltgenerator (eingeebnete Zonen, Plateau, geschwungener Pfad mit Gefälle-Grenze, Bach/Fluss, Brücken im wege-Format, Plätze für Gebäude, `pruefe(adapter)`)
- models/bau/* 1.0.0 (neu): bau-basis, bau-teile, Haus, Taverne, Schmiede, Wachturm, Tempel, Mauer/Turm/Torhaus/Torflügel, Markt, Vorrat, Licht, Wegbau, Übung – Low-Poly mit Kollision und Ankern
- gameplay/aufgaben 1.0.0 (neu): Aufgaben-/Tutorial-Schritte als Daten (gehe-zu, sprich-mit, sammle, besiege, benutze, warte) mit Fortschritt und Ereignissen
- ui/aufgaben-anzeige 1.0.0 (neu): Ziel-Zeile, Wegpunkt-Pfeil am Bildschirmrand, Banner

## 2026-11 – Leistung (Handy)
- render/qualitaet 1.0.0 (neu): automatische Qualitätsstufe nach Bildzeit (Pixelverhältnis, Schattenkarte, Partikel-Anteil, max. Zahlen), Hysterese, reine Logik
- render/horde-mesh 1.1.0 (additiv, intern): lädt nur die belegten Instanzen zur Grafikkarte (Update-Bereiche)
- gameplay/horde 1.1.0 (additiv, intern): `schade()` ohne O(n)-Suche (Wesen hat `entfernt`), `ziele` ohne Iterator
- render/zauber-effekte 1.1.0 (additiv): `fx.anteil` (0…1) skaliert die Partikelzahl; Partikel-Puffer werden im Leerlauf nicht mehr hochgeladen
- ui/treffer-zahlen 1.1.0, ui/figur-schild 1.1.0 (additiv, intern): DOM-Stil nur bei Änderung, keine Vector3-Neuanlage pro Bild

## 2026-11 – Großzauber (episch)
- audio/klang 1.1.0 (additiv): neue Klänge `grollen`, `rauschen`, `heulen`, `bersten` für Großzauber
- gameplay/grosszauber 1.0.0 (neu): Register für Großzauber-Arten, laufende Wirkungen, Ereignis-Vokabular (treffer, beben, klang, stopp, funken, ring, meldung) und Welt-Adapter (Wände = Hindernis, Podest/Graben = Boden, Flut = Wasser)
- render/grosszauber-mesh 1.0.0 (neu): je Wirkung eine Ansicht aus einer Ansichts-Fabrik je Art
- gameplay/zauber 2.1.0 (additiv): Art 'gross' → Ereignis 'gross' (von, punkt, yaw)
- gameplay/zauber-daten 1.2.0 (additiv): Flutwelle, Erdwall, Zyklon, Erdriss (Feld `gross`)

## 2026-11 – Kampfsystem im Figuren-Labor
- gameplay/zauber-daten 1.1.0 (additiv): jeder Zauber hat ein Feld `element` ('feuer','eis','blitz','arkan','natur','heilig') für `kampf.schade({ art })`; bestehende Felder unverändert

## 2026-11 – Schweres Zaubern und Horden
- gameplay/zauber 2.0.0 (brechend): Aufladen statt Sofort-Zauber – `wirke(name, { halten, schlag, vorlauf = def.wirkzeit })`, `lasseLos()`, `brichAb()` (Mana zurück), `ladung` (Anteil, Überladung, Kraft); Abklingzeit zählt erst ab dem Schlag; neue Ereignisse `schlag`, `durchschlag`, `nova`, `feld`/`feldTakt`/`feldEnde`; Treffer haben `zug` (Sog); Ziel kann ein Bodenpunkt sein (`punkt`). Nutzer angepasst: labore/figuren
- gameplay/zauber-daten 1.0.0 (neu): Zauber-Tabelle als Daten, 12 Zauber (neu: Frostnova, Sog) mit `wirkzeit`, `gewicht`, Bogenflug (`fall`), `durchschlag`, Feldern (Brandboden, Sog mit Schluss-Schlag), `mehr` beim Überladen
- gameplay/horde 1.0.0 (neu): Horden-Gegner (Ratte, Riesenratte, Rattenkönig) – verfolgen, drängeln (Raum-Gitter), umzingeln, springen an und beißen, fliegen weg, Leichen verschwinden; `ziele`/`schade()` passen direkt zum Zauberbuch
- render/horde-mesh 1.0.0 (neu): Horde als InstancedMesh je Modell und Lauf-Bild (Hüpfer, Überschlag, Aufblitzen, Leichen auf der Seite)
- models/kreaturen/ratte 1.0.0 (neu): Low-Poly-Riesenratte, zwei Lauf-Bilder (≤ 260 Dreiecke)
- ui/treffer-zahlen 1.0.0 (neu): aufploppende Schadens-Zahlen aus festem Pool
- audio/klang 1.0.0 (neu, neue Schicht audio): synthetische WebAudio-Klänge (Einschlag, Explosion, Zisch, Blitz, Eis, Quieken, Biss …) + Dauerton zum Aufladen, Drosselung je Klang, stumm ohne AudioContext
- models/character/character-clips 1.3.0 (additiv): `spannBei` je Clip (Standard 0.7 × trefferBei)
- models/character/character-clips-zauber 2.0.0: Gesten schwerer und länger (tiefes Ausholen, Knie, Rückstoß), neue Geste `zauberGriff`, alle mit `spannBei`
- models/character/character-animator 1.2.0 (additiv): `spiele(name, { halteBei })` hält gespannt, `loese({ tempo })` lässt zuschlagen
- gameplay/character 1.3.0 (additiv): `loese(opts)`

## 2026-11 – PS1-Look aus Viniland
- render/psx 1.0.1 (neu): PS1-Look für eine ganze Szene – `wendeAn(szene)` patcht alle Materialien (vorhandene Shader-Hooks wie Randlicht/Wind bleiben), Eckpunkte rasten ein, Farbstufen mit Bayer-Dithering, `aufloesung()` für grobe Pixel, Stimmung (Kontrast, Sättigung, Tönung, Vignette je Ansicht/Splitscreen), live an/aus über `setze({ an })`
- world/himmel 1.1.0 (additiv): Shader endet mit `#include <dithering_fragment>` – der Himmel macht beim PS1-Look mit (ohne `psx` unverändert)
- labore/figuren, labore/handwerk: PS1-Look eingebaut und abschaltbar (☰ → Mehr bzw. ☰ → Optionen)

## 2026-11 – Etappe 2 (Kern): Welt verändern
- world/welt-aenderung 1.1.0 (neu): Änderungs-Schicht über der erzeugten Welt – Pinsel heben/senken/glätten/ebnen in Metern, Objekte entfernen, Sperrzonen (Wasser, Ufer, Wege, eigene per `sperreUmkreis`), Grenzen, Rückgängig/Wiederholen, `festschreiben()` für Bauplätze, Spielstand = nur Unterschiede zum Seed
- world/terrain-mesh 1.2.0 (additiv): `aktualisiere(bereich, { erde, erdFarbe })` baut nur das geänderte Stück neu (Höhen, Normalen exakt wie beim Komplettbau, Erd-Tönung), lädt nur die betroffenen Zeilen hoch
- world/scatter-mesh 2.2.0 (additiv): `setzeAufBoden(bereich)` setzt Objekte nach einer Gelände-Änderung wieder auf den Boden
- labore/handwerk: Schaufel = graben (gibt Erde), Erde = aufschütten; Gelände-Änderungen im Spielstand; Bauplatz fürs Lager wird eingeebnet

## 2026-11 – Etappe 3 (Rest): Türen, Truhen, Stationen, HUD und Menü
- gameplay/tueren 1.0.1 (neu): Türen/Tore – auf/zu mit weicher Animation, Kollisions-Körper nur solange zu, Schlüssel, Selbstschließen, blockiert wenn jemand in der Öffnung steht
- gameplay/behaelter 1.0.0 (neu): Truhen mit eigenem Inventar – öffnen je Figur, Schloss, umlagern, schließt beim Weggehen, Spielstand
- gameplay/stationen 1.0.0 (neu): Werkbank & Co. als Orte; `beiWem(wer)` passt direkt in `rezepte.pruefe(…, { stationen })`
- gameplay/inventar 1.2.0 (additiv): `uebertrage(von, platz, nach, anzahl?)` zwischen zwei Inventaren (Daten bleiben erhalten)
- ui/hud 1.0.0 (neu): Hinweis-Zeile mit Fortschritt, Kurzmeldungen (zusammenzählbar), Balken, Bereiche für Leisten
- ui/inventar-ansicht 1.0.1 (neu): Inventar als Reihe/Raster (Schnellleiste, Rucksack, Truhe) mit Anzahl, Haltbarkeit, Tippen/Halten
- ui/menue 1.0.0 (neu): Menü/Fenster mit Seiten (Knopf, Schalter, Regler, Auswahl, eigene Elemente) + `spielstandEintraege()` für Speicherplätze
- test/fake-dom 1.1.0 (additiv): echte Eltern/Kinder (append, remove, insertBefore, replaceChildren), abmeldbare Hörer, `dispatch` mit Ereignis-Objekt, `click()`
- labore/handwerk: Schuppen mit Tür, Truhe und Werkbank neben dem Start; Leiste, Hinweise und Fenster kommen aus der Engine; ☰ Pause-Menü mit Spielständen und Optionen

## 2026-11 – Etappe 3: Herstellen, Rohstoffe, Hand
- gameplay/rezepte 1.0.0 (neu): Rezepte als Daten (Zutaten, Werkzeug, Station), prüfen und herstellen – alles oder nichts
- gameplay/rohstoffe 1.0.0 (neu): abbaubare Quellen mit Beute per Seed, Werkzeug nötig oder nur schneller, Abnutzung, Nachwachsen nach Spielzeit, Spielstand
- gameplay/hand 1.0.0 (neu): gewählter Inventar-Platz als „in der Hand“, Wechsel-Meldung zum Ausrüsten, Haltbarkeit bis zum Zerbrechen
- gameplay/inventar 1.1.0 (additiv): `setzeDaten(platz, daten|null)` für Einzelstücke
- gameplay/welt-dinge 1.1.0 (additiv): `wirf(…, { daten })` – Werkzeuge behalten ihre Haltbarkeit beim Ablegen
- labore/handwerk: Axt und Hacke herstellen (🔨), in die Hand nehmen, damit schneller fällen/abbauen; Bäume und Felsen wachsen nach

## 2026-11 – Fundament: Kollision, leichte Physik, Dinge & Handeln
- world/kollision 1.0.0 (neu): Kollisions-Welt über dem Adapter – bewegliche/entfernbare Zylinder und gedrehte Kästen mit Höhe (draufsteigen, drüberspringen, weich aneinander vorbei), Strahl-Test gegen Gelände und Körper
- gameplay/koerper 1.0.0 (neu): leichte Physik für lose Dinge (fallen, abprallen, Reibung, haften/rutschen am Hang, schwimmen/sinken, einschlafen), fester Zeitschritt
- gameplay/welt-dinge 1.0.0 (neu): Gegenstände in der Welt – ablegen, werfen, aufheben, Stapel zusammenlegen, Lebensdauer, Spielstand
- gameplay/interaktion 1.0.0 (neu): bestes Ziel in Reichweite/Blick, sofort oder gedrückt halten mit Fortschritt
- gameplay/inventar 1.0.0 (neu): Plätze, Stapel, Gewicht, Speichern/Laden
- core/ereignisse 1.0.0 (neu): Event-Bus mit Prioritäten und Warteschlange (feste Reihenfolge je Schritt)
- core/register 1.0.0 (neu): Datenkatalog (Gegenstände …) mit stabilen Nummern für Spielstand/Netz
- core/raum-gitter 1.0.0 (neu): räumliches Raster für bewegliche Dinge (Umkreis, Nächster)
- core/schnappschuss-puffer 1.0.0 (neu): weiches Interpolieren verspäteter Zustände (Mehrspieler-Grundlage)
- gameplay/character-motor 1.2.0 (additiv): reicht Fußhöhe an `welt.bodenHoehe(x, z, y)` und `{ y, hoehe, ausser }` an `welt.hindernisse` (alte Adapter ignorieren das); feinere Unterschritte bei hohem Tempo (kein Durchtunneln dünner Stämme); `speichern()`/`laden()`; Option/Feld `kollisionsId`
- gameplay/character 1.2.0 (additiv): meldet sich in einer Kollisions-Welt selbst als weicher Zylinder an (`koerper: false` schaltet ab)
- world/worldgen/worldgen-adapter 1.2.0 (additiv): `hindernisNah`, `setHindernis(objektIndex, aktiv)`, `alleHindernisse` – Bäume/Felsen lassen sich abbauen
- world/scatter-mesh 2.1.0 (additiv): `verstecke(objektIndex)`, `lage(objektIndex)`
- labore/handwerk: Kisten-Treppe, Äpfel/Pilze aufheben, Inventarleiste (antippen = ablegen), Bäume fällen/Felsen abbauen, Figuren schieben sich aneinander vorbei, alles im Spielstand

## 2026-11 – Figuren: schönerer Look, Zauber
- render/figur-material 1.0.0 (neu): Figuren-Material mit Randlicht, aufgehellter Schattenseite, kräftigeren Farben
- models/character/character-model 1.2.0: nutzt standardmäßig `figurMaterial()` (eigenes `material` geht weiter)
- models/character/character-clips-zauber 1.0.0 (neu): 6 Zauber-Gesten (zauberWurf, -Stoss, -Finger, -Himmel, -Boden, -Selbst); character-clips 1.2.0 registriert sie
- gameplay/zauber 1.0.0 (neu): 10 Zauber als Daten, Zauberbuch mit Mana, Abklingzeit, Wirkzeit, Geschossen, Treffer-Ereignissen (ohne THREE)
- render/zauber-effekte 1.0.0 (neu): Partikel, Geschoss-Kugeln, Ringe, Blitze, Erdstacheln, Aura, Meteor-Sturz aus Pools
- input/touch-stick 1.1.1: Knöpfe ab dem 5. sitzen höher (der 6. Knopf lag halb unter dem Bildschirmrand)
- labore/figuren: Zauberleiste + ✨-Knopf, Leben/Mana, ☰-Menü als Blatt mit Reitern (Handy unten, groß links)

## 2026-11 – Lebendige Welt (Fahrplan Etappe 1)
- core/zeit 1.0.0 (neu): Spieluhr mit Tagen, Jahreszeiten, Ereignissen, Pause/Tempo, Speicherstand
- core/schleife 1.0.0 (neu): Spielschleife mit festem oder variablem Zeitschritt, FPS, Tab-Pause
- core/speicher 1.0.0 (neu): Spielstände in Slots (Version + Migration, TypedArrays, Export/Import, Autospeichern, Ersatz ohne localStorage)
- world/himmel-stand 1.0.0 (neu): Sonnen-/Mondbahn, Mondphase, Himmels- und Lichtfarben über den Tag, Wetter-Einfluss (reine Daten)
- world/himmel 1.0.0 (neu): Himmelskuppel (Verlauf, Sonne, Mond, Wolken), Sterne, Sonnen-/Mondlicht mit mitlaufendem Schatten, Umgebungslicht, Nebel
- world/wetter 1.0.0 (neu): Wetterverlauf per Seed nach Klima (klar … gewitter, schnee, nebel, sturm), weiche Übergänge, Wind, Blitz, Nässe
- render/niederschlag 1.0.0 (neu): Regen/Schnee als ein Points-Objekt um die Kamera (Bewegung im Shader)
- labore/handwerk: Tag/Nacht, Wetter, Spieluhr mit Jahreszeiten, Autospeichern; Knöpfe ⏩ und Wetter
- docs/plaene/ENGINE-FAHRPLAN.md: Etappenplan für die ganze Engine

## 2026-11 – Weltengine: Wege in 3D
- world/wege-lage 1.0.0 (neu): Lage der Brücken in Metern, `mitBruecken(adapter, lagen)` macht sie begehbar
- world/wege-mesh 1.0.0 (neu): Holzbrücken (Bohlen, Geländer, Pfeiler) je Flussquerung
- world/terrain-farben 1.1.0 (additiv): Wegzellen (FLAG.WEG) werden als Erdweg eingefärbt, abschaltbar mit `wege: false`; Welten ohne Wege unverändert
- world/worldgen/worldgen-wege 1.1.0: Brücken haben `dx`/`dy` (Richtung); `x`/`y` ist jetzt die Mitte zwischen beiden Ufern und `laenge` die Spannweite von Ufer zu Ufer (vorher Anzahl Flusszellen)
- labore/handwerk: Wege an, Brücken begehbar, Wege auf der Karte

## 2026-11 – Weltengine: Wegenetz
- world/worldgen/worldgen-wege 1.0.0 (neu): Stufe „wege“ zwischen „orte“ und „objekte“ – Spannbaum plus Abkürzungen über Start, Dörfer und gewählte Sehenswürdigkeiten, A* um Steilhänge, geteilte Strecken, Brücken über Flüsse. Standardmäßig aus (`wege: { aktiv: true }`), bestehende Welten und Schnappschüsse bleiben gleich.
- world/worldgen/worldgen 1.1.0 (additiv): `welt.wege`, `welt.wegKnoten`, Stufe „wege“ in STANDARD_STUFEN, Wege im Worker-Transfer
- world/worldgen/worldgen-path 1.1.0 (additiv): Optionen `faktor(i)` und `minKosten`
- world/worldgen/worldgen-grid 1.1.0 (additiv): `FLAG.WEG` (128)
- world/worldgen/worldgen-presets 1.2.0 (additiv): Optionen `wege`
- labore/welt: Ebene „Wege“ mit Brücken

## 2026-11 – Natur-Assets und schönere Welt
- Neu: models/natur – prozedurale Low-Poly-Assets per Seed (Vertrag: docs/plaene/NATUR-ASSETS.md): natur-basis, baum-arten/-skelett/baum
  (14 Baumarten, Jahreszeiten, Alter), fels-form/fels (6 Felstypen, 5 Gesteine, Moos/Schnee), totholz-form/totholz,
  pflanze-formen/-basis/-blume/-busch/-boden/-wueste (13 Typen), natur-assets (Registry + Varianten-Cache)
- Neu: render/natur-material – Vertexfarben-Material mit Wind-Shader (Attribut wind, Instanz-Phase, Schatten schwingt mit, Fern-Ausblenden)
- world/scatter-mesh 2.0.0 (Verhalten geändert): nutzt Asset-Cache (opts.assets), Varianten je Typ, Kacheln + Fern-Detail, Wind via update();
  unbekannte Typen werden weggelassen statt als Busch gezeichnet, Seerosen auf Wasserhöhe. Nutzer angepasst: testwelt
- world/terrain-mesh 1.1.0 + neu terrain-farben: weiche Biomübergänge, Wiesenflecken, Hangfels mit Bändern, Ufer, Schnee mit Rauschgrenze
- worldgen-scatter 1.1.0 + neu worldgen-vegetation: Vegetation in Ebenen (neue Arten totholz, unterholz, geroell, seerose, bodendecker),
  Typwahl nach Höhe/Temperatur/Feuchte; Option objekte.artDichte. worldgen-chunks 1.2.0, worldgen-adapter 1.1.0 (Radien neuer Typen),
  worldgen-height 1.1.0 (optionale Felsstufen). Schnappschüsse neu (nur Objekte geändert)
- Spiele: neues natur-labor (Asset-Betrachter); testwelt mit neuen Assets und Wind; weltlabor-Kartenfarben

## 2026-11 – Figuren-System ausgebaut (alle additiv, Minor-Versionen)
- Aussehen: render/mesh-builder 1.1 (torus, lathe); character-look 1.1 (neue Haare/Bärte/Kleidung/Hüte, brille/schal/schmuck,
  Körper schultern/muskeln, Feld ausdruck, TEIL_NAMEN, AUSDRUECKE, 9 neue Vorlagen); character-model 1.1 (Mimik: setAusdruck,
  setAugen, setLider, blinzeln, updateGesicht; setAusdruck(null) = Grundmimik aus dem Look); character-parts/-kopf 1.1, aufgeteilt in
  character-parts-basis/-torso/-becken/-ruecken/-haar/-hut/-zubehoer/-gesicht; neu: character-ausruestung (16 Gegenstände)
- Animation: character-animator/-clips/-gang/-pose 1.1; neu: character-clips-mehr (24 Clips), character-anim-blick/-hang/-idle/-zustand,
  character-sekundaer (Nachschwingen), character-reaktion (Treffer, Umfallen, Aufstehen)
- Bewegung/KI: character-motor 1.1 (Rolle, Dash, Doppelsprung, Gleiten, Tauchen, Schleichen, Kantenschutz, Betäubung),
  character-steering 1.1 (Patrouille, Umkreisen, Abstand, Verstecken, Schwarm); neu: character-motor-tuning, character-steering-extra,
  character-gruppe, character-sinne (Sehen/Hören/Gedächtnis), character-brain (Zustandsautomat mit Tagesplan)
- Steuerung: follow-camera 1.1 (Ich-Sicht, Presets, Kamerafahrt, Hindernis-Kollision, weiches Lock-On), move-input 1.1 (Belegung als Daten,
  neue Aktionen rollen/gleiten/tauchen/aktion1/2/interagieren/ziel; stickRadius jetzt 'auto'), touch-stick 1.1; neu: camera/ziel-wahl,
  ui/figur-schild (Namensschild, Sprechblase, Lebensbalken)
- gameplay/character 1.1: Brain-Option, sage, ausruesten/ablegen, setAusdruck(name,{dauer}), treffer/umfallen/aufstehen, blickZu;
  Fehler behoben: Getter (z. B. look) waren nach setLook eingefroren
- Spiele: testwelt läuft mit echter Figur + 14 Dorfbewohnern (Brain); figuren-labor mit Ausrüstung, Ausdrücken, Brain-NPCs

## 2026-11 – Figuren-System (1.0.0, entwurf)
- render/mesh-builder; models/character: character-look, character-rig, character-parts, character-parts-kopf, character-model, character-pose, character-clips, character-gang, character-animator
- gameplay: character-motor, character-steering, character (Klebstoff); input: move-input, touch-stick; camera: follow-camera
- Vertrag: docs/plaene/FIGUREN-SYSTEM.md · Testspiel: labore/figuren

## 2026-11 – Weltengine: Chunk-Flüsse und Schnappschüsse
- world/worldgen/worldgen-chunkfluss 1.0.0 (neu): chunk-lokale Flussnetze aus einem Knotengitter (Seed + Position), begrenzter Zufluss, Überlauf flacher Senken, kleine Seen in Senken – nahtlos ohne globale Stufen
- world/worldgen/worldgen-chunks 1.1.0 (additiv): Flussmodus 'netz' ist Standard (alter Modus über `chunk.flussModus: 'rauschen'`, Werte dort unverändert); Chunks liefern zusätzlich `wasser` und `seen`, neu `seenIn()`, `dispose()`, `samplePunkt` füllt optional `aus[8]` (Wasserspiegel). Signaturen von generateChunk/sampleHeight unverändert, die Höhenwerte im Standardmodus ändern sich.
- world/worldgen/worldgen-presets 1.1.0: neue Optionen `chunk.flussModus`, `chunk.netz`
- worldgen-snapshot.test.mjs: Hash-Schnappschüsse für 8 Presets und beide Chunk-Flussmodi
- labore/welt: Chunk-Modus nutzt Wasserspiegel und Seen aus den Chunks

## 2026-11 – Testwelt
- world/worldgen/worldgen-adapter 1.0.0: Welt in Metern für Figuren/Kamera (bodenHoehe, wasserHoehe, hindernisse, Startpunkt) – passt zu docs/plaene/FIGUREN-SYSTEM.md
- world/terrain-mesh 1.0.0: Gelände mit Biomfarben, Seen/Flüsse, Meer
- world/scatter-mesh 1.0.0: Bäume, Büsche, Felsen … als InstancedMesh je Typ
- labore/handwerk: begehbare 3D-Testwelt (Figurensystem-Steckplatz mit Platzhalter)

## 2026-11 – Phase 0
- core/rng 1.0.0, core/noise 1.0.0 (aus planet/js/noise.js, plus 2D-Simplex, fbm2, ridged2, warp2), core/math 1.0.0
- test/fake-dom 1.0.0 (Browser-Attrappe für Node-Tests; THREE läuft in Tests echt aus node_modules)
- world/worldgen 1.0.0: Weltgenerator-Pipeline (Form, Höhe, Erosion, Hydrologie, Flüsse, Klima, Biome, Orte, Objekte), 13 Presets, Chunk-Modus, Abfragen, A*-Wegsuche, Worker-Übergabe
- labore/welt: Vorschauseite für den Weltgenerator
- Werkzeuge: tools/katalog.mjs (Katalog + Prüfung + Schichtregeln), tools/build.mjs (esbuild → dist/<spiel>.html), tests/smoke.mjs
