# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 35 Zeilen. Dauerhafte Festlegungen: `docs/ENTSCHEIDUNGEN.md`.

## Zuletzt gemacht
- **Dämmerwald verbessert** (Branch daemmerwald-licht-kronen-boden): Wurzeln sitzen im Boden (Erdwulst + AO, `world/boden-anpassung`), Kronen als dichte Blatt-Karten statt Nebel
  (`models/natur/laub-klumpen`, `render/laub-karten`), Unterwuchs Farn/Busch/Moos/Schössling/Laub (`models/natur/pflanze-unterwuchs`), Boden-Detail im Shader
- Tag-Nacht-Zyklus (`?zeit=` `?tempo=` `?licht=einfach`, Standard 17:45), Kronen-Lichtkarte (`render/kronen-lichtkarte`): Sonnentupfer, Strahlen nur in Kronenlücken (9 Lücken in `kronen.js`), Staub leuchtet im Licht; Mond + Sterne
- Weltgenerator: Biom `URWALD_BIOM`, Presets `urwald`/`daemmerwald`, worldgen-scatter mit `lichtung`/`fuss`/`dichte`

## Läuft / kaputt
- `npm test` grün (Engine + Smoke), Dämmerwald-Daten grün; Bilder tor/bogen/lichtung/ufer zu 8/13/18.5/23 Uhr angesehen (Software-Renderer)
- NICHT geprüft: echtes Handy (Bildrate, Readback der Lichtkarte 256², Alpha-Test-Kanten der Blatt-Karten), `npm run build`
- Zahlen ?q=niedrig: Tor 88 Calls / ~756 k Dreiecke; mittel ~1.26 Mio. Dreiecke
- Offen: Moos-/Dunst-Splats unbeleuchtet, Laub wirft keinen Schatten, Klumpenränder etwas „Blumenkohl“, Büsche facettig/ohne Splat-Rand, Tor abends/nachts sehr dunkel,
  Sonnentupfer springen bei Neu-Rendern um 1–3 m (beschleunigter Tag), Boden-Shader erkennt Waldboden über Vertexfarbe
- Alt: Rinde doppelseitig (core/sdf-netz), Spielzeug-Reste (Laterne, Boot, Menhir), Enklave Draw-Calls > 120

## Nächster Schritt
- Dämmerwald am Handy spielen und Bildrate melden; danach Dreiecke weiter senken (Stufe 0 nur für die 4–6 nächsten Riesen, `games/daemmerwald/js/wald.js`)
- Spielzeug-Reste ersetzen: Laterne, Farn und Unterholz als Splat-Büschel, Vergleichsbäume mit Splat-Laub (`games/daemmerwald/js/bewuchs.js`, `dinge.js`)
- Dämmerwald-Ende mit der Enklave verbinden (ein Weg, eine Welt); Mentorin/erste Aufgabe am Ufer
- MMO-Fundament: Entitäts-IDs + Befehls-Schicht, dann Netzwerk-Prototyp

## Ideen-Parkplatz
- SDF-Kreaturen und -Zauber (weich verschmelzende Formen), Splat-LOD nach Entfernung, Koloss-Silhouette fern zwischen den Stämmen
- Sammelspiel mit den Voxel-Tieren; Sichtlinien-Prüfung in `gameplay/interaktion`
