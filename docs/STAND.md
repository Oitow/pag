# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- Kampfsystem fürs spätere MMO (Bauplan `docs/KAMPF-SYSTEM.md`): Engine `gameplay/kampf-werte`, `zustaende`, `bedrohung`, `kampf`, `nahkampf`(+daten), `faehigkeiten`(+daten), `ui/kampf-leiste`, `ui/ziel-rahmen`; `zauber-daten` 1.1 (element)
- Figuren-Labor: Reiter ⚔ Kampf – Kombos (F tippen/halten), Block/Parade (B/🛡), Ausweichen mit Unverwundbarkeit (Q), Rivale mit KI, Trainingspuppe mit DPS, MMO-Leiste (Krieger/Magier/Heiler, GCD, Wirkzeit), Ziel-Rahmen; `?kampf=1`
- Startseite in Spiele / Labore gegliedert

## Läuft / kaputt
- Alles grün (618 Tests, Smoke 5 Spiele); Handy-Layout einmal per Screenshot geprüft
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
