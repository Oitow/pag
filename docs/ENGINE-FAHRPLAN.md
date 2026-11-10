# 🗺 Engine-Fahrplan – die eigene Welt

> Ziel: eine komplette eigene Engine, mit der man **eine Welt bauen, bewohnen und verändern** kann – auf dem Handy und per Doppelklick.
> Jede Etappe endet sichtbar in der [Testwelt](../games/testwelt/). Regeln und Modulvertrag: `CLAUDE.md`, `docs/BAUKASTEN-PLAN.md`.
> Abgehakt wird hier; Einzelheiten stehen im `engine/KATALOG.md` und `engine/CHANGELOG.md`.

## Was es schon gibt
- **Welt erzeugen:** Höhe, Erosion, Flüsse/Seen, Klima, Biome, Orte, Wege, Brücken, Objekt-Verteilung, Chunks (`world/worldgen/*`)
- **Welt zeichnen:** Gelände, Wasser, Natur-Assets mit Wind (`world/terrain-mesh`, `scatter-mesh`, `models/natur/*`)
- **Figuren:** Aussehen, Rig, prozedurale Animation, Motor, NPC-Gehirn, Sinne, Steering (`models/character/*`, `gameplay/character*`)
- **Eingabe/Kamera/UI:** Tastatur/Touch/Gamepad, Folgekamera, Namensschilder

## Etappen

### 1 · Lebendige Welt ✅ (diese Runde)
- [x] `core/zeit` – Spieluhr (Stunde, Tag, Jahreszeit, Ereignisse)
- [x] `core/schleife` – Spielschleife (fester/variabler Schritt, Tab-Pause)
- [x] `core/speicher` – Spielstände (Slots, Versionen, TypedArrays, Export)
- [x] `world/himmel-stand` + `world/himmel` – Tag/Nacht, Sonne, Mond mit Phase, Sterne, Wolken, Licht, Nebel
- [x] `world/wetter` + `render/niederschlag` – Wetter nach Klima, Regen/Schnee/Gewitter

### 2 · Welt verändern (der „Bau“-Kern)
- [ ] `world/welt-aenderung` – Änderungs-Schicht über der erzeugten Welt: Gelände heben/senken/glätten, Objekte setzen/entfernen; nur Unterschiede zum Seed speichern
- [ ] `world/terrain-mesh` – Teilstücke neu aufbauen statt alles (Kacheln)
- [ ] `gameplay/bau-raster` + `models/bau/*` – Bauteile (Boden, Wand, Dach, Zaun, Tür) mit Einrasten, Vorschau, Abriss
- [ ] `ui/werkzeug-leiste` – Werkzeuge für Maus und Finger (Pinsel, Setzen, Löschen, Rückgängig)
- [ ] Spielstand = Seed + Änderungen (`core/speicher`)

### 3 · Dinge & Handeln (Kern fertig)
- [x] `core/ereignisse` (Event-Bus), `core/register` (Datenkatalog für Gegenstände/Rezepte)
- [x] `world/kollision` (Körper mit Höhe, begehbar, beweglich, Strahl), `core/raum-gitter`, Motor 1.2 (draufsteigen, kein Tunneln)
- [x] `gameplay/koerper` (leichte Physik für lose Dinge), `gameplay/welt-dinge` (ablegen, werfen, aufheben)
- [x] `gameplay/inventar`, `gameplay/interaktion` (ansehen → Aktion, auch gedrückt halten)
- [x] Bäume/Felsen abbauen (Adapter `setHindernis`, `scatter-mesh.verstecke`) – in der Testwelt
- [x] `gameplay/rezepte` (Herstellen), `gameplay/rohstoffe` (Nachwachsen über die Spieluhr, Werkzeug nötig), `gameplay/hand` (Haltbarkeit)
- [x] Gegenstände in die Hand nehmen/benutzen (Inventar ↔ `character.ausruesten`) – in der Testwelt
- [ ] Türen/Truhen als Interaktions-Ziele, Stationen (Werkbank) für Rezepte
- [ ] `ui/hud` (Leiste, Inventar, Hinweise), `ui/menue` (Pause, Optionen, Spielstände)

