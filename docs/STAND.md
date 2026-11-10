# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 40 Zeilen.

## Zuletzt gemacht
- Etappe 3 fast fertig: `gameplay/rezepte` (Herstellen), `gameplay/rohstoffe` (Abbau, Werkzeug, Nachwachsen), `gameplay/hand` (in die Hand, Haltbarkeit); `inventar` 1.1 (`setzeDaten`), `welt-dinge` 1.1 (`wirf` mit daten)
- Testwelt: 🔨 Axt/Hacke herstellen, Platz antippen = in die Hand (nochmal = ablegen), schneller fällen, Bäume/Felsen wachsen nach (`games/testwelt/js/sachen.js`)

## Läuft / kaputt
- Alles grün (Engine-Tests, Build, Smoke)

## Nächster Schritt
- Etappe 3 Rest: `ui/hud` + `ui/menue` als Engine-Module (die Leiste in sachen.js ist noch Handarbeit), Türen/Truhen, Werkbank als Station
- oder Etappe 2: Welt verändern (`world/welt-aenderung`) – abgebaute Objekte dort einhängen statt in sachen.js

## Entscheidungen
- Im Repo zählen nur Spiele und Tests
- Mehrspieler: noch kein Netzwerk; Regeln dafür stehen in `docs/ENGINE-FAHRPLAN.md` („Fundament für Mehrspieler“)
- Lose Dinge stoßen nicht untereinander zusammen (billig, reicht); Figuren-Kollision ist weich (0.5)
- Werkzeug ist in der Testwelt nie Pflicht (nur schneller) – sonst hängen alte Spielstände ohne Steine fest; `noetig` gibt es in der Engine trotzdem
- Spielzeit für Nachwachsen = Tage als Kommazahl (`uhr.tag + uhr.stunde / 24`)

## Ideen-Parkplatz
- Sammelspiel mit den Voxel-Tieren (Draufsicht, Tiere freischalten)
