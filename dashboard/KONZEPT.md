# Dashboard-Konzept – „Matrix mixed 3D“

Übersicht über alle Inhalte des Mini-Kopfs (`pag`): Ideen, Spiele, Tests, KI, Skills, Docs, Patches.

## Rahmenbedingungen

- **Single-File** `dashboard/index.html` (HTML/CSS/JS in einer Datei), keine Build-Steps
- **Three.js via CDN** (ES-Module über `importmap`, z. B. jsDelivr), sonst keine Abhängigkeiten
- **GitHub Pages**: läuft unter `https://oitow.github.io/pag/dashboard/`, nur relative Pfade
- **Mobil zuerst**: Android, Portrait, Touch; Desktop ist Bonus

## Stil

- Hintergrund fast schwarz (`#020604`), Primärfarbe Neon-Grün (`#00ff66`), Akzente Cyan (Tests), Amber (in Arbeit), Rot (blockiert)
- **Code-Regen**: 2D-Canvas-Layer hinter der 3D-Szene, fallende Zeichen (Katakana + Ziffern + Dateinamen aus dem Manifest), gedimmt
- **3D-Ebene**: Three.js-Szene mit leuchtenden Knoten, Linien als Datenleitungen, leichter Nebel (`FogExp2`)
- Schrift: Monospace (System-Mono, kein Webfont nötig), UI-Panels halbtransparent mit grünem Rand, Scanline-Overlay per CSS
- Glow günstig: additive Sprites statt Postprocessing-Bloom

## Datenquelle

**Primär: `dashboard/manifest.json`** (von Hand oder per KI gepflegt)
- Funktioniert offline, ohne Rate-Limit, auch bei Repo-Umbenennung
- Enthält Status, Tags, Verknüpfungen – Infos, die die API nicht kennt
- Regel: Wer etwas in `ideas/`, `games/`, `tests/` … anlegt, trägt es im Manifest ein (Teil jedes Patches)

**Optional: GitHub API** (public Repo `Oitow/pag`, ohne Token)
- `GET /repos/Oitow/pag/commits?per_page=10` → letzte Commits
- `GET /repos/Oitow/pag/git/trees/main?recursive=1` → Abgleich: Dateien, die im Manifest fehlen, als „unregistriert“ (grau) anzeigen
- Limit 60 Anfragen/Stunde/IP → Antworten in `localStorage` cachen (TTL 10 min); bei Fehler still weglassen

## Ansichten (Tabs unten, daumenfreundlich)

1. **GRAPH** (Start) – 3D-Knoten-Graph
   - Zentraler Kern „PAG“, Kategorien als Ringe/Cluster, Einträge als Knoten
   - Farbe = Status, Größe = Priorität, Linien = `links` (z. B. Idee → Spiel → Test)
   - Langsame Auto-Rotation, stoppt bei Berührung
2. **MATRIX** – Status-Matrix als Tabelle/Grid
   - Zeilen = Einträge, Spalten = Status-Phasen (Idee → Konzept → Prototyp → Spielbar → Fertig)
   - Gefüllte Zellen leuchten; Filter nach Kategorie/Tag
3. **PLAY** – Spiele-Launcher
   - Karten für alle `games/` und `tests/` mit `path`, Button „START“ öffnet `../games/<name>/index.html`
4. **LOG** – letzte Commits (API) + `updated`-Datum aus Manifest, als Terminal-Ausgabe

**Detail-Panel** (Bottom-Sheet, von unten hochwischen): Titel, Beschreibung, Status, Tags, Links zu Datei auf GitHub, Start-Button falls spielbar.

## Interaktion

- 1 Finger ziehen = Orbit, 2 Finger = Zoom/Pinch, Tippen auf Knoten = Detail-Panel (Raycast)
- Doppeltipp = Kamera fliegt zum Knoten
- Suchfeld oben: tippt man, wird Code-Regen kurz zu den Treffern „gezogen“, passende Knoten leuchten
- Alle Tap-Ziele ≥ 44 px, kein Hover-only

## Performance-Regeln (Handy)

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`
- Knoten als **InstancedMesh** (eine Draw-Call), Linien als ein `LineSegments`
- Kein Postprocessing, keine Schatten, nur `MeshBasicMaterial`
- Code-Regen: max. ~40 Spalten, 30 fps gedrosselt, auf eigenem Canvas
- Rendern nur bei Bewegung/Animation; bei `visibilitychange` (Tab versteckt) pausieren
- Nicht-GRAPH-Tabs: 3D-Loop stoppen, reines DOM
- Ziel: < 150 KB HTML, 60 fps auf Mittelklasse-Android
- Fallback: ohne WebGL → nur MATRIX-Ansicht

## MVP vs. später

**MVP**
- Manifest laden, GRAPH + MATRIX + PLAY
- Code-Regen-Hintergrund, Detail-Panel, Touch-Steuerung

**Später**
- LOG mit GitHub-API, Abgleich unregistrierter Dateien
- Markdown-Vorschau der Ideen direkt im Panel
- Fortschrittsbalken pro Spiel (Checklisten aus Manifest)
- Zeitleiste (Knoten wachsen nach `created`-Datum)
- KI-Modellvergleiche aus `ki/` als eigene Ansicht
- Skript/Skill, das `manifest.json` automatisch aus dem Repo erzeugt
- PWA (offline, Homescreen-Icon)

## manifest.json – Format

```json
{
  "version": 1,
  "updated": "2026-10-29",
  "repo": "Oitow/pag",
  "items": [
    {
      "id": "wurzelwerk",
      "type": "idea",
      "title": "Wurzelwerk",
      "path": "ideas/wurzelwerk.md",
      "status": "konzept",
      "priority": 3,
      "tags": ["roguelite", "autobattle"],
      "links": ["game-wurzelwerk"],
      "summary": "Baum-Roguelite mit Auto-Kampf und Logistik",
      "updated": "2026-10-29"
    }
  ]
}
```

| Feld | Werte |
|---|---|
| `type` | `idea`, `game`, `test`, `ki`, `skill`, `doc`, `patch` |
| `status` | `idee`, `konzept`, `prototyp`, `spielbar`, `fertig`, `pausiert` |
| `priority` | 1 (niedrig) – 5 (hoch) |
| `links` | IDs anderer Einträge (werden zu Graph-Kanten) |
| `path` | relativ zum Repo-Root; bei `game`/`test` die `index.html` |

Pflichtfelder: `id`, `type`, `title`, `path`, `status`. Rest optional.
