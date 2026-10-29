# Wurzelwerk – Spec Runde 1 (verbindlich)

Basis: `wurzelwerk.md` (Konzept) + `wurzelwerk-feedback.md` (Schwächen: Scope, Balance, Grafik).
Ziel Runde 1: **klein, rund, schön lesbar**. Lieber 5 Dinge gut als 15 halb.
Zahlen stehen hier bewusst NICHT drin → Parameter-Liste in §6, Werte setzt der Balance-Agent.

## 1. Scope

### Rein
- 1 Baum (ein Stamm), Querschnitt-Ansicht Portrait: Himmel/Äste oben, Stamm Mitte, Boden unten
- 2 Rohstoffe: **Wasser**, **Mineral**; Stein-Felder als Hindernis
- Wurzeln mit Durchsatz-Limit + Rot-Glühen bei Engpass
- 3 Früchte: Dornenbeere, Sporenkapsel, Honigblüte
- 3 Schädlinge: Blattlaus, Käfer, Krähe + 1 Mini-Boss in der letzten Welle (Holzwurm, vereinfacht)
- 8 Wellen, 6 Mutationen, Wahl 1-aus-3 nach jeder Welle (außer letzter)
- Run-Ende-Screen mit 3 Kennzahlen, Neustart-Button
- Einfache Sounds per WebAudio (Wachsen, Treffer, Welle, Mutation) – je ein synthetischer Klang
- Best-Run in localStorage (nur eine Zahl: erreichte Welle / Sieg)

### Explizit raus (nicht anfangen!)
Meta-Progression/Samen, Saaten, Jahreszeiten, Herbarium, Kompost, Engerling/Raupe, Doppelkrone,
Schwierigkeitsstufen, Daily Seed/Teilen, Speichern mitten im Run, Zoom/Kamera-Scroll, Partikel-Overkill.

### Entscheidungen zu den offenen Fragen
| Frage | Entscheidung |
|---|---|
| Echtzeit oder Pause? | **Aufbau-Phase pausiert** (kein Timer), Kampf-Phase Echtzeit ohne Eingabe-Pflicht. Bauen auch im Kampf erlaubt. |
| Raster? | **Tile-Grid** im Boden und im Luftraum. Wurzel/Ast = Kette von Tiles, wächst nur orthogonal/diagonal zum Nachbar-Tile. |
| Kosten? | **Nur Nährstoffe**, Wachstum sofort mit kurzer Wachs-Animation (Juice, keine Wartezeit). |
| Max. Äste/Früchte? | Harte Obergrenzen (Parameter), Luft-Grid ist klein genug, dass der Screen lesbar bleibt. |
| Kampf-Lesbarkeit? | Max. gleichzeitige Gegner gedeckelt; Gegner = große, klare Silhouetten mit Farbcode; Schaden als kurze Zahlen nur bei Boss. |
| Optik? | **Vektor-Silhouetten, flach** (Canvas-Formen, 1 Palette, weiche Schatten). Kein Pixel-Art, keine Bilddateien. |
| Daily Seed? | Raus für Runde 1. Run-Seed intern trotzdem nutzen (Debug/Balance). |

## 2. Ablauf eines Runs (Ziel 8–12 Min)

1. **Start** (Titel → „Pflanzen“-Button): Stamm + 1 Startwurzel + 1 Startast stehen, Start-Nährstoffe vorhanden.
2. **Aufbau-Phase** (pausiert): Spieler baut Wurzeln/Äste, setzt Knospen. Button „Welle starten“ unten.
3. **Kampf-Phase** (Echtzeit): Schädlinge spawnen links/rechts (Boden) bzw. oben (Krähe), laufen zum Stamm.
   Früchte feuern automatisch. Nährstoffe fließen weiter, Bauen erlaubt. Welle endet, wenn alle Gegner tot.
4. **Belohnung**: Nährstoff-Bonus + Mutationswahl 1-aus-3 (Karten, ein Tipp).
5. Zurück zu 2. Insgesamt 8 Wellen.
6. **Welle 8 = Holzwurm-Boss** + Begleiter.
7. **Ende**: Stamm-HP 0 → Niederlage; Boss tot → Sieg. Screen: erreichte Welle, Gegner besiegt,
   max. Durchsatz; Button „Neuer Baum“.

