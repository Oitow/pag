# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- Aufmachung/Leistung/Ablauf im Figuren-Labor: Großzauber-Optik überarbeitet, Schlachtfeld mit Geländefarben/Bäumen/Gras/Ruinen + Abendlicht,
  Glas-Oberfläche (ein Spieler-Rahmen, Großzauber-Gruppe in der Leiste), `render/qualitaet` (automatische Stufe: Auflösung/Schatten/Partikel/Zahlen),
  Horde/Effekte/Zahlen/Schilder sparsamer, Spielablauf ⚔ Schlacht (`?schlacht=1`: 10 Wellen, Pausen mit Zusammenfassung, Macht-Leiste für Großzauber, Mehrfach-Kills, Boss, Ergebniskarten)
- Davor: Großzauber (Welle, Wand, Zyklon, Riss) + Kampfsystem

## Läuft / kaputt
- Alles grün (643 Tests, Smoke 5 Spiele); Flutwelle + Erdriss im Bild geprüft, Erdwall/Zyklon nur von ihren Agenten
- Zeitlupe verlängert die Wirkzeit
- 400 Ratten nur im Software-Renderer, nicht auf echtem Handy gemessen
- Nicht abgestimmt: Vorwärtsschritt/Ansturm-Tempo, Parade-/Ausweich-Gefühl gegen den Rivalen (nur Logik getestet)
- Meldung „−6 Leben“ überlappt am Handy kurz den Spieler-Rahmen
- Bekannt (alt): Truhe durch Schuppenwand, Gelände-Raster 2 m, Viniland noch eigene `js/psx.js`

- Engpass ist das Zeichnen (Schatten für viele Instanzen), nicht JS; Horde-Instanzen außerhalb des Blicks werden noch gezeichnet
- Rivalen-Treffer zählen nicht für Kombo/Schlacht-Statistik (laufen an `ablauf` vorbei)

## Nächster Schritt
- Auf echtem Handy spielen (Qualitätsstufen, 400 Ratten, Schlacht-Fluss), danach Horde-Sichtfeld-Auswahl + Klecks-Schatten statt echter Schatten für Ratten
- MMO-Fundament: stabile Entitäts-IDs + Befehls-Schicht; Testwelt bekommt Kampf/Großzauber

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
