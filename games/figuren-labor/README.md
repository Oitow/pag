# 🧍 Figuren-Labor

Testgelände für das Figuren-System der Engine (`docs/FIGUREN-SYSTEM.md`): Aussehen bearbeiten, herumlaufen, NPCs beobachten.

- ☰ Menü (Handy: Blatt von unten, großer Bildschirm: links) mit Reitern – die Figur rückt in den freien Bildteil
  - 👕 Aussehen: 17 Vorlagen, Zufalls-Looks (auch Kinder), alle Stile/Farben/Körperbau, Brille/Schal/Schmuck, Grund-Mimik live; wird im Browser gespeichert
  - ✨ Zauber: die 10 Zauber mit Beschreibung, Mana, Abklingzeit
  - 🗡 Ausrüstung (`character-ausruestung`): je Hand ein Gegenstand (Schild/Buch links)
  - 🎬 Aktionen: alle Clips aus `character-clips` (inkl. Zauber-Gesten) + Gesichtsausdrücke
  - ⚙️ Mehr: 🕹 PS1-Look an/aus, Kamera-Presets, Ich-Sicht, Kamerafahrt, NPCs, Namensschilder, Debug-Anzeige, unendlich Mana, „mich treffen“, alle heilen
- ✨ 12 schwere Zauber (`engine/gameplay/zauber` + `zauber-daten` + `engine/render/zauber-effekte`): Feuerball (Bogen, Brandboden), Eislanze (durchbohrt Reihen),
  Arkane Geschosse, Kettenblitz, Druckwelle, Erdstachel, Frostnova, Sog (zieht zusammen, dann Knall), Meteor (Krater), Heilung, Schutzschild, Blinzeln
  - **Halten = Aufladen**: die Figur holt aus und bleibt gespannt, wird langsam, Funken werden in die Hand gesaugt, Brummen steigt, Ziel-Kreis am Boden
  - **Weiter halten = Überladen** (goldener Balken): bis 1,6× Schaden, größerer Radius, mehr Geschosse/Kettenglieder
  - **Loslassen = Schlag**: Rückstoß, Staub, Kamera-Wackeln, kurzer Treffer-Stopp, Schadens-Zahlen, „☠ ×N“ bei Mehrfach-Kills; Rolle bricht ab (Mana zurück)
  - Auto-Zielen: Lock-On, sonst der dichteste Haufen (Flächenzauber) bzw. das beste Ziel im Blick, notfalls ringsum
- 🐀 Rattenplage (`engine/gameplay/horde`, `engine/render/horde-mesh`, `engine/models/kreaturen/ratte`): Wellen aus Ratten, Riesenratten und alle 5 Wellen ein Rattenkönig –
  sie umzingeln dich, springen an und beißen; Treffer schleudern sie durch die Luft. Fällt man, beginnt die Plage neu. `?plage=1` startet sofort
- ⚔ Kampf (Reiter „⚔ Kampf“, `docs/KAMPF-SYSTEM.md`): Kampf-Welt `engine/gameplay/kampf` für Spieler, NPCs, Puppe, Rivale – Zauber, Rattenbisse und Rivalen-Schläge laufen alle über `kampf.schade`
  - **Nahkampf** (`nahkampf`): F antippen = Kombo (3–4 Schläge, letzter = Finisher), F halten = schwerer Schlag aufladen; Waffe passt zur Ausrüstung (Schwert/Axt/Hammer/Dolch/Speer/Stab, sonst Faust);
    Treffer-Stopp, Kamera-Wackeln, Zahlen (Krit gelb), „Pariert!“, „Geblockt“, „Ausgewichen“
  - **Block** (B, rechte Maus, 🛡 halten): frühes Drücken = **Parade**; **Q/🌀** = Ausweichen mit kurzer Unverwundbarkeit; Betäubung/Frost halten dich fest
  - **Kampfmodus** wählbar: „✨ Action-Zauber“ (Ziffern 1–0) oder „🎯 MMO-Leiste“ (Rolle Krieger/Magier/Heiler, 4 Plätze auf 1–4, globale Abklingzeit, Wirkzeit, Wut/Mana, Reichweite, Ziel per T); Zauber bekommen Zustände (Brennen, Verlangsamt)
  - **🎯 Trainingspuppe** (viel Leben, heilt nach 5 s, DPS am Namensschild und im Ziel-Rahmen) und **🤺 Rivale** (Ritter: Kombos, angekündigter schwerer Schlag mit ‼, blockt/weicht aus; Parade → taumelt; leere Haltung → Schaden ×1,5; steht nach 4 s wieder auf); `?kampf=1` stellt beide sofort auf
  - Spieler-Rahmen (Leben, Schild, Haltung, Ressource, Zustände) oben links, Ziel-Rahmen für Lock-On bzw. zuletzt getroffenes Ziel
