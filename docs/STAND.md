# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 35 Zeilen. Dauerhafte Festlegungen: `docs/ENTSCHEIDUNGEN.md`.

## Zuletzt gemacht
- Neues Spiel **games/daemmerwald** (Bauplan `docs/WELT-DAEMMERWALD.md`): Ufer → Tor der Alten → Wurzelbogen → gestürzter Riese → Lichtung; 46 Riesen (110 m) in 5 Varianten,
  3 Detailstufen nach Pfad-Abstand, Dunst-Staffelung, Lichtbahnen, Laternen, Pilze, Glühwürmchen; `?ort=` `?q=` `?splats=0` `?test=1` `?debug`
- Engine neu: `core/sdf`, `core/sdf-netz`, `render/gauss-wolke` (+ `-saat`, `-sortierung`), `models/natur/riesenbaum` (+ `-form`, `-krone`, `-netz`); Demos im Natur-Labor (`splat-test.html`, `riesenbaum-test.html`)
- KI-Struktur: Wegweiser + „Sehen statt glauben“ in `CLAUDE.md`, `docs/ART-DIRECTION.md`, `docs/RENDER-TECHNIK.md`, `docs/TESTEN.md`, `docs/ENTSCHEIDUNGEN.md`,
  Agent `gucker`, Befehl `/bild`, Werkzeug `tools/bild.mjs` (Bildschirmfotos)

## Läuft / kaputt
- Engine-Tests + Katalog grün, Smoke daemmerwald ok, alle 5 Orte + Hochformat + `?splats=0` als Bild angesehen (Software-Renderer)
- NICHT geprüft: echtes Handy (Bildrate!), `npm run build` (kein esbuild in der Sitzung → CI), Durchlaufen der Strecke (Kollision an Wurzeln, Bogen, Kerbe nur als Standbild)
- Zu schwer fürs Handy? `mittel` ~1.2 Mio. Dreiecke, `niedrig` ~640 k, 60–83 Draw-Calls; Ladezeit durch 5 Varianten × 3 Detailstufen (SDF-Vernetzung) spürbar
- Spielzeug-Reste: Laterne (oranger Kasten), Lowpoly-Vergleichsbäume und -Farn, Boot, Menhir; gestürzter Riese liest sich als Wand; Schattenbereiche sehr dunkel
- Rinde ist doppelseitig gezeichnet (einzelne SDF-Dreiecke sonst als Loch sichtbar – Ursache in `core/sdf-netz` noch nicht ganz behoben)
- Splats sind unbeleuchtet/ohne Schatten (pauschal gedämpft); Nebel der Splats vor dem Tonemapping (im Spiel vor-entzerrt)
- Alt: Enklave Draw-Calls > 120; enklave/js/figur.js + menue.js sind Kopien aus der Testwelt

## Nächster Schritt
- Dämmerwald am Handy spielen und Bildrate melden; danach Dreiecke weiter senken (Stufe 0 nur für die 4–6 nächsten Riesen, `games/daemmerwald/js/wald.js`)
- Spielzeug-Reste ersetzen: Laterne, Farn und Unterholz als Splat-Büschel, Vergleichsbäume mit Splat-Laub (`games/daemmerwald/js/bewuchs.js`, `dinge.js`)
- Dämmerwald-Ende mit der Enklave verbinden (ein Weg, eine Welt); Mentorin/erste Aufgabe am Ufer
- MMO-Fundament: Entitäts-IDs + Befehls-Schicht, dann Netzwerk-Prototyp

## Ideen-Parkplatz
- SDF-Kreaturen und -Zauber (weich verschmelzende Formen), Splat-LOD nach Entfernung, Koloss-Silhouette fern zwischen den Stämmen
- Sammelspiel mit den Voxel-Tieren; Sichtlinien-Prüfung in `gameplay/interaktion`
