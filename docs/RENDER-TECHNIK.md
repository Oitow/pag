# 🧪 Render-Technik – SDF + Gauß-Splats (Stand der Entscheidung)

> Warum so und nicht anders. Bauplan der ersten Szene: `docs/plaene/WELT-DAEMMERWALD.md`.

## Grundsatz
| Schicht | Technik | Aufgabe |
|---|---|---|
| Spiel-Wahrheit | **Mesh + Höhenkarte** | Kollision, Wege, Treffer – alles, was das Spiel wissen muss |
| Form | **SDF → Netz** (`core/sdf.js`, `core/sdf-netz.js`) | weiche, verwachsene Formen (Riesenbaum, später Felsen, Kreaturen, Zauber) – beim Laden vernetzt, nicht je Pixel |
| Aussehen | **Gauß-Splats** (`render/gauss-wolke.js`, `render/gauss-saat.js`) | Laub, Moos, Dunst, Staub – abschaltbar, mit Budget je Qualitätsstufe |

## Entscheidungen
- **Splats werden erzeugt, nicht gescannt.** Übliche Gauß-Splat-Szenen im Netz sind Foto-Scans (.ply/.spz, zig MB). Wir würfeln die Splats per Seed
  aus der Form (Punkte auf dem SDF-Netz, Blobs in der Krone). Vorteile: 0 Download, läuft per Doppelklick, jede Welt bleibt prozedural.
- **Kein SDF-Raymarching des ganzen Bilds.** Sieht in Shadertoy-Demos toll aus, kostet am Handy aber jede Bildrate und hat keine Kollision.
  Wir nutzen SDF als *Form-Werkzeug* und vernetzen einmal beim Laden.
- **Eigener kleiner Splat-Renderer statt Spark.js.** Spark (World Labs) ist stark, braucht aber Three ≥ 0.179 und ist für Scan-Dateien gebaut;
  wir stehen auf 0.170.0 und brauchen nur erzeugte Splats. Wechsel bleibt möglich: das `daten`-Format (Mitte, Skala, Drehung, Farbe, Deckkraft) ist dasselbe.
- **WebGL2, kein WebGPU** – läuft auf praktisch jedem Handy-Browser.
- **Sortierung** hinten→vorn auf der CPU (Zähl-Sortierung, nicht jedes Bild). Splats schreiben keine Tiefe, werden aber gegen Meshes getestet.
- `render/splat-look.js` (älter) ist nur ein **Bild-Filter** („gemalt“), keine 3D-Splats – nicht verwechseln.

## Budgets (Handy zuerst)
| Stufe | Splats | Pixel-Verhältnis | Schatten |
|---|---|---|---|
| niedrig | 40 k | ≤ 1 | aus |
| mittel | 90 k | ≤ 1.5 | 1024, nah |
| hoch | 160 k | ≤ 2 | 2048, nah |
Teuer ist nicht die Zahl, sondern die **Überzeichnung**: große, nahe, halbdurchsichtige Splats. Deshalb: Größe am Bildschirm begrenzen, Dunst-Splats sparsam.

## Offene Fragen
- Echtes Gerät messen (bisher nur Software-Renderer im Test).
- Splat-LOD nach Entfernung statt fester Ausdünnung je Baum.
- SDF-Kreaturen/-Zauber (weich verschmelzende Formen) als nächster Einsatz.
