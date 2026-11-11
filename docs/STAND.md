# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- PS1-Look aus Viniland in die Engine geholt: `render/psx` (`createPsx` → `wendeAn(szene)`, `aufloesung()`, `setze({ an })`), `himmel` 1.1 macht mit
- Figuren-Labor (☰ → Mehr → 🕹 PS1-Look) und Testwelt (☰ → Optionen: an/aus, Pixel-Zeilen, Wackeln) zeigen ihn, Standard = an
- Davor: Etappe 3 fertig (Türen, Truhen, Stationen, HUD, Menü) + Etappe 2 Kern (`world/welt-aenderung`)

## Läuft / kaputt
- Alles grün (Engine-Tests, Build, Smoke); neue Funktionen im Browser durchgespielt (Desktop + Handy-Format)
- Bekannt: Truhe lässt sich durch die Schuppenwand öffnen (Interaktion prüft keine Sichtlinie)
- Bekannt: Gelände-Raster ist 2 m – Löcher werden breit und flach (Pinsel 3 m Radius)
- Bekannt: Leisten-Plätze sind auf schmalen Handys ~36 px (8 Plätze + 🔨 in einer Reihe) – bei Bedarf zweizeilig
- PS1-Look: Viniland nutzt noch die eigene `js/psx.js` (nicht umgestellt); Regen/Zauber-Funken (eigene Shader) ohne Farbstufen; Kantenglättung wechselt erst nach Neuladen
- Unter dem Schuppen (Radius 5,6 m), auf Wegen und am Wasser kann man nicht graben (`welt-aenderung.sperreUmkreis`)

## Nächster Schritt
- PS1-Look abstimmen (Zeilen/Wackeln/Stimmung am Handy ansehen), danach Viniland auf `engine/render/psx` umstellen
- Etappe 2 Rest: `gameplay/bau-raster` + `models/bau/*` (Wand, Boden, Dach, Zaun – Tür-Logik steht), dafür Instanzen zur Laufzeit in `scatter-mesh`; `ui/werkzeug-leiste`
- oder Etappe 4: `audio/sfx` + `render/partikel` (Graben, Fällen, Tür hätten gern Geräusch und Staub)

## Entscheidungen
- PS1-Look liegt als Schicht über der Szene (Materialien werden gepatcht, nicht ersetzt) – Module müssen nichts davon wissen
- Im Repo zählen nur Spiele und Tests
- Mehrspieler: noch kein Netzwerk; Regeln dafür stehen in `docs/ENGINE-FAHRPLAN.md` („Fundament für Mehrspieler“)
- Lose Dinge stoßen nicht untereinander zusammen (billig, reicht); Figuren-Kollision ist weich (0.5)
- Werkzeug ist in der Testwelt nie Pflicht (nur schneller); Ausnahme Schaufel (liegt in der Truhe, Rezept an der Werkbank)
- Spielzeit für Nachwachsen = Tage als Kommazahl (`uhr.tag + uhr.stunde / 24`)
- `welt-aenderung` schreibt direkt in `welt.hoehe` (Adapter/Kollision sehen es sofort); vom Spiel vorbereitete Plätze per `festschreiben()` aus dem Spielstand halten
- UI-Module: alle Stile inline (Spiele haben eigene globale Knopf-Regeln), keine Timer – alles über `update(dt)`
- Abgebaute Bäume/Felsen bleiben bei `gameplay/rohstoffe` (wachsen nach); `welt-aenderung.entferneObjekt` ist für dauerhaftes Entfernen

## Ideen-Parkplatz
- Sammelspiel mit den Voxel-Tieren (Draufsicht, Tiere freischalten)
- Sichtlinien-Prüfung in `gameplay/interaktion` (Strahl aus `world/kollision`)