Wellen-Einführung (Inhalt fest, Mengen = Balance):
- W1: nur Blattläuse (fast unverlierbar) · W2: mehr Blattläuse · W3: erster Käfer
- W4: erste Krähe · W5–7: Mix, steigend · W8: Boss + Mix

## 3. Regeln

### Nährstoffe & Wurzeln
- Boden-Grid; Tiles: Erde (leer), Wasser-Quelle, Mineral-Quelle, Stein (unbebaubar).
- Quellen sind unendlich, liefern aber nur, wenn ein Wurzel-Tile darauf/angrenzend liegt.
- Tipp auf Boden-Tile neben bestehender Wurzel → neues Wurzel-Tile (Kosten).
  Tipp weiter weg → Pfad vom nächsten Wurzel-Tile wird als Vorschau gezeigt; zweiter Tipp bestätigt.
- Fluss: jede Quelle schickt Ertrag/s entlang des kürzesten Wurzelpfads zum Stamm.
  Jedes Wurzel-Tile hat Durchsatz-Limit; Überlast → Tile glüht rot, Überschuss geht verloren.
- **Verdicken**: Tipp auf bestehende Wurzel → Stufe +1 (mehr Durchsatz, sichtbar dicker). Max-Stufe = Parameter.
- Stamm sammelt Wasser und Mineral getrennt (zwei Zähler).

### Äste & Früchte
- Luft-Grid über dem Stamm. Tipp neben bestehendem Ast → neues Ast-Tile (Kosten steigen mit Höhe).
- Tipp auf Ast-Ende → **Knospe**: 3 Fruchtkarten erscheinen (in R1 immer dieselben 3), Wahl kostet Nährstoffe.
- Pro Ast-Ende max. 1 Frucht. Frucht-Reichweite wächst mit Höhe des Tiles.
- Frucht braucht ihren Nährstoff-Mix; fehlt er im Stamm-Vorrat, feuert sie langsamer (nie gar nicht).

| Frucht | Mix | Effekt |
|---|---|---|
| Dornenbeere | v. a. Mineral | Einzelschuss-Projektil auf nächsten Gegner in Reichweite |
| Sporenkapsel | v. a. Wasser | Gift-Wolke an Zielposition, Schaden über Zeit in Radius |
| Honigblüte | Wasser + Mineral | kein Angriff; erzeugt Nährstoffe/s (Produktion) |

### Schädlinge
| Name | Weg | Verhalten |
|---|---|---|
| Blattlaus | Boden L/R | schwach, schnell, kommt im Schwarm |
| Käfer | Boden L/R | langsam, viel HP, Panzer = flache Schadensreduktion pro Treffer (Gift ignoriert Panzer) |
| Krähe | Luft, oben | fliegt direkt zum Stamm, schnell, wenig HP |
| Holzwurm (Boss) | Boden, Mitte unten | taucht aus dem Boden, frisst sich durch Wurzel-Tiles zum Stamm (zerstört sie), viel HP |

- Gegner am Stamm verursachen Schaden/s an Stamm-HP. Stamm-HP regeneriert nicht im Kampf, teilweise in Aufbau-Phase.

### Mutationen (6, Pool ohne Duplikate, 1-aus-3)
| # | Name | Tag | Effekt |
|---|---|---|---|
| 1 | Wanderwurzel | Boden | Nach jeder Welle wächst automatisch 1 Wurzel-Tile Richtung nächster ungenutzter Quelle |
| 2 | Kettenfrucht | Frucht | Dornenbeeren-Projektile springen auf weitere Ziele |
| 3 | Symbiose-Pilz | Boden | Jede Wurzel-Kreuzung (≥3 Nachbarn) erzeugt Nährstoffe/s |
| 4 | Fallobst | Frucht | Getötete Gegner in Reichweite einer Frucht lassen eine Explosion am Boden zurück |
| 5 | Echowurzel | Boden+Frucht | Feuerrate einer Frucht steigt mit dem aktuellen Gesamt-Durchsatz |
| 6 | Dornenrinde | Stamm | Gegner am Stamm erleiden Schaden/s |
- Synergie: Karte zeigt Tag-Icon; hat Spieler schon eine Mutation mit gleichem Tag → Karte leuchtet („passt!“). Keine Zahlen-Boni dafür in R1.