### 4 · Klang & Gefühl
- [ ] `audio/sfx` (prozedural, WebAudio), `audio/musik` (Schichten nach Tageszeit/Wetter), `audio/umgebung` (Wind, Regen, Vögel, Wasser nach Standort)
- [ ] `render/partikel` (Staub, Funken, Laub, Spritzer), `render/wasser` (Wellen, Ufer-Schaum, Spiegelglanz)
- [ ] Nässe/Schnee auf dem Gelände (`wetter.nass` → `terrain-farben`), Jahreszeiten in `scatter-mesh`
- [ ] `render/qualitaet` – automatische Stufen fürs Handy (Auflösung, Schatten, Sichtweite)

### 5 · Unendliche Welt
- [ ] `world/chunk-strom` – Chunks um die Figur laden/entladen (Worker), Detailstufen, Fern-Gelände
- [ ] Änderungen je Chunk speichern; Karte/Minimap als Modul (`ui/karte`)

### 6 · Bewohner & Leben
- [ ] `models/tiere/*` (prozedurale Tiere, Rig + Gang), `gameplay/tier-brain` (Herden, Flucht, Jagd)
- [ ] `models/bau/haeuser` + `world/worldgen-dorf` – Dörfer mit Häusern, Feldern, Zäunen
- [ ] `gameplay/dialog`, `gameplay/aufgaben` (Quests), `gameplay/handel`, `gameplay/beduerfnisse` (Hunger, Schlaf)
- [ ] `gameplay/kampf` (Treffer, Leben, Beute)

### 7 · Baukasten rund machen
- [ ] `games/_vorlage` – neues Spiel per `cp -r` (Schleife, Himmel, Figur, Speicher fertig verdrahtet)
- [ ] Welt-Editor als eigenes Spiel (`games/weltbau`) – alles aus Etappe 2–6 zusammen
- [ ] Module von `entwurf` auf `stabil` heben, Leistungs-Messung im Smoke-Test

## Fundament für „später vielleicht Mehrspieler“
Kein Netzwerk-Code, aber die Regeln, die einen Umbau später billig machen:
- **Simulation ohne Darstellung:** Motor, Physik, Inventar, Interaktion, Dinge laufen ohne THREE/DOM (also auch auf einem Server in Node).
- **Fester Zeitschritt + Seed:** gleiche Eingaben → gleiches Ergebnis (`koerper`, Motor-Unterschritte, `rng`). Kein `Math.random()` in der Engine.
- **Eingabe = Absicht:** Spieler und NPCs steuern nur über die Absicht (`motor.update(dt, absicht)`); ein Server kann dieselbe Absicht nachrechnen.
- **Zustand als reine Daten:** `motor.speichern()/laden()` (Vorhersage zurückspulen), `inventar.zustand()`, `dinge.zustand()`, `register.nummer(id)` (kompakt).
- **Änderungen als Ereignisse:** Spielregeln melden über `core/ereignisse` (`ding:aufgehoben`, `abgebaut` …) statt direkt die Anzeige anzufassen.
- **Raum-Abfragen:** `core/raum-gitter` für „wer ist in meiner Nähe“ (Kollision heute, Sichtbereich je Spieler später).
- **Fremde Figuren glätten:** `core/schnappschuss-puffer` (Zustände kommen ruckelig an, gezeigt wird interpoliert).
- [ ] Offen: stabile Entitäts-IDs für alles (Figuren, Dinge, Bauteile), Befehls-Schicht („Spieler X will Y“) mit Prüfung, Welt-Änderungen je Chunk (Etappe 2/5).

## Reihenfolge-Regel
Immer erst reine Logik (testbar ohne Browser), dann Darstellung, dann Einbau in die Testwelt. Eine Etappe = ein PR.
