# Erde-Labor: Überleben, Bauen, Tiere, Herstellen

> Ziel (Goi): ein Spiel à la Valheim/Enshrouded auf dem Planeten im Erde-Labor (`labore/erde`). Die Welt (Geologie, Klima, Wetter,
> Natur, Graben, Ernte) steht. Jetzt kommt das Spiel darauf: überleben, Tiere jagen, Dinge herstellen, eine Hütte bauen.
> Ausprobieren: `https://oitow.github.io/pag/labore/erde/?ort=wald` → „Gehen“.

## Andocken
Jedes Modul ist eine Datei `labore/erde/js/<name>.js` mit `create<Name>(welt)`. Der Vertrag (Felder von `welt`, Rückgabe des Moduls)
steht oben in `labore/erde/js/erweiterungen.js`. **planet.js fasst kein Modul an** – höchstens der Zusammenführ-Schritt.
Reine Logik (ohne THREE, mit Test) gehört nach `engine/gameplay/…`, wenn sie auch woanders taugt, sonst als `labore/erde/js/<name>-regeln.js`
mit Test in `tests/erde-<name>.test.mjs`. Höchstens ~5 Tests je Modul.

Floating Origin: Die Kamera steht im Ursprung. Eigene Meshes in `welt.anker` hängen und mit **absoluten Planetenkoordinaten** setzen
(`welt.bodenPunkt(richtung)`); „oben“ an einem Punkt p ist `p.clone().normalize()`. Ausrichten: `mesh.quaternion.setFromUnitVectors(Y, oben)`
und dann um `oben` drehen. Größen in Metern, Mensch 1,8 m.

## Dienste (welt.dienste) – nur über diese reden Module miteinander, jeder Aufruf optional (`?.`)
| Dienst | Anbieter | Funktionen |
|---|---|---|
| `ueberleben` | Überleben | `schaden(n, grund)`, `heile(n)`, `iss(id) → bool`, `leben`, `tot` |
| `bau` | Bauen | `waermeBei(p) → °C` (Lagerfeuer in der Nähe), `unterDach(p) → bool`, `naheStationen(p, r=4) → ['lagerfeuer','werkbank','schmelzofen','amboss',…]`, `hindernisse(p, r) → [{x,y,z,r}]` |
| `tiere` | Tiere | `nahe(p, r) → [{art, pos, leben}]` |
| `herstellen` | Herstellen | `kleidungWaerme() → °C` (getragene Kleidung), `traegt(id) → bool` |

## Gegenstände (IDs im engine-Inventar)
Gibt es schon (Ernte/Graben): holz, rinde, ruten, stoecke, beeren, fasern, schilf, moos, laub, pilz, steinpilz, fisch, kokosnuss, oliven,
kaktusfleisch, steine, schieferplatten, wolle, flechten, eisenerz, kupfererz, kohle, gold, salz, feuerstein, quarz, ammonit, erde, lehm, sand,
Werkzeuge axt, schaufel, spitzhacke, eisenhacke.
Neu:
- Tiere: `fleisch`, `fell`, `knochen` (Fische: `fisch` gibt es schon)
- Herstellen: `seil`, `speer`, `fackel`, `fellmantel`, `fellstiefel`, `gebratenesFleisch`, `gebratenerFisch`, `beerenbrei`, `pfeil`, `bogen`
- Bauen (als Bausatz im Inventar oder direkt aus Rohstoffen – entscheidet das Bau-Modul): `lagerfeuer`, `werkbank`
- Schmiede (Fortschritt): `holzkohle`, `kupferbarren`, `eisenbarren`, `naegel`, `kupferaxt`, `kupferhacke`, `eisenaxt`, `eisenspeer`;
  Bauteile `schmelzofen`, `amboss`, `eisentuer`

