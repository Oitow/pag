# 🔎 Testen & Ansehen

## Tests
```
npm run test:schnell   # Engine-Tests + Katalog-Prüfung (Sekunden)
npm test               # + Daten-Tests der Spiele + Smoke im Browser
npm run build          # Einzeldateien nach dist/ (braucht esbuild)
```

## Ansehen (Pflicht bei allem, was man sieht)
```
node tools/bild.mjs <spiel> [--query "?ort=tor&test=1"] [--warte 8000] [--hoch] [--name x] [--fps]
```
Schreibt `test-results/bild-<name>.png` und meldet Konsolen-Fehler. **Bild danach öffnen und ansehen** – grüne Tests sagen nichts über Aussehen.
`--hoch` = Handy-Hochformat. Jede Szene braucht `?test=1` (Intro überspringen) und sinnvolle `?ort=`-Sprungmarken.
Headless läuft ein Software-Renderer: Bildrate dort ist kein Maßstab, Draw-Calls und Splat-Zahl schon.

## Cloud-Sitzung ohne Netz (kein `npm install` möglich)
Three.js und Playwright fehlen dann in `node_modules/`. So geht es trotzdem:
```
git clone --depth 1 --branch r170 --filter=blob:none --sparse https://github.com/mrdoob/three.js ../three-src
git -C ../three-src sparse-checkout set build
mkdir -p node_modules/three && ln -sfn "$(realpath ../three-src/build)" node_modules/three/build
echo '{"name":"three","version":"0.170.0","type":"module","module":"./build/three.module.js"}' > node_modules/three/package.json
ln -sfn /opt/npm-tools/node_modules/playwright node_modules/playwright     # falls dort vorhanden
```
Chrome: `tools/bild.mjs` nimmt `PAG_CHROME`, sonst Playwright-Chromium, sonst `/usr/bin/google-chrome`.
`npm run build` geht ohne esbuild nicht – das prüft dann die CI im Pull-Request (`.github/workflows/ci.yml`).
Wenn etwas nicht geprüft werden konnte: **in `docs/STAND.md` unter „Läuft / kaputt“ ehrlich hinschreiben**.
