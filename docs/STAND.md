# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 35 Zeilen. Dauerhafte Festlegungen: `docs/ENTSCHEIDUNGEN.md`.

## Zuletzt gemacht
- **Erlenwacht wird ein MMO** (Branch erlenwacht-mmo, Bauplan `docs/ERLENWACHT-MMO-PLAN.md`, 6 Agents parallel, je ≤ 5 Tests):
  - Titel → Held erstellen (Name, Klasse, Figur-Editor mit Live-Vorschau) → Spiel; Autospeichern alle 30 s, Fortsetzen
  - Fortschritt: Stufe 1–15, Talentbaum je Klasse, Beute (4 Seltenheiten, Affixe), Beutel am Boden, Auto-Aufheben, Ausrüstung 6 Sockel
  - Kampf: ⚔ Kombo-Nahkampf, Bogen; Krieger/Waldläufer je 5 Fähigkeiten, Magier = Zauber nach Stufe freigeschaltet
  - Gegner: Wolf, Keiler, Irrlicht, Lager-Stufen je Region, Boss Grauzahn (Phasen, Rudelruf, Warn-Ring) am Wolfsfels
  - Tutorial: 6 Aufgaben, NPCs Alwe (Strand) + Brandt (Siedlung), Dialog, Verfolger, Wegpunkt-Säule
  - Oberfläche: Spieler-/Ziel-Rahmen, Minikarte + große Karte, Chat mit Kanälen + Befehlen, Menü (Charakter, Inventar, Talente, Karte, Optionen, Entwickler)
  - Welt v2: Rand ins Meer/Gebirgskette, Fluss mit Furt, neue Orte, Fernwald-Impostoren (1 Call)

## Läuft / kaputt
- `npm test` grün (813 Engine-Tests, Smoke 8 Spiele); Bilder hochkant angesehen: Titel, Start (Alwe, Verfolger), Hochland (Wölfe/Keiler im Kampf), Wolfsfels – keine Konsolen-Fehler
- NICHT geprüft: echtes Handy (Bildrate, Touch-Layout mit Stick + Leiste bei 228 px), Fortsetzen/Laden eines Spielstands, Trank benutzen, ganze Quest-Kette am Stück, `npm run build`
- Bekannt: Boss am Wolfsfels im Bild nicht zu sehen (Lage prüfen); Wölfe/Keiler etwas dunkel/plump; Irrlicht-Kern leuchtet nicht extra; Fluss kann auf grobem LOD schweben;
  modul-kampf 339 Zeilen (> 300); Chat zeigt beim Start abgeschnittenen Intro-Satz; alte Offene Punkte (Wurzeln begehbar, Abendgold) bleiben

## Nächster Schritt
- Am Handy spielen: Tutorial bis Brandt, Bildrate + Touch melden
- Boss-Platz + Licht am Wolfsfels prüfen, Tränke benutzbar machen (Inventar → ents.heile), Gegner-Materialien heller
- Netzwerk-Prototyp auf `entitaeten.aenderungenSeit` + `befehle` (echte Mitspieler im Chat)

## Ideen-Parkplatz
- SDF-Kreaturen und -Zauber, Splat-LOD nach Entfernung, Koloss-Silhouette fern zwischen den Stämmen
- Sammelspiel mit den Voxel-Tieren; Händler in Erlenwacht; Dungeons
