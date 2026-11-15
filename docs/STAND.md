# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- Großzauber (Bauplan `docs/KAMPF-SYSTEM.md` unten): Kern `gameplay/grosszauber` (Welt-Adapter: Wände, Gräben, Fluten) + `render/grosszauber-mesh`;
  🌊 Flutwelle, 🧱 Erdwall, ⛈️ Zyklon, 🌋 Erdriss (je Logik + Ansicht), Zauber-Art `'gross'` (zauber 2.1, zauber-daten 1.2), Klänge grollen/rauschen/heulen/bersten
- Figuren-Labor: Schlachtfeld 160 m (`?schlachtfeld=1`), Große Plage ~400 Ratten (`?grossplage=1`), Zeitlupe + Kamera-Auszug + Blitz beim Großzauber, Shift+1–4
- Davor: Kampfsystem (kampf-werte, zustaende, bedrohung, kampf, nahkampf, faehigkeiten, kampf-leiste, ziel-rahmen) im Figuren-Labor

## Läuft / kaputt
- Alles grün (636 Tests, Smoke 5 Spiele); Flutwelle + Erdriss im Bild geprüft, Erdwall/Zyklon nur von ihren Agenten
- Großzauber zielen per Auto-Ziel – steht der Gegner direkt am Spieler, entsteht die Wand auf dem Spieler; Zeitlupe verlängert die Wirkzeit
- 400 Ratten nur im Software-Renderer, nicht auf echtem Handy gemessen
- Nicht abgestimmt: Vorwärtsschritt/Ansturm-Tempo, Parade-/Ausweich-Gefühl gegen den Rivalen (nur Logik getestet)
- Meldung „−6 Leben“ überlappt am Handy kurz den Spieler-Rahmen
- Bekannt (alt): Truhe durch Schuppenwand, Gelände-Raster 2 m, Viniland noch eigene `js/psx.js`

## Nächster Schritt
- Kampf im Browser abstimmen (Tempo, Treffer-Stopp, Rivale fairer/härter), dann Testwelt: Gegner im Wald nutzen `kampf`
- MMO-Fundament: stabile Entitäts-IDs + Befehls-Schicht (`kampf.schade`/`leiste.nutze` als Befehle mit Prüfung), Schnappschüsse von `kampf.zustand()`
- Mehr Waffen-Fähigkeiten (Bogen/Fernkampf), Gruppen-Heilung, Rollen-Talente

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
