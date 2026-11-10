# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- Fundament Figur ↔ Welt ↔ Dinge: `world/kollision`, `gameplay/koerper`, `welt-dinge`, `interaktion`, `inventar`, `core/ereignisse`, `register`, `raum-gitter`, `schnappschuss-puffer`; Motor 1.2
- Testwelt: Kisten, Gegenstände aufheben/ablegen, Bäume fällen (`games/testwelt/js/sachen.js`)

## Läuft / kaputt
- Alles grün (Engine-Tests, Build, Smoke)

## Nächster Schritt
- Fahrplan Etappe 3 Rest: Rezepte, Nachwachsen, Gegenstände in die Hand (Axt nötig zum Fällen)
- oder Etappe 2: Welt verändern (`world/welt-aenderung`) – abgebaute Objekte dort einhängen statt in sachen.js

## Entscheidungen
- Im Repo zählen nur Spiele und Tests
- Mehrspieler: noch kein Netzwerk; Regeln dafür stehen in `docs/ENGINE-FAHRPLAN.md` („Fundament für Mehrspieler“)
- Lose Dinge stoßen nicht untereinander zusammen (billig, reicht); Figuren-Kollision ist weich (0.5)

## Ideen-Parkplatz
- Sammelspiel mit den Voxel-Tieren (Draufsicht, Tiere freischalten)
