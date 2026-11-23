# Module: Labor → Testfeld → Spiel

> Wie ein Feature vom ersten Versuch ins echte Spiel kommt. Gilt für jede KI (Claude, Gemini, …) gleich.
> Wer gerade woran arbeitet: [`ARBEIT.md`](ARBEIT.md). Modul-Verträge (APIs, Weltkarte): [`plaene/ERLENWACHT-MODULE.md`](plaene/ERLENWACHT-MODULE.md).

## Die drei Stufen

```
engine/<schicht>/…          Bausteine (reine Logik, Modelle, Render, UI) – je mit Test daneben
        │
engine/spiel/modul-x.js     Spiel-Modul: steckt Bausteine zu einem Feature zusammen
        │
  ① labor     testfeld/?nur=x        Modul allein (+ nur was es zwingend braucht). Plus ggf. ein Labor in labore/
  ② testfeld  testfeld/              mit allen anderen Modulen zusammen – hier wird zusammengeführt
  ③ spiel     erlenwacht/            das echte Spiel: nur Module auf dieser Stufe
```

Die Stufe steht an **einer** Stelle: `engine/spiel/module-register.js` (`stufe: 'labor' | 'testfeld' | 'spiel'`).
Erlenwacht lädt nur `spiel`, das Testfeld lädt `testfeld` + `spiel` (mit `?labor=1` auch `labor`).
Der Test `module-register.test.mjs` verhindert, dass ein Modul höher steht als ein Modul, das es `braucht`.

## Aufsteigen – wann darf ein Modul weiter?

**labor → testfeld**
- `testfeld/?nur=x&test=1` läuft ohne Konsolen-Fehler; Bild gemacht und angesehen (`node tools/bild.mjs testfeld --query "?nur=x&test=1"`)
- Bausteine haben Tests (`npm run test:schnell` grün), Modul-Kopf + `npm run katalog`
- läuft auch, wenn optionale Nachbarn fehlen (`?aus=…`)

**testfeld → spiel**
- `testfeld/?test=1` mit allen Modulen ohne Fehler, nichts anderes kaputt (`npm test` grün)
- am Handy gespielt (Goi sagt ok) – oder in `STAND.md` unter „nicht geprüft“ vermerkt
- `dispose()` räumt alles weg, Spielstand (`zustand`/`lade`) geht, falls das Modul etwas speichert

Absteigen geht genauso: Stufe zurücksetzen, wenn ein Modul im Spiel stört. Nichts wird kopiert – Spiel und Testfeld nutzen dieselben Dateien.

## Neues Modul anlegen (Kurzform)
1. In [`ARBEIT.md`](ARBEIT.md) eintragen (Modul, KI, Branch).
2. `engine/spiel/modul-x.js` nach Modul-Form aus `plaene/ERLENWACHT-MODULE.md`; Bausteine nach `engine/<schicht>/` mit Test.
3. In `engine/spiel/module.js` importieren und in `module-register.js` mit `stufe: 'labor'`, `titel`, `bausteine` eintragen.
4. `testfeld/?nur=x` ausprobieren → Stufe hochsetzen, wenn die Regeln oben erfüllt sind.

## Labore (`labore/`)
Ein Labor zeigt **Bausteine** einzeln, ohne Spiel drumherum – zum Gestalten und Feintunen:

| Labor | Zeigt | gehört zu Modul |
|---|---|---|
| `labore/figuren` | Figur, Animationen, Ausrüstung, Kampf, Zauber, Horden | spieler, kampf, zauber, gegner |
| `labore/natur` | Bäume, Felsen, Pflanzen, Riesenbaum, Splats | welt, riesenwald |
| `labore/welt` | Weltgenerator (Presets, Ebenen, Chunks) | welt |
| `labore/handwerk` | Dinge, Herstellen, Graben, Türen/Truhen, Dorf, Tag/Nacht | (noch kein Modul) |
| `labore/daemmerwald` | Startgebiet Riesenwald in echter Größe | riesenwald |
| `labore/enklave` | Startgebiet Stadt + Bau-Galerie | bewohner, (Gebäude) |

Fehlt (noch kein Labor/keine Ansicht): Kreaturen Wolf/Keiler/Irrlicht, Fortschritt/Beute, Tutorial, Oberfläche – die testet man über `testfeld/?nur=<modul>`.
