# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- Neues Spiel **games/enklave** (Bauplan `docs/WELT-ENKLAVE.md`): Tutorial-Tal (16 Schritte, automatisiert komplett durchgespielt), Pfad ~540 m mit Wegweisern/Brücke/Aussicht,
  ummauerte Stadt mit 29 NPCs, Tag/Nacht, Rauch/Glühwürmchen, Ambiente-Klang, Asset-Galerie `games/enklave/galerie.html`
- Engine neu: `world/welt-plan`(+formen), `models/bau/*` (35 Assets), `gameplay/aufgaben`, `ui/aufgaben-anzeige`, `models/character/character-lod`; klang 1.2, character 1.4
- Davor: Figuren-Labor (Kampf, Großzauber, Schlacht-Modus, Qualitätsstufe)

## Läuft / kaputt
- Alles grün (717 Tests, Smoke 6 Spiele inkl. enklave, Build dist/enklave.html)
- Draw-Calls Enklave: Tal ~138, Stadt ~129 (Ziel ≤ 120) – Hauptposten Bäume + volle Figuren; Handy nicht auf echtem Gerät gemessen
- Ambiente-Klang nur per Test geprüft, nicht angehört; Wegweiser-Texte nicht im Bild geprüft; Tor-Zustand nach Tutorial-Ende nicht direkt abgefragt
- enklave/js/figur.js + menue.js sind Kopien aus der Testwelt (≥ 2 Spiele → in die Engine befördern)
- Bekannt (alt): Truhe durch Schuppenwand, Viniland eigene psx.js, Rivalen-Treffer zählen nicht in der Schlacht-Statistik

## Nächster Schritt
- Enklave am Handy spielen; Draw-Calls unter 120 (Bäume zusammenfassen/LOD, Schatten nur nah)
- Spieler-Figur + Pause-Menü in die Engine befördern (testwelt + enklave), Innenräume/Dialoge, erste Quests in der Stadt
- MMO-Fundament: Entitäts-IDs + Befehls-Schicht, dann Netzwerk-Prototyp (zwei Spieler in der Enklave)

## Entscheidungen
- Geplante Gebiete per `welt-plan` als worldgen-Stufen (deterministisch, Seed fest) statt zufällig gefundener Orte; Plan-Daten gelten nur für ihren Seed
- Ferne Figuren als ein InstancedMesh (`character-lod`), nah höchstens 3 volle Figuren
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
