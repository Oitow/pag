# 🌳 Natur-Assets – Vertrag

Prozedurale Low-Poly-Assets (Bäume, Büsche, Felsen, Bodendecker) für die Engine. Alles per Seed, alles mit Vertexfarben,
EIN Material für alles (`MeshStandardMaterial({ vertexColors: true, flatShading: true })`), passt zum Stil von
`engine/render/mesh-builder.js` und den Figuren.

## Ort und Schichten

```
engine/models/natur/
  natur-basis.js        ← gemeinsame Helfer (Geometrie zusammenführen, Farben, Wind-Attribut) – gehört dem Baum-Agent,
                          andere dürfen nur LESEN/IMPORTIEREN; Wünsche → eigene Helfer im eigenen Modul
  baum-*.js             ← Bäume (Skelett rein ohne THREE, Geometrie mit THREE)
  fels-*.js             ← Felsen, Findlinge, Geröll, Totholz
  pflanze-*.js          ← Büsche, Kakteen, Schilf, Blumen, Gras, Farn, Pilze
  natur-assets.js       ← Registry: Typname → Generator (macht der Integrations-Schritt)
```

Schicht `models` (darf core + render importieren, nicht world).

## Generator-Vertrag

Jedes Generator-Modul exportiert:

```js
export const TYPEN = ['eiche', 'buche', …];              // Typnamen, die es bauen kann
export function erzeuge(typ, seed, opts = {}) -> {
  geometrie,      // THREE.BufferGeometry: position, normal, color (+ optional 'wind' Float 0..1)
  hoehe,          // Meter, Gesamthöhe
  radius,         // Meter, Grundriss-Radius (Krone/Busch/Stein) – für Culling/Abstände
  stammRadius,    // Meter, Kollisionsradius am Boden (0 = begehbar, z. B. Blume/Gras)
}
```

- **Ursprung** am Fußpunkt (0,0,0), **y nach oben**, Maße in **Metern** bei Skala 1 (realistisch: Eiche ~8–14 m,
  Busch ~1–2 m, Fels ~0,5–2 m). Leicht unter den Boden reichen (y bis −0,2) gegen Schweben am Hang.
- **Deterministisch**: gleicher typ + seed + opts → gleiche Geometrie. Zufall NUR über `engine/core/rng.js`.
- **opts.detail**: `0` (fern, sehr wenige Dreiecke) · `1` (normal, Standard) · `2` (nah/Labor). Budget bei detail 1:
  Baum ≤ ~1500 Dreiecke, Busch ≤ ~400, Fels ≤ ~300, Blume/Gras ≤ ~80.
- **Farben** über Vertexfarben, mit leichter Variation je Dreieck/Teil (kein Einheitsbrei), Unterseiten/Inneres dunkler
  (Fake-AO), Spitzen heller.
- **Wind** (optional, Attribut `wind`, Float32, 1 Komponente): 0 = starr (Stamm unten, Stein), bis 1 = schwingt voll
  (Blattspitzen). Ein späterer Shader nutzt das.
- Keine Texturen, keine Alpha. Geometrie nicht indiziert ist ok.
- Reine Logik (Skelett, Parameter, Formen-Berechnung) wenn möglich ohne THREE in eigenem Modul → in Node testbar.

## Typnamen (gemeinsam mit `engine/world/worldgen/worldgen-scatter.js`)

| Familie | Typen |
|---|---|
| Bäume (Laub) | eiche, buche, birke, ahorn, weide |
| Bäume (Nadel) | tanne, fichte, kiefer, pinie |
| Bäume (warm) | tropenbaum, palme, akazie, olive |
| Bäume (tot) | toterBaum |
| Felsen | fels, felsbrocken, findling, geroell, felsplatte, felsnadel |
| Totholz | baumstumpf, liegenderStamm, ast |
| Büsche | busch, beerenbusch, ginster, zwergstrauch |
| Bodendecker | farn, grasbueschel, blume, pilz, schilf, seerose |
| Wüste | kaktus, saeulenkaktus, agave |

Ein Generator darf mehr Typen können; die Welt nutzt nur, was in der Tabelle steht.
