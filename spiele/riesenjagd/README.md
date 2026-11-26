# 🪝 Riesenjagd

Eigenes Spiel im Wald der Riesen (Stimmung wie Dämmerwald, PS2-Look): 95–140 m hohe Urwaldbäume, dazwischen streifen
ein **Moostroll** (≈ 23 m) und ein **Zyklop** (≈ 31 m). Man schwingt sich mit Seil-Haken von Stamm zu Stamm (Attack on Titan),
klettert an den Riesen hoch (Shadow of the Colossus) und ruft große Zauber (Dragon's Dogma).

## So spielt man
- **Haken** 🪝 (E / Q): Ziel in der Mitte anpeilen (Zielhilfe sucht Stämme und Riesen), tippen = schießen, halten = Seil einholen (kostet Gas).
  Ohne Halten schwingt man frei am Seil. **Springen** (Leertaste) löst das Seil. Nochmal Haken = neuer Haken, der alte löst sich.
- **Klettern**: in einen Riesen fliegen oder sich an ihn heranziehen → man hält sich fest. Stick = klettern (oben = Richtung Kopf),
  Festhalten kostet **Ausdauer**, Schütteln kostet viel (still halten hilft). Leer = abrutschen. Springen = abspringen.
- **Runen** = Schwachpunkte: Nacken, beide Kniekehlen, beim Zyklop das Auge. **Angriff** ⚔ (F) halten = Stich laden, loslassen = zustechen.
  Kniekehlen zweimal hart getroffen → der Riese bricht in die Knie, der Nacken kommt runter.
- Im Vorbeiflug an einer Rune Angriff drücken = **Nackenschnitt** (Schaden wächst mit dem Tempo). Am Boden: Schlag gegen die Beine.
- **Sternenfall** ☄ (R) halten = laden (Zielkreis; peilt Riesen im Blick automatisch an), loslassen = ein Stern stürzt herab: Schaden + Taumeln.
  Achtung, er trifft auch dich (< 9 m). Abklingzeit 9 s.
- Riesen: Hieb mit der Faust, Stampfer mit Druckwelle, Abschütteln, Brüllen. Gefallene Riesen werden nach 14 s durch neue ersetzt.

Handy: links Stick, rechts wischen = umsehen, zwei Finger = Zoom, Knöpfe 🪝 ⚔ ☄ ⤒ unten rechts.

## URL
`?ort=start|troll|zyklop|ruecken` (ruecken = direkt unter der Nacken-Rune des Trolls) · `?q=niedrig|mittel|hoch` (Handy startet auf `niedrig`) ·
`?splats=0` · `?psx=0` (ohne PS2-Look) · `?test=1` (ohne Titel, setzt `window.riesenjagd.bereit`) · `?debug` (fps, Calls, Dreiecke, Splats).

## Aufbau (`js/`)
| Datei | Aufgabe |
|---|---|
| `main.js` | Verdrahtung: Renderer + PS2-Look (`engine/render/psx`), Licht/Dunst, Eingabe, Zielen, Kampf-Ereignisse, Klang, HUD |
| `welt.js` | Boden, Riesenbäume (`engine/models/natur/riesenbaum`, nah/fern-LOD), Wurzeln begehbar, Laub-Splats, Bäume/Felsen/Farne als Maßstab, Stamm-Kollision + Haken-Strahl |
| `haken.js` | reine Seil-Physik (Pendel, Einholen, Luftsteuerung), Strahl gegen Stamm, Stammprofil – getestet in `tests/riesenjagd-haken.test.mjs` |
| `held.js` | Held: Boden/Luft/Klettern, Haken, Ausdauer/Gas, Angriffe; Figur aus `character-model` + `character-animator` |
| `riese.js` | Riesen aus verbeulten Fels-Kapseln an einem Knochen-Gerüst: Gang, Angriffe, Knien, Taumeln, Tod; Kapseln = Kletterfläche + Trefferzone; Runen |
| `effekte.js` | Partikel (Staub, Glut, Gas, Blut), Druckwellen-Ringe, Lichtblitz, Großzauber „Sternenfall“ |

## Prüfen
`node --test tests/riesenjagd-haken.test.mjs` · `node tools/bild.mjs riesenjagd --query "?ort=troll&test=1&q=niedrig" --warte 15000`
