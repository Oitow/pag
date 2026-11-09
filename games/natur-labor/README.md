# 🌿 Natur-Labor

Betrachter für die prozeduralen Natur-Assets des Baukastens – Bäume, Felsen, Totholz, Büsche, Bodendecker, Wüstenpflanzen.

- **Ansicht:** ◻ einzeln (mit Figur 1,8 m als Maßstab) oder ▦ alle 36 Typen im Raster (📏 echter Maßstab / ⤢ alle gleich groß).
  Im Raster ein Asset antippen → einzeln ansehen.
- **Einstellungen:** Typ, Seed (🎲), Detail 0/1/2, Jahreszeit (Sommer/Herbst/Winter – Winter gibt Felsen/Totholz Schnee), 🌬 Wind an/aus.
- **Anzeige:** Dreiecke, Höhe, Radius, Stammradius, Bauzeit; Draw-Calls und Dreiecke im Bild, fps.
- **Steuerung:** Ziehen = drehen, Mausrad / zwei Finger = Zoom.
- **Bausteine:** `engine/models/natur/natur-assets.js` (Registry: `alleTypen`, `erzeugeAsset`, `FAMILIEN`),
  `engine/render/natur-material.js` (Vertexfarben + Wind-Shader über das Attribut `wind`). Kamera: eigene kleine Orbit-Logik.
- **URL:** `?typ=eiche&seed=3&detail=2&zeit=herbst` · `&raster=1` · `&massstab=echt` · `&wind=0`.

**Start:** `python3 -m http.server` im Repo-Root → `http://localhost:8000/games/natur-labor/`.
Einzeldatei: `npm run build` → `dist/natur-labor.html` (Doppelklick).