- 🔊 Synthetische Klänge (`engine/audio/klang`), im Menü abschaltbar
- Standard-Figur: Magier mit Zauberstab
- Figuren mit Randlicht und weicherer Schattenseite (`engine/render/figur-material`)
- 🕹 PS1-Look aus Viniland (`engine/render/psx`): grobe Pixel (300 Zeilen), wackelnde Eckpunkte, 5 Bit Farbe mit Dithering –
  liegt über der ganzen Szene, wird im Browser gemerkt; Kantenglättung wechselt erst nach Neuladen
- Gelände zum Ausprobieren: Treppe + Plateau (Stufen hochgehen), steile Rampe (rutschen), Teich (schwimmen), Bäume/Felsen (Hindernisse)
- 8 NPCs: einer folgt dir (und winkt), einer läuft eine Runde, der Rest lebt mit `character-brain` (wandern, arbeiten, plaudern)
- 🎯 Lock-On auf NPCs (T, nochmal = nächstes Ziel) – Zauber zielen darauf, sonst auf das Ziel in Blickrichtung
- 🏷 Namensschilder + Sprechblasen (`engine/ui/figur-schild`); in der Nähe eines NPCs E / 💬 = ansprechen

## 🌋 Großzauber
Vier Zauber, die die Welt verändern (`engine/gameplay/grosszauber-*`): **🌊 Flutwelle** (haushohe Welle, reißt alles mit, Figuren schwimmen),
**🧱 Erdwall** (Fels bricht aus dem Boden, wirft Gegner hoch, sperrt den Weg), **⛈️ Zyklon** (Wirbelsturm saugt Gegner hoch, schleudert Blitze),
**🌋 Erdriss** (Graben mit Lava, wirft alles in die Luft). Wählen: in der Zauberleiste oben tippen oder **Shift+1…4** (halten = überladen).
Bei jedem Großzauber: kurze Zeitlupe, Kamera zieht heraus und hebt sich (~2 s), heller Blitz.
- ⚔ **Schlachtfeld** (☰ → ⚔ Kampf → „Zum Schlachtfeld“ oder `?schlachtfeld=1`): 160 × 160 m offene, leicht wellige Ebene ohne Hindernisse; Nebel ab 90 m.
- 🐀 **Große Plage** (☰ → ⚔ Kampf oder `?grossplage=1`, dann 🐀 oben rechts): bis ~400 Wesen, breite Fronten von vorn und von der Seite.
- Neue Klänge: Grollen, Rauschen, Heulen, Bersten (`engine/audio/klang` 1.1).

## Steuerung
WASD/Pfeile laufen · Shift Sprint · Leertaste springen · Q Rolle/Dash (bricht Aufladen ab) · V gleiten · C ducken/tauchen · T Ziel · E ansprechen ·
Ziehen = Kamera · Rad = Zoom · F Schlag/Kombo (halten = schwer) · B/rechte Maus Block · G winken · R halten = aufladen, loslassen = zaubern · 1–0, ß, ´ = Zauber wählen und aufladen.
Zauberleiste oben: tippen = wählen, nochmal tippen = wirken (ohne Überladen). 🐀 oben rechts = Rattenplage an/aus.
Handy: Stick links (erscheint unter dem Finger, Größe passt sich dem Bildschirm an), rechts ziehen = Kamera, zwei Finger = Zoom,
Knöpfe unten rechts (⤒ ✨ ⚔ 🛡 🌀 🪂 🎯, 💬 nur bei NPCs), leichte Vibration. Gamepad geht auch.