## 4. UI / HUD (Portrait, Daumen-Zone unten)
- **Oben:** Stamm-HP-Balken · Wellen-Anzeige „3/8“ · Pause-Icon
- **Unten:** Nährstoff-Zähler Wasser (blau Tropfen) + Mineral (grau Kristall) mit +x/s · großer Button „Welle starten“ (nur Aufbau)
- **Am Baum:** Wurzel-Dicke = Stufe, Rot-Glühen = Engpass, fließende Punkte = Fluss; Reichweiten-Kreis beim Antippen einer Frucht
- **Vorschau:** vor jeder Bestätigung Geister-Tile + Kosten direkt am Finger; zu teuer = rot
- **Mutationen:** kleine Icon-Leiste rechts oben, Antippen = 1-Zeilen-Erklärung
- **Feedback/Juice:** Wachs-Animation (Ast/Wurzel „schießt“ raus), Treffer-Blitz, Stamm wackelt bei Schaden, Bildschirm-Tönung bei Welle-Start
- Grafik-Regeln: max. 6 Hauptfarben, Hintergrund ruhig (Verlauf Himmel/Erde), Gegner kontrastreich; alles Canvas-Formen

## 5. Onboarding (erste 30 Sek., keine Text-Wand)
- Kein Tutorial-Screen. Max. 1 kurze Zeile + pulsierende Hand gleichzeitig.
1. 0–5 s: Hand zeigt auf Wasserquelle neben Startwurzel: „Tippe – Wurzel wächst“. Nach Tipp: Fluss-Punkte sichtbar, Zähler zählt hoch.
2. 5–15 s: Hand zeigt auf Ast-Ende: „Knospe setzen“ → Karten, Dornenbeere vorgehoben.
3. 15–20 s: Hand zeigt auf „Welle starten“.
4. Welle 1: Blattläuse kommen, Beere schießt automatisch → Erfolgserlebnis.
5. Erstes Rot-Glühen (später): einmalig Hinweis „Zu eng! Tippe auf die Wurzel zum Verdicken“.
6. Erste Mutationswahl: Karten erklären sich selbst (Icon + 1 Satz). Hinweise werden nur einmal gezeigt (localStorage-Flag).

## 6. Balance-Parameter (Werte: Balance-Agent)
- **Grid:** Bodengröße, Luftgröße, Anzahl/Verteilung Wasser-/Mineral-Quellen und Steine
- **Ökonomie:** Start-Nährstoffe, Quellen-Ertrag/s, Wurzel-Kosten, Verdick-Kosten je Stufe, Max-Stufe, Durchsatz je Stufe, Ast-Kosten + Höhen-Faktor, Frucht-Kosten, Wellen-Belohnung
- **Limits:** max. Äste, max. Früchte, max. gleichzeitige Gegner
- **Früchte:** Schaden, Feuerrate, Reichweite (+ Höhen-Bonus), Nährstoffverbrauch/Schuss, Malus bei Mangel; Gift-Radius/-Dauer; Honig-Ertrag
- **Schädlinge:** HP, Tempo, Schaden/s am Stamm, Panzerwert, Schwarmgröße; Boss-HP, Wurzel-Fress-Tempo
- **Wellen:** Gegneranzahl/-mix je Welle, Spawn-Intervall, Skalierung pro Welle
- **Stamm:** Max-HP, Regeneration in Aufbau-Phase
- **Mutationen:** Ketten-Sprünge/-Schaden, Symbiose-Ertrag, Fallobst-Schaden/-Radius, Echo-Faktor, Dornenrinde-Schaden, Wanderwurzel-Tiles
- **Ziel-Metriken:** Run-Dauer 8–12 Min, Erst-Sieg nach ~3–5 Runs, W1–2 praktisch unverlierbar

## 7. Abnahme Runde 1
- Läuft als eine `games/wurzelwerk/index.html`, 60 FPS Android, nur Touch.
- Neuer Spieler versteht Wurzel → Fluss → Frucht ohne Erklärung in < 30 s.
- Engpass wird bemerkt und gelöst; mindestens 2 unterschiedliche Sieg-Strategien möglich.