## Fortschritt Stein → Kupfer → Eisen (Valheim-artig)
Stationen (`dienste.bau.naheStationen`): `schmelzofen` (Holzkohle, Barren; glüht, wärmt wie ein Feuer), `amboss` (Nägel);
gedachte Station `schmiede` = Werkbank + Amboss (alles Metall-Werkzeug). Stufen in `herstellen-daten.js` (`HACKE`, `AXT`, `FUND_STUFE`):
| Stufe | Spitzhacke | schafft |
|---|---|---|
| 2 | `spitzhacke` (Stein) | Sand-/Kalkstein, Schiefer, Kohle, Erzbrocken → **Kupfererz** |
| 3 | `kupferhacke` | Granit, Basalt, **Eisenerz** (Funde und Erzbrocken) |
| 4 | `eisenhacke` | **Gold**-Funde |
Axt: `axt` 1 · `kupferaxt` 2 · `eisenaxt` 3 → ×1 / ×1,3 / ×1,6 Holz je Baum. Testschalter: `?schmiedetest=1` (Schmiede-Ecke 6 m vor dem
Spieler), `=2` bzw. mit `?herstellen=offen` (alle Stationen ≤ 4 m); mit `?test=1&tasche=voll` auch Barren, Holzkohle, Baustoffe.

## Module
1. **Überleben** (`ueberleben.js`): Leben, Hunger, Durst, Körperwärme. Wärme aus Lufttemperatur `welt.zw.tJetzt`, Wind/Regen/Schnee
   (`welt.zw.wetter`), nass im Wasser, Nacht, Kleidung, Lagerfeuer, Dach. Essen per Knopf „🍖 Essen“ (bestes Essen aus der Tasche),
   Trinken mit „Nehmen“ auf Wasser oder im Wasser. Zu kalt/hungrig/durstig → Leben sinkt; tot → am Startpunkt aufwachen, Tasche halb weg.
   HUD-Zeile mit Balken. Zeit läuft mit dem Zeitraffer (`zw.tempo`), Werte sollen in Spielstunden sinnvoll sein (Hunger leer nach ~2 Spieltagen).
2. **Bauen** (`bauen.js`): Bau-Modus „🔨 Bauen“: Teil wählen (Fundament, Boden, Wand, Wand mit Tür, Dach schräg, Treppe, Lagerfeuer, Werkbank),
   Vorschau (grün/rot) vor dem Spieler, ausgerichtet an „oben“, an anderen Teilen einrastend (2-m-Raster), Kosten aus der Tasche,
   Abreißen gibt die Hälfte zurück. Lagerfeuer brennt (Licht + Partikel), wärmt. Teile sind fest (Kollision über `dienste.bau.hindernisse`),
   gespeichert im Spielstand. Optional: einfache Statik (Teile ohne Halt fallen nicht; ohne Fundament höchstens 3 Teile hoch).
3. **Tiere** (`tiere.js`): Wild je Biom um den Spieler (Reh, Hase, Keiler, Wolf; im Wasser gibt es schon Fische), seedbar je Gebiet,
   nur im Umkreis ~150 m aktiv, InstancedMesh (engine `wolf`, `keiler`; Reh und Hase als neue Low-Poly-Modelle). Verhalten: grasen,
   wandern, fliehen vor dem Spieler (Reh, Hase), Keiler greift an, wenn man zu nah kommt, Wolf jagt nachts im Rudel.
   Jagen: „Nehmen“ auf ein Tier = Schlag (Axt/Speer), Fleisch, Fell, Knochen. Schaden am Spieler über `dienste.ueberleben.schaden`.
4. **Herstellen** (`herstellen.js`): Knopf „🧰 Herstellen“ öffnet eine Liste der Rezepte (engine `rezepte`), grau, was fehlt.
   Stationen aus `dienste.bau.naheStationen` (Braten nur am Lagerfeuer, Bogen nur an der Werkbank). Kleidung anziehen (Fellmantel +8 °C).

## Zuständigkeit
Je Modul ein Agent und nur die eigenen Dateien. Die eine Zeile in `erweiterungen.js` ist schon da. `index.html`, `planet.js`, `README.md`
ändert nur der Zusammenführ-Schritt (Claude-Hauptsitzung). Prüfen: `node --test tests/erde-*.test.mjs`, `node tests/smoke.mjs erde`,
Bild: `node tools/bild.mjs labore/erde/index.html --query "?test=1&ort=wald" --warte 12000` und **ansehen**.
